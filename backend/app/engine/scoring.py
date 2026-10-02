from typing import Dict, Any, List
from app.config import settings

def calculate_priority_score(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes a completely deterministic, reproducible priority score [0..100].
    Answers: 'How was this score calculated?' with transparent component breakdown.
    """
    if not metrics.get("has_sufficient_data", False):
        return {
            "priority_score": 0.0,
            "priority_level": "UNKNOWN",
            "components": [],
            "formula_explanation": "Insufficient data available to compute priority score.",
            "reproducible": True
        }

    components = []
    
    # 1. ACV / Customer Value Component (Weight: 25%)
    acv = float(metrics.get("acv", 0.0))
    # Benchmark: $250k is maximum tier benchmark
    norm_acv = min(1.0, max(0.0, acv / 250000.0))
    contrib_acv = round(norm_acv * settings.WEIGHT_ACV * 100.0, 2)
    components.append({
        "component": "Customer Value (ACV)",
        "raw_value": f"${acv:,.2f}",
        "normalized_value": round(norm_acv, 4),
        "weight": settings.WEIGHT_ACV,
        "contribution": contrib_acv,
        "explanation": f"Annual contract value of ${acv:,.0f} represents significant financial revenue at stake."
    })
    
    # 2. Purchase Decline Component (Weight: 25%)
    freq_decline = float(metrics.get("freq_decline_pct", 0.0))
    norm_decline = min(1.0, max(0.0, freq_decline / 100.0))
    contrib_decline = round(norm_decline * settings.WEIGHT_PURCHASE_DECLINE * 100.0, 2)
    components.append({
        "component": "Purchase Frequency Decline",
        "raw_value": f"{freq_decline:.1f}%",
        "normalized_value": round(norm_decline, 4),
        "weight": settings.WEIGHT_PURCHASE_DECLINE,
        "contribution": contrib_decline,
        "explanation": f"Order cadence dropped by {freq_decline:.1f}% between prior baseline and recent 90-day window."
    })
    
    # 3. Inactivity Duration Component (Weight: 20%)
    inactivity_days = int(metrics.get("inactivity_days", 0))
    # Thresholds: <=14 days is healthy (0.0), >=75 days is severe risk (1.0)
    norm_inactivity = min(1.0, max(0.0, (inactivity_days - 14) / (75.0 - 14.0))) if inactivity_days > 14 else 0.0
    contrib_inactivity = round(norm_inactivity * settings.WEIGHT_INACTIVITY * 100.0, 2)
    components.append({
        "component": "Inactivity Duration",
        "raw_value": f"{inactivity_days} days",
        "normalized_value": round(norm_inactivity, 4),
        "weight": settings.WEIGHT_INACTIVITY,
        "contribution": contrib_inactivity,
        "explanation": f"No commercial orders or logged executive touchpoints for {inactivity_days} consecutive days."
    })
    
    # 4. Support Issues Component (Weight: 20%)
    unresolved_urgent = int(metrics.get("urgent_unresolved_tickets_count", 0))
    unresolved_total = int(metrics.get("unresolved_tickets_count", 0))
    # Each urgent ticket adds 0.35, other unresolved adds 0.15, max 1.0
    norm_support = min(1.0, (unresolved_urgent * 0.35) + (max(0, unresolved_total - unresolved_urgent) * 0.15))
    contrib_support = round(norm_support * settings.WEIGHT_SUPPORT_ISSUES * 100.0, 2)
    components.append({
        "component": "Unresolved Support Escalations",
        "raw_value": f"{unresolved_total} open ({unresolved_urgent} urgent)",
        "normalized_value": round(norm_support, 4),
        "weight": settings.WEIGHT_SUPPORT_ISSUES,
        "contribution": contrib_support,
        "explanation": f"Account has {unresolved_urgent} unresolved high-priority/urgent tickets impacting operational SLA."
    })
    
    # 5. Engagement Decline Component (Weight: 10%)
    unsubscribed = bool(metrics.get("campaign_unsubscribed", False))
    open_rate = float(metrics.get("campaign_open_rate", 0.5))
    if unsubscribed:
        norm_engagement = 1.0
        eng_raw = "Unsubscribed from executive webinars"
    else:
        norm_engagement = min(1.0, max(0.0, 1.0 - open_rate))
        eng_raw = f"{(open_rate * 100):.0f}% campaign open rate"
    contrib_engagement = round(norm_engagement * settings.WEIGHT_ENGAGEMENT_DECLINE * 100.0, 2)
    components.append({
        "component": "Executive Engagement Trend",
        "raw_value": eng_raw,
        "normalized_value": round(norm_engagement, 4),
        "weight": settings.WEIGHT_ENGAGEMENT_DECLINE,
        "contribution": contrib_engagement,
        "explanation": f"Marketing and stakeholder responsiveness indicates detachment ({eng_raw})."
    })
    
    # Final Score Calculation
    final_score = round(sum(c["contribution"] for c in components), 1)
    # Ensure score stays bounded [0, 100]
    final_score = max(0.0, min(100.0, final_score))
    
    if final_score >= settings.HIGH_PRIORITY_THRESHOLD:
        priority_level = "HIGH"
    elif final_score >= settings.MEDIUM_PRIORITY_THRESHOLD:
        priority_level = "MEDIUM"
    else:
        priority_level = "LOW"
        
    return {
        "priority_score": final_score,
        "priority_level": priority_level,
        "components": components,
        "formula_explanation": "Priority Score = sum(Normalized Value * Weight * 100) across ACV (25%), Purchase Decline (25%), Inactivity (20%), Support Issues (20%), and Engagement (10%).",
        "reproducible": True
    }
