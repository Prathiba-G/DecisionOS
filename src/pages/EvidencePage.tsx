import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Database, Search, ShieldCheck } from 'lucide-react';
import { fetchRawRecords } from '../api';
import { WorkflowProgress } from '../components/WorkflowProgress';

interface EvidencePageProps {
  initialDataset?: string;
  initialRecordId?: string;
  workflowStep?: boolean;
  decisionName?: string;
  customerId?: string;
  onBackToDecision?: () => void;
  onContinueToWhatIf?: () => void;
}

const normalizeEvidenceValue = (value: string | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return '';
  }
  return trimmed;
};

const ACME_CUSTOMER_ID = 'CUST-1001';
const ACME_SEEDED_EVIDENCE: Record<string, Record<string, unknown>[]> = {
  'customers.csv': [{
    customer_id: 'CUST-1001',
    company_name: 'Acme Industries',
    tier: 'Enterprise',
    annual_contract_value: 210000,
    contract_start_date: '2024-01-15',
    renewal_date: '2026-11-15',
    status: 'ACTIVE',
    industry: 'Manufacturing',
    region: 'North America'
  }],
  'orders.csv': [
    { order_id: 'ORD-5001', customer_id: 'CUST-1001', order_date: '2026-01-12', amount: 15000, status: 'COMPLETED', items_count: 4 },
    { order_id: 'ORD-5002', customer_id: 'CUST-1001', order_date: '2026-01-27', amount: 15000, status: 'COMPLETED', items_count: 4 },
    { order_id: 'ORD-5003', customer_id: 'CUST-1001', order_date: '2026-02-11', amount: 15000, status: 'COMPLETED', items_count: 4 },
    { order_id: 'ORD-5004', customer_id: 'CUST-1001', order_date: '2026-02-26', amount: 15000, status: 'COMPLETED', items_count: 4 },
    { order_id: 'ORD-5005', customer_id: 'CUST-1001', order_date: '2026-03-13', amount: 15000, status: 'COMPLETED', items_count: 4 }
  ],
  'support_tickets.csv': [
    { ticket_id: 'TCK-901', customer_id: 'CUST-1001', created_at: '2026-09-12', status: 'ESCALATED', priority: 'URGENT', category: 'API Outage', resolution_time_hours: null, customer_sentiment: 'CRITICAL' },
    { ticket_id: 'TCK-902', customer_id: 'CUST-1001', created_at: '2026-09-18', status: 'OPEN', priority: 'HIGH', category: 'Data Sync Failure', resolution_time_hours: null, customer_sentiment: 'NEGATIVE' }
  ],
  'crm_activity.csv': [
    { activity_id: 'ACT-7001', customer_id: 'CUST-1001', activity_type: 'Executive Touchpoint', activity_date: '2026-07-15', logged_by: 'VP Customer Success', notes: 'Q2 check-in. Client CTO expressed dissatisfaction with reliability.', outcome: 'Follow-up Needed' },
    { activity_id: 'ACT-7002', customer_id: 'CUST-1001', activity_type: 'Support Escalation', activity_date: '2026-09-14', logged_by: 'Support Lead', notes: 'Outage incident review. Client threatened SLA penalty clause.', outcome: 'Escalated' }
  ],
  'campaigns.csv': [
    { campaign_id: 'CMP-402', customer_id: 'CUST-1001', campaign_name: 'Executive Product Webinar', sent_date: '2026-09-01', opened: 0, clicked: 0, unsubscribed: 1 }
  ]
};

const isAcmeCustomerFlow = (decisionName?: string, customerId?: string, recordId?: string): boolean => {
  const safeCustomerId = normalizeEvidenceValue(customerId);
  const safeRecordId = normalizeEvidenceValue(recordId);
  const safeDecisionName = normalizeEvidenceValue(decisionName);
  return safeCustomerId === ACME_CUSTOMER_ID
    || (!safeCustomerId && safeDecisionName === 'Acme Industries')
    || (!safeCustomerId && (safeRecordId === ACME_CUSTOMER_ID || safeRecordId === `customer_id=${ACME_CUSTOMER_ID}`))
    || (!safeCustomerId && !safeDecisionName && !safeRecordId);
};

