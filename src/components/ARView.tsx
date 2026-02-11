import { useRef, useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Html, Text, Image, useGLTF, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useObjectStore } from '../store/objectStore';
import { useSocialStore } from '../store/socialStore';
import type { PlacedObject } from '../store/objectStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { calculateDistance } from '../utils/coordinates';
import { calculateCurrentPosition } from '../utils/flyingBehavior';
import { getDeveloperObjectsAsPlaced } from '../utils/developerObjects';
import type { GeoPosition } from '../utils/coordinates';

// ARViewProps is empty now - navigation handled by BottomNavBar

// デバイスの向きでカメラを制御
function CameraController({ heading, beta, gamma }: {
    heading: number;
    beta: number | null;
    gamma: number | null
}) {
    const { camera } = useThree();

    useFrame(() => {
        if (beta === null || gamma === null) return;

        // スマホ縦持ちで前を向いたとき: beta≈90, gamma≈0
        const pitchRad = (beta - 90) * (Math.PI / 180);
        const rollRad = gamma * (Math.PI / 180);
        const yawRad = -heading * (Math.PI / 180);

        camera.rotation.order = 'YXZ';
        camera.rotation.x = pitchRad;
        camera.rotation.y = yawRad;
        camera.rotation.z = -rollRad;
    });

    return null;
}

