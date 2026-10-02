export type DecisionStep = 'understand' | 'evidence' | 'simulate' | 'decide' | 'audit';

export type AppRoute =
  | { page: 'overview' }
  | { page: 'workspace'; step: 'ask' | 'results'; decisionId?: string }
  | { page: 'decision'; step: DecisionStep; decisionId: string; dataset?: string; recordId?: string }
  | { page: 'evidence'; dataset?: string; recordId?: string }
  | { page: 'whatif' }
  | { page: 'evaluation' };

const normalizeQueryValue = (value: string | null | undefined): string | undefined => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return undefined;
  }
  return trimmed;
};

export function parseAppLocation(location: string): AppRoute {
  const url = new URL(location, 'http://decisionos.local');
  const pathname = url.pathname.replace(/\/+$/, '') || '/overview';

  if (pathname === '/' || pathname === '/overview') return { page: 'overview' };
  if (pathname === '/decisions' || pathname === '/decisions/ask') {
    return { page: 'workspace', step: 'ask' };
  }
  if (pathname === '/decisions/results') {
    return { page: 'workspace', step: 'results', decisionId: normalizeQueryValue(url.searchParams.get('decision_id')) };
  }
  if (pathname === '/evidence') {
    return {
      page: 'evidence',
      dataset: normalizeQueryValue(url.searchParams.get('dataset')),
      recordId: normalizeQueryValue(url.searchParams.get('record_id')),
    };
  }
  if (pathname === '/what-if') return { page: 'whatif' };
  if (pathname === '/evaluation') return { page: 'evaluation' };

  const decisionMatch = pathname.match(/^\/decisions\/([^/]+)(?:\/(evidence|simulate|decide|audit))?$/);
  if (decisionMatch) {
    const stepByPath: Record<string, DecisionStep> = {
      evidence: 'evidence',
      simulate: 'simulate',
      decide: 'decide',
      audit: 'audit',
    };
    const step = decisionMatch[2] ? stepByPath[decisionMatch[2]] : 'understand';
    return {
      page: 'decision',
      step,
      decisionId: decodeURIComponent(decisionMatch[1]),
      dataset: normalizeQueryValue(url.searchParams.get('dataset')),
      recordId: normalizeQueryValue(url.searchParams.get('record_id')),
    };
  }

  return { page: 'overview' };
}
