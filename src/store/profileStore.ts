import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
    id: string;
    displayName: string;
    avatarColor: string;
}

interface ProfileStore {
    profile: Profile | null;
    isLoading: boolean;
    initError: boolean;

    initializeProfile: (userId: string) => Promise<void>;
    updateDisplayName: (name: string) => Promise<void>;
    updateAvatarColor: (color: string) => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
    profile: null,
    isLoading: false,
    initError: false,

    initializeProfile: async (userId: string) => {
        // フォールバックプロフィールを即座に設定（読み込み中で止まらないように）
        const fallbackName = `User-${userId.substring(0, 4).toUpperCase()}`;
        const fallbackColor = '#6366f1';
        const fallbackProfile: Profile = {
            id: userId,
            displayName: fallbackName,
            avatarColor: fallbackColor,
        };

        // 即座にprofileをセット → UIは即描画される
        set({ profile: fallbackProfile, isLoading: true, initError: false });

        try {
            // 既存プロフィールを取得
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data && !error) {
                set({
                    profile: {
                        id: data.id,
                        displayName: data.display_name,
                        avatarColor: data.avatar_color,
                    },
                    isLoading: false,
                });
                return;
            }

            // プロフィールが無い場合は自動作成
            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    display_name: fallbackName,
                    avatar_color: fallbackColor,
                });

            if (insertError) {
                console.error('プロフィール作成エラー:', insertError);
            }

            set({
                profile: fallbackProfile,
                isLoading: false,
            });
        } catch (error) {
            console.error('プロフィール初期化エラー:', error);
            // エラーでもフォールバックプロフィールは既にセット済み
            set({
                isLoading: false,
                initError: true,
            });
        }
    },

    updateDisplayName: async (name: string) => {
        const { profile } = get();
        if (!profile) return;

        set({ profile: { ...profile, displayName: name } });

        const { error } = await supabase
            .from('profiles')
            .update({ display_name: name, updated_at: new Date().toISOString() })
            .eq('id', profile.id);

        if (error) console.error('名前更新エラー:', error);
    },

    updateAvatarColor: async (color: string) => {
        const { profile } = get();
        if (!profile) return;

        set({ profile: { ...profile, avatarColor: color } });

        const { error } = await supabase
            .from('profiles')
            .update({ avatar_color: color, updated_at: new Date().toISOString() })
            .eq('id', profile.id);

        if (error) console.error('カラー更新エラー:', error);
    },
}));
