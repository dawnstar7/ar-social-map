import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useObjectStore } from '../store/objectStore';
import type { GeoPosition } from '../utils/coordinates';

interface MapViewProps {
    onModeSwitch: () => void;
}

// デフォルト位置（東京タワー）
const DEFAULT_CENTER: GeoPosition = {
    latitude: 35.6586,
    longitude: 139.7454,
    altitude: 0,
};

// カスタムアイコン
const createIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

const currentLocationIcon = L.divIcon({
    className: 'current-location-marker',
    html: `<div style="
    width: 20px;
    height: 20px;
    background: #4285f4;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 8px rgba(66,133,244,0.3), 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

// マップクリックハンドラー
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

// 現在地に移動するコンポーネント
function FlyToLocation({ position }: { position: GeoPosition | null }) {
    const map = useMap();

    useEffect(() => {
        if (position) {
            map.flyTo([position.latitude, position.longitude], 17, {
                duration: 1,
            });
        }
    }, [position, map]);

    return null;
}

export function MapView({ onModeSwitch }: MapViewProps) {
    const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const { objects, addObject, removeObject, clearAll } = useObjectStore();

    // 現在地を取得
    const locateMe = useCallback(() => {
        if (!navigator.geolocation) {
            alert('このブラウザは位置情報をサポートしていません');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCurrentPosition({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    altitude: pos.coords.altitude ?? 0,
                });
                setIsLocating(false);
            },
            (err) => {
                console.error('位置情報エラー:', err);
                setCurrentPosition(DEFAULT_CENTER);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    // 初回ロード時に現在地取得
    useEffect(() => {
        locateMe();
    }, [locateMe]);

    // マップクリックでオブジェクト配置
    const handleMapClick = useCallback((lat: number, lng: number) => {
        const position: GeoPosition = {
            latitude: lat,
            longitude: lng,
            altitude: 2,
        };
        addObject(position, `📍 ${objects.length + 1}`, '#ff4444');
    }, [addObject, objects.length]);

    const mapCenter = currentPosition || DEFAULT_CENTER;

    return (
        <div className="map-container">
            {/* ヘッダー */}
            <div className="map-header">
                <h2>🗺️ マップ</h2>
                <div className="header-buttons">
                    <button
                        className="icon-btn"
                        onClick={locateMe}
                        disabled={isLocating}
                        title="現在地"
                    >
                        {isLocating ? '⏳' : '📍'}
                    </button>
                    <button className="mode-switch-btn" onClick={onModeSwitch}>
                        📷 AR
                    </button>
                </div>
            </div>

            {/* Leafletマップ */}
            <div className="map-content">
                <MapContainer
                    center={[mapCenter.latitude, mapCenter.longitude]}
                    zoom={17}
                    className="leaflet-map"
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapClickHandler onMapClick={handleMapClick} />
                    <FlyToLocation position={currentPosition} />

                    {/* 現在地マーカー */}
                    {currentPosition && (
                        <Marker
                            position={[currentPosition.latitude, currentPosition.longitude]}
                            icon={currentLocationIcon}
                        >
                            <Popup>📍 現在地</Popup>
                        </Marker>
                    )}

                    {/* 配置されたオブジェクト */}
                    {objects.map((obj) => (
                        <Marker
                            key={obj.id}
                            position={[obj.position.latitude, obj.position.longitude]}
                            icon={createIcon(obj.color)}
                            eventHandlers={{
                                click: () => console.log('Selected:', obj.id),
                            }}
                        >
                            <Popup>
                                <div style={{ textAlign: 'center' }}>
                                    <strong>{obj.name}</strong>
                                    <br />
                                    <small style={{ color: '#666' }}>
                                        {obj.position.latitude.toFixed(5)}, {obj.position.longitude.toFixed(5)}
                                    </small>
                                    <br />
                                    <button
                                        onClick={() => removeObject(obj.id)}
                                        style={{
                                            marginTop: '8px',
                                            padding: '4px 12px',
                                            background: '#ff4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        削除
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* フローティングヘルプ */}
                <div className="map-help">
                    タップでオブジェクト配置
                </div>
            </div>

            {/* 下部パネル */}
            <div className="bottom-panel">
                <div className="object-count">
                    <span className="count-number">{objects.length}</span>
                    <span className="count-label">オブジェクト</span>
                </div>

                {objects.length > 0 && (
                    <button className="clear-btn" onClick={clearAll}>
                        🗑️ 全削除
                    </button>
                )}
            </div>
        </div>
    );
}
