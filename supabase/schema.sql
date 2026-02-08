-- SupabaseダッシュボードのSQL Editorで実行してください
-- Settings > API > Enable RLS if needed

-- ARオブジェクトテーブル
CREATE TABLE IF NOT EXISTS ar_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    position JSONB NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#ff4444',
    object_type TEXT NOT NULL DEFAULT 'static' CHECK (object_type IN ('static', 'flying')),
    creature TEXT CHECK (creature IN ('dragon', 'bird', 'ufo') OR creature IS NULL),
    flight_config JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- フォローテーブル（将来用）
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, following_id)
);

-- Row Level Security (RLS) を有効化
ALTER TABLE ar_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- ポリシー: 自分のオブジェクトは全操作可能
CREATE POLICY "Users can manage own objects" ON ar_objects
    FOR ALL USING (auth.uid() = owner_id);

-- ポリシー: 公開オブジェクトは誰でも読める
CREATE POLICY "Anyone can view public objects" ON ar_objects
    FOR SELECT USING (is_public = true);

-- ポリシー: フォロー関係の管理
CREATE POLICY "Users can manage own follows" ON follows
    FOR ALL USING (auth.uid() = follower_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ar_objects_owner ON ar_objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_ar_objects_public ON ar_objects(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 匿名認証を有効化するための設定
-- Supabase Dashboard > Authentication > Providers > Anonymous で有効化してください
