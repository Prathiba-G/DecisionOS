import hashlib
import hmac
import re
import uuid
from typing import Any, Dict, List

import httpx

from app.config import settings

INSTANT_OUTBOUND_URL = "https://apps.sarvam.ai/api/outbounds/v1/orgs/{org_id}/workspaces/{workspace_id}/outbounds"


class SarvamConfigurationError(Exception):
    def __init__(self, missing: List[str]):
        self.missing = missing
        super().__init__("Sarvam telephony configuration required: " + ", ".join(missing))


class SarvamRequestError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        self.status_code = status_code
        super().__init__(message)


def missing_sarvam_configuration() -> List[str]:
    required = {
        "SARVAM_APP_ID": settings.SARVAM_APP_ID,
        "SARVAM_API_KEY": settings.SARVAM_API_KEY,
        "SARVAM_ORG_ID": settings.SARVAM_ORG_ID,
        "SARVAM_WORKSPACE_ID": settings.SARVAM_WORKSPACE_ID,
        "SARVAM_APP_VERSION": settings.SARVAM_APP_VERSION,
        "SARVAM_CONNECTION_ID": settings.SARVAM_CONNECTION_ID,
        "SARVAM_AGENT_PHONE_NUMBER": settings.SARVAM_AGENT_PHONE_NUMBER,
        "SARVAM_WEBHOOK_URL": settings.SARVAM_WEBHOOK_URL,
    }
    missing = [name for name, value in required.items() if not value or not value.strip()]
    if settings.SARVAM_APP_VERSION:
        try:
            if int(settings.SARVAM_APP_VERSION) < 1:
                missing.append("SARVAM_APP_VERSION (must be a positive integer)")
        except ValueError:
            missing.append("SARVAM_APP_VERSION (must be a positive integer)")
    return missing


def get_agent_variables(customer: Dict[str, Any], decision: Dict[str, Any]) -> Dict[str, Any]:
    company = customer.get("company_name") or customer.get("business_name")
    contact_name = customer.get("customer_name") or customer.get("contact_name")
    risk_reason = decision.get("reasoning_summary") or decision.get("recommendation")
    available = {
        "customer_id": customer.get("customer_id"),
        "customer_name": contact_name,
        "customer_company": company,
        "business_name": customer.get("business_name") or company,
        "risk_reason": risk_reason,
    }
    variables = {
        name: value.strip() if isinstance(value, str) else value
        for name, value in available.items()
        if value is not None and (not isinstance(value, str) or value.strip())
    }
    return variables


def missing_required_agent_variables(variables: Dict[str, Any]) -> List[str]:
    configured = getattr(settings, "SARVAM_REQUIRED_AGENT_VARIABLES", "") or ""
    required = [name.strip() for name in configured.split(",") if name.strip()]
    return [name for name in required if name not in variables or variables[name] in (None, "")]


def get_customer_phone(customer: Dict[str, Any]) -> str | None:
    for field in ("phone_number", "phone", "mobile_number", "mobile", "contact_phone"):
        value = customer.get(field)
        if isinstance(value, str) and value.strip():
            number = value.strip()
            if re.fullmatch(r"\+[1-9]\d{7,14}", number):
                return number
            raise ValueError("Customer phone number must be stored in E.164 format.")
    return None


def create_webhook_metadata(decision_id: str, customer_id: str) -> Dict[str, str]:
    call_ref = uuid.uuid4().hex
    secret = settings.SARVAM_API_KEY
    if not secret:
        raise SarvamConfigurationError(["SARVAM_API_KEY"])
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{call_ref}:{decision_id}:{customer_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "decisionos_call_ref": call_ref,
        "decision_id": decision_id,
        "customer_id": customer_id,
        "signature": signature,
    }


def verify_webhook_metadata(metadata: Dict[str, Any]) -> bool:
    secret = settings.SARVAM_API_KEY
    call_ref = metadata.get("decisionos_call_ref")
    decision_id = metadata.get("decision_id")
    customer_id = metadata.get("customer_id")
    signature = metadata.get("signature")
    if not all(isinstance(value, str) and value for value in (secret, call_ref, decision_id, customer_id, signature)):
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{call_ref}:{decision_id}:{customer_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


def initiate_outbound_call(
    customer_phone: str,
    agent_variables: Dict[str, Any],
    webhook_metadata: Dict[str, str],
) -> str:
    missing = missing_sarvam_configuration()
    if missing:
        raise SarvamConfigurationError(missing)

    url = INSTANT_OUTBOUND_URL.format(
        org_id=settings.SARVAM_ORG_ID,
        workspace_id=settings.SARVAM_WORKSPACE_ID,
    )
    payload = {
        "app_config": {
            "app_id": settings.SARVAM_APP_ID,
            "app_version": int(settings.SARVAM_APP_VERSION),
            "connection_config": {
                "connection_id": settings.SARVAM_CONNECTION_ID,
                "agent_phone_number": settings.SARVAM_AGENT_PHONE_NUMBER,
            },
            "agent_variables": agent_variables,
        },
        "user_config": {"user_phone_number": customer_phone},
        "webhook_config": {
            "url": settings.SARVAM_WEBHOOK_URL,
            "metadata": webhook_metadata,
        },
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                url,
                json=payload,
                headers={"X-API-Key": settings.SARVAM_API_KEY, "Content-Type": "application/json"},
            )
    except httpx.TimeoutException as exc:
        raise SarvamRequestError("Sarvam outbound request timed out.", 504) from exc
    except httpx.RequestError as exc:
        raise SarvamRequestError("Could not connect to Sarvam outbound calling.", 502) from exc

    if response.status_code in (401, 403):
        raise SarvamRequestError("Sarvam authentication failed. Check SARVAM_API_KEY.", 502)
    if not response.is_success:
        raise SarvamRequestError(
            f"Sarvam rejected the outbound call request (HTTP {response.status_code}). Verify the configured agent and telephony deployment.",
            502,
        )
    try:
        body = response.json()
    except ValueError as exc:
        raise SarvamRequestError("Sarvam returned an unreadable outbound call response.", 502) from exc
    attempt_id = body.get("attempt_id") if isinstance(body, dict) else None
    if not isinstance(attempt_id, str) or not attempt_id.strip():
        raise SarvamRequestError("Sarvam response did not include the documented attempt_id.", 502)
    return attempt_id
