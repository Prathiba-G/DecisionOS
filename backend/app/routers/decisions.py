from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
from datetime import datetime, timezone
from app.database import get_db_connection
from app.agent.agent import decision_agent
from app.services.sarvam import (
    SarvamConfigurationError,
    SarvamRequestError,
    create_webhook_metadata,
    get_agent_variables,
    get_customer_phone,
    initiate_outbound_call,
    missing_required_agent_variables,
    missing_sarvam_configuration,
    verify_webhook_metadata,
)

router = APIRouter(prefix="/decisions", tags=["Decisions"])
sarvam_webhook_router = APIRouter(prefix="/webhooks/sarvam", tags=["Sarvam Webhooks"])

class QueryRequest(BaseModel):
    question: str
    target_entity_id: Optional[str] = None

class ApprovalActionRequest(BaseModel):
    reviewer_notes: Optional[str] = "Approved by Executive Operator via DecisionOS UI"


def _get_call_decision_and_customer(decision_id: str) -> tuple[Dict[str, Any], Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    decision_row = cursor.fetchone()
    if not decision_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Decision not found.")

    decision = dict(decision_row)
    customer_id = str(decision.get("target_entity_id") or "").strip()
    if not customer_id or customer_id.casefold() in {"n/a", "none", "null"}:
        conn.close()
        raise HTTPException(status_code=422, detail="This decision does not identify a customer.")

    cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    customer_rows = cursor.fetchall()
    conn.close()
    if not customer_rows:
        raise HTTPException(status_code=404, detail="The decision's customer was not found in the customer records.")

    customer = dict(customer_rows[0])
    if any(str(row["company_name"]) != str(customer.get("company_name")) for row in customer_rows[1:]):
        raise HTTPException(status_code=409, detail="The customer records are ambiguous; outbound calling is blocked.")
    return decision, customer


def _read_audit_trail(decision: Dict[str, Any]) -> List[Dict[str, Any]]:
    try:
        trail = json.loads(decision.get("audit_trail_json") or "[]")
    except (TypeError, json.JSONDecodeError):
        trail = []
    return trail if isinstance(trail, list) else []


def _record_customer_call_event(decision_id: str, event: Dict[str, Any]) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT audit_trail_json FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Decision not found while recording the call event.")
    try:
        audit_trail = json.loads(row["audit_trail_json"] or "[]")
    except (TypeError, json.JSONDecodeError):
        audit_trail = []
    if not isinstance(audit_trail, list):
        audit_trail = []
    audit_trail.append(event)
    cursor.execute(
        "UPDATE decision_ledger SET audit_trail_json = ? WHERE decision_id = ?",
        (json.dumps(audit_trail), decision_id),
    )
    conn.commit()
    conn.close()

@router.get("", response_model=List[Dict[str, Any]])
def list_decisions(status: Optional[str] = None):
    """
    Returns persistent Decision Ledger records.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM decision_ledger WHERE verification_status = ? ORDER BY created_at DESC", (status,))
    else:
        cursor.execute("SELECT * FROM decision_ledger ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    decisions = []
    for r in rows:
        d = dict(r)
        d["evidence"] = json.loads(d["evidence_json"])
        d["calculations"] = json.loads(d["calculations_json"])
        d["audit_trail"] = json.loads(d["audit_trail_json"])
        d["why_not_selected"] = json.loads(d["why_not_selected_json"]) if d["why_not_selected_json"] else {}
        d["what_if_preview"] = json.loads(d["what_if_preview_json"]) if d["what_if_preview_json"] else {}
        d["conflicts"] = json.loads(d["conflicts_json"]) if d["conflicts_json"] else []
        decisions.append(d)
    return decisions

@router.get("/{decision_id}", response_model=Dict[str, Any])
def get_decision(decision_id: str):
    """
    Returns full decision detail and complete provenance lineage.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found in Decision Ledger.")
        
    d = dict(row)
    d["evidence"] = json.loads(d["evidence_json"])
    d["calculations"] = json.loads(d["calculations_json"])
    d["audit_trail"] = json.loads(d["audit_trail_json"])
    d["why_not_selected"] = json.loads(d["why_not_selected_json"]) if d["why_not_selected_json"] else {}
    d["what_if_preview"] = json.loads(d["what_if_preview_json"]) if d["what_if_preview_json"] else {}
    d["conflicts"] = json.loads(d["conflicts_json"]) if d["conflicts_json"] else []
    return d

@router.post("/query", response_model=Dict[str, Any])
def submit_query(req: QueryRequest):
    """
    Submits a business question through the DecisionOS reasoning and verification pipeline.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    result = decision_agent.process_query(req.question)
    return result

@router.post("/{decision_id}/approve")
def approve_decision(decision_id: str, req: Optional[ApprovalActionRequest] = None):
    """
    Executes human approval for a verified recommendation.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found.")
        
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    audit_trail = json.loads(row["audit_trail_json"])
    audit_trail.append({
        "timestamp": now_str,
        "action": "APPROVED",
        "actor": "Executive Approver (Human)",
        "notes": req.reviewer_notes if req else "Approved"
    })
    audit_trail.append({
        "timestamp": now_str,
        "action": "SIMULATED_ACTION_DISPATCHED",
        "actor": "DecisionOS Execution Engine",
        "detail": "Simulated dispatch of executive account alert and CS SWAT assignment"
    })
    
    cursor.execute("""
        UPDATE decision_ledger
        SET approval_status = 'APPROVED',
            simulated_action = 'ACTION DISPATCHED (SIMULATED): Dedicated CS SWAT deployed',
            action_executed_at = ?,
            audit_trail_json = ?
        WHERE decision_id = ?
    """, (now_str, json.dumps(audit_trail), decision_id))
    conn.commit()
    conn.close()
    
    return {
        "decision_id": decision_id,
        "status": "APPROVED",
        "approval_status": "APPROVED",
        "simulated_action": "ACTION DISPATCHED (SIMULATED): Dedicated CS SWAT deployed",
        "updated_at": now_str,
        "audit_trail": audit_trail
    }

@router.post("/{decision_id}/reject")
def reject_decision(decision_id: str, req: Optional[ApprovalActionRequest] = None):
    """
    Rejects a decision recommendation.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found.")
        
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    audit_trail = json.loads(row["audit_trail_json"])
    audit_trail.append({
        "timestamp": now_str,
        "action": "REJECTED",
        "actor": "Executive Approver (Human)",
        "notes": req.reviewer_notes if req else "Rejected"
    })
    
    cursor.execute("""
        UPDATE decision_ledger
        SET approval_status = 'REJECTED',
            audit_trail_json = ?
        WHERE decision_id = ?
    """, (json.dumps(audit_trail), decision_id))
    conn.commit()
    conn.close()
    
    return {
        "decision_id": decision_id,
        "status": "REJECTED",
        "approval_status": "REJECTED",
        "updated_at": now_str,
        "audit_trail": audit_trail
    }

@router.post("/{decision_id}/request-review")
def request_review(decision_id: str, req: Optional[ApprovalActionRequest] = None):
    """
    Escalates decision for formal auditor/data steward review.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found.")
        
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    audit_trail = json.loads(row["audit_trail_json"])
    audit_trail.append({
        "timestamp": now_str,
        "action": "REVIEW_REQUESTED",
        "actor": "Auditor Queue",
        "notes": req.reviewer_notes if req else "Audit review requested"
    })
    
    cursor.execute("""
        UPDATE decision_ledger
        SET approval_status = 'REVIEW_REQUESTED',
            audit_trail_json = ?
        WHERE decision_id = ?
    """, (json.dumps(audit_trail), decision_id))
    conn.commit()
    conn.close()
    
    return {
        "decision_id": decision_id,
        "status": "REVIEW_REQUESTED",
        "approval_status": "REVIEW_REQUESTED",
        "updated_at": now_str,
        "audit_trail": audit_trail
    }


@router.get("/{decision_id}/call-readiness")
def get_customer_call_readiness(decision_id: str):
    decision, customer = _get_call_decision_and_customer(decision_id)
    missing_configuration = missing_sarvam_configuration()
    missing_customer_data: List[str] = []
    try:
        phone = get_customer_phone(customer)
        if not phone:
            missing_customer_data.append("customer phone number (E.164)")
    except ValueError as exc:
        phone = None
        missing_customer_data.append(str(exc))

    variables = get_agent_variables(customer, decision)
    missing_variables = missing_required_agent_variables(variables)
    approval_ready = decision.get("approval_status") == "APPROVED"
    evidence_ready = decision.get("verification_status") == "VERIFIED"
    latest_call = next(
        (event for event in reversed(_read_audit_trail(decision)) if event.get("action") == "customer_call"),
        None,
    )
    call_pending = bool(latest_call and latest_call.get("call_status") == "queued" and not latest_call.get("outcome_recorded"))
    return {
        "decision_id": decision_id,
        "customer_id": customer.get("customer_id"),
        "approval_required": not approval_ready,
        "evidence_verified": evidence_ready,
        "eligible": approval_ready and evidence_ready and not missing_configuration and not missing_customer_data and not missing_variables and not call_pending,
        "configuration_required": bool(missing_configuration),
        "missing_configuration": missing_configuration,
        "missing_customer_data": missing_customer_data,
        "missing_agent_variables": missing_variables,
        "call_status": latest_call.get("call_status") if latest_call else None,
        "attempt_id": latest_call.get("attempt_id") if latest_call else None,
        "interaction_id": latest_call.get("interaction_id") if latest_call else None,
        "call_outcome": latest_call.get("call_outcome") if latest_call else None,
        "outcome_recorded": bool(latest_call and latest_call.get("outcome_recorded")),
    }


@router.post("/{decision_id}/call")
def call_customer(decision_id: str):
    decision, customer = _get_call_decision_and_customer(decision_id)
    if decision.get("approval_status") != "APPROVED":
        raise HTTPException(status_code=409, detail="Human approval is required before calling this customer.")
    if decision.get("verification_status") != "VERIFIED":
        raise HTTPException(status_code=409, detail="Verified evidence is required before calling this customer.")
    latest_call = next(
        (event for event in reversed(_read_audit_trail(decision)) if event.get("action") == "customer_call"),
        None,
    )
    if latest_call and latest_call.get("call_status") == "queued" and not latest_call.get("outcome_recorded"):
        raise HTTPException(status_code=409, detail="A customer call is already queued for this decision.")

    missing_configuration = missing_sarvam_configuration()
    if missing_configuration:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SARVAM_CONFIGURATION_REQUIRED",
                "message": "Sarvam telephony configuration required. No call was placed.",
                "missing_configuration": missing_configuration,
            },
        )

    try:
        customer_phone = get_customer_phone(customer)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not customer_phone:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "CUSTOMER_PHONE_REQUIRED",
                "message": "No customer phone number is stored for this account. No call was placed.",
            },
        )

    agent_variables = get_agent_variables(customer, decision)
    missing_variables = missing_required_agent_variables(agent_variables)
    if missing_variables:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "SARVAM_AGENT_VARIABLES_REQUIRED",
                "message": "Required Sarvam agent variables are not available from this customer and decision.",
                "missing_agent_variables": missing_variables,
            },
        )

    customer_id = str(customer["customer_id"])
    webhook_metadata = create_webhook_metadata(decision_id, customer_id)
    try:
        attempt_id = initiate_outbound_call(customer_phone, agent_variables, webhook_metadata)
    except SarvamConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SARVAM_CONFIGURATION_REQUIRED",
                "message": "Sarvam telephony configuration required. No call was placed.",
                "missing_configuration": exc.missing,
            },
        ) from exc
    except SarvamRequestError as exc:
        _record_customer_call_event(decision_id, {
            "action": "customer_call",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "decision_id": decision_id,
            "customer_id": customer_id,
            "customer_name": customer.get("customer_name") or customer.get("contact_name"),
            "customer_company": customer.get("company_name"),
            "approval_state": decision.get("approval_status"),
            "call_status": "failed",
            "failure_reason": str(exc),
            "provider_http_status": exc.status_code,
        })
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": "SARVAM_REQUEST_FAILED", "message": str(exc)},
        ) from exc

    timestamp = datetime.now(timezone.utc).isoformat()
    call_event = {
        "action": "customer_call",
        "timestamp": timestamp,
        "decision_id": decision_id,
        "customer_id": customer_id,
        "customer_name": customer.get("customer_name") or customer.get("contact_name"),
        "customer_company": customer.get("company_name"),
        "approval_state": decision.get("approval_status"),
        "attempt_id": attempt_id,
        "interaction_id": None,
        "call_status": "queued",
        "call_outcome": None,
        "outcome_recorded": False,
        "decisionos_call_ref": webhook_metadata["decisionos_call_ref"],
    }
    _record_customer_call_event(decision_id, call_event)
    return {
        "decision_id": decision_id,
        "customer_id": customer_id,
        "call_status": "queued",
        "attempt_id": attempt_id,
        "message": "Sarvam accepted the outbound call request.",
    }


