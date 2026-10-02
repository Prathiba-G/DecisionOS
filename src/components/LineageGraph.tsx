import React from 'react';
import { ArrowRight, ShieldCheck, Cpu, Calculator, FileSpreadsheet, Database } from 'lucide-react';

interface LineageGraphProps {
  decisionId: string;
  targetName: string;
  score: number;
  evidenceCount: number;
  primaryDataset: string;
}

export const LineageGraph: React.FC<LineageGraphProps> = ({
  decisionId,
  targetName,
  score,
  evidenceCount,
  primaryDataset
}) => {
  const steps = [
    {
      id: 'step-1',
      title: '1. DECISION',
      subtitle: `${decisionId} · ${targetName}`,
      icon: <ShieldCheck className="w-4 h-4 text-gold-400" />,
      border: 'border-gold-500/40 bg-gold-950/20'
    },
    {
      id: 'step-2',
      title: '2. REASONING',
      subtitle: 'Deterministic Tool Calling',
      icon: <Cpu className="w-4 h-4 text-slate-400" />,
      border: 'border-slate-700 bg-dark-850'
    },
    {
      id: 'step-3',
      title: '3. CALCULATION',
      subtitle: `Score: ${score.toFixed(1)}/100 (5 Factors)`,
      icon: <Calculator className="w-4 h-4 text-gold-400" />,
      border: 'border-gold-800/50 bg-gold-950/20'
    },
    {
      id: 'step-4',
      title: '4. EVIDENCE',
      subtitle: `${evidenceCount} Verified Citations`,
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
      border: 'border-emerald-800/50 bg-emerald-950/20'
    },
    {
      id: 'step-5',
      title: '5. SOURCE DATA',
      subtitle: `${primaryDataset} + 5 tables`,
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      border: 'border-emerald-500/40 bg-emerald-950/20'
    },
  ];

  return (
    <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
        <span>Auditable Decision Lineage</span>
        <span className="text-emerald-400 flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />
          Full Chain Traceable
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 relative">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className={`p-3 rounded-lg border ${step.border} flex flex-col justify-between`}>
              <div className="flex items-center space-x-2 mb-1.5">
                {step.icon}
                <span className="text-xs font-mono font-semibold text-slate-200">
                  {step.title}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono truncate">
                {step.subtitle}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className="hidden md:flex items-center justify-center -mx-2 z-10 text-slate-600">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
