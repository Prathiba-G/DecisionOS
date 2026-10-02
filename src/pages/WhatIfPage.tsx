import React, { useState } from 'react';
import { ArrowLeft, Loader2, RotateCcw, Sliders, TrendingUp } from 'lucide-react';
import { runSimulation } from '../api';
import { WorkflowProgress } from '../components/WorkflowProgress';
import type { ScenarioDefinition, SimulationResponse } from '../types';

const DEFAULT_TARGET_COUNT = '10';
const DEFAULT_COST_PER_ACCOUNT = '1200';
const DEFAULT_RECOVERY_RATE = '45';

const currency = (value: number) => `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const signedCurrency = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${currency(value)}`;

interface WhatIfPageProps {
  embedded?: boolean;
  onContinue?: (result: SimulationResponse) => void;
  workflowStep?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  initialSimulation?: SimulationResponse | null;
  onResult?: (result: SimulationResponse | null) => void;
}

export const WhatIfPage: React.FC<WhatIfPageProps> = ({ embedded = false, onContinue, workflowStep = false, onBack, onSkip, initialSimulation = null, onResult }) => {
  const [targetCount, setTargetCount] = useState(DEFAULT_TARGET_COUNT);
  const [costPerAccount, setCostPerAccount] = useState(DEFAULT_COST_PER_ACCOUNT);
  const [recoveryRate, setRecoveryRate] = useState(DEFAULT_RECOVERY_RATE);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(initialSimulation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSimulation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    const count = Number(targetCount);
    const cost = Number(costPerAccount);
    const recoveryPercent = Number(recoveryRate);
    if (!targetCount.trim() || !Number.isInteger(count) || count < 1) {
      setError('Enter a whole number of accounts greater than zero.');
      return;
    }
    if (!costPerAccount.trim() || !Number.isFinite(cost) || cost < 0) {
      setError('Enter a valid intervention cost of zero or more per account.');
      return;
    }
    if (!recoveryRate.trim() || !Number.isFinite(recoveryPercent) || recoveryPercent < 0 || recoveryPercent > 100) {
      setError('Enter a recovery rate from 0% to 100%.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await runSimulation({
        top_n: count,
        intervention_cost_per_account: cost,
        recovery_rate: recoveryPercent / 100
      });
      setSimulationData(result);
      onResult?.(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The simulation could not be completed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDefaults = () => {
    setTargetCount(DEFAULT_TARGET_COUNT);
    setCostPerAccount(DEFAULT_COST_PER_ACCOUNT);
    setRecoveryRate(DEFAULT_RECOVERY_RATE);
    setError(null);
  };

  const scenarioEntries: { label: string; scenario: ScenarioDefinition; highlighted: boolean }[] = simulationData
    ? [
      { label: 'BASELINE', scenario: simulationData.scenarios.scenario_a, highlighted: false },
      { label: 'INTERVENTION', scenario: simulationData.scenarios.scenario_b, highlighted: true },
      { label: 'BROAD INTERVENTION', scenario: simulationData.scenarios.scenario_c, highlighted: false }
    ]
    : [];
  const netImpact = simulationData?.scenarios.scenario_b.net_impact;
  const impactTone = netImpact === undefined || netImpact === 0
    ? 'decisionos-result-neutral border-slate-700 bg-slate-800/50 text-slate-200'
    : netImpact > 0
      ? 'decisionos-result-positive border-emerald-700/60 bg-emerald-950/40 text-emerald-200'
      : 'decisionos-result-negative border-rose-700/60 bg-rose-950/40 text-rose-200';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {workflowStep && <WorkflowProgress currentStep={5} />}
      {!embedded && <header>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
          <TrendingUp className="h-4 w-4" />
          <span>What-If Simulator</span>
        </div>
        <h1 className="text-3xl font-semibold text-slate-950">Plan an intervention</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          Compare the current situation with a proposed retention scenario and its projected business impact.
        </p>
      </header>}
      {workflowStep && onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="h-3.5 w-3.5" />Back to Evidence</button>}

      <details open={!simulationData} className="group">
      <summary className="mb-3 cursor-pointer list-none text-sm font-medium text-slate-800 hover:text-emerald-800">
        {simulationData ? 'Edit assumptions' : 'Set assumptions'}
      </summary>
      <form onSubmit={executeSimulation} noValidate className="decisionos-surface space-y-5 border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sliders className="h-4 w-4 text-emerald-700" />
            <span>Scenario assumptions</span>
          </div>
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-950"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="block font-medium text-slate-800">Accounts targeted</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetCount}
              onChange={(event) => setTargetCount(event.currentTarget.value)}
              aria-label="Number of accounts targeted"
              aria-invalid={Boolean(error)}
              disabled={isLoading}
              className="w-full border border-slate-300 bg-white px-3 py-2.5 text-slate-950 disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="block font-medium text-slate-800">Intervention cost per account</span>
            <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 focus-within:outline focus-within:outline-2 focus-within:outline-emerald-600">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min="0"
                step="any"
                value={costPerAccount}
                onChange={(event) => setCostPerAccount(event.currentTarget.value)}
                aria-label="Intervention cost per account"
                aria-invalid={Boolean(error)}
                disabled={isLoading}
                className="w-full border-0 bg-transparent px-2 py-2.5 text-slate-950 outline-none disabled:opacity-60"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm">
            <span className="block font-medium text-slate-800">Expected recovery rate</span>
            <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 focus-within:outline focus-within:outline-2 focus-within:outline-emerald-600">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={recoveryRate}
                onChange={(event) => setRecoveryRate(event.currentTarget.value)}
                aria-label="Expected recovery rate percent"
                aria-invalid={Boolean(error)}
                disabled={isLoading}
                className="w-full border-0 bg-transparent py-2.5 text-slate-950 outline-none disabled:opacity-60"
              />
              <span className="text-slate-500">%</span>
            </div>
          </label>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Defaults match the decision engine: 10 accounts, $1,200 per account, 45% recovery.
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="decisionos-primary-button inline-flex min-h-11 min-w-44 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            {isLoading ? 'Running simulation...' : 'Run Simulation'}
          </button>
        </div>
      </form>
      </details>

      <div role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800' : 'text-slate-600'}`}>
        {error ?? (isLoading
          ? 'Calculating deterministic scenario results...'
          : simulationData
            ? 'Results are returned by the decision engine and reflect the submitted parameters.'
            : 'Set the scenario parameters and run a simulation to see portfolio results.')}
      </div>

      {workflowStep && onSkip && !simulationData && <button type="button" onClick={onSkip} className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">Continue without simulation</button>}

      {simulationData && netImpact !== undefined && (
        <section aria-label="Simulation results" className="space-y-5">
          <div className={`decisionos-result rounded-xl border p-6 sm:p-8 ${impactTone}`}>
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold opacity-80">Projected impact</p>
                <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">
                  {netImpact > 0 ? '+' : netImpact < 0 ? '−' : ''}{currency(netImpact)}
                </p>
                <p className="mt-2 text-sm opacity-80">{simulationData.scenarios.scenario_b.scenario_name}</p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm opacity-80"><span>Current situation <strong>{signedCurrency(simulationData.scenarios.scenario_a.net_impact)}</strong></span><span>Scenario <strong>{signedCurrency(simulationData.scenarios.scenario_b.net_impact)}</strong></span></div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-xs opacity-70">Accounts targeted</p>
                  <p className="mt-1 font-mono font-semibold">{simulationData.scenarios.scenario_b.accounts_targeted}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Recovery rate</p>
                  <p className="mt-1 font-mono font-semibold">{(simulationData.parameters.estimated_recovery_rate * 100).toLocaleString()}%</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Recoverable value</p>
                  <p className="mt-1 font-mono font-semibold">{currency(simulationData.scenarios.scenario_b.gross_recovered_value)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">Intervention cost</p>
                  <p className="mt-1 font-mono font-semibold">{currency(simulationData.scenarios.scenario_b.intervention_cost)}</p>
                </div>
              </div>
            </div>
          </div>

          <details className="group border-t border-slate-800 pt-4">
            <summary className="cursor-pointer list-none text-xs font-medium text-gold-300">
              Scenario comparison · {simulationData.parameters.total_portfolio_accounts} accounts · Baseline {signedCurrency(simulationData.scenarios.scenario_a.net_impact)}
            </summary>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {scenarioEntries.map(({ label, scenario, highlighted }) => (
                <article
                  key={label}
                  className={`border p-4 ${highlighted ? 'border-gold-700/60 bg-gold-950/20' : 'border-slate-800 bg-dark-900'}`}
                >
                  <p className="text-[10px] font-mono font-semibold tracking-widest text-slate-500">{label}</p>
                  <h4 className="mt-2 text-sm font-semibold text-slate-100">{scenario.scenario_name}</h4>
                  <p className="mt-1 min-h-10 text-xs leading-relaxed text-slate-300">{scenario.description}</p>

                  <dl className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>Accounts targeted</dt><dd className="font-mono text-slate-100">{scenario.accounts_targeted}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>At-risk value</dt><dd className="font-mono text-slate-100">{currency(scenario.total_at_risk_acv)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>Recoverable value</dt><dd className="font-mono text-slate-100">{currency(scenario.gross_recovered_value)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>Intervention cost</dt><dd className="font-mono text-slate-100">{currency(scenario.intervention_cost)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>Projected churn loss</dt><dd className="font-mono text-slate-100">{currency(scenario.projected_churn_loss)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-slate-800 pt-2 font-semibold">
                      <dt className="text-slate-300">Net impact</dt>
                      <dd className={`font-mono ${scenario.net_impact > 0 ? 'text-emerald-300' : scenario.net_impact < 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                        {scenario.net_impact > 0 ? '+' : scenario.net_impact < 0 ? '−' : ''}{currency(scenario.net_impact)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 text-slate-300">
                      <dt>ROI</dt><dd className="font-mono text-slate-100">{scenario.roi_multiple.toLocaleString()}x</dd>
                    </div>
                  </dl>

                  {scenario.assumptions.length > 0 && (
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <p className="text-[10px] font-mono uppercase tracking-wide text-slate-500">Decision engine assumptions</p>
                      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
                        {scenario.assumptions.map((assumption, index) => <li key={`${label}-${index}`}>• {assumption}</li>)}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={() => { setSimulationData(null); onResult?.(null); setError(null); }} className="text-xs font-medium text-slate-300 underline decoration-slate-800 underline-offset-4 hover:text-white">
              Try another scenario
            </button>
            {onContinue && <button type="button" onClick={() => simulationData && onContinue(simulationData)} className="decisionos-primary-button inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-semibold">Continue to Decision</button>}
          </div>
        </section>
      )}
    </div>
  );
};