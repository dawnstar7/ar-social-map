/**
 * フィードビュー（ホームタブ） - SNSタイムライン
 *
 * - ウェルカムセクション + ユーザー統計
 * - クイックアクション
 * - フォロー中ユーザーのオブジェクト配置タイムライン
 */

import { useEffect, useState, useCallback } from 'react';
import { useFeedStore, type FeedItem } from '../store/feedStore';
import { useFollowStore } from '../store/followStore';
import { useObjectStore, creatureEmoji } from '../store/objectStore';
import { useProfileStore } from '../store/profileStore';
import { UserProfileView } from './UserProfileView';

interface FeedViewProps {
    onNavigateToMap?: () => void;
    onNavigateToSearch?: () => void;
}

// 相対時間表示
function timeAgo(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP');
}

function FeedCard({ item, onViewProfile }: { item: FeedItem; onViewProfile: (userId: string) => void }) {
    const objectIcon = item.object.creature ? creatureEmoji[item.object.creature] : '📍';

    return (
        <div className="feed-card">
            <div className="feed-card-header">
                <button
                    className="feed-avatar"
                    style={{ background: item.actor.avatarColor }}
                    onClick={() => onViewProfile(item.actor.id)}
                >
                    {item.actor.displayName.charAt(0).toUpperCase()}
                </button>
                <div className="feed-card-meta">
                    <button className="feed-username" onClick={() => onViewProfile(item.actor.id)}>
                        {item.actor.displayName}
                    </button>
                    <span className="feed-timestamp">{timeAgo(item.timestamp)}</span>
                </div>
            </div>

            <div className="feed-card-content">
                <div className="feed-object-info">
                    <span className="feed-object-icon">{objectIcon}</span>
                    <div className="feed-object-detail">
                        <span className="feed-object-name">{item.object.name}</span>
                        <span className="feed-object-type">
                            {item.object.objectType === 'flying' ? '飛行オブジェクト' : 'ピン'}を配置
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FeedView({ onNavigateToMap, onNavigateToSearch }: FeedViewProps) {
    const { items, isLoading, hasMore, fetchFeed, loadMore, refresh } = useFeedStore();
    const { following, followers, followingProfiles } = useFollowStore();
    const { isInitialized, objects } = useObjectStore();
    const { profile } = useProfileStore();
    const [viewingProfile, setViewingProfile] = useState<string | null>(null);

    // フォローリストが変わったらフィード更新
    useEffect(() => {
        if (isInitialized && following.length > 0) {
            fetchFeed(following);
        }
    }, [isInitialized, following, fetchFeed]);

    const handleRefresh = useCallback(() => {
        refresh(following);
    }, [refresh, following]);

    const handleLoadMore = useCallback(() => {
        loadMore(following);
    }, [loadMore, following]);

    return (
        <div className="feed-container">
            <div className="feed-header">
                <h2>🏠 ホーム</h2>
                <button className="icon-btn" onClick={handleRefresh} disabled={isLoading}>
                    {isLoading ? '⏳' : '🔄'}
                </button>
            </div>

            <div className="feed-content">
                {/* ウェルカムセクション */}
                {profile && (
                    <div className="feed-welcome">
                        <div className="feed-welcome-row">
                            <div
                                className="feed-welcome-avatar"
                                style={{ background: profile.avatarColor }}
                            >
                                {profile.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="feed-welcome-text">
                                <span className="feed-welcome-greeting">こんにちは</span>
                                <span className="feed-welcome-name">{profile.displayName}</span>
                            </div>
                        </div>

                        {/* ステータスカード */}
                        <div className="feed-stats-row">
                            <div className="feed-stat-card">
                                <span className="feed-stat-num">{objects.length}</span>
                                <span className="feed-stat-lbl">オブジェクト</span>
                            </div>
                            <div className="feed-stat-card">
                                <span className="feed-stat-num">{following.length}</span>
                                <span className="feed-stat-lbl">フォロー</span>
                            </div>
                            <div className="feed-stat-card">
                                <span className="feed-stat-num">{followers.length}</span>
                                <span className="feed-stat-lbl">フォロワー</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* クイックアクション */}
                <div className="feed-actions">
                    <button className="feed-action-btn" onClick={onNavigateToMap}>
                        <span className="feed-action-icon">🌍</span>
                        <span className="feed-action-label">マップを開く</span>
                    </button>
                    <button className="feed-action-btn" onClick={onNavigateToSearch}>
                        <span className="feed-action-icon">👥</span>
                        <span className="feed-action-label">ユーザーを探す</span>
                    </button>
                </div>

                {/* フォロー中のユーザー一覧（横スクロール） */}
                {followingProfiles.length > 0 && (
                    <div className="feed-following-section">
                        <h3 className="feed-section-title">フォロー中</h3>
                        <div className="feed-following-scroll">
                            {followingProfiles.map((user) => (
                                <button
                                    key={user.id}
                                    className="feed-following-chip"
                                    onClick={() => setViewingProfile(user.id)}
                                >
                                    <div
                                        className="feed-following-avatar"
                                        style={{ background: user.avatarColor }}
                                    >
                                        {user.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="feed-following-name">{user.displayName}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* タイムライン */}
                <div className="feed-timeline-section">
                    <h3 className="feed-section-title">タイムライン</h3>

                    {following.length === 0 ? (
                        <div className="feed-empty-mini">
                            <p>ユーザーをフォローすると、活動が表示されます</p>
                            <button className="feed-empty-btn" onClick={onNavigateToSearch}>
                                ユーザーを探す
                            </button>
                        </div>
                    ) : items.length === 0 && !isLoading ? (
                        <div className="feed-empty-mini">
                            <p>フォロー中のユーザーの投稿はまだありません</p>
                        </div>
                    ) : (
                        <>
                            {items.map((item) => (
                                <FeedCard
                                    key={item.id}
                                    item={item}
                                    onViewProfile={setViewingProfile}
                                />
                            ))}

                            {hasMore && (
                                <button
                                    className="feed-load-more"
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                >
                                    {isLoading ? '読み込み中...' : 'もっと見る'}
                                </button>
                            )}
                        </>
                    )}

                    {isLoading && items.length === 0 && following.length > 0 && (
                        <div className="feed-loading">
                            <div className="spinner"></div>
                            <p>読み込み中...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ユーザープロフィール表示 */}
            {viewingProfile && (
                <UserProfileView
                    userId={viewingProfile}
                    onClose={() => setViewingProfile(null)}
                    onNavigateToMap={onNavigateToMap}
                />
            )}
        </div>
    );
}
