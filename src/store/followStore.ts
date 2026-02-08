import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from './profileStore';

interface FollowStore {
    following: string[];
    followers: string[];
    followingProfiles: Profile[];
    isLoading: boolean;

    initializeFollows: (userId: string) => Promise<void>;
    followUser: (targetUserId: string) => Promise<void>;
    unfollowUser: (targetUserId: string) => Promise<void>;
    searchUsers: (query: string) => Promise<Profile[]>;
}

export const useFollowStore = create<FollowStore>((set, get) => ({
    following: [],
    followers: [],
    followingProfiles: [],
    isLoading: false,

    initializeFollows: async (userId: string) => {
        set({ isLoading: true });

        try {
            // フォロー中を取得
            const { data: followingData } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId);

            const followingIds = followingData?.map(f => f.following_id) || [];

            // フォロワーを取得
            const { data: followerData } = await supabase
                .from('follows')
                .select('follower_id')
                .eq('following_id', userId);

            const followerIds = followerData?.map(f => f.follower_id) || [];

            // フォロー中ユーザーのプロフィール取得
            let followingProfiles: Profile[] = [];
            if (followingIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', followingIds);

                followingProfiles = (profiles || []).map(p => ({
                    id: p.id,
                    displayName: p.display_name,
                    avatarColor: p.avatar_color,
                }));
            }

            set({
                following: followingIds,
                followers: followerIds,
                followingProfiles,
                isLoading: false,
            });
        } catch (error) {
            console.error('フォロー初期化エラー:', error);
            set({ isLoading: false });
        }
    },

    followUser: async (targetUserId: string) => {
        const { following, followingProfiles } = get();
        if (following.includes(targetUserId)) return;

        // ローカル即時更新
        set({ following: [...following, targetUserId] });

        const { error } = await supabase
            .from('follows')
            .insert({ follower_id: (await supabase.auth.getUser()).data.user?.id, following_id: targetUserId });

        if (error) {
            console.error('フォローエラー:', error);
            set({ following }); // ロールバック
            return;
        }

        // プロフィール取得
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .single();

        if (profile) {
            set({
                followingProfiles: [...followingProfiles, {
                    id: profile.id,
                    displayName: profile.display_name,
                    avatarColor: profile.avatar_color,
                }],
            });
        }
    },

    unfollowUser: async (targetUserId: string) => {
        const { following, followingProfiles } = get();

        // ローカル即時更新
        set({
            following: following.filter(id => id !== targetUserId),
            followingProfiles: followingProfiles.filter(p => p.id !== targetUserId),
        });

        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', (await supabase.auth.getUser()).data.user?.id)
            .eq('following_id', targetUserId);

        if (error) {
            console.error('アンフォローエラー:', error);
            // ロールバック
            set({ following, followingProfiles });
        }
    },

    searchUsers: async (query: string): Promise<Profile[]> => {
        if (!query.trim()) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .ilike('display_name', `%${query}%`)
            .limit(20);

        if (error) {
            console.error('検索エラー:', error);
            return [];
        }

        // 自分を除外
        const currentUser = (await supabase.auth.getUser()).data.user;
        return (data || [])
            .filter(p => p.id !== currentUser?.id)
            .map(p => ({
                id: p.id,
                displayName: p.display_name,
                avatarColor: p.avatar_color,
            }));
    },
}));
