import { useState, useEffect, useCallback, useRef } from 'react';
import type { GeoPosition } from '../utils/coordinates';

interface GeolocationState {
    position: GeoPosition | null;
    accuracy: number | null;
    error: string | null;
    isLoading: boolean;
}

interface UseGeolocationOptions {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    watchPosition?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
    const {
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0,
        watchPosition = true,
    } = options;

    const [state, setState] = useState<GeolocationState>({
        position: null,
        accuracy: null,
        error: null,
        isLoading: true,
    });

    // スムージング用のRef（前回の値を保持）
    const lastPosRef = useRef<GeoPosition | null>(null);

    // LPF係数 (0.0: 変化なし 〜 1.0: そのまま適用)
    // 0.15くらいが遅延と滑らかさのバランスが良い
    const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const ALPHA = IS_IOS ? 0.2 : 0.15;

    const handleSuccess = useCallback((pos: GeolocationPosition) => {
        const rawLatitude = pos.coords.latitude;
        const rawLongitude = pos.coords.longitude;
        const rawAltitude = pos.coords.altitude ?? 0;

        let newLat = rawLatitude;
        let newLon = rawLongitude;
        let newAlt = rawAltitude;

        if (lastPosRef.current) {
            // 前回の値があればスムージング
            newLat = lastPosRef.current.latitude + (rawLatitude - lastPosRef.current.latitude) * ALPHA;
            newLon = lastPosRef.current.longitude + (rawLongitude - lastPosRef.current.longitude) * ALPHA;
            // 高度はさらにブレやすいので強めにフィルタ
            newAlt = (lastPosRef.current.altitude || 0) + (rawAltitude - (lastPosRef.current.altitude || 0)) * (ALPHA * 0.5);
        }

        const smoothedPos = {
            latitude: newLat,
            longitude: newLon,
            altitude: newAlt,
        };

        lastPosRef.current = smoothedPos;

        setState({
            position: smoothedPos,
            accuracy: pos.coords.accuracy,
            error: null,
            isLoading: false,
        });
    }, []);

    const handleError = useCallback((error: GeolocationPositionError) => {
        let errorMessage: string;
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '位置情報へのアクセスが拒否されました';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '位置情報を取得できません';
                break;
            case error.TIMEOUT:
                errorMessage = '位置情報の取得がタイムアウトしました';
                break;
            default:
                errorMessage = '位置情報の取得中にエラーが発生しました';
        }
        setState((prev) => ({
            ...prev,
            error: errorMessage,
            isLoading: false,
        }));
    }, []);

    const refresh = useCallback(() => {
        if (!navigator.geolocation) {
            setState({
                position: null,
                accuracy: null,
                error: 'このブラウザは位置情報をサポートしていません',
                isLoading: false,
            });
            return;
        }

        setState((prev) => ({ ...prev, isLoading: true }));
        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy,
            timeout,
            maximumAge,
        });
    }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

    useEffect(() => {
        if (!navigator.geolocation) {
            setState({
                position: null,
                accuracy: null,
                error: 'このブラウザは位置情報をサポートしていません',
                isLoading: false,
            });
            return;
        }

        let watchId: number | null = null;

        if (watchPosition) {
            watchId = navigator.geolocation.watchPosition(
                handleSuccess,
                handleError,
                { enableHighAccuracy, timeout, maximumAge }
            );
        } else {
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
                enableHighAccuracy,
                timeout,
                maximumAge,
            });
        }

        return () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [enableHighAccuracy, timeout, maximumAge, watchPosition, handleSuccess, handleError]);

    return { ...state, refresh };
}
