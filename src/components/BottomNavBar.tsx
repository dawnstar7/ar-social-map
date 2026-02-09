type AppMode = 'home' | 'map' | 'ar' | 'search' | 'profile';

interface BottomNavBarProps {
    currentMode: AppMode;
    onModeChange: (mode: AppMode) => void;
}

const tabs: { mode: AppMode; icon: string; label: string }[] = [
    { mode: 'home', icon: '🏠', label: 'ホーム' },
    { mode: 'map', icon: '🌍', label: 'マップ' },
    { mode: 'ar', icon: '📷', label: 'AR' },
    { mode: 'search', icon: '🔍', label: 'さがす' },
    { mode: 'profile', icon: '👤', label: 'マイページ' },
];

export function BottomNavBar({ currentMode, onModeChange }: BottomNavBarProps) {
    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => (
                <button
                    key={tab.mode}
                    className={`bottom-nav-tab ${currentMode === tab.mode ? 'active' : ''}`}
                    onClick={() => onModeChange(tab.mode)}
                >
                    <span className="bottom-nav-icon">{tab.icon}</span>
                    <span className="bottom-nav-label">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
}
