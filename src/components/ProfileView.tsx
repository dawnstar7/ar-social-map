import { useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useObjectStore, creatureEmoji, type FlyingCreature } from '../store/objectStore';
import { useFollowStore } from '../store/followStore';

const AVATAR_COLORS = [
    '#6366f1', '#f43f5e', '#22c55e', '#f59e0b',
    '#06b6d4', '#8b5cf6', '#ec4899', '#ff6600',
];

export function ProfileView() {
    const { profile, updateDisplayName, updateAvatarColor } = useProfileStore();
    const { objects, removeObject } = useObjectStore();
    const { following, followers } = useFollowStore();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');

    const startEditName = () => {
        setNameInput(profile?.displayName || '');
        setEditingName(true);
    };

    const saveName = () => {
        if (nameInput.trim()) {
            updateDisplayName(nameInput.trim());
        }
        setEditingName(false);
    };

    const getIcon = (obj: { objectType: string; creature?: FlyingCreature }) => {
        if (obj.objectType === 'flying' && obj.creature) {
            return creatureEmoji[obj.creature];
        }
        return '📍';
    };

    if (!profile) {
        return (
            <div className="profile-container">
                <div className="profile-header">
                    <h2>👤 マイページ</h2>
                </div>
                <div className="profile-content">
                    <div className="profile-placeholder">
                        <p>読み込み中...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            <div className="profile-header">
                <h2>👤 マイページ</h2>
            </div>
            <div className="profile-content">
                {/* アバターセクション */}
                <div className="profile-avatar-section">
                    <div
                        className="profile-avatar"
                        style={{ background: profile.avatarColor }}
                    >
                        {profile.displayName.charAt(0).toUpperCase()}
                    </div>

                    {editingName ? (
                        <div className="profile-name-edit">
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="profile-name-input"
                                maxLength={20}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                            />
                            <button className="profile-save-btn" onClick={saveName}>
                                保存
                            </button>
                        </div>
                    ) : (
                        <button className="profile-name-display" onClick={startEditName}>
                            {profile.displayName}
                            <span className="profile-edit-hint">タップで編集</span>
                        </button>
                    )}
                </div>

                {/* カラーピッカー */}
                <div className="profile-section">
                    <h3 className="profile-section-title">アバターカラー</h3>
                    <div className="profile-color-grid">
                        {AVATAR_COLORS.map((color) => (
                            <button
                                key={color}
                                className={`profile-color-btn ${profile.avatarColor === color ? 'active' : ''}`}
                                style={{ background: color }}
                                onClick={() => updateAvatarColor(color)}
                            />
                        ))}
                    </div>
                </div>

                {/* フォロー統計 */}
                <div className="profile-section">
                    <div className="profile-stats">
                        <div className="profile-stat">
                            <span className="profile-stat-number">{following.length}</span>
                            <span className="profile-stat-label">フォロー中</span>
                        </div>
                        <div className="profile-stat">
                            <span className="profile-stat-number">{followers.length}</span>
                            <span className="profile-stat-label">フォロワー</span>
                        </div>
                        <div className="profile-stat">
                            <span className="profile-stat-number">{objects.length}</span>
                            <span className="profile-stat-label">オブジェクト</span>
                        </div>
                    </div>
                </div>

                {/* マイオブジェクト */}
                <div className="profile-section">
                    <h3 className="profile-section-title">
                        マイオブジェクト ({objects.length})
                    </h3>
                    {objects.length === 0 ? (
                        <div className="profile-empty">
                            マップからオブジェクトを配置してみましょう
                        </div>
                    ) : (
                        <div className="profile-object-list">
                            {objects.map((obj) => (
                                <div key={obj.id} className="object-list-item">
                                    <span className="object-list-icon">{getIcon(obj)}</span>
                                    <div className="object-list-info">
                                        <div className="object-list-name">{obj.name}</div>
                                    </div>
                                    <button
                                        className="object-list-delete-btn"
                                        onClick={() => removeObject(obj.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
