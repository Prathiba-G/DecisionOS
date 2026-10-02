import React, { useMemo, useState } from 'react';
import { ArrowRight, LoaderCircle, Search, Sparkles } from 'lucide-react';
import { fetchTopCandidates, submitQuery } from '../api';
import { StatusBadge } from '../components/StatusBadge';
import { WorkflowProgress } from '../components/WorkflowProgress';

const DEFAULT_QUESTION = 'Which customers need attention right now?';

interface DecisionJourneyPageProps {
  stage: 'ask' | 'results';
  resultDecision: any;
  candidates: any[];
  isLoadingResults?: boolean;
  onOpenDecision: (decision: any) => void;
  onAnalysisComplete: (decision: any, candidates: any[]) => void;
  onAskAnother: () => void;
}

export const DecisionJourneyPage: React.FC<DecisionJourneyPageProps> = ({
  stage,
  resultDecision,
  candidates,
  isLoadingResults = false,
  onOpenDecision,
  onAnalysisComplete,
  onAskAnother
}) => {
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [openingCustomer, setOpeningCustomer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [showMore, setShowMore] = useState(false);

  const visibleCandidates = useMemo(() => {
    const matching = candidates.filter((candidate) => {
      const query = search.trim().toLowerCase();
      return !query
        || String(candidate.company_name || '').toLowerCase().includes(query)
        || String(candidate.customer_id || '').toLowerCase().includes(query);
    }).filter((candidate) => priorityFilter === 'ALL' || candidate.priority_level === priorityFilter);
    return showMore ? matching : matching.slice(0, 3);
  }, [candidates, search, priorityFilter, showMore]);
  const unsupported = Boolean(resultDecision && (
    resultDecision.approval_status === 'REJECTED_UNSUPPORTED'
    || /not available in the connected datasets|unsupported domain/i.test(`${resultDecision.recommendation || ''} ${resultDecision.reasoning_summary || ''}`)
  ));

  const analyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const decision = await submitQuery(question.trim());
      const ranked = Array.isArray(decision.top_recommendations) && decision.top_recommendations.length
        ? decision.top_recommendations
        : decision.verification_status === 'DECISION WITHHELD'
          ? []
          : decision.target_entity_id
            ? [{
              customer_id: decision.target_entity_id,
              company_name: decision.target_entity_name,
              acv: decision.what_if_preview?.at_risk_acv,
              priority_score: decision.priority_score,
              priority_level: decision.priority_level,
              verification_status: decision.verification_status
            }]
            : await fetchTopCandidates(15);
      onAnalysisComplete(decision, ranked);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The analysis could not be completed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCandidate = async (candidate: any) => {
    const customerId = String(candidate.customer_id || candidate.target_entity_id || '');
    if (!customerId || openingCustomer) return;
    setOpeningCustomer(customerId);
    setError(null);
    try {
      const decision = resultDecision?.target_entity_id === customerId
        ? resultDecision
        : await submitQuery(`Evaluate ${candidate.company_name || customerId} retention and renewal status.`, customerId);
      onOpenDecision(decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The decision could not be opened. Please try again.');
    } finally {
      setOpeningCustomer(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16 pt-5">
      <WorkflowProgress currentStep={stage === 'results' ? 2 : 1} />

      {stage === 'ask' ? (
        <section className="mx-auto max-w-3xl space-y-7 py-6 sm:py-10">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-700">Ask a business question</p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">What business decision do you want to make?</h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              Start with the decision. DecisionOS will use connected records to surface relevant customers and evidence.
            </p>
          </div>
          <form onSubmit={analyze} className="decisionos-surface space-y-5 border p-5 sm:p-7">
            <label htmlFor="decision-question" className="block text-sm font-medium text-slate-800">Your question</label>
            <textarea
              id="decision-question"
              rows={4}
              value={question}
              onChange={(event) => setQuestion(event.currentTarget.value)}
              placeholder={DEFAULT_QUESTION}
              className="w-full resize-y border border-slate-300 bg-white px-4 py-3 text-base leading-7 text-slate-950 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Try an example</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setQuestion('What should I prioritize this week?')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50">What should I prioritize this week?</button>
                <button type="button" onClick={() => setQuestion('Which customers require retention intervention?')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50">Which customers require retention intervention?</button>
              </div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-500">Analysis is grounded in connected business records.</p>
              <button type="submit" disabled={isAnalyzing || !question.trim()} className="decisionos-primary-button inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-all disabled:cursor-wait disabled:opacity-60">
              {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAnalyzing ? 'Analyzing…' : 'Analyze decision'}
              </button>
            </div>
          </form>
        </section>
      ) : !resultDecision ? (
        <section className="mx-auto max-w-3xl space-y-4 py-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-400">Step 2 · Results</p>
          <h1 className="text-2xl font-semibold text-white">{isLoadingResults ? 'Loading decision results…' : 'No decision results loaded'}</h1>
          {!isLoadingResults && <><p className="text-sm text-slate-400">Run a decision first, or return to the workspace to ask a question.</p><button type="button" onClick={onAskAnother} className="bg-gold-500 px-4 py-2.5 text-sm font-semibold text-dark-950 hover:bg-gold-400">Return to Ask</button></>}
        </section>
      ) : (
        <section className="space-y-6">
          <header className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-400">Step 2 · Results</p>
            <h1 className="text-2xl font-semibold text-white">
              {resultDecision.verification_status === 'DECISION WITHHELD'
                ? unsupported ? 'Decision unavailable' : 'Decision withheld'
                : `${candidates.length} ${candidates.length === 1 ? 'customer' : 'customers'} need attention`}
            </h1>
            <p className="text-sm text-slate-400">{resultDecision.verification_status === 'DECISION WITHHELD' ? unsupported ? 'The connected datasets do not contain evidence for this question.' : 'The available evidence did not support a recommendation.' : 'Ranked from the current decision result. Open one decision to review its reasoning.'}</p>
          </header>

          {candidates.length > 3 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setShowMore((value) => !value)} className="text-left text-xs font-medium text-gold-300 hover:text-gold-200">
                {showMore ? 'Show top three' : `Show all ${candidates.length} candidates`}
              </button>
              {showMore && <div className="flex flex-wrap items-center gap-2">
                <label className="relative block sm:w-56"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Find a customer" className="w-full border border-slate-800 bg-dark-900 py-2 pl-9 pr-3 text-xs text-white" /></label>
                <div role="group" aria-label="Filter by priority" className="flex border border-slate-800 p-0.5 text-[10px] font-mono">
                  {(['ALL', 'HIGH', 'MEDIUM'] as const).map((filter) => <button key={filter} type="button" aria-pressed={priorityFilter === filter} onClick={() => setPriorityFilter(filter)} className={`px-2 py-1 ${priorityFilter === filter ? 'bg-slate-800 text-gold-300' : 'text-slate-500 hover:text-white'}`}>{filter === 'ALL' ? 'All' : filter}</button>)}
                </div>
              </div>}
            </div>
          )}

          {resultDecision.verification_status === 'DECISION WITHHELD' && <div className="flex flex-col gap-3 border-y border-amber-900/50 bg-amber-950/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-200">{unsupported ? 'Decision unavailable' : 'Decision withheld'}</p><p className="mt-1 text-xs leading-5 text-slate-400">{resultDecision.reasoning_summary || 'Required evidence was missing or outside the supported data domain.'}</p></div><button type="button" onClick={() => onOpenDecision(resultDecision)} className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-amber-200 hover:text-white">View Decision <ArrowRight className="h-3.5 w-3.5" /></button></div>}

          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {visibleCandidates.map((candidate: any, index: number) => {
              const customerId = String(candidate.customer_id || candidate.target_entity_id || index);
              const name = candidate.company_name || candidate.target_entity_name || customerId;
              const impact = candidate.acv ?? candidate.contract_value;
              const priority = candidate.priority_level || 'REVIEW REQUIRED';
              const status = candidate.verification_status || candidate.status || 'Verification pending';
              return (
                <article key={customerId} className="decisionos-surface flex flex-col gap-4 border p-5 transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-950">{name}</h2>
                      <StatusBadge status={priority} size="sm" />
                      <span className="text-[11px] text-slate-400">{status}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
                      <span>Priority {Number(candidate.priority_score ?? 0).toFixed(1)}</span>
                      <span>{impact !== undefined && impact !== null ? `$${Number(impact).toLocaleString()} exposure` : 'Exposure unavailable'}</span>
                      {candidate.customer_id && <span className="font-mono text-slate-600">{candidate.customer_id}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => openCandidate(candidate)} disabled={Boolean(openingCustomer)} className="decisionos-secondary-button inline-flex shrink-0 items-center justify-center gap-2 border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                    {openingCustomer === customerId ? 'Opening…' : 'View Decision'} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              );
            })}
            {candidates.length === 0 && resultDecision.verification_status !== 'DECISION WITHHELD' && <p className="py-6 text-sm text-slate-400">No ranked candidates were returned for this question.</p>}
          </div>
          {error && <p role="alert" className="border-l-2 border-rose-400 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button type="button" onClick={onAskAnother} className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 hover:text-slate-300">Ask another question</button>
        </section>
      )}
    </div>
  );
};
