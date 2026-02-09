/**
 * フィードストア - タイムラインデータ管理
 *
 * 既存のar_objectsとprofilesテーブルからフィードを構築。
 * 新DBテーブル不要。
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { GeoPosition } from '../utils/coordinates';
import type { ObjectType, FlyingCreature } from './objectStore';

export interface FeedItem {
    id: string;
    type: 'object_placed';
    timestamp: Date;
    object: {
        id: string;
        name: string;
        color: string;
        objectType: ObjectType;
        creature?: FlyingCreature;
        position: GeoPosition;
    };
    actor: {
        id: string;
        displayName: string;
        avatarColor: string;
    };
}

interface FeedStore {
    items: FeedItem[];
    isLoading: boolean;
    hasMore: boolean;
    cursor: string | null; // created_at cursor for pagination

    fetchFeed: (followingIds: string[]) => Promise<void>;
    loadMore: (followingIds: string[]) => Promise<void>;
    refresh: (followingIds: string[]) => Promise<void>;
}

const PAGE_SIZE = 20;

export const useFeedStore = create<FeedStore>((set, get) => ({
    items: [],
    isLoading: false,
    hasMore: true,
    cursor: null,

    fetchFeed: async (followingIds: string[]) => {
        if (followingIds.length === 0) {
            set({ items: [], isLoading: false, hasMore: false, cursor: null });
            return;
        }

        set({ isLoading: true });

        try {
            // フォロー中ユーザーの最近のオブジェクトを取得
            const { data: objects, error } = await supabase
                .from('ar_objects')
                .select('*')
                .in('owner_id', followingIds)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (error) {
                console.error('フィード取得エラー:', error);
                set({ isLoading: false });
                return;
            }

            if (!objects || objects.length === 0) {
                set({ items: [], isLoading: false, hasMore: false, cursor: null });
                return;
            }

            // オーナーのプロフィールをバッチ取得
            const ownerIds = [...new Set(objects.map(o => o.owner_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', ownerIds);

            const profileMap = new Map(
                (profiles || []).map(p => [p.id, { id: p.id, displayName: p.display_name, avatarColor: p.avatar_color }])
            );

            // FeedItemに変換
            const items: FeedItem[] = objects.map(obj => ({
                id: `obj-${obj.id}`,
                type: 'object_placed' as const,
                timestamp: new Date(obj.created_at),
                object: {
                    id: obj.id,
                    name: obj.name,
                    color: obj.color,
                    objectType: obj.object_type as ObjectType,
                    creature: obj.creature as FlyingCreature | undefined,
                    position: obj.position as GeoPosition,
                },
                actor: profileMap.get(obj.owner_id) || {
                    id: obj.owner_id,
                    displayName: 'Unknown',
                    avatarColor: '#6366f1',
                },
            }));

            const lastItem = objects[objects.length - 1];
            set({
                items,
                isLoading: false,
                hasMore: objects.length >= PAGE_SIZE,
                cursor: lastItem?.created_at || null,
            });
        } catch (error) {
            console.error('フィード取得エラー:', error);
            set({ isLoading: false });
        }
    },

    loadMore: async (followingIds: string[]) => {
        const { cursor, hasMore, isLoading, items } = get();
        if (!hasMore || isLoading || !cursor || followingIds.length === 0) return;

        set({ isLoading: true });

        try {
            const { data: objects, error } = await supabase
                .from('ar_objects')
                .select('*')
                .in('owner_id', followingIds)
                .lt('created_at', cursor)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (error) {
                console.error('フィード追加取得エラー:', error);
                set({ isLoading: false });
                return;
            }

            if (!objects || objects.length === 0) {
                set({ isLoading: false, hasMore: false });
                return;
            }

            const ownerIds = [...new Set(objects.map(o => o.owner_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', ownerIds);

            const profileMap = new Map(
                (profiles || []).map(p => [p.id, { id: p.id, displayName: p.display_name, avatarColor: p.avatar_color }])
            );

            const newItems: FeedItem[] = objects.map(obj => ({
                id: `obj-${obj.id}`,
                type: 'object_placed' as const,
                timestamp: new Date(obj.created_at),
                object: {
                    id: obj.id,
                    name: obj.name,
                    color: obj.color,
                    objectType: obj.object_type as ObjectType,
                    creature: obj.creature as FlyingCreature | undefined,
                    position: obj.position as GeoPosition,
                },
                actor: profileMap.get(obj.owner_id) || {
                    id: obj.owner_id,
                    displayName: 'Unknown',
                    avatarColor: '#6366f1',
                },
            }));

            const lastItem = objects[objects.length - 1];
            set({
                items: [...items, ...newItems],
                isLoading: false,
                hasMore: objects.length >= PAGE_SIZE,
                cursor: lastItem?.created_at || cursor,
            });
        } catch (error) {
            console.error('フィード追加取得エラー:', error);
            set({ isLoading: false });
        }
    },

    refresh: async (followingIds: string[]) => {
        set({ cursor: null, hasMore: true });
        await get().fetchFeed(followingIds);
    },
}));
