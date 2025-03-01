import pickle

file_path = './Dink-Net/data/ind.cora.graph'

with open(file_path, 'rb') as f:
    graph_data = pickle.load(f)

# Previewing the first 5 items
for node, neighbors in list(graph_data.items())[:5]:
    print(f'Node {node} neighbors: {neighbors}')
