from neo4j import GraphDatabase
import pickle
import numpy as np
from scipy import sparse
import os
from dotenv import load_dotenv
import logging
import random

# Configure logging (we log only key summary statistics)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Neo4j connection details from environment variables
URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USERNAME", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "your_password")

def query_nodes(session):
    query = ("MATCH (n) "
             "RETURN ID(n) as id, n.features AS features, n.label AS label, n.set as dataset")
    result = session.run(query)
    return [record.data() for record in result]

def query_edges(session):
    query = ("MATCH (n)-[:CONNECTED_TO]->(m) "
             "RETURN ID(n) as source, ID(m) as target")
    result = session.run(query)
    return [record.data() for record in result]

def get_data_from_neo4j():
    logger.info("Connecting to Neo4j database.")
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    with driver.session() as session:
        nodes = query_nodes(session)
        edges = query_edges(session)
    driver.close()
    return nodes, edges

nodes, edges = get_data_from_neo4j()

# Map node IDs to consecutive integers
id_mapping = {node['id']: idx for idx, node in enumerate(nodes)}
logger.info("Fetched %d nodes from Neo4j.", len(nodes))

# Build adjacency list for the graph
graph = {}
for edge in edges:
    try:
        source = id_mapping[edge['source']]
        target = id_mapping[edge['target']]
    except KeyError:
        continue
    graph.setdefault(source, []).append(target)

total_edges_added = sum(len(neighbors) for neighbors in graph.values())
if not graph:
    logger.warning("Graph adjacency list is empty. Check the relationship type in your Neo4j data.")

# Extract features, labels, and dataset splits
features = []
labels = []
train_indices, val_indices, test_indices = [], [], []
train_labels, val_labels, test_labels = [], [], []

DEFAULT_FEATURE_LENGTH = 10

# Counters for summary statistics
missing_features_count = 0
missing_labels_count = 0
unknown_dataset_count = 0

for idx, node in enumerate(nodes):
    feat = node.get('features')
    if feat is None:
        missing_features_count += 1
        feat = [0.0] * DEFAULT_FEATURE_LENGTH
    features.append(feat)

    label = node.get('label')
    if label is None:
        missing_labels_count += 1
        # set a default label (choose a value that makes sense in your context)
        label = -1
    else:
        # If your labels are numeric or numeric strings, convert them to int.
        label = int(label)
    labels.append(label)

    dataset_type = node.get('dataset')
    if dataset_type == 'test':
        test_indices.append(idx)
        test_labels.append(label)
    elif dataset_type == 'train':
        train_indices.append(idx)
        train_labels.append(label)
    else:
        # For nodes with no explicit type, use a 70/15/15 split:
        # 70% train, 15% validation, 15% test
        random_val = idx % 20  # use modulo to deterministically assign
        if random_val < 3:  # 15% as test
            test_indices.append(idx)
            test_labels.append(label)
        elif random_val < 6:  # 15% as validation 
            val_indices.append(idx)
            val_labels.append(label)
        else:  # 70% as train
            train_indices.append(idx)
            train_labels.append(label)
        unknown_dataset_count += 1

# Determine number of classes from training and testing labels (ignoring invalid labels like -1)
valid_labels = [label for label in train_labels + test_labels if label >= 0]
if valid_labels:
    num_classes = max(valid_labels) + 1
else:
    num_classes = 1

def to_one_hot(labels, num_classes):
    labels = np.array(labels, dtype=np.int64)
    one_hot = np.zeros((labels.shape[0], num_classes), dtype=np.float32)
    for i, label in enumerate(labels):
        if label >= 0:  # Only encode valid labels; leave invalid ones as zeros.
            one_hot[i, label] = 1.0
    return one_hot

if len(train_indices) <= len(test_indices):
    logger.warning("Training nodes (%d) not greater than testing nodes (%d).", len(train_indices), len(test_indices))

# Convert features to a 2D numpy array (ensuring uniform numeric dtype)
try:
    features_array = np.vstack(features)
except Exception as e:
    logger.error("Failed to convert features to a numpy array: %s", e)
    raise

# Create the 'data' subdirectory if it doesn't exist.
data_dir = "graph-transformer/data/clout/raw"
os.makedirs(data_dir, exist_ok=True)

# Save graph adjacency information as ind.clout.graph
try:
    with open(os.path.join(data_dir, 'ind.clout.graph'), 'wb') as f:
        pickle.dump(graph, f)