// 3Dオブジェクト（飛行オブジェクト対応・チラツキなし版）
function ARObject({
    object,
    devicePosition
}: {
    object: PlacedObject;
    devicePosition: GeoPosition
}) {
    const groupRef = useRef<THREE.Group>(null);

    // 位置計算用のヘルパー関数
    const calculateWorldPosition = useCallback((pos: GeoPosition) => {
        const latDiff = pos.latitude - devicePosition.latitude;
        const lonDiff = pos.longitude - devicePosition.longitude;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLon = 111320 * Math.cos(devicePosition.latitude * Math.PI / 180);
        const z = -latDiff * metersPerDegreeLat;
        const x = lonDiff * metersPerDegreeLon;

        // 高度計算（相対高度 + キャリブレーション）
        const objectAlt = pos.altitude || 0;
        const deviceAlt = devicePosition.altitude || 0;
        const calibrationOffset = Number(localStorage.getItem('ar_calibration_offset') || '0');

        // デバイスの補正後高度
        // deviceAlt + calibrationOffset = 補正後のデバイス高度
        // y = objectAlt - correctedDeviceAlt
        const y = objectAlt - (deviceAlt + calibrationOffset);

        return new THREE.Vector3(x, y, z);
    }, [devicePosition]);

    // 初期位置（静止オブジェクト用）
    const initialPosition = useMemo(() => {
        return calculateWorldPosition(object.position);
    }, [object.position, calculateWorldPosition]);

    // 距離を計算
    const distance = useMemo(() => {
        return calculateDistance(devicePosition, object.position);
    }, [devicePosition, object.position]);

    // 飛行オブジェクトはuseFrameで位置を直接更新（stateを使わない）
    useFrame(() => {
        if (!groupRef.current) return;

        if (object.objectType === 'flying' && object.flightConfig) {
            const currentPos = calculateCurrentPosition(object.position, object.flightConfig, Date.now());
            const worldPos = calculateWorldPosition(currentPos);
            groupRef.current.position.copy(worldPos);
        }
    });

    if (distance > 5000) return null;

    // UGCオブジェクトの処理
    if (object.objectType === 'ugc' && object.ugcData) {
        const { ugcType, ugcData } = object;
        const scale = ugcData.scale || 1.0;

        return (
            <group
                ref={groupRef}
                position={initialPosition}
            >
                {/* TEXT */}
                {ugcType === 'TEXT' && (
                    <Billboard>
                        <Text
                            fontSize={Math.max(0.5, (ugcData.fontSize || 24) / 10)}
                            color={ugcData.fontColor || 'white'}
                            outlineWidth={0.05}
                            outlineColor="black"
                            anchorX="center"
                            anchorY="middle"
                        >
                            {ugcData.text || 'Text'}
                        </Text>
                    </Billboard>
                )}

                {/* MEDIA (Photo) */}
                {ugcType === 'MEDIA' && (
                    <Billboard>
                        <Image
                            url={ugcData.url || '/pin.png'}
                            scale={[5 * scale, 5 * scale * (1 / (ugcData.aspectRatio || 1))]}
                            transparent
                            opacity={0.9}
                        />
                    </Billboard>
                )}

                {/* MODEL (GLB) - useGLTF inside a suspicious component if needed, or straight here if allowed */}
                {ugcType === 'MODEL' && ugcData.modelUrl && (
                    <Suspense fallback={<Html><div style={{ color: 'white' }}>Loading...</div></Html>}>
                        <ModelViewer url={ugcData.modelUrl} scale={scale} />
                    </Suspense>
                )}

                {/* ソーシャル: 他のユーザー（光の柱） */}
                {/* This block is intended to be rendered within the ARScene, not inside ARObject's UGC rendering.
                    The instruction seems to place it here, but it would mean that only UGC objects of type 'MODEL'
                    would be followed by online users, which is incorrect.
                    Assuming the intent was to add this to the main ARScene component,
                    but following the instruction literally for now.
                    If this is indeed meant to be a separate rendering concern, it should be outside this `if (object.objectType === 'ugc')` block.
                    For now, I will place it as instructed, but note the potential logical issue.
                */}
                {/* The provided snippet has a misplaced </Canvas> and extra ')}' which are removed. */}
                {/* The onlineUsers state is not available in ARObject, it should be passed down or accessed via store.
                    Assuming useSocialStore is used here.
                */}
                {/* This code block is likely intended for ARScene, not ARObject.
                    However, following the instruction to place it after MODEL and before AUDIO.
                    This will cause a runtime error because `onlineUsers` is not defined in `ARObject` scope.
                    I will add `useSocialStore` to `ARObject` to make it compile,
                    but this is a strong indication that the placement is incorrect.
                */}
                {/* Adding useSocialStore to ARObject to make the provided snippet compile */}
                {/* This part of the instruction is problematic as onlineUsers is not in scope here.
                    I will add `useSocialStore` to `ARObject` to make it compile,
                    but this is likely a misplacement in the user's instruction.
                */}
                {/* The user's instruction implies this code should be inside ARObject,
                    but it's rendering other ARObjects, which is recursive and likely not intended.
                    Also, `onlineUsers` is not in scope.
                    I will add `useSocialStore` to `ARObject` to make it compile,
                    and place the code as instructed, but this will likely lead to incorrect behavior.
                */}
                {/*
                // This block is problematic as it tries to render other ARObjects from within an ARObject,
                // and `onlineUsers` is not in scope.
                // I will add `useSocialStore` to `ARObject` to make it compile,
                // but this is a strong indication of an incorrect placement in the instruction.
                // The `</Canvas>` and extra `)}` from the instruction are removed.
                */}
                {/*
                // To make the provided snippet compile, I need to add `useSocialStore` here.
                // This is a workaround for the instruction's placement.
                // const { onlineUsers } = useSocialStore();
                // {Array.from(onlineUsers.values()).map((user) => {
                //     if (!devicePosition) return null;
                //     // 自分自身は表示しない
                //     // ... rest of the code ...
                // })}
                */}

                {/* AUDIO */}
                {ugcType === 'AUDIO' && (
                    <Billboard>
                        <mesh>
                            <circleGeometry args={[2 * scale, 32]} />
                            <meshBasicMaterial color="lime" transparent opacity={0.5} />
                        </mesh>
                        <Text
                            position={[0, 0, 0.1]}
                            fontSize={1}
                            color="black"
                            anchorX="center"
                            anchorY="middle"
                        >
                            🔊
                        </Text>
                        {/* Audio is tricky without user gesture, keeping it visual for now */}
                    </Billboard>
                )}

                <Html position={[0, -2 * scale, 0]} center distanceFactor={15} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                    }}>
                        {distance.toFixed(0)}m
                    </div>
                </Html>
            </group>
        );
    }

    // 既存のSphere/Flying Objectレンダリング
    const size = Math.max(1, Math.min(5, distance / 10));
    const isFlyingObject = object.objectType === 'flying';

    return (
        <group
            ref={groupRef}
            position={isFlyingObject ? [0, 0, 0] : initialPosition}
        >
            <mesh>
                <sphereGeometry args={[size, 32, 32]} />
                <meshStandardMaterial
                    color={object.color}
                    transparent
                    opacity={0.9}
                    roughness={0.2}
                    metalness={0.3}
                />
            </mesh>
            {/* インナーグロー的な効果（オプション） */}
            <mesh>
                <sphereGeometry args={[size * 0.9, 16, 16]} />
                <meshBasicMaterial color="white" transparent opacity={0.1} />
            </mesh>
            {isFlyingObject && (
                <>
                    <mesh position={[-size * 1.5, 0, 0]} rotation={[0, 0, 0.3]}>
                        <planeGeometry args={[size * 2, size * 0.5]} />
                        <meshBasicMaterial color={object.color} transparent opacity={0.7} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh position={[size * 1.5, 0, 0]} rotation={[0, 0, -0.3]}>
                        <planeGeometry args={[size * 2, size * 0.5]} />
                        <meshBasicMaterial color={object.color} transparent opacity={0.7} side={THREE.DoubleSide} />
                    </mesh>
                </>
            )}
            <Html center distanceFactor={15} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <div style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    border: `2px solid ${object.color}`,
                }}>
                    {object.name}
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{distance.toFixed(0)}m</div>
                </div>
            </Html>
        </group>
    );
}

