import React from 'react';
import { 
  ShieldCheck, LayoutDashboard, BrainCircuit, FileSearch,
  TrendingUp
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  decisionDetailPath?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  decisionDetailPath
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'decisions', label: 'Decision Workspace', icon: <BrainCircuit className="w-4 h-4" /> },
    ...(decisionDetailPath ? [{ id: 'detail', label: 'Decision Detail', icon: <ShieldCheck className="w-4 h-4" /> }] : []),
    { id: 'evidence', label: 'Evidence Viewer', icon: <FileSearch className="w-4 h-4" /> },
    { id: 'whatif', label: 'What-If Simulator', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <header className="decisionos-topbar sticky top-0 z-50 bg-dark-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3 lg:min-h-20 lg:flex-row lg:items-center lg:justify-between lg:py-0">
          
          {/* Logo & Product Promise */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <div className="decisionos-brand-mark w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white font-extrabold" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">DecisionOS</span>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight -mt-0.5">
                Evidence-backed decisions for business teams
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:justify-end lg:pb-0">
            {tabs.map(tab => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  title={tab.label}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150 ${
                    active
                      ? 'decisionos-nav-active border'
                      : 'decisionos-nav-inactive'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
};
