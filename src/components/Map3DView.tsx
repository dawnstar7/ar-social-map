/**
 * 3Dマップコンポーネント（Google Earth風）
 * 
 * 機能:
 * - 静止ピン配置
 * - 飛行オブジェクト配置（ドラゴン/鳥/UFO）
 * - リアルタイム位置更新
 * - 開発者オブジェクト（全員に表示）
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Viewer, Entity, CameraFlyTo } from 'resium';
import {
    Ion,
    Cartesian3,
    Cartesian2,
    Color,
    Cesium3DTileset,
    Cartographic,
    Math as CesiumMath,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useObjectStore, creatureNames, type FlyingCreature } from '../store/objectStore';
import { calculateCurrentPosition } from '../utils/flyingBehavior';
import { getDeveloperObjectsAsPlaced } from '../utils/developerObjects';
import { ObjectListPanel } from './ObjectListPanel';
import { LocationSearchPanel } from './LocationSearchPanel';
import type { GeoPosition } from '../utils/coordinates';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// 配置モード
type PlaceMode = 'static' | 'dragon' | 'bird' | 'ufo';

export function Map3DView() {
    const viewerRef = useRef<any>(null);
    const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [tilesLoaded, setTilesLoaded] = useState(false);
    const [statusMessage, setStatusMessage] = useState('初期化中...');
    const [crosshairPosition, setCrosshairPosition] = useState<GeoPosition | null>(null);
    const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

    // 配置モード
    const [placeMode, setPlaceMode] = useState<PlaceMode>('static');
    const [showModeSelect, setShowModeSelect] = useState(false);
    const [showObjectList, setShowObjectList] = useState(false);
    const [showLocationSearch, setShowLocationSearch] = useState(false);

    // 飛行オブジェクトの現在位置（リアルタイム更新）
    const [flyingPositions, setFlyingPositions] = useState<Map<string, GeoPosition>>(new Map());

    const { objects: userObjects, addObject, addFlyingObject, removeObject, clearAll } = useObjectStore();

    // ユーザーオブジェクト + 開発者オブジェクトを統合
    const allObjects = useMemo(() => {
        const developerObjects = getDeveloperObjectsAsPlaced();
        return [...developerObjects, ...userObjects];
    }, [userObjects]);

    // WebGLサポートチェック（コンテキストを即座に解放してCesiumに渡す）
    useEffect(() => {
        try {
            const canvas = document.createElement('canvas');
            const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;

            if (!gl) {
                console.error('WebGL not supported');
                setWebglSupported(false);
                return;
            }

            // コンテキストを即座に解放（iOSはWebGLコンテキスト数に制限あり）
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();

            setWebglSupported(true);
        } catch (e) {
            console.error('WebGL check error:', e);
            setWebglSupported(false);
        }
    }, []);

    // Cesium ion認証
    useEffect(() => {
        if (CESIUM_TOKEN) {
            Ion.defaultAccessToken = CESIUM_TOKEN;
        }
    }, []);

    // 現在地取得（高精度→低精度の順で試行）
    const locateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setShowLocationSearch(true);
            setStatusMessage('GPSが利用できません。場所を選択してください');
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

        // まず高精度で試す
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            () => {
                // 高精度失敗 → 低精度で再試行
                setStatusMessage('GPS再試行中...');
                navigator.geolocation.getCurrentPosition(
                    onSuccess,
                    (err) => {
                        console.warn('GPS取得失敗:', err.message);
                        setIsLocating(false);
                        setShowLocationSearch(true);
                        setStatusMessage('GPSが取得できません。場所を選択してください');
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
                );
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    }, []);

    useEffect(() => { locateMe(); }, [locateMe]);

    // 3Dタイル読み込み
    useEffect(() => {
        if (tilesLoaded || !currentPosition) return;

        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer) return;

        viewer.scene.screenSpaceCameraController.inertiaSpin = 0.5;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.5;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.5;

        async function loadTiles() {
            try {
                setStatusMessage('3Dマップ読み込み中...');

                let tileset: Cesium3DTileset;
                if (GOOGLE_API_KEY) {
                    tileset = await Cesium3DTileset.fromUrl(
                        `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_API_KEY}`
                    );
                } else {
                    tileset = await Cesium3DTileset.fromIonAssetId(2275207);
                }

                viewer.scene.primitives.add(tileset);
                setTilesLoaded(true);
                setStatusMessage('');
            } catch (error) {
                console.error('3Dタイルエラー:', error);
                setStatusMessage('読み込み失敗');
            }
        }

        setTimeout(loadTiles, 1000);
    }, [currentPosition, tilesLoaded]);

    // 照準位置更新
    useEffect(() => {
        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer) return;

        let animationId: number;

        const updateCrosshair = () => {
            const canvas = viewer.scene.canvas;
            const center = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);

            let cartesian = viewer.scene.pickPosition(center);
            if (!cartesian) {
                const ray = viewer.camera.getPickRay(center);
                if (ray) {
                    cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                }
            }

            if (cartesian) {
                try {
                    const cartographic = Cartographic.fromCartesian(cartesian);
                    setCrosshairPosition({
                        latitude: CesiumMath.toDegrees(cartographic.latitude),
                        longitude: CesiumMath.toDegrees(cartographic.longitude),
                        altitude: Math.max(0, cartographic.height || 0),
                    });
                } catch { /* ignore */ }
            }

            animationId = requestAnimationFrame(updateCrosshair);
        };

        const timer = setTimeout(updateCrosshair, 1000);
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(animationId);
        };
    }, [tilesLoaded]);

    // 飛行オブジェクトの位置をリアルタイム更新
    useEffect(() => {
        const flyingObjects = allObjects.filter(obj => obj.objectType === 'flying');
        if (flyingObjects.length === 0) return;

        const updatePositions = () => {
            const now = Date.now();
            const newPositions = new Map<string, GeoPosition>();

            flyingObjects.forEach(obj => {
                if (obj.flightConfig) {
                    const pos = calculateCurrentPosition(obj.position, obj.flightConfig, now);
                    newPositions.set(obj.id, pos);
                }
            });

            setFlyingPositions(newPositions);
        };

        updatePositions();
        const interval = setInterval(updatePositions, 100); // 10FPS

        return () => clearInterval(interval);
    }, [allObjects]);

    // オブジェクト配置
    const placeObject = useCallback(() => {
        if (!crosshairPosition) {
            setStatusMessage('位置が取れません');
            return;
        }

        if (placeMode === 'static') {
            addObject(crosshairPosition, `📍 ${userObjects.length + 1}`, '#ff4444');
            setStatusMessage('ピン配置完了！');
        } else {
            const creature = placeMode as FlyingCreature;
            addFlyingObject(crosshairPosition, creature, {
                radius: 30,
                minAltitude: 15,
                maxAltitude: 40,
            });
            setStatusMessage(`${creatureNames[creature]} 出現！`);
        }
    }, [crosshairPosition, placeMode, addObject, addFlyingObject, userObjects.length]);

    const cameraDestination = currentPosition
        ? Cartesian3.fromDegrees(currentPosition.longitude, currentPosition.latitude, 150)
        : undefined;

    const getPlaceModeLabel = () => {
        switch (placeMode) {
            case 'static': return '📍 ピン';
            case 'dragon': return '🐉 ドラゴン';
            case 'bird': return '🦅 鳥';
            case 'ufo': return '🛸 UFO';
        }
    };

    // WebGLがサポートされていない場合のフォールバック
    if (webglSupported === false) {
        return (
            <div className="map-container cesium-container">
                <div className="map-header">
                    <h2>🌍 3Dマップ</h2>
                </div>
                <div className="webgl-error">
                    <div className="error-content">
                        <h3>⚠️ WebGLエラー</h3>
                        <p>このデバイスは3Dマップをサポートしていないか、エラーが発生しました。</p>
                        <p>下のナビからARモードをお試しください。</p>
                    </div>
                </div>
            </div>
        );
    }

    // WebGL判定中（または初期化中）
    if (webglSupported === null) {
        return (
            <div className="app loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>3Dマップを準備中...</p>
                </div>
            </div>
        );
    }

    const FallbackUI = (
        <div className="map-container cesium-container">
            <div className="map-header">
                <h2>🌍 3Dマップ</h2>
            </div>
            <div className="webgl-error">
                <div className="error-content">
                    <h3>⚠️ 3Dマップエラー</h3>
                    <p>3Dマップの表示中にエラーが発生しました。</p>
                    <p>下のナビからARモードをお試しください。</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="map-container cesium-container">
            {/* ヘッダー */}
            <div className="map-header">
                <h2>🌍 3Dマップ</h2>
                <div className="header-buttons">
                    <button className="icon-btn" onClick={() => setShowLocationSearch(true)}>
                        🔍
                    </button>
                    <button className="icon-btn" onClick={locateMe} disabled={isLocating}>
                        {isLocating ? '⏳' : '📍'}
                    </button>
                </div>
            </div>

            {/* Cesiumビューア (ErrorBoundaryでラップ) */}
            <div className="cesium-viewer-wrapper">
                <ErrorBoundary fallback={FallbackUI}>
                    <Viewer
                        ref={viewerRef}
                        full
                        timeline={false}
                        animation={false}
                        fullscreenButton={false}
                        baseLayerPicker={true} // 航空写真と地図を切り替えられるように
                        navigationHelpButton={false} // ヘルプボタンを消す
                        homeButton={false} // ホームボタンを消す
                        geocoder={false} // 検索バーを消す
                        sceneModePicker={false} // 2D/3D切り替えを消す
                        selectionIndicator={false} // 緑の枠を消す
                        infoBox={false} // 情報を消す
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                        }}
                    >
                        {cameraDestination && (
                            <CameraFlyTo
                                destination={cameraDestination}
                                orientation={{ heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 }}
                                duration={2}
                                once
                            />
                        )}

                        {/* 静止オブジェクト */}
                        {allObjects.filter(obj => obj.objectType !== 'flying').map((obj) => (
                            <Entity
                                key={obj.id}
                                position={Cartesian3.fromDegrees(
                                    obj.position.longitude,
                                    obj.position.latitude,
                                    (obj.position.altitude || 0) + 5
                                )}
                                point={{ pixelSize: 16, color: Color.fromCssColorString(obj.color), outlineColor: Color.WHITE, outlineWidth: 2 }}
                                label={{
                                    text: `${obj.name}\n${obj.position.altitude?.toFixed(0) || 0}m`,
                                    font: '12px sans-serif',
                                    fillColor: Color.WHITE,
                                    outlineColor: Color.BLACK,
                                    outlineWidth: 2,
                                    pixelOffset: new Cartesian2(0, -30),
                                }}
                                onClick={() => { removeObject(obj.id); setStatusMessage('削除'); }}
                            />
                        ))}

                        {/* 飛行オブジェクト */}
                        {allObjects.filter(obj => obj.objectType === 'flying').map((obj) => {
                            const pos = flyingPositions.get(obj.id) || obj.position;
                            return (
                                <Entity
                                    key={obj.id}
                                    position={Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude || 20)}
                                    point={{ pixelSize: 20, color: Color.fromCssColorString(obj.color), outlineColor: Color.WHITE, outlineWidth: 3 }}
                                    label={{
                                        text: obj.name,
                                        font: '14px sans-serif',
                                        fillColor: Color.WHITE,
                                        outlineColor: Color.BLACK,
                                        outlineWidth: 2,
                                        pixelOffset: new Cartesian2(0, -35),
                                    }}
                                    onClick={() => { removeObject(obj.id); setStatusMessage('削除'); }}
                                />
                            );
                        })}
                    </Viewer>

                    {/* 照準 */}
                    <div className="crosshair">
                        <div className="crosshair-v"></div>
                        <div className="crosshair-h"></div>
                        <div className="crosshair-circle"></div>
                    </div>
                </ErrorBoundary>
            </div>

            {/* 配置モード選択ボタン */}
            <button className="mode-select-btn" onClick={() => setShowModeSelect(!showModeSelect)}>
                {getPlaceModeLabel()} ▼
            </button>

            {/* モード選択パネル */}
            {showModeSelect && (
                <div className="mode-select-panel">
                    <button className={placeMode === 'static' ? 'active' : ''} onClick={() => { setPlaceMode('static'); setShowModeSelect(false); }}>
                        📍 ピン（静止）
                    </button>
                    <button className={placeMode === 'dragon' ? 'active' : ''} onClick={() => { setPlaceMode('dragon'); setShowModeSelect(false); }}>
                        🐉 ドラゴン（飛行）
                    </button>
                    <button className={placeMode === 'bird' ? 'active' : ''} onClick={() => { setPlaceMode('bird'); setShowModeSelect(false); }}>
                        🦅 鳥（飛行）
                    </button>
                    <button className={placeMode === 'ufo' ? 'active' : ''} onClick={() => { setPlaceMode('ufo'); setShowModeSelect(false); }}>
                        🛸 UFO（飛行）
                    </button>
                </div>
            )}

            {/* 配置ボタン */}
            <button className="place-btn" onClick={placeObject} disabled={!crosshairPosition}>
                {getPlaceModeLabel()} 配置
            </button>

            {/* ステータス */}
            {statusMessage && <div className="status-bar">{statusMessage}</div>}

            {/* 下部パネル */}
            <div className="bottom-panel">
                <button className="object-count-btn" onClick={() => setShowObjectList(true)}>
                    <span className="count-number">{allObjects.length}</span>
                    <span className="count-label">オブジェクト</span>
                    <span className="count-chevron">▲</span>
                </button>
                {userObjects.length > 0 && (
                    <button className="clear-btn" onClick={() => { clearAll(); setStatusMessage('全削除'); }}>
                        🗑️ 全削除
                    </button>
                )}
            </div>

            {/* オブジェクト一覧パネル */}
            <ObjectListPanel
                isOpen={showObjectList}
                onClose={() => setShowObjectList(false)}
            />

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
