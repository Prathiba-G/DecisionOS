from typing import Dict, Any, List
from app.database import get_db_connection
from app.engine.analytics import calculate_customer_metrics

def get_customer_evidence_items(customer_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves granular, verifiable evidence items pointing back to source data:
    Dataset, Record, Field, Value, Used For, Lineage Context.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    evidence_list = []
    
    # 1. Customer dataset evidence
    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    cust_rows = cursor.fetchall()
    for row in cust_rows:
        evidence_list.append({
            "id": f"EVID-CUST-{customer_id}-{row['company_name'].replace(' ', '_')}",
            "dataset": "customers.csv",
            "table": "customers",
            "record_id": f"customer_id={customer_id}",
            "field": "annual_contract_value",
            "value": f"${float(row['annual_contract_value'] or 0):,.2f}",
            "context": f"Tier: {row['tier']}, Status: {row['status']}, Renewal: {row['renewal_date']}",
            "used_for": "Customer Value & Exposure Component in Priority Scoring",
            "verified": True
        })
        
    # 2. Orders dataset evidence (recent vs prior)
    cursor.execute(
        "SELECT order_id, order_date, amount, status, items_count FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 5",
        (customer_id,)
    )
    orders = cursor.fetchall()
    if orders:
        latest = orders[0]
        evidence_list.append({
            "id": f"EVID-ORD-{customer_id}-LATEST",
            "dataset": "orders.csv",
            "table": "orders",
            "record_id": f"order_id={latest['order_id']}",
            "field": "order_date / amount",
            "value": f"{latest['order_date']} (${float(latest['amount'] or 0):,.2f})",
            "context": f"Most recent recorded transaction ({latest['status']}, {latest['items_count']} items).",
            "used_for": "Inactivity and Recency Calculation",
            "verified": True
        })
        
    # Check frequency drop
    metrics = calculate_customer_metrics(customer_id)
    if metrics.get("has_sufficient_data", False):
        evidence_list.append({
            "id": f"EVID-ORD-{customer_id}-DECLINE",
            "dataset": "orders.csv",
            "table": "orders",
            "record_id": f"aggregate(customer_id={customer_id})",
            "field": "purchase_frequency",
            "value": f"{metrics['prior_freq_per_month']}/mo -> {metrics['recent_freq_per_month']}/mo (-{metrics['freq_decline_pct']}%)",
            "context": f"Prior period had {metrics['prior_orders_count']} orders; recent 90-day window had only {metrics['recent_orders_count']} orders.",
            "used_for": "Purchase Decline Component (25% weight)",
            "verified": True
        })
        
    # 3. Support tickets evidence
    cursor.execute(
        "SELECT ticket_id, created_at, status, priority, category, customer_sentiment FROM support_tickets WHERE customer_id = ? AND status != 'RESOLVED' ORDER BY created_at DESC",
        (customer_id,)
    )
    unresolved_tickets = cursor.fetchall()
    for t in unresolved_tickets:
        evidence_list.append({
            "id": f"EVID-TCK-{t['ticket_id']}",
            "dataset": "support_tickets.csv",
            "table": "support_tickets",
            "record_id": f"ticket_id={t['ticket_id']}",
            "field": "status / priority / sentiment",
            "value": f"{t['status']} | {t['priority']} | Sentiment: {t['customer_sentiment']}",
            "context": f"Category: {t['category']}, Logged: {t['created_at']}",
            "used_for": "Support Escalation & Churn Risk Component (20% weight)",
            "verified": True
        })
        
    # 4. CRM activity evidence
    cursor.execute(
        "SELECT activity_id, activity_type, activity_date, logged_by, notes, outcome FROM crm_activity WHERE customer_id = ? ORDER BY activity_date DESC LIMIT 3",
        (customer_id,)
    )
    crm_rows = cursor.fetchall()
    for c in crm_rows:
        evidence_list.append({
            "id": f"EVID-CRM-{c['activity_id']}",
            "dataset": "crm_activity.csv",
            "table": "crm_activity",
            "record_id": f"activity_id={c['activity_id']}",
            "field": "activity_type / outcome",
            "value": f"{c['activity_type']} -> {c['outcome']}",
            "context": f"Notes by {c['logged_by']} on {c['activity_date']}: \"{c['notes']}\"",
            "used_for": "Qualitative Account Health & Conflict Verification",
            "verified": True
        })
        
    # 5. Campaign engagement evidence
    cursor.execute(
        "SELECT campaign_id, campaign_name, sent_date, opened, clicked, unsubscribed FROM campaigns WHERE customer_id = ?",
        (customer_id,)
    )
    camp_rows = cursor.fetchall()
    for camp in camp_rows:
        if camp["unsubscribed"] == 1:
            evidence_list.append({
                "id": f"EVID-CMP-{camp['campaign_id']}-UNSUB",
                "dataset": "campaigns.csv",
                "table": "campaigns",
                "record_id": f"campaign_id={camp['campaign_id']}",
                "field": "unsubscribed",
                "value": "1 (UNSUBSCRIBED)",
                "context": f"Customer unsubscribed from '{camp['campaign_name']}' on {camp['sent_date']}",
                "used_for": "Executive Detachment / Engagement Decline Component (10% weight)",
                "verified": True
            })
            
    conn.close()
    return evidence_list
