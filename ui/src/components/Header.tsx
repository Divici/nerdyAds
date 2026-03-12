interface HeaderProps {
  activeTab: 'campaign' | 'insights' | 'runs';
  onTabChange: (tab: 'campaign' | 'insights' | 'runs') => void;
}

/** VT swirl logo — loaded from static asset */
function VTLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/vt-logo.svg"
      alt="Varsity Tutors"
      className={className}
    />
  );
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const tabs = [
    { id: 'campaign' as const, label: 'Campaign' },
    { id: 'insights' as const, label: 'Insights' },
    { id: 'runs' as const, label: 'Previous Runs' },
  ];

  return (
    <header className="sticky top-0 z-30 pt-4 pb-2 px-6">
      {/* Floating pill navbar */}
      <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-gray-200/40 px-6 py-2.5 flex items-center justify-between">
        {/* Left: Logo + brand */}
        <div className="flex items-center gap-2.5">
          <VTLogo className="w-8 h-8" />
          <span className="text-base font-heading font-semibold text-vt-text">NerdyAds</span>
        </div>

        {/* Center: Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-1.5 text-sm font-button font-medium rounded-full transition-colors ${
                activeTab === tab.id
                  ? 'bg-vt-text text-white'
                  : 'text-gray-400 hover:text-vt-text hover:bg-gray-100/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right: Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-body">SAT Prep</span>
          <div className="w-2 h-2 rounded-full bg-score-good" />
        </div>
      </div>
    </header>
  );
}
