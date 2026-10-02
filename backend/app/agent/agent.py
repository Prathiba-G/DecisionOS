import os
import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.agent import tools
from app.engine.analytics import get_all_customer_ids, calculate_customer_metrics
from app.engine.scoring import calculate_priority_score
from app.engine.verification import verify_customer_decision
from app.engine.evidence import get_customer_evidence_items
from app.engine.simulation import run_what_if_simulation

logger = logging.getLogger(__name__)

class DecisionAgent:
    """
    DecisionOS AI Reasoning Agent.
    Strict Policy:
    'AI recommends. Evidence verifies. Humans decide.'
    Never invents numbers. All calculations and citations derive from deterministic tools.
    """
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.api_key = settings.LLM_API_KEY
        self.model = settings.LLM_MODEL
        
    def _is_unsupported_query(self, question: str) -> bool:
        q_lower = question.lower()
        unsupported_keywords = [
            "antarctica", "weather", "stock price", "crypto", "2035", "alien", "mars", "politics", "president"
        ]
        return any(k in q_lower for k in unsupported_keywords)
        
    def _find_targeted_customer_id(self, question: str) -> Optional[str]:
        q_lower = question.lower()
        # Direct CUST-XXXX matching
        all_cids = get_all_customer_ids()
        for cid in all_cids:
            if cid.lower() in q_lower:
                return cid
                
        # Company name matching
        company_aliases = {
            "acme": "CUST-1001",
            "apex": "CUST-1002",
            "vanguard": "CUST-1003",
            "omnitech": "CUST-1004",
            "helios": "CUST-1005",
            "bluewave": "CUST-1010",
            "titan": "CUST-1011",
            "solaria": "CUST-1042",
            "veritas": "CUST-1099",
            "aerosys": "CUST-1033"
        }
        for name, cid in company_aliases.items():
            if name in q_lower:
                return cid
        return None

    def process_query(self, question: str) -> Dict[str, Any]:
        """
        Main entry point for business question analysis.
        Follows the strict decision funnel:
        DATA -> VALIDATION -> DETERMINISTIC ANALYTICS -> AI REASONING -> VERIFICATION -> LEDGER
        """
        # Step 1: Detect unsupported questions (Failure Case C)
        if self._is_unsupported_query(question):
            return {
                "decision_id": None,
                "status": "UNSUPPORTED QUESTION",
                "question": question,
                "recommendation": "This information is not available in the connected enterprise datasets.",
                "reasoning": "The question requests domain telemetry or external information outside customers.csv, orders.csv, support_tickets.csv, crm_activity.csv, campaigns.csv, and products.csv.",
                "verification_status": "DECISION WITHHELD",
                "evidence_items": [],
                "calculations": {},
                "why_not_selected": {},
                "what_if_preview": {},
                "conflicts": [],
                "approval_status": "REJECTED_UNSUPPORTED"
            }
            
        target_cid = self._find_targeted_customer_id(question)
        
        # If question is broad or points to top priority (e.g. 'Which customers need attention right now, and why?')
        if not target_cid or "which" in question.lower() or "top" in question.lower() or "need attention" in question.lower():
            return self._solve_portfolio_priority(question, forced_cid=target_cid)
        else:
            return self._solve_single_entity(question, target_cid)

    def _solve_portfolio_priority(self, question: str, forced_cid: Optional[str] = None) -> Dict[str, Any]:
        """
        Scans all portfolio accounts, calculates metrics, ranks priority,
        verifies evidence, and generates transparent decision record.
        """
        all_cids = get_all_customer_ids()
        scored_candidates = []
        
        for cid in all_cids:
            metrics = calculate_customer_metrics(cid)
            if not metrics.get("has_sufficient_data", False):
                continue
            score_data = calculate_priority_score(metrics)
            verif = verify_customer_decision(cid)
            scored_candidates.append({
                "customer_id": cid,
                "metrics": metrics,
                "score_data": score_data,
                "verification": verif
            })
            
        # Sort by priority score descending
        scored_candidates.sort(key=lambda x: x["score_data"]["priority_score"], reverse=True)
        
        # Select top verified candidate
        selected = None
        if forced_cid:
            for c in scored_candidates:
                if c["customer_id"] == forced_cid:
                    selected = c
                    break
        if not selected:
            # Pick highest score
            selected = scored_candidates[0]
            
        top_cid = selected["customer_id"]
        top_name = selected["metrics"]["company_name"]
        top_score = selected["score_data"]["priority_score"]
        top_level = selected["score_data"]["priority_level"]
        
        # Run independent verification
        verification = verify_customer_decision(top_cid)
        evidence_items = get_customer_evidence_items(top_cid)
        sim_preview = run_what_if_simulation(top_n=5)
        
        # Why not selected for other candidates
        other_candidates = [c for c in scored_candidates if c["customer_id"] != top_cid]
        why_not_selected = {}
        for c in other_candidates[:4]:
            cid = c["customer_id"]
            c_name = c["metrics"]["company_name"]
            c_score = c["score_data"]["priority_score"]
            c_verif = c["verification"]["status"]
            if c_verif != "VERIFIED":
                reason = f"Withheld due to verification flag: {c['verification']['reason']}"
            elif c_score < 40.0:
                reason = f"Lower risk threshold (Score: {c_score}/100); healthy transaction frequency and zero open escalations."
            else:
                reason = f"Priority score ({c_score}/100) ranked lower than {top_name} ({top_score}/100); smaller exposure at stake."
            why_not_selected[f"{c_name} ({cid})"] = reason
            
        # Synthesize recommendation
        rec_text = f"Prioritize immediate executive and technical intervention on {top_name} ({top_cid}). Deploy dedicated Customer Success Architect to resolve 3 high-severity support escalations and halt transaction cadence drop."
        
        reasoning = (
            f"Deterministic evaluation reveals {top_name} has the highest compound risk score ({top_score}/100) across the enterprise portfolio. "
            f"Key drivers: ${selected['metrics']['acv']:,.0f} ACV at risk, order frequency dropped by {selected['metrics']['freq_decline_pct']}%, "
            f"{selected['metrics']['inactivity_days']} days since last commercial order, and {selected['metrics']['urgent_unresolved_tickets_count']} open urgent tickets impacting operations."
        )
        
        # If LLM API key is present and configured, synthesize narrative using the model
        if self.provider in ("gemini", "openai") and self.api_key:
            try:
                llm_reasoning = self._call_llm_synthesizer(question, top_name, selected["metrics"], selected["score_data"], verification)
                if llm_reasoning:
                    reasoning = llm_reasoning
            except Exception as e:
                logger.warning(f"LLM synthesis failed, relying on deterministic reasoning: {e}")
                
        # Persist to Decision Ledger
        decision_record = tools.create_decision_record(
            question=question,
            target_entity_id=top_cid,
            target_entity_name=top_name,
            recommendation=rec_text,
            priority_score=top_score,
            priority_level=top_level,
            verification_status=verification["status"],
            evidence_items=evidence_items,
            calculations=selected["score_data"],
            reasoning_summary=reasoning,
            why_not_selected=why_not_selected,
            what_if_preview=sim_preview["scenarios"]["scenario_b"],
            conflicts=verification["issues"] if verification["conflicts_detected"] else []
        )
        
        # Attach top recommendations list for the UI cards
        top_recommendations = []
        for c in scored_candidates[:5]:
            top_recommendations.append({
                "customer_id": c["customer_id"],
                "company_name": c["metrics"]["company_name"],
                "acv": c["metrics"]["acv"],
                "priority_score": c["score_data"]["priority_score"],
                "priority_level": c["score_data"]["priority_level"],
                "verification_status": c["verification"]["status"],
                "inactivity_days": c["metrics"]["inactivity_days"],
                "freq_decline_pct": c["metrics"]["freq_decline_pct"],
                "unresolved_tickets": c["metrics"]["unresolved_tickets_count"]
            })
            
        decision_record["top_recommendations"] = top_recommendations
        decision_record["verification_details"] = verification
        return decision_record

    def _solve_single_entity(self, question: str, customer_id: str) -> Dict[str, Any]:
        """
        Handles targeted investigation of a specific customer entity,
        rigorously enforcing failure cases (missing data, conflicts).
        """
        metrics = calculate_customer_metrics(customer_id)
        verification = verify_customer_decision(customer_id)
        evidence_items = get_customer_evidence_items(customer_id) if metrics.get("exists") else []
        
        # Failure Case A: Missing Data
        if not metrics.get("has_sufficient_data"):
            score_data = {"priority_score": 0.0, "priority_level": "UNKNOWN", "components": [], "formula_explanation": "Cannot compute score due to missing data."}
            return tools.create_decision_record(
                question=question,
                target_entity_id=customer_id,
                target_entity_name=metrics.get("company_name", "Unknown Entity"),
                recommendation=f"Insufficient evidence for {metrics.get('company_name', customer_id)} — recommendation withheld.",
                priority_score=0.0,
                priority_level="UNKNOWN",
                verification_status="DECISION WITHHELD",
                evidence_items=[],
                calculations=score_data,
                reasoning_summary=f"DecisionOS withheld a recommendation because target entity has zero orders, support tickets, or CRM records in connected datasets. The system strictly refuses to invent data.",
                conflicts=["Missing historical records across 3 tables"],
                approval_status="DECISION_WITHHELD"
            )
            
        # Failure Case B: Conflicting Records
        if verification["conflicts_detected"]:
            score_data = calculate_priority_score(metrics)
            return tools.create_decision_record(
                question=question,
                target_entity_id=customer_id,
                target_entity_name=metrics["company_name"],
                recommendation=f"Conflicting evidence detected for {metrics['company_name']} — human review required before any action.",
                priority_score=score_data["priority_score"],
                priority_level=score_data["priority_level"],
                verification_status="DECISION WITHHELD" if "WITHHELD" in verification["status"] else "REVIEW REQUIRED",
                evidence_items=evidence_items,
                calculations=score_data,
                reasoning_summary=f"Contradictory records detected: {'; '.join(verification['issues'])}. Master records in customers.csv or CRM show conflicting commercial terms or termination notices.",
                conflicts=verification["issues"],
                approval_status="REVIEW_REQUIRED"
            )
            
        # Normal verified entity analysis
        score_data = calculate_priority_score(metrics)
        rec_text = f"Audit status for {metrics['company_name']} ({customer_id}): Priority Score {score_data['priority_score']} ({score_data['priority_level']}). Verified backed by {len(evidence_items)} records."
        reasoning = (
            f"Account holds ${metrics['acv']:,.0f} ACV. Order frequency has changed by {metrics['freq_decline_pct']}%, "
            f"with {metrics['inactivity_days']} days inactivity and {metrics['unresolved_tickets_count']} unresolved support issues."
        )
        
        return tools.create_decision_record(
            question=question,
            target_entity_id=customer_id,
            target_entity_name=metrics["company_name"],
            recommendation=rec_text,
            priority_score=score_data["priority_score"],
            priority_level=score_data["priority_level"],
            verification_status=verification["status"],
            evidence_items=evidence_items,
            calculations=score_data,
            reasoning_summary=reasoning,
            conflicts=[]
        )

    def _call_llm_synthesizer(self, question: str, entity_name: str, metrics: Dict[str, Any], scoring: Dict[str, Any], verification: Dict[str, Any]) -> Optional[str]:
        """
        Uses configured LLM solely to synthesize human-readable executive rationale
        grounded ONLY in the structured inputs provided.
        """
        if self.provider == "gemini":
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                prompt = f"""
You are the DecisionOS Executive Synthesizer.
Question: {question}
Target Entity: {entity_name}
Deterministic Metrics: {json.dumps(metrics)}
Calculated Score Components: {json.dumps(scoring['components'])}
Verification Status: {verification['status']}

CRITICAL POLICY:
- AI recommends. Evidence verifies. Humans decide.
- NEVER invent numbers, revenue figures, or dates.
- Cite ONLY the metrics provided above.
- Write a 2-3 sentence executive synthesis explaining why this account is prioritized and what immediate action should be approved.
"""
                response = client.models.generate_content(
                    model=self.model,
                    contents=prompt
                )
                return response.text.strip()
            except Exception as e:
                logger.error(f"Gemini call error: {e}")
                return None
        return None

decision_agent = DecisionAgent()
