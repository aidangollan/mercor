import torch
from torch_geometric.data import Data
from role_model import CareerGraphModel, create_career_pipeline
from industry_model import create_industry_pipeline

def create_sample_graph_data():
    # Create more meaningful node features based on skills/roles
    skills = [
        [1, 0, 0, 0],  # Programming
        [1, 1, 0, 0],  # Data Science
        [0, 0, 1, 0],  # Management
        [0, 0, 0, 1],  # Marketing
        [1, 0, 1, 0],  # Tech Lead
    ]
    
    # Expand to full dimension
    node_features = torch.zeros(5, 256)
    for i, skill in enumerate(skills):
        node_features[i, :4] = torch.tensor(skill)
    
    # Create meaningful connections
    edge_index = torch.tensor([
        [0, 1, 1, 2, 2, 3, 3, 4],  # Programming -> Data Science -> Management -> Marketing -> Tech Lead
        [1, 2, 2, 3, 3, 4, 4, 0]
    ], dtype=torch.long)
    
    return Data(
        x=node_features,
        edge_index=edge_index,
        num_nodes=5
    )

def test_career_prediction():
    # Create sample data
    graph_data = create_sample_graph_data()
    
    test_summaries = [
        "Software engineer with 5 years of experience in full-stack development at Google. Expert in Python, React, and cloud technologies. Led development of scalable microservices architecture.",
        "Data scientist at OpenAI with PhD in Statistics. Experienced in machine learning, deep learning, and big data analytics. Published research in top AI conferences.",
        "Product manager at early-stage fintech startup. Led cross-functional teams in agile environment. Launched successful products generating $10M+ revenue.",
        "Marketing specialist at Meta focusing on digital marketing. Expertise in SEO, content strategy, and social media campaigns. Increased conversion rates by 150%.",
        "UX designer at Apple with background in psychology. Created user-centered designs for mobile apps. Conducted user research and usability testing."
    ]
    
    # Initialize predictors
    career_predictor = create_career_pipeline()
    industry_predictor = create_industry_pipeline()
    
    print("Testing Career and Industry Predictions:\n")
    print("-" * 80)
    
    for summary in test_summaries:
        print(f"Input Summary: {summary}\n")
        
        # Career path predictions
        career_predictions = career_predictor(graph_data, summary)
        print("Top 3 Predicted Career Paths:")
        for i, pred in enumerate(career_predictions, 1):
            print(f"{i}. {pred['label']} (confidence: {pred['score']:.4f})")
        
        # Industry predictions
        industry_prediction = industry_predictor(summary)
        print("\nIndustry Analysis:")
        print(f"Detected Organizations: {industry_prediction['detected_orgs']}")
        print(f"Company Type: {industry_prediction['startup_or_not']['label']} "
              f"(confidence: {industry_prediction['startup_or_not']['confidence']:.4f})")
        print(f"Industry: {industry_prediction['industry']['label']} "
              f"(confidence: {industry_prediction['industry']['confidence']:.4f})")
        
        print("\n" + "-" * 80 + "\n")

if __name__ == "__main__":
    test_career_prediction() 