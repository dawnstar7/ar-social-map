/**
 * オブジェクトストア（Supabase連携版）
 * 
 * ローカル状態 + Supabaseリアルタイム同期
 */

import { create } from 'zustand';
import type { GeoPosition } from '../utils/coordinates';
import type { FlightConfig } from '../utils/flyingBehavior';
import { supabase, getOrCreateUserId } from '../lib/supabase';

export type ObjectType = 'static' | 'flying';
export type FlyingCreature = 'dragon' | 'bird' | 'ufo';

export interface PlacedObject {
    id: string;
    position: GeoPosition;
    color: string;
    name: string;
    createdAt: Date;
    objectType: ObjectType;
    creature?: FlyingCreature;
    flightConfig?: FlightConfig;
    ownerId?: string;
    isPublic?: boolean;
}

// 生物の絵文字と名前
export const creatureEmoji: Record<FlyingCreature, string> = {
    dragon: '🐉',
    bird: '🦅',
    ufo: '🛸',
};

export const creatureNames: Record<FlyingCreature, string> = {
    dragon: '🐉 ドラゴン',
    bird: '🦅 鳥',
    ufo: '🛸 UFO',
};

export const creatureColors: Record<FlyingCreature, string> = {
    dragon: '#ff6600',
    bird: '#4488ff',
    ufo: '#00ff88',
};

const defaultFlightConfig: FlightConfig = {
    pattern: 'circle',
    radius: 30,
    minAltitude: 15,
    maxAltitude: 40,
    speed: 1,
};

interface ObjectStore {
    objects: PlacedObject[];
    publicObjects: PlacedObject[];
    userId: string | null;
    isInitialized: boolean;

    // 初期化
    initialize: () => Promise<void>;

    // ローカル操作（即座に反映、バックグラウンドで同期）
    addObject: (position: GeoPosition, name: string, color: string) => void;
    addFlyingObject: (position: GeoPosition, creature: FlyingCreature, config?: Partial<FlightConfig>) => void;
    removeObject: (id: string) => void;
    updateObject: (id: string, updates: Partial<PlacedObject>) => void;
    clearAll: () => void;

    // Supabase同期
    fetchPublicObjects: () => Promise<void>;
    fetchFollowedObjects: (followingIds: string[]) => Promise<void>;
}

