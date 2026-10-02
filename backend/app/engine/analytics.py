import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.database import get_db_connection

REF_DATE = datetime(2026, 9, 29)

def calculate_customer_metrics(customer_id: str) -> Dict[str, Any]:
    """
    Deterministically computes all business metrics for a customer
    from SQLite tables. Zero hallucination.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch customer record
    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    rows = cursor.fetchall()
    
    if not rows:
        conn.close()
        return {
            "customer_id": customer_id,
            "exists": False,
            "has_sufficient_data": False,
            "error": f"Customer ID {customer_id} not found in customers dataset."
        }
        
    # Check for duplicate customer records in customers.csv
    has_customer_conflict = len(rows) > 1
    cust_row = rows[0]
    
    company_name = cust_row["company_name"]
    tier = cust_row["tier"]
    acv = float(cust_row["annual_contract_value"] or 0)
    status = cust_row["status"]
    renewal_date_str = cust_row["renewal_date"]
    
    # 2. Fetch orders
    cursor.execute(
        "SELECT order_id, order_date, amount, status, items_count FROM orders WHERE customer_id = ? ORDER BY order_date DESC",
        (customer_id,)
    )
    orders = cursor.fetchall()
    
    # 3. Fetch support tickets
    cursor.execute(
        "SELECT ticket_id, created_at, status, priority, category, resolution_time_hours, customer_sentiment FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC",
        (customer_id,)
    )
    tickets = cursor.fetchall()
    
    # 4. Fetch CRM activity
    cursor.execute(
        "SELECT activity_id, activity_type, activity_date, logged_by, notes, outcome FROM crm_activity WHERE customer_id = ? ORDER BY activity_date DESC",
        (customer_id,)
    )
    crm_activities = cursor.fetchall()
    
    # 5. Fetch campaign engagement
    cursor.execute(
        "SELECT campaign_id, campaign_name, sent_date, opened, clicked, unsubscribed FROM campaigns WHERE customer_id = ?",
        (customer_id,)
    )
    campaigns = cursor.fetchall()
    
    conn.close()
    
    # --- Check for sufficient data (Failure Case A) ---
    if len(orders) == 0 and len(crm_activities) == 0 and len(tickets) == 0:
        return {
            "customer_id": customer_id,
            "company_name": company_name,
            "tier": tier,
            "acv": acv,
            "exists": True,
            "has_sufficient_data": False,
            "error": "Insufficient evidence — zero historical orders, support tickets, and CRM records found.",
            "missing_datasets": ["orders.csv", "support_tickets.csv", "crm_activity.csv"]
        }

    # --- Calculations ---
    
    # Order frequency & trend
    # Prior period: 90 to 270 days ago (180 days = 6 months)
    # Recent period: 0 to 90 days ago (90 days = 3 months)
    recent_cutoff = REF_DATE - timedelta(days=90)
    prior_cutoff = REF_DATE - timedelta(days=270)
    
    recent_orders = []
    prior_orders = []
    total_spend_historical = 0.0
    latest_order_date = None
    
    for o in orders:
        odate = datetime.strptime(o["order_date"], "%Y-%m-%d")
        amt = float(o["amount"] or 0)
        st = o["status"]
        if st == "COMPLETED":
            total_spend_historical += amt
        if latest_order_date is None or odate > latest_order_date:
            latest_order_date = odate
            
        if odate >= recent_cutoff:
            recent_orders.append(o)
        elif odate >= prior_cutoff:
            prior_orders.append(o)
            
    recent_orders_count = len(recent_orders)
    prior_orders_count = len(prior_orders)
    
    # Frequency per month
    recent_freq_per_month = recent_orders_count / 3.0
    prior_freq_per_month = prior_orders_count / 6.0 if prior_orders_count > 0 else (0.1 if recent_orders_count > 0 else 0.0)
    
    if prior_freq_per_month > 0:
        freq_decline_pct = max(0.0, ((prior_freq_per_month - recent_freq_per_month) / prior_freq_per_month) * 100.0)
    else:
        freq_decline_pct = 0.0
        
    days_since_last_order = (REF_DATE - latest_order_date).days if latest_order_date else 365
    
    # CRM Recency & Notes
    latest_crm_date = None
    crm_cancellation_flag = False
    crm_dispute_notes = []
    
    for c in crm_activities:
        cdate = datetime.strptime(c["activity_date"], "%Y-%m-%d")
        if latest_crm_date is None or cdate > latest_crm_date:
            latest_crm_date = cdate
        notes_lower = str(c["notes"]).lower()
        outcome_lower = str(c["outcome"]).lower()
        if "terminated" in notes_lower or "termination" in notes_lower or "churned" in notes_lower or "terminated" in outcome_lower:
            crm_cancellation_flag = True
            crm_dispute_notes.append(c["notes"])
            
    days_since_last_crm = (REF_DATE - latest_crm_date).days if latest_crm_date else 365
    inactivity_days = min(days_since_last_order, days_since_last_crm)
    
    # Support tickets metrics
    unresolved_tickets = [t for t in tickets if t["status"] in ("OPEN", "ESCALATED", "IN_PROGRESS")]
    urgent_unresolved_tickets = [t for t in unresolved_tickets if t["priority"] in ("URGENT", "HIGH")]
    critical_sentiment_tickets = [t for t in tickets if t["customer_sentiment"] in ("CRITICAL", "NEGATIVE")]
    
    # Campaign engagement
    campaign_unsubscribed = any(camp["unsubscribed"] == 1 for camp in campaigns)
    total_campaigns = len(campaigns)
    opened_campaigns = sum(1 for camp in campaigns if camp["opened"] == 1)
    campaign_open_rate = (opened_campaigns / total_campaigns) if total_campaigns > 0 else 0.5
    
    # Renewal urgency
    renewal_days_remaining = None
    if renewal_date_str:
        try:
            rdate = datetime.strptime(renewal_date_str, "%Y-%m-%d")
            renewal_days_remaining = (rdate - REF_DATE).days
        except Exception:
            renewal_days_remaining = None
            
    return {
        "customer_id": customer_id,
        "company_name": company_name,
        "tier": tier,
        "status": status,
        "acv": acv,
        "exists": True,
        "has_sufficient_data": True,
        "has_customer_conflict": has_customer_conflict,
        "crm_cancellation_flag": crm_cancellation_flag,
        "crm_dispute_notes": crm_dispute_notes,
        "total_spend_historical": round(total_spend_historical, 2),
        "total_orders_count": len(orders),
        "recent_orders_count": recent_orders_count,
        "prior_orders_count": prior_orders_count,
        "recent_freq_per_month": round(recent_freq_per_month, 2),
        "prior_freq_per_month": round(prior_freq_per_month, 2),
        "freq_decline_pct": round(freq_decline_pct, 1),
        "days_since_last_order": days_since_last_order,
        "days_since_last_crm": days_since_last_crm,
        "inactivity_days": inactivity_days,
        "unresolved_tickets_count": len(unresolved_tickets),
        "urgent_unresolved_tickets_count": len(urgent_unresolved_tickets),
        "critical_sentiment_count": len(critical_sentiment_tickets),
        "campaign_unsubscribed": campaign_unsubscribed,
        "campaign_open_rate": round(campaign_open_rate, 2),
        "renewal_days_remaining": renewal_days_remaining,
        "latest_order_date": latest_order_date.strftime("%Y-%m-%d") if latest_order_date else None,
        "latest_crm_date": latest_crm_date.strftime("%Y-%m-%d") if latest_crm_date else None,
    }

def get_all_customer_ids() -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT customer_id FROM customers ORDER BY customer_id ASC")
    cids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return cids
