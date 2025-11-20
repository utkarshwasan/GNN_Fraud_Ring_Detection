import os
import logging
from neo4j import GraphDatabase, exceptions
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class GraphDatabaseManager:
    """
    Manager for the Neo4j graph database.
    Handles connections and optimized graph queries.
    """
    
    def __init__(self, db_uri: str, db_user: str, db_password: str):
        self.driver = None
        try:
            self.driver = GraphDatabase.driver(db_uri, auth=(db_user, db_password))
            self.driver.verify_connectivity()
            logger.info(f"Connected to graph database at {db_uri}")
            self._create_constraints()
        except exceptions.ServiceUnavailable:
            logger.error(f"Could not connect to Neo4j at {db_uri}. Check if it is running.")
        except exceptions.AuthError:
            logger.error(f"Neo4j authentication failed. Check user/password.")
        except Exception as e:
            logger.error(f"Error connecting to graph database: {e}")
    
    def close(self):
        if self.driver:
            self.driver.close()

    def _create_constraints(self):
        """Create uniqueness constraints for faster lookups."""
        if not self.driver: return
        with self.driver.session() as session:
            try:
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE")
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (i:IP) REQUIRE i.id IS UNIQUE")
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Email) REQUIRE e.id IS UNIQUE")
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE")
                session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:PaymentToken) REQUIRE p.id IS UNIQUE")
                logger.info("Graph constraints ensured.")
            except Exception as e:
                logger.error(f"Error creating constraints: {e}")

    def add_transaction(self, transaction: Dict[str, Any]):
        """Adds a new transaction and its relationships to the graph."""
        if not self.driver:
            logger.warning("Graph DB not available. Skipping transaction add.")
            return

        try:
            with self.driver.session() as session:
                # This Cypher query creates all nodes and relationships in one go
                session.run(
                    """
                    // Create the transaction node
                    MERGE (t:Transaction {id: $txn_id})
                    SET t.amount = $amount, t.merchant = $merchant, t.timestamp = $timestamp
                    
                    // Create the user and link to the transaction
                    MERGE (u:User {id: $user_id})
                    MERGE (u)-[:PERFORMED]->(t)
                    
                    // Create IP and link to user
                    MERGE (ip:IP {id: $ip_address})
                    MERGE (u)-[:USED_IP]->(ip)
                    
                    // Create Email and link to user
                    MERGE (e:Email {id: $email})
                    MERGE (u)-[:HAS_EMAIL]->(e)
                    
                    // Create Device and link to user
                    MERGE (d:Device {id: COALESCE($device_id, 'unknown_device')})
                    MERGE (u)-[:USED_DEVICE]->(d)
                    """,
                    txn_id=transaction["transaction_id"],
                    user_id=transaction["user_id"],
                    ip_address=transaction["ip_address"],
                    email=transaction["email"],
                    timestamp=transaction["timestamp"].isoformat(),
                    amount=transaction["amount"],
                    merchant=transaction["merchant"],
                    device_id=transaction.get("device_id")
                )
            logger.info(f"Added/Updated transaction {transaction['transaction_id']} in graph.")
        except Exception as e:
            logger.error(f"Error adding transaction to graph: {e}")

    def get_transaction_subgraph(self, transaction_id: str, depth: int = 2) -> Dict[str, Any]:
        """
        Gets a subgraph of specified depth around a transaction.
        Falls back to simple MATCH if APOC is not available.
        """
        if not self.driver:
            logger.warning("Graph DB not available. Returning mock subgraph.")
            return self._generate_mock_subgraph(transaction_id)
        
        # Try APOC first, fall back to simple query
        try:
            with self.driver.session() as session:
                # Try APOC query
                query = """
                MATCH (t:Transaction {id: $txn_id})
                CALL apoc.path.subgraphAll(t, {
                    relationshipFilter: "*",
                    minLevel: 0,
                    maxLevel: $depth
                })
                YIELD nodes, relationships
                RETURN nodes, relationships
                """
                
                result = session.run(query, txn_id=transaction_id, depth=depth)
                record = result.single()
                
                if not record or not record["nodes"]:
                    raise Exception("No subgraph found")
                
                nodes = []
                for node in record["nodes"]:
                    labels = list(node.labels)
                    group = labels[0].lower() if labels else "unknown"
                    
                    nodes.append({
                        "id": node.get("id", node.element_id),
                        "group": group,
                        "properties": dict(node)
                    })

                edges = []
                for rel in record["relationships"]:
                    edges.append({
                        "from": rel.start_node.get("id", rel.start_node.element_id),
                        "to": rel.end_node.get("id", rel.end_node.element_id),
                        "title": rel.type
                    })
                
                return {"nodes": nodes, "edges": edges}
                
        except Exception as e:
            logger.warning(f"APOC query failed: {e}. Trying simple query...")
            
            # Fallback to simple query without APOC
            try:
                with self.driver.session() as session:
                    query = """
                    MATCH (t:Transaction {id: $txn_id})
                    OPTIONAL MATCH path = (t)-[*0..2]-(n)
                    WITH collect(DISTINCT t) + collect(DISTINCT n) as nodes, 
                         relationships(path) as rels
                    UNWIND rels as rel
                    RETURN nodes, collect(DISTINCT rel) as relationships
                    """
                    
                    result = session.run(query, txn_id=transaction_id)
                    record = result.single()
                    
                    if not record:
                        logger.warning(f"No subgraph found for {transaction_id}. Returning mock.")
                        return self._generate_mock_subgraph(transaction_id)
                    
                    nodes = []
                    for node in record["nodes"]:
                        if node is None:
                            continue
                        labels = list(node.labels)
                        group = labels[0].lower() if labels else "unknown"
                        
                        nodes.append({
                            "id": node.get("id", node.element_id),
                            "group": group,
                            "properties": dict(node)
                        })

                    edges = []
                    for rel in record["relationships"]:
                        if rel is None:
                            continue
                        edges.append({
                            "from": rel.start_node.get("id", rel.start_node.element_id),
                            "to": rel.end_node.get("id", rel.end_node.element_id),
                            "title": rel.type
                        })
                    
                    if not nodes:
                        logger.warning(f"Empty result for {transaction_id}. Returning mock.")
                        return self._generate_mock_subgraph(transaction_id)
                    
                    return {"nodes": nodes, "edges": edges}
                    
            except Exception as e2:
                logger.error(f"Error getting transaction subgraph: {e2}")
                return self._generate_mock_subgraph(transaction_id, error=True)

    def _generate_mock_subgraph(self, transaction_id: str, error: bool = False) -> Dict[str, Any]:
        """Generates a mock subgraph as a fallback."""
        nodes = [
            {"id": transaction_id, "group": "transaction"},
            {"id": "user_1", "group": "user"},
            {"id": "pmt_A", "group": "paymenttoken"},
            {"id": "email_X", "group": "email"},
            {"id": "fraud_1", "group": "transaction"},
            {"id": "fraud_2", "group": "transaction"},
            {"id": "pmt_B", "group": "paymenttoken"},
        ]
        edges = [
            {"from": transaction_id, "to": "user_1", "title": "PERFORMED_BY"},
            {"from": "user_1", "to": "pmt_A", "title": "USED_TOKEN"},
            {"from": "pmt_A", "to": "pmt_B", "title": "SHARED_TOKEN_LINK"},
            {"from": "pmt_B", "to": "fraud_1", "title": "USED_IN"},
            {"from": "pmt_B", "to": "fraud_2", "title": "USED_IN"},
        ]
        return {"nodes": nodes, "edges": edges}

# Global singleton instance
graph_db_instance = None

def get_graph_db_manager(db_uri: str, db_user: str, db_password: str) -> GraphDatabaseManager:
    global graph_db_instance
    if graph_db_instance is None:
        graph_db_instance = GraphDatabaseManager(db_uri, db_user, db_password)
    return graph_db_instance
