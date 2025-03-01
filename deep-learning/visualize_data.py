import os
import pickle
import numpy as np
import matplotlib.pyplot as plt
from scipy import sparse
import networkx as nx
from sklearn.manifold import TSNE

def load_graph(data_dir):
    """
    Load the graph (adjacency list) from the file produced by convert_data.py.
    Expected file: ind.clout.graph
    """
    graph_filename = "ind.clout.graph"
    graph_path = os.path.join(data_dir, graph_filename)
    with open(graph_path, "rb") as f:
        graph = pickle.load(f)
    return graph

def load_train_features(data_dir):
    """
    Load training features from file ind.clout.x.
    """
    filename = "ind.clout.x"
    path = os.path.join(data_dir, filename)
    with open(path, "rb") as f:
        X = pickle.load(f)
    return X

def load_train_labels(data_dir):
    """
    Load training labels from file ind.clout.y.
    """
    filename = "ind.clout.y"
    path = os.path.join(data_dir, filename)
    with open(path, "rb") as f:
        Y = pickle.load(f)
    return Y

def load_test_features(data_dir):
    """
    Load testing features from file ind.clout.tx.
    """
    filename = "ind.clout.tx"
    path = os.path.join(data_dir, filename)
    with open(path, "rb") as f:
        TX = pickle.load(f)
    return TX

def load_test_labels(data_dir):
    """
    Load testing labels from file ind.clout.ty.
    """
    filename = "ind.clout.ty"
    path = os.path.join(data_dir, filename)
    with open(path, "rb") as f:
        TY = pickle.load(f)
    return TY

def plot_graph(graph):
    """
    Convert the adjacency list into a NetworkX graph and visualize it.
    """
    G = nx.Graph()
    for source, targets in graph.items():
        for target in targets:
            G.add_edge(source, target)
    
    plt.figure(figsize=(10, 10))
    pos = nx.spring_layout(G, seed=42)
    nx.draw(G, pos, with_labels=True, node_color="skyblue", edge_color="gray", node_size=500)
    plt.title("Graph Structure")
    plt.show()

def plot_tsne_subplots(train_features, train_labels, test_features, test_labels):
    """
    Compute and visualize t-SNE on training and testing features in a 
    side-by-side subplot layout.
    """
    # Convert sparse matrices to dense arrays if necessary
    if sparse.issparse(train_features):
        train_features = train_features.toarray()
    if sparse.issparse(test_features):
        test_features = test_features.toarray()
    
    # Perform t-SNE separately on training and testing features.
    tsne_train = TSNE(n_components=2, random_state=42).fit_transform(train_features)
    tsne_test = TSNE(n_components=2, random_state=42).fit_transform(test_features)
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    sc1 = axes[0].scatter(tsne_train[:, 0], tsne_train[:, 1], 
                          c=train_labels, cmap='viridis', alpha=0.7)
    axes[0].set_title("t-SNE Projection of Training Features")
    axes[0].set_xlabel("t-SNE Component 1")
    axes[0].set_ylabel("t-SNE Component 2")
    plt.colorbar(sc1, ax=axes[0], label="Train Label")
    
    sc2 = axes[1].scatter(tsne_test[:, 0], tsne_test[:, 1], 
                          c=test_labels, cmap='coolwarm', alpha=0.7)
    axes[1].set_title("t-SNE Projection of Testing Features")
    axes[1].set_xlabel("t-SNE Component 1")
    axes[1].set_ylabel("t-SNE Component 2")
    plt.colorbar(sc2, ax=axes[1], label="Test Label")
    
    plt.tight_layout()
    plt.show()

def main():
    data_dir = "Dink-Net/data"
    
    # Load graph data
    print("Loading graph data...")
    graph = load_graph(data_dir)
    print(f"Graph loaded. Total nodes with outgoing edges: {len(graph)}")
    
    # Load training data
    print("Loading training features...")
    X = load_train_features(data_dir)
    print("Training features loaded. Shape:", X.shape)
    
    print("Loading training labels...")
    Y = load_train_labels(data_dir)
    if hasattr(Y, "shape"):
        print("Training labels loaded. Shape:", Y.shape)
    else:
        print("Training labels loaded. Total labels:", len(Y))
    
    # Load testing data
    print("Loading testing features...")
    TX = load_test_features(data_dir)
    print("Testing features loaded. Shape:", TX.shape)
    
    print("Loading testing labels...")
    TY = load_test_labels(data_dir)
    if hasattr(TY, "shape"):
        print("Testing labels loaded. Shape:", TY.shape)
    else:
        print("Testing labels loaded. Total labels:", len(TY))
    
    # Visualize the graph structure.
    print("Visualizing graph structure...")
    plot_graph(graph)
    
    # Visualize training and testing features using t-SNE.
    print("Visualizing training and testing features with t-SNE...")
    plot_tsne_subplots(X, Y, TX, TY)

if __name__ == "__main__":
    main()