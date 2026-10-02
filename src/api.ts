import type { ScenarioDefinition, SimulationRequest, SimulationResponse } from './types';

const API_BASE = '/api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScenarioDefinition(value: unknown): value is ScenarioDefinition {
  return isRecord(value)
    && typeof value.scenario_name === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.accounts_targeted)
    && isFiniteNumber(value.total_at_risk_acv)
    && isFiniteNumber(value.intervention_cost)
    && isFiniteNumber(value.gross_recovered_value)
    && isFiniteNumber(value.projected_churn_loss)
    && isFiniteNumber(value.net_impact)
    && isFiniteNumber(value.roi_multiple)
    && Array.isArray(value.assumptions)
    && value.assumptions.every((assumption) => typeof assumption === 'string');
}

function isSimulationResponse(value: unknown): value is SimulationResponse {
  if (!isRecord(value) || !isRecord(value.parameters) || !isRecord(value.scenarios)) {
    return false;
  }

  const parameters = value.parameters;
  const scenarios = value.scenarios;
  return isFiniteNumber(parameters.top_n_requested)
    && isFiniteNumber(parameters.intervention_cost_per_account)
    && isFiniteNumber(parameters.estimated_recovery_rate)
    && isFiniteNumber(parameters.total_portfolio_accounts)
    && isFiniteNumber(parameters.total_portfolio_acv)
    && isScenarioDefinition(scenarios.scenario_a)
    && isScenarioDefinition(scenarios.scenario_b)
    && isScenarioDefinition(scenarios.scenario_c)
    && typeof value.recommendation === 'string'
    && typeof value.reproducible === 'boolean';
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json();
}

export async function fetchDecisions(limit = 50) {
  const res = await fetch(`${API_BASE}/decisions?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch decisions');
  return res.json();
}

export async function fetchTopCandidates(limit = 15) {
  const res = await fetch(`${API_BASE}/decisions/candidates/top?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch top candidates');
  return res.json();
}

export async function fetchDecision(decisionId: string) {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}`);
  if (!res.ok) throw new Error(`Decision ${decisionId} not found`);
  return res.json();
}

export async function submitQuery(question: string, targetCustomerId?: string, forceFallback = false) {
  const res = await fetch(`${API_BASE}/decisions/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      target_customer_id: targetCustomerId,
      force_fallback: forceFallback
    })
  });
  if (!res.ok) throw new Error('Failed to submit decision query');
  return res.json();
}

export async function approveDecision(decisionId: string, reviewerNote = '') {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_notes: reviewerNote })
  });
  if (!res.ok) throw new Error('Failed to approve decision');
  return res.json();
}

export async function rejectDecision(decisionId: string, reviewerNote = '') {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_notes: reviewerNote })
  });
  if (!res.ok) throw new Error('Failed to reject decision');
  return res.json();
}

export async function requestDecisionReview(decisionId: string, reviewerNote = '') {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}/request-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_notes: reviewerNote })
  });
  if (!res.ok) throw new Error('Failed to request decision review');
  return res.json();
}

export interface CustomerCallReadiness {
  decision_id: string;
  customer_id: string;
  approval_required: boolean;
  evidence_verified: boolean;
  eligible: boolean;
  configuration_required: boolean;
  missing_configuration: string[];
  missing_customer_data: string[];
  missing_agent_variables: string[];
  call_status: string | null;
  attempt_id: string | null;
  interaction_id: string | null;
  call_outcome: string | null;
  outcome_recorded: boolean;
}

async function getDecisionActionError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  const detail = body && typeof body === 'object' ? (body as Record<string, unknown>).detail : null;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && typeof (detail as Record<string, unknown>).message === 'string') {
    return String((detail as Record<string, unknown>).message);
  }
  return fallback;
}

export async function fetchCustomerCallReadiness(decisionId: string): Promise<CustomerCallReadiness> {
  const res = await fetch(`${API_BASE}/decisions/${encodeURIComponent(decisionId)}/call-readiness`);
  if (!res.ok) throw new Error(await getDecisionActionError(res, 'Unable to check call readiness.'));
  return res.json();
}

