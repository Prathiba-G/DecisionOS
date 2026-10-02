from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import re
from app.database import get_db_connection
from app.engine.evidence import get_customer_evidence_items

router = APIRouter(prefix="/evidence", tags=["Evidence"])

RAW_DATASET_TABLES = {
    "customers.csv": "customers",
    "orders.csv": "orders",
    "support_tickets.csv": "support_tickets",
    "crm_activity.csv": "crm_activity",
    "campaigns.csv": "campaigns",
    "products.csv": "products",
}

FILTER_SYNTAX_ERROR = (
    "Invalid evidence filter. Expected: customer_id=CUST-1004 "
    "or aggregate(customer_id=CUST-1004)."
)


def _parse_raw_filter(expression: str):
    expression = expression.strip()
    if not expression:
        return None

    aggregate_match = re.fullmatch(
        r"aggregate\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*\)",
        expression,
        flags=re.IGNORECASE,
    )
    if aggregate_match:
        field, value = aggregate_match.groups()
        operation = "aggregate"
    else:
        condition_match = re.fullmatch(
            r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*",
            expression,
        )
        if not condition_match:
            raise HTTPException(status_code=422, detail=FILTER_SYNTAX_ERROR)
        field, value = condition_match.groups()
        operation = "filter"

    value = value.strip()
    if not value:
        raise HTTPException(status_code=422, detail=FILTER_SYNTAX_ERROR)
    return {"operation": operation, "field": field, "value": value}


@router.get("/raw/records")
def get_raw_records(dataset: str, record_id: str = ""):
    """Return real source rows matching a field=value evidence filter."""
    table = RAW_DATASET_TABLES.get(dataset)
    if table is None:
        raise HTTPException(status_code=422, detail=f"Unsupported evidence dataset: {dataset}")

    parsed_filter = _parse_raw_filter(record_id)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(f'PRAGMA table_info("{table}")')
        columns = [row["name"] for row in cursor.fetchall()]

        if parsed_filter:
            field = parsed_filter["field"]
            column = next((name for name in columns if name.casefold() == field.casefold()), None)
            if column is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Field '{field}' is not present in {dataset}.",
                )
            quoted_column = '"' + column.replace('"', '""') + '"'
            cursor.execute(
                f'SELECT * FROM "{table}" WHERE LOWER(TRIM(CAST({quoted_column} AS TEXT))) = LOWER(?)',
                (parsed_filter["value"],),
            )
        else:
            cursor.execute(f'SELECT * FROM "{table}"')

        records = [dict(row) for row in cursor.fetchall()]
        return {
            "dataset": dataset,
            "operation": parsed_filter["operation"] if parsed_filter else "raw",
            "filter": parsed_filter,
            "count": len(records),
            "records": records,
        }
    finally:
        conn.close()

@router.get("/{entity_id}", response_model=List[Dict[str, Any]])
def get_evidence(entity_id: str):
    """
    Returns verifiable source records for a customer entity.
    """
    evidence_items = get_customer_evidence_items(entity_id)
    if not evidence_items:
        raise HTTPException(status_code=404, detail=f"No evidence records found for entity {entity_id}")
    return evidence_items
