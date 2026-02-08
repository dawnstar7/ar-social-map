/**
 * 飛行パターンを計算するユーティリティ
 * 
 * 各パターンは時間(t)に基づいて位置オフセットを返す
 */

import type { GeoPosition } from './coordinates';

// 飛行パターンの種類
export type FlightPattern = 'circle' | 'random' | 'figure8';

// 飛行設定
export interface FlightConfig {
    pattern: FlightPattern;
    radius: number;      // 飛行範囲（メートル）
    minAltitude: number; // 最低高度（メートル）
    maxAltitude: number; // 最高高度（メートル）
    speed: number;       // 速度係数（1が標準）
}

// デフォルト設定
export const defaultFlightConfig: FlightConfig = {
    pattern: 'circle',
    radius: 50,
    minAltitude: 20,
    maxAltitude: 50,
    speed: 1,
};

/**
 * 現在時刻に基づいて飛行位置のオフセットを計算
 * @param config 飛行設定
 * @param timeMs 現在時刻（ミリ秒）
 * @returns 緯度・経度・高度のオフセット（メートル）
 */
export function calculateFlightOffset(
    config: FlightConfig,
    timeMs: number
): { latOffset: number; lonOffset: number; altOffset: number } {
    // 時間をラジアンに変換（30秒で1周）
    const t = (timeMs / 1000) * config.speed * (Math.PI / 15);

    switch (config.pattern) {
        case 'circle': {
            // 円周飛行
            const latOffset = Math.sin(t) * config.radius;
            const lonOffset = Math.cos(t) * config.radius;
            const altRange = config.maxAltitude - config.minAltitude;
            const altOffset = config.minAltitude + (Math.sin(t * 0.5) + 1) * 0.5 * altRange;
            return { latOffset, lonOffset, altOffset };
        }

        case 'figure8': {
            // 8の字飛行
            const latOffset = Math.sin(t) * config.radius;
            const lonOffset = Math.sin(t * 2) * config.radius * 0.5;
            const altRange = config.maxAltitude - config.minAltitude;
            const altOffset = config.minAltitude + (Math.sin(t * 0.7) + 1) * 0.5 * altRange;
            return { latOffset, lonOffset, altOffset };
        }

        case 'random':
        default: {
            // 疑似ランダム飛行（Perlinノイズ風）
            const seed = Math.floor(timeMs / 5000); // 5秒ごとに方向変更
            const phase = (timeMs % 5000) / 5000;

            // シンプルなノイズ関数
            const noise = (s: number) => Math.sin(s * 127.1) * Math.cos(s * 311.7);

            const prevLat = noise(seed) * config.radius;
            const prevLon = noise(seed + 1000) * config.radius;
            const nextLat = noise(seed + 1) * config.radius;
            const nextLon = noise(seed + 1001) * config.radius;

            // 補間
            const smooth = phase * phase * (3 - 2 * phase); // smoothstep
            const latOffset = prevLat + (nextLat - prevLat) * smooth;
            const lonOffset = prevLon + (nextLon - prevLon) * smooth;

            const altRange = config.maxAltitude - config.minAltitude;
            const altOffset = config.minAltitude + (Math.sin(t * 0.3) + 1) * 0.5 * altRange;

            return { latOffset, lonOffset, altOffset };
        }
    }
}

/**
 * ベース位置と飛行オフセットから現在位置を計算
 */
export function calculateCurrentPosition(
    basePosition: GeoPosition,
    config: FlightConfig,
    timeMs: number
): GeoPosition {
    const offset = calculateFlightOffset(config, timeMs);

    // メートルを緯度経度に変換
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLon = 111320 * Math.cos(basePosition.latitude * Math.PI / 180);

    return {
        latitude: basePosition.latitude + offset.latOffset / metersPerDegreeLat,
        longitude: basePosition.longitude + offset.lonOffset / metersPerDegreeLon,
        altitude: (basePosition.altitude || 0) + offset.altOffset,
    };
}
