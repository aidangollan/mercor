from transformers import pipeline
import torch
import torch.nn as nn

class IndustryClassifier:
    def __init__(
        self,
        ner_model="dslim/bert-base-NER",
        classifier_model="facebook/bart-large-mnli"
    ):
        # Initialize pipelines
        self.ner_pipeline = pipeline(
            "ner",
            model=ner_model,
            tokenizer=ner_model,
            aggregation_strategy="simple"  # Groups tokens into whole entities
        )
        
        self.zero_shot_pipeline = pipeline(
            "zero-shot-classification",
            model=classifier_model
        )
        
        # Define classification labels
        self.startup_labels = [
            "early-stage startup",
            "late-stage startup", 
            "not a startup"
        ]
        
        self.industry_labels = [
            "AI labs",
            "Big Tech",
            "AI B2B startups",
            "AI B2C startups",
            "Quant Finance",
            "Traditional Finance",
            "Crypto",
            "Academia"
        ]

    def predict_industry(self, text):
        """
        Predicts company type and industry from text description.
        """
        # Extract organizations via NER
        entities = self.ner_pipeline(text)
        org_entities = [ent["word"] for ent in entities if ent["entity_group"] == "ORG"]
        
        if not org_entities:
            org_entities = ["(No explicit company found)"]
        
        # Classify startup vs established
        startup_result = self.zero_shot_pipeline(text, self.startup_labels)
        startup_prediction = startup_result["labels"][0]
        startup_confidence = startup_result["scores"][0]
        
        # Classify industry
        industry_result = self.zero_shot_pipeline(text, self.industry_labels)
        industry_prediction = industry_result["labels"][0]
        industry_confidence = industry_result["scores"][0]
        
        return {
            "text": text,
            "detected_orgs": org_entities,
            "startup_or_not": {
                "label": startup_prediction,
                "confidence": startup_confidence
            },
            "industry": {
                "label": industry_prediction,
                "confidence": industry_confidence
            }
        }

def create_industry_pipeline(ner_model=None, classifier_model=None):
    """
    Creates a pipeline for industry/company classification
    """
    classifier = IndustryClassifier(
        ner_model=ner_model if ner_model else "dslim/bert-base-NER",
        classifier_model=classifier_model if classifier_model else "facebook/bart-large-mnli"
    )
    
    def predict(text):
        return classifier.predict_industry(text)
    
    return predict

# Example usage:
"""
# Create the pipeline
industry_predictor = create_industry_pipeline()

# Example prediction
text = "I am a co-founder of a small software startup building next-generation AI solutions."
prediction = industry_predictor(text)
print(f"Detected Organizations: {prediction['detected_orgs']}")
print(f"Company Type: {prediction['startup_or_not']['label']} (confidence: {prediction['startup_or_not']['confidence']:.2f})")
print(f"Industry: {prediction['industry']['label']} (confidence: {prediction['industry']['confidence']:.2f})")
""" 