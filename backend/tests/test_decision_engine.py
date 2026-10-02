import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db
from app.seed_data import generate_seed_datasets
from app.engine.analytics import calculate_customer_metrics
from app.engine.scoring import calculate_priority_score
from app.engine.verification import verify_customer_decision
from app.engine.evidence import get_customer_evidence_items
from app.engine.simulation import run_what_if_simulation
from app.agent import tools

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    generate_seed_datasets()
    init_db(force_reload=True)

client = TestClient(app)

# 1. Test Customer Metric Calculations
def test_customer_metric_calculations():
    metrics = calculate_customer_metrics("CUST-1001")
    assert metrics["exists"] is True
    assert metrics["has_sufficient_data"] is True
    assert metrics["company_name"] == "Acme Industries"
    assert metrics["acv"] == 210000.0
    assert metrics["recent_orders_count"] == 1
    assert metrics["prior_orders_count"] == 12
    assert metrics["freq_decline_pct"] > 80.0
    assert metrics["unresolved_tickets_count"] >= 3
    assert metrics["urgent_unresolved_tickets_count"] >= 2

# 2. Test Priority Scoring Determinism and Components
def test_priority_scoring_components():
    metrics = calculate_customer_metrics("CUST-1001")
    score_data = calculate_priority_score(metrics)
    assert score_data["reproducible"] is True
    assert score_data["priority_score"] >= 65.0
    assert score_data["priority_level"] == "HIGH"
    
    # Verify component contributions sum up to final score
    comp_sum = round(sum(c["contribution"] for c in score_data["components"]), 1)
    assert abs(comp_sum - score_data["priority_score"]) <= 0.2
    
    # Check that each expected component exists
    comp_names = [c["component"] for c in score_data["components"]]
    assert "Customer Value (ACV)" in comp_names
    assert "Purchase Frequency Decline" in comp_names
    assert "Inactivity Duration" in comp_names
    assert "Unresolved Support Escalations" in comp_names
    assert "Executive Engagement Trend" in comp_names

# 3. Test Evidence Retrieval and Lineage Grounding
def test_evidence_retrieval():
    evidence = get_customer_evidence_items("CUST-1001")
    assert len(evidence) >= 4
    tables = [item["table"] for item in evidence]
    assert "customers" in tables
    assert "orders" in tables
    assert "support_tickets" in tables
    assert "crm_activity" in tables
    for item in evidence:
        assert item["verified"] is True
        assert item["record_id"] is not None
        assert item["value"] is not None

# 4. Test Conflict Detection (Solaria Networks CUST-1042)
def test_conflict_detection():
    v = verify_customer_decision("CUST-1042")
    assert v["conflicts_detected"] is True
    assert v["status"] in ("DECISION WITHHELD", "REVIEW REQUIRED")
    assert any("Conflicting" in issue or "conflict" in issue.lower() for issue in v["issues"])

# 5. Test Verification on Healthy Entity
def test_verification_healthy():
    v = verify_customer_decision("CUST-1001")
    assert v["conflicts_detected"] is False
    assert v["missing_data_detected"] is False
    assert v["status"] == "VERIFIED"
    assert v["traceability_score"] >= 80.0

# 6. Test What-If Simulation Calculations
def test_what_if_calculations():
    sim = run_what_if_simulation(top_n=5, intervention_cost_per_account=1000.0, recovery_rate=0.50)
    scenarios = sim["scenarios"]
    assert "scenario_a" in scenarios
    assert "scenario_b" in scenarios
    assert "scenario_c" in scenarios
    
    # Scenario B checks
    sb = scenarios["scenario_b"]
    assert sb["accounts_targeted"] == 5
    assert sb["intervention_cost"] == 5000.0
    assert sb["gross_recovered_value"] == sb["total_at_risk_acv"] * 0.50
    assert sb["net_impact"] == sb["gross_recovered_value"] - sb["intervention_cost"]
    assert sb["roi_multiple"] > 1.0

# 7. Test Unsupported Claims Handling
def test_unsupported_claim_detection():
    # If a proposed claim fabricates ACV
    fraudulent_claim = {"claimed_acv": 9999999.0}
    v = verify_customer_decision("CUST-1001", proposed_claim=fraudulent_claim)
    assert v["status"] == "REVIEW REQUIRED"
    assert any("claimed_acv" in issue.lower() or "does not match" in issue.lower() for issue in v["issues"])

# 8. Test Missing Data Handling (Veritas Cloud CUST-1099)
def test_missing_data_handling():
    metrics = calculate_customer_metrics("CUST-1099")
    assert metrics["has_sufficient_data"] is False
    v = verify_customer_decision("CUST-1099")
    assert v["missing_data_detected"] is True
    assert v["status"] == "DECISION WITHHELD"

# 9. Test Decision Ledger Creation & Persistence
def test_decision_ledger_creation():
    rec = tools.create_decision_record(
        question="Which customer has highest churn risk?",
        target_entity_id="CUST-1001",
        target_entity_name="Acme Industries",
        recommendation="Prioritize Acme Industries",
        priority_score=82.5,
        priority_level="HIGH",
        verification_status="VERIFIED",
        evidence_items=[{"table": "customers", "field": "acv", "value": "$210,000"}],
        calculations={"score": 82.5},
        reasoning_summary="Tested persistence"
    )
    assert rec["decision_id"].startswith("D-")
    
    # Fetch from API
    response = client.get(f"/api/decisions/{rec['decision_id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["target_entity_name"] == "Acme Industries"
    assert data["priority_score"] == 82.5
    assert data["approval_status"] == "AWAITING HUMAN APPROVAL"

# 10. Test API Health & Endpoints
def test_api_health_and_core_endpoints():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    
    dash = client.get("/api/dashboard")
    assert dash.status_code == 200
    assert "summary" in dash.json()
    
    dq = client.get("/api/data-quality")
    assert dq.status_code == 200
    assert dq.json()["total_datasets"] == 6
    
    eval_res = client.get("/api/evaluation")
    assert eval_res.status_code == 200
    assert eval_res.json()["decision_accuracy"] > 80.0
