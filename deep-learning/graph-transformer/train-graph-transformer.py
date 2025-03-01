#!/usr/bin/env python
"""
train_graph_transformer.py

This script trains a Graph Transformer (from lucidrains' graph-transformer-pytorch)
on the Cora dataset (Planetoid format) using full-batch node classification.
It is set up for distributed training using PyTorch DistributedDataParallel (DDP)
to run on an 8×H100 node. Additionally, a --macos flag is available to run on macOS (CPU only).

Usage (from command line with torchrun when not on macOS):
    torchrun --nproc_per_node=8 train_graph_transformer.py --epochs 200 --lr 0.01

Usage (on macOS):
    python train_graph_transformer.py --macos --epochs 100 --lr 0.01
"""

import os
import argparse
import time

import torch
import torch.nn as nn
import torch.optim as optim
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

from torch_geometric.data import Data, InMemoryDataset
from torch_geometric.utils import to_dense_adj
import numpy as np
import pickle

# Import the GraphTransformer model from lucidrains package.
from graph_transformer_pytorch import GraphTransformer


def setup_distributed():
    """Initialize distributed process group and set device."""
    dist.init_process_group(backend="nccl")
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    return local_rank


def cleanup_distributed():
    """Cleanup distributed process group."""
    dist.destroy_process_group()


def is_main_process():
    """
    Helper function to check if the current process is the main process.
    If distributed is not initialized, defaults to True.
    """
    return not dist.is_initialized() or dist.get_rank() == 0


class CloutDataset(InMemoryDataset):
    def __init__(self, root, name='clout', transform=None, pre_transform=None):
        self.name = name
        # Ensure the root path contains the dataset name
        root = os.path.join(root, name)
        super(CloutDataset, self).__init__(root, transform, pre_transform)
        
        # Check if processed file exists
        processed_path = self.processed_paths[0]
        if os.path.exists(processed_path):
            # Explicitly use weights_only=False to allow loading torch_geometric classes
            self.data, self.slices = torch.load(processed_path, weights_only=False)
        else:
            # This will trigger the process() method to run
            self.process()
            self.data, self.slices = torch.load(self.processed_paths[0], weights_only=False)

    @property
    def raw_file_names(self):
        return [f'ind.{self.name}.x', f'ind.{self.name}.tx', f'ind.{self.name}.allx', 
                f'ind.{self.name}.y', f'ind.{self.name}.ty', f'ind.{self.name}.ally', 
                f'ind.{self.name}.graph', f'ind.{self.name}.test.index']

    @property
    def processed_file_names(self):
        return ['data.pt']

    def download(self):
        # No download required, data already in raw_dir
        pass

    def process(self):
        data_path = self.raw_dir
        
        # Load features and labels
        with open(os.path.join(data_path, f'ind.{self.name}.allx'), 'rb') as f:
            allx = pickle.load(f)
        with open(os.path.join(data_path, f'ind.{self.name}.ally'), 'rb') as f:
            ally = pickle.load(f)
            
        # Load graph structure
        with open(os.path.join(data_path, f'ind.{self.name}.graph'), 'rb') as f:
            graph_dict = pickle.load(f)
            
        # Convert graph_dict to edge_index
        edge_index = []
        for source, targets in graph_dict.items():
            for target in targets:
                edge_index.append([source, target])
                
        if not edge_index:  # If empty, create a default self-loop
            print("Warning: No edges found in graph. Creating self-loop for first node.")
            edge_index = [[0, 0]]
            
        # Create masks for train/val/test
        num_nodes = allx.shape[0]
        train_mask = torch.zeros(num_nodes, dtype=torch.bool)
        val_mask = torch.zeros(num_nodes, dtype=torch.bool)
        test_mask = torch.zeros(num_nodes, dtype=torch.bool)
        
        # Load test indices if file exists
        try:
            with open(os.path.join(data_path, f'ind.{self.name}.test.index'), 'r') as f:
                test_indices = [int(idx) for idx in f.readlines()]
                for idx in test_indices:
                    if 0 <= idx < num_nodes:
                        test_mask[idx] = True
        except (FileNotFoundError, IOError):
            # If no test indices, use last 20% of nodes for testing
            test_size = int(0.2 * num_nodes)
            test_mask[-test_size:] = True
            
        # If no valid test nodes, create a safe fallback
        if not test_mask.any():
            test_size = min(100, int(0.2 * num_nodes))
            test_mask[-test_size:] = True
            print(f"No valid test indices found, using last {test_size} nodes as test set")
        
        # Use 15% for validation (from non-test nodes)
        non_test_indices = [i for i in range(num_nodes) if not test_mask[i]]
        val_size = min(int(0.15 * num_nodes), len(non_test_indices))
        for idx in non_test_indices[:val_size]:
            val_mask[idx] = True
            
        # Remaining nodes (non-test, non-val) are for training
        for i in range(num_nodes):
            if not (test_mask[i] or val_mask[i]):
                train_mask[i] = True
                
        # Convert sparse matrices to tensors if needed
        if hasattr(allx, 'toarray'):
            x = torch.FloatTensor(allx.toarray())
        else:
            x = torch.FloatTensor(allx)
            
        if hasattr(ally, 'toarray'):
            y = torch.FloatTensor(ally.toarray())
        else:
            y = torch.FloatTensor(ally)
            
        # If y is one-hot encoded, convert to class indices
        if y.dim() > 1 and y.size(1) > 1:
            y = y.max(1)[1]
            
        # Create edge_index tensor (PyG format)
        edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        
        # Create the data object
        data = Data(
            x=x,
            y=y,
            edge_index=edge_index,
            train_mask=train_mask,
            val_mask=val_mask,
            test_mask=test_mask
        )
        
        data_list = [data]
        data, slices = self.collate(data_list)
        torch.save((data, slices), self.processed_paths[0])


