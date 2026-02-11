import { create } from 'zustand';
import { supabase, getCurrentUserId } from '../lib/supabase';
import type { GeoPosition } from '../utils/coordinates';
import { fuzzPosition } from '../utils/privacy';

interface UserPresence {
    userId: string;
    position: GeoPosition;
    lastActive: number;
    color: string; // ユーザーを表す色（ランダム生成など）
}

export interface Comment {
    id: string;
    userId: string;
    text: string;
    timestamp: number;
}

export interface Reaction {
    userId: string;
    type: 'like';
}

interface SocialStore {
    onlineUsers: Map<string, UserPresence>;
    footprints: GeoPosition[]; // 自分の足跡（ローカル表示用）
    otherFootprints: GeoPosition[]; // 他人の足跡（集約・軽量化版）

    // オブジェクトごとのソーシャルデータ
    objectComments: Map<string, Comment[]>;
    objectReactions: Map<string, Reaction[]>;

    // ルーム機能
    currentRoomId: string | null; // null = パブリック

    // アクション
    initializeSocial: () => void;
    broadcastPresence: (position: GeoPosition) => void;
    recordFootprint: (position: GeoPosition) => void;

    // インタラクション
    sendReaction: (objectId: string) => void;
    postComment: (objectId: string, text: string) => void;

    // ルームアクション
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
}

// ランダムカラー生成
const getRandomColor = () => {
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#22d3ee', '#818cf8', '#e879f9'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const useSocialStore = create<SocialStore>((set, get) => ({
    onlineUsers: new Map(),
    footprints: [],
    otherFootprints: [],
    objectComments: new Map(),
    objectReactions: new Map(),
    currentRoomId: null,

    initializeSocial: () => {
        // 既存のチャンネルがあれば破棄すべきだが、簡易実装として上書き
        // 実際は useEffect でクリーンアップなどを管理推奨
        const channel = supabase.channel('tracking_room');

        channel
            .on('broadcast', { event: 'presence' }, ({ payload }) => {
                const { userId, position, color, roomId } = payload;
                if (userId === getCurrentUserId()) return;

                // ルームフィルタリング
                const currentRoom = get().currentRoomId;
                if (roomId !== currentRoom) return; // 異なるルームのユーザーは無視

                set((state) => {
                    const newUsers = new Map(state.onlineUsers);
                    newUsers.set(userId, {
                        userId,
                        position,
                        lastActive: Date.now(),
                        color: color || '#fff',
                    });

                    const newOtherFootprints = [...state.otherFootprints, position].slice(-500);

                    return { onlineUsers: newUsers, otherFootprints: newOtherFootprints };
                });
            })
            .on('broadcast', { event: 'reaction' }, ({ payload }) => {
                const { objectId, userId, type, roomId } = payload;

                // ルームフィルタリング
                if (roomId !== get().currentRoomId) return;

                set((state) => {
                    const currentReactions = state.objectReactions.get(objectId) || [];
                    if (currentReactions.some(r => r.userId === userId)) return {};

                    const newReactions = new Map(state.objectReactions);
                    newReactions.set(objectId, [...currentReactions, { userId, type }]);
                    return { objectReactions: newReactions };
                });
            })
            .on('broadcast', { event: 'comment' }, ({ payload }) => {
                const { objectId, userId, text, timestamp, id, roomId } = payload;

                // ルームフィルタリング
                if (roomId !== get().currentRoomId) return;

                set((state) => {
                    const currentComments = state.objectComments.get(objectId) || [];
                    const newComments = new Map(state.objectComments);
                    newComments.set(objectId, [...currentComments, { id, userId, text, timestamp }]);
                    return { objectComments: newComments };
                });
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Social connection established');
                }
            });

        setInterval(() => {
            set((state) => {
                const now = Date.now();
                const newUsers = new Map(state.onlineUsers);
                let changed = false;

                for (const [id, user] of newUsers.entries()) {
                    if (now - user.lastActive > 60000) {
                        newUsers.delete(id);
                        changed = true;
                    }
                }
                return changed ? { onlineUsers: newUsers } : {};
            });
        }, 10000);
    },

    broadcastPresence: (position: GeoPosition) => {
        const userId = getCurrentUserId();
        if (!userId) return;

        const fuzzedPos = fuzzPosition(position);
        const color = getRandomColor();
        const roomId = get().currentRoomId;

        supabase.channel('tracking_room').send({
            type: 'broadcast',
            event: 'presence',
            payload: { userId, position: fuzzedPos, color, roomId },
        });
    },

    recordFootprint: (position: GeoPosition) => {
        set((state) => {
            const last = state.footprints[state.footprints.length - 1];
            if (last) {
                const dist = Math.sqrt(
                    Math.pow(last.latitude - position.latitude, 2) +
                    Math.pow(last.longitude - position.longitude, 2)
                );
                if (dist < 0.00005) return {};
            }
            return { footprints: [...state.footprints, position].slice(-1000) };
        });
    },

    sendReaction: (objectId: string) => {
        const userId = getCurrentUserId();
        if (!userId) return;

        const roomId = get().currentRoomId;

        set((state) => {
            const currentReactions = state.objectReactions.get(objectId) || [];
            if (currentReactions.some(r => r.userId === userId)) return {};

            const newReactions = new Map(state.objectReactions);
            newReactions.set(objectId, [...currentReactions, { userId, type: 'like' }]);
            return { objectReactions: newReactions };
        });

        supabase.channel('tracking_room').send({
            type: 'broadcast',
            event: 'reaction',
            payload: { objectId, userId, type: 'like', roomId },
        });
    },

    postComment: (objectId: string, text: string) => {
        const userId = getCurrentUserId();
        if (!userId) return;

        const roomId = get().currentRoomId;

        const comment: Comment = {
            id: crypto.randomUUID(),
            userId,
            text,
            timestamp: Date.now(),
        };

        set((state) => {
            const currentComments = state.objectComments.get(objectId) || [];
            const newComments = new Map(state.objectComments);
            newComments.set(objectId, [...currentComments, comment]);
            return { objectComments: newComments };
        });

        supabase.channel('tracking_room').send({
            type: 'broadcast',
            event: 'comment',
            payload: { ...comment, objectId, roomId },
        });
    },

    joinRoom: (roomId: string) => {
        set({ currentRoomId: roomId, onlineUsers: new Map(), otherFootprints: [] });
        // ルーム切り替え時に他人のデータをクリア
    },

    leaveRoom: () => {
        set({ currentRoomId: null, onlineUsers: new Map(), otherFootprints: [] });
    },
}));
