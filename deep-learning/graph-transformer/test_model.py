import torch
from torch_geometric.data import Data
from models import CareerGraphModel, create_career_pipeline

def create_sample_graph_data():
    # Create sample node features (10 nodes, with input_dim=256)
    node_features = torch.randn(10, 256)  # Match input_dim in CareerGraphModel
    
    # Create sample edge connections
    edge_index = torch.tensor([
        [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9],
        [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 0]
    ], dtype=torch.long)
    
    return Data(
        x=node_features,
        edge_index=edge_index,
        num_nodes=10
    )

def test_career_prediction():
    # Create sample data
    graph_data = create_sample_graph_data()
    
    # More diverse test cases
    test_summaries = [
        "Software engineer with 5 years of experience in full-stack development. Expert in Python, React, and cloud technologies. Led development of scalable microservices architecture.",
        "Data scientist with PhD in Statistics. Experienced in machine learning, deep learning, and big data analytics. Published research in top AI conferences.",
        "Product manager with MBA. Led cross-functional teams in agile environment. Launched successful products generating $10M+ revenue.",
        "Marketing specialist with focus on digital marketing. Expertise in SEO, content strategy, and social media campaigns. Increased conversion rates by 150%.",
        "UX designer with background in psychology. Created user-centered designs for mobile apps. Conducted user research and usability testing."
    ]
    
    # Initialize model
    model = CareerGraphModel()
    
    # Create prediction pipeline
    career_predictor = create_career_pipeline()
    
    # Test predictions
    print("Testing Career Predictions:\n")
    for summary in test_summaries:
        prediction = career_predictor(graph_data, summary)
        print(f"Input Summary: {summary}")
        print(f"Predicted Career Path: {prediction['label']}")
        print(f"Confidence Score: {prediction['score']:.4f}\n")

if __name__ == "__main__":
    test_career_prediction() 