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

// タイムアウト付きPromise
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`タイムアウト (${ms}ms)`);
            resolve(fallback);
        }, ms)),
    ]);
}

// ユーザーIDを取得（匿名認証・タイムアウト付き）
export async function getOrCreateUserId(): Promise<string | null> {
    try {
        // 既存セッション確認（5秒タイムアウト）
        const sessionResult = await withTimeout(
            supabase.auth.getSession(),
            5000,
            { data: { session: null }, error: null } as any
        );
        if (sessionResult.data.session?.user) {
            return sessionResult.data.session.user.id;
        }

        // 匿名ログイン（5秒タイムアウト）
        const { data, error } = await withTimeout(
            supabase.auth.signInAnonymously(),
            5000,
            { data: { user: null, session: null }, error: new Error('タイムアウト') as any }
        );
        if (error) {
            console.warn('匿名認証失敗（オフラインまたは制限）:', error.message);
            return null;
        }

        return data.user?.id || null;
    } catch (error) {
        console.error('認証処理エラー:', error);
        return null;
    }
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
