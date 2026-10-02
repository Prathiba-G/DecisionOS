from typing import Dict, Any, List, Optional
from app.config import settings
from app.engine.analytics import get_all_customer_ids, calculate_customer_metrics
from app.engine.scoring import calculate_priority_score

def run_what_if_simulation(
    top_n: int = 10,
    intervention_cost_per_account: Optional[float] = None,
    recovery_rate: Optional[float] = None
) -> Dict[str, Any]:
    """
    Deterministically simulates financial and account impact across scenarios:
    - Scenario A: Do Nothing (Baseline Churn Loss)
    - Scenario B: Intervene on Top N Priority Accounts
    - Scenario C: Intervene on All At-Risk Accounts (Priority > 40)
    All numbers calculated deterministically without LLM guesswork.
    """
    cost_per_acc = intervention_cost_per_account if intervention_cost_per_account is not None else settings.DEFAULT_INTERVENTION_COST_PER_ACCOUNT
    rec_rate = recovery_rate if recovery_rate is not None else settings.DEFAULT_ESTIMATED_RECOVERY_RATE
    
    # Calculate scores for all customers
    all_cids = get_all_customer_ids()
    evaluated_customers = []
    
    for cid in all_cids:
        metrics = calculate_customer_metrics(cid)
        if metrics.get("has_sufficient_data", False):
            score_data = calculate_priority_score(metrics)
            evaluated_customers.append({
                "customer_id": cid,
                "company_name": metrics["company_name"],
                "acv": metrics["acv"],
                "priority_score": score_data["priority_score"],
                "priority_level": score_data["priority_level"],
                "inactivity_days": metrics["inactivity_days"],
                "unresolved_tickets": metrics["unresolved_tickets_count"]
            })
            
    # Sort by priority score descending
    evaluated_customers.sort(key=lambda x: x["priority_score"], reverse=True)
    
    total_customers_count = len(evaluated_customers)
    total_pipeline_acv = sum(c["acv"] for c in evaluated_customers)
    
    # Identify high & medium risk cohorts
    high_risk_cohort = [c for c in evaluated_customers if c["priority_score"] >= settings.HIGH_PRIORITY_THRESHOLD]
    medium_risk_cohort = [c for c in evaluated_customers if settings.MEDIUM_PRIORITY_THRESHOLD <= c["priority_score"] < settings.HIGH_PRIORITY_THRESHOLD]
    all_at_risk_cohort = high_risk_cohort + medium_risk_cohort
    
    # -------------------------------------------------------------
    # Scenario A: Do Nothing
    # -------------------------------------------------------------
    # High risk accounts are projected to churn at 85% probability without intervention.
    # Medium risk accounts at 40% probability.
    scenario_a_churn_loss = sum(c["acv"] * 0.85 for c in high_risk_cohort) + sum(c["acv"] * 0.40 for c in medium_risk_cohort)
    scenario_a = {
        "scenario_name": "Scenario A: Do Nothing (Status Quo)",
        "description": "Zero proactive interventions; rely solely on standard inbound support.",
        "accounts_targeted": 0,
        "total_at_risk_acv": round(sum(c["acv"] for c in all_at_risk_cohort), 2),
        "intervention_cost": 0.0,
        "gross_recovered_value": 0.0,
        "projected_churn_loss": round(scenario_a_churn_loss, 2),
        "net_impact": round(-scenario_a_churn_loss, 2),
        "roi_multiple": 0.0,
        "assumptions": [
            "High-risk accounts experience 85% churn probability within 90 days.",
            "Medium-risk accounts experience 40% churn probability.",
            "Zero additional customer success overhead incurred."
        ]
    }
    
    # -------------------------------------------------------------
    # Scenario B: Target Top N Accounts (Default top_n, e.g. 5 or 10)
    # -------------------------------------------------------------
    target_b_customers = evaluated_customers[:min(top_n, len(evaluated_customers))]
    targeted_b_acv = sum(c["acv"] for c in target_b_customers)
    b_intervention_cost = len(target_b_customers) * cost_per_acc
    b_gross_recovered = targeted_b_acv * rec_rate
    # Churn loss for non-targeted risk accounts remains
    non_targeted_risk_b = [c for c in all_at_risk_cohort if c not in target_b_customers]
    b_residual_churn = sum(c["acv"] * (0.85 if c["priority_score"] >= settings.HIGH_PRIORITY_THRESHOLD else 0.40) for c in non_targeted_risk_b)
    b_net_impact = b_gross_recovered - b_intervention_cost
    b_roi = round(b_gross_recovered / b_intervention_cost, 2) if b_intervention_cost > 0 else 0.0
    
    scenario_b = {
        "scenario_name": f"Scenario B: Targeted Intervention (Top {len(target_b_customers)} Accounts)",
        "description": f"Deploy high-touch Customer Success and Technical Account Manager squads to the top {len(target_b_customers)} highest priority accounts.",
        "accounts_targeted": len(target_b_customers),
        "targeted_accounts": [{"id": c["customer_id"], "name": c["company_name"], "score": c["priority_score"], "acv": c["acv"]} for c in target_b_customers],
        "total_at_risk_acv": round(targeted_b_acv, 2),
        "intervention_cost": round(b_intervention_cost, 2),
        "gross_recovered_value": round(b_gross_recovered, 2),
        "projected_churn_loss": round(b_residual_churn + (targeted_b_acv * (1.0 - rec_rate)), 2),
        "net_impact": round(b_net_impact, 2),
        "roi_multiple": b_roi,
        "assumptions": [
            f"Dedicated intervention cost of ${cost_per_acc:,.0f} per account.",
            f"Estimated {int(rec_rate * 100)}% retention recovery rate on targeted portfolio.",
            "Remaining un-targeted accounts experience baseline churn trajectory."
        ]
    }
    
    # -------------------------------------------------------------
    # Scenario C: Broad Intervention on All At-Risk Accounts (Priority >= 40)
    # -------------------------------------------------------------
    c_target_customers = all_at_risk_cohort
    c_targeted_acv = sum(c["acv"] for c in c_target_customers)
    c_intervention_cost = len(c_target_customers) * cost_per_acc
    c_gross_recovered = c_targeted_acv * rec_rate
    c_net_impact = c_gross_recovered - c_intervention_cost
    c_roi = round(c_gross_recovered / c_intervention_cost, 2) if c_intervention_cost > 0 else 0.0
    
    scenario_c = {
        "scenario_name": f"Scenario C: Comprehensive Portfolio Intervention ({len(c_target_customers)} Accounts)",
        "description": "Engage all high and medium risk customer accounts across enterprise and mid-market tiers.",
        "accounts_targeted": len(c_target_customers),
        "targeted_accounts": [{"id": c["customer_id"], "name": c["company_name"], "score": c["priority_score"], "acv": c["acv"]} for c in c_target_customers],
        "total_at_risk_acv": round(c_targeted_acv, 2),
        "intervention_cost": round(c_intervention_cost, 2),
        "gross_recovered_value": round(c_gross_recovered, 2),
        "projected_churn_loss": round(c_targeted_acv * (1.0 - rec_rate), 2),
        "net_impact": round(c_net_impact, 2),
        "roi_multiple": c_roi,
        "assumptions": [
            f"Uniform ${cost_per_acc:,.0f} intervention cost deployed across all at-risk accounts.",
            f"Estimated {int(rec_rate * 100)}% recovery rate across diverse enterprise cohorts.",
            "Minimizes overall customer loss across the business portfolio."
        ]
    }
    
    return {
        "parameters": {
            "top_n_requested": top_n,
            "intervention_cost_per_account": cost_per_acc,
            "estimated_recovery_rate": rec_rate,
            "total_portfolio_accounts": total_customers_count,
            "total_portfolio_acv": round(total_pipeline_acv, 2)
        },
        "scenarios": {
            "scenario_a": scenario_a,
            "scenario_b": scenario_b,
            "scenario_c": scenario_c
        },
        "recommendation": f"Execute Scenario B (Top {len(target_b_customers)} Accounts) for optimal capital efficiency: ${b_net_impact:,.0f} net impact with {b_roi}x ROI.",
        "reproducible": True
    }
