import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, CircleCheck, CircleX, FileSearch, HelpCircle, ShieldCheck, X } from 'lucide-react';
import { approveDecision, rejectDecision, requestDecisionReview } from '../api';
import { EvidenceCard } from '../components/EvidenceCard';
import { LineageGraph } from '../components/LineageGraph';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { StatusBadge } from '../components/StatusBadge';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { WhatIfPage } from './WhatIfPage';

interface GuidedDecisionPageProps {
  decision: any;
  onBack: () => void;
  onDecisionUpdated: (decision: any) => void;
  onInspectEvidence: (dataset: string, recordId: string) => void;
}

export const GuidedDecisionPage: React.FC<GuidedDecisionPageProps> = ({
  decision,
  onBack,
  onDecisionUpdated,
  onInspectEvidence
}) => {
  const [verificationRevealed, setVerificationRevealed] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [simulationRecord, setSimulationRecord] = useState<any>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [auditRevealed, setAuditRevealed] = useState(false);
  const [expandedConflict, setExpandedConflict] = useState(false);

  if (!decision) {
    return <div className="py-16 text-center text-sm text-slate-400">No decision selected.</div>;
  }

  const evidence = Array.isArray(decision.evidence) ? decision.evidence : decision.evidence_items || [];
  const calculations = decision.calculations?.components || (Array.isArray(decision.calculations) ? decision.calculations : []);
  const audit = Array.isArray(decision.audit_trail) ? decision.audit_trail : [];
  const conflicts = Array.isArray(decision.conflicts) ? decision.conflicts : [];
  const withheld = decision.verification_status === 'DECISION WITHHELD';
  const reviewRequired = decision.verification_status === 'REVIEW REQUIRED';
  const verified = decision.verification_status === 'VERIFIED';
  const resolved = ['APPROVED', 'REJECTED', 'REVIEW_REQUESTED'].includes(decision.approval_status);
  const currentStep = resolved || simulationComplete ? 6 : showSimulator ? 5 : verificationRevealed ? 4 : 3;
  const checks = [
    { label: 'Evidence sources linked', passed: evidence.length > 0 },
    { label: 'Calculations reproduced', passed: decision.calculations?.reproducible === true },
    { label: 'Source records verified', passed: evidence.length > 0 && evidence.every((item: any) => item.verified === true) },
    { label: 'No unsupported claims', passed: verified && !reviewRequired && !withheld },
    { label: 'Integrity checks passed', passed: verified }
  ];
  const decisionName = decision.target_entity_name || decision.target_entity_id || 'Selected customer';
  const whyNot = Array.isArray(decision.why_not_selected)
    ? decision.why_not_selected
    : decision.why_not_selected && typeof decision.why_not_selected === 'object'
      ? Object.entries(decision.why_not_selected).map(([name, reason]) => ({ company_name: name, reason_not_selected: reason }))
      : [];

  const takeAction = async (action: 'approve' | 'reject' | 'review') => {
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
      setAuditRevealed(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The decision could not be recorded. Please try again.');
    } finally {
      setActionPending(false);
    }
  };

  const openSource = (item: any) => {
    onInspectEvidence(item.source_dataset || item.dataset || item.table || 'customers.csv', item.record_id || item.id || '');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-16 pt-4">
      <WorkflowProgress currentStep={currentStep} />

      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Results</button>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Decision {decision.decision_id}</p>
          <h1 className="text-2xl font-semibold text-white">{decisionName}</h1>
          <div className="flex flex-wrap gap-2"><StatusBadge status={decision.verification_status} size="sm" /><StatusBadge status={decision.approval_status} size="sm" /></div>
        </div>
        <p className="max-w-xs text-xs leading-5 text-slate-500">AI recommends. Evidence verifies. Humans decide.</p>
      </header>

      <section className="space-y-4 border-b border-slate-800 pb-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 3 · Understand</p>
        <div className={`border-l-2 px-5 py-2 ${withheld ? 'border-rose-400' : reviewRequired ? 'border-amber-300' : 'border-gold-400'}`}>
          <p className="text-xs font-mono uppercase tracking-wider text-slate-400">{withheld ? 'Decision withheld' : reviewRequired ? 'Review required' : 'Recommendation'}</p>
          <h2 className="mt-2 max-w-3xl text-xl font-medium leading-8 text-white">{decision.recommendation || 'No recommendation is available for this decision.'}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{decision.reasoning_summary || 'The decision engine did not return a reasoning summary.'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Priority <strong className="ml-1 font-mono text-white">{decision.priority_score > 0 ? `${Number(decision.priority_score).toFixed(1)} / 100` : 'Withheld'}</strong></span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>Business impact <strong className="ml-1 font-mono text-white">{decision.what_if_preview?.at_risk_acv !== undefined ? `$${Number(decision.what_if_preview.at_risk_acv).toLocaleString()}` : 'See linked evidence'}</strong></span>
          </div>
        </div>

        {withheld && <div className="border border-rose-900/60 bg-rose-950/20 px-4 py-3"><p className="text-sm font-semibold text-rose-200">Decision withheld</p><details className="mt-2"><summary className="cursor-pointer text-xs text-rose-300">Why?</summary><p className="mt-2 text-xs leading-5 text-slate-300">{decision.reasoning_summary || 'Required evidence was unavailable, so DecisionOS withheld its recommendation.'}</p></details><p className="mt-3 text-xs text-slate-400">What can I do? Request a human review or inspect the available source records.</p></div>}

        {reviewRequired && <div className="border border-amber-900/60 bg-amber-950/20 px-4 py-3"><p className="text-sm font-semibold text-amber-200">Review required</p><button type="button" onClick={() => setExpandedConflict((value) => !value)} className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">{expandedConflict ? 'Hide conflict' : 'View conflict'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedConflict ? 'rotate-180' : ''}`} /></button>{expandedConflict && <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-300">{conflicts.map((conflict: any, index: number) => <li key={index}>{typeof conflict === 'string' ? conflict : `${conflict.type}: ${conflict.details}`}</li>)}</ul>}</div>}

        <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Key evidence <span className="ml-1 font-mono text-xs text-slate-500">{evidence.length} sources</span></span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{evidence.length ? evidence.slice(0, 4).map((item: any, index: number) => <EvidenceCard key={item.id || index} item={item} onInspect={openSource} />) : <p className="text-xs text-slate-500">No evidence sources were attached to this decision.</p>}</div>
          {evidence.length > 4 && <p className="mt-3 text-xs text-slate-500">Showing the strongest 4 of {evidence.length} linked sources.</p>}
        </details>

        <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Verified calculation <span className="ml-1 text-xs text-slate-500">Deterministic breakdown</span></span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-4">{calculations.length ? <ScoreBreakdown score={decision.priority_score} priorityLevel={decision.priority_level} components={calculations} formulaExplanation={decision.calculations?.formula_explanation || 'Weighted deterministic priority score.'} /> : <p className="text-xs text-slate-500">No calculation breakdown was returned for this decision.</p>}</div>
        </details>

        <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Why this customer, and not the alternative?</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-4 grid gap-5 md:grid-cols-2"><div><p className="text-[10px] font-mono uppercase tracking-wider text-gold-300">Why {decisionName}</p><p className="mt-2 text-sm leading-6 text-slate-300">{decision.why_selected || decision.reasoning_summary || 'The recommendation is based on the available verified signals.'}</p></div><div><p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Why not the alternative</p>{whyNot.length ? <ul className="mt-2 space-y-3">{whyNot.slice(0, 4).map((item: any, index: number) => <li key={item.customer_id || index} className="text-sm text-slate-300"><strong>{item.company_name || item.customer_id}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{item.reason_not_selected || item.reason || 'Lower relative priority based on the available signals.'}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No alternative comparison was returned.</p>}</div></div>
        </details>

        <details className="group py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span className="inline-flex items-center gap-2"><FileSearch className="h-4 w-4 text-slate-500" />Source records <span className="text-xs text-slate-500">Open exact records</span></span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <ul className="mt-3 divide-y divide-slate-800 border-y border-slate-800">{evidence.map((item: any, index: number) => <li key={item.id || index} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate text-xs text-slate-400">{item.source_dataset || item.dataset || item.table || 'Source record'} · {item.record_id || item.id}</span><button type="button" onClick={() => openSource(item)} className="shrink-0 text-xs text-gold-300 hover:text-gold-200">Inspect source</button></li>)}</ul>
        </details>

        <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Decision lineage</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-4"><LineageGraph decisionId={decision.decision_id} targetName={decisionName} score={decision.priority_score || 0} evidenceCount={evidence.length} primaryDataset={evidence[0]?.source_dataset || evidence[0]?.dataset || 'customers.csv'} /></div>
        </details>

        {decision.simulated_action && <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Proposed action payload</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <p className="mt-3 border-l-2 border-slate-700 pl-3 font-mono text-xs leading-5 text-slate-400">{decision.simulated_action}</p>
        </details>}

        {decision.what_if_preview && <details className="group border-b border-slate-800 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>Decision impact preview</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(decision.what_if_preview).map(([label, value]) => <div key={label} className="border-l border-slate-800 pl-3"><dt className="text-[10px] font-mono uppercase tracking-wide text-slate-500">{label.replaceAll('_', ' ')}</dt><dd className="mt-1 text-sm text-slate-200">{typeof value === 'number' ? `$${value.toLocaleString()}` : String(value)}</dd></div>)}</dl>
        </details>}

        {!verificationRevealed && <button type="button" onClick={() => setVerificationRevealed(true)} className="inline-flex items-center gap-2 bg-gold-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-gold-400"><ShieldCheck className="h-4 w-4" /> Verify Decision</button>}
      </section>

      {verificationRevealed && (
        <section className="space-y-4 border-b border-slate-800 pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 4 · Verify</p>
          <div className={`flex items-start gap-3 border-l-2 px-4 py-3 ${verified ? 'border-emerald-400 bg-emerald-950/20' : 'border-amber-300 bg-amber-950/20'}`}>
            {verified ? <CircleCheck className="mt-0.5 h-5 w-5 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />}
            <div><h2 className="text-base font-semibold text-white">{verified ? 'Decision verified' : withheld ? 'Decision withheld' : 'Review required before approval'}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{verified ? 'Verification uses the evidence and calculation results returned by the decision engine.' : 'The verification result does not support approval. Inspect the flagged information or request review.'}</p></div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">{checks.map((check) => <li key={check.label} className="flex items-center gap-2 text-xs"><span className={check.passed ? 'text-emerald-300' : 'text-amber-300'}>{check.passed ? <Check className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}</span><span className={check.passed ? 'text-slate-300' : 'text-slate-500'}>{check.label}</span></li>)}</ul>
          {decision.verification_details && <details className="group border-y border-slate-800 py-3"><summary className="flex cursor-pointer list-none items-center justify-between text-xs text-slate-400">Verification details<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(decision.verification_details).map(([label, value]) => <div key={label} className="text-xs"><dt className="text-slate-500">{label.replaceAll('_', ' ')}</dt><dd className="mt-1 text-slate-300">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details>}
          {verified && !showSimulator && !simulationComplete && <button type="button" onClick={() => setShowSimulator(true)} className="inline-flex items-center gap-2 border border-slate-700 px-4 py-2.5 text-sm font-medium text-white hover:border-gold-400">Explore What-If <ArrowRight className="h-4 w-4" /></button>}
          {verified && !showSimulator && !simulationComplete && <button type="button" onClick={() => setSimulationComplete(true)} className="ml-3 text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300">Skip simulation and continue</button>}
        </section>
      )}

      {showSimulator && (
        <section className="space-y-4 border-b border-slate-800 pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 5 · Explore impact</p>
          <WhatIfPage embedded onContinue={(result) => { setSimulationRecord(result); setSimulationComplete(true); setShowSimulator(false); }} />
          <button type="button" onClick={() => { setSimulationComplete(true); setShowSimulator(false); }} className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300">Continue without a scenario</button>
        </section>
      )}

      {verificationRevealed && !showSimulator && ((verified && simulationComplete) || (!verified && (withheld || reviewRequired))) && (
        <section className="space-y-4 border-b border-slate-800 pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Step 6 · Human decision</p>
          <h2 className="text-lg font-semibold text-white">The recommendation is yours to decide</h2>
          <p className="text-sm text-slate-400">DecisionOS will not approve or reject on your behalf.</p>
          {actionError && <p role="alert" className="border-l-2 border-rose-400 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{actionError}</p>}
          {resolved ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300"><Check className="h-4 w-4" />Human decision recorded: {decision.approval_status.replaceAll('_', ' ')}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => takeAction('approve')} disabled={actionPending || !verified} className="inline-flex items-center gap-2 bg-gold-500 px-4 py-3 text-sm font-semibold text-dark-950 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" />Approve</button>
              <button type="button" onClick={() => takeAction('reject')} disabled={actionPending} className="inline-flex items-center gap-2 border border-rose-900 px-4 py-3 text-sm font-medium text-rose-200 hover:border-rose-600 disabled:opacity-50"><X className="h-4 w-4" />Reject</button>
              <button type="button" onClick={() => takeAction('review')} disabled={actionPending} className="inline-flex items-center gap-2 border border-amber-900 px-4 py-3 text-sm font-medium text-amber-200 hover:border-amber-600 disabled:opacity-50"><HelpCircle className="h-4 w-4" />Request review</button>
            </div>
          )}
        </section>
      )}

      {resolved && (
        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400">Decision Ledger · {decision.decision_id}</p>
          <p className="text-sm font-semibold text-white">Human action recorded at {decision.action_executed_at || decision.updated_at || decision.created_at || 'the latest decision update'}.</p>
          <details open={auditRevealed} onToggle={(event) => setAuditRevealed(event.currentTarget.open)} className="group border-y border-slate-800 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-200"><span>View audit trail</span><ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" /></summary>
            <dl className="mt-4 divide-y divide-slate-800">{[
              ['Recommendation', decision.recommendation],
              ['Evidence', `${evidence.length} linked sources`],
              ['Verification', decision.verification_status],
              ['Scenario', simulationRecord
                ? `${simulationRecord.scenarios.scenario_b.scenario_name}; ${simulationRecord.scenarios.scenario_b.accounts_targeted} accounts; ${(simulationRecord.parameters.estimated_recovery_rate * 100).toLocaleString()}% recovery; $${simulationRecord.parameters.intervention_cost_per_account.toLocaleString()} per account; net impact ${simulationRecord.scenarios.scenario_b.net_impact > 0 ? '+' : simulationRecord.scenarios.scenario_b.net_impact < 0 ? '−' : ''}$${Math.abs(simulationRecord.scenarios.scenario_b.net_impact).toLocaleString()}`
                : simulationComplete ? 'Skipped' : 'Not run'],
              ['Human decision', decision.approval_status]
            ].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-2 text-xs"><dt className="text-slate-500">{label}</dt><dd className="text-slate-300">{value}</dd></div>)}
              {audit.map((entry: any, index: number) => <div key={index} className="grid grid-cols-[120px_1fr] gap-3 py-2 text-xs"><dt className="text-slate-500">{entry.timestamp || entry.action}</dt><dd className="text-slate-300">{entry.notes || entry.detail || entry.details || entry.action}</dd></div>)}
            </dl>
          </details>
        </section>
      )}
    </div>
  );
};