@sarvam_webhook_router.post("/instant-outbound")
def receive_sarvam_outbound_webhook(payload: Dict[str, Any]):
    attempt_id = payload.get("attempt_id")
    status = payload.get("status")
    webhook_config = payload.get("webhook_config")
    metadata = webhook_config.get("metadata") if isinstance(webhook_config, dict) else None
    if not isinstance(attempt_id, str) or not attempt_id.strip() or status not in {"connected", "no_answer", "busy", "failed"}:
        raise HTTPException(status_code=422, detail="Invalid Sarvam instant-outbound webhook payload.")
    if not isinstance(metadata, dict) or not verify_webhook_metadata(metadata):
        raise HTTPException(status_code=401, detail="Sarvam webhook correlation could not be authenticated.")

    decision_id = metadata["decision_id"]
    customer_id = metadata["customer_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Webhook decision mapping was not found.")
    decision = dict(row)
    if str(decision.get("target_entity_id")) != customer_id:
        conn.close()
        raise HTTPException(status_code=409, detail="Webhook customer does not match the decision target.")

    audit_trail = _read_audit_trail(decision)
    call_event = next(
        (event for event in reversed(audit_trail) if event.get("action") == "customer_call" and event.get("decisionos_call_ref") == metadata["decisionos_call_ref"]),
        None,
    )
    if not call_event or call_event.get("attempt_id") != attempt_id:
        conn.close()
        raise HTTPException(status_code=404, detail="Webhook call attempt could not be mapped to the Decision Ledger.")

    call_event.update({
        "call_status": "completed" if status == "connected" else "failed",
        "call_outcome": status,
        "outcome_recorded": True,
        "interaction_id": payload.get("interaction_id"),
        "duration": payload.get("duration"),
        "failure_reason": payload.get("failure_reason"),
        "channel_info": payload.get("channel_info"),
        "final_agent_variables": payload.get("final_agent_variables"),
        "interaction_transcript": payload.get("interaction_transcript"),
        "outcome_recorded_at": datetime.now(timezone.utc).isoformat(),
    })
    cursor.execute(
        "UPDATE decision_ledger SET audit_trail_json = ? WHERE decision_id = ?",
        (json.dumps(audit_trail), decision_id),
    )
    conn.commit()
    conn.close()
    return {"received": True, "decision_id": decision_id, "call_status": call_event["call_status"], "outcome_recorded": True}
