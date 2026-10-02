import sqlite3
import pandas as pd
import json
from pathlib import Path
from app.config import DB_PATH, DATA_DIR

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reload: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if tables exist
    cursor.execute("SELECT count(name) FROM sqlite_master WHERE type='table' AND name='customers'")
    table_exists = cursor.fetchone()[0] > 0
    
    if force_reload or not table_exists:
        # Load CSVs into SQLite
        csv_tables = {
            "customers": DATA_DIR / "customers.csv",
            "orders": DATA_DIR / "orders.csv",
            "support_tickets": DATA_DIR / "support_tickets.csv",
            "crm_activity": DATA_DIR / "crm_activity.csv",
            "campaigns": DATA_DIR / "campaigns.csv",
            "products": DATA_DIR / "products.csv",
        }
        
        for table_name, csv_path in csv_tables.items():
            if csv_path.exists():
                df = pd.read_csv(csv_path)
                df.to_sql(table_name, conn, if_exists="replace", index=False)
                
        # Create decision ledger table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS decision_ledger (
                decision_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                question TEXT NOT NULL,
                target_entity_id TEXT NOT NULL,
                target_entity_name TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                priority_score REAL NOT NULL,
                priority_level TEXT NOT NULL,
                verification_status TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                calculations_json TEXT NOT NULL,
                reasoning_summary TEXT NOT NULL,
                why_not_selected_json TEXT,
                what_if_preview_json TEXT,
                conflicts_json TEXT,
                approval_status TEXT NOT NULL,
                simulated_action TEXT,
                action_executed_at TEXT,
                audit_trail_json TEXT NOT NULL
            )
        """)
        
        # Create evaluation runs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS evaluation_runs (
                run_id TEXT PRIMARY KEY,
                run_at TEXT NOT NULL,
                total_tests INTEGER NOT NULL,
                passed_tests INTEGER NOT NULL,
                failed_tests INTEGER NOT NULL,
                decision_accuracy REAL NOT NULL,
                numerical_accuracy REAL NOT NULL,
                evidence_grounding REAL NOT NULL,
                unsupported_claim_rate REAL NOT NULL,
                failure_handling_pass_rate REAL NOT NULL,
                avg_latency_ms REAL NOT NULL,
                details_json TEXT NOT NULL
            )
        """)
        
        conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db(force_reload=True)
    print("Database initialized successfully at", DB_PATH)
