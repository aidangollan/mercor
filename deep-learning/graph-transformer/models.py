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
            out_channels=dim // 8,  # Divide by number of heads
            heads=8,
            dropout=0.1,
            edge_dim=None,
            concat=True  # Concatenate head outputs
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
        career_model_name="fazni/distilbert-base-uncased-career-path-prediction"
    ):
        super().__init__()
        
        # Input projection
        self.input_proj = nn.Linear(input_dim, model_dim)
        
        # Graph transformer
        self.transformer = GraphTransformer(
            dim=model_dim,
            depth=depth,
            edge_dim=edge_dim
        )
        
        # Career prediction components
        self.career_tokenizer = AutoTokenizer.from_pretrained(career_model_name)
        self.career_model = AutoModelForSequenceClassification.from_pretrained(career_model_name)
        
        # Get BERT hidden size
        self.text_hidden_size = self.career_model.config.hidden_size  # Usually 768
        
        # Fusion layers
        self.graph_proj = nn.Linear(model_dim, model_dim)
        self.text_proj = nn.Linear(self.text_hidden_size, model_dim)
        
        # Attention for combining node features
        self.attention = nn.Sequential(
            nn.Linear(model_dim, 1),
            nn.Softmax(dim=0)
        )
        
        # Final classifier with both graph and text features
        self.classifier = nn.Linear(model_dim * 2, self.career_model.config.num_labels)

    def forward(self, graph_data, text_data):
        # Process graph data
        x = graph_data.x
        adj = to_dense_adj(graph_data.edge_index)[0]
        
        # Project input features
        x = self.input_proj(x)
        
        # Add batch dimension
        x = x.unsqueeze(0)
        adj = adj.unsqueeze(0)
        
        # Apply transformer
        graph_features = self.transformer(x, adj)
        graph_features = graph_features.squeeze(0)  # [num_nodes, model_dim]
        
        # Project graph features
        graph_features = self.graph_proj(graph_features)  # [num_nodes, model_dim]
        
        # Compute attention weights for nodes
        attention_weights = self.attention(graph_features)  # [num_nodes, 1]
        
        # Weighted sum of node features
        graph_features = (graph_features * attention_weights).sum(dim=0)  # [model_dim]
        
        # Process text data
        text_inputs = self.career_tokenizer(
            text_data,
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to(graph_features.device)
        
        # Get text embeddings from BERT
        with torch.no_grad():
            text_outputs = self.career_model(**text_inputs, output_hidden_states=True)
            text_features = text_outputs.hidden_states[-1][:, 0, :]  # Use [CLS] token
        
        # Project text features
        text_features = self.text_proj(text_features.squeeze(0))  # [model_dim]
        
        # Combine graph and text features
        combined_features = torch.cat([graph_features, text_features])  # [model_dim * 2]
        
        # Final prediction
        predictions = self.classifier(combined_features)
        
        return predictions

    def predict_career_path(self, graph_data, text_data):
        self.eval()
        with torch.no_grad():
            predictions = self(graph_data, text_data)
            probabilities = torch.softmax(predictions, dim=-1)
            
            # Get the most likely career path
            predicted_class = torch.argmax(probabilities)
            confidence_score = probabilities[predicted_class].item()
            
            return {
                'label': self.career_model.config.id2label[predicted_class.item()],
                'score': confidence_score
            }

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
