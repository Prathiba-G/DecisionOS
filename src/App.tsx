import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AttentionOverviewPage } from './pages/AttentionOverviewPage';
import { DecisionJourneyPage } from './pages/DecisionJourneyPage';
import { DecisionStepPage } from './pages/DecisionStepPage';
import { EvidencePage } from './pages/EvidencePage';
import { WhatIfPage } from './pages/WhatIfPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { 
  fetchDashboard, fetchDecision, fetchTopCandidates
} from './api';
import { parseAppLocation, type AppRoute } from './routing';

class WhatIfErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="border border-rose-800/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          The What-If page could not be displayed. Other DecisionOS pages remain available.
        </div>
      );
    }
      return this.props.children;
  }
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => parseAppLocation(window.location.href));
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [currentDecision, setCurrentDecision] = useState<any>(null);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [resultDecision, setResultDecision] = useState<any>(null);
  const [resultCandidates, setResultCandidates] = useState<any[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [simulationRecord, setSimulationRecord] = useState<any>(null);

  // Evidence inspector target fallback
  const evidenceTarget = {
    dataset: 'customers.csv',
    recordId: ''
  };

  useEffect(() => {
    loadDashboard();
    const handlePopState = () => {
      setRoute(parseAppLocation(window.location.href));
      setRouteError(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    setRoute(parseAppLocation(window.location.href));
    setRouteError(null);
  };

  const loadDashboard = async () => {
    setIsDashboardLoading(true);
    try {
      const data = await fetchDashboard();
      setDashboardData(data);
      setDashboardError(null);
    } catch (e) {
      console.error("Dashboard load failed", e);
      setDashboardError(e instanceof Error ? e.message : 'Unknown API error');
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const handleSelectDecision = async (decisionId: string) => {
    try {
      const dec = await fetchDecision(decisionId);
      setCurrentDecision(dec);
      navigateTo(`/decisions/${encodeURIComponent(dec.decision_id)}`);
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : 'The decision could not be loaded.');
    }
  };

  useEffect(() => {
    if (route.page !== 'decision') return;
    let active = true;
    setIsDecisionLoading(true);
    setRouteError(null);
    fetchDecision(route.decisionId)
      .then((decision) => {
        if (!active) return;
        setCurrentDecision(decision);
        try {
          const savedSimulation = window.sessionStorage.getItem(`decisionos:simulation:${route.decisionId}`);
          setSimulationRecord(savedSimulation ? JSON.parse(savedSimulation) : null);
        } catch {
          setSimulationRecord(null);
        }
      })
      .catch((error) => {
        if (active) setRouteError(error instanceof Error ? error.message : 'The decision could not be loaded.');
      })
      .finally(() => {
        if (active) setIsDecisionLoading(false);
      });
    return () => { active = false; };
  }, [route.page === 'decision' ? route.decisionId : null]);

  useEffect(() => {
    if (route.page !== 'workspace' || route.step !== 'results' || !route.decisionId) return;
    if (resultDecision?.decision_id === route.decisionId && resultCandidates.length > 0) return;
    let active = true;
    setIsLoadingResults(true);
    setRouteError(null);
    fetchDecision(route.decisionId)
      .then(async (decision) => {
        if (!active) return;
        let candidates = Array.isArray(decision.top_recommendations) ? decision.top_recommendations : [];
        if (!candidates.length && decision.verification_status !== 'DECISION WITHHELD') {
          candidates = decision.target_entity_id
            ? [{
              customer_id: decision.target_entity_id,
              company_name: decision.target_entity_name,
              acv: decision.what_if_preview?.at_risk_acv,
              priority_score: decision.priority_score,
              priority_level: decision.priority_level,
              verification_status: decision.verification_status
            }]
            : await fetchTopCandidates(15);
        }
        if (active) {
          setResultDecision(decision);
          setResultCandidates(candidates);
        }
      })
      .catch((error) => {
        if (active) setRouteError(error instanceof Error ? error.message : 'Decision results could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoadingResults(false);
      });
    return () => { active = false; };
  }, [route.page === 'workspace' && route.step === 'results' ? route.decisionId : null]);

  const handleAnalysisComplete = (decision: any, candidates: any[]) => {
    setResultDecision(decision);
    setResultCandidates(candidates);
    navigateTo(`/decisions/results?decision_id=${encodeURIComponent(decision.decision_id)}`);
  };

  const handleOpenDecision = (decision: any) => {
    setCurrentDecision(decision);
    navigateTo(`/decisions/${encodeURIComponent(decision.decision_id)}`);
    loadDashboard();
  };

  const saveSimulation = (decisionId: string, result: any) => {
    setSimulationRecord(result);
    try {
      window.sessionStorage.setItem(`decisionos:simulation:${decisionId}`, JSON.stringify(result));
    } catch {
      setRouteError('The scenario result is available for this session but could not be saved for refresh.');
    }
  };

  const clearSimulation = (decisionId: string) => {
    setSimulationRecord(null);
    try {
      window.sessionStorage.removeItem(`decisionos:simulation:${decisionId}`);
    } catch {}
  };

  const currentTab = route.page === 'decision'
    ? route.step === 'evidence' ? 'evidence' : route.step === 'simulate' ? 'whatif' : 'detail'
    : route.page === 'workspace'
      ? 'decisions'
    : route.page === 'whatif'
      ? 'whatif'
      : route.page === 'evidence'
        ? 'evidence'
        : route.page === 'evaluation'
          ? 'evaluation'
          : 'overview';
  const tabPaths: Record<string, string> = {
    overview: '/overview',
    decisions: '/decisions/ask',
    detail: currentDecision?.decision_id ? `/decisions/${encodeURIComponent(currentDecision.decision_id)}` : dashboardData?.recent_decisions?.[0]?.decision_id ? `/decisions/${encodeURIComponent(dashboardData.recent_decisions[0].decision_id)}` : '/decisions/ask',
    evidence: '/evidence',
    whatif: '/what-if',
    evaluation: '/evaluation',
  };

  return (
    <div className="decisionos-app-shell min-h-screen bg-dark-950 text-slate-100 flex flex-col font-sans selection:bg-gold-500/30 selection:text-gold-400">
      
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          navigateTo(tabPaths[tab] || '/overview');
          loadDashboard();
        }}
        decisionDetailPath={route.page === 'decision' ? `/decisions/${encodeURIComponent(route.decisionId)}` : currentDecision?.decision_id || dashboardData?.recent_decisions?.[0]?.decision_id ? tabPaths.detail : undefined}
      />

      {routeError && <div role="alert" className="mx-auto mt-4 flex w-full max-w-7xl items-center justify-between gap-4 border border-rose-800/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"><span>{routeError}</span><button type="button" onClick={() => setRouteError(null)} className="text-slate-400 hover:text-white">Dismiss</button></div>}

      {dashboardError && (
        <div role="alert" className="mx-auto mt-4 flex w-full max-w-7xl items-center justify-between gap-4 border border-rose-800/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          <span>Dashboard data is unavailable: {dashboardError}</span>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={isDashboardLoading}
            className="shrink-0 border border-rose-700 px-3 py-1.5 font-mono text-xs hover:bg-rose-900/60 disabled:opacity-50"
          >
            {isDashboardLoading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {route.page === 'overview' && (
          <AttentionOverviewPage
            dashboardData={dashboardData}
            isLoading={isDashboardLoading}
            onSelectDecision={handleSelectDecision}
            onStartDecision={() => navigateTo('/decisions/ask')}
          />
        )}

        {route.page === 'workspace' && (
          <DecisionJourneyPage
            stage={route.step}
            resultDecision={resultDecision}
            candidates={resultCandidates}
            isLoadingResults={isLoadingResults}
            onAnalysisComplete={handleAnalysisComplete}
            onAskAnother={() => navigateTo('/decisions/ask')}
            onOpenDecision={handleOpenDecision}
          />
        )}

        {route.page === 'decision' && (isDecisionLoading ? <div role="status" className="mx-auto max-w-5xl py-16 text-center text-sm text-slate-400">Loading decision…</div> : route.step === 'evidence' ? (
          <EvidencePage
            initialDataset={route.dataset || evidenceTarget.dataset}
            initialRecordId={route.recordId || evidenceTarget.recordId}
            workflowStep
            decisionName={currentDecision?.target_entity_name}
            customerId={currentDecision?.target_entity_id}
            onBackToDecision={() => navigateTo(`/decisions/${encodeURIComponent(route.decisionId)}`)}
            onContinueToWhatIf={() => navigateTo(`/decisions/${encodeURIComponent(route.decisionId)}/simulate`)}
          />
        ) : route.step === 'simulate' ? (
          <WhatIfErrorBoundary>
            <WhatIfPage
              workflowStep
              initialSimulation={simulationRecord}
              onBack={() => navigateTo(`/decisions/${encodeURIComponent(route.decisionId)}/evidence`)}
              onResult={(result) => {
                if (result) saveSimulation(route.decisionId, result);
                else clearSimulation(route.decisionId);
              }}
              onContinue={(result) => {
                saveSimulation(route.decisionId, result);
                navigateTo(`/decisions/${encodeURIComponent(route.decisionId)}/decide`);
              }}
              onSkip={() => {
                clearSimulation(route.decisionId);
                navigateTo(`/decisions/${encodeURIComponent(route.decisionId)}/decide`);
              }}
            />
          </WhatIfErrorBoundary>
        ) : (
          <DecisionStepPage
            step={route.step === 'understand' ? 'understand' : route.step}
            decision={currentDecision}
            simulationRecord={simulationRecord}
            onNavigate={navigateTo}
            onDecisionUpdated={(updated) => {
              setCurrentDecision((previous: any) => previous
                ? {
                    ...previous,
                    ...updated,
                    approval_status: updated.approval_status ?? previous.approval_status,
                    audit_trail: Array.isArray(updated.audit_trail) ? updated.audit_trail : previous.audit_trail,
                    status: updated.status ?? previous.status,
                    updated_at: updated.updated_at ?? previous.updated_at,
                  }
                : updated);
              loadDashboard();
              navigateTo(updated.approval_status === 'APPROVED'
                ? `/decisions/${encodeURIComponent(route.decisionId)}/decide`
                : `/decisions/${encodeURIComponent(route.decisionId)}/audit`);
            }}
          />
        ))}

        {route.page === 'evidence' && (
          <EvidencePage
            initialDataset={route.dataset || evidenceTarget.dataset}
            initialRecordId={route.recordId || evidenceTarget.recordId}
          />
        )}

        {route.page === 'whatif' && (
          <WhatIfErrorBoundary>
            <WhatIfPage />
          </WhatIfErrorBoundary>
        )}

        {route.page === 'evaluation' && (
          <EvaluationPage />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-dark-900/60 border-t border-slate-800/80 py-4 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">DECISION<span className="text-gold-400">OS</span></span>
            <span>·</span>
            <span>Hackathon Track PS-04: AI Decision Engine for Business Data</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-emerald-400 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse" />
              SQLite DB Online
            </span>
            <span>·</span>
            <span>Deterministic Analytics Active</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
