import os
import torch
from typing import Dict, Any
import logging
import random
import time
import sys

# Add xfraud to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'xfraud')))

logger = logging.getLogger(__name__)

class ModelService:
    """
    Service for managing the xFraud model in memory.
    Loads the model once at startup and provides methods for analysis.
    """
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        self.model = None
        self.explainer = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_model()
    
    def _load_model(self):
        """
        Load the model into memory.
        *** This is a placeholder for the refactored xFraud model loading. ***
        """
        try:
            # Check if the model file exists
            if not self.model_path or not os.path.exists(self.model_path):
                logger.warning(f"Model file not found at {self.model_path}. Using MOCK service.")
                self.model = "mock_model"  # Use a string to indicate mock mode
                self.explainer = "mock_explainer"
                return

            logger.info(f"Loading model from {self.model_path} onto {self.device}")
            
            # --- This is a placeholder for the actual refactored model loading ---
            #
            # Example:
            # from glib.pyg.model import HetNet, GNN
            # num_feat = 114  # Example: from xFraud-small
            # n_hid = 400
            # gnn = GNN(conv_name='hgt', n_in=num_feat, n_hid=n_hid, n_heads=8, n_layers=6, 
            #           dropout=0.2, num_node_type=5, num_edge_type=8)
            # self.model = HetNet(gnn, num_feat, num_embed=n_hid, n_hidden=n_hid)
            # self.model.load_state_dict(torch.load(self.model_path, map_location=self.device))
            # self.model.to(self.device)
            # self.model.eval()
            #
            # from torch_geometric.nn.models import GNNExplainer
            # self.explainer = GNNExplainer(self.model, epochs=100)
            #
            # --- End Placeholder ---

            # For now, we'll set mock flags to simulate a loaded model
            self.model = "mock_model_loaded"
            self.explainer = "mock_explainer_loaded"
            
            logger.info("Model loaded successfully (MOCK).")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model = None
            self.explainer = None
    
    def predict(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict fraud probability for a transaction (fast, synchronous)."""
        if not self.model:
            raise Exception("Model is not loaded.")
        
        try:
            # --- Placeholder for actual prediction ---
            # 1. Get features for transaction_data from Graph DB / Feature Store
            # 2. Format features into a PyTorch Geometric `Data` object
            # 3.
            #    with torch.no_grad():
            #        output = self.model(data.x, data.edge_index, ...)
            #        prob = torch.sigmoid(output).item()
            # --- End Placeholder ---
            
            # Mock prediction based on transaction ID
            prob = 0.5 + (hash(transaction_data["transaction_id"]) % 49) / 100.0
            
            return {
                "fraud_probability": prob,
                "risk_factors": [
                    {"factor": "Model prediction (mock)", "importance": 0.8},
                ]
            }
        except Exception as e:
            logger.error(f"Error in prediction: {e}")
            return {"fraud_probability": 0.0, "risk_factors": []}

    def explain(self, transaction_id: str, graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate explanation for a transaction (slow, asynchronous)."""
        if not self.explainer:
            raise Exception("Explainer is not loaded.")
        
        try:
            # --- Placeholder for actual explanation ---
            # This is the slow part (e.g., 5-10 seconds)
            # 1. Convert `graph_data` (nodes/edges from Neo4j) into PyG `Data` object
            # 2. Get features for all nodes in the subgraph
            # 3.
            #    node_idx = ... # find index of transaction_id
            #    node_feat_mask, edge_mask = self.explainer.explain_node(node_idx, data.x, data.edge_index, ...)
            # 4.
            #    formatted_graph = self._format_explanation(graph_data, edge_mask)
            #    return formatted_graph
            # --- End Placeholder ---

            # Simulate model runtime
            time.sleep(random.randint(3, 7))  # Simulate 3-7 second model run time

            # Return a mock graph based on the ID
            return self._generate_mock_explanation(transaction_id, graph_data)
            
        except Exception as e:
            logger.error(f"Error in explanation: {e}")
            return self._generate_mock_explanation(transaction_id, graph_data, error=True)

    def _generate_mock_explanation(self, transaction_id: str, graph_data: Dict[str, Any], error: bool = False) -> Dict[str, Any]:
        """Generates a mock explanation graph."""
        
        # Add 'label' and 'color' to nodes from graph_data for vis.js
        for node in graph_data["nodes"]:
            node["label"] = f"{node['group'].capitalize()}: {node['id'][:6]}..."
            node["color"] = self._get_node_color(node['group'])
            if node["id"] == transaction_id:
                node["shape"] = "star"
                node["size"] = 25
                
        # Add 'width' and 'title' to edges from graph_data for vis.js
        for edge in graph_data["edges"]:
            edge["width"] = random.randint(1, 10)
            edge["title"] = f"Importance: {edge['width'] / 10.0}"

        summary = f"Analysis for {transaction_id}: High risk. Transaction is linked via shared entities to other high-risk nodes."
        if error:
            summary = f"Could not generate explanation for {transaction_id}. Showing mock data."

        return {
            "nodes": graph_data["nodes"],
            "edges": graph_data["edges"],
            "summary": summary
        }
        
    def _get_node_color(self, group: str) -> str:
        colors = {
            "transaction": "#e74c3c",
            "user": "#3498db",
            "paymenttoken": "#9b59b6",
            "email": "#2ecc71",
            "ip": "#f39c12",
            "device": "#1abc9c",
        }
        return colors.get(group, "#bdc3c7")

# Global singleton instance
model_service_instance = None

def get_model_service(model_path: str = None) -> ModelService:
    global model_service_instance
    if model_service_instance is None:
        model_service_instance = ModelService(model_path)
    return model_service_instance
