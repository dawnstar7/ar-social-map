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
import { calculateCurrentPosition } from '../utils/flyingBehavior';
import { getDeveloperObjectsAsPlaced } from '../utils/developerObjects';
import { ObjectListPanel } from './ObjectListPanel';
import { LocationSearchPanel } from './LocationSearchPanel';
import { calculateDistance } from '../utils/coordinates';
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
    const [tilesFailed, setTilesFailed] = useState(false);
    const [statusMessage, setStatusMessage] = useState('初期化中...');
    const [crosshairPosition, setCrosshairPosition] = useState<GeoPosition | null>(null);

    // 配置モード
    const [placeMode, setPlaceMode] = useState<PlaceMode>('static');
    const [showModeSelect, setShowModeSelect] = useState(false);
    const [showObjectList, setShowObjectList] = useState(false);
    const [showLocationSearch, setShowLocationSearch] = useState(false);
    const [placeAltitude, setPlaceAltitude] = useState(0);

    // 飛行オブジェクトの現在位置（リアルタイム更新）
    const [flyingPositions, setFlyingPositions] = useState<Map<string, GeoPosition>>(new Map());

    const { objects: userObjects, publicObjects, addObject, addFlyingObject, removeObject, clearAll, userId } = useObjectStore();

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
            {/* ヘッダー */}
            <div className="map-header">
                <h2>🌍 3Dマップ</h2>
                <div className="header-buttons">
                    <button className="icon-btn" onClick={() => setShowLocationSearch(true)} title="検索">
                        🔍
                    </button>
                    <button className="icon-btn" onClick={resetCamera} disabled={!currentPosition} title="カメラリセット">
                        🔄
                    </button>
                    <button className="icon-btn" onClick={locateMe} disabled={isLocating} title="現在地">
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
                        baseLayerPicker={true}
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

                        {/* 静止オブジェクト */}
                        {allObjects.filter(obj => obj.objectType !== 'flying').map((obj) => {
                            const displayAltitude = (obj.position.altitude || 0) + 2;
                            const isOwn = obj.ownerId === userId || !obj.ownerId;
                            return (
                                <Entity
                                    key={obj.id}
                                    position={Cartesian3.fromDegrees(
                                        obj.position.longitude,
                                        obj.position.latitude,
                                        displayAltitude
                                    )}
                                    // 3D球体（オーブ）として表示
                                    ellipsoid={{
                                        radii: new Cartesian3(5.0, 5.0, 5.0), // 半径5mの真球
                                        material: Color.fromCssColorString(obj.color).withAlpha(0.9),
                                        outline: true,
                                        outlineColor: Color.WHITE,
                                        outlineWidth: 2,
                                    }}
                                    label={{
                                        text: `${obj.name}${!isOwn ? ' 👤' : ''}\n海抜${obj.position.altitude?.toFixed(0) || 0}m`,
                                        font: '14px sans-serif',
                                        fillColor: Color.WHITE,
                                        outlineColor: Color.BLACK,
                                        outlineWidth: 4,
                                        style: 2, // FILL_AND_OUTLINE
                                        pixelOffset: new Cartesian2(0, -60), // 球体の上に出るように調整
                                        verticalOrigin: VerticalOrigin.BOTTOM,
                                        distanceDisplayCondition: {
                                            near: 0,
                                            far: 10000,
                                        } as any // 型定義回避
                                    }}
                                    onClick={() => {
                                        if (isOwn) {
                                            removeObject(obj.id);
                                            setStatusMessage('削除');
                                        } else {
                                            setStatusMessage(`${obj.name}（他ユーザーのオブジェクト）`);
                                        }
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
                                        width: 48,
                                        height: 48,
                                        verticalOrigin: VerticalOrigin.CENTER,
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
                                        if (isOwn) {
                                            removeObject(obj.id);
                                            setStatusMessage('削除');
                                        } else {
                                            setStatusMessage(`${obj.name}（他ユーザーのオブジェクト）`);
                                        }
                                    }}
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

            {/* 高度スライダー */}
            <div className="altitude-control">
                <label className="altitude-label">
                    地面から: <strong>+{placeAltitude}m</strong>
                    {crosshairPosition && (
                        <span className="altitude-detail">
                            （海抜{((crosshairPosition.altitude || 0) + placeAltitude).toFixed(0)}m）
                        </span>
                    )}
                </label>
                <input
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={placeAltitude}
                    onChange={(e) => setPlaceAltitude(Number(e.target.value))}
                    className="altitude-slider"
                />
                <div className="altitude-presets">
                    <button onClick={() => setPlaceAltitude(0)} className={placeAltitude === 0 ? 'active' : ''}>地面</button>
                    <button onClick={() => setPlaceAltitude(10)} className={placeAltitude === 10 ? 'active' : ''}>10m</button>
                    <button onClick={() => setPlaceAltitude(50)} className={placeAltitude === 50 ? 'active' : ''}>50m</button>
                    <button onClick={() => setPlaceAltitude(100)} className={placeAltitude === 100 ? 'active' : ''}>100m</button>
                    <button onClick={() => setPlaceAltitude(200)} className={placeAltitude === 200 ? 'active' : ''}>200m</button>
                    <button onClick={() => setPlaceAltitude(500)} className={placeAltitude === 500 ? 'active' : ''}>500m</button>
                </div>
            </div>

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

            <LocationSearchPanel
                isOpen={showLocationSearch}
                onSelectLocation={(pos, name) => {
                    setCurrentPosition(pos);
                    setShowLocationSearch(false);
                    setStatusMessage(`${name}を表示`);
                }}
                onClose={() => setShowLocationSearch(false)}
            />

            {/* 重大エラーオーバーレイ */}
            {globalError && (
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    left: '10%',
                    right: '10%',
                    background: 'rgba(255, 0, 0, 0.9)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '10px',
                    zIndex: 9999,
                    pointerEvents: 'none'
                }}>
                    <h3>⚠️ システムエラー</h3>
                    <p style={{ fontSize: '12px', wordBreak: 'break-all' }}>{globalError}</p>
                </div>
            )}
        </div>
    );
}
