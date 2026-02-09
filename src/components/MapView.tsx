/**
 * 2Dマップ（Leaflet） - Cesiumフォールバック兼SNS対応マップ
 *
 * - 自分のオブジェクト + フォロー中ユーザーのオブジェクト表示
 * - 距離フィルター（2km以内）
 * - オブジェクトタップで詳細表示
 * - FAB配置モード
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useObjectStore, creatureEmoji, type FlyingCreature } from '../store/objectStore';
import { getDeveloperObjectsAsPlaced } from '../utils/developerObjects';
import { calculateDistance } from '../utils/coordinates';
import { LocationSearchPanel } from './LocationSearchPanel';
import type { GeoPosition } from '../utils/coordinates';

interface MapViewProps {
    onNavigateToObject?: (position: { latitude: number; longitude: number }) => void;
    onRetry3D?: () => void;
}

// デフォルト位置（東京タワー）
const DEFAULT_CENTER: GeoPosition = {
    latitude: 35.6586,
    longitude: 139.7454,
    altitude: 0,
};

const VISIBLE_RADIUS = 2000;

// カスタムアイコン（自分のオブジェクト）
const createOwnIcon = (color: string) => {
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

// カスタムアイコン（他ユーザーのオブジェクト）
const createOtherIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
      width: 20px;
      height: 20px;
      background: ${color};
      border: 3px solid #06b6d4;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(6,182,212,0.4);
    "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
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
function MapClickHandler({ onMapClick, enabled }: { onMapClick: (lat: number, lng: number) => void; enabled: boolean }) {
    useMapEvents({
        click: (e) => {
            if (enabled) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
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

export function MapView({ onRetry3D }: MapViewProps) {
    const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [isPlacementMode, setIsPlacementMode] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [showLocationSearch, setShowLocationSearch] = useState(false);
    const { objects: userObjects, publicObjects, addObject, removeObject, userId } = useObjectStore();

    // 自分のオブジェクト + フォロー中ユーザーのオブジェクト（2km以内）
    const allObjects = useMemo(() => {
        const sharedObjects = getDeveloperObjectsAsPlaced();
        const myObjects = userObjects.filter(obj => obj.ownerId === userId || !obj.ownerId);
        const myObjectIds = new Set(myObjects.map(o => o.id));
        const otherObjects = sharedObjects.filter(o => !myObjectIds.has(o.id));
        const allUnfiltered = [...myObjects, ...otherObjects];

        if (!currentPosition) return allUnfiltered;
        return allUnfiltered.filter(obj =>
            calculateDistance(currentPosition, obj.position) <= VISIBLE_RADIUS
        );
    }, [userObjects, publicObjects, userId, currentPosition]);

    const getIcon = (obj: { objectType: string; creature?: FlyingCreature }) => {
        if (obj.objectType === 'flying' && obj.creature) {
            return creatureEmoji[obj.creature];
        }
        return '📍';
    };

    // 現在地を取得
    const locateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setShowLocationSearch(true);
            setStatusMessage('GPSが利用できません');
            return;
        }

        setIsLocating(true);
        setStatusMessage('GPS取得中...');

        const onSuccess = (pos: GeolocationPosition) => {
            setCurrentPosition({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude ?? 0,
            });
            setIsLocating(false);
            setStatusMessage('');
        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            () => {
                navigator.geolocation.getCurrentPosition(
                    onSuccess,
                    () => {
                        setIsLocating(false);
                        setShowLocationSearch(true);
                        setStatusMessage('GPSが取得できません');
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
                );
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    }, []);

    useEffect(() => { locateMe(); }, [locateMe]);

    // マップクリックでオブジェクト配置（配置モード時のみ）
    const handleMapClick = useCallback((lat: number, lng: number) => {
        if (!isPlacementMode) return;
        const position: GeoPosition = { latitude: lat, longitude: lng, altitude: 2 };
        addObject(position, `📍 ${userObjects.length + 1}`, '#ff4444');
        setStatusMessage('ピン配置完了！');
        setIsPlacementMode(false);
        setTimeout(() => setStatusMessage(''), 2000);
    }, [isPlacementMode, addObject, userObjects.length]);

    const mapCenter = currentPosition || DEFAULT_CENTER;

    return (
        <div className="map-container">
            {/* ヘッダー */}
            <div className="map-header">
                <h2>🗺️ 2Dマップ</h2>
                <div className="header-buttons">
                    <button className="icon-btn" onClick={() => setShowLocationSearch(true)}>
                        🔍
                    </button>
                    <button className="icon-btn" onClick={locateMe} disabled={isLocating}>
                        {isLocating ? '⏳' : '📍'}
                    </button>
                    {onRetry3D && (
                        <button className="icon-btn" onClick={onRetry3D} title="3Dマップを試す">
                            🌐
                        </button>
                    )}
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

                    <MapClickHandler onMapClick={handleMapClick} enabled={isPlacementMode} />
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
                    {allObjects.map((obj) => {
                        const isOwn = obj.ownerId === userId || !obj.ownerId;
                        return (
                            <Marker
                                key={obj.id}
                                position={[obj.position.latitude, obj.position.longitude]}
                                icon={isOwn ? createOwnIcon(obj.color) : createOtherIcon(obj.color)}
                            >
                                <Popup>
                                    <div style={{ textAlign: 'center', minWidth: 120 }}>
                                        <strong>{getIcon(obj)} {obj.name}</strong>
                                        {!isOwn && <div style={{ color: '#06b6d4', fontSize: 12, marginTop: 4 }}>👤 他ユーザー</div>}
                                        <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                                            海抜{obj.position.altitude?.toFixed(0) || 0}m
                                        </div>
                                        {isOwn && (
                                            <button
                                                onClick={() => { removeObject(obj.id); setStatusMessage('削除しました'); }}
                                                style={{
                                                    marginTop: 8, padding: '4px 12px',
                                                    background: '#ff4444', color: 'white',
                                                    border: 'none', borderRadius: 4, cursor: 'pointer',
                                                }}
                                            >
                                                削除
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>

                {/* 配置モード表示 */}
                {isPlacementMode && (
                    <div className="map-help">
                        タップで📍ピンを配置
                    </div>
                )}
            </div>

            {/* ステータスバー */}
            {statusMessage && <div className="status-bar">{statusMessage}</div>}

            {/* FABボタン */}
            <button
                className="map-fab"
                onClick={() => setIsPlacementMode(!isPlacementMode)}
            >
                {isPlacementMode ? '✕' : '＋'}
            </button>

            {/* 下部パネル */}
            <div className="bottom-panel">
                <div className="object-count">
                    <span className="count-number">{allObjects.length}</span>
                    <span className="count-label">オブジェクト</span>
                </div>
            </div>

            {/* 場所検索パネル */}
            <LocationSearchPanel
                isOpen={showLocationSearch}
                onSelectLocation={(pos, name) => {
                    setCurrentPosition(pos);
                    setShowLocationSearch(false);
                    setStatusMessage(`${name}を表示`);
                }}
                onClose={() => setShowLocationSearch(false)}
            />
        </div>
    );
}
