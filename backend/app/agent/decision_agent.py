import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.config import settings
from app.database import get_db_connection
from app.engine.analytics import calculate_customer_metrics, get_all_customer_ids
from app.engine.scoring import calculate_priority_score
from app.engine.evidence import get_customer_evidence
from app.engine.verification import verify_decision
from app.engine.simulator import run_simulation

# Domains unsupported by connected business datasets
UNSUPPORTED_KEYWORDS = [
    "stock price", "market cap", "weather", "payroll", "salary", 
    "bitcoin", "crypto", "election", "president", "interest rate",
    "gdp", "inflation", "macroeconomic", "competitor earnings"
]

def check_unsupported_question(question: str) -> Optional[str]:
    q_lower = question.lower()
    for kw in UNSUPPORTED_KEYWORDS:
        if kw in q_lower:
            return f"This information ('{kw}') is not available in the connected business datasets (customers, orders, support tickets, CRM activity, campaigns, products)."
    return None

def generate_decision(
    question: str,
    target_customer_id: Optional[str] = None,
    force_fallback: bool = False
) -> Dict[str, Any]:
    """
    Core AI Decision Engine.
    Executes tool-calling pipeline -> deterministic verification -> Decision Ledger creation.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # -------------------------------------------------------------
    # Check Case C: Unsupported Question
    # -------------------------------------------------------------
    unsupported_reason = check_unsupported_question(question)
    if unsupported_reason:
        decision_id = f"D-{uuid.uuid4().hex[:4].upper()}"
        record = {
            "decision_id": decision_id,
            "created_at": timestamp,
            "question": question,
            "target_entity_id": "N/A",
            "target_entity_name": "External Domain",
            "recommendation": "DECISION WITHHELD: This information is not available in the connected datasets.",
            "priority_score": 0.0,
            "priority_level": "WITHHELD",
            "verification_status": "DECISION WITHHELD",
            "evidence": [],
            "calculations": [],
            "reasoning_summary": f"Refusal triggered by Domain Boundary Guard: Question requested data outside the connected enterprise database. {unsupported_reason}",
            "why_selected": "N/A - Query rejected at ingest.",
            "why_not_selected": "N/A",
            "what_if_preview": None,
            "conflicts": [],
            "approval_status": "WITHHELD",
            "simulated_action": "No action permitted.",
            "action_executed_at": None,
            "audit_trail": [
                {"timestamp": timestamp, "event": "QUERY_RECEIVED", "details": f"Question: '{question}'"},
                {"timestamp": timestamp, "event": "DOMAIN_BOUNDARY_CHECK", "details": "Question matched unsupported domain keyword filter."},
                {"timestamp": timestamp, "event": "DECISION_WITHHELD", "details": unsupported_reason}
            ]
        }
        _save_decision_to_ledger(record)
        return record

    # -------------------------------------------------------------
    # Step 1: Scan and rank accounts deterministically
    # -------------------------------------------------------------
    all_cids = get_all_customer_ids()
    candidates = []
    
    # If user asked about a specific customer (e.g. CUST-1001 or Acme)
    specific_cid = None
    if target_customer_id:
        specific_cid = target_customer_id
    else:
        for cid in all_cids:
            if cid.lower() in question.lower():
                specific_cid = cid
                break

    for cid in all_cids:
        metrics = calculate_customer_metrics(cid)
        score_data = calculate_priority_score(metrics)
        candidates.append({
            "customer_id": cid,
            "company_name": metrics.get("company_name", "Unknown"),
            "acv": metrics.get("acv", 0.0),
            "metrics": metrics,
            "score_data": score_data
        })

    # Sort candidates by priority score descending
    candidates.sort(key=lambda x: x["score_data"].get("priority_score", 0.0), reverse=True)

    # Choose primary target
    if specific_cid:
        target = next((c for c in candidates if c["customer_id"].upper() == specific_cid.upper()), None)
        if not target:
            # Maybe searched by name
            target = next((c for c in candidates if specific_cid.lower() in c["company_name"].lower()), candidates[0])
    else:
        target = candidates[0]

    target_cid = target["customer_id"]
    target_name = target["company_name"]
    metrics = target["metrics"]
    score_data = target["score_data"]
    
    # -------------------------------------------------------------
    # Step 2: Extract Traceable Evidence & Run Verification
    # -------------------------------------------------------------
    evidence_items = get_customer_evidence(target_cid, metrics)
    verification_result = verify_decision(target_cid, metrics, score_data, evidence_items)
    
    # -------------------------------------------------------------
    # Step 3: Handle Deliberate Failure Cases A & B
    # -------------------------------------------------------------
    decision_id = f"D-{uuid.uuid4().hex[:4].upper()}"
    audit_trail = [
        {"timestamp": timestamp, "event": "QUERY_RECEIVED", "details": f"Question: '{question}'"},
        {"timestamp": timestamp, "event": "DETERMINISTIC_METRICS_COMPUTED", "details": f"Evaluated {len(candidates)} accounts across 6 tables."},
        {"timestamp": timestamp, "event": "EVIDENCE_RETRIEVED", "details": f"Extracted {len(evidence_items)} source data pointers for {target_cid}."},
        {"timestamp": timestamp, "event": "VERIFICATION_COMPLETED", "details": f"Status: {verification_result['status']}. Reason: {verification_result['confidence_reason']}"}
    ]

    # Failure Case A: Missing Evidence (e.g. CUST-1099 Veritas Cloud)
    if not metrics.get("has_sufficient_data", False):
        recommendation = f"INSUFFICIENT EVIDENCE — Recommendation withheld for {target_name} ({target_cid})."
        reasoning = f"Account lacks sufficient historical commercial records ({metrics.get('missing_datasets', [])}). No verified trend can be mathematically computed without fabricating data. Automated recommendation withheld."
        record = {
            "decision_id": decision_id,
            "created_at": timestamp,
            "question": question,
            "target_entity_id": target_cid,
            "target_entity_name": target_name,
            "recommendation": recommendation,
            "priority_score": 0.0,
            "priority_level": "WITHHELD",
            "verification_status": "DECISION WITHHELD",
            "evidence": evidence_items,
            "calculations": [],
            "reasoning_summary": reasoning,
            "why_selected": "Target was evaluated due to direct query match.",
            "why_not_selected": "Action withheld due to critical lack of transaction and support data.",
            "what_if_preview": None,
            "conflicts": [],
            "approval_status": "WITHHELD",
            "simulated_action": "Flag account data pipeline to Customer Operations.",
            "action_executed_at": None,
            "audit_trail": audit_trail
        }
        _save_decision_to_ledger(record)
        return record

    # Failure Case B: Conflicting Records (e.g. CUST-1042 Solaria Networks)
    if len(verification_result["conflicts"]) > 0:
        recommendation = f"CONFLICTING EVIDENCE DETECTED — Human review required for {target_name} ({target_cid})."
        conflict_desc = " | ".join([c["details"] for c in verification_result["conflicts"]])
        reasoning = f"Automated recommendation withheld because contradictory source records exist: {conflict_desc}. Human intervention is required to resolve data integrity discrepancies before action."
        record = {
            "decision_id": decision_id,
            "created_at": timestamp,
            "question": question,
            "target_entity_id": target_cid,
            "target_entity_name": target_name,
            "recommendation": recommendation,
            "priority_score": score_data.get("priority_score", 0.0),
            "priority_level": "REVIEW REQUIRED",
            "verification_status": "REVIEW REQUIRED",
            "evidence": evidence_items,
            "calculations": score_data.get("components", []),
            "reasoning_summary": reasoning,
            "why_selected": "Target triggered risk threshold but halted at Verification Gate 1.",
            "why_not_selected": "Automated execution blocked due to unresolved data conflicts.",
            "what_if_preview": None,
            "conflicts": verification_result["conflicts"],
            "approval_status": "REVIEW_REQUESTED",
            "simulated_action": "Route conflict discrepancy ticket to Enterprise Data Quality team.",
            "action_executed_at": None,
            "audit_trail": audit_trail
        }
        _save_decision_to_ledger(record)
        return record

    # -------------------------------------------------------------
    # Step 4: Normal Verified Decision Case
    # -------------------------------------------------------------
    priority_score = score_data.get("priority_score", 0.0)
    priority_level = score_data.get("priority_level", "HIGH")
    acv = metrics.get("acv", 0.0)
    decline_pct = metrics.get("freq_decline_pct", 0.0)
    urgent_tickets = metrics.get("urgent_unresolved_tickets_count", 0)
    inactivity = metrics.get("inactivity_days", 0)
    
    # Why / Why Not Analysis
    # Compare with 2nd and 3rd candidate
    other_candidates = [c for c in candidates if c["customer_id"] != target_cid]
    why_selected = (
        f"{target_name} ({target_cid}) has the highest risk priority score ({priority_score}/100) "
        f"driven by a {decline_pct:.1f}% drop in order cadence, ${acv:,.0f} ACV exposure at renewal, "
        f"{urgent_tickets} unresolved critical tickets, and {inactivity} days of stakeholder silence."
    )
    
    why_not_selected = []
    for oc in other_candidates[:3]:
        oc_name = oc["company_name"]
        oc_score = oc["score_data"].get("priority_score", 0.0)
        oc_acv = oc["acv"]
        if oc_score < priority_score:
            reason_diff = f"Lower composite risk score ({oc_score}/100 vs {priority_score}/100)"
            if oc["metrics"].get("urgent_unresolved_tickets_count", 0) < urgent_tickets:
                reason_diff += f" and fewer operational escalations ({oc['metrics'].get('urgent_unresolved_tickets_count', 0)} vs {urgent_tickets})"
            why_not_selected.append({
                "customer_id": oc["customer_id"],
                "company_name": oc_name,
                "priority_score": oc_score,
                "reason_not_selected": reason_diff
            })

    # AI Synthesis with LLM or Deterministic Engine Fallback
    recommendation_text = f"Prioritize immediate executive retention intervention for {target_name}."
    reasoning_summary = (
        f"Customer {target_name} ({target_cid}) is at acute risk of churn. "
        f"Commercial ordering cadence declined by {decline_pct:.1f}% over the last 90 days while "
        f"{urgent_tickets} unresolved high-priority escalations remain open in support. "
        f"With renewal due in {metrics.get('renewal_days_remaining', 'shortly')} days and ${acv:,.0f} in annual contract value exposed, "
        f"an executive sponsor meeting and SLA mitigation plan must be deployed immediately."
    )

    # If LLM configured, attempt enhanced synthesis (strictly over verified facts)
    if settings.LLM_PROVIDER != "fallback" and settings.LLM_API_KEY and not force_fallback:
        try:
            enhanced_summary = _call_llm_synthesizer(
                target_name=target_name,
                target_cid=target_cid,
                metrics=metrics,
                score_data=score_data,
                evidence=evidence_items
            )
            if enhanced_summary:
                reasoning_summary = enhanced_summary
                audit_trail.append({"timestamp": timestamp, "event": "LLM_REASONING_SYNTHESIZED", "details": f"Model: {settings.LLM_MODEL} synthesized explanation grounded in verified tools."})
        except Exception as e:
            audit_trail.append({"timestamp": timestamp, "event": "LLM_FALLBACK_TRIGGERED", "details": f"LLM error: {str(e)}. Gracefully fell back to deterministic synthesis."})

    # What-If Impact Preview
    sim_result = run_simulation(target_count=1, custom_customer_ids=[target_cid])
    selected_scenario = sim_result["scenarios"][1]
    
    simulated_action = f"Deploy Executive Retention Playbook: Dispatch Senior CS Architect, issue SLA service credit, and schedule renewal QBR."

    record = {
        "decision_id": decision_id,
        "created_at": timestamp,
        "question": question,
        "target_entity_id": target_cid,
        "target_entity_name": target_name,
        "recommendation": recommendation_text,
        "priority_score": priority_score,
        "priority_level": priority_level,
        "verification_status": verification_result["status"],
        "evidence": evidence_items,
        "calculations": score_data.get("components", []),
        "reasoning_summary": reasoning_summary,
        "why_selected": why_selected,
        "why_not_selected": why_not_selected,
        "what_if_preview": {
            "accounts_targeted": 1,
            "at_risk_acv": acv,
            "intervention_cost": settings.DEFAULT_INTERVENTION_COST_PER_ACCOUNT,
            "estimated_recoverable_value": round(acv * settings.DEFAULT_ESTIMATED_RECOVERY_RATE, 2),
            "net_financial_benefit": round((acv * settings.DEFAULT_ESTIMATED_RECOVERY_RATE) - settings.DEFAULT_INTERVENTION_COST_PER_ACCOUNT, 2),
            "assumptions": selected_scenario.get("assumptions", [])
        },
        "conflicts": [],
        "approval_status": "AWAITING_APPROVAL",
        "simulated_action": simulated_action,
        "action_executed_at": None,
        "audit_trail": audit_trail
    }
    
    _save_decision_to_ledger(record)
    return record

def _call_llm_synthesizer(target_name: str, target_cid: str, metrics: Dict[str, Any], score_data: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Optional[str]:
    """
    Calls configured LLM provider to synthesize concise executive reasoning.
    Strictly constrained by verified evidence.
    """
    prompt = f"""You are DecisionOS, an enterprise AI decision intelligence engine.
