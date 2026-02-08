import { useState, useEffect, useCallback } from 'react';
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

    const handleSuccess = useCallback((pos: GeolocationPosition) => {
        setState({
            position: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude ?? 0,
            },
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
