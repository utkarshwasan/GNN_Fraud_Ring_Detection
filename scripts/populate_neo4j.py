#!/usr/bin/env python3
"""
Script to populate Neo4j with sample transaction data from the xFraud dataset.
"""

import os
import sys
import pandas as pd
from datetime import datetime
import random

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from graph_db_manager import get_graph_db_manager

def populate_from_parquet(parquet_path, db_manager, sample_size=100):
    """
    Read the xFraud parquet file and populate Neo4j.
    """
    print(f"Loading data from {parquet_path}...")
    df = pd.read_parquet(parquet_path)
    
    print(f"Total edges in dataset: {len(df)}")
    
    # Sample the data if needed
    if sample_size and len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=42)
        print(f"Sampled {sample_size} transactions")
    
    # Get unique transactions (sources)
    transactions = df[['src', 'src_type', 'ts', 'src_label', 'seed']].drop_duplicates(subset=['src'])
    
    print(f"Processing {len(transactions)} unique transactions...")
    
    for idx, row in transactions.iterrows():
        # Create a mock transaction object
        transaction = {
            'transaction_id': str(row['src']),
            'user_id': f"user_{random.randint(1000, 9999)}",
            'ip_address': f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
            'email': f"user{random.randint(100, 999)}@example.com",
            'timestamp': datetime.fromtimestamp(row['ts']) if pd.notna(row['ts']) and row['ts'] > 0 else datetime.now(),
            'amount': round(random.uniform(10.0, 500.0), 2),
            'merchant': random.choice(['Amazon', 'eBay', 'PayPal', 'Stripe', 'Square']),
            'device_id': f"device_{random.randint(1000, 9999)}"
        }
        
        # Add to Neo4j
        db_manager.add_transaction(transaction)
        
        if (idx + 1) % 10 == 0:
            print(f"  Processed {idx + 1}/{len(transactions)} transactions...")
    
    print("Done! Neo4j populated with sample data.")

def main():
    # Connect to Neo4j
    db_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    db_user = os.getenv("NEO4J_USER", "neo4j")
    db_pass = os.getenv("NEO4J_PASSWORD", "xfraud_password")
    
    print(f"Connecting to Neo4j at {db_uri}...")
    db_manager = get_graph_db_manager(db_uri, db_user, db_pass)
    
    # Path to the sample data
    parquet_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'g_publish.parquet')
    
    if not os.path.exists(parquet_path):
        print(f"Error: Data file not found at {parquet_path}")
        print("Please ensure the xFraud sample data is available.")
        sys.exit(1)
    
    # Populate with sample data (100 transactions)
    populate_from_parquet(parquet_path, db_manager, sample_size=100)
    
    db_manager.close()

if __name__ == '__main__':
    main()