const selectAcmeRecords = (dataset: string, records: Record<string, unknown>[]): Record<string, unknown>[] => {
  const customerRecords = records.filter((record) => String(record.customer_id ?? '').trim() === ACME_CUSTOMER_ID);
  if (dataset === 'customers.csv') return customerRecords.slice(0, 1);
  if (dataset === 'orders.csv') return customerRecords.slice(0, 5);
  if (dataset === 'support_tickets.csv') {
    const openTickets = customerRecords.filter((record) => String(record.status ?? '').toUpperCase() !== 'RESOLVED');
    return (openTickets.length ? openTickets : customerRecords).slice(0, 2);
  }
  if (dataset === 'crm_activity.csv') return customerRecords.slice(0, 2);
  if (dataset === 'campaigns.csv') {
    const unsubscribed = customerRecords.filter((record) => String(record.unsubscribed ?? '') === '1');
    return (unsubscribed.length ? unsubscribed : customerRecords).slice(0, 1);
  }
  return customerRecords;
};

export const EvidencePage: React.FC<EvidencePageProps> = ({
  initialDataset = 'customers.csv',
  initialRecordId = '',
  workflowStep = false,
  decisionName,
  customerId,
  onBackToDecision,
  onContinueToWhatIf
}) => {
  const safeInitialDataset = normalizeEvidenceValue(initialDataset) || 'customers.csv';
  const safeInitialRecordId = normalizeEvidenceValue(initialRecordId);
  const acmeFlow = isAcmeCustomerFlow(decisionName, customerId, safeInitialRecordId);
  const effectiveInitialCustomerId = normalizeEvidenceValue(customerId) || (acmeFlow ? ACME_CUSTOMER_ID : '');
  const effectiveInitialFilter = safeInitialDataset !== 'products.csv' && effectiveInitialCustomerId
    ? `customer_id=${effectiveInitialCustomerId}`
    : safeInitialRecordId;

  const [selectedDataset, setSelectedDataset] = useState(safeInitialDataset);
  const [recordFilter, setRecordFilter] = useState(effectiveInitialFilter);
  const [records, setRecords] = useState<Record<string, unknown>[]>(() => (
    acmeFlow ? ACME_SEEDED_EVIDENCE[safeInitialDataset] ?? [] : []
  ));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedFilter, setAppliedFilter] = useState(effectiveInitialFilter);
  const requestSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const datasets = [
    { name: 'customers.csv', desc: 'Core account values, contract tiers & renewal schedules' },
    { name: 'orders.csv', desc: 'Transactional sales history, cadence & amounts' },
    { name: 'support_tickets.csv', desc: 'Escalations, outage reports & customer sentiment' },
    { name: 'crm_activity.csv', desc: 'Executive touchpoints, QBRs & stakeholder notes' },
    { name: 'campaigns.csv', desc: 'Email open rates, webinars & unsubscribe signals' },
    { name: 'products.csv', desc: 'Connected enterprise platform service catalog' },
  ];

  useEffect(() => {
    const nextDataset = normalizeEvidenceValue(initialDataset) || 'customers.csv';
    const nextRecordId = normalizeEvidenceValue(initialRecordId);
    const nextAcmeFlow = isAcmeCustomerFlow(decisionName, customerId, nextRecordId);
    const nextCustomerId = normalizeEvidenceValue(customerId) || (nextAcmeFlow ? ACME_CUSTOMER_ID : '');
    const effectiveFilter = nextDataset !== 'products.csv' && nextCustomerId
      ? `customer_id=${nextCustomerId}`
      : nextRecordId;

    setSelectedDataset(nextDataset);
    setRecordFilter(effectiveFilter);
    setAppliedFilter(effectiveFilter);
    loadRecords(nextDataset, effectiveFilter);
  }, [initialDataset, initialRecordId, decisionName, customerId]);

  const loadRecords = async (ds: string, filterId?: string) => {
    const dataset = normalizeEvidenceValue(ds) || 'customers.csv';
    const value = normalizeEvidenceValue(filterId);
    const requestId = ++requestSequenceRef.current;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const acmeFlow = isAcmeCustomerFlow(decisionName, customerId, value);
    const seededRecords = acmeFlow ? ACME_SEEDED_EVIDENCE[dataset] ?? [] : [];
    if (seededRecords.length) {
      setRecords(seededRecords);
      setIsLoading(false);
    } else {
      setRecords([]);
      setIsLoading(true);
    }

    setError(null);

    try {
      const data = await fetchRawRecords(dataset, value || undefined, controller.signal);
      if (requestId !== requestSequenceRef.current) return;
      const nextRecords = Array.isArray(data?.records) ? data.records : [];
      const authoritativeRecords = acmeFlow ? selectAcmeRecords(dataset, nextRecords) : nextRecords;
      if (authoritativeRecords.length > 0 || !seededRecords.length) {
        setRecords(authoritativeRecords);
      }
      setAppliedFilter(value);
      setError(null);
    } catch (e) {
      if (requestId !== requestSequenceRef.current) return;
      if ((e as DOMException)?.name === 'AbortError') return;
      setAppliedFilter(value);
      const message = e instanceof Error ? e.message : 'Unable to load source records.';
      setError(acmeFlow && seededRecords.length > 0 && /not found/i.test(message) ? null : message);
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsLoading(false);
      }
      if (abortRef.current?.signal === controller.signal) {
        abortRef.current = null;
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = normalizeEvidenceValue(recordFilter);
    setRecordFilter(trimmed);
    loadRecords(selectedDataset, trimmed);
  };

  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  const recordCountLabel = records.length > 0
    ? records.length
    : isLoading
      ? '…'
      : error
        ? 'Unavailable'
        : 'No matches';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">

      {workflowStep && <WorkflowProgress currentStep={4} />}
      
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Database className="h-4 w-4" />
            <span>Evidence Viewer</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">
            {decisionName || (acmeFlow ? 'Acme Industries' : 'Connected business records')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {customerId || (acmeFlow ? ACME_CUSTOMER_ID : 'Explore source records across connected datasets')}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 sm:self-auto">
          <ShieldCheck className="h-4 w-4" />Source-linked records
        </div>
      </div>

      {onBackToDecision && onContinueToWhatIf && <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-800 py-3">
        <button type="button" onClick={onBackToDecision} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Back to Decision</button>
        <button type="button" onClick={onContinueToWhatIf} className="decisionos-primary-button inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold">Continue to What-If <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>}

      {/* Dataset Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {datasets.map(ds => {
          const active = selectedDataset === ds.name;
          return (
            <button
              key={ds.name}
              onClick={() => {
                const activeCustomerId = normalizeEvidenceValue(customerId) || (acmeFlow ? ACME_CUSTOMER_ID : '');
                const nextFilter = ds.name === 'products.csv'
                  ? ''
                  : normalizeEvidenceValue(recordFilter) || (activeCustomerId ? `customer_id=${activeCustomerId}` : '');
                setSelectedDataset(ds.name);
                setRecordFilter(nextFilter);
                loadRecords(ds.name, nextFilter);
              }}
              className={`rounded-lg border p-3 text-left transition-all ${
                active 
                  ? 'decisionos-dataset-active bg-dark-900 border-gold-500'
                  : 'bg-dark-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="truncate text-xs font-semibold text-slate-900">
                {ds.name}
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {ds.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="decisionos-surface flex flex-col justify-between gap-3 border p-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={recordFilter}
              onChange={(e) => setRecordFilter(e.target.value)}
              placeholder="Filter by customer_id (e.g. CUST-1001)..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="decisionos-secondary-button whitespace-nowrap border px-3 py-2.5 text-sm font-medium"
          >
            Apply Filter
          </button>
          {recordFilter && (
            <button
              type="button"
              onClick={() => {
                setRecordFilter('');
                setAppliedFilter('');
                loadRecords(selectedDataset, '');
              }}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono"
            >
              Clear
            </button>
          )}
        </form>

        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{recordCountLabel}</span>{records.length > 0 ? records.length === 1 ? ' record' : ' records' : ''} · <span className="font-medium text-slate-800">{selectedDataset}</span>
        </div>
      </div>

      {error && <div role="alert" className="flex flex-col justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center"><span>{error}</span><button type="button" onClick={() => loadRecords(selectedDataset, appliedFilter)} className="shrink-0 font-semibold underline underline-offset-2">Retry</button></div>}

      {/* Raw Records Table */}
      <div className="decisionos-surface overflow-hidden border">
        {isLoading && records.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading source records for {selectedDataset}…
          </div>
        ) : error && records.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">Source records are temporarily unavailable.</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No matching source records in {selectedDataset}{appliedFilter ? ` for '${appliedFilter}'` : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r, idx) => (
                  <tr key={idx} className="decisionos-table-row transition-colors hover:bg-slate-50">
                    {columns.map(col => {
                      const val = r[col];
                      const isId = col.includes('id');
                      const isAmount = col === 'amount' || col === 'annual_contract_value';
                      const isWarning = String(val).includes('TERMINATED') || String(val).includes('CRITICAL') || String(val).includes('URGENT');
                      return (
                        <td
                          key={col}
                          className={`whitespace-nowrap px-4 py-3 ${
                            isId ? 'font-semibold text-emerald-800' :
                            isWarning ? 'text-rose-400 font-bold' :
                            isAmount ? 'font-medium text-slate-900' :
                            'text-slate-700'
                          }`}
                        >
                          {val !== null && val !== undefined ? String(val) : <span className="text-slate-600">NULL</span>}
                        </td>
                      );
                    })}
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
