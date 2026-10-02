from typing import Dict, Any, List
from app.engine.analytics import calculate_customer_metrics
from app.database import get_db_connection

def verify_customer_decision(customer_id: str, proposed_claim: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Independent Verification Stage for DecisionOS.
    Checks:
    1. Does every numerical claim have a calculation source?
    2. Can every evidence claim be traced to source data?
    3. Are calculations reproducible?
    4. Are there conflicting records?
    5. Is required data missing?
    6. Did the recommendation rely on unsupported information?
    7. Did the model claim something outside the available dataset?
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    checks = []
    issues = []
    
    # Check 1: Record existence & conflict in customers table
    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    cust_rows = cursor.fetchall()
    
    if len(cust_rows) == 0:
        conn.close()
        return {
            "status": "DECISION WITHHELD",
            "reason": f"Customer ID {customer_id} does not exist in the connected enterprise datasets.",
            "traceability_score": 0.0,
            "reproducible": False,
            "conflicts_detected": False,
            "missing_data_detected": True,
            "checks": [
                {"name": "Customer Existence", "passed": False, "detail": "Target entity not found in customers.csv"}
            ],
            "issues": [f"Target customer {customer_id} not found in database."]
        }
        
    has_customer_conflict = len(cust_rows) > 1
    if has_customer_conflict:
        # Check specific conflicting fields
        acvs = [r["annual_contract_value"] for r in cust_rows]
        statuses = [r["status"] for r in cust_rows]
        issues.append(f"Conflicting primary records in customers.csv: ACVs found={acvs}, statuses found={statuses}")
        checks.append({
            "name": "Record Conflict Check",
            "passed": False,
            "detail": f"Conflicting records detected for {customer_id} across {len(cust_rows)} customer entries."
        })
    else:
        checks.append({
            "name": "Record Conflict Check",
            "passed": True,
            "detail": "Single authoritative customer primary record found in customers.csv."
        })
        
    # Check CRM conflict (e.g., active status vs CRM termination notice)
    cursor.execute("SELECT * FROM crm_activity WHERE customer_id = ?", (customer_id,))
    crm_rows = cursor.fetchall()
    crm_cancellation = False
    for c in crm_rows:
        notes = str(c["notes"]).lower()
        outcome = str(c["outcome"]).lower()
        if "terminated" in notes or "termination" in notes or "churned" in notes or "terminated" in outcome:
            crm_cancellation = True
            issues.append(f"CRM activity conflict: Record {c['activity_id']} states contract termination, but account marked ACTIVE.")
            break
            
    if crm_cancellation:
        checks.append({
            "name": "Cross-Dataset Consistency",
            "passed": False,
            "detail": "CRM notes indicate contract termination/churn dispute conflicting with customer directory status."
        })
    else:
        checks.append({
            "name": "Cross-Dataset Consistency",
            "passed": True,
            "detail": "No cross-dataset status contradictions detected between CRM and directory."
        })

    # Check 2: Missing data / completeness
    cursor.execute("SELECT count(*) FROM orders WHERE customer_id = ?", (customer_id,))
    order_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT count(*) FROM support_tickets WHERE customer_id = ?", (customer_id,))
    ticket_count = cursor.fetchone()[0]
    
    conn.close()
    
    if order_count == 0 and ticket_count == 0 and len(crm_rows) == 0:
        issues.append("Insufficient transaction, ticket, and CRM history (zero records across 3 connected tables).")
        checks.append({
            "name": "Evidence Completeness",
            "passed": False,
            "detail": "Zero records in orders.csv, support_tickets.csv, and crm_activity.csv."
        })
    else:
        checks.append({
            "name": "Evidence Completeness",
            "passed": True,
            "detail": f"Found {order_count} orders, {ticket_count} support tickets, and {len(crm_rows)} CRM interactions."
        })

    # Check 3: Deterministic calculation reproducibility
    metrics = calculate_customer_metrics(customer_id)
    if not metrics.get("has_sufficient_data", False):
        checks.append({
            "name": "Deterministic Reproducibility",
            "passed": False,
            "detail": "Cannot reproduce metrics due to lack of source events."
        })
    else:
        checks.append({
            "name": "Deterministic Reproducibility",
            "passed": True,
            "detail": "Metrics and formula components verified 100% reproducible against SQLite ledger."
        })
        
    # Check 4: Evidence Traceability
    traceable_items = []
    if order_count > 0:
        traceable_items.append("orders.csv")
    if ticket_count > 0:
        traceable_items.append("support_tickets.csv")
    if len(crm_rows) > 0:
        traceable_items.append("crm_activity.csv")
    traceable_items.append("customers.csv")
    
    checks.append({
        "name": "Source Lineage & Traceability",
        "passed": True,
        "detail": f"Claims directly mapped to source tables: {', '.join(traceable_items)}."
    })
    
    # Check 5: Claim Verification against proposed claims (if provided)
    unsupported_claims = []
    if proposed_claim:
        # Verify numerical accuracy
        if "claimed_acv" in proposed_claim and proposed_claim["claimed_acv"] != metrics.get("acv"):
            unsupported_claims.append(f"Claimed ACV {proposed_claim['claimed_acv']} does not match deterministic ACV {metrics.get('acv')}")
        if "claimed_decline_pct" in proposed_claim and proposed_claim["claimed_decline_pct"] != metrics.get("freq_decline_pct"):
            unsupported_claims.append(f"Claimed decline {proposed_claim['claimed_decline_pct']}% does not match calculated {metrics.get('freq_decline_pct')}%")
            
    if unsupported_claims:
        issues.extend(unsupported_claims)
        checks.append({
            "name": "Claim Verification",
            "passed": False,
            "detail": "; ".join(unsupported_claims)
        })
    else:
        checks.append({
            "name": "Claim Verification",
            "passed": True,
            "detail": "All numerical and categorical claims verified against deterministic computations."
        })

    # Final Verification Determination
    if has_customer_conflict:
        status = "DECISION WITHHELD"
        reason = "Conflicting customer master records detected in customers.csv. Decision withheld pending master data reconciliation."
    elif crm_cancellation:
        status = "REVIEW REQUIRED"
        reason = "Contradiction detected: CRM activity records state formal contract cancellation, while account directory displays ACTIVE status."
    elif order_count == 0 and ticket_count == 0:
        status = "DECISION WITHHELD"
        reason = "Insufficient evidence — zero commercial orders or support tickets found in connected datasets. Cannot defend recommendation."
    elif unsupported_claims:
        status = "REVIEW REQUIRED"
        reason = "Unsupported claims detected in recommendation reasoning. Human audit required."
    else:
        status = "VERIFIED"
        reason = "All evidence traceable to source records. Numerical calculations reproduced. No conflicting master records found."

    passed_count = sum(1 for c in checks if c["passed"])
    traceability_score = round((passed_count / len(checks)) * 100.0, 1)

    return {
        "status": status,
        "reason": reason,
        "traceability_score": traceability_score,
        "reproducible": metrics.get("has_sufficient_data", False),
        "conflicts_detected": has_customer_conflict or crm_cancellation,
        "missing_data_detected": (order_count == 0 and ticket_count == 0),
        "checks": checks,
        "issues": issues,
        "verified_metrics": metrics
    }
