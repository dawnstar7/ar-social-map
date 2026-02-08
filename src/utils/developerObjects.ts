/**
 * 開発者オブジェクト + Supabase公開オブジェクト統合
 * 
 * 開発者が配置したオブジェクトは全員に表示されます。
 * Supabaseの公開オブジェクトも統合して表示。
 */

import type { PlacedObject } from '../store/objectStore';
import type { FlightConfig } from './flyingBehavior';
import { useObjectStore } from '../store/objectStore';

// 開発者オブジェクトの定義
export interface DeveloperObject {
    id: string;
    position: {
        latitude: number;
        longitude: number;
        altitude: number;
    };
    name: string;
    color: string;
    objectType: 'static' | 'flying';
    creature?: 'dragon' | 'bird' | 'ufo';
    flightConfig?: FlightConfig;
}

// 開発者が配置したオブジェクト（ハードコード）
// DBが空の場合のフォールバック
export const developerObjects: DeveloperObject[] = [
    // 東京駅上空のドラゴン
    {
        id: 'dev-dragon-tokyo',
        position: {
            latitude: 35.6812,
            longitude: 139.7671,
            altitude: 30,
        },
        name: '🐉 開発者ドラゴン',
        color: '#ff6600',
        objectType: 'flying',
        creature: 'dragon',
        flightConfig: {
            pattern: 'circle',
            radius: 50,
            minAltitude: 20,
            maxAltitude: 50,
            speed: 1,
        },
    },
    // 渋谷駅上空のUFO
    {
        id: 'dev-ufo-shibuya',
        position: {
            latitude: 35.6580,
            longitude: 139.7016,
            altitude: 40,
        },
        name: '🛸 開発者UFO',
        color: '#00ff88',
        objectType: 'flying',
        creature: 'ufo',
        flightConfig: {
            pattern: 'figure8',
            radius: 40,
            minAltitude: 30,
            maxAltitude: 60,
            speed: 0.8,
        },
    },
    // 新宿駅上空の鳥
    {
        id: 'dev-bird-shinjuku',
        position: {
            latitude: 35.6896,
            longitude: 139.7006,
            altitude: 25,
        },
        name: '🦅 開発者バード',
        color: '#4488ff',
        objectType: 'flying',
        creature: 'bird',
        flightConfig: {
            pattern: 'random',
            radius: 60,
            minAltitude: 15,
            maxAltitude: 40,
            speed: 1.2,
        },
    },
];

/**
 * 開発者オブジェクトをPlacedObject形式に変換
 */
export function getDeveloperObjectsAsPlaced(): PlacedObject[] {
    // Supabaseの公開オブジェクトを取得
    const { publicObjects } = useObjectStore.getState();

    // 開発者オブジェクト（フォールバック）
    const devObjects: PlacedObject[] = developerObjects.map(obj => ({
        id: obj.id,
        position: obj.position,
        name: obj.name,
        color: obj.color,
        objectType: obj.objectType,
        creature: obj.creature,
        flightConfig: obj.flightConfig,
        createdAt: new Date('2024-01-01'),
        isPublic: true,
    }));

    // 公開オブジェクト + 開発者オブジェクトを統合
    return [...publicObjects, ...devObjects];
}
