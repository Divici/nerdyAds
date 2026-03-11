interface HeaderProps {
  activeTab: 'campaign' | 'insights' | 'runs';
  onTabChange: (tab: 'campaign' | 'insights' | 'runs') => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const tabs = [
    { id: 'campaign' as const, label: 'Campaign' },
    { id: 'insights' as const, label: 'Insights' },
    { id: 'runs' as const, label: 'Previous Runs' },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6">
        {/* Brand bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vt-navy flex items-center justify-center">
              <span className="text-white text-sm font-bold font-heading">VT</span>
            </div>
            <div>
              <h1 className="text-lg font-heading font-semibold text-vt-text leading-tight">
                NerdyAds
              </h1>
              <p className="text-xs text-gray-400">Autonomous Ad Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-body">Varsity Tutors SAT Prep</span>
            <div className="w-2 h-2 rounded-full bg-score-good" />
          </div>
        </div>

        {/* Tab bar */}
        <nav className="flex gap-8 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`pb-3 text-sm font-button font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-vt-primary text-vt-primary'
                  : 'border-transparent text-gray-400 hover:text-vt-text hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
