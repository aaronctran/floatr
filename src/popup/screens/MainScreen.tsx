import { useState } from 'react';
import DealsTab from '../components/DealsTab';
import SettingsTab from '../components/SettingsTab';

export default function MainScreen() {
  const [activeTab, setActiveTab] = useState<'deals' | 'settings'>('deals');

  return (
    <div className="w-[420px] min-h-[540px] max-h-[600px] bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-bg-secondary to-transparent sticky top-0 z-10">
        <h1 className="text-base font-bold bg-gradient-to-r from-accent-blue to-purple-500 bg-clip-text text-transparent tracking-tight">
          Floatr
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-1 bg-bg-secondary">
        <button
          onClick={() => setActiveTab('deals')}
          className={`flex-1 py-2.5 text-[13px] font-medium rounded-t-md transition-all relative ${
            activeTab === 'deals'
              ? 'text-text-primary font-semibold'
              : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.02]'
          }`}
        >
          Deals
          {activeTab === 'deals' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-0.5 bg-gradient-to-r from-accent-blue to-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2.5 text-[13px] font-medium rounded-t-md transition-all relative ${
            activeTab === 'settings'
              ? 'text-text-primary font-semibold'
              : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.02]'
          }`}
        >
          Settings
          {activeTab === 'settings' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-0.5 bg-gradient-to-r from-accent-blue to-purple-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'deals' ? <DealsTab /> : <SettingsTab />}
      </div>
    </div>
  );
}
