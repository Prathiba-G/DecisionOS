export interface EvidenceItem {
  id: string;
  dataset: string;
  table: string;
  record_id: string;
  field: string;
  value: string;
  context?: string;
  used_for: string;
  verified: boolean;
}

export interface ScoreComponent {
  component: string;
  raw_value: string;
  normalized_value: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface CalculationsBreakdown {
  priority_score: number;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  components: ScoreComponent[];
  formula_explanation: string;
  reproducible: boolean;
}

export interface AuditTrailEntry {
  timestamp: string;
  action: string;
  actor: string;
  notes?: string;
  status?: string;
  detail?: string;
}

export interface RecommendationCandidate {
  customer_id: string;
  company_name: string;
  acv: number;
  priority_score: number;
  priority_level: string;
  verification_status: string;
  inactivity_days: number;
  freq_decline_pct: number;
  unresolved_tickets: number;
}

export interface DecisionRecord {
  decision_id: string;
  created_at: string;
  question: string;
  target_entity_id: string;
  target_entity_name: string;
  recommendation: string;
  priority_score: number;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  verification_status: 'VERIFIED' | 'REVIEW REQUIRED' | 'DECISION WITHHELD';
  evidence: EvidenceItem[];
  evidence_items?: EvidenceItem[];
  calculations: CalculationsBreakdown;
  reasoning_summary: string;
  why_not_selected?: Record<string, string>;
  what_if_preview?: Record<string, any>;
  conflicts?: string[];
  approval_status: 'AWAITING HUMAN APPROVAL' | 'APPROVED' | 'REJECTED' | 'REVIEW_REQUESTED' | 'DECISION_WITHHELD' | 'REJECTED_UNSUPPORTED';
  simulated_action?: string;
  action_executed_at?: string;
  audit_trail: AuditTrailEntry[];
  top_recommendations?: RecommendationCandidate[];
  verification_details?: Record<string, any>;
}

export interface DashboardSummary {
  summary: {
    decisions_needing_attention: number;
    verified_decisions: number;
    review_required_decisions: number;
    withheld_decisions: number;
    pending_approvals: number;
    total_at_risk_exposure: number;
    urgent_evidence_issues: number;
    data_conflict_flags: number;
  };
  high_priority_accounts: {
    customer_id: string;
    company_name: string;
    acv: number;
    priority_score: number;
    priority_level: string;
    inactivity_days: number;
    unresolved_tickets: number;
  }[];
  recent_decisions: {
    decision_id: string;
    created_at: string;
    question: string;
    target_entity_id: string;
    target_entity_name: string;
    recommendation: string;
    priority_score: number;
    priority_level: string;
    verification_status: string;
    approval_status: string;
  }[];
}

export interface ScenarioDefinition {
  scenario_name: string;
  description: string;
  accounts_targeted: number;
  targeted_accounts?: { id: string; name: string; score: number; acv: number }[];
  total_at_risk_acv: number;
  intervention_cost: number;
  gross_recovered_value: number;
  projected_churn_loss: number;
  net_impact: number;
  roi_multiple: number;
  assumptions: string[];
}

export interface SimulationRequest {
  top_n: number;
  intervention_cost_per_account: number;
  recovery_rate: number;
}

export interface SimulationResponse {
  parameters: {
    top_n_requested: number;
    intervention_cost_per_account: number;
    estimated_recovery_rate: number;
    total_portfolio_accounts: number;
    total_portfolio_acv: number;
  };
  scenarios: {
    scenario_a: ScenarioDefinition;
    scenario_b: ScenarioDefinition;
    scenario_c: ScenarioDefinition;
  };
  recommendation: string;
  reproducible: boolean;
}

export interface TestCaseResult {
  test_id: string;
  category: string;
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  latency_ms: number;
  reason: string;
}

export interface EvaluationResponse {
  run_id: string;
  run_at: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  decision_accuracy: number;
  numerical_accuracy: number;
  evidence_grounding: number;
  unsupported_claim_rate: number;
  failure_handling_pass_rate: number;
  avg_latency_ms: number;
  test_results: TestCaseResult[];
}

export interface DatasetQualityReport {
  name: string;
  table: string;
  rows: number;
  null_cells: number;
  null_rate_pct: number;
  null_columns: string[];
  duplicate_rows: number;
  conflicts: number;
  conflict_details: string[];
  stale_records: number;
  anomalies: string[];
  health_score: number;
  status: 'HEALTHY' | 'WARNING' | 'ATTENTION REQUIRED';
}

export interface DataQualityResponse {
  total_datasets: number;
  total_records: number;
  total_quality_issues: number;
  data_freshness_as_of: string;
  datasets: DatasetQualityReport[];
}