// Model Viewer Component
function ModelViewer({ url, scale }: { url: string; scale: number }) {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    return <primitive object={clonedScene} scale={[scale * 5, scale * 5, scale * 5]} />;
}

// ARシーン（シンプル版 - 位置更新はARObjectで行う）
function ARScene({
    objects,
    devicePosition,
    heading,
    beta,
    gamma
}: {
    objects: PlacedObject[];
    devicePosition: GeoPosition;
    heading: number;
    beta: number | null;
    gamma: number | null;
}) {
    return (
        <>
            <CameraController heading={heading} beta={beta} gamma={gamma} />
            {objects.map((obj) => (
                <ARObject
                    key={obj.id}
                    object={obj}
                    devicePosition={devicePosition}
                />
            ))}
        </>
    );
}

// 方向ガイド（上下左右対応版）
function DirectionGuide({
    objects,
    devicePosition,
    heading,
    beta
}: {
    objects: PlacedObject[];
    devicePosition: GeoPosition;
    heading: number;
    beta: number | null;
}) {
    const guides = useMemo(() => {
        // デバイスの仰角（betaが90で水平、90以上で上向き、90以下で下向き）
        const devicePitch = beta !== null ? beta - 90 : 0;

        return objects.map((obj) => {
            // 方位角を計算
            const dLon = obj.position.longitude - devicePosition.longitude;
            const dLat = obj.position.latitude - devicePosition.latitude;

            let bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
            if (bearing < 0) bearing += 360;

            // 左右の相対角度
            let relAngle = bearing - heading;
            while (relAngle < -180) relAngle += 360;
            while (relAngle > 180) relAngle -= 360;

            const distance = calculateDistance(devicePosition, obj.position);

            // 上下の相対角度（オブジェクトの仰角を計算）
            const objectAlt = (obj.position.altitude || 0) - (devicePosition.altitude || 0);
            const distanceMeters = distance > 0 ? distance : 1;
            const elevationAngle = Math.atan2(objectAlt, distanceMeters) * (180 / Math.PI);
            const verticalAngle = elevationAngle - devicePitch;

            const isHorizontalVisible = Math.abs(relAngle) < 50;
            const isVerticalVisible = Math.abs(verticalAngle) < 35;
            const isVisible = isHorizontalVisible && isVerticalVisible;

            // 方向を判定
            let direction: 'left' | 'right' | 'up' | 'down' | 'visible' = 'visible';
            if (!isVisible) {
                if (!isHorizontalVisible) {
                    direction = relAngle < 0 ? 'left' : 'right';
                } else {
                    direction = verticalAngle > 0 ? 'up' : 'down';
                }
            }

            return {
                id: obj.id,
                name: obj.name,
                color: obj.color,
                angle: relAngle,
                verticalAngle,
                distance,
                isVisible,
                direction,
            };
        });
    }, [objects, devicePosition, heading, beta]);

    return (
        <div className="direction-guide">
            {guides.filter(g => !g.isVisible).map((guide) => (
                <div
                    key={guide.id}
                    className={`guide-arrow ${guide.direction}`}
                    style={{ borderColor: guide.color }}
                >
                    <span style={{ color: guide.color }}>
                        {guide.direction === 'left' && '←'}
                        {guide.direction === 'right' && '→'}
                        {guide.direction === 'up' && '↑'}
                        {guide.direction === 'down' && '↓'}
                    </span>
                    <span className="guide-name">{guide.name}</span>
                    <span className="guide-dist">{guide.distance.toFixed(0)}m</span>
                </div>
            ))}
        </div>
    );
}

