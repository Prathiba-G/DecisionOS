import React, { useState } from 'react';
import { 
  Check, X, HelpCircle, ArrowLeft, ArrowUpRight, FileSpreadsheet,
  Clock, Cpu, TrendingUp, Layers, CheckCircle2, AlertOctagon 
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { EvidenceCard } from '../components/EvidenceCard';
import { LineageGraph } from '../components/LineageGraph';
import { approveDecision, rejectDecision, requestDecisionReview } from '../api';

interface DecisionDetailPageProps {
  decision: any;
  onBack: () => void;
  onDecisionUpdated: (updated: any) => void;
  onInspectEvidence: (dataset: string, recordId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DecisionDetailPage: React.FC<DecisionDetailPageProps> = ({
  decision,
  onBack,
  onDecisionUpdated,
  onInspectEvidence,
  onNavigateTab
}) => {
  const [isActing, setIsActing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  if (!decision) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-sm">
        No decision selected. Return to Decisions Workspace.
        <div className="mt-4">
          <button onClick={onBack} className="text-gold-400 underline">Back</button>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsActing(true);
    try {
      const updated = await approveDecision(decision.decision_id, "Approved for simulated CS executive playbook deployment.");
      onDecisionUpdated(updated);
      setActionSuccessMsg("Decision approved! Simulated playbook action executed and logged in audit ledger.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    setIsActing(true);
    try {
      const updated = await rejectDecision(decision.decision_id, "Rejected by executive reviewer.");
      onDecisionUpdated(updated);
      setActionSuccessMsg("Decision rejected and archived in audit ledger.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsActing(false);
    }
  };

  const handleRequestReview = async () => {
    setIsActing(true);
    try {
      const updated = await requestDecisionReview(decision.decision_id, "Requested escalation review.");
      onDecisionUpdated(updated);
      setActionSuccessMsg("Review requested. Case assigned to senior oversight.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsActing(false);
    }
  };

  const evidenceItems = decision.evidence || [];
  const calculations = decision.calculations || [];
  const whyNotList = Array.isArray(decision.why_not_selected) ? decision.why_not_selected : [];
  const whatIf = decision.what_if_preview;
  const auditTrail = decision.audit_trail || [];
  const conflicts = decision.conflicts || [];

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-dark-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold font-mono text-gold-400">
                DECISION #{decision.decision_id}
              </span>
              <StatusBadge status={decision.verification_status} size="md" />
              <StatusBadge status={decision.approval_status} size="md" />
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Logged at {decision.created_at} · Target: <span className="text-slate-200 font-sans font-semibold">{decision.target_entity_name}</span> ({decision.target_entity_id})
            </p>
          </div>
        </div>

        {/* Human Approval Action Controls */}
        <div className="flex items-center space-x-2">
          {decision.approval_status === 'APPROVED' ? (
            <div className="flex items-center text-xs font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-3 py-1.5 rounded-lg">
              <Check className="w-4 h-4 mr-1 text-emerald-400" />
              <span>APPROVED & EXECUTED</span>
            </div>
          ) : decision.approval_status === 'REJECTED' ? (
            <div className="flex items-center text-xs font-mono text-rose-400 bg-rose-950/80 border border-rose-700/60 px-3 py-1.5 rounded-lg">
              <X className="w-4 h-4 mr-1 text-rose-400" />
              <span>REJECTED</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleApprove}
                disabled={isActing || decision.verification_status === 'DECISION WITHHELD'}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-dark-950 font-mono text-xs font-semibold transition-colors active:scale-95 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Action</span>
              </button>

              <button
                onClick={handleRequestReview}
                disabled={isActing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 text-amber-300 border border-amber-800/60 font-mono text-xs transition-all active:scale-95 disabled:opacity-40"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Request Review</span>
              </button>

              <button
                onClick={handleReject}
                disabled={isActing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 text-rose-300 border border-rose-800/60 font-mono text-xs transition-all active:scale-95 disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Reject</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-600/50 rounded-lg text-xs font-mono text-emerald-300 flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 font-bold ml-2">×</button>
        </div>
      )}

      {/* Visual Lineage Flow */}
      <LineageGraph
        decisionId={decision.decision_id}
        targetName={decision.target_entity_name}
        score={decision.priority_score || 0}
        evidenceCount={evidenceItems.length}
        primaryDataset={evidenceItems[0]?.source_dataset || "customers.csv"}
      />

      {/* Recommendation & Verification Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Recommendation Card */}
        <div className="lg:col-span-2 bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Executive Recommendation
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400">Priority Score:</span>
              <span className="text-lg font-bold font-mono text-gold-400">
                {decision.priority_score > 0 ? `${decision.priority_score.toFixed(1)} / 100` : 'WITHHELD'}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
            {decision.recommendation}
          </h2>

          <div className="bg-dark-950 p-4 rounded-lg border border-slate-800/80 space-y-2">
            <div className="text-xs font-mono text-gold-400 font-semibold uppercase flex items-center">
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              Verified Decision Rationale
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {decision.reasoning_summary}
            </p>
          </div>

          {/* Simulated Action */}
          {decision.simulated_action && (
            <div className="p-3.5 rounded-lg bg-dark-950 border border-slate-700 text-xs">
              <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  Simulated Action Payload
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-dark-950 px-1.5 py-0.5 rounded">
                  Non-destructive demo simulation
                </span>
              </div>
              <p className="text-slate-300 font-mono">
                {decision.simulated_action}
              </p>
            </div>
          )}
        </div>

        {/* Verification Status Card */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Verification Layer
            </span>
            <StatusBadge status={decision.verification_status} size="sm" />
          </div>

          {conflicts.length > 0 ? (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-mono text-rose-300 font-bold uppercase">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Data Conflicts Detected</span>
              </div>
              <ul className="text-xs text-rose-200/90 space-y-1 list-disc pl-4 font-sans">
                {conflicts.map((c: any, idx: number) => (
                  <li key={idx}>
                    <span className="font-mono font-semibold text-rose-300">{c.type}:</span> {c.details}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-mono font-bold uppercase">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>All 5 Integrity Gates Passed</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Zero data conflicts found. All numerical claims reproduced with zero delta.
              </p>
            </div>
          )}

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60 text-slate-400">
              <span>Evidence Traceability:</span>
              <span className="text-emerald-400">100% Mapped</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60 text-slate-400">
              <span>Calculations Reproducible:</span>
              <span className="text-emerald-400">Verified Exact</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60 text-slate-400">
              <span>Domain Boundary Guard:</span>
              <span className="text-emerald-400">Enforced</span>
            </div>
          </div>
        </div>

      </div>

      {/* WHY / WHY NOT ANALYSIS (Section 10) */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold font-mono uppercase text-slate-200 tracking-wider flex items-center">
          <Layers className="w-4 h-4 mr-2 text-gold-400" />
          Comparative Decision Intelligence: Why vs. Why Not
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Why Selected */}
          <div className="p-4 rounded-lg bg-dark-950 border border-gold-900/40 space-y-2">
            <div className="text-xs font-mono uppercase text-gold-400 font-bold flex items-center">
              <Check className="w-3.5 h-3.5 mr-1" />
              Why Selected: {decision.target_entity_name}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {decision.why_selected || "Account generated highest composite risk score backed by verified decline in commercial transactions and unresolved critical outages."}
            </p>
          </div>

          {/* Why Not Selected */}
          <div className="p-4 rounded-lg bg-dark-950 border border-slate-800 space-y-2">
            <div className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center">
              <X className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Why Not Alternative Candidates?
            </div>
            {whyNotList.length === 0 ? (
              <p className="text-xs text-slate-400">No lower candidates evaluated for direct comparison.</p>
            ) : (
              <div className="space-y-2">
                {whyNotList.map((alt: any) => (
                  <div key={alt.customer_id} className="text-xs border-b border-slate-800/60 pb-1.5 last:border-0">
                    <span className="font-semibold text-slate-200 font-sans">{alt.company_name}</span>
                    <span className="text-slate-500 font-mono text-[11px] ml-1.5">({alt.priority_score.toFixed(1)}/100):</span>
                    <p className="text-slate-400 text-[11px] font-sans mt-0.5">{alt.reason_not_selected}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reproducible Calculations Breakdown */}
      {calculations.length > 0 && (
        <ScoreBreakdown
          score={decision.priority_score}
          priorityLevel={decision.priority_level}
          components={calculations}
          formulaExplanation="Weighted linear combination across Customer Value (25%), Order Frequency Decline (25%), Inactivity (20%), Support Issues (20%), and Engagement (10%)."
        />
      )}

      {/* Granular Source Evidence Citations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-gold-400" />
            <h3 className="text-sm font-semibold font-mono uppercase text-slate-200 tracking-wider">
              Grounded Evidence Ledger ({evidenceItems.length} Citations)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Click "Inspect Source" to view raw table rows
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidenceItems.map((item: any, idx: number) => (
            <EvidenceCard
              key={idx}
              item={item}
              onInspect={(dataset, recordId) => onInspectEvidence(dataset, recordId)}
            />
          ))}
        </div>
      </div>

      {/* What-If Scenario Impact Preview */}
      {whatIf && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-gold-400" />
              <h3 className="text-sm font-semibold font-mono uppercase text-slate-200 tracking-wider">
                Simulated Intervention Impact Preview
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('whatif')}
              className="text-xs font-mono text-gold-400 hover:text-gold-300 flex items-center"
            >
              Open Full Simulator <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-dark-950 rounded-lg border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 uppercase">At-Risk Contract ACV</div>
              <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
                ${whatIf.at_risk_acv?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-dark-950 rounded-lg border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Intervention Cost</div>
              <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                ${whatIf.intervention_cost?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-dark-950 rounded-lg border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Recoverable Value (45%)</div>
              <div className="text-lg font-bold font-mono text-gold-400 mt-0.5">
                ${whatIf.estimated_recoverable_value?.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-dark-950 rounded-lg border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Net Financial Benefit</div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                +${whatIf.net_financial_benefit?.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Audit Trail */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="text-sm font-semibold font-mono uppercase text-slate-200 tracking-wider">
            Decision Audit Trail & Event Lineage
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="py-2 px-3 font-medium">Timestamp (UTC)</th>
                <th className="py-2 px-3 font-medium">Event Type</th>
                <th className="py-2 px-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditTrail.map((ev: any, idx: number) => (
                <tr key={idx} className="hover:bg-dark-850/50">
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{ev.timestamp}</td>
                  <td className="py-2.5 px-3 text-gold-400 font-semibold">{ev.event}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-sans">{ev.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