export async function callCustomer(decisionId: string) {
  const res = await fetch(`${API_BASE}/decisions/${encodeURIComponent(decisionId)}/call`, { method: 'POST' });
  if (!res.ok) throw new Error(await getDecisionActionError(res, 'Sarvam could not accept the call request.'));
  return res.json() as Promise<{
    decision_id: string;
    customer_id: string;
    call_status: 'queued';
    attempt_id: string;
    message: string;
  }>;
}

export async function fetchEvidence(customerId: string) {
  const res = await fetch(`${API_BASE}/evidence/${customerId}`);
  if (!res.ok) throw new Error(`Failed to fetch evidence for ${customerId}`);
  return res.json();
}

const normalizeEvidenceParam = (value: string | null | undefined): string | undefined => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return undefined;
  }
  return trimmed;
};

export async function fetchRawRecords(dataset: string, recordId?: string, signal?: AbortSignal) {
  const safeDataset = normalizeEvidenceParam(dataset) ?? 'customers.csv';
  const rawFilter = normalizeEvidenceParam(recordId);

  const params = new URLSearchParams({ dataset: safeDataset });
  if (rawFilter) {
    const trimmed = rawFilter.trim();
    const matchesFilterExpression = /^(?:aggregate\s*\(|[A-Za-z_][A-Za-z0-9_]*\s*=)/i.test(trimmed);
    params.set('record_id', matchesFilterExpression ? trimmed : `customer_id=${trimmed}`);
  }

  const res = await fetch(`${API_BASE}/evidence/raw/records?${params.toString()}`, { signal });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = body && typeof body === 'object' && typeof (body as Record<string, unknown>).detail === 'string'
      ? (body as Record<string, unknown>).detail
      : `Failed to fetch raw records for ${safeDataset}`;
    throw new Error(String(detail));
  }

  if (Array.isArray(body)) {
    return { dataset: safeDataset, operation: 'raw', filter: rawFilter ? { operation: 'filter', field: 'record_id', value: rawFilter } : null, count: body.length, records: body };
  }

  if (body && typeof body === 'object') {
    const payload = body as Record<string, unknown>;
    const records = Array.isArray(payload.records)
      ? payload.records
      : Array.isArray(payload.data)
        ? payload.data
        : [];

    return {
      ...payload,
      dataset: safeDataset,
      count: typeof payload.count === 'number' ? payload.count : records.length,
      records,
      filter: rawFilter ? { operation: 'filter', field: 'record_id', value: rawFilter } : (payload.filter ?? null)
    };
  }

  return { dataset: safeDataset, operation: 'raw', filter: rawFilter ? { operation: 'filter', field: 'record_id', value: rawFilter } : null, count: 0, records: [] };
}

export async function runSimulation(params: SimulationRequest): Promise<SimulationResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch {
    throw new Error('Simulation unavailable — check the decision engine connection.');
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (res.status === 422) {
      throw new Error('The simulation rejected the inputs. Check the account count, cost, and recovery rate.');
    }
    if (!res.ok) {
      throw new Error(`The simulation request failed (HTTP ${res.status}). Please try again.`);
    }
    throw new Error('The simulation service returned an empty or unreadable response.');
  }

  if (!res.ok) {
    if (res.status === 422) {
      throw new Error('The simulation rejected the inputs. Check the account count, cost, and recovery rate.');
    }
    throw new Error(`The simulation request failed (HTTP ${res.status}). Please try again.`);
  }
  if (!isSimulationResponse(body)) {
    throw new Error('The simulation service returned an unexpected response. Please try again.');
  }

  return body;
}

export async function fetchEvaluation() {
  const res = await fetch(`${API_BASE}/evaluation`);
  if (!res.ok) throw new Error('Failed to fetch evaluation metrics');
  return res.json();
}

export async function runEvaluationSuite() {
  const res = await fetch(`${API_BASE}/evaluation/run`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to run evaluation test suite');
  return res.json();
}

export async function fetchDataQuality() {
  const res = await fetch(`${API_BASE}/data-quality`);
  if (!res.ok) throw new Error('Failed to fetch data quality diagnostics');
  return res.json();
}

export async function runDemoWorkflow() {
  const res = await fetch(`${API_BASE}/demo/run`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to execute demo workflow');
  return res.json();
}

export async function runReliabilityTest(caseType = 'conflict') {
  const res = await fetch(`${API_BASE}/demo/reliability-test?case_type=${caseType}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to execute reliability test');
  return res.json();
}
