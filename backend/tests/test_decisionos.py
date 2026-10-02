import pytest
from app.engine.analytics import calculate_customer_metrics, get_all_customer_ids
from app.engine.scoring import calculate_priority_score
from app.engine.evidence import get_customer_evidence
from app.engine.verification import verify_decision
from app.engine.simulator import run_simulation
from app.engine.data_quality import analyze_data_quality
from app.agent.decision_agent import generate_decision, check_unsupported_question, get_decision_by_id, update_decision_approval
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_01_api_health():
    """Test 1: Verify API health returns system version and connected database."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["database_connected"] is True
    assert data["total_customers"] > 20

def test_02_customer_metric_calculations():
    """Test 2: Verify deterministic metric calculations for high-risk account."""
    metrics = calculate_customer_metrics("CUST-1001")
    assert metrics["exists"] is True
    assert metrics["has_sufficient_data"] is True
    assert metrics["acv"] == 210000.0
    # Must show order frequency decline
    assert metrics["freq_decline_pct"] > 50.0
    # Must show unresolved urgent tickets
    assert metrics["urgent_unresolved_tickets_count"] >= 2
    # Order recency & Inactivity duration
    assert metrics["days_since_last_order"] >= 60
    assert metrics["inactivity_days"] >= 14

def test_03_priority_scoring_reproducibility():
    """Test 3: Verify priority score components sum up exactly to final score."""
    metrics = calculate_customer_metrics("CUST-1001")
    score_data = calculate_priority_score(metrics)
    assert score_data["reproducible"] is True
    assert score_data["priority_level"] == "HIGH"
    assert score_data["priority_score"] >= 65.0
    
    # Check 5 components sum to total score
    components = score_data["components"]
    assert len(components) == 5
    calculated_sum = round(sum(c["contribution"] for c in components), 1)
    assert abs(calculated_sum - score_data["priority_score"]) < 0.001

def test_04_evidence_retrieval_and_traceability():
    """Test 4: Verify evidence items map directly to source tables and rows."""
    metrics = calculate_customer_metrics("CUST-1001")
    evidence = get_customer_evidence("CUST-1001", metrics)
    assert len(evidence) >= 4
    
    sources = set(e["source_dataset"] for e in evidence)
    assert "customers.csv" in sources
    assert "orders.csv" in sources
    assert "support_tickets.csv" in sources
    
    # Assert every item has primary key or row reference
    for item in evidence:
        assert item["record_id"] != ""
        assert item["verified"] is True

def test_05_conflict_detection_case():
    """Test 5: Deliberate failure test - Solaria Networks (CUST-1042) must trigger conflict flags."""
    metrics = calculate_customer_metrics("CUST-1042")
    score_data = calculate_priority_score(metrics)
    evidence = get_customer_evidence("CUST-1042", metrics)
    verif = verify_decision("CUST-1042", metrics, score_data, evidence)
    
    assert len(verif["conflicts"]) > 0
    assert verif["status"] in ("REVIEW REQUIRED", "DECISION WITHHELD")
    # Gate 1 should fail
    gate_1 = next(c for c in verif["checks"] if c["check_id"] == "CHK-01")
    assert gate_1["passed"] is False

def test_06_missing_data_withholding_case():
    """Test 6: Deliberate failure test - Veritas Cloud (CUST-1099) must be withheld."""
    metrics = calculate_customer_metrics("CUST-1099")
    assert metrics["has_sufficient_data"] is False
    score_data = calculate_priority_score(metrics)
    evidence = get_customer_evidence("CUST-1099", metrics)
    verif = verify_decision("CUST-1099", metrics, score_data, evidence)
    
    assert verif["status"] == "DECISION WITHHELD"
    assert "Insufficient evidence" in verif["confidence_reason"]

def test_07_unsupported_domain_query():
    """Test 7: Unsupported questions must be rejected with explicit message."""
    query = "What is the expected stock price of Acme Industries?"
    unsupported = check_unsupported_question(query)
    assert unsupported is not None
    
    decision = generate_decision(query)
    assert decision["verification_status"] == "DECISION WITHHELD"
    assert "not available in the connected datasets" in decision["recommendation"]

def test_08_what_if_scenario_simulation():
    """Test 8: What-If simulation calculates deterministic recoverable value and net impact."""
    sim = run_simulation(target_count=5, cost_per_account=1500.0, recovery_rate=0.50)
    scenarios = sim["scenarios"]
    assert len(scenarios) >= 3
    
    selected = scenarios[1]
    assert selected["accounts_targeted"] == 5
    assert selected["intervention_cost"] == 5 * 1500.0
    expected_recoverable = round(selected["total_at_risk_acv"] * 0.50, 2)
    assert selected["estimated_recoverable_value"] == expected_recoverable
    assert selected["net_financial_impact"] == round(expected_recoverable - (5 * 1500.0), 2)
    assert len(selected["assumptions"]) > 0

def test_09_decision_ledger_creation_and_human_approval():
    """Test 9: Decision Ledger creates persistent entry and transitions approval states."""
    decision = generate_decision(
        question="Which customer has the highest operational risk?",
        target_customer_id="CUST-1001"
    )
    dec_id = decision["decision_id"]
    assert dec_id.startswith("D-")
    assert decision["approval_status"] == "AWAITING_APPROVAL"
    
    # Retrieve from ledger
    fetched = get_decision_by_id(dec_id)
    assert fetched is not None
    assert fetched["target_entity_id"] == "CUST-1001"
    
    # Approve decision
    updated = update_decision_approval(dec_id, "APPROVED", "Approved by Lead Risk Officer for executive outreach.")
    assert updated["approval_status"] == "APPROVED"
    assert updated["action_executed_at"] is not None
    assert any("HUMAN_APPROVED" in a["event"] for a in updated["audit_trail"])

def test_10_data_quality_profiling():
    """Test 10: Data quality analyzer computes live metrics across all tables."""
    dq = analyze_data_quality()
    assert dq["total_datasets"] == 6
    assert dq["total_records"] > 50
    # Must detect the seeded conflicts in customers & CRM
    assert dq["total_conflicts"] > 0
    # Check customers table
    cust_report = next(d for d in dq["datasets"] if d["table_name"] == "customers")
    assert cust_report["conflicts_detected"] > 0
    assert len(cust_report["conflict_examples"]) > 0


def test_raw_evidence_aggregate_filter_returns_real_matching_orders():
    response = client.get(
        "/api/evidence/raw/records",
        params={"dataset": "orders.csv", "record_id": "aggregate(customer_id=CUST-1004)"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 8
    assert payload["count"] == len(payload["records"])
    assert {row["order_id"] for row in payload["records"]} == {
        f"ORD-{order_id}" for order_id in range(5033, 5041)
    }
    assert all(row["customer_id"] == "CUST-1004" for row in payload["records"])

    simple_filter = client.get(
        "/api/evidence/raw/records",
        params={"dataset": "orders.csv", "record_id": "customer_id=CUST-1004"},
    )
    assert simple_filter.status_code == 200
    assert simple_filter.json()["records"] == payload["records"]


@pytest.mark.parametrize(
    ("dataset", "field"),
    [
        ("customers.csv", "customer_id"),
        ("orders.csv", "customer_id"),
        ("support_tickets.csv", "customer_id"),
        ("crm_activity.csv", "customer_id"),
        ("campaigns.csv", "customer_id"),
        ("products.csv", "product_id"),
    ],
)
def test_raw_evidence_filters_use_each_dataset_schema(dataset, field):
    source = client.get("/api/evidence/raw/records", params={"dataset": dataset})
    assert source.status_code == 200
    source_rows = source.json()["records"]
    assert source_rows

    value = str(source_rows[0][field]).strip()
    filtered = client.get(
        "/api/evidence/raw/records",
        params={"dataset": dataset, "record_id": f"{field}={value}"},
    )
    assert filtered.status_code == 200
    assert filtered.json()["count"] == len(filtered.json()["records"])
    assert filtered.json()["records"]
    assert all(str(row[field]).strip().casefold() == value.casefold() for row in filtered.json()["records"])


def test_raw_evidence_filter_rejects_invalid_syntax_and_unknown_columns():
    invalid_syntax = client.get(
        "/api/evidence/raw/records",
        params={"dataset": "orders.csv", "record_id": "aggregate(customer_id=CUST-1004"},
    )
    assert invalid_syntax.status_code == 422
    assert "Invalid evidence filter" in invalid_syntax.json()["detail"]

    unknown_column = client.get(
        "/api/evidence/raw/records",
        params={"dataset": "orders.csv", "record_id": "not_a_column=CUST-1004"},
    )
    assert unknown_column.status_code == 422
