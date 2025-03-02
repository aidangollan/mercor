import os
import pickle
import numpy as np
from scipy import sparse
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def convert_data(features, labels, graph, train_indices, test_indices, num_classes):
    """
    Convert data to the required format and save to disk.
    """
    # Create the 'data' subdirectory if it doesn't exist
    data_dir = "data/clout/raw"
    os.makedirs(data_dir, exist_ok=True)

    # Convert features to numpy array
    features_array = np.vstack(features)

    # Save graph structure
    with open(os.path.join(data_dir, 'ind.clout.graph'), 'wb') as f:
        pickle.dump(graph, f)

    # Save training data
    X = sparse.csr_matrix(features_array[train_indices])
    Y = np.eye(num_classes)[labels[train_indices]]
    with open(os.path.join(data_dir, 'ind.clout.x'), 'wb') as f:
        pickle.dump(X, f)
    with open(os.path.join(data_dir, 'ind.clout.y'), 'wb') as f:
        pickle.dump(Y, f)

    # Save test data
    TX = sparse.csr_matrix(features_array[test_indices])
    TY = np.eye(num_classes)[labels[test_indices]]
    with open(os.path.join(data_dir, 'ind.clout.tx'), 'wb') as f:
        pickle.dump(TX, f)
    with open(os.path.join(data_dir, 'ind.clout.ty'), 'wb') as f:
        pickle.dump(TY, f)

    # Save all data
    allx = sparse.csr_matrix(features_array)
    ally = np.eye(num_classes)[labels]
    with open(os.path.join(data_dir, 'ind.clout.allx'), 'wb') as f:
        pickle.dump(allx, f)
    with open(os.path.join(data_dir, 'ind.clout.ally'), 'wb') as f:
        pickle.dump(ally, f)

    # Save test indices
    with open(os.path.join(data_dir, 'ind.clout.test.index'), 'w') as f:
        for idx in test_indices:
            f.write(f"{idx}\n")

if __name__ == "__main__":
    # Example usage - replace with your actual data
    num_nodes = 1000
    num_features = 50
    num_classes = 5
    
    # Generate sample data
    features = np.random.randn(num_nodes, num_features)
    labels = np.random.randint(0, num_classes, num_nodes)
    
    # Create a simple graph structure
    graph = {i: list(np.random.choice(num_nodes, 10, replace=False)) 
            for i in range(num_nodes)}
    
    # Split indices
    indices = np.random.permutation(num_nodes)
    train_indices = indices[:int(0.8 * num_nodes)]
    test_indices = indices[int(0.8 * num_nodes):]
    
    # Convert and save data
    convert_data(features, labels, graph, train_indices, test_indices, num_classes)
    logger.info("Data conversion complete!") 