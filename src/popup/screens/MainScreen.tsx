import { useState } from 'react';
import DealsTab from '../components/DealsTab';
import FiltersTab from '../components/FiltersTab';
import SettingsTab from '../components/SettingsTab';

type Tab = 'deals' | 'filters' | 'settings';
export default function MainScreen({ fullPage = false, initialTab = 'deals' }: { fullPage?: boolean; initialTab?: Tab } = {}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  return (
    <div className={`${fullPage ? 'w-full max-w-xl mx-auto min-h-screen' : 'w-[420px] min-h-[540px] max-h-[600px]'} bg-bg-primary flex flex-col overflow-hidden`}>
      <header className="px-4 py-3 bg-bg-secondary"><h1 className="text-base font-bold tracking-tight" style={{ color: 'rgb(var(--logo-text, 255 255 255))' }}>float<span className="text-accent-blue">r</span></h1></header>
      <nav aria-label="Main navigation" className="flex px-4 gap-1 bg-bg-secondary">
        {(['deals', 'filters', 'settings'] as const).map((tab) => <button key={tab} type="button" aria-current={activeTab === tab ? 'page' : undefined}
          aria-controls={`panel-${tab}`} onClick={() => setActiveTab(tab)}
          className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 ${activeTab === tab ? 'text-accent-blue border-accent-blue' : 'text-text-muted border-transparent hover:bg-ui-overlay/5'}`}>
          {tab[0].toUpperCase() + tab.slice(1)}
        </button>)}
      </nav>
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'deals' && <div id="panel-deals"><DealsTab /></div>}
        <div id="panel-filters" hidden={activeTab !== 'filters'}><FiltersTab /></div>
        <div id="panel-settings" hidden={activeTab !== 'settings'}><SettingsTab /></div>
      </div>
    </div>
  );
}
