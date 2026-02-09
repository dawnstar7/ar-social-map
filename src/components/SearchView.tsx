/**
 * 検索ビュー（さがすタブ） - ユーザー検索専用画面
 *
 * - ユーザー名で検索
 * - フォロー/アンフォロー
 * - プロフィール閲覧
 */

import { useState, useCallback } from 'react';
import { useFollowStore } from '../store/followStore';
import type { Profile } from '../store/profileStore';
import { UserProfileView } from './UserProfileView';

interface SearchViewProps {
    onNavigateToMap?: () => void;
}

export function SearchView({ onNavigateToMap }: SearchViewProps) {
    const { following, followUser, unfollowUser, searchUsers } = useFollowStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [viewingProfile, setViewingProfile] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        setHasSearched(true);
        const found = await searchUsers(query);
        setResults(found);
        setIsSearching(false);
    }, [query, searchUsers]);

    const isFollowing = (userId: string) => following.includes(userId);

    return (
        <div className="search-container">
            <div className="search-header">
                <h2>🔍 さがす</h2>
            </div>

            <div className="search-content">
                {/* 検索バー */}
                <div className="search-bar">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="ユーザー名で検索..."
                        className="search-input"
                    />
                    <button
                        className="search-btn"
                        onClick={handleSearch}
                        disabled={isSearching || !query.trim()}
                    >
                        {isSearching ? '...' : '検索'}
                    </button>
                </div>

                {/* 検索結果 */}
                <div className="search-results">
                    {!hasSearched ? (
                        <div className="search-hint">
                            <div className="search-hint-icon">👥</div>
                            <p>ユーザー名を入力して検索してください</p>
                            <p className="search-hint-sub">フォローすると、マップやARで相手のオブジェクトが見えるようになります</p>
                        </div>
                    ) : isSearching ? (
                        <div className="feed-loading">
                            <div className="spinner"></div>
                            <p>検索中...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="search-hint">
                            <div className="search-hint-icon">🔍</div>
                            <p>「{query}」に一致するユーザーが見つかりません</p>
                        </div>
                    ) : (
                        results.map((user) => (
                            <div key={user.id} className="search-result-item">
                                <button
                                    className="search-result-profile"
                                    onClick={() => setViewingProfile(user.id)}
                                >
                                    <div
                                        className="user-search-avatar"
                                        style={{ background: user.avatarColor }}
                                    >
                                        {user.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="search-result-info">
                                        <div className="search-result-name">{user.displayName}</div>
                                    </div>
                                </button>
                                <button
                                    className={`follow-btn ${isFollowing(user.id) ? 'following' : ''}`}
                                    onClick={() => isFollowing(user.id)
                                        ? unfollowUser(user.id)
                                        : followUser(user.id)
                                    }
                                >
                                    {isFollowing(user.id) ? 'フォロー中' : 'フォロー'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ユーザープロフィール */}
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
