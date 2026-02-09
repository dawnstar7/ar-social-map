/**
 * ユーザープロフィール表示 - 他ユーザーのプロフィールをモーダルで表示
 *
 * - アバター + 表示名
 * - フォロー/アンフォローボタン
 * - そのユーザーのオブジェクト一覧
 */

import { useEffect, useState } from 'react';
import { useFollowStore } from '../store/followStore';
import { useProfileStore, type Profile } from '../store/profileStore';
import { creatureEmoji, type FlyingCreature } from '../store/objectStore';
import { supabase } from '../lib/supabase';
import type { GeoPosition } from '../utils/coordinates';
import type { PlacedObject } from '../store/objectStore';

interface UserProfileViewProps {
    userId: string;
    onClose: () => void;
    onNavigateToMap?: () => void;
}

export function UserProfileView({ userId, onClose }: UserProfileViewProps) {
    const { following, followUser, unfollowUser } = useFollowStore();
    const { profile: myProfile } = useProfileStore();
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [userObjects, setUserObjects] = useState<PlacedObject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    const isFollowing = following.includes(userId);
    const isOwnProfile = myProfile?.id === userId;

    // プロフィールとオブジェクトを取得
    useEffect(() => {
        async function load() {
            setIsLoading(true);

            try {
                // プロフィール取得
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (profile) {
                    setUserProfile({
                        id: profile.id,
                        displayName: profile.display_name,
                        avatarColor: profile.avatar_color,
                    });
                }

                // オブジェクト取得
                const { data: objects } = await supabase
                    .from('ar_objects')
                    .select('*')
                    .eq('owner_id', userId)
                    .order('created_at', { ascending: false });

                if (objects) {
                    setUserObjects(objects.map(obj => ({
                        id: obj.id,
                        position: obj.position as GeoPosition,
                        color: obj.color,
                        name: obj.name,
                        createdAt: new Date(obj.created_at),
                        objectType: obj.object_type as 'static' | 'flying',
                        creature: obj.creature as FlyingCreature | undefined,
                        ownerId: obj.owner_id,
                        isPublic: obj.is_public,
                    })));
                }

                // フォロー数取得
                const { count: followers } = await supabase
                    .from('follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('following_id', userId);

                const { count: followings } = await supabase
                    .from('follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('follower_id', userId);

                setFollowerCount(followers || 0);
                setFollowingCount(followings || 0);
            } catch (error) {
                console.error('プロフィール取得エラー:', error);
            }

            setIsLoading(false);
        }

        load();
    }, [userId]);

    const getObjectIcon = (obj: { objectType: string; creature?: FlyingCreature }) => {
        if (obj.objectType === 'flying' && obj.creature) {
            return creatureEmoji[obj.creature];
        }
        return '📍';
    };

    const handleFollow = () => {
        if (isFollowing) {
            unfollowUser(userId);
            setFollowerCount(c => Math.max(0, c - 1));
        } else {
            followUser(userId);
            setFollowerCount(c => c + 1);
        }
    };

    return (
        <>
            <div className="object-list-overlay open" onClick={onClose} />
            <div className="object-list-panel open user-profile-panel">
                <div className="object-list-handle" />
                <div className="object-list-header">
                    <h3>プロフィール</h3>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                {isLoading ? (
                    <div className="feed-loading">
                        <div className="spinner"></div>
                        <p>読み込み中...</p>
                    </div>
                ) : userProfile ? (
                    <div className="user-profile-content">
                        {/* アバター + 名前 */}
                        <div className="user-profile-hero">
                            <div
                                className="profile-avatar"
                                style={{ background: userProfile.avatarColor }}
                            >
                                {userProfile.displayName.charAt(0).toUpperCase()}
                            </div>
                            <h3 className="user-profile-name">{userProfile.displayName}</h3>

                            {/* フォローボタン（自分じゃない場合） */}
                            {!isOwnProfile && (
                                <button
                                    className={`follow-btn-large ${isFollowing ? 'following' : ''}`}
                                    onClick={handleFollow}
                                >
                                    {isFollowing ? 'フォロー中' : 'フォローする'}
                                </button>
                            )}
                        </div>

                        {/* フォロー統計 */}
                        <div className="profile-stats" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                            <div className="profile-stat">
                                <span className="profile-stat-number">{followingCount}</span>
                                <span className="profile-stat-label">フォロー中</span>
                            </div>
                            <div className="profile-stat">
                                <span className="profile-stat-number">{followerCount}</span>
                                <span className="profile-stat-label">フォロワー</span>
                            </div>
                            <div className="profile-stat">
                                <span className="profile-stat-number">{userObjects.length}</span>
                                <span className="profile-stat-label">オブジェクト</span>
                            </div>
                        </div>

                        {/* オブジェクト一覧 */}
                        <div className="user-profile-objects">
                            <h4 className="profile-section-title">配置オブジェクト</h4>
                            {userObjects.length === 0 ? (
                                <div className="profile-empty">まだオブジェクトがありません</div>
                            ) : (
                                <div className="profile-object-list">
                                    {userObjects.map((obj) => (
                                        <div key={obj.id} className="object-list-item">
                                            <span className="object-list-icon">{getObjectIcon(obj)}</span>
                                            <div className="object-list-info">
                                                <div className="object-list-name">{obj.name}</div>
                                                <div className="object-list-type">
                                                    海抜{obj.position.altitude?.toFixed(0) || 0}m
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="profile-empty">ユーザーが見つかりません</div>
                )}
            </div>
        </>
    );
}
