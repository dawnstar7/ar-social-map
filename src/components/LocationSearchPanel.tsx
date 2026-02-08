import type { GeoPosition } from '../utils/coordinates';

interface LocationSearchPanelProps {
    isOpen: boolean;
    onSelectLocation: (position: GeoPosition, name: string) => void;
    onClose: () => void;
}

const PRESET_LOCATIONS = [
    { name: '東京駅', latitude: 35.6812, longitude: 139.7671 },
    { name: '渋谷駅', latitude: 35.6580, longitude: 139.7016 },
    { name: '新宿駅', latitude: 35.6896, longitude: 139.7006 },
    { name: '大阪駅', latitude: 34.7024, longitude: 135.4959 },
    { name: '名古屋駅', latitude: 35.1709, longitude: 136.8815 },
    { name: '札幌駅', latitude: 43.0687, longitude: 141.3508 },
    { name: '福岡空港', latitude: 33.5902, longitude: 130.4017 },
];

export function LocationSearchPanel({ isOpen, onSelectLocation, onClose }: LocationSearchPanelProps) {
    return (
        <>
            <div
                className={`object-list-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`object-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="object-list-handle" />
                <div className="object-list-header">
                    <h3>場所を選択</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>
                <div className="object-list-items">
                    {PRESET_LOCATIONS.map((loc) => (
                        <button
                            key={loc.name}
                            className="location-preset-btn"
                            onClick={() => onSelectLocation(
                                { latitude: loc.latitude, longitude: loc.longitude, altitude: 0 },
                                loc.name
                            )}
                        >
                            <span className="location-preset-icon">📍</span>
                            <span className="location-preset-name">{loc.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
