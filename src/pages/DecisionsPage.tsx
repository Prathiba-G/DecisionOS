import React, { useState, useEffect } from 'react';
import { 
  Search, Sparkles, BrainCircuit, ArrowRight
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { fetchTopCandidates, submitQuery } from '../api';

interface DecisionsPageProps {
  onSelectDecision: (id: string) => void;
  onDecisionCreated?: (dec: any) => void;
}

export const DecisionsPage: React.FC<DecisionsPageProps> = ({
  onSelectDecision,
  onDecisionCreated
}) => {
  const [question, setQuestion] = useState("Which customers need attention right now, and why?");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTopCandidates(15);
      setCandidates(data);
    } catch (e) {
      console.error("Failed to load candidates", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (q: string, targetId?: string) => {
    if (!q.trim()) return;
    setIsGenerating(true);
    try {
      const result = await submitQuery(q, targetId);
      if (onDecisionCreated) onDecisionCreated(result);
      // Automatically scroll to or select the decision
      onSelectDecision(result.decision_id);
    } catch (e) {
      console.error("Failed to generate decision", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.company_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.customer_id.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesPriority = selectedFilter === 'ALL' || c.priority_level === selectedFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-8 pb-16">
      
      {/* Question Prompt Bar */}
      <div className="bg-dark-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-gold-400 uppercase tracking-wider mb-1">
            <BrainCircuit className="w-4 h-4" />
            <span>Executive Business Question</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ask DecisionOS
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The AI Agent translates your strategic question into deterministic tool calls, retrieves verified evidence, runs independent verification, and records the auditable recommendation.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(question); }} className="relative flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which customers need attention right now, and why?"
              className="w-full bg-dark-950 border border-slate-700 focus:border-gold-500 rounded-xl py-3.5 pl-4 pr-32 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold-500 font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={isGenerating || !question.trim()}
            className="absolute right-2 top-2 bottom-2 px-5 rounded-lg bg-gold-500 hover:bg-gold-400 text-dark-950 font-mono font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Investigating...' : 'Investigate'}</span>
          </button>
        </form>

        {/* Preset Question Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">Recommended Inquiries:</span>
          <button
            onClick={() => {
              setQuestion("Which customers need attention right now, and why?");
              handleSubmit("Which customers need attention right now, and why?");
            }}
            className="px-2.5 py-1 rounded bg-dark-950 border border-slate-800 hover:border-gold-500/50 text-slate-300 text-xs font-mono transition-colors"
          >
            "Which customers need attention right now, and why?"
          </button>
          <button
            onClick={() => {
              setQuestion("Evaluate Acme Industries (CUST-1001) churn risk.");
              handleSubmit("Evaluate Acme Industries churn risk.", "CUST-1001");
            }}
            className="px-2.5 py-1 rounded bg-dark-950 border border-slate-800 hover:border-gold-500/50 text-slate-300 text-xs font-mono transition-colors"
          >
            "Evaluate Acme Industries (CUST-1001)"
          </button>
          <button
            onClick={() => {
              setQuestion("Evaluate Solaria Networks contract status (CUST-1042).");
              handleSubmit("Evaluate Solaria Networks contract status.", "CUST-1042");
            }}
            className="px-2.5 py-1 rounded bg-dark-950 border border-amber-900/60 hover:border-amber-500 text-amber-300 text-xs font-mono transition-colors"
          >
            "Evaluate Solaria Networks (Conflict Test)"
          </button>
        </div>
      </div>

      {/* Priority Recommendations Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
              Portfolio Account Recommendations
            </h3>
            <p className="text-xs text-slate-400">
              Ranked deterministically by 5-factor priority score. Click any card to investigate full evidence lineage.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search account..."
                className="bg-dark-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 w-44"
              />
            </div>

            <div className="flex rounded-lg bg-dark-900 border border-slate-800 p-0.5 text-xs font-mono">
              <button
                onClick={() => setSelectedFilter('ALL')}
                className={`px-2.5 py-1 rounded ${selectedFilter === 'ALL' ? 'bg-slate-800 text-gold-400' : 'text-slate-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedFilter('HIGH')}
                className={`px-2.5 py-1 rounded ${selectedFilter === 'HIGH' ? 'bg-rose-950 text-rose-300' : 'text-slate-400'}`}
              >
                High Risk
              </button>
            </div>
          </div>
        </div>

        {/* Account Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            Loading deterministic portfolio analytics...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCandidates.map(c => {
              const isUrgent = c.priority_score >= 65;
              return (
                <div
                  key={c.customer_id}
                  onClick={() => handleSubmit(`Evaluate ${c.company_name} retention and renewal status.`, c.customer_id)}
                  className={`bg-dark-900 border ${isUrgent ? 'border-rose-900/40 hover:border-rose-600/60' : 'border-slate-800 hover:border-slate-700'} rounded-xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 space-y-3 relative group`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-100 text-sm group-hover:text-gold-400 transition-colors">
                        {c.company_name}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-500">
                        {c.customer_id} · {c.tier}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-gold-400">
                        {c.priority_score.toFixed(1)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        Priority Score
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={c.priority_level} size="sm" />
                    <span className="text-xs font-mono text-slate-300 bg-dark-950 px-2 py-0.5 rounded border border-slate-800">
                      ${c.acv.toLocaleString()} / yr
                    </span>
                  </div>

                  {/* Core deterministic signals */}
                  <div className="bg-dark-950/70 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Order Trend:</span>
                      <span className={c.freq_decline_pct > 40 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {c.freq_decline_pct > 0 ? `-${c.freq_decline_pct.toFixed(0)}%` : 'Steady'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Escalated Tickets:</span>
                      <span className={c.urgent_tickets > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {c.urgent_tickets} urgent ({c.unresolved_tickets} open)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Inactivity Duration:</span>
                      <span className="text-slate-300">
                        {c.inactivity_days} days
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-500 text-[11px] font-mono">
                      Renewal in {c.renewal_days_remaining ? `${c.renewal_days_remaining}d` : 'N/A'}
                    </span>
                    <span className="text-gold-400 font-mono flex items-center group-hover:translate-x-0.5 transition-transform text-xs">
                      Investigate <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