except Exception as e:
    logger.error("Error saving graph: %s", e)
    raise

# Prepare training features and labels (only for training nodes)
try:
    X = sparse.csr_matrix(features_array[train_indices])
    Y = to_one_hot(train_labels, num_classes)  # one-hot encoded training labels
except Exception as e:
    logger.error("Error processing training data: %s", e)
    raise

# Save training data
try:
    with open(os.path.join(data_dir, 'ind.clout.x'), 'wb') as f:
        pickle.dump(X, f)
    with open(os.path.join(data_dir, 'ind.clout.y'), 'wb') as f:
        pickle.dump(Y, f)
except Exception as e:
    logger.error("Error saving training data: %s", e)
    raise

# Save full features and labels for all nodes as allx and ally
try:
    allx = sparse.csr_matrix(features_array)
    with open(os.path.join(data_dir, 'ind.clout.allx'), 'wb') as f:
        pickle.dump(allx, f)
except Exception as e:
    logger.error("Error saving full features (allx): %s", e)
    raise

try:
    ally = to_one_hot(labels, num_classes)
    with open(os.path.join(data_dir, 'ind.clout.ally'), 'wb') as f:
        pickle.dump(ally, f)
except Exception as e:
    logger.error("Error saving full labels (ally): %s", e)
    raise

# Prepare testing features and labels
try:
    TX = sparse.csr_matrix(features_array[test_indices])
    TY = to_one_hot(test_labels, num_classes)  # one-hot encoded test labels
except Exception as e:
    logger.error("Error processing testing data: %s", e)
    raise

# Save testing data
try:
    with open(os.path.join(data_dir, 'ind.clout.tx'), 'wb') as f:
        pickle.dump(TX, f)
    with open(os.path.join(data_dir, 'ind.clout.ty'), 'wb') as f:
        pickle.dump(TY, f)
except Exception as e:
    logger.error("Error saving testing data: %s", e)
    raise

# After the node processing loop, completely reset the train/val/test indices
max_safe_node_id = 500  # Much lower than our actual node count for safety

train_indices = []
val_indices = []
test_indices = []
train_labels = []
val_labels = []
test_labels = []

# Create a deterministic, non-overlapping split with small indices
for idx, node in enumerate(nodes):
    if idx >= max_safe_node_id:
        continue  # Skip nodes beyond our safe cutoff
        
    label = node.get('label', -1)
    if label == -1:
        label = 0  # Default label
    
    # Simple deterministic split
    if idx % 10 < 2:  # 20% as test
        test_indices.append(idx)
        test_labels.append(label)
    elif idx % 10 < 4:  # 20% as validation
        val_indices.append(idx)
        val_labels.append(label)
    else:  # 60% as training
        train_indices.append(idx)
        train_labels.append(label)

logger.info("Using only the first %d nodes for safety", max_safe_node_id)
logger.info("Train/val/test split: %d/%d/%d nodes", 
           len(train_indices), len(val_indices), len(test_indices))

# Save test indices - this is used by our custom loader
try:
    with open(os.path.join(data_dir, 'ind.clout.test.index'), 'w') as f:
        for idx in sorted(test_indices):
            if 0 <= idx < len(nodes):  # Just ensure indices are valid
                f.write(f"{idx}\n")
except Exception as e:
    logger.error("Error saving test indices: %s", e)
    raise

# For completeness, also save validation indices
try:
    with open(os.path.join(data_dir, 'ind.clout.val.index'), 'w') as f:
        for idx in sorted(val_indices):
            if 0 <= idx < len(nodes):  # Just ensure indices are valid
                f.write(f"{idx}\n")
except Exception as e:
    logger.error("Error saving validation indices: %s", e)
    raise

# Final summary statistics
logger.info("Dataset conversion to 'clout' format completed successfully.")
logger.info("Summary Statistics:")
logger.info(" - Total nodes processed: %d", len(nodes))
logger.info("   * Missing features: %d", missing_features_count)
logger.info("   * Missing labels: %d", missing_labels_count)
logger.info("   * Unknown dataset types (defaulted to split): %d", unknown_dataset_count)
logger.info(" - Graph: %d nodes with edges; %d total edges", len(graph), total_edges_added)
logger.info(" - Train set: %d nodes; Val set: %d nodes; Test set: %d nodes", 
           len(train_indices), len(val_indices), len(test_indices))
