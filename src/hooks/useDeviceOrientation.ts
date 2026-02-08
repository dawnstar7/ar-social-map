import { useState, useEffect, useCallback } from 'react';

interface DeviceOrientationState {
    alpha: number | null;  // Z軸回転（コンパス方位）
    beta: number | null;   // X軸回転（前後傾き）
    gamma: number | null;  // Y軸回転（左右傾き）
    heading: number | null; // 北からの方位角（補正済み）
    error: string | null;
    isSupported: boolean;
}

export function useDeviceOrientation() {
    const [state, setState] = useState<DeviceOrientationState>({
        alpha: null,
        beta: null,
        gamma: null,
        heading: null,
        error: null,
        isSupported: true,
    });

    const [permissionGranted, setPermissionGranted] = useState(false);

    const requestPermission = useCallback(async () => {
        // iOS 13+ではDeviceOrientationEventの許可が必要
        if (
            typeof DeviceOrientationEvent !== 'undefined' &&
            // @ts-expect-error - iOS specific API
            typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
            try {
                // @ts-expect-error - iOS specific API
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    setPermissionGranted(true);
                    return true;
                } else {
                    setState((prev) => ({
                        ...prev,
                        error: '方位センサーへのアクセスが拒否されました',
                    }));
                    return false;
                }
            } catch {
                setState((prev) => ({
                    ...prev,
                    error: '方位センサーの許可リクエストに失敗しました',
                }));
                return false;
            }
        } else {
            // Android や 非iOS デバイスでは許可不要
            setPermissionGranted(true);
            return true;
        }
    }, []);

    useEffect(() => {
        if (!window.DeviceOrientationEvent) {
            setState((prev) => ({
                ...prev,
                isSupported: false,
                error: 'このデバイスは方位センサーをサポートしていません',
            }));
            return;
        }

        if (!permissionGranted) {
            return;
        }

        const handleOrientation = (event: DeviceOrientationEvent) => {
            // webkitCompassHeading は iOS Safari 固有のプロパティ
            // @ts-expect-error - iOS Safari specific property
            const webkitHeading = event.webkitCompassHeading as number | undefined;

            let heading: number | null = null;

            if (webkitHeading !== undefined) {
                // iOS: webkitCompassHeadingを使用（北=0）
                heading = webkitHeading;
            } else if (event.alpha !== null) {
                // Android: alphaを使用（ただし反時計回りなので補正）
                // また、absolute が true の場合のみ北基準
                heading = event.absolute ? (360 - event.alpha) % 360 : null;
            }

            setState({
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma,
                heading,
                error: null,
                isSupported: true,
            });
        };

        window.addEventListener('deviceorientation', handleOrientation, true);

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation, true);
        };
    }, [permissionGranted]);

    return { ...state, requestPermission, permissionGranted };
}