class ModelWrapper(nn.Module):
    """
    Wraps an input projection, the GraphTransformer, and a classifier head.
    
    It projects the node features to the transformer dimension, applies the
    Graph Transformer (using an adjacency matrix input) and then classifies each node.
    """
    def __init__(self, input_dim, model_dim, edge_dim, depth, num_classes):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, model_dim)
        self.transformer = GraphTransformer(
            dim=model_dim,
            depth=depth,
            edge_dim=edge_dim,
            with_feedforwards=True,
            gated_residual=True,
            rel_pos_emb=True,
            accept_adjacency_matrix=True,  # Use dense adjacency matrix input.
        )
        self.classifier = nn.Linear(model_dim, num_classes)

    def forward(self, x, adj, mask):
        # x: [num_nodes, input_dim]
        # Project to transformer dimension.
        x = self.input_proj(x)  # [num_nodes, model_dim]
        # Add batch dimension (batch size = 1 for full-batch training)
        x = x.unsqueeze(0)  # [1, num_nodes, model_dim]
        # If no mask is provided, assume all tokens are valid.
        if mask is None:
            mask = torch.ones(1, x.size(1), dtype=torch.bool, device=x.device)
        else:
            mask = mask.unsqueeze(0)
        # Unsqueeze adj to have batch dimension: [1, num_nodes, num_nodes]
        adj = adj.unsqueeze(0)
        # Forward through GraphTransformer. It returns (nodes, edges).
        out_nodes, _ = self.transformer(x, adj_mat=adj, mask=mask)
        # Remove batch dimension.
        out_nodes = out_nodes.squeeze(0)  # [num_nodes, model_dim]
        # Apply classifier head.
        logits = self.classifier(out_nodes)  # [num_nodes, num_classes]
        return logits


