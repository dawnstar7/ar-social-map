import { useState, useCallback } from 'react';
import { useFollowStore } from '../store/followStore';
import type { Profile } from '../store/profileStore';

interface UserSearchPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserSearchPanel({ isOpen, onClose }: UserSearchPanelProps) {
    const { following, followUser, unfollowUser, searchUsers } = useFollowStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        const found = await searchUsers(query);
        setResults(found);
        setIsSearching(false);
    }, [query, searchUsers]);

    const isFollowing = (userId: string) => following.includes(userId);

    return (
        <>
            <div
                className={`object-list-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`object-list-panel ${isOpen ? 'open' : ''}`}>
                <div className="object-list-handle" />
                <div className="object-list-header">
                    <h3>ユーザーを探す</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                {/* 検索バー */}
                <div className="user-search-bar">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="名前で検索..."
                        className="user-search-input"
                    />
                    <button
                        className="user-search-btn"
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        {isSearching ? '...' : '検索'}
                    </button>
                </div>

                {/* 検索結果 */}
                <div className="object-list-items">
                    {results.length === 0 && query && !isSearching ? (
                        <div className="object-list-empty">
                            ユーザーが見つかりません
                        </div>
                    ) : (
                        results.map((user) => (
                            <div key={user.id} className="object-list-item">
                                <div
                                    className="user-search-avatar"
                                    style={{ background: user.avatarColor }}
                                >
                                    {user.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="object-list-info">
                                    <div className="object-list-name">{user.displayName}</div>
                                </div>
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
        </>
    );
}
