import csv
import os
from datetime import datetime, timedelta
from pathlib import Path
from app.config import DATA_DIR

def generate_seed_datasets():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Reference date for deterministic recency and calculations: 2026-09-29
    ref_date = datetime(2026, 9, 29)
    
    # -------------------------------------------------------------
    # 1. CUSTOMERS.CSV
    # -------------------------------------------------------------
    customers_path = DATA_DIR / "customers.csv"
    customers_data = [
        # id, company_name, tier, annual_contract_value, contract_start_date, renewal_date, status, industry, region
        ("CUST-1001", "Acme Industries", "Enterprise", 210000, "2024-01-15", "2026-11-15", "ACTIVE", "Manufacturing", "North America"),
        ("CUST-1002", "Apex Retail Group", "Enterprise", 185000, "2024-03-01", "2026-12-01", "ACTIVE", "E-Commerce", "North America"),
        ("CUST-1003", "Vanguard Financial", "Mid-Market", 95000, "2024-06-10", "2026-10-30", "ACTIVE", "Fintech", "Europe"),
        ("CUST-1004", "OmniTech Solutions", "Enterprise", 160000, "2023-11-01", "2026-11-20", "ACTIVE", "SaaS", "North America"),
        ("CUST-1005", "Helios Health Systems", "Enterprise", 240000, "2023-09-15", "2027-01-15", "ACTIVE", "Healthcare", "North America"),
        ("CUST-1006", "Kestrel Logistics", "Mid-Market", 82000, "2025-01-10", "2026-11-05", "ACTIVE", "Supply Chain", "Europe"),
        ("CUST-1007", "Beacon Media Labs", "Mid-Market", 74000, "2024-08-01", "2026-10-15", "ACTIVE", "Digital Media", "North America"),
        ("CUST-1008", "Cobalt Cyber Defense", "Enterprise", 195000, "2024-02-20", "2027-02-20", "ACTIVE", "Cybersecurity", "North America"),
        ("CUST-1009", "Starlight Aerospace", "Enterprise", 280000, "2023-05-12", "2026-12-15", "ACTIVE", "Aerospace", "North America"),
        ("CUST-1010", "BlueWave Logistics", "Enterprise", 175000, "2024-04-10", "2027-04-10", "ACTIVE", "Maritime", "Europe"),
        ("CUST-1011", "Titan Energy Corp", "Enterprise", 220000, "2023-10-01", "2027-03-01", "ACTIVE", "Clean Energy", "North America"),
        ("CUST-1012", "Pulse Therapeutics", "Mid-Market", 88000, "2025-02-01", "2027-02-01", "ACTIVE", "Biotech", "North America"),
        ("CUST-1013", "Zenith Global Trading", "Enterprise", 150000, "2024-05-15", "2026-11-30", "ACTIVE", "Commodities", "Asia-Pacific"),
        ("CUST-1014", "Orion Cloud Services", "Mid-Market", 68000, "2025-03-10", "2027-03-10", "ACTIVE", "Cloud Infra", "Europe"),
        ("CUST-1015", "Strata Real Estate", "Mid-Market", 52000, "2024-11-01", "2026-11-01", "ACTIVE", "Proptech", "North America"),
        ("CUST-1016", "Crestview Automotive", "Enterprise", 190000, "2024-01-20", "2027-01-20", "ACTIVE", "Automotive", "Europe"),
        ("CUST-1017", "Quantum Robotics", "Enterprise", 215000, "2024-07-01", "2027-07-01", "ACTIVE", "Robotics", "North America"),
        ("CUST-1018", "Hyperion Agritech", "SMB", 36000, "2025-04-01", "2026-10-20", "ACTIVE", "Agriculture", "South America"),
        ("CUST-1019", "Aura Communications", "Mid-Market", 84000, "2024-09-01", "2026-12-10", "ACTIVE", "Telecom", "North America"),
        ("CUST-1020", "Echo Retailers", "SMB", 29000, "2025-01-15", "2027-01-15", "ACTIVE", "Apparel", "Europe"),
        ("CUST-1021", "Frontier Genomics", "Enterprise", 260000, "2023-12-01", "2026-12-01", "ACTIVE", "Life Sciences", "North America"),
        ("CUST-1022", "Summit Peak Insurance", "Enterprise", 145000, "2024-06-01", "2027-06-01", "ACTIVE", "Insurtech", "North America"),
        ("CUST-1023", "Polaris Fleet Management", "Mid-Market", 92000, "2024-10-15", "2026-10-25", "ACTIVE", "Fleet Ops", "North America"),
        ("CUST-1024", "Velocity Digital", "SMB", 31000, "2025-05-01", "2026-11-10", "ACTIVE", "Adtech", "Europe"),
        ("CUST-1025", "Atlas Heavy Machinery", "Enterprise", 170000, "2024-02-01", "2027-02-01", "ACTIVE", "Industrial", "North America"),
        # DELIBERATE STALE RECORD
        ("CUST-1033", "AeroSys Dynamics", "Mid-Market", 62000, "2023-04-01", "2026-10-01", "ACTIVE", "Aviation", "North America"),
        # DELIBERATE CONFLICT RECORD 1 (Solaria Networks has conflicting status & ACV across records)
        ("CUST-1042", "Solaria Networks", "Enterprise", 125000, "2024-01-10", "2026-11-01", "ACTIVE", "Telecommunications", "North America"),
        ("CUST-1042", "Solaria Networks", "Enterprise", 75000, "2024-01-10", "2026-06-01", "SUSPENDED", "Telecommunications", "North America"),
        # DELIBERATE MISSING DATA RECORD (No orders, no CRM history)
        ("CUST-1099", "Veritas Cloud Labs", "SMB", 24000, "2025-08-01", "2026-12-31", "ACTIVE", "Research", "Europe"),
    ]
    
    with open(customers_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["customer_id", "company_name", "tier", "annual_contract_value", "contract_start_date", "renewal_date", "status", "industry", "region"])
        for row in customers_data:
            writer.writerow(row)
            
    # -------------------------------------------------------------
    # 2. ORDERS.CSV
    # -------------------------------------------------------------
    orders_path = DATA_DIR / "orders.csv"
    orders_data = []
    order_id_counter = 5000
    
    # Function to add order
    def add_order(cust_id, days_ago, amount, status="COMPLETED", items=3):
        nonlocal order_id_counter
        order_id_counter += 1
        odate = (ref_date - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        orders_data.append((f"ORD-{order_id_counter}", cust_id, odate, amount, status, items))

    # CUST-1001 (Acme Industries): Steep decline!
    # Prior period (90-270 days ago): 14 orders averaging $15,000 each (~2.3/mo)
    for d in [260, 245, 230, 215, 200, 185, 170, 155, 140, 125, 110, 95]:
        add_order("CUST-1001", d, 15000, "COMPLETED", 4)
    # Recent period (0-90 days ago): ONLY 1 order 72 days ago!
    add_order("CUST-1001", 72, 8500, "COMPLETED", 2)
    
    # CUST-1002 (Apex Retail Group): 85% volume drop!
    for d in range(100, 300, 20):
        add_order("CUST-1002", d, 12500, "COMPLETED", 5)
    # Recent period: only 1 small order 64 days ago
    add_order("CUST-1002", 64, 4200, "COMPLETED", 1)

    # CUST-1003 (Vanguard Financial): Decline + returns
    for d in [250, 220, 190, 160, 130, 100]:
        add_order("CUST-1003", d, 9200, "COMPLETED", 3)
    add_order("CUST-1003", 55, 3100, "COMPLETED", 1)
    add_order("CUST-1003", 30, 2900, "CANCELLED", 1)

    # CUST-1004 (OmniTech Solutions): Prior frequent, none in last 80 days
    for d in [280, 250, 220, 190, 160, 130, 100]:
        add_order("CUST-1004", d, 14000, "COMPLETED", 4)
    add_order("CUST-1004", 82, 11000, "COMPLETED", 3)

    # CUST-1005 (Helios Health Systems): High value, slight pause
    for d in [270, 210, 150, 90, 45, 12]:
        add_order("CUST-1005", d, 22000, "COMPLETED", 6)

    # CUST-1010 (BlueWave Logistics): Healthy increasing cadence
    for d in [280, 240, 200, 160, 120, 80, 50, 25, 8]:
        add_order("CUST-1010", d, 18500, "COMPLETED", 5)

    # CUST-1011 (Titan Energy Corp): Very healthy, regular
    for d in [270, 225, 180, 135, 90, 45, 15]:
        add_order("CUST-1011", d, 24000, "COMPLETED", 6)

    # Other customers baseline orders
    for cid in ["CUST-1006", "CUST-1007", "CUST-1008", "CUST-1009", "CUST-1012", "CUST-1013", "CUST-1014", "CUST-1015", "CUST-1016", "CUST-1017", "CUST-1018", "CUST-1019", "CUST-1020", "CUST-1021", "CUST-1022", "CUST-1023", "CUST-1024", "CUST-1025"]:
        for d in [180, 120, 60, 20]:
            add_order(cid, d, 9500, "COMPLETED", 3)

    # CUST-1033 (AeroSys Dynamics): Deliberate STALE record (last order 250 days ago)
    add_order("CUST-1033", 290, 15000, "COMPLETED", 3)
    add_order("CUST-1033", 250, 14000, "COMPLETED", 3)

    # CUST-1042 (Solaria Networks): A couple of old orders
    add_order("CUST-1042", 210, 18000, "COMPLETED", 4)
    add_order("CUST-1042", 150, 17500, "COMPLETED", 4)

    # Note: CUST-1099 has ZERO orders! (Deliberate missing evidence case)

    with open(orders_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["order_id", "customer_id", "order_date", "amount", "status", "items_count"])
        for row in orders_data:
            writer.writerow(row)

    # -------------------------------------------------------------
    # 3. SUPPORT_TICKETS.CSV
    # -------------------------------------------------------------
    tickets_path = DATA_DIR / "support_tickets.csv"
    tickets_data = [
        # ticket_id, customer_id, created_at, status, priority, category, resolution_time_hours, customer_sentiment
        # Acme (CUST-1001) has 3 unresolved high/urgent tickets
        ("TCK-901", "CUST-1001", "2026-09-12", "ESCALATED", "URGENT", "API Outage", None, "CRITICAL"),
        ("TCK-902", "CUST-1001", "2026-09-18", "OPEN", "HIGH", "Data Sync Failure", None, "NEGATIVE"),
        ("TCK-903", "CUST-1001", "2026-09-24", "IN_PROGRESS", "URGENT", "Billing Dispute", None, "CRITICAL"),
        ("TCK-850", "CUST-1001", "2026-06-10", "RESOLVED", "MEDIUM", "Feature Request", 48.5, "NEUTRAL"),
        
        # Apex Retail (CUST-1002) has 2 open urgent tickets
        ("TCK-910", "CUST-1002", "2026-09-15", "OPEN", "URGENT", "Checkout Latency Spike", None, "CRITICAL"),
        ("TCK-911", "CUST-1002", "2026-09-22", "ESCALATED", "HIGH", "Inventory Sync Discrepancy", None, "NEGATIVE"),
        ("TCK-880", "CUST-1002", "2026-07-04", "RESOLVED", "HIGH", "Webhook Drop", 24.0, "NEUTRAL"),

        # Vanguard Financial (CUST-1003)
        ("TCK-920", "CUST-1003", "2026-09-08", "OPEN", "HIGH", "Compliance Export Broken", None, "NEGATIVE"),
        ("TCK-921", "CUST-1003", "2026-09-20", "OPEN", "URGENT", "SLA Breach on Transaction Webhooks", None, "CRITICAL"),

        # OmniTech (CUST-1004)
        ("TCK-930", "CUST-1004", "2026-09-10", "OPEN", "MEDIUM", "SSO Login Errors", None, "NEGATIVE"),
        ("TCK-931", "CUST-1004", "2026-09-26", "OPEN", "HIGH", "Export Failure", None, "NEGATIVE"),

        # Helios Health (CUST-1005)
        ("TCK-890", "CUST-1005", "2026-08-14", "RESOLVED", "URGENT", "HIPAA Access Log Request", 6.0, "POSITIVE"),
        ("TCK-935", "CUST-1005", "2026-09-25", "OPEN", "LOW", "UI Polish", None, "NEUTRAL"),

        # BlueWave (CUST-1010): Healthy
        ("TCK-860", "CUST-1010", "2026-07-12", "RESOLVED", "LOW", "Documentation Query", 2.0, "POSITIVE"),
        ("TCK-895", "CUST-1010", "2026-08-30", "RESOLVED", "MEDIUM", "API Rate Limit Increase", 4.0, "POSITIVE"),

        # Titan Energy (CUST-1011): Healthy
        ("TCK-875", "CUST-1011", "2026-08-05", "RESOLVED", "MEDIUM", "SSO Token Rotation", 3.5, "POSITIVE"),

        # Normal resolution baseline for others
        ("TCK-801", "CUST-1006", "2026-08-10", "RESOLVED", "LOW", "Dashboard Query", 12.0, "NEUTRAL"),
        ("TCK-802", "CUST-1007", "2026-09-01", "RESOLVED", "MEDIUM", "Webhook Config", 18.0, "POSITIVE"),
        ("TCK-803", "CUST-1008", "2026-09-14", "RESOLVED", "HIGH", "Firewall IP Whitelist", 5.0, "POSITIVE"),
        ("TCK-804", "CUST-1009", "2026-08-22", "RESOLVED", "LOW", "Report Schedule", 8.0, "NEUTRAL"),
        ("TCK-805", "CUST-1016", "2026-09-05", "RESOLVED", "MEDIUM", "API Integration", 14.0, "POSITIVE"),
        ("TCK-806", "CUST-1017", "2026-09-18", "RESOLVED", "LOW", "License Key Renewal", 4.0, "POSITIVE"),
        ("TCK-807", "CUST-1021", "2026-09-11", "RESOLVED", "MEDIUM", "Genomic Pipeline Webhook", 7.0, "POSITIVE"),

        # CUST-1042 Solaria Networks has open dispute
        ("TCK-940", "CUST-1042", "2026-08-15", "OPEN", "HIGH", "Early Contract Termination Dispute", None, "CRITICAL"),
    ]

    with open(tickets_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ticket_id", "customer_id", "created_at", "status", "priority", "category", "resolution_time_hours", "customer_sentiment"])
        for row in tickets_data:
            writer.writerow(row)

    # -------------------------------------------------------------
    # 4. CRM_ACTIVITY.CSV
    # -------------------------------------------------------------
    crm_path = DATA_DIR / "crm_activity.csv"
    crm_data = [
        # activity_id, customer_id, activity_type, activity_date, logged_by, notes, outcome
        ("ACT-7001", "CUST-1001", "Executive Touchpoint", "2026-07-15", "VP Customer Success", "Q2 check-in. Client CTO expressed dissatisfaction with reliability.", "Follow-up Needed"),
        ("ACT-7002", "CUST-1001", "Support Escalation", "2026-09-14", "Support Lead", "Outage incident review. Client threatened SLA penalty clause.", "Escalated"),
        
        ("ACT-7010", "CUST-1002", "Account Review", "2026-07-28", "Enterprise AE", "Discussed renewal pipeline. Client VP mentioned evaluating competitor.", "Risk Identified"),
        ("ACT-7011", "CUST-1002", "Check-in Call", "2026-08-10", "CS Manager", "Meeting cancelled by client last minute. No reschedule date.", "Cancelled"),

        ("ACT-7020", "CUST-1003", "Technical Review", "2026-08-25", "Solutions Architect", "Compliance requirements discussion. Client waiting on export fix.", "Pending Fix"),

        ("ACT-7030", "CUST-1004", "QBR", "2026-07-02", "Enterprise AE", "Executive sponsor departed company. New leadership reviewing vendor spend.", "Unfavorable"),

        ("ACT-7040", "CUST-1010", "Executive QBR", "2026-09-20", "VP Customer Success", "Excellent expansion review. Client requested proposal for 2 new regions.", "Expansion Proposed"),
        ("ACT-7041", "CUST-1011", "Annual Review", "2026-09-18", "Enterprise AE", "Signed multi-year extension intent. Very happy with uptime.", "Committed"),

        ("ACT-7050", "CUST-1005", "Check-in Call", "2026-09-15", "CS Manager", "Routine medical device data ingest review. All running smoothly.", "Completed"),
        ("ACT-7051", "CUST-1008", "Security Review", "2026-09-22", "Security Specialist", "SOC2 compliance audit documentation delivered.", "Completed"),

        # DELIBERATE CRM CONFLICT FOR CUST-1042:
        # In customers.csv CUST-1042 is ACTIVE with $125k ACV, but CRM record states:
        ("ACT-7099", "CUST-1042", "Contract Cancellation Notice", "2026-08-20", "VP Sales", "Client CFO sent formal contract termination notice citing breach. Account marked churned in CRM.", "Terminated"),
    ]

    with open(crm_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["activity_id", "customer_id", "activity_type", "activity_date", "logged_by", "notes", "outcome"])
        for row in crm_data:
            writer.writerow(row)

    # -------------------------------------------------------------
    # 5. CAMPAIGNS.CSV
    # -------------------------------------------------------------
    campaigns_path = DATA_DIR / "campaigns.csv"
    campaigns_data = [
        # campaign_id, customer_id, campaign_name, sent_date, opened, clicked, unsubscribed
        ("CMP-401", "CUST-1001", "Q3 Feature Highlights", "2026-08-01", 0, 0, 0),
        ("CMP-402", "CUST-1001", "Executive Product Webinar", "2026-09-01", 0, 0, 1), # Unsubscribed!
        ("CMP-401", "CUST-1002", "Q3 Feature Highlights", "2026-08-01", 1, 0, 0),
        ("CMP-402", "CUST-1002", "Executive Product Webinar", "2026-09-01", 0, 0, 0),
        ("CMP-401", "CUST-1003", "Q3 Feature Highlights", "2026-08-01", 1, 0, 0),
        ("CMP-402", "CUST-1003", "Executive Product Webinar", "2026-09-01", 0, 0, 0),
        ("CMP-401", "CUST-1004", "Q3 Feature Highlights", "2026-08-01", 0, 0, 0),
        ("CMP-402", "CUST-1004", "Executive Product Webinar", "2026-09-01", 0, 0, 1), # Unsubscribed!
        ("CMP-401", "CUST-1010", "Q3 Feature Highlights", "2026-08-01", 1, 1, 0),
        ("CMP-402", "CUST-1010", "Executive Product Webinar", "2026-09-01", 1, 1, 0),
        ("CMP-401", "CUST-1011", "Q3 Feature Highlights", "2026-08-01", 1, 1, 0),
        ("CMP-402", "CUST-1011", "Executive Product Webinar", "2026-09-01", 1, 1, 0),
    ]

    with open(campaigns_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["campaign_id", "customer_id", "campaign_name", "sent_date", "opened", "clicked", "unsubscribed"])
        for row in campaigns_data:
            writer.writerow(row)

    # -------------------------------------------------------------
    # 6. PRODUCTS.CSV
    # -------------------------------------------------------------
    products_path = DATA_DIR / "products.csv"
    products_data = [
        # product_id, product_name, category, unit_price, status
        ("PROD-01", "Enterprise Decision Engine Core", "Core Platform", 65000, "ACTIVE"),
        ("PROD-02", "Automated Evidence Verifier", "Add-on", 24000, "ACTIVE"),
        ("PROD-03", "High-Throughput Streaming Connector", "Integration", 18000, "ACTIVE"),
        ("PROD-04", "Executive Audit Ledger Suite", "Governance", 32000, "ACTIVE"),
        ("PROD-05", "Dedicated Customer Success Architect", "Professional Services", 45000, "ACTIVE"),
        ("PROD-06", "Legacy On-Prem Bridge", "Legacy", 15000, "DEPRECATED"),
    ]

    with open(products_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["product_id", "product_name", "category", "unit_price", "status"])
        for row in products_data:
            writer.writerow(row)

    print(f"Generated 6 seed business datasets at {DATA_DIR}")

if __name__ == "__main__":
    generate_seed_datasets()
