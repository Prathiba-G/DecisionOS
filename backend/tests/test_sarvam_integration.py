import json
import sqlite3
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.routers import decisions
from app.services import sarvam


@pytest.fixture
def ledger_client(tmp_path, monkeypatch):
    database_path = tmp_path / "decisionos-test.db"

    def connect():
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        return connection

    with connect() as connection:
        connection.execute(
            """CREATE TABLE decision_ledger (
                decision_id TEXT PRIMARY KEY,
                target_entity_id TEXT NOT NULL,
                target_entity_name TEXT NOT NULL,
                approval_status TEXT NOT NULL,
                verification_status TEXT NOT NULL,
                reasoning_summary TEXT NOT NULL,
                audit_trail_json TEXT NOT NULL
            )"""
        )
        connection.execute(
            """CREATE TABLE customers (
                customer_id TEXT NOT NULL,
                company_name TEXT NOT NULL,
                contact_name TEXT,
                business_name TEXT,
                phone_number TEXT
            )"""
        )
        connection.execute(
            "INSERT INTO customers VALUES (?, ?, ?, ?, ?)",
            ("CUST-1001", "Acme Industries", None, None, None),
        )

    monkeypatch.setattr(decisions, "get_db_connection", connect)
    client = TestClient(app)
    return client, connect


def add_decision(connect, approval_status="APPROVED", verification_status="VERIFIED"):
    decision_id = f"D-{uuid.uuid4().hex}"
    with connect() as connection:
        connection.execute(
            "INSERT INTO decision_ledger VALUES (?, ?, ?, ?, ?, ?, ?)",
            (decision_id, "CUST-1001", "Acme Industries", approval_status, verification_status, "Purchase activity declined while support issues remain unresolved.", "[]"),
        )
    return decision_id


def configure_test_environment(monkeypatch):
    generated = {
        "SARVAM_APP_ID": uuid.uuid4().hex,
        "SARVAM_API_KEY": uuid.uuid4().hex,
        "SARVAM_ORG_ID": uuid.uuid4().hex,
        "SARVAM_WORKSPACE_ID": uuid.uuid4().hex,
        "SARVAM_APP_VERSION": "1",
        "SARVAM_CONNECTION_ID": uuid.uuid4().hex,
        "SARVAM_AGENT_PHONE_NUMBER": "test-caller-endpoint",
        "SARVAM_WEBHOOK_URL": "https://test.invalid/api/webhooks/sarvam/instant-outbound",
        "SARVAM_REQUIRED_AGENT_VARIABLES": "customer_company,risk_reason",
    }
    for name, value in generated.items():
        monkeypatch.setenv(name, value)
    return generated


class FakeResponse:
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self.is_success = 200 <= status_code < 300
        self._payload = payload

    def json(self):
        return self._payload


class FakeHttpClient:
    def __init__(self, response: FakeResponse, captured: dict):
        self.response = response
        self.captured = captured

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def post(self, url, json, headers):
        self.captured.update({"url": url, "json": json, "headers": headers})
        return self.response


def test_sarvam_app_id_is_read_from_environment(monkeypatch):
    app_id = uuid.uuid4().hex
    monkeypatch.setenv("SARVAM_APP_ID", app_id)
    assert config.settings.SARVAM_APP_ID == app_id


def test_call_requires_human_approval(ledger_client, monkeypatch):
    client, _connect = ledger_client
    decision_id = add_decision(_connect, approval_status="AWAITING_APPROVAL")
    provider_called = False

    def fail_if_called(*_args, **_kwargs):
        nonlocal provider_called
        provider_called = True
        raise AssertionError("Sarvam must not be called before human approval")

    monkeypatch.setattr(decisions, "initiate_outbound_call", fail_if_called)
    response = client.post(f"/api/decisions/{decision_id}/call")
    assert response.status_code == 409
    assert "Human approval is required" in response.json()["detail"]
    assert provider_called is False


