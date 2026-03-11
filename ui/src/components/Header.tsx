interface HeaderProps {
  activeTab: 'campaign' | 'insights' | 'runs';
  onTabChange: (tab: 'campaign' | 'insights' | 'runs') => void;
}

/** VT-style swirl logo */
function VTLogo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#20205F" />
      <path
        d="M10 12c0-2.5 2-4.5 4.5-4.5 3.5 0 5.5 2.5 5.5 5.5 0 4-3 7.5-7 11-1.5-1.3-2.8-2.6-3.8-4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 20c0 2.5-2 4.5-4.5 4.5-3.5 0-5.5-2.5-5.5-5.5 0-4 3-7.5 7-11 1.5 1.3 2.8 2.6 3.8 4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
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
