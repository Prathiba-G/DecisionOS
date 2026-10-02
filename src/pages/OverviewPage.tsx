import React from 'react';
import { 
  AlertTriangle, ShieldAlert, Clock,
  DollarSign, ArrowRight, CheckCircle2, Sparkles
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface OverviewPageProps {
  dashboardData: any;
  isLoading: boolean;
  onSelectDecision: (id: string) => void;
  onAskQuestion: (q: string, targetId?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  dashboardData,
  isLoading,
  onSelectDecision,
  onAskQuestion,
  onNavigateTab
}) => {
  const kpis = dashboardData?.kpis || {
    decisions_needing_attention: 0,
    verified_count: 0,
    review_required_count: 0,
    withheld_count: 0,
    potential_exposure_value: 0,
    pending_approvals: 0,
    approved_count: 0
  };

  const risk = dashboardData?.portfolio_risk || {
    total_accounts: 0,
    high_risk_accounts: 0,
    medium_risk_accounts: 0,
    low_risk_accounts: 0
  };

  const recent = dashboardData?.recent_decisions || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-dark-900 border border-slate-800 p-8">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-dark-950 border border-gold-900/60 text-gold-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PS-04 · AI Decision Engine for Business Data</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Turn business data into <span className="text-gold-300">decisions you can defend</span>.
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            DecisionOS replaces ungrounded chatbot answers with a deterministic, evidence-backed decision pipeline. 
            Every numerical claim has a source calculation. Every recommendation traces directly to verifiable business records.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onAskQuestion("Which customers need attention right now, and why?")}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-mono text-slate-200 bg-dark-800 hover:bg-dark-750 border border-slate-700 transition-all active:scale-95"
            >
              <span>Ask: "Which customers need attention right now?"</span>
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Decisions Needing Attention */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Needing Attention</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {dashboardData ? kpis.decisions_needing_attention : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pending approval or review</p>
        </div>

        {/* Verified */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Verified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {dashboardData ? kpis.verified_count : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">5/5 integrity gates passed</p>
        </div>

        {/* Review Required */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Review Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {dashboardData ? kpis.review_required_count : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Data discrepancy flagged</p>
        </div>

        {/* Withheld */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Withheld</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {dashboardData ? kpis.withheld_count : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Missing data / Out of scope</p>
        </div>

        {/* Potential At-Risk Exposure */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>At-Risk Revenue</span>
            <DollarSign className="w-4 h-4 text-gold-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white truncate">
            {dashboardData ? `$${(kpis.potential_exposure_value / 1000).toFixed(0)}k` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Contract value of priority accts</p>
        </div>

        {/* Pending Approvals */}
        <div className="bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {dashboardData ? kpis.pending_approvals : '—'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting human sign-off</p>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Left: Portfolio Risk Distribution */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white font-mono uppercase tracking-wide">
              Portfolio Retention Risk Telemetry
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {dashboardData ? risk.total_accounts : '—'} Total Accounts Monitored
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-dark-950 border border-rose-900/30">
              <div className="text-xs font-mono text-rose-400 mb-1">HIGH PRIORITY (Risk &gt; 65)</div>
              <div className="text-3xl font-bold font-mono text-white">{dashboardData ? risk.high_risk_accounts : '—'}</div>
              <div className="text-xs text-slate-400 mt-1">Immediate intervention required</div>
            </div>

            <div className="p-4 rounded-lg bg-dark-950 border border-amber-900/30">
              <div className="text-xs font-mono text-amber-400 mb-1">WATCHLIST (Risk 40-65)</div>
              <div className="text-3xl font-bold font-mono text-white">{dashboardData ? risk.medium_risk_accounts : '—'}</div>
              <div className="text-xs text-slate-400 mt-1">Moderate decline or ticket spikes</div>
            </div>

            <div className="p-4 rounded-lg bg-dark-950 border border-emerald-900/30">
              <div className="text-xs font-mono text-emerald-400 mb-1">HEALTHY (Risk &lt; 40)</div>
              <div className="text-3xl font-bold font-mono text-white">{dashboardData ? risk.low_risk_accounts : '—'}</div>
              <div className="text-xs text-slate-400 mt-1">Expanding spend, active engagement</div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
            <span>Deterministic Analytics Engine v1.0 · Updated live from SQLite tables</span>
            <button
              onClick={() => onNavigateTab('whatif')}
              className="text-gold-400 hover:text-gold-300 font-mono flex items-center"
            >
              Simulate Retention Scenarios <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

      </div>

      {/* Recent Decisions Ledger Table */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white font-mono uppercase tracking-wide">
              Persistent Decision Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditable history of AI recommendations, verification statuses, and human actions.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('decisions')}
            className="text-xs font-mono text-gold-400 hover:text-gold-300 flex items-center"
          >
            Open Decision Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {!dashboardData ? (
          <div role="status" className="text-center py-8 text-slate-500 font-mono text-xs">
            {isLoading ? 'Loading decision history...' : 'Decision history is unavailable until the dashboard API reconnects.'}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-8 text-slate-500 font-mono text-xs">
            No decisions logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3 font-medium">Decision ID</th>
                  <th className="py-2.5 px-3 font-medium">Target Entity</th>
                  <th className="py-2.5 px-3 font-medium">Recommendation</th>
                  <th className="py-2.5 px-3 font-medium">Score</th>
                  <th className="py-2.5 px-3 font-medium">Verification</th>
                  <th className="py-2.5 px-3 font-medium">Human Approval</th>
                  <th className="py-2.5 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recent.map((d: any) => (
                  <tr key={d.decision_id} className="hover:bg-dark-850/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-gold-400">{d.decision_id}</td>
                    <td className="py-3 px-3 font-sans font-medium text-slate-200">
                      {d.target_entity_name}
                      <span className="block text-[11px] text-slate-500 font-mono">{d.target_entity_id}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-300 max-w-xs truncate">
                      {d.recommendation}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      {d.priority_score > 0 ? d.priority_score.toFixed(1) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={d.verification_status} size="sm" />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={d.approval_status} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onSelectDecision(d.decision_id)}
                        className="px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-750 text-gold-400 border border-slate-700 hover:border-gold-500/40 text-xs font-mono transition-all"
                      >
                        Inspect Lineage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