def test_call_readiness_reports_missing_real_configuration_and_phone(ledger_client, monkeypatch):
    client, _connect = ledger_client
    decision_id = add_decision(_connect)
    for name in (
        "SARVAM_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "SARVAM_APP_VERSION",
        "SARVAM_CONNECTION_ID", "SARVAM_AGENT_PHONE_NUMBER", "SARVAM_WEBHOOK_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    response = client.get(f"/api/decisions/{decision_id}/call-readiness")
    assert response.status_code == 200
    readiness = response.json()
    assert readiness["eligible"] is False
    assert readiness["configuration_required"] is True
    assert "SARVAM_API_KEY" in readiness["missing_configuration"]
    assert readiness["missing_customer_data"] == ["customer phone number (E.164)"]


def test_approved_call_uses_app_id_and_maps_customer_variables(ledger_client, monkeypatch):
    client, connect = ledger_client
    decision_id = add_decision(connect)
    environment = configure_test_environment(monkeypatch)
    monkeypatch.setattr(decisions, "get_customer_phone", lambda _customer: "test-phone-is-never-dialed")
    captured = {}
    attempt_id = uuid.uuid4().hex
    fake_client = FakeHttpClient(FakeResponse(200, {"attempt_id": attempt_id}), captured)
    monkeypatch.setattr(sarvam.httpx, "Client", lambda **_kwargs: fake_client)

    response = client.post(f"/api/decisions/{decision_id}/call")
    assert response.status_code == 200
    assert response.json()["call_status"] == "queued"
    assert response.json()["attempt_id"] == attempt_id
    assert captured["json"]["app_config"]["app_id"] == environment["SARVAM_APP_ID"]
    assert captured["json"]["app_config"]["agent_variables"] == {
        "customer_id": "CUST-1001",
        "customer_company": "Acme Industries",
        "business_name": "Acme Industries",
        "risk_reason": "Purchase activity declined while support issues remain unresolved.",
    }
    assert captured["headers"]["X-API-Key"] == environment["SARVAM_API_KEY"]

    with connect() as connection:
        audit = json.loads(connection.execute(
            "SELECT audit_trail_json FROM decision_ledger WHERE decision_id = ?", (decision_id,)
        ).fetchone()[0])
    call_event = next(event for event in audit if event.get("action") == "customer_call")
    assert call_event["attempt_id"] == attempt_id
        assert "sarvam_app_id" not in call_event


def test_missing_app_id_returns_configuration_required(ledger_client, monkeypatch):
    client, connect = ledger_client
    decision_id = add_decision(connect)
    configure_test_environment(monkeypatch)
    monkeypatch.delenv("SARVAM_APP_ID")

    response = client.post(f"/api/decisions/{decision_id}/call")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SARVAM_CONFIGURATION_REQUIRED"
    assert "SARVAM_APP_ID" in response.json()["detail"]["missing_configuration"]


def test_missing_required_agent_variable_blocks_call(ledger_client, monkeypatch):
    client, connect = ledger_client
    decision_id = add_decision(connect)
    configure_test_environment(monkeypatch)
    monkeypatch.setenv("SARVAM_REQUIRED_AGENT_VARIABLES", "customer_name")
    monkeypatch.setattr(decisions, "get_customer_phone", lambda _customer: "test-phone-is-never-dialed")

    response = client.post(f"/api/decisions/{decision_id}/call")
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "SARVAM_AGENT_VARIABLES_REQUIRED"
    assert response.json()["detail"]["missing_agent_variables"] == ["customer_name"]


def test_sarvam_authentication_failure_is_controlled(monkeypatch):
    configure_test_environment(monkeypatch)
    monkeypatch.setattr(sarvam.httpx, "Client", lambda **_kwargs: FakeHttpClient(FakeResponse(401, {}), {}))

    with pytest.raises(sarvam.SarvamRequestError, match="authentication failed"):
        sarvam.initiate_outbound_call(
            "test-phone-is-never-dialed",
            {"customer_company": "Acme Industries"},
            {"decisionos_call_ref": uuid.uuid4().hex, "decision_id": "test-decision", "customer_id": "CUST-1001", "signature": "test-signature"},
        )


def test_webhook_maps_provider_outcome_to_call_attempt(ledger_client, monkeypatch):
    client, connect = ledger_client
    decision_id = add_decision(connect)
    environment = configure_test_environment(monkeypatch)
    monkeypatch.setattr(decisions, "get_customer_phone", lambda _customer: "test-phone-is-never-dialed")
    attempt_id = uuid.uuid4().hex
    captured = {}
    fake_client = FakeHttpClient(FakeResponse(200, {"attempt_id": attempt_id}), captured)
    monkeypatch.setattr(sarvam.httpx, "Client", lambda **_kwargs: fake_client)

    initiated = client.post(f"/api/decisions/{decision_id}/call")
    assert initiated.status_code == 200
    with connect() as connection:
        audit = json.loads(connection.execute(
            "SELECT audit_trail_json FROM decision_ledger WHERE decision_id = ?", (decision_id,)
        ).fetchone()[0])
    metadata = captured["json"]["webhook_config"]["metadata"]
    webhook = {
        "attempt_id": attempt_id,
        "status": "connected",
        "channel_info": {"channel_type": "v2v", "channel_provider": "test-provider", "agent_phone_number": "test-caller-endpoint"},
        "duration": 12.5,
        "interaction_id": uuid.uuid4().hex,
        "failure_reason": None,
        "final_agent_variables": {"disposition": "resolved"},
        "webhook_config": {"url": environment["SARVAM_WEBHOOK_URL"], "metadata": metadata},
        "interaction_transcript": [{"role": "agent", "en_text": "Test transcript"}],
    }

    callback = client.post("/api/webhooks/sarvam/instant-outbound", json=webhook)
    assert callback.status_code == 200
    assert callback.json()["call_status"] == "completed"
    with connect() as connection:
        final_audit = json.loads(connection.execute(
            "SELECT audit_trail_json FROM decision_ledger WHERE decision_id = ?", (decision_id,)
        ).fetchone()[0])
    recorded = next(item for item in final_audit if item.get("action") == "customer_call")
    assert recorded["attempt_id"] == attempt_id
    assert recorded["interaction_id"] == webhook["interaction_id"]
    assert recorded["call_outcome"] == "connected"
    assert recorded["outcome_recorded"] is True
