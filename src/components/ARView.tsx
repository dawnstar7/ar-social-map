import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useObjectStore } from '../store/objectStore';
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
        const objectAlt = pos.altitude || 0;
        const y = Math.max(objectAlt - 1.6, 2);
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

    const size = Math.max(1, Math.min(5, distance / 10));
    const isFlyingObject = object.objectType === 'flying';

    return (
        <group
            ref={groupRef}
            position={isFlyingObject ? [0, 0, 0] : initialPosition}
        >
            <mesh>
                <sphereGeometry args={[size, 16, 16]} />
                <meshBasicMaterial color={object.color} transparent opacity={0.9} />
            </mesh>
            <mesh>
                <sphereGeometry args={[size * 1.1, 16, 16]} />
                <meshBasicMaterial color="white" transparent opacity={0.3} side={THREE.BackSide} />
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

    const { objects: userObjects, publicObjects } = useObjectStore();
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
                    <ARScene
                        objects={allObjects}
                        devicePosition={devicePosition}
                        heading={heading}
                        beta={beta}
                        gamma={gamma}
                    />
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
