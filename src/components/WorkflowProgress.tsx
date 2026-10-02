import React from 'react';
import { Check } from 'lucide-react';

const steps = ['ASK', 'RESULTS', 'UNDERSTAND', 'VERIFY', 'SIMULATE', 'DECIDE', 'AUDIT'];

interface WorkflowProgressProps {
  currentStep: number;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ currentStep }) => (
  <nav aria-label="Decision workflow" className="border-y border-slate-200 py-4">
    <ol className="grid grid-cols-7 gap-1 sm:gap-3">
      {steps.map((step, index) => {
        const number = index + 1;
        const complete = number < currentStep;
        const active = number === currentStep;
        return (
          <li key={step} aria-current={active ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-1.5 text-center text-[9px] font-medium sm:text-[11px] ${active ? 'text-emerald-800' : complete ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
              {complete ? <Check className="h-3.5 w-3.5" /> : number}
            </span>
            <span className="leading-tight">{step}</span>
          </li>
        );
      })}
    </ol>
  </nav>
);