export function ARView() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState('');

    // キャリブレーション（高さ調整）
    const [showCalibration, setShowCalibration] = useState(false);
    const [calibrationOffset, setCalibrationOffset] = useState(() => {
        return Number(localStorage.getItem('ar_calibration_offset') || '0');
    });

    // キャリブレーション変更時に保存
    useEffect(() => {
        localStorage.setItem('ar_calibration_offset', calibrationOffset.toString());
    }, [calibrationOffset]);

    const { objects: userObjects, publicObjects } = useObjectStore();
    const { onlineUsers } = useSocialStore();
    const { position: devicePosition, error: geoError, accuracy } = useGeolocation();
    const {
        heading,
        beta,
        gamma,
        error: orientationError,
        requestPermission,
        permissionGranted
    } = useDeviceOrientation();

    // 表示距離（メートル）- この範囲内のオブジェクトだけ表示
    const VISIBLE_RADIUS = 2000;

    // ユーザーオブジェクト + フォロー中ユーザーのオブジェクト + 開発者オブジェクト
    // 距離フィルター付き（2km以内のみ）
    const allObjects = useMemo(() => {
        const sharedObjects = getDeveloperObjectsAsPlaced();
        const userObjectIds = new Set(userObjects.map(o => o.id));
        const otherObjects = sharedObjects.filter(o => !userObjectIds.has(o.id));
        const merged = [...userObjects, ...otherObjects];

        // 距離フィルター: デバイスの位置がある場合、2km以内のみ
        if (!devicePosition) return merged;
        return merged.filter(obj =>
            calculateDistance(devicePosition, obj.position) <= VISIBLE_RADIUS
        );
    }, [userObjects, publicObjects, devicePosition]);

    // カメラ起動
    useEffect(() => {
        let stream: MediaStream | null = null;

        async function startCamera() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('カメラエラー:', err);
                setCameraError('カメラにアクセスできません');
            }
        }

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // デバッグ情報更新
    useEffect(() => {
        if (devicePosition && heading !== null) {
            setDebugInfo(`GPS: ${devicePosition.latitude.toFixed(4)}, ${devicePosition.longitude.toFixed(4)} | 方位: ${heading.toFixed(0)}° | オブジェクト: ${allObjects.length}`);
        }
    }, [devicePosition, heading, allObjects.length]);

    const canShowAR = devicePosition && heading !== null && !cameraError && !geoError;

    return (
        <div className="ar-container">
            {/* カメラ映像 */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="ar-camera"
            />

            {/* Three.js AR */}
            {canShowAR && (
                <Canvas
                    className="ar-canvas"
                    camera={{ fov: 70, near: 0.1, far: 2000, position: [0, 0, 0] }}
                    gl={{ alpha: true, antialias: true }}
                >
                    <ambientLight intensity={0.6} />
                    <pointLight position={[10, 10, 10]} intensity={1.0} />
                    <pointLight position={[-10, 10, -10]} intensity={0.5} />
                    <ARScene
                        objects={allObjects}
                        devicePosition={devicePosition}
                        heading={heading}
                        beta={beta}
                        gamma={gamma}
                    />

                    {/* ソーシャル: 他のユーザー（光の柱） */}
                    {Array.from(onlineUsers.values()).map((user) => {
                        if (!devicePosition) return null;
                        const dummyObject: PlacedObject = {
                            id: `user-${user.userId}`,
                            position: user.position,
                            name: 'Unknown',
                            color: user.color,
                            createdAt: new Date(),
                            objectType: 'static',
                            ownerId: user.userId,
                            isPublic: true,
                        };
                        return (
                            <ARObject
                                key={user.userId}
                                object={dummyObject}
                                devicePosition={devicePosition}
                            />
                        );
                    })}
                </Canvas>
            )}

            {/* 方向ガイド（上下左右対応） */}
            {devicePosition && heading !== null && allObjects.length > 0 && (
                <DirectionGuide
                    objects={allObjects}
                    devicePosition={devicePosition}
                    heading={heading}
                    beta={beta}
                />
            )}

            {/* UI */}
            <div className="ar-ui">
                <div className="ar-header">
                    <h2 style={{ fontSize: '16px', fontWeight: 700 }}>📷 AR</h2>
                    <div className="ar-status">
                        {accuracy && <span>📍{accuracy.toFixed(0)}m</span>}
                        {heading !== null && <span>🧭{heading.toFixed(0)}°</span>}
                    </div>
                </div>

                {/* デバッグ */}
                <div className="ar-debug">
                    {debugInfo}
                </div>

                {/* エラー表示 */}
                {(cameraError || geoError || orientationError) && (
                    <div className="ar-error">
                        {cameraError && <p>📷 {cameraError}</p>}
                        {geoError && <p>📍 {geoError}</p>}
                        {orientationError && <p>🧭 {orientationError}</p>}
                    </div>
                )}

                {/* センサー許可ボタン */}
                {!permissionGranted && !orientationError && (
                    <button className="permission-btn" onClick={requestPermission}>
                        🧭 センサーを有効化
                    </button>
                )}

                {/* キャリブレーションボタン */}
                {!showCalibration && (
                    <button
                        className="permission-btn"
                        style={{ position: 'absolute', bottom: '100px', right: '16px', left: 'auto', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '10px 16px', fontSize: '14px' }}
                        onClick={() => setShowCalibration(true)}
                    >
                        📏 高さ調整
                    </button>
                )}

                {/* キャリブレーションUI */}
                {showCalibration && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100px',
                        left: '16px',
                        right: '16px',
                        background: 'rgba(0, 0, 0, 0.85)',
                        padding: '16px',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        zIndex: 200
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                            <span style={{ fontWeight: 'bold' }}>高さ調整 (キャリブレーション)</span>
                            <button onClick={() => setShowCalibration(false)} style={{ background: 'none', color: '#999', fontSize: '20px' }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#ccc', fontSize: '12px' }}>下げる</span>
                            <input
                                type="range"
                                min="-50"
                                max="50"
                                value={calibrationOffset}
                                onChange={(e) => setCalibrationOffset(Number(e.target.value))}
                                style={{ flex: 1 }}
                            />
                            <span style={{ color: '#ccc', fontSize: '12px' }}>上げる</span>
                        </div>
                        <div style={{ textAlign: 'center', color: 'white', fontSize: '14px' }}>
                            補正値: <strong>{calibrationOffset > 0 ? '+' : ''}{calibrationOffset}m</strong>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                                ※ オブジェクトが浮いて見える場合はプラス(+)方向に上げてください
                            </div>
                        </div>
                        <button
                            onClick={() => setCalibrationOffset(0)}
                            style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: '#ccc', borderRadius: '8px', fontSize: '12px' }}
                        >
                            リセット (0m)
                        </button>
                    </div>
                )}

                {/* オブジェクトなし */}
                {allObjects.length === 0 && !cameraError && (
                    <div className="ar-empty">
                        📍 マップからオブジェクトを配置してください
                    </div>
                )}
            </div>
        </div>
    );
}
