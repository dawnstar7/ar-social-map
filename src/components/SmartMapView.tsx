/**
 * SmartMapView - WebGL対応チェック付きマップオーケストレーター
 *
 * Cesium 3Dマップを優先的に表示し、WebGLエラー時はLeaflet 2Dマップにフォールバック。
 * 一度失敗したらlocalStorageにフラグ保存し、次回からLeaflet直接表示。
 */

import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { MapView } from './MapView';

const Map3DView = lazy(() => import('./Map3DView').then(m => ({ default: m.Map3DView })));

interface SmartMapViewProps {
    onNavigateToObject?: (position: { latitude: number; longitude: number }) => void;
}

const CESIUM_FAILED_KEY = 'cesium_failed';

function checkWebGLSupport(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

        if (!gl) return false;

        // Cesiumに必要な最低限のGPU性能チェック
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if (maxTextureSize < 4096) {
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
            return false;
        }

        // コンテキストを即座に解放
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();

        return true;
    } catch {
        return false;
    }
}

export function SmartMapView({ onNavigateToObject }: SmartMapViewProps) {
    const [useFallback, setUseFallback] = useState<boolean | null>(null);

    useEffect(() => {
        // 過去にCesiumが失敗したか確認
        const previouslyFailed = localStorage.getItem(CESIUM_FAILED_KEY) === 'true';
        if (previouslyFailed) {
            setUseFallback(true);
            return;
        }

        // WebGLサポートチェック
        const webglOk = checkWebGLSupport();
        if (!webglOk) {
            localStorage.setItem(CESIUM_FAILED_KEY, 'true');
            setUseFallback(true);
            return;
        }

        setUseFallback(false);
    }, []);

    // Cesium初期化エラーをグローバルでキャッチ
    useEffect(() => {
        if (useFallback !== false) return;

        const handleError = (event: ErrorEvent) => {
            if (event.message?.includes('CesiumWidget') || event.message?.includes('WebGL') || event.message?.includes('Cesium')) {
                console.warn('Cesium初期化エラーを検知、Leafletにフォールバック');
                localStorage.setItem(CESIUM_FAILED_KEY, 'true');
                setUseFallback(true);
                event.preventDefault();
            }
        };

        const handleUnhandled = (event: PromiseRejectionEvent) => {
            const reason = event.reason?.message || String(event.reason);
            if (reason.includes('CesiumWidget') || reason.includes('WebGL') || reason.includes('Cesium')) {
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

    // 判定中
    if (useFallback === null) {
        return (
            <div className="app loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>マップを準備中...</p>
                </div>
            </div>
        );
    }

    // Leaflet 2Dフォールバック
    if (useFallback) {
        return <MapView onNavigateToObject={onNavigateToObject} onRetry3D={handleRetry3D} />;
    }

    // Cesium 3Dマップ
    return (
        <Suspense fallback={
            <div className="app loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>3Dマップを読み込み中...</p>
                </div>
            </div>
        }>
            <Map3DView />
        </Suspense>
    );
}
