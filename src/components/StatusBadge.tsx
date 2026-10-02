import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Clock, Check, X, HelpCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showIcon = true }) => {
  const norm = (status || '').toUpperCase().trim();
  
  let bg = 'decisionos-badge-neutral';
  let icon = <HelpCircle className="w-3.5 h-3.5 inline mr-1" />;

  if (norm === 'VERIFIED') {
    bg = 'decisionos-badge-verified';
    icon = <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />;
  } else if (norm === 'REVIEW REQUIRED' || norm === 'REVIEW_REQUESTED') {
    bg = 'decisionos-badge-review';
    icon = <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-400" />;
  } else if (norm === 'DECISION WITHHELD' || norm === 'WITHHELD' || norm === 'AWAITING_APPROVAL' || norm === 'AWAITING HUMAN APPROVAL' || norm === 'PENDING') {
    bg = 'decisionos-badge-review';
    icon = <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-400" />;
  } else if (norm === 'REJECTED' || norm === 'REJECTED_UNSUPPORTED') {
    bg = 'decisionos-badge-conflict';
    icon = <ShieldAlert className="w-3.5 h-3.5 inline mr-1 text-rose-400" />;
  } else if (norm === 'CONFLICT' || norm === 'CONFLICTED' || norm === 'FAILED' || norm === 'ERROR') {
    bg = 'decisionos-badge-conflict';
    icon = <ShieldAlert className="w-3.5 h-3.5 inline mr-1 text-rose-400" />;
  } else if (norm === 'INFORMATION' || norm === 'INFO') {
    bg = 'decisionos-badge-neutral';
    icon = <HelpCircle className="w-3.5 h-3.5 inline mr-1 text-slate-400" />;
  } else if (norm === 'APPROVED') {
    bg = 'decisionos-badge-verified';
    icon = <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />;
  } else if (norm === 'HIGH') {
    bg = 'bg-rose-950/60 text-rose-300 border-rose-700/50';
    icon = <span className="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1.5" />;
  } else if (norm === 'MEDIUM') {
    bg = 'decisionos-badge-review';
    icon = <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1.5" />;
  } else if (norm === 'LOW') {
    bg = 'decisionos-badge-neutral';
    icon = <span className="w-2 h-2 rounded-full bg-slate-500 inline-block mr-1.5" />;
  } else if (norm === 'PASS') {
    bg = 'decisionos-badge-verified';
    icon = <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />;
  } else if (norm === 'FAIL') {
    bg = 'decisionos-badge-conflict';
    icon = <X className="w-3.5 h-3.5 inline mr-1 text-rose-400" />;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-medium'
  }[size];

  return (
    <span className={`inline-flex items-center font-mono uppercase tracking-wider rounded-md border ${bg} ${sizeClasses}`}>
      {showIcon && icon}
      {status}
    </span>
  );
};
