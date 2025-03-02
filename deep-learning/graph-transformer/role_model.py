import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from torch_geometric.nn import TransformerConv
from torch_geometric.nn import global_mean_pool
from torch_geometric.utils import to_dense_adj, dense_to_sparse

class GraphTransformer(nn.Module):
    def __init__(self, dim, depth, edge_dim):
        super().__init__()
        self.dim = dim
        
        # Single TransformerConv layer with correct dimensions
        self.transformer = TransformerConv(
            in_channels=dim,
            out_channels=dim,  # Keep same dimension throughout
            heads=8,
            dropout=0.1,
            edge_dim=None,
            concat=False  # Average heads instead of concatenating
        )
        
        # Layer norm
        self.norm = nn.LayerNorm(dim)

    def forward(self, x, adj_mat):
        # Remove batch dimension for processing
        x = x.squeeze(0)
        adj_mat = adj_mat.squeeze(0)
        
        # Convert adjacency matrix to edge index
        edge_index, _ = dense_to_sparse(adj_mat)
        
        # Store residual
        x_res = x
        
        # Apply transformer layer
        x = self.transformer(x, edge_index)
        
        # Apply normalization
        x = self.norm(x)
        
        # Add residual
        x = x + x_res
        
        # Add batch dimension back
        x = x.unsqueeze(0)
        return x

class CareerGraphModel(nn.Module):
    def __init__(
        self,
        input_dim=256,
        model_dim=128,
        edge_dim=32,
        depth=3,
        career_model_name="fazni/distilbert-base-uncased-career-path-prediction",
        text_weight=0.8,  # Even higher weight for text
        graph_weight=0.2  # Lower weight for graph
    ):
        super().__init__()
        self.text_weight = text_weight
        self.graph_weight = graph_weight
        
        # Career prediction components (primary signal)
        self.career_tokenizer = AutoTokenizer.from_pretrained(career_model_name)
        self.career_model = AutoModelForSequenceClassification.from_pretrained(career_model_name)
        
        # Graph components (supplementary signal)
        self.input_proj = nn.Linear(input_dim, model_dim)
        self.transformer = GraphTransformer(
            dim=model_dim,
            depth=depth,
            edge_dim=edge_dim
        )
        self.graph_proj = nn.Linear(model_dim, self.career_model.config.num_labels)

    def forward(self, graph_data, text_data):
        # Get text predictions (primary signal)
        text_inputs = self.career_tokenizer(
            text_data,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=512
        ).to(graph_data.x.device)
        
        # Get BERT predictions
        text_outputs = self.career_model(**text_inputs)
        text_logits = text_outputs.logits
        
        # Process graph data (supplementary signal)
        x = graph_data.x
        adj = to_dense_adj(graph_data.edge_index)[0]
        x = self.input_proj(x)
        x = x.unsqueeze(0)
        adj = adj.unsqueeze(0)
        
        # Get graph features
        graph_features = self.transformer(x, adj)
        graph_features = graph_features.squeeze(0)
        graph_logits = self.graph_proj(graph_features.mean(dim=0))
        
        # Weighted combination of predictions
        combined_logits = (
            self.text_weight * text_logits +
            self.graph_weight * graph_logits
        )
        
        return combined_logits.squeeze(0)

    def predict_career_path(self, graph_data, text_data):
        self.eval()
        with torch.no_grad():
            predictions = self(graph_data, text_data)
            probabilities = torch.softmax(predictions, dim=-1)
            
            # Get top 3 predictions
            top_probs, top_indices = torch.topk(probabilities, k=3)
            
            predictions = []
            for prob, idx in zip(top_probs, top_indices):
                predictions.append({
                    'label': self.career_model.config.id2label[idx.item()],
                    'score': prob.item()
                })
            
            return predictions

def create_career_pipeline(model_path=None):
    model = CareerGraphModel()
    if model_path:
        model.load_state_dict(torch.load(model_path))
    
    def predict(graph_data, text_data):
        return model.predict_career_path(graph_data, text_data)
    
    return predict

# Example usage:
"""
# Initialize the model
model = CareerGraphModel()

# Create the pipeline
career_predictor = create_career_pipeline()

# Example prediction
graph_data = ... # Your graph data in PyTorch Geometric format
text_data = "Software engineer with 5 years of experience in full-stack development..."

prediction = career_predictor(graph_data, text_data)
print(f"Predicted Career Path: {prediction['label']} (confidence: {prediction['score']:.4f})")
"""
