import React from 'react';
import { ArrowRight, CircleAlert, Clock3, DollarSign, ShieldCheck, Sparkles } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface AttentionOverviewPageProps {
  dashboardData: any;
  isLoading: boolean;
  onStartDecision: () => void;
  onSelectDecision: (id: string) => void;
}

export const AttentionOverviewPage: React.FC<AttentionOverviewPageProps> = ({
  dashboardData,
  isLoading,
  onStartDecision,
  onSelectDecision
}) => {
  const kpis = dashboardData?.kpis || {};
  const summary = dashboardData?.summary || {};
  const recent = dashboardData?.recent_decisions || [];
  const exposure = kpis.potential_exposure_value ?? summary.total_at_risk_exposure ?? 0;
  const attentionCount = kpis.decisions_needing_attention ?? summary.decisions_needing_attention ?? 0;
  const pendingCount = kpis.pending_approvals ?? summary.pending_approvals ?? 0;
  const reviewCount = kpis.review_required_count ?? summary.review_required_decisions ?? 0;
  const priorityDecisions = recent.filter((item: any) =>
    item.approval_status === 'AWAITING HUMAN APPROVAL'
    || item.approval_status === 'REVIEW_REQUESTED'
    || item.verification_status === 'REVIEW REQUIRED'
    || item.verification_status === 'DECISION WITHHELD'
  ).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-9 pb-16 pt-8">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Sparkles className="h-4 w-4" />DecisionOS</div>
          <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Evidence-backed decisions for business teams.</h1>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            Recommendations stay advisory until a person reviews the evidence and decides.
          </p>
        </div>
        <button type="button" onClick={onStartDecision} className="decisionos-primary-button inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-all">
          Start a decision <ArrowRight className="h-4 w-4" />
        </button>
      </header>

      <section aria-label="Attention summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="decisionos-surface flex items-center gap-4 border p-5">
          <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div><p className="text-2xl font-semibold tabular-nums text-slate-950">{isLoading ? '—' : attentionCount}</p><p className="text-xs text-slate-600">Decisions needing attention</p></div>
        </div>
        <div className="decisionos-surface flex items-center gap-4 border p-5">
          <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
          <div><p className="text-2xl font-semibold tabular-nums text-slate-950">{isLoading ? '—' : pendingCount}</p><p className="text-xs text-slate-600">Pending human approvals · {reviewCount} require review</p></div>
        </div>
        <div className="decisionos-surface flex items-center gap-4 border p-5">
          <DollarSign className="h-5 w-5 shrink-0 text-emerald-700" />
          <div><p className="text-2xl font-semibold tabular-nums text-slate-950">{isLoading ? '—' : `$${(exposure / 1000).toFixed(0)}k`}</p><p className="text-xs text-slate-600">Overall at-risk exposure</p></div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">What needs your attention?</h2>
            <p className="mt-1 text-sm text-slate-600">A short list of decisions ready for a human next step.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
        </div>
        {priorityDecisions.length === 0 ? (
          <div className="decisionos-surface border p-6 text-sm text-slate-600">
            {isLoading ? 'Loading decisions…' : 'No pending decisions. Start a new analysis when you are ready.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {priorityDecisions.map((item: any) => (
              <article key={item.decision_id} className="decisionos-surface flex flex-col gap-5 border p-5 transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">{item.target_entity_name || item.target_entity_id}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Retention decision</span>
                    <StatusBadge status={item.priority_level || (item.verification_status === 'REVIEW REQUIRED' ? 'HIGH' : item.verification_status)} size="sm" />
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">{item.reasoning_summary || item.recommendation}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />Evidence</span>
                    <StatusBadge status={item.verification_status} size="sm" />
                    {item.target_entity_id && <span>{item.target_entity_id}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => onSelectDecision(item.decision_id)} className="decisionos-secondary-button inline-flex shrink-0 items-center justify-center gap-2 border px-4 py-2.5 text-sm font-semibold">
                  Review decision <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-base font-semibold text-slate-950">Ready to investigate?</p>
          <p className="mt-1 text-sm text-slate-600">Start with one business question. Evidence and next steps follow.</p>
        </div>
        <button type="button" onClick={onStartDecision} className="decisionos-primary-button inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all">
          Open Decision Workspace <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
};
