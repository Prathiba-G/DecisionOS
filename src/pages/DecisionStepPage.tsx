import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, HelpCircle, X } from 'lucide-react';
import { approveDecision, callCustomer, fetchCustomerCallReadiness, rejectDecision, requestDecisionReview, type CustomerCallReadiness } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { WorkflowProgress } from '../components/WorkflowProgress';
import type { DecisionStep } from '../routing';

interface DecisionStepPageProps {
  step: Exclude<DecisionStep, 'evidence' | 'simulate'>;
  decision: any;
  simulationRecord: any;
  onNavigate: (path: string) => void;
  onDecisionUpdated: (decision: any) => void;
}

const money = (value: number) => `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const signedMoney = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(value)}`;

export const DecisionStepPage: React.FC<DecisionStepPageProps> = ({
  step,
  decision,
  simulationRecord,
  onNavigate,
  onDecisionUpdated
}) => {
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [callReadiness, setCallReadiness] = useState<CustomerCallReadiness | null>(null);
  const [callReadinessError, setCallReadinessError] = useState<string | null>(null);
  const [callPending, setCallPending] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callPreparationOpen, setCallPreparationOpen] = useState(false);

  useEffect(() => {
    setCallPreparationOpen(false);
    setCallError(null);
  }, [decision?.decision_id, step]);

  useEffect(() => {
    if (step !== 'decide' || !decision?.decision_id || decision.verification_status !== 'VERIFIED') {
      setCallReadiness(null);
      setCallReadinessError(null);
      return;
    }
    let active = true;
    fetchCustomerCallReadiness(decision.decision_id)
      .then((readiness) => {
        if (active) {
          setCallReadiness(readiness);
          setCallReadinessError(null);
        }
      })
      .catch((cause) => {
        if (active) setCallReadinessError(cause instanceof Error ? cause.message : 'Call readiness could not be checked.');
      });
    return () => { active = false; };
  }, [step, decision?.decision_id, decision?.verification_status]);

  useEffect(() => {
    if (!decision?.decision_id || callReadiness?.call_status !== 'queued' || callReadiness.outcome_recorded) return;
    const timer = window.setInterval(() => {
      fetchCustomerCallReadiness(decision.decision_id)
        .then((readiness) => {
          setCallReadiness(readiness);
          setCallReadinessError(null);
        })
        .catch((cause) => {
          setCallReadinessError(cause instanceof Error ? cause.message : 'Call status could not be refreshed.');
        });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [callReadiness?.call_status, callReadiness?.outcome_recorded, decision?.decision_id]);

  if (!decision) return <div className="py-16 text-center text-sm text-slate-400">Loading decision record…</div>;

  const decisionId = encodeURIComponent(decision.decision_id);
  const evidence = Array.isArray(decision.evidence)
    ? decision.evidence
    : Array.isArray(decision.evidence_items) ? decision.evidence_items : [];
  const verifiedEvidence = evidence.filter((item: any) => item?.verified === true);
  const calculations = decision.calculations?.components || [];
  const audit = Array.isArray(decision.audit_trail) ? [...decision.audit_trail] : [];
  const withheld = decision.verification_status === 'DECISION WITHHELD';
  const conflict = decision.verification_status === 'REVIEW REQUIRED';
  const unsupported = decision.approval_status === 'REJECTED_UNSUPPORTED'
    || /not available in the connected datasets|unsupported domain/i.test(`${decision.recommendation || ''} ${decision.reasoning_summary || ''}`);
  const resolved = ['APPROVED', 'REJECTED', 'REVIEW_REQUESTED'].includes(decision.approval_status);
  const name = decision.target_entity_name || decision.target_entity_id || 'Decision';
  const impact = decision.what_if_preview?.at_risk_acv;
  const evidenceRoute = `/decisions/${decisionId}/evidence`;
  const resultsRoute = `/decisions/results?decision_id=${decisionId}`;

  const act = async (action: 'approve' | 'review' | 'reject') => {
    if (actionPending) return;
    setActionPending(true);
    setActionError(null);
    try {
      const note = action === 'approve'
        ? 'Human reviewer approved the recommendation.'
        : action === 'reject'
          ? 'Human reviewer rejected the recommendation.'
          : 'Human reviewer requested additional review.';
      const updated = action === 'approve'
        ? await approveDecision(decision.decision_id, note)
        : action === 'reject'
          ? await rejectDecision(decision.decision_id, note)
          : await requestDecisionReview(decision.decision_id, note);
      onDecisionUpdated(updated);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The decision could not be recorded. Please try again.');
    } finally {
      setActionPending(false);
    }
  };

  const startCustomerCall = async () => {
    const canApproveAndCall = Boolean(callReadiness
      && callReadiness.evidence_verified
      && callReadiness.missing_configuration.length === 0
      && callReadiness.missing_customer_data.length === 0
      && callReadiness.missing_agent_variables.length === 0
      && !(callReadiness.call_status === 'queued' && !callReadiness.outcome_recorded));
    if (callPending || !canApproveAndCall) return;
    setCallPending(true);
    setCallError(null);
    try {
      if (decision.approval_status !== 'APPROVED') {
        const approved = await approveDecision(decision.decision_id, 'Human approved customer outreach and the Sarvam call.');
        onDecisionUpdated(approved);
      }
      const result = await callCustomer(decision.decision_id);
      setCallReadiness((current) => current ? {
        ...current,
        call_status: result.call_status,
        attempt_id: result.attempt_id,
        outcome_recorded: false,
      } : current);
    } catch (cause) {
      setCallError(cause instanceof Error ? cause.message : 'Sarvam could not accept the call request.');
    } finally {
      setCallPending(false);
    }
  };

  const callStatusLabel = callReadiness?.outcome_recorded
    ? 'Outcome recorded'
    : callReadiness?.call_status === 'queued'
      ? 'Call queued'
      : callReadiness?.call_status === 'completed'
        ? 'Call completed'
        : callReadiness?.call_status === 'failed'
          ? 'Call failed'
          : null;

  const sortedAudit = audit.sort((left: any, right: any) => {
    const leftTime = Date.parse(left.timestamp || '');
    const rightTime = Date.parse(right.timestamp || '');
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
    return leftTime - rightTime;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-16 pt-5">
      <WorkflowProgress currentStep={step === 'understand' ? 3 : step === 'decide' ? 6 : 7} />
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => onNavigate(step === 'understand' ? resultsRoute : `/decisions/${decisionId}`)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-950">
            <ArrowLeft className="h-3.5 w-3.5" />{step === 'understand' ? 'Results' : 'Decision detail'}
          </button>
          <p className="text-sm font-medium text-emerald-700">Decision {decision.decision_id}</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">{step === 'understand' ? name : step === 'decide' ? 'Your decision' : 'Decision audit trail'}</h1>
        </div>
        <div className="flex flex-wrap gap-2"><StatusBadge status={decision.verification_status} size="sm" /><StatusBadge status={decision.approval_status} size="sm" /></div>
      </header>

      {step === 'understand' && (
        <section className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-700">Understand · Recommendation</p>
            <h2 className="text-2xl font-semibold text-slate-950">{unsupported ? 'Decision unavailable' : withheld ? 'Decision withheld' : conflict ? 'Review required' : 'Why this matters'}</h2>
            <p className="text-lg font-medium leading-8 text-slate-900">{decision.recommendation || 'No recommendation was returned.'}</p>
            <p className="text-base leading-7 text-slate-600">{decision.reasoning_summary || 'No reason summary was returned.'}</p>
          </div>

          {(withheld || conflict || unsupported) && (
            <div className={`rounded-lg border px-4 py-4 ${conflict ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <CircleAlert className={`h-4 w-4 ${conflict ? 'text-rose-300' : 'text-amber-300'}`} />
                {unsupported ? 'The connected datasets do not support this question.' : conflict ? 'Conflicting evidence needs human review.' : 'There is not enough evidence to support a recommendation.'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{decision.reasoning_summary}</p>
              <button type="button" onClick={() => onNavigate(evidenceRoute)} className="mt-3 text-xs font-medium text-gold-300 hover:text-gold-200">
                {conflict ? 'Inspect conflicting records' : 'View missing evidence'} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="decisionos-surface border p-4"><p className="text-xs text-slate-500">Priority</p><p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{decision.priority_score > 0 ? `${Number(decision.priority_score).toFixed(1)}` : 'Withheld'}</p><p className="text-xs text-slate-500">out of 100</p></div>
            <div className="decisionos-surface border p-4"><p className="text-xs text-slate-500">Business impact</p><p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{impact !== undefined ? money(Number(impact)) : 'Not available'}</p></div>
            <div className="decisionos-surface border p-4"><p className="text-xs text-slate-500">Evidence consulted</p><p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{evidence.length}</p><p className="text-xs text-slate-500">source records</p></div>
            <div className="decisionos-surface border p-4"><p className="text-xs text-slate-500">Verification</p><p className="mt-2"><StatusBadge status={decision.verification_status} size="sm" /></p></div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Why this recommendation?</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{decision.why_selected || decision.reasoning_summary || 'The engine did not return a separate selection rationale.'}</p>
            </div>
            {calculations.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{calculations.slice(0, 4).map((item: any, index: number) => <div key={`${item.component}-${index}`} className="border-l border-gold-800 pl-3"><p className="text-xs font-medium text-slate-200">{item.component}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.explanation}</p></div>)}</div>}
            <details className="border-t border-slate-800 pt-3">
              <summary className="cursor-pointer text-xs text-slate-400">Why not the alternative?</summary>
              <div className="mt-3 space-y-3">{Array.isArray(decision.why_not_selected) ? decision.why_not_selected.slice(0, 4).map((item: any, index: number) => <p key={item.customer_id || index} className="text-xs leading-5 text-slate-400"><strong className="text-slate-200">{item.company_name || item.customer_id}</strong> · {item.reason_not_selected}</p>) : decision.why_not_selected && typeof decision.why_not_selected === 'object' ? Object.entries(decision.why_not_selected).slice(0, 4).map(([label, reason]) => <p key={label} className="text-xs leading-5 text-slate-400"><strong className="text-slate-200">{label}</strong> · {String(reason)}</p>) : <p className="text-xs text-slate-500">No alternative explanation was returned.</p>}</div>
            </details>
          </div>

          <button type="button" onClick={() => onNavigate(evidenceRoute)} className="decisionos-primary-button inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-semibold">
            Verify Evidence <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {step === 'decide' && (
        <section className="mx-auto max-w-3xl space-y-7">
          <div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 6 · Decide</p><h2 className="text-lg font-semibold text-white">Do you approve this recommendation?</h2><p className="text-sm text-slate-400">AI recommends. Evidence verifies. You decide.</p></div>
          <dl className="divide-y divide-slate-800 border-y border-slate-800">{[
            ['Decision', decision.recommendation],
            ['Impact', impact !== undefined ? money(Number(impact)) : 'Not available'],
            ['Evidence', decision.verification_status],
            ['Scenario', simulationRecord ? `${simulationRecord.scenarios.scenario_b.scenario_name} · net impact ${signedMoney(simulationRecord.scenarios.scenario_b.net_impact)}` : 'No scenario run'],
          ].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_1fr] gap-4 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-slate-200">{value}</dd></div>)}</dl>
          {actionError && <p role="alert" className="border-l-2 border-rose-400 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{actionError}</p>}
          {resolved ? <div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-300">Recorded: <StatusBadge status={decision.approval_status} size="sm" /></p><button type="button" onClick={() => onNavigate(`/decisions/${decisionId}/audit`)} className="inline-flex items-center gap-2 text-sm text-gold-300 hover:text-gold-200">View Audit Trail <ArrowRight className="h-4 w-4" /></button></div> : <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => act('approve')} disabled={actionPending || decision.verification_status !== 'VERIFIED'} className="decisionos-primary-button inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" />Approve</button>
            <button type="button" onClick={() => act('review')} disabled={actionPending} className="decisionos-action-review inline-flex min-h-11 items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold disabled:opacity-50"><HelpCircle className="h-4 w-4" />Request Review</button>
            <button type="button" onClick={() => act('reject')} disabled={actionPending} className="decisionos-action-danger inline-flex min-h-11 items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
          </div>}
        </section>
      )}

      {step === 'decide' && decision.verification_status === 'VERIFIED' && (
        <section className="mx-auto max-w-4xl space-y-4" aria-label="Customer outreach">
          <button
            type="button"
            onClick={() => setCallPreparationOpen((open) => !open)}
            aria-expanded={callPreparationOpen}
            className={`decisionos-call-trigger inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all ${callPreparationOpen ? 'decisionos-call-trigger-open' : ''}`}
          >
            {callPreparationOpen ? <><Check className="h-4 w-4" />Call Ready</> : 'Make a Call'}
          </button>

          {callPreparationOpen && (
            <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">Customer</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{decision.customer_name || decision.contact_name || name}</p>
                  <p className="mt-1 text-sm text-slate-600">{decision.target_entity_id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Company</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{decision.company_name || decision.target_entity_name || name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Why contact them</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{decision.reasoning_summary || decision.recommendation}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Verified evidence</p>
                  <p className="mt-1 text-sm font-medium text-emerald-800">Verified · {verifiedEvidence.length} source records</p>
                  {verifiedEvidence.slice(0, 3).map((item: any, index: number) => (
                    <p key={item.id || index} className="mt-1 text-xs leading-5 text-slate-600">
                      <span className="font-medium text-slate-800">{item.dataset || item.source_dataset}</span>
                      {item.value ? ` · ${item.value}` : ''}
                      {item.context ? ` · ${item.context}` : ''}
                    </p>
                  ))}
                  <button type="button" onClick={() => onNavigate(evidenceRoute)} className="mt-1 text-xs font-medium text-emerald-800 underline underline-offset-2">Review source records</button>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">What-If context</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {simulationRecord?.scenarios?.scenario_b
                      ? `${simulationRecord.scenarios.scenario_b.scenario_name} · projected net impact ${signedMoney(simulationRecord.scenarios.scenario_b.net_impact)}`
                      : decision.what_if_preview?.scenario_name || 'No What-If scenario has been run.'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-500">Call objective</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{decision.recommendation || decision.question}</p>
                </div>
              </div>

              {callStatusLabel && <p role="status" className="mt-5 border-t border-slate-200 pt-4 text-sm font-medium text-emerald-800">{callStatusLabel}{callReadiness?.call_outcome ? ` · ${callReadiness.call_outcome.replaceAll('_', ' ')}` : ''}</p>}
              {callReadinessError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{callReadinessError}</p>}
              {callError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{callError}</p>}
              {callReadiness && !callReadinessError && !callReadiness.eligible && (
                <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
                  {callReadiness.configuration_required
                    ? <>Sarvam telephony configuration required: {callReadiness.missing_configuration.join(', ')}.</>
                    : callReadiness.missing_customer_data.length
                      ? <>Call unavailable: {callReadiness.missing_customer_data.join(', ')}.</>
                      : callReadiness.missing_agent_variables.length
                        ? <>Required Sarvam agent variables are unavailable: {callReadiness.missing_agent_variables.join(', ')}.</>
                        : callReadiness.call_status === 'queued'
                          ? 'A call is already queued for this decision.'
                          : null}
                </div>
              )}
              {!callReadiness && !callReadinessError && <p role="status" className="mt-4 text-sm text-slate-500">Checking call readiness…</p>}

              <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
                <button type="button" onClick={() => setCallPreparationOpen(false)} className="decisionos-secondary-button min-h-11 rounded-lg border px-5 py-2.5 text-sm font-semibold">Cancel</button>
                <button type="button" onClick={startCustomerCall} disabled={callPending || !callReadiness?.evidence_verified || Boolean(callReadiness?.missing_configuration.length || callReadiness?.missing_customer_data.length || callReadiness?.missing_agent_variables.length) || (callReadiness?.call_status === 'queued' && !callReadiness.outcome_recorded)} className="decisionos-call-trigger min-h-11 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50">
                  {callPending ? 'Approving & contacting Sarvam…' : 'Approve & Call'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 'audit' && (
        <section className="mx-auto max-w-3xl space-y-6">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 7 · Audit</p><h2 className="mt-2 text-lg font-semibold text-white">Can an auditor reconstruct what happened?</h2></div>
          <ol className="space-y-0 border-l border-slate-700">
            {[
              { title: 'Question asked', detail: decision.question || 'Question unavailable', time: decision.created_at },
              { title: 'Decision generated', detail: decision.recommendation, time: decision.created_at },
              { title: 'Evidence consulted', detail: `${evidence.length} source records linked`, time: null },
              { title: 'Verification result', detail: decision.verification_status, time: null },
              { title: 'What-If scenario', detail: simulationRecord ? `${simulationRecord.scenarios.scenario_b.scenario_name} · ${simulationRecord.scenarios.scenario_b.accounts_targeted} accounts · ${signedMoney(simulationRecord.scenarios.scenario_b.net_impact)} net impact` : 'Not run', time: null },
              { title: 'Human decision', detail: decision.approval_status, time: decision.action_executed_at || null },
              { title: 'Outcome timestamp', detail: decision.action_executed_at || decision.created_at || 'Timestamp unavailable', time: null },
            ].map((event, index) => <li key={event.title} className="relative pb-5 pl-6 last:pb-0"><span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full border ${index < 5 ? 'border-gold-500 bg-dark-950' : 'border-slate-600 bg-dark-950'}`} /><p className="text-xs font-semibold text-slate-200">{event.title}</p><p className="mt-1 text-sm leading-5 text-slate-400">{event.detail}</p>{event.time && <time className="mt-1 block text-[10px] font-mono text-slate-600">{event.time}</time>}</li>)}
          </ol>
          {sortedAudit.length > 0 && <details className="border-y border-slate-800 py-3"><summary className="cursor-pointer text-xs text-slate-400">Timestamped ledger events</summary><ol className="mt-4 space-y-4">{sortedAudit.map((event: any, index: number) => <li key={`${event.timestamp}-${index}`} className="border-l border-slate-700 pl-4"><p className="text-xs font-semibold text-slate-200">{event.action === 'customer_call' ? `Customer call · ${event.call_status || 'submitted'}` : event.event || event.action || 'Ledger event'}</p><p className="mt-1 text-sm leading-5 text-slate-400">{event.action === 'customer_call' ? [event.call_outcome, event.failure_reason, event.interaction_id ? `Interaction ${event.interaction_id}` : null].filter(Boolean).join(' · ') : event.details || event.detail || event.notes || event.status || ''}</p>{event.timestamp && <time className="mt-1 block text-[10px] font-mono text-slate-600">{event.timestamp}</time>}</li>)}</ol></details>}
          <button type="button" onClick={() => onNavigate('/decisions/ask')} className="inline-flex items-center gap-2 border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:border-gold-700"><ArrowLeft className="h-4 w-4" />Back to Decision Workspace</button>
        </section>
      )}
    </div>
  );
};
