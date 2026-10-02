from typing import Dict, Any, List, Optional
import uuid
import json
from datetime import datetime, timezone
from app.database import get_db_connection
from app.engine.analytics import calculate_customer_metrics, get_all_customer_ids
from app.engine.scoring import calculate_priority_score
from app.engine.verification import verify_customer_decision
from app.engine.evidence import get_customer_evidence_items
from app.engine.simulation import run_what_if_simulation

def search_business_data(query: str) -> List[Dict[str, Any]]:
    """
    Search business entities across customer records, orders, or tickets.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    like_q = f"%{query}%"
    cursor.execute("""
        SELECT customer_id, company_name, tier, annual_contract_value, status, industry, region
        FROM customers
        WHERE customer_id LIKE ? OR company_name LIKE ? OR industry LIKE ?
    """, (like_q, like_q, like_q))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_customer_profile(customer_id: str) -> Dict[str, Any]:
    """
    Retrieves the raw customer master data record.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    if not rows:
        return {"found": False, "error": f"Customer {customer_id} not found"}
    return {
        "found": True,
        "records": rows,
        "conflict": len(rows) > 1
    }

def get_customer_evidence(customer_id: str) -> List[Dict[str, Any]]:
    """
    Extracts all grounded evidence items mapped to source tables and rows.
    """
    return get_customer_evidence_items(customer_id)

def get_customer_metrics(customer_id: str) -> Dict[str, Any]:
    """
    Deterministically computes transaction frequency, inactivity, tickets, and CRM health.
    """
    return calculate_customer_metrics(customer_id)

def get_customer_priority_score(customer_id: str) -> Dict[str, Any]:
    """
    Computes transparent formula components and score for a customer.
    """
    metrics = calculate_customer_metrics(customer_id)
    return calculate_priority_score(metrics)

def check_data_conflicts(customer_id: str) -> Dict[str, Any]:
    """
    Checks for conflicting records, discordance, or missing datasets.
    """
    verification = verify_customer_decision(customer_id)
    return {
        "customer_id": customer_id,
        "conflicts_detected": verification["conflicts_detected"],
        "missing_data_detected": verification["missing_data_detected"],
        "issues": verification["issues"]
    }

def verify_decision(customer_id: str, proposed_claims: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Runs full verification checks.
    """
    return verify_customer_decision(customer_id, proposed_claims)

def run_simulation(top_n: int = 10, cost: Optional[float] = None, recovery: Optional[float] = None) -> Dict[str, Any]:
    """
    Simulates financial outcomes across scenarios.
    """
    return run_what_if_simulation(top_n, cost, recovery)

def create_decision_record(
    question: str,
    target_entity_id: str,
    target_entity_name: str,
    recommendation: str,
    priority_score: float,
    priority_level: str,
    verification_status: str,
    evidence_items: List[Dict[str, Any]],
    calculations: Dict[str, Any],
    reasoning_summary: str,
    why_not_selected: Optional[Dict[str, Any]] = None,
    what_if_preview: Optional[Dict[str, Any]] = None,
    conflicts: Optional[List[str]] = None,
    approval_status: str = "AWAITING HUMAN APPROVAL"
) -> Dict[str, Any]:
    """
    Persists an auditable decision into the Decision Ledger SQLite table.
    """
    decision_id = f"D-{uuid.uuid4().hex[:4].upper()}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    audit_trail = [
        {"timestamp": now_str, "action": "DECISION_GENERATED", "actor": "DecisionOS AI Reasoning Agent"},
        {"timestamp": now_str, "action": "DETERMINISTIC_VERIFIED", "status": verification_status, "actor": "Verification Engine"},
        {"timestamp": now_str, "action": "AWAITING_APPROVAL", "actor": "Executive Review Queue"}
    ]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO decision_ledger (
            decision_id, created_at, question, target_entity_id, target_entity_name,
            recommendation, priority_score, priority_level, verification_status,
            evidence_json, calculations_json, reasoning_summary,
            why_not_selected_json, what_if_preview_json, conflicts_json,
            approval_status, simulated_action, action_executed_at, audit_trail_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        decision_id, now_str, question, target_entity_id, target_entity_name,
        recommendation, priority_score, priority_level, verification_status,
        json.dumps(evidence_items), json.dumps(calculations), reasoning_summary,
        json.dumps(why_not_selected or {}), json.dumps(what_if_preview or {}),
        json.dumps(conflicts or []), approval_status,
        "Simulate Dedicated CS & Engineering SWAT Intervention", None, json.dumps(audit_trail)
    ))
    conn.commit()
    conn.close()
    
    return {
        "decision_id": decision_id,
        "created_at": now_str,
        "question": question,
        "target_entity_id": target_entity_id,
        "target_entity_name": target_entity_name,
        "recommendation": recommendation,
        "priority_score": priority_score,
        "priority_level": priority_level,
        "verification_status": verification_status,
        "evidence_items": evidence_items,
        "calculations": calculations,
        "reasoning_summary": reasoning_summary,
        "why_not_selected": why_not_selected,
        "what_if_preview": what_if_preview,
        "conflicts": conflicts or [],
        "approval_status": approval_status,
        "audit_trail": audit_trail
    }
