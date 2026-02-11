import { Home, Map, Camera, Search, User } from 'lucide-react';

type AppMode = 'home' | 'map' | 'ar' | 'search' | 'profile';

interface BottomNavBarProps {
    currentMode: AppMode;
    onModeChange: (mode: AppMode) => void;
}

const tabs = [
    { mode: 'home' as AppMode, icon: Home, label: 'ホーム' },
    { mode: 'map' as AppMode, icon: Map, label: 'マップ' },
    { mode: 'ar' as AppMode, icon: Camera, label: 'AR' },
    { mode: 'search' as AppMode, icon: Search, label: 'さがす' },
    { mode: 'profile' as AppMode, icon: User, label: 'マイページ' },
];

export function BottomNavBar({ currentMode, onModeChange }: BottomNavBarProps) {
    return (
        <nav className="bottom-nav-dock glass-panel">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentMode === tab.mode;
                return (
                    <button
                        key={tab.mode}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => onModeChange(tab.mode)}
                    >
                        <div className="nav-icon-container">
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="nav-label">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

