/**
 * 3Dマップコンポーネント（Google Earth風）
 *
 * 機能:
 * - 静止ピン配置
 * - 飛行オブジェクト配置（ドラゴン/鳥/UFO）
 * - リアルタイム位置更新
 * - 開発者オブジェクト（全員に表示）
 * - Google 3Dタイル失敗時は通常の地球儀で表示
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
    VerticalOrigin,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useObjectStore, creatureNames, type FlyingCreature } from '../store/objectStore';
import { useSocialStore } from '../store/socialStore';
import { calculateCurrentPosition } from '../utils/flyingBehavior';
import { getDeveloperObjectsAsPlaced } from '../utils/developerObjects';
import { ObjectListPanel } from './ObjectListPanel';
import { LocationSearchPanel } from './LocationSearchPanel';
import { calculateDistance } from '../utils/coordinates';
import type { GeoPosition } from '../utils/coordinates';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

import { UGCCreatorPanel } from './UGCCreatorPanel';
import { SocialThread } from './SocialThread';

// 配置モード
type PlaceMode = 'static' | 'dragon' | 'bird' | 'ufo' | 'ugc';

export function Map3DView() {
    const viewerRef = useRef<any>(null);
    const [currentPosition, setCurrentPosition] = useState<GeoPosition | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [tilesLoaded, setTilesLoaded] = useState(false);
    const [tilesFailed, setTilesFailed] = useState(false);
    const [statusMessage, setStatusMessage] = useState('初期化中...');
    const [crosshairPosition, setCrosshairPosition] = useState<GeoPosition | null>(null);

    // 配置モード
    const [placeMode, setPlaceMode] = useState<PlaceMode>('static');
    const [showModeSelect, setShowModeSelect] = useState(false);
    const [showObjectList, setShowObjectList] = useState(false);
    const [showLocationSearch, setShowLocationSearch] = useState(false);
    const [showUGCPanel, setShowUGCPanel] = useState(false);
    // const [showAltitudeControl, setShowAltitudeControl] = useState(false);
    // const [placeAltitude, setPlaceAltitude] = useState(0);
    const placeAltitude = 0; // Fixed for now, can re-enable later
    const [selectedObject, setSelectedObject] = useState<{ id: string; name: string } | null>(null);

    // 飛行オブジェクトの現在位置（リアルタイム更新）
    const [flyingPositions, setFlyingPositions] = useState<Map<string, GeoPosition>>(new Map());

    const { objects: userObjects, publicObjects, addObject, addFlyingObject, addUGCObject, userId } = useObjectStore();
    const { onlineUsers, otherFootprints, initializeSocial, broadcastPresence, recordFootprint } = useSocialStore();

    // ソーシャル機能初期化 & 定期ブロードキャスト
    useEffect(() => {
        initializeSocial();

        const interval = setInterval(() => {
            if (currentPosition) {
                broadcastPresence(currentPosition);
                recordFootprint(currentPosition);
            }
        }, 5000); // 5秒ごとに位置送信

        return () => clearInterval(interval);
    }, [initializeSocial, broadcastPresence, recordFootprint, currentPosition]);

    const VISIBLE_RADIUS = 2000;

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

    // Cesium ion認証
    useEffect(() => {
        if (CESIUM_TOKEN) {
            Ion.defaultAccessToken = CESIUM_TOKEN;
        }
    }, []);

    // 現在地取得
    const locateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setShowLocationSearch(true);
            setStatusMessage('GPSが利用できません。場所を選択してください');
            return;
        }

        setIsLocating(true);
        setStatusMessage('GPS取得中...');

        const onSuccess = (pos: GeolocationPosition) => {
            const newPos = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude ?? 0,
            };
            setCurrentPosition(newPos);
            setIsLocating(false);
            setStatusMessage('');

        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            () => {
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

    // 3Dタイル読み込み（失敗しても通常のCesium地球儀で表示を続行）
    useEffect(() => {
        if (tilesLoaded || tilesFailed || !currentPosition) return;

        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer) return;

        viewer.scene.screenSpaceCameraController.inertiaSpin = 0.5;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.5;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.5;

        async function loadTiles() {
            try {
                console.log('Starting loadTiles...');
                setStatusMessage('3Dマップ読み込み中...');

                let tileset: Cesium3DTileset;
                if (GOOGLE_API_KEY) {
                    console.log('Loading Google Tiles...');
                    tileset = await Cesium3DTileset.fromUrl(
                        `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_API_KEY}`
                    ).catch(e => { throw new Error(`Google Tiles load failed: ${e.message}`); });
                } else {
                    console.log('Loading Ion Asset...');
                    tileset = await Cesium3DTileset.fromIonAssetId(2275207)
                        .catch(e => { throw new Error(`Ion Asset load failed: ${e.message}`); });
                }

                if (!tileset) {
                    throw new Error('Tileset is null after loading');
                }

                console.log('Tileset loaded, adding to primitives...');
                if (viewer.isDestroyed()) return;

                viewer.scene.primitives.add(tileset);
                setTilesLoaded(true);
                setStatusMessage('');
                console.log('Tileset added successfully');
            } catch (error: any) {
                console.warn('3Dタイル読み込み失敗、通常の地球儀で表示:', error);
                setGlobalError(`Tile Warning: ${error.message}`); // 警告として表示
                setTilesFailed(true);
                setStatusMessage('');
            }
        }

        setTimeout(loadTiles, 1000);
    }, [currentPosition, tilesLoaded, tilesFailed]);

    // 照準位置更新
    useEffect(() => {
        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer) return;

        let animationId: number;

        const updateCrosshair = () => {
            if (!viewer || viewer.isDestroyed()) return;

            // シーンやカメラのチェック
            if (!viewer.scene || !viewer.camera) return;

            try {
                const canvas = viewer.scene.canvas;
                if (!canvas) return;

                const center = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);

                let cartesian = viewer.scene.pickPosition(center);
                if (!cartesian) {
                    const ray = viewer.camera.getPickRay(center);
                    if (ray) {
                        cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                    }
                }

                if (cartesian) {
                    const cartographic = Cartographic.fromCartesian(cartesian);
                    setCrosshairPosition({
                        latitude: CesiumMath.toDegrees(cartographic.latitude),
                        longitude: CesiumMath.toDegrees(cartographic.longitude),
                        altitude: Math.max(0, cartographic.height || 0),
                    });
                }
            } catch (e) {
                // 無視（レンダリング中の競合などでエラーになる場合がある）
            }

            animationId = requestAnimationFrame(updateCrosshair);
        };

        const timer = setTimeout(updateCrosshair, 1000);
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(animationId);
        };
    }, [tilesLoaded, tilesFailed]);

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
        const interval = setInterval(updatePositions, 100);

        return () => clearInterval(interval);
    }, [allObjects]);

    // オブジェクト配置
    const placeObject = useCallback(() => {
        if (!crosshairPosition) {
            setStatusMessage('位置が取れません');
            return;
        }

        const groundAltitude = crosshairPosition.altitude || 0;
        const positionWithAltitude: GeoPosition = {
            ...crosshairPosition,
            altitude: groundAltitude + placeAltitude,
        };

        if (placeMode === 'static') {
            addObject(positionWithAltitude, `📍 ${userObjects.length + 1}`, '#ff4444');
            setStatusMessage(`ピン配置完了！（地面+${placeAltitude}m / 海抜${positionWithAltitude.altitude?.toFixed(0)}m）`);
        } else if (placeMode === 'ugc') {
            setShowUGCPanel(true);
            // UGCパネルが開くのでここではセットしない
        } else {
            const creature = placeMode as FlyingCreature;
            const actualAlt = groundAltitude + placeAltitude;
            addFlyingObject(positionWithAltitude, creature, {
                radius: 30,
                minAltitude: Math.max(actualAlt, 15),
                maxAltitude: Math.max(actualAlt + 25, 40),
            });
            setStatusMessage(`${creatureNames[creature]} 出現！（地面+${placeAltitude}m）`);
        }
    }, [crosshairPosition, placeMode, placeAltitude, addObject, addFlyingObject, userObjects.length]);

    const cameraDestination = useMemo(() => {
        if (!currentPosition) return undefined;
        return Cartesian3.fromDegrees(currentPosition.longitude, currentPosition.latitude, 150);
    }, [currentPosition]);

    const getPlaceModeLabel = () => {
        switch (placeMode) {
            case 'static': return '📍 ピン';
            case 'dragon': return '🐉 ドラゴン';
            case 'bird': return '🦅 鳥';
            case 'ufo': return '🛸 UFO';
            case 'ugc': return '🎨 クリエイト';
        }
    };

    // グローバルエラーハンドリング (iOSでのデバッグ用)
    const [globalError, setGlobalError] = useState<string | null>(null);

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            setGlobalError(`Global Error: ${event.message}`);
        };
        const handleRejection = (event: PromiseRejectionEvent) => {
            setGlobalError(`Promise Error: ${event.reason}`);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    // ErrorBoundaryがキャッチした場合のUI
    const FallbackUI = (
        <div className="map-container cesium-container">
            <div className="map-header">
                <h2>🌍 3Dマップ</h2>
            </div>
            <div className="webgl-error">
                <div className="error-content">
                    <h3>3Dマップを表示できません</h3>
                    <p>エラーが発生しました: {globalError || '不明なエラー'}</p>
                    <button className="fallback-2d-btn" onClick={() => window.location.reload()}>
                        再読み込み
                    </button>
                    {globalError && (
                        <div style={{ marginTop: '10px', fontSize: '10px', color: 'red', textAlign: 'left', background: '#333', padding: '5px' }}>
                            {globalError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // カメラリセット
    const resetCamera = useCallback(() => {
        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer || !currentPosition) return;

        viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(
                currentPosition.longitude,
                currentPosition.latitude,
                200 // Altitude
            ),
            orientation: {
                heading: 0,
                pitch: CesiumMath.toRadians(-60),
                roll: 0,
            },
            duration: 1.5,
        });
    }, [currentPosition]);

    // ViewerのPropsをメモ化（再レンダリング時のクラッシュ防止）
    const contextOptions = useMemo(() => ({
        webgl: {
            alpha: false,
            antialias: false,
            powerPreference: "high-performance" as const, // 型アサーション追加
            failIfMajorPerformanceCaveat: false,
        },
    }), []);

    const viewerStyle = useMemo(() => ({
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    }), []);

    return (
        <div className="map-container cesium-container">
            {/* UI Overlay Container */}
            <div className="app-container">
                {/* Top: 場所検索ボタン */}
                <div className="top-container">
                    <button className="glass-pill search-pill" onClick={() => setShowLocationSearch(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        場所を検索...
                    </button>
                </div>

                {/* ステータスメッセージ */}
                {statusMessage && (
                    <div className="map-status-message">
                        {statusMessage}
                    </div>
                )}

                {/* 右: マップ操作ボタン */}
                <div className="right-stack">
                    <button className="control-btn" onClick={locateMe} title="現在地">
                        {isLocating ? '...' : '📍'}
                    </button>
                    <button className="control-btn" onClick={resetCamera} title="カメラリセット">
                        🧭
                    </button>
                    <div className="zoom-stack">
                        <button className="zoom-btn" onClick={() => {
                            const viewer = viewerRef.current?.cesiumElement;
                            if (viewer) viewer.camera.zoomIn(100);
                        }}>+</button>
                        <div className="zoom-divider"></div>
                        <button className="zoom-btn" onClick={() => {
                            const viewer = viewerRef.current?.cesiumElement;
                            if (viewer) viewer.camera.zoomOut(100);
                        }}>−</button>
                    </div>
                </div>

                {/* 下: モード選択 + 配置ボタン */}
                <div className="bottom-container">
                    <button className="glass-pill btn-layers" onClick={() => setShowModeSelect(!showModeSelect)}>
                        {getPlaceModeLabel()}
                    </button>

                    <button className="fab-create" onClick={placeObject} disabled={!crosshairPosition}>
                        <div className="fab-icon">＋</div>
                        配置
                    </button>
                </div>

                {/* モード選択パネル */}
                {showModeSelect && (
                    <div className="mode-select-panel">
                        <button className={`mode-select-item ${placeMode === 'static' ? 'active' : ''}`} onClick={() => { setPlaceMode('static'); setShowModeSelect(false); }}>
                            <span className="mode-icon">📍</span>
                            <span className="mode-label">ピン</span>
                        </button>
                        <button className={`mode-select-item ${placeMode === 'ugc' ? 'active' : ''}`} onClick={() => { setPlaceMode('ugc'); setShowModeSelect(false); }}>
                            <span className="mode-icon">🎨</span>
                            <span className="mode-label">クリエイト</span>
                        </button>
                        <button className={`mode-select-item ${placeMode === 'dragon' ? 'active' : ''}`} onClick={() => { setPlaceMode('dragon'); setShowModeSelect(false); }}>
                            <span className="mode-icon">🐉</span>
                            <span className="mode-label">ドラゴン</span>
                        </button>
                        <button className={`mode-select-item ${placeMode === 'bird' ? 'active' : ''}`} onClick={() => { setPlaceMode('bird'); setShowModeSelect(false); }}>
                            <span className="mode-icon">🦅</span>
                            <span className="mode-label">鳥</span>
                        </button>
                        <button className={`mode-select-item ${placeMode === 'ufo' ? 'active' : ''}`} onClick={() => { setPlaceMode('ufo'); setShowModeSelect(false); }}>
                            <span className="mode-icon">🛸</span>
                            <span className="mode-label">UFO</span>
                        </button>
                    </div>
                )}
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
                        baseLayerPicker={false}
                        navigationHelpButton={false}
                        homeButton={false}
                        geocoder={false}
                        sceneModePicker={false}
                        selectionIndicator={false}
                        infoBox={false}
                        showRenderLoopErrors={false}
                        contextOptions={contextOptions}
                        requestRenderMode={true}
                        maximumRenderTimeChange={Infinity}
                        style={viewerStyle}
                    >
                        {cameraDestination && (
                            <CameraFlyTo
                                destination={cameraDestination}
                                orientation={{ heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 }}
                                duration={2}
                                once
                            />
                        )}

                        {/* 静止オブジェクト & UGC */}
                        {allObjects.filter(obj => obj.objectType !== 'flying').map((obj) => {
                            const displayAltitude = (obj.position.altitude || 0);
                            const isOwn = obj.ownerId === userId || !obj.ownerId;

                            // UGC: TEXT handling
                            if (obj.objectType === 'ugc' && obj.ugcType === 'TEXT' && obj.ugcData) {
                                return (
                                    <Entity
                                        key={obj.id}
                                        position={Cartesian3.fromDegrees(
                                            obj.position.longitude,
                                            obj.position.latitude,
                                            displayAltitude + 5 // 少し浮かせる
                                        )}
                                        label={{
                                            text: obj.ugcData.text || 'Text',
                                            font: `${obj.ugcData.fontSize || 24}px sans-serif`,
                                            fillColor: Color.fromCssColorString(obj.ugcData.fontColor || '#ffffff'),
                                            outlineColor: Color.BLACK,
                                            outlineWidth: 4,
                                            style: 2, // FILL_AND_OUTLINE
                                            verticalOrigin: VerticalOrigin.CENTER,
                                            distanceDisplayCondition: { near: 0, far: 5000 } as any,
                                            scale: obj.ugcData.scale || 1.0,
                                        }}
                                        onClick={() => {
                                            setSelectedObject({ id: obj.id, name: obj.ugcData?.text || 'Text' });
                                        }}
                                    />
                                );
                            }

                            // UGC: MEDIA (Photo) handling
                            if (obj.objectType === 'ugc' && obj.ugcType === 'MEDIA' && obj.ugcData) {
                                return (
                                    <Entity
                                        key={obj.id}
                                        position={Cartesian3.fromDegrees(
                                            obj.position.longitude,
                                            obj.position.latitude,
                                            displayAltitude + 5
                                        )}
                                        billboard={{
                                            image: obj.ugcData.url || '/pin.png', // URLがあればそれを表示
                                            width: 64 * (obj.ugcData.scale || 1),
                                            height: 64 * (obj.ugcData.scale || 1),
                                            verticalOrigin: VerticalOrigin.BOTTOM,
                                            distanceDisplayCondition: { near: 0, far: 5000 } as any,
                                        }}
                                        label={{
                                            text: '📷 Photo',
                                            font: '12px sans-serif',
                                            style: 2,
                                            pixelOffset: new Cartesian2(0, -10),
                                            verticalOrigin: VerticalOrigin.TOP,
                                            distanceDisplayCondition: { near: 0, far: 1000 } as any,
                                        }}
                                        onClick={() => setSelectedObject({ id: obj.id, name: '📷 Photo' })}
                                    />
                                );
                            }

                            // UGC: MODEL (GLB) handling
                            if (obj.objectType === 'ugc' && obj.ugcType === 'MODEL' && obj.ugcData) {
                                return (
                                    <Entity
                                        key={obj.id}
                                        position={Cartesian3.fromDegrees(
                                            obj.position.longitude,
                                            obj.position.latitude,
                                            displayAltitude
                                        )}
                                        model={{
                                            uri: obj.ugcData.modelUrl || '', // GLB URL
                                            scale: 10.0 * (obj.ugcData.scale || 1), // 地図上では大きく表示しないと見えない
                                            minimumPixelSize: 64,
                                        }}
                                        label={{
                                            text: '📦 Model',
                                            font: '12px sans-serif',
                                            pixelOffset: new Cartesian2(0, -50),
                                            distanceDisplayCondition: { near: 0, far: 1000 } as any,
                                        }}
                                        onClick={() => setSelectedObject({ id: obj.id, name: '📦 Model' })}
                                    />
                                );
                            }

                            // UGC: AUDIO handling
                            if (obj.objectType === 'ugc' && obj.ugcType === 'AUDIO') {
                                return (
                                    <Entity
                                        key={obj.id}
                                        position={Cartesian3.fromDegrees(
                                            obj.position.longitude,
                                            obj.position.latitude,
                                            displayAltitude + 2
                                        )}
                                        billboard={{
                                            image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBmZjAwIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAxYTMgMyAwIDAgMCAzIDN2OGEzIDMgMCAwIDAtMyAzIDMgMyAwIDAgMC0zLTNWM2EzIDMgMCAwIDAgMy0zek0xOSAxMHYyYTcgNyAwIDAgMS0xNCAwdjEwaDIiLz48L3N2Zz4=', // Simple Mic/Speaker Icon (SVG base64 ideally, using text for now or simple circle)
                                            // 簡易的な音楽アイコンの代わりにEmojiや色付き丸を使う
                                            color: Color.LIME,
                                            width: 32,
                                            height: 32,
                                        }}
                                        label={{
                                            text: '🔊 Audio Spot',
                                            font: '14px sans-serif',
                                            fillColor: Color.LIME,
                                            outlineColor: Color.BLACK,
                                            style: 2,
                                            pixelOffset: new Cartesian2(0, -20),
                                        }}
                                        onClick={() => setSelectedObject({ id: obj.id, name: '🔊 Audio Spot' })}
                                    />
                                );
                            }

                            // Static Pin Objects
                            return (
                                <Entity
                                    key={obj.id}
                                    position={Cartesian3.fromDegrees(
                                        obj.position.longitude,
                                        obj.position.latitude,
                                        displayAltitude + 2
                                    )}
                                    point={{
                                        pixelSize: 24,
                                        color: Color.fromCssColorString(obj.color),
                                        outlineColor: Color.WHITE,
                                        outlineWidth: 3,
                                        distanceDisplayCondition: { near: 0, far: 50000 } as any,
                                    }}
                                    label={{
                                        text: `${obj.name}${!isOwn ? ' 👤' : ''}`,
                                        font: 'bold 16px sans-serif',
                                        fillColor: Color.WHITE,
                                        outlineColor: Color.BLACK,
                                        outlineWidth: 4,
                                        style: 2, // FILL_AND_OUTLINE
                                        pixelOffset: new Cartesian2(0, -22),
                                        verticalOrigin: VerticalOrigin.BOTTOM,
                                        distanceDisplayCondition: { near: 0, far: 20000 } as any,
                                    }}
                                    onClick={() => {
                                        setSelectedObject({ id: obj.id, name: obj.name });
                                    }}
                                />
                            );
                        })}

                        {/* 飛行オブジェクト */}
                        {allObjects.filter(obj => obj.objectType === 'flying').map((obj) => {
                            const pos = flyingPositions.get(obj.id) || obj.position;
                            const flyAlt = Math.max(pos.altitude || 0, 20);
                            const isOwn = obj.ownerId === userId || !obj.ownerId;
                            const iconUrl = obj.creature === 'dragon' ? '/dragon.png' :
                                obj.creature === 'bird' ? '/bird.png' :
                                    obj.creature === 'ufo' ? '/ufo.png' : '/dragon.png';

                            return (
                                <Entity
                                    key={obj.id}
                                    position={Cartesian3.fromDegrees(pos.longitude, pos.latitude, flyAlt)}
                                    billboard={{
                                        image: iconUrl,
                                        width: 72,
                                        height: 72,
                                        verticalOrigin: VerticalOrigin.CENTER,
                                        distanceDisplayCondition: { near: 0, far: 50000 } as any,
                                    }}
                                    label={{
                                        text: `${obj.name}${!isOwn ? ' 👤' : ''}`,
                                        font: '14px sans-serif',
                                        fillColor: isOwn ? Color.WHITE : Color.CYAN,
                                        outlineColor: Color.BLACK,
                                        outlineWidth: 2,
                                        pixelOffset: new Cartesian2(0, -35),
                                        style: 2,
                                    }}
                                    onClick={() => {
                                        setSelectedObject({ id: obj.id, name: obj.name });
                                    }}
                                />
                            );
                        })}


                        {/* ソーシャル: 他のユーザー（オーブ） */}
                        {Array.from(onlineUsers.values()).map((user) => (
                            <Entity
                                key={user.userId}
                                position={Cartesian3.fromDegrees(
                                    user.position.longitude,
                                    user.position.latitude,
                                    (user.position.altitude || 0) + 2
                                )}
                                point={{
                                    pixelSize: 15,
                                    color: Color.fromCssColorString(user.color).withAlpha(0.6),
                                    outlineColor: Color.WHITE,
                                    outlineWidth: 2,
                                }}
                                label={{
                                    text: 'Other User', // 名前はまだない
                                    font: '10px sans-serif',
                                    fillColor: Color.WHITE,
                                    outlineWidth: 2,
                                    style: 2,
                                    pixelOffset: new Cartesian2(0, -20),
                                    distanceDisplayCondition: { near: 0, far: 2000 } as any,
                                }}
                            />
                        ))}

                        {/* ソーシャル: 足跡（他人の痕跡） */}
                        {otherFootprints.length > 1 && (
                            <Entity
                                polyline={{
                                    positions: Cartesian3.fromDegreesArrayHeights(
                                        otherFootprints.flatMap(p => [p.longitude, p.latitude, (p.altitude || 0) + 1])
                                    ),
                                    width: 5,
                                    material: Color.CYAN.withAlpha(0.3),
                                }}
                            />
                        )}
                    </Viewer>

                    {/* 照準 */}
                    <div className="crosshair">
                        <div className="crosshair-v"></div>
                        <div className="crosshair-h"></div>
                        <div className="crosshair-circle"></div>
                    </div>
                </ErrorBoundary>
            </div>



            {/* ソーシャルスレッド */}
            {selectedObject && (
                <SocialThread
                    objectId={selectedObject.id}
                    objectName={selectedObject.name}
                    onClose={() => setSelectedObject(null)}
                />
            )}

            {/* オブジェクト数表示（タップでリスト表示） */}
            {allObjects.length > 0 && (
                <button className="object-count-floating" onClick={() => setShowObjectList(true)}>
                    {allObjects.length} オブジェクト
                </button>
            )}

            {/* オブジェクト一覧パネル */}
            <ObjectListPanel
                isOpen={showObjectList}
                onClose={() => setShowObjectList(false)}
            />

            <LocationSearchPanel
                isOpen={showLocationSearch}
                onSelectLocation={(pos, name) => {
                    setCurrentPosition(pos);
                    setShowLocationSearch(false);
                    setStatusMessage(`${name}を表示`);
                }}
                onClose={() => setShowLocationSearch(false)}
            />

            <UGCCreatorPanel
                isOpen={showUGCPanel}
                onClose={() => setShowUGCPanel(false)}
                onCreate={(type, props) => {
                    if (crosshairPosition) {
                        const groundAltitude = crosshairPosition.altitude || 0;
                        const positionWithAltitude: GeoPosition = {
                            ...crosshairPosition,
                            altitude: groundAltitude + placeAltitude,
                        };
                        addUGCObject(positionWithAltitude, type, props);
                        setStatusMessage('配置しました！');
                        setShowUGCPanel(false);
                    }
                }}
            />
        </div>
    );
}
