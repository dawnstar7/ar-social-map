/**
 * Supabaseクライアント設定
 * 
 * ソーシャルAR機能用のデータベース接続
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase環境変数が設定されていません');
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);

// ユーザーIDを取得（匿名認証）
export async function getOrCreateUserId(): Promise<string | null> {
    // 既存セッション確認
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        return session.user.id;
    }

    // 匿名ログイン
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
        console.error('匿名認証エラー:', error);
        return null;
    }

    return data.user?.id || null;
}

// 現在のユーザーID（同期版）
export function getCurrentUserId(): string | null {
    // ローカルストレージから取得（Supabaseが自動保存）
    const storageKey = `sb-${supabaseUrl?.split('//')[1]?.split('.')[0] || ''}-auth-token`;
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed?.user?.id || null;
        }
    } catch {
        // ignore
    }
    return null;
}
