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
        <nav className="bottom-nav">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentMode === tab.mode;
                return (
                    <button
                        key={tab.mode}
                        className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
                        onClick={() => onModeChange(tab.mode)}
                    >
                        <span className="bottom-nav-icon">
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        </span>
                        <span className="bottom-nav-label">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

