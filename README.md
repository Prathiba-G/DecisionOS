# DecisionOS: Evidence-Backed AI Decision Intelligence

[![Hackathon Track](https://img.shields.io/badge/Hackathon%20Track-PS--04%20AI%20Decision%20Engine-gold)](https://github.com)
[![Status](https://img.shields.io/badge/Status-Complete%20%26%20Demo--Ready-emerald)](https://github.com)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](https://github.com)

> **"AI recommends. Evidence verifies. Humans decide."**

DecisionOS is a competition-grade decision intelligence platform designed to eliminate ungrounded AI hallucinations from consequential business workflows. Instead of allowing an LLM to invent numbers or guess churn risk, DecisionOS enforces a strict mathematical separation: **deterministic backend engines compute metrics and verify evidence**, while the AI agent reasons strictly over verified facts and structures decisions for human sign-off.

---

## 1. Core Architecture Pipeline

```text
BUSINESS DATA (6 Connected Tables)
      ↓
DATA VALIDATION & QUALITY PROFILING
      ↓
EVIDENCE RETRIEVAL (Traceable Primary Keys)
      ↓
DETERMINISTIC ANALYTICS (Invariable Python/SQLite Engine)
      ↓
AI REASONING / TOOL CALLING (Gemini API with Offline Deterministic Fallback)
      ↓
INDEPENDENT VERIFICATION LAYER (5 Integrity Gates)
      ↓
DECISION GENERATION & WHY/WHY NOT COMPARISON
      ↓
DECISION LEDGER (Persistent SQLite Audit Trail)
      ↓
HUMAN APPROVAL (Approve / Reject / Request Review)
```

---

## 2. Key Personas & Product Experience

| Persona | Core Needs | How DecisionOS Delivers |
| :--- | :--- | :--- |
| **Executive** | What needs attention? Why? What is the impact? What should I approve? | Overview dashboard with at-risk exposure, high-priority accounts, 1-click approvals, and simulated playbooks. |
| **Analyst** | Evidence, source records, calculations, explainability, scenario modeling. | Transparent score formula breakdown, raw CSV record inspector, and interactive What-If parameter levers. |
| **Auditor** | Decision ID, source lineage, reproducible math, verification status, ledger trail. | Persistent Decision IDs (e.g. `D-0101`), verified source row/column pointers, mathematical invariance checks, and timestamped audit logs. |

---

## 3. Deliberate Failure & Reliability Cases (Demo Highlights)

DecisionOS includes deliberate anomalies in its synthetic business seed data to demonstrate its reliability guardrails:

* **Case A — Missing Evidence (`CUST-1099` Veritas Cloud)**:
  * Has customer account record but 0 orders and 0 CRM activities.
  * *DecisionOS Response*: `DECISION WITHHELD: Insufficient evidence — recommendation withheld.` Refuses to invent risk.
* **Case B — Conflicting Records (`CUST-1042` Solaria Networks)**:
  * Contradictory ACVs ($125,000 vs $75,000) and CRM activity logging contract termination contradicts active status.
  * *DecisionOS Response*: `REVIEW REQUIRED: Conflicting evidence detected.` Halts automated action for human review.
* **Case C — Unsupported Domain Question**:
  * e.g. *"What will Acme's stock price be next quarter?"*
  * *DecisionOS Response*: `DECISION WITHHELD: This information is not available in the connected datasets.` Rejects external domain queries without hallucinating.

---

## 4. Tech Stack

* **Backend**: FastAPI (Python 3.13), Pydantic v2, Pandas, SQLite (`decisionos.db`), Google GenAI SDK (`google-genai`), Pytest.
* **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons.
* **Storage**: Local SQLite database with clean relational tables and JSON serialization for audit ledgers.

---

## 5. Quickstart Guide (Run Locally)

### Prerequisites
* Python 3.10+ (Tested on Python 3.13)
* Node.js 18+ and npm

### One-Click Startup (Windows)
Double-click `start.bat` or run:
```powershell
.\start.bat
```

### Manual Startup

#### 1. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python -m app.seed_data    # Generates 6 realistic CSV datasets
python -m app.database     # Initializes SQLite database and tables
python run.py              # Starts FastAPI on http://127.0.0.1:8000
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev                # Starts Vite on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 6. Running Automated Tests

DecisionOS includes a comprehensive test suite testing real business logic (not just HTTP status codes):
```bash
cd backend
python -m pytest tests/test_decisionos.py -v
```

### Measured Test Suite Coverage
1. `test_01_api_health`: Verifies system status, database connection, and customer record counts.
2. `test_02_customer_metric_calculations`: Verifies order frequency decline %, ticket counts, and inactivity calculations.
3. `test_03_priority_scoring_reproducibility`: Proves sum of components matches final score with zero delta.
4. `test_04_evidence_retrieval_and_traceability`: Verifies citations map directly to database primary keys.
5. `test_05_conflict_detection_case`: Verifies Solaria Networks (CUST-1042) triggers conflict flags.
6. `test_06_missing_data_withholding_case`: Verifies Veritas Cloud (CUST-1099) decision is withheld.
7. `test_07_unsupported_domain_query`: Verifies external domain question rejection.
8. `test_08_what_if_scenario_simulation`: Verifies recoverable value, cost, and net impact calculations.
9. `test_09_decision_ledger_creation_and_human_approval`: Verifies persistent ledger lifecycle.
10. `test_10_data_quality_profiling`: Verifies live conflict, duplicate, and missing cell detection.

---

## 7. Interactive UI Walkthrough

1. **Overview Screen**: Live portfolio metrics, potential revenue exposure, decision distribution, and recent ledger entries.
2. **Decision Workspace**: Enter strategic questions or select presets; inspect ranked candidate accounts.
3. **Decision Detail**: The flagship screen. Visual decision lineage, why vs why not comparison, calculation breakdown, source citations, and human approval controls.
4. **Evidence Viewer**: Filter and view raw table rows across all 6 datasets.
5. **What-If Simulator**: Interactive levers for account count, intervention cost, and win-back rate.
6. **Evaluation Lab**: Run the empirical test suite directly from the UI and observe live Pass/Fail badges with latency metrics.
7. **Data Quality**: Real-time schema diagnostics displaying null rates, duplicates, and active conflict discrepancies.

---

## 8. API Reference Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health status and connected database check |
| `GET` | `/api/dashboard` | Live portfolio summary and recent decisions |
| `GET` | `/api/decisions` | All persistent Decision Ledger records |
| `GET` | `/api/decisions/{id}` | Full lineage detail for a specific decision |
| `POST` | `/api/decisions/query` | Submits business question to decision engine |
| `POST` | `/api/decisions/{id}/approve` | Human approval of recommendation |
| `POST` | `/api/decisions/{id}/reject` | Human rejection of recommendation |
| `POST` | `/api/decisions/{id}/review` | Request escalation review |
| `GET` | `/api/evidence/{customer_id}` | Traceable evidence points for an account |
| `GET` | `/api/evidence/raw/records` | Raw CSV/SQLite table inspection |
| `POST` | `/api/simulate` | Deterministic what-if scenario modeling |
| `GET` | `/api/evaluation` | Latest empirical evaluation suite metrics |
| `POST` | `/api/evaluation/run` | Triggers execution of live evaluation suite |
| `GET` | `/api/data-quality` | Live schema and data hygiene report |
| `POST` | `/api/demo/run` | One-click full demonstration workflow |
| `POST` | `/api/demo/reliability-test` | Triggers deliberate failure case verification |
