import React from 'react';
import { Calculator, CheckCircle2 } from 'lucide-react';

interface ScoreComponent {
  component: string;
  raw_value: string;
  normalized_value: number;
  weight: number;
  contribution: number;
  explanation: string;
}

interface ScoreBreakdownProps {
  score: number;
  priorityLevel: string;
  components: ScoreComponent[];
  formulaExplanation?: string;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({
  score,
  priorityLevel,
  components = [],
  formulaExplanation
}) => {
  const sumContributions = components.reduce((acc, c) => acc + (c.contribution || 0), 0);
  const mathMatches = Math.abs(sumContributions - score) < 0.15;

  return (
    <div className="decisionos-surface bg-dark-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-gold-400" />
          <h4 className="text-sm font-semibold tracking-wide text-slate-200 uppercase font-mono">
            Deterministic Score Breakdown & Calculations
          </h4>
        </div>
        <div className="flex items-center space-x-2">
          <span className="rounded border border-slate-700 px-2 py-0.5 text-xs font-mono uppercase text-slate-300">
            {priorityLevel} priority
          </span>
          {mathMatches && (
            <span className="flex items-center text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Mathematically Verified
            </span>
          )}
          <span className="text-lg font-bold font-mono text-gold-400">
            {score.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 100</span>
          </span>
        </div>
      </div>

      {formulaExplanation && (
        <p className="text-xs text-slate-400 font-mono bg-dark-950/80 p-2.5 rounded border border-slate-800/80">
          <span className="text-gold-400 font-semibold">FORMULA: </span>
          {formulaExplanation}
        </p>
      )}

      {/* Segmented contribution bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Component Contributions</span>
          <span className="font-mono">{score.toFixed(1)} pts total</span>
        </div>
        <div className="h-3 w-full bg-dark-950 rounded-full flex overflow-hidden border border-slate-800">
          {components.map((c, idx) => {
            const widthPct = Math.min(100, Math.max(0, c.contribution));
            return (
              <div
                key={idx}
                style={{ width: `${widthPct}%` }}
                className="bg-gold-500 h-full transition-all duration-300 relative group cursor-pointer"
                title={`${c.component}: +${c.contribution} pts (${(c.weight * 100).toFixed(0)}% weight)`}
              />
            );
          })}
        </div>
      </div>

      {/* Component Details Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono">
              <th className="py-2 px-2.5 font-medium">Factor / Component</th>
              <th className="py-2 px-2.5 font-medium">Raw Value</th>
              <th className="py-2 px-2.5 font-medium">Normalized</th>
              <th className="py-2 px-2.5 font-medium">Weight</th>
              <th className="py-2 px-2.5 font-medium text-right">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {components.map((c, idx) => (
              <tr key={idx} className="hover:bg-dark-850/60 transition-colors">
                <td className="py-2.5 px-2.5 font-sans font-medium text-slate-200">
                  {c.component}
                  <div className="text-[11px] font-normal text-slate-400 font-sans mt-0.5">
                    {c.explanation}
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-slate-300">{c.raw_value}</td>
                <td className="py-2.5 px-2.5 text-slate-400">{c.normalized_value.toFixed(2)}</td>
                <td className="py-2.5 px-2.5 text-slate-400">{(c.weight * 100).toFixed(0)}%</td>
                <td className="py-2.5 px-2.5 text-right font-bold text-gold-400">
                  +{c.contribution.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700 bg-dark-950/60 font-mono font-bold">
              <td colSpan={4} className="py-2.5 px-2.5 text-slate-300 uppercase tracking-wider">
                Total Priority Score
              </td>
              <td className="py-2.5 px-2.5 text-right text-gold-400 text-sm">
                {score.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
