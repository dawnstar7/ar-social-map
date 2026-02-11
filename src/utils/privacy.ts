import type { GeoPosition } from './coordinates';

/**
 * プライバシー保護のための位置情報「ぼかし」処理
 * 
 * 正確な位置情報を送信せず、10m〜50m程度のランダムなオフセットを加える。
 * これにより、ユーザーの正確な居場所を特定できないようにする。
 */
export function fuzzPosition(position: GeoPosition, minOffsetMeters = 10, maxOffsetMeters = 50): GeoPosition {
    // 緯度経度のおおよその換算レート (日本付近)
    // 緯度1度 ≒ 111km = 111,000m
    // 経度1度 ≒ 91km = 91,000m

    const latPerMeter = 1 / 111000;
    const lonPerMeter = 1 / 91000;

    // ランダムな方向と距離
    const angle = Math.random() * Math.PI * 2;
    const distance = minOffsetMeters + Math.random() * (maxOffsetMeters - minOffsetMeters);

    const latOffset = Math.sin(angle) * distance * latPerMeter;
    const lonOffset = Math.cos(angle) * distance * lonPerMeter;

    return {
        latitude: position.latitude + latOffset,
        longitude: position.longitude + lonOffset,
        altitude: position.altitude, // 高さはそのまま（AR表現のため）
    };
}
