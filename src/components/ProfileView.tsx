/**
 * マイページ（プロフィールタブ）
 *
 * - アバター表示 + 名前編集
 * - アバターカラー変更
 * - フォロー/フォロワー統計
 * - マイオブジェクト一覧
 * - ユーザーID表示 + コピー
 * - アプリ設定（位置キャッシュクリア等）
 * - アプリ情報
 */

import { useState, useCallback } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useObjectStore, creatureEmoji, type FlyingCreature } from '../store/objectStore';
import { useFollowStore } from '../store/followStore';

const AVATAR_COLORS = [
    '#6366f1', '#f43f5e', '#22c55e', '#f59e0b',
    '#06b6d4', '#8b5cf6', '#ec4899', '#ff6600',
];

export function ProfileView() {
    const { profile, isLoading, initError, updateDisplayName, updateAvatarColor } = useProfileStore();
    const { objects, removeObject, userId } = useObjectStore();
    const { following, followers } = useFollowStore();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [copiedId, setCopiedId] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

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
        return '\uD83D\uDCCD';
    };

    const copyUserId = useCallback(() => {
        if (userId) {
            navigator.clipboard.writeText(userId).then(() => {
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
            }).catch(() => {
                // フォールバック: テキストエリアを使ったコピー
                const ta = document.createElement('textarea');
                ta.value = userId;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
            });
        }
    }, [userId]);

    const clearLocationCache = useCallback(() => {
        localStorage.removeItem('cesium_failed');
        alert('位置キャッシュをクリアしました。次回マップを開くとき、3Dマップが再試行されます。');
    }, []);

    // ローディング中でもプロフィール未設定時は最低限のUI表示
    if (!profile && isLoading) {
        return (
            <div className="profile-container">
                <div className="profile-header">
                    <h2>マイページ</h2>
                </div>
                <div className="profile-content">
                    <div className="profile-placeholder">
                        <div className="spinner"></div>
                        <p>読み込み中...</p>
                    </div>
                </div>
            </div>
        );
    }

    // プロフィールが取得できなかった場合のフォールバック表示
    if (!profile) {
        return (
            <div className="profile-container">
                <div className="profile-header">
                    <h2>マイページ</h2>
                </div>
                <div className="profile-content">
                    <div className="profile-error-section">
                        <div className="profile-error-icon">!</div>
                        <p>プロフィールを読み込めませんでした</p>
                        <p className="profile-error-sub">ネットワーク接続を確認してください</p>
                        <button className="profile-retry-btn" onClick={() => window.location.reload()}>
                            再読み込み
                        </button>
                    </div>

                    {/* エラー時でもオブジェクトは表示 */}
                    {objects.length > 0 && (
                        <div className="profile-section">
                            <h3 className="profile-section-title">
                                マイオブジェクト ({objects.length})
                            </h3>
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
                                            {'\uD83D\uDDD1\uFE0F'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            <div className="profile-header">
                <h2>マイページ</h2>
                <button
                    className="icon-btn"
                    onClick={() => setShowSettings(!showSettings)}
                >
                    {showSettings ? '\u2716' : '\u2699\uFE0F'}
                </button>
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

                    {initError && (
                        <div className="profile-sync-warning">
                            オフラインモード - 変更は保存されません
                        </div>
                    )}
                </div>

                {/* ユーザーID */}
                {userId && (
                    <div className="profile-id-section">
                        <button className="profile-id-btn" onClick={copyUserId}>
                            <span className="profile-id-label">ID:</span>
                            <span className="profile-id-value">{userId.substring(0, 8)}...</span>
                            <span className="profile-id-copy">{copiedId ? '\u2705' : '\uD83D\uDCCB'}</span>
                        </button>
                        {copiedId && <span className="profile-copied-toast">コピーしました!</span>}
                    </div>
                )}

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
                                        <div className="object-list-date">
                                            {obj.createdAt.toLocaleDateString('ja-JP')}
                                        </div>
                                    </div>
                                    <button
                                        className="object-list-delete-btn"
                                        onClick={() => removeObject(obj.id)}
                                    >
                                        {'\uD83D\uDDD1\uFE0F'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 設定パネル */}
                {showSettings && (
                    <div className="profile-section profile-settings">
                        <h3 className="profile-section-title">設定</h3>

                        <button className="profile-setting-item" onClick={clearLocationCache}>
                            <span className="profile-setting-icon">{'\uD83D\uDDFA\uFE0F'}</span>
                            <div className="profile-setting-info">
                                <span className="profile-setting-name">3Dマップをリセット</span>
                                <span className="profile-setting-desc">次回マップを開くとき3Dマップを再試行します</span>
                            </div>
                        </button>

                        <button className="profile-setting-item" onClick={() => {
                            localStorage.clear();
                            alert('全データをクリアしました。ページを再読み込みします。');
                            window.location.reload();
                        }}>
                            <span className="profile-setting-icon">{'\uD83D\uDDD1\uFE0F'}</span>
                            <div className="profile-setting-info">
                                <span className="profile-setting-name">キャッシュクリア</span>
                                <span className="profile-setting-desc">ローカルデータを全てリセットします</span>
                            </div>
                        </button>
                    </div>
                )}

                {/* アプリ情報 */}
                <div className="profile-section profile-about">
                    <div className="profile-app-info">
                        <span className="profile-app-name">ARcity</span>
                        <span className="profile-app-version">v1.0.0</span>
                        <span className="profile-app-desc">Digital Twin SNS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
