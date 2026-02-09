/**
 * SmartMapView - WebGL対応チェック付きマップオーケストレーター
 *
 * Safari/WebKit → 即Leafletフォールバック（CesiumWidgetエラー回避）
 * その他 → Cesium 3D優先、失敗時Leafletフォールバック
 * localStorage記憶で次回から即フォールバック
 */

import { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { MapView } from './MapView';

const Map3DView = lazy(() => import('./Map3DView').then(m => ({ default: m.Map3DView })));

interface SmartMapViewProps {
    onNavigateToObject?: (position: { latitude: number; longitude: number }) => void;
}

const CESIUM_FAILED_KEY = 'cesium_failed';

// Safari/WebKit検出
function isSafariOrWebKit(): boolean {
    const ua = navigator.userAgent;
    // Safari（デスクトップ/モバイル）
    if (/Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)) return true;
    // iOS WebView（全iOSブラウザはWebKit）
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    // WebKit系
    if (/AppleWebKit/.test(ua) && !/Chrome/.test(ua)) return true;
    return false;
}

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
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // 過去にCesiumが失敗したか確認
        const previouslyFailed = localStorage.getItem(CESIUM_FAILED_KEY) === 'true';
        if (previouslyFailed) {
            setUseFallback(true);
            return;
        }

        // Safari/WebKit → CesiumWidgetエラーが出るので即フォールバック
        if (isSafariOrWebKit()) {
            console.warn('Safari/WebKit検出: Cesiumをスキップし、Leaflet 2Dマップを使用');
            localStorage.setItem(CESIUM_FAILED_KEY, 'true');
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

    // Cesium初期化エラーをグローバルでキャッチ + タイムアウトフォールバック
    useEffect(() => {
        if (useFallback !== false) return;

        // 8秒タイムアウト: Cesiumが初期化に時間がかかりすぎたらフォールバック
        fallbackTimerRef.current = setTimeout(() => {
            console.warn('Cesium初期化タイムアウト、Leafletにフォールバック');
            localStorage.setItem(CESIUM_FAILED_KEY, 'true');
            setUseFallback(true);
        }, 8000);

        const handleError = (event: ErrorEvent) => {
            const msg = event.message || '';
            if (msg.includes('CesiumWidget') || msg.includes('WebGL') || msg.includes('Cesium') || msg.includes('cesium')) {
                console.warn('Cesium初期化エラーを検知、Leafletにフォールバック');
                localStorage.setItem(CESIUM_FAILED_KEY, 'true');
                setUseFallback(true);
                event.preventDefault();
                if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
            }
        };

        const handleUnhandled = (event: PromiseRejectionEvent) => {
            const reason = event.reason?.message || String(event.reason);
            if (reason.includes('CesiumWidget') || reason.includes('WebGL') || reason.includes('Cesium') || reason.includes('cesium')) {
                console.warn('Cesium Promise rejection、Leafletにフォールバック');
                localStorage.setItem(CESIUM_FAILED_KEY, 'true');
                setUseFallback(true);
                event.preventDefault();
                if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandled);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandled);
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        };
    }, [useFallback]);

    const handleRetry3D = useCallback(() => {
        localStorage.removeItem(CESIUM_FAILED_KEY);
        setUseFallback(false);
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

    // Leaflet 2Dフォールバック
    if (useFallback) {
        return <MapView onNavigateToObject={onNavigateToObject} onRetry3D={handleRetry3D} />;
    }

    // Cesium 3Dマップ
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
            <Map3DView />
        </Suspense>
    );
}
