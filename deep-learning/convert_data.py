from neo4j import GraphDatabase
import pickle
import numpy as np
from scipy import sparse
import os
from dotenv import load_dotenv
import logging

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
train_indices, test_indices = [], []
train_labels, test_labels = [], []

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
    labels.append(label)

    dataset_type = node.get('dataset')
    if dataset_type == 'test':
        test_indices.append(idx)
        test_labels.append(label)
    else:
        if dataset_type != 'train':
            unknown_dataset_count += 1
        train_indices.append(idx)
        train_labels.append(label)

if len(train_indices) <= len(test_indices):
    logger.warning("Training nodes (%d) not greater than testing nodes (%d).", len(train_indices), len(test_indices))

# Convert features to a 2D numpy array (ensuring uniform numeric dtype)
try:
    features_array = np.vstack(features)
except Exception as e:
    logger.error("Failed to convert features to a numpy array: %s", e)
    raise

# Create the 'data' subdirectory if it doesn't exist.
data_dir = "Dink-Net/data"
os.makedirs(data_dir, exist_ok=True)

# Save graph adjacency information as ind.clout.graph
try:
    with open(os.path.join(data_dir, 'ind.clout.graph'), 'wb') as f:
        pickle.dump(graph, f)
except Exception as e:
    logger.error("Error saving graph: %s", e)
    raise

# Prepare training features and labels
try:
    # Training features (for "x")
    X = sparse.csr_matrix(features_array[train_indices])
    # Training labels (for "y")
    Y = np.array(train_labels)
except Exception as e:
    logger.error("Error processing training data: %s", e)
    raise

# Save training features as ind.clout.x
try:
    with open(os.path.join(data_dir, 'ind.clout.x'), 'wb') as f:
        pickle.dump(X, f)
except Exception as e:
    logger.error("Error saving training features (x): %s", e)
    raise

# Save training labels as ind.clout.y
try:
    with open(os.path.join(data_dir, 'ind.clout.y'), 'wb') as f:
        pickle.dump(Y, f)
except Exception as e:
    logger.error("Error saving training labels (y): %s", e)
    raise

# Save all non-test features as ind.clout.allx (same as X in this case)
try:
    with open(os.path.join(data_dir, 'ind.clout.allx'), 'wb') as f:
        pickle.dump(X, f)
except Exception as e:
    logger.error("Error saving all non-test features (allx): %s", e)
    raise

# Save all non-test labels as ind.clout.ally (same as Y in this case)
try:
    with open(os.path.join(data_dir, 'ind.clout.ally'), 'wb') as f:
        pickle.dump(Y, f)
except Exception as e:
    logger.error("Error saving all non-test labels (ally): %s", e)
    raise

# Prepare testing features and labels
try:
    TX = sparse.csr_matrix(features_array[test_indices])
    TY = np.array(test_labels)
except Exception as e:
    logger.error("Error processing testing data: %s", e)
    raise

# Save testing features as ind.clout.tx
try:
    with open(os.path.join(data_dir, 'ind.clout.tx'), 'wb') as f:
        pickle.dump(TX, f)
except Exception as e:
    logger.error("Error saving testing features (tx): %s", e)
    raise

# Save testing labels as ind.clout.ty
try:
    with open(os.path.join(data_dir, 'ind.clout.ty'), 'wb') as f:
        pickle.dump(TY, f)
except Exception as e:
    logger.error("Error saving testing labels (ty): %s", e)
    raise

# Save test indices as ind.clout.test.index
try:
    with open(os.path.join(data_dir, 'ind.clout.test.index'), 'w') as f:
        for idx in test_indices:
            f.write(f"{idx}\n")
except Exception as e:
    logger.error("Error saving test indices: %s", e)
    raise

# Final summary statistics
logger.info("Dataset conversion to 'clout' format completed successfully.")
logger.info("Summary Statistics:")
logger.info(" - Total nodes processed: %d", len(nodes))
logger.info("   * Missing features: %d", missing_features_count)
logger.info("   * Missing labels: %d", missing_labels_count)
logger.info("   * Unknown dataset types (defaulted to train): %d", unknown_dataset_count)
logger.info(" - Graph: %d nodes with edges; %d total edges", len(graph), total_edges_added)
logger.info(" - Train set: %d nodes; Test set: %d nodes", len(train_indices), len(test_indices))
