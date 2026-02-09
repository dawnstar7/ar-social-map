/**
 * フィードビュー（ホームタブ） - SNSタイムライン
 *
 * フォロー中ユーザーのオブジェクト配置をタイムラインで表示。
 */

import { useEffect, useState, useCallback } from 'react';
import { useFeedStore, type FeedItem } from '../store/feedStore';
import { useFollowStore } from '../store/followStore';
import { useObjectStore, creatureEmoji } from '../store/objectStore';
import { UserProfileView } from './UserProfileView';

interface FeedViewProps {
    onNavigateToMap?: () => void;
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

export function FeedView({ onNavigateToMap }: FeedViewProps) {
    const { items, isLoading, hasMore, fetchFeed, loadMore, refresh } = useFeedStore();
    const { following } = useFollowStore();
    const { isInitialized } = useObjectStore();
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
                {following.length === 0 ? (
                    <div className="feed-empty">
                        <div className="feed-empty-icon">👥</div>
                        <p className="feed-empty-title">フィードはまだ空です</p>
                        <p className="feed-empty-desc">
                            ユーザーをフォローすると、<br />
                            配置したオブジェクトがここに表示されます
                        </p>
                    </div>
                ) : items.length === 0 && !isLoading ? (
                    <div className="feed-empty">
                        <div className="feed-empty-icon">📭</div>
                        <p className="feed-empty-title">まだ投稿がありません</p>
                        <p className="feed-empty-desc">
                            フォロー中のユーザーがオブジェクトを<br />
                            配置すると、ここに表示されます
                        </p>
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

                {isLoading && items.length === 0 && (
                    <div className="feed-loading">
                        <div className="spinner"></div>
                        <p>読み込み中...</p>
                    </div>
                )}
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