export const useObjectStore = create<ObjectStore>((set, get) => ({
    objects: [],
    publicObjects: [],
    userId: null,
    isInitialized: false,

    initialize: async () => {
        if (get().isInitialized) return;

        try {
            // 匿名認証
            const userId = await getOrCreateUserId();
            set({ userId, isInitialized: true });

            // 公開オブジェクトを取得
            await get().fetchPublicObjects();

            // 自分のオブジェクトを取得
            if (userId) {
                const { data } = await supabase
                    .from('ar_objects')
                    .select('*')
                    .eq('owner_id', userId);

                if (data) {
                    const objects: PlacedObject[] = data.map(obj => ({
                        id: obj.id,
                        position: obj.position as GeoPosition,
                        color: obj.color,
                        name: obj.name,
                        createdAt: new Date(obj.created_at),
                        objectType: obj.object_type as ObjectType,
                        creature: obj.creature as FlyingCreature | undefined,
                        flightConfig: obj.flight_config as FlightConfig | undefined,
                        ownerId: obj.owner_id,
                        isPublic: obj.is_public,
                    }));
                    set({ objects });
                }
            }
        } catch (error) {
            console.error('初期化エラー:', error);
            set({ isInitialized: true }); // エラーでも続行
        }
    },

    addObject: (position, name, color) => {
        const { userId } = get();
        const newObject: PlacedObject = {
            id: crypto.randomUUID(),
            position,
            color,
            name,
            createdAt: new Date(),
            objectType: 'static',
            ownerId: userId || undefined,
            isPublic: false,
        };

        set((state) => ({
            objects: [...state.objects, newObject],
        }));

        // バックグラウンドでSupabaseに保存
        if (userId) {
            supabase.from('ar_objects').insert({
                id: newObject.id,
                owner_id: userId,
                is_public: false,
                position: position,
                name,
                color,
                object_type: 'static',
            }).then(({ error }) => {
                if (error) console.error('保存エラー:', error);
            });
        }
    },

    addFlyingObject: (position, creature, customConfig) => {
        const { userId } = get();
        const flightConfig: FlightConfig = {
            ...defaultFlightConfig,
            ...customConfig,
        };

        const newObject: PlacedObject = {
            id: crypto.randomUUID(),
            position,
            color: creatureColors[creature],
            name: creatureNames[creature],
            createdAt: new Date(),
            objectType: 'flying',
            creature,
            flightConfig,
            ownerId: userId || undefined,
            isPublic: false,
        };

        set((state) => ({
            objects: [...state.objects, newObject],
        }));

        // バックグラウンドでSupabaseに保存
        if (userId) {
            supabase.from('ar_objects').insert({
                id: newObject.id,
                owner_id: userId,
                is_public: false,
                position: position,
                name: newObject.name,
                color: newObject.color,
                object_type: 'flying',
                creature,
                flight_config: flightConfig,
            }).then(({ error }) => {
                if (error) console.error('保存エラー:', error);
            });
        }
    },

    updateObject: (id, updates) => {
        set((state) => ({
            objects: state.objects.map((obj) =>
                obj.id === id ? { ...obj, ...updates } : obj
            ),
        }));

        // Supabase更新
        const { userId } = get();
        if (userId) {
            const updateData: Record<string, unknown> = {};
            if (updates.position) updateData.position = updates.position;
            if (updates.name) updateData.name = updates.name;
            if (updates.color) updateData.color = updates.color;
            if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

            supabase.from('ar_objects')
                .update(updateData)
                .eq('id', id)
                .eq('owner_id', userId)
                .then(({ error }) => {
                    if (error) console.error('更新エラー:', error);
                });
        }
    },

    removeObject: (id) => {
        set((state) => ({
            objects: state.objects.filter((obj) => obj.id !== id),
        }));

        // Supabase削除
        const { userId } = get();
        if (userId) {
            supabase.from('ar_objects')
                .delete()
                .eq('id', id)
                .eq('owner_id', userId)
                .then(({ error }) => {
                    if (error) console.error('削除エラー:', error);
                });
        }
    },

    clearAll: () => {
        const { objects, userId } = get();
        const objectIds = objects.map(obj => obj.id);

        set({ objects: [] });

        // Supabase一括削除
        if (userId && objectIds.length > 0) {
            supabase.from('ar_objects')
                .delete()
                .eq('owner_id', userId)
                .in('id', objectIds)
                .then(({ error }) => {
                    if (error) console.error('一括削除エラー:', error);
                });
        }
    },

    fetchPublicObjects: async () => {
        try {
            const { userId } = get();
            const { data, error } = await supabase
                .from('ar_objects')
                .select('*')
                .eq('is_public', true)
                .neq('owner_id', userId || ''); // 自分以外

            if (error) {
                console.error('公開オブジェクト取得エラー:', error);
                return;
            }

            if (data) {
                const publicObjects: PlacedObject[] = data.map(obj => ({
                    id: obj.id,
                    position: obj.position as GeoPosition,
                    color: obj.color,
                    name: obj.name,
                    createdAt: new Date(obj.created_at),
                    objectType: obj.object_type as ObjectType,
                    creature: obj.creature as FlyingCreature | undefined,
                    flightConfig: obj.flight_config as FlightConfig | undefined,
                    ownerId: obj.owner_id,
                    isPublic: true,
                }));
                set({ publicObjects });
            }
        } catch (error) {
            console.error('公開オブジェクト取得エラー:', error);
        }
    },

    fetchFollowedObjects: async (followingIds: string[]) => {
        if (followingIds.length === 0) return;

        try {
            const { data, error } = await supabase
                .from('ar_objects')
                .select('*')
                .in('owner_id', followingIds);

            if (error) {
                console.error('フォロー中オブジェクト取得エラー:', error);
                return;
            }

            if (data) {
                const followedObjects: PlacedObject[] = data.map(obj => ({
                    id: obj.id,
                    position: obj.position as GeoPosition,
                    color: obj.color,
                    name: obj.name,
                    createdAt: new Date(obj.created_at),
                    objectType: obj.object_type as ObjectType,
                    creature: obj.creature as FlyingCreature | undefined,
                    flightConfig: obj.flight_config as FlightConfig | undefined,
                    ownerId: obj.owner_id,
                    isPublic: true,
                }));
                // フォロー中ユーザーのオブジェクトをpublicObjectsに統合
                const { publicObjects } = get();
                const existingIds = new Set(publicObjects.map(o => o.id));
                const newObjects = followedObjects.filter(o => !existingIds.has(o.id));
                set({ publicObjects: [...publicObjects, ...newObjects] });
            }
        } catch (error) {
            console.error('フォロー中オブジェクト取得エラー:', error);
        }
    },
}));