Synthesize a concise, rigorous 3-sentence executive decision rationale for:
Account: {target_name} ({target_cid})
Deterministic Priority Score: {score_data.get('priority_score')}/100
Annual Contract Value: ${metrics.get('acv'):,.0f}
Purchase Decline: {metrics.get('freq_decline_pct')}%
Inactivity: {metrics.get('inactivity_days')} days
Open Urgent Tickets: {metrics.get('urgent_unresolved_tickets_count')}
Verified Evidence: {json.dumps([e['finding'] for e in evidence])}

Rules:
1. Do not invent any facts, numbers, or external events.
2. State the primary root cause clearly.
3. Recommend the decisive action awaiting human approval.
"""
    if "gemini" in settings.LLM_PROVIDER.lower() or "gemini" in settings.LLM_MODEL.lower():
        from google import genai
        client = genai.Client(api_key=settings.LLM_API_KEY)
        response = client.models.generate_content(
            model=settings.LLM_MODEL or "gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    return None

def _save_decision_to_ledger(rec: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO decision_ledger (
            decision_id, created_at, question, target_entity_id, target_entity_name,
            recommendation, priority_score, priority_level, verification_status,
            evidence_json, calculations_json, reasoning_summary, why_not_selected_json,
            what_if_preview_json, conflicts_json, approval_status, simulated_action,
            action_executed_at, audit_trail_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rec["decision_id"],
        rec["created_at"],
        rec["question"],
        rec["target_entity_id"],
        rec["target_entity_name"],
        rec["recommendation"],
        rec["priority_score"],
        rec["priority_level"],
        rec["verification_status"],
        json.dumps(rec.get("evidence", [])),
        json.dumps(rec.get("calculations", [])),
        rec["reasoning_summary"],
        json.dumps(rec.get("why_not_selected", [])),
        json.dumps(rec.get("what_if_preview", {})),
        json.dumps(rec.get("conflicts", [])),
        rec["approval_status"],
        rec.get("simulated_action"),
        rec.get("action_executed_at"),
        json.dumps(rec.get("audit_trail", []))
    ))
    conn.commit()
    conn.close()

def get_all_decisions(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    decisions = []
    for r in rows:
        d = dict(r)
        d["evidence"] = json.loads(d["evidence_json"])
        d["calculations"] = json.loads(d["calculations_json"])
        d["why_not_selected"] = json.loads(d["why_not_selected_json"]) if d["why_not_selected_json"] else []
        d["what_if_preview"] = json.loads(d["what_if_preview_json"]) if d["what_if_preview_json"] else None
        d["conflicts"] = json.loads(d["conflicts_json"]) if d["conflicts_json"] else []
        d["audit_trail"] = json.loads(d["audit_trail_json"]) if d["audit_trail_json"] else []
        decisions.append(d)
    conn.close()
    return decisions

def get_decision_by_id(decision_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    d = dict(row)
    d["evidence"] = json.loads(d["evidence_json"])
    d["calculations"] = json.loads(d["calculations_json"])
    d["why_not_selected"] = json.loads(d["why_not_selected_json"]) if d["why_not_selected_json"] else []
    d["what_if_preview"] = json.loads(d["what_if_preview_json"]) if d["what_if_preview_json"] else None
    d["conflicts"] = json.loads(d["conflicts_json"]) if d["conflicts_json"] else []
    d["audit_trail"] = json.loads(d["audit_trail_json"]) if d["audit_trail_json"] else []
    conn.close()
    return d

def update_decision_approval(decision_id: str, new_status: str, reviewer_note: str = "") -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT audit_trail_json FROM decision_ledger WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    audit_trail = json.loads(row["audit_trail_json"])
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    action_executed = now_str if new_status == "APPROVED" else None
    
    audit_trail.append({
        "timestamp": now_str,
        "event": f"HUMAN_{new_status}",
        "details": f"Status updated to {new_status}. Note: {reviewer_note}" if reviewer_note else f"Status updated to {new_status}."
    })
    
    cursor.execute("""
        UPDATE decision_ledger
        SET approval_status = ?, action_executed_at = ?, audit_trail_json = ?
        WHERE decision_id = ?
    """, (new_status, action_executed, json.dumps(audit_trail), decision_id))
    conn.commit()
    conn.close()
    return get_decision_by_id(decision_id)
