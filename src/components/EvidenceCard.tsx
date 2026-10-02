import React from 'react';
import { Database, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface EvidenceItem {
  evidence_id?: string;
  source_dataset: string;
  record_id: string;
  field: string;
  raw_value: string;
  finding: string;
  used_for: string;
  verified: boolean;
}

interface EvidenceCardProps {
  item: EvidenceItem;
  onInspect?: (dataset: string, recordId: string) => void;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ item, onInspect }) => {
  return (
    <div className="decisionos-surface bg-dark-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4 transition-all duration-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-xs font-mono px-2 py-0.5 rounded bg-dark-950 text-gold-400 border border-gold-900/40">
            <Database className="w-3 h-3 mr-1 text-gold-500" />
            {item.source_dataset}
          </span>
          <span className="text-xs font-mono text-slate-400 bg-dark-950 px-2 py-0.5 rounded border border-slate-800">
            {item.record_id}
          </span>
        </div>
        <div>
          {item.verified ? (
            <span className="flex items-center text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified Lineage
            </span>
          ) : (
            <span className="flex items-center text-[11px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
              <AlertCircle className="w-3 h-3 mr-1" />
              Unverified Claim
            </span>
          )}
        </div>
      </div>

      <div>
        <h5 className="text-sm font-semibold text-slate-100">{item.finding}</h5>
        <div className="mt-1 text-xs text-slate-400 flex items-center space-x-2">
          <span className="text-slate-500 font-mono">FIELD:</span>
          <span className="font-mono text-slate-300">{item.field}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500 font-mono">RAW:</span>
          <span className="font-mono text-gold-400/90">{item.raw_value}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <span className="text-[11px] text-slate-500">
          Used for: <span className="text-slate-300">{item.used_for}</span>
        </span>
        {onInspect && (
          <button
            onClick={() => onInspect(item.source_dataset, item.record_id)}
            className="flex items-center text-xs font-mono text-gold-400 hover:text-gold-300 transition-colors"
          >
            Inspect Source
            <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
};
