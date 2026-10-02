from typing import Dict, Any, List
from app.config import settings
from app.engine.analytics import get_all_customer_ids, calculate_customer_metrics
from app.engine.scoring import calculate_priority_score

def run_simulation(
    target_count: int = 10,
    cost_per_account: float = settings.DEFAULT_INTERVENTION_COST_PER_ACCOUNT,
    recovery_rate: float = settings.DEFAULT_ESTIMATED_RECOVERY_RATE,
    custom_customer_ids: List[str] = None
) -> Dict[str, Any]:
    """
    Deterministically computes scenario modeling across the customer portfolio.
    Zero hallucination. All financial numbers computed deterministically.
    """
    all_cids = get_all_customer_ids()
    account_evaluations = []
    
    for cid in all_cids:
        metrics = calculate_customer_metrics(cid)
        if metrics.get("has_sufficient_data", False):
            score_data = calculate_priority_score(metrics)
            account_evaluations.append({
                "customer_id": cid,
                "company_name": metrics.get("company_name"),
                "acv": metrics.get("acv", 0.0),
                "priority_score": score_data.get("priority_score", 0.0),
                "priority_level": score_data.get("priority_level"),
                "unresolved_tickets": metrics.get("unresolved_tickets_count", 0),
                "days_inactive": metrics.get("inactivity_days", 0)
            })
            
    # Sort accounts by priority score descending
    account_evaluations.sort(key=lambda x: x["priority_score"], reverse=True)
    
    # -------------------------------------------------------------
    # Scenario A: Do Nothing (Baseline Churn Exposure)
    # -------------------------------------------------------------
    high_priority_accounts = [a for a in account_evaluations if a["priority_score"] >= settings.HIGH_PRIORITY_THRESHOLD]
    total_high_risk_acv = sum(a["acv"] for a in high_priority_accounts)
    
    scenario_a = {
        "scenario_id": "SCENARIO-A",
        "name": "Do Nothing (Status Quo)",
        "description": "Zero proactive intervention. High-priority accounts drift toward non-renewal and churn.",
        "accounts_targeted": 0,
        "targeted_customer_names": [],
        "total_at_risk_acv": total_high_risk_acv,
        "intervention_cost": 0.0,
        "estimated_recoverable_value": 0.0,
        "net_financial_impact": -total_high_risk_acv,
        "roi_multiple": 0.0,
        "assumptions": [
            "Accounts with Priority Score >= 65 face high probability of attrition without intervention.",
            "Zero cost incurred immediately, but 100% of at-risk contract value remains exposed."
        ]
    }
    
    # Determine targeted accounts for selected intervention
    if custom_customer_ids:
        selected_accounts = [a for a in account_evaluations if a["customer_id"] in custom_customer_ids]
    else:
        selected_accounts = account_evaluations[:target_count]
        
    actual_count = len(selected_accounts)
    targeted_acv = sum(a["acv"] for a in selected_accounts)
    intervention_cost = round(actual_count * cost_per_account, 2)
    recoverable_value = round(targeted_acv * recovery_rate, 2)
    net_benefit = round(recoverable_value - intervention_cost, 2)
    roi_multiple = round(recoverable_value / intervention_cost, 2) if intervention_cost > 0 else 0.0
    
    selected_scenario = {
        "scenario_id": f"SCENARIO-INTERVENE-{actual_count}",
        "name": f"Proactive Intervention on Top {actual_count} Priority Accounts",
        "description": f"Deploy Customer Success Retention Playbook to the top {actual_count} high-risk accounts.",
        "accounts_targeted": actual_count,
        "targeted_customer_names": [f"{a['customer_id']} ({a['company_name']} - ${a['acv']:,.0f})" for a in selected_accounts],
        "targeted_accounts_detail": selected_accounts,
        "total_at_risk_acv": targeted_acv,
        "intervention_cost": intervention_cost,
        "estimated_recoverable_value": recoverable_value,
        "net_financial_impact": net_benefit,
        "roi_multiple": roi_multiple,
        "assumptions": [
            f"Intervention cost benchmarked at ${cost_per_account:,.2f} per account (Senior CS architect + technical review).",
            f"Estimated retention win-back rate of {recovery_rate * 100:.1f}% based on historical pre-renewal interventions.",
            "Accounts contacted within 14 days of risk identification before contract renewal window closes."
        ]
    }
    
    # -------------------------------------------------------------
    # Scenario C: Broad Intervention (Top 25)
    # -------------------------------------------------------------
    broad_count = min(25, len(account_evaluations))
    broad_accounts = account_evaluations[:broad_count]
    broad_targeted_acv = sum(a["acv"] for a in broad_accounts)
    broad_cost = round(broad_count * cost_per_account, 2)
    broad_recoverable = round(broad_targeted_acv * recovery_rate, 2)
    broad_net = round(broad_recoverable - broad_cost, 2)
    broad_roi = round(broad_recoverable / broad_cost, 2) if broad_cost > 0 else 0.0

    scenario_c = {
        "scenario_id": "SCENARIO-C-TOP-25",
        "name": f"Broad Intervention (Top {broad_count} Accounts)",
        "description": f"Portfolio-wide sprint across top {broad_count} accounts.",
        "accounts_targeted": broad_count,
        "total_at_risk_acv": broad_targeted_acv,
        "intervention_cost": broad_cost,
        "estimated_recoverable_value": broad_recoverable,
        "net_financial_impact": broad_net,
        "roi_multiple": broad_roi,
        "assumptions": [
            f"Standard intervention cost of ${cost_per_account:,.2f} per account.",
            f"Estimated retention rate of {recovery_rate * 100:.1f}%."
        ]
    }
    
    return {
        "portfolio_summary": {
            "total_accounts_analyzed": len(account_evaluations),
            "high_risk_count": len(high_priority_accounts),
            "total_portfolio_at_risk_acv": total_high_risk_acv
        },
        "scenarios": [
            scenario_a,
            selected_scenario,
            scenario_c
        ],
        "active_parameters": {
            "target_count": actual_count,
            "cost_per_account": cost_per_account,
            "recovery_rate": recovery_rate
        }
    }
