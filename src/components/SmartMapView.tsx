/**
 * SmartMapView - 3Dマップオーケストレーター
 *
 * 常にCesium 3Dマップを使用。
 * CesiumWidget初期化エラーが発生した場合のみLeafletにフォールバック。
 * エラーはMap3DView内のErrorBoundaryでキャッチする。
 */

import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { MapView } from './MapView';

const Map3DView = lazy(() => import('./Map3DView').then(m => ({ default: m.Map3DView })));

interface SmartMapViewProps {
    onNavigateToObject?: (position: { latitude: number; longitude: number }) => void;
}

const CESIUM_FAILED_KEY = 'cesium_widget_failed_v2';

export function SmartMapView({ onNavigateToObject }: SmartMapViewProps) {
    const [useFallback, setUseFallback] = useState<boolean | null>(null);

    useEffect(() => {
        // 過去にCesiumが失敗し、ユーザーがリセットしていなければフォールバック
        const previouslyFailed = localStorage.getItem(CESIUM_FAILED_KEY) === 'true';
        if (previouslyFailed) {
            setUseFallback(true);
            return;
        }

        // 常にCesium 3Dを試す
        setUseFallback(false);
    }, []);

    // Cesium初期化エラーをグローバルでキャッチ
    useEffect(() => {
        if (useFallback !== false) return;

        const handleError = (event: ErrorEvent) => {
            const msg = event.message || '';
            if (msg.includes('CesiumWidget') || msg.includes('WebGL') || msg.includes('Cesium') || msg.includes('cesium')) {
                console.warn('Cesium初期化エラーを検知、Leafletにフォールバック');
                localStorage.setItem(CESIUM_FAILED_KEY, 'true');
                setUseFallback(true);
                event.preventDefault();
            }
        };

        const handleUnhandled = (event: PromiseRejectionEvent) => {
            const reason = event.reason?.message || String(event.reason);
            if (reason.includes('CesiumWidget') || reason.includes('WebGL') || reason.includes('Cesium') || reason.includes('cesium')) {
                console.warn('Cesium Promise rejection、Leafletにフォールバック');
                localStorage.setItem(CESIUM_FAILED_KEY, 'true');
                setUseFallback(true);
                event.preventDefault();
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandled);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandled);
        };
    }, [useFallback]);

    const handleRetry3D = useCallback(() => {
        localStorage.removeItem(CESIUM_FAILED_KEY);
        setUseFallback(false);
    }, []);

    // Map3DViewからのフォールバックリクエスト
    const handleFallbackTo2D = useCallback(() => {
        localStorage.setItem(CESIUM_FAILED_KEY, 'true');
        setUseFallback(true);
    }, []);

    // 判定中
    if (useFallback === null) {
        return (
            <div className="map-container">
                <div className="map-header"><h2>🌍 マップ</h2></div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>マップを準備中...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Leaflet 2Dフォールバック（明示的にリクエストされた場合のみ）
    if (useFallback) {
        return <MapView onNavigateToObject={onNavigateToObject} onRetry3D={handleRetry3D} />;
    }

    // Cesium 3Dマップ（常にこちらを優先）
    return (
        <Suspense fallback={
            <div className="map-container">
                <div className="map-header"><h2>🌍 マップ</h2></div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>3Dマップを読み込み中...</p>
                    </div>
                </div>
            </div>
        }>
            <Map3DView onFallbackTo2D={handleFallbackTo2D} />
        </Suspense>
    );
}