def train(args, device, use_ddp=True):
    print("Processing...")
    
    # Use our custom dataset - removed the reference to args.dataset in the root path
    dataset = CloutDataset(root=args.data_dir, name=args.dataset)
    data = dataset[0].to(device)
    
    # Create a dense adjacency matrix from edge_index.
    # to_dense_adj returns a tensor of shape [1, num_nodes, num_nodes]
    adj = to_dense_adj(data.edge_index, max_num_nodes=data.num_nodes)[0].to(device)
    
    # For transformer input mask we use all-ones (all nodes valid)
    full_mask = torch.ones(data.num_nodes, dtype=torch.bool, device=device)
    
    # Initialize our model wrapper.
    model = ModelWrapper(
        input_dim=dataset.num_features,
        model_dim=args.model_dim,
        edge_dim=args.edge_dim,
        depth=args.depth,
        num_classes=dataset.num_classes
    ).to(device)
    
    # Optionally wrap the model in DDP if not running on macOS.
    if use_ddp:
        if device.type == "cuda":
            # For CUDA DDP, provide the device index.
            model = DDP(model, device_ids=[device.index])
        else:
            model = DDP(model)
    
    optimizer = optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()
    
    best_val_acc = 0.0
    best_test_acc = 0.0
    
    for epoch in range(1, args.epochs + 1):
        model.train()
        optimizer.zero_grad()
        
        # Forward pass: get logits for all nodes.
        logits = model(data.x, adj, full_mask)  # [num_nodes, num_classes]
        
        # Compute loss on training nodes.
        loss = criterion(logits[data.train_mask], data.y[data.train_mask])
        loss.backward()
        optimizer.step()
        
        # Evaluation (full-batch).
        model.eval()
        with torch.no_grad():
            logits = model(data.x, adj, full_mask)
            # Calculate accuracy on train, validation, and test sets.
            train_pred = logits[data.train_mask].argmax(dim=1)
            train_acc = (train_pred == data.y[data.train_mask]).float().mean().item()
            
            val_pred = logits[data.val_mask].argmax(dim=1)
            val_acc = (val_pred == data.y[data.val_mask]).float().mean().item()
            
            test_pred = logits[data.test_mask].argmax(dim=1)
            test_acc = (test_pred == data.y[data.test_mask]).float().mean().item()
        
        if is_main_process() and epoch % args.print_every == 0:
            print(f"Epoch {epoch:03d}: Loss {loss.item():.4f}, "
                  f"Train Acc {train_acc:.4f}, Val Acc {val_acc:.4f}, Test Acc {test_acc:.4f}")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_test_acc = test_acc
    
    # On the main process, report best performance.
    if is_main_process():
        print(f"Best Val Acc: {best_val_acc:.4f}, corresponding Test Acc: {best_test_acc:.4f}")


def main():
    parser = argparse.ArgumentParser(
        description="Train Graph Transformer on a smaller dataset (600 nodes) using DDP or CPU mode for macOS"
    )
    parser.add_argument("--data_dir", type=str, default="./data",
                        help="Directory where the dataset is saved")
    # Optionally, update the dataset name if your 600-node dataset has a different identifier.
    parser.add_argument("--dataset", type=str, default="MySmallDataset",
                        help="Name of the dataset (e.g., MySmallDataset or Cora)")
    parser.add_argument("--epochs", type=int, default=100,
                        help="Number of training epochs (adjusted for smaller dataset)")
    parser.add_argument("--lr", type=float, default=0.01,
                        help="Learning rate")
    parser.add_argument("--model_dim", type=int, default=128,
                        help="Transformer model dimension (reduced for smaller dataset)")
    parser.add_argument("--edge_dim", type=int, default=256,
                        help="Edge feature dimension (reduced for smaller dataset)")
    parser.add_argument("--depth", type=int, default=3,
                        help="Number of transformer layers (reduced for smaller dataset)")
    parser.add_argument("--print_every", type=int, default=10,
                        help="Print training info every n epochs")
    parser.add_argument("--macos", action="store_true",
                        help="Run on macOS (CPU only, no distributed training)")
    args = parser.parse_args()

    # Select device and distributed mode based on the --macos flag.
    if args.macos:
        print("Running on macOS: using CPU and disabling distributed training.")
        device = torch.device("cpu")
        use_ddp = False
    else:
        local_rank = setup_distributed()
        device = torch.device(f"cuda:{local_rank}")
        use_ddp = True

    start_time = time.time()
    train(args, device, use_ddp)
    if is_main_process():
        print(f"Training complete in {(time.time() - start_time)/60:.2f} minutes")
    if not args.macos:
        cleanup_distributed()


if __name__ == "__main__":
    main()
