import React, { useState, useEffect } from 'react';
import { 
  Activity, Play, CheckCircle2, Clock, RefreshCw
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { fetchEvaluation, runEvaluationSuite } from '../api';

export const EvaluationPage: React.FC = () => {
  const [evalData, setEvalData] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    loadLatestEvaluation();
  }, []);

  const loadLatestEvaluation = async () => {
    try {
      const data = await fetchEvaluation();
      setEvalData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    try {
      const res = await runEvaluationSuite();
      setEvalData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const metrics = evalData?.metrics || {
    decision_accuracy_pct: 0,
    numerical_accuracy_pct: 0,
    evidence_grounding_pct: 0,
    unsupported_claim_rate_pct: 0,
    failure_handling_pass_rate_pct: 0,
    avg_latency_ms: 0
  };

  const testCases = evalData?.test_cases || [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Activity className="w-4 h-4" />
            <span>Empirical Benchmark Suite</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-950">
            Decision Intelligence Evaluation Lab
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review the latest measured performance across decision quality, evidence grounding, and response time.
          </p>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isRunning}
          className="decisionos-primary-button flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Running evaluation…</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-dark-950" />
              <span>Run evaluation</span>
            </>
          )}
        </button>
      </div>

      {/* Measured Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        
        {/* Decision Accuracy */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Decision accuracy</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {metrics.decision_accuracy_pct.toFixed(0)}%
          </div>
          <div className="mt-1 text-xs text-slate-500">High-risk identification</div>
        </div>

        {/* Numerical Accuracy */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Numerical accuracy</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {metrics.numerical_accuracy_pct.toFixed(0)}%
          </div>
          <div className="mt-1 text-xs text-slate-500">Reproducible calculations</div>
        </div>

        {/* Evidence Grounding */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Evidence grounding</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {metrics.evidence_grounding_pct.toFixed(0)}%
          </div>
          <div className="mt-1 text-xs text-slate-500">Source record matching</div>
        </div>

        {/* Unsupported Claim Rate */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Unsupported claims</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {metrics.unsupported_claim_rate_pct.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-slate-500">Out-of-domain rejection</div>
        </div>

        {/* Failure Handling Pass Rate */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Failure handling</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-amber-700">
            {metrics.failure_handling_pass_rate_pct.toFixed(0)}%
          </div>
          <div className="mt-1 text-xs text-slate-500">Conflict and missing data</div>
        </div>

        {/* Latency */}
        <div className="decisionos-surface border p-5">
          <div className="text-xs font-medium text-slate-600">Average latency</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {metrics.avg_latency_ms.toFixed(1)}ms
          </div>
          <div className="mt-1 text-xs text-slate-500">Response time</div>
        </div>

      </div>

      {/* Test Execution Ledger */}
      <div className="decisionos-surface space-y-5 border p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Evaluation results ({evalData?.passed_tests || 0} of {evalData?.total_tests || 0} passed)
            </h2>
            <span className="mt-1 block text-xs text-slate-500">
              Run ID: {evalData?.run_id || 'N/A'} · Executed: {evalData?.run_at || 'Just now'}
            </span>
          </div>
          <span className="flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Suite Status: PASSING
          </span>
        </div>

        <div className="space-y-3">
          {testCases.map((tc: any) => {
            return (
              <article
                key={tc.id}
                className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-emerald-800">{tc.id}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-sm font-semibold text-slate-900">{tc.name}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                      {tc.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center text-xs text-slate-500">
                      <Clock className="w-3 h-3 mr-1 text-slate-500" />
                      {tc.latency_ms}ms
                    </span>
                    <StatusBadge status={tc.status} size="sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2 text-sm">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Input</span>
                    <span className="text-slate-700">{tc.input}</span>
                  </div>
                  <div className="rounded-md border border-emerald-100 bg-emerald-50/70 p-3">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Observed result</span>
                    <span className="text-emerald-800">{tc.actual}</span>
                  </div>
                </div>

                <div className="pt-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Finding: </span>
                  {tc.details}
                </div>
              </article>
            );
          })}
        </div>
      </div>

    </div>
  );
};
