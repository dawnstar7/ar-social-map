import { useState, useEffect, useCallback, useRef } from 'react';

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

    // スムージング用のRef
    const lastOrientationRef = useRef<{
        alpha: number;
        beta: number;
        gamma: number;
        heading: number;
    } | null>(null);

    // 角度の補間（0-360度の境界またぎを考慮）
    const lerpAngle = (current: number, target: number, factor: number) => {
        let diff = target - current;
        // 差分を -180 〜 180 に正規化
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        return current + diff * factor;
    };

    // 通常の数値の線形補間
    const lerp = (current: number, target: number, factor: number) => {
        return current + (target - current) * factor;
    };

    useEffect(() => {
        // ... (省略) ...

        if (!permissionGranted) {
            return;
        }

        // LPF係数（0.1 = 滑らかだが遅延あり, 0.5 = キビキビだが震える）
        const ALPHA = 0.15;

        const handleOrientation = (event: DeviceOrientationEvent) => {
            // ... (Heading取得ロジックは既存のまま) ...
            // @ts-expect-error
            const webkitHeading = event.webkitCompassHeading as number | undefined;
            let targetHeading: number | null = null;
            if (webkitHeading !== undefined) {
                targetHeading = webkitHeading;
            } else if (event.alpha !== null) {
                targetHeading = event.absolute ? (360 - event.alpha) % 360 : null;
            }

            // センサー値が取れなければスキップ
            if (event.alpha === null || event.beta === null || event.gamma === null || targetHeading === null) {
                return;
            }

            let newOrientation = {
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma,
                heading: targetHeading
            };

            // スムージング適用
            if (lastOrientationRef.current) {
                newOrientation.alpha = lerpAngle(lastOrientationRef.current.alpha, event.alpha, ALPHA);
                newOrientation.beta = lerp(lastOrientationRef.current.beta, event.beta, ALPHA);
                newOrientation.gamma = lerp(lastOrientationRef.current.gamma, event.gamma, ALPHA);
                newOrientation.heading = lerpAngle(lastOrientationRef.current.heading, targetHeading, ALPHA);
            }

            // Refを更新
            lastOrientationRef.current = newOrientation;

            // 正規化（360度を超えないように）
            newOrientation.alpha = (newOrientation.alpha + 360) % 360;
            newOrientation.heading = (newOrientation.heading + 360) % 360;

            setState({
                alpha: newOrientation.alpha,
                beta: newOrientation.beta,
                gamma: newOrientation.gamma,
                heading: newOrientation.heading,
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
