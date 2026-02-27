/**
 * ゲームダッシュボード - ホームタブに表示
 *
 * デイリーミッション、所持クリーチャー、実績一覧
 */

import { useState } from 'react';
import {
    useGameStore,
    getLevelInfo,
    getXPProgress,
    ACHIEVEMENTS,
    CREATURE_INFO,
    RARITY_INFO,
} from '../store/gameStore';

export function GameDashboard() {
    const {
        coins, xp, stats, creatures,
        dailyMissions, unlockedAchievements,
        claimMissionReward,
    } = useGameStore();
    const [showAllAchievements, setShowAllAchievements] = useState(false);

    const levelInfo = getLevelInfo(xp);
    const progress = getXPProgress(xp);

    return (
        <div className="game-dashboard">
            {/* プレイヤーステータスカード */}
            <div className="game-status-card">
                <div className="game-status-top">
                    <div className="game-level-badge">
                        <span className="game-level-num">Lv.{levelInfo.level}</span>
                        <span className="game-level-title">{levelInfo.title}</span>
                    </div>
                    <div className="game-coins-display">
                        <span className="game-coins-icon">🪙</span>
                        <span className="game-coins-amount">{coins.toLocaleString()}</span>
                    </div>
                </div>

                {/* XPプログレスバー */}
                <div className="game-xp-section">
                    <div className="game-xp-bar-container">
                        <div className="game-xp-bar-bg">
                            <div
                                className="game-xp-bar-fill"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <span className="game-xp-text">
                            {xp} / {levelInfo.maxXP} XP
                        </span>
                    </div>
                </div>

                {/* ミニ統計 */}
                <div className="game-mini-stats">
                    <div className="game-mini-stat">
                        <span className="game-mini-stat-val">{(stats.totalDistanceM / 1000).toFixed(1)}km</span>
                        <span className="game-mini-stat-lbl">歩いた距離</span>
                    </div>
                    <div className="game-mini-stat">
                        <span className="game-mini-stat-val">{stats.objectsPlaced}</span>
                        <span className="game-mini-stat-lbl">配置数</span>
                    </div>
                    <div className="game-mini-stat">
                        <span className="game-mini-stat-val">{creatures.length}</span>
                        <span className="game-mini-stat-lbl">クリーチャー</span>
                    </div>
                    <div className="game-mini-stat">
                        <span className="game-mini-stat-val">🔥{stats.loginStreak}</span>
                        <span className="game-mini-stat-lbl">連続日数</span>
                    </div>
                </div>
            </div>

            {/* デイリーミッション */}
            <div className="game-section">
                <h3 className="game-section-title">📋 デイリーミッション</h3>
                <div className="game-missions">
                    {dailyMissions.map((mission) => (
                        <div
                            key={mission.id}
                            className={`game-mission-card ${mission.completed ? 'completed' : ''}`}
                        >
                            <div className="game-mission-icon">{mission.icon}</div>
                            <div className="game-mission-info">
                                <span className="game-mission-title">{mission.title}</span>
                                <div className="game-mission-progress-bar">
                                    <div
                                        className="game-mission-progress-fill"
                                        style={{ width: `${Math.min(100, (mission.current / mission.target) * 100)}%` }}
                                    />
                                </div>
                                <span className="game-mission-progress-text">
                                    {Math.min(mission.current, mission.target)} / {mission.target}
                                    {mission.id === 'daily_walk' && 'm'}
                                </span>
                            </div>
                            <div className="game-mission-reward">
                                {mission.completed ? (
                                    <span className="game-mission-done">✅</span>
                                ) : mission.current >= mission.target ? (
                                    <button
                                        className="game-mission-claim"
                                        onClick={() => claimMissionReward(mission.id)}
                                    >
                                        受取
                                    </button>
                                ) : (
                                    <span className="game-mission-coins">🪙{mission.reward.coins}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 所持クリーチャー */}
            <div className="game-section">
                <h3 className="game-section-title">🐾 マイクリーチャー ({creatures.length})</h3>
                {creatures.length === 0 ? (
                    <div className="game-empty-hint">
                        <span>🥚</span>
                        <p>マップ上のエッグを見つけてクリーチャーをゲットしよう！</p>
                    </div>
                ) : (
                    <div className="game-creature-grid">
                        {creatures.map((creature) => {
                            const info = CREATURE_INFO[creature.type];
                            const rarity = RARITY_INFO[creature.rarity];
                            return (
                                <div
                                    key={creature.id}
                                    className="game-creature-card"
                                    style={{ borderColor: rarity.color }}
                                >
                                    <span className="game-creature-emoji">{info.emoji}</span>
                                    <span className="game-creature-name">{creature.name}</span>
                                    <span
                                        className="game-creature-rarity"
                                        style={{ color: rarity.color }}
                                    >
                                        {rarity.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 実績 */}
            <div className="game-section">
                <h3 className="game-section-title">
                    🏆 実績 ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
                </h3>
                <div className="game-achievements">
                    {(showAllAchievements ? ACHIEVEMENTS : ACHIEVEMENTS.slice(0, 6)).map((ach) => {
                        const unlocked = unlockedAchievements.includes(ach.id);
                        return (
                            <div
                                key={ach.id}
                                className={`game-achievement-item ${unlocked ? 'unlocked' : 'locked'}`}
                            >
                                <span className="game-achievement-icon">
                                    {unlocked ? ach.icon : '🔒'}
                                </span>
                                <div className="game-achievement-info">
                                    <span className="game-achievement-title">{ach.title}</span>
                                    <span className="game-achievement-desc">{ach.description}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {ACHIEVEMENTS.length > 6 && (
                    <button
                        className="game-show-more"
                        onClick={() => setShowAllAchievements(!showAllAchievements)}
                    >
                        {showAllAchievements ? '閉じる' : `すべて表示 (${ACHIEVEMENTS.length})`}
                    </button>
                )}
            </div>
        </div>
    );
}
