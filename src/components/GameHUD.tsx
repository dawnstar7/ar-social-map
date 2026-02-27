/**
 * ゲームHUD - マップ上のコイン・レベル・報酬表示
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore, getLevelInfo, getXPProgress } from '../store/gameStore';

export function GameHUD() {
    const { coins, xp, popReward } = useGameStore();
    const [reward, setReward] = useState<{ type: string; message: string; value?: number } | null>(null);
    const [showReward, setShowReward] = useState(false);

    const levelInfo = getLevelInfo(xp);
    const progress = getXPProgress(xp);

    // 報酬ポップアップ表示
    const processReward = useCallback(() => {
        const r = popReward();
        if (r) {
            setReward(r);
            setShowReward(true);
            setTimeout(() => {
                setShowReward(false);
                setTimeout(processReward, 300); // 次の報酬を処理
            }, 2000);
        }
    }, [popReward]);

    useEffect(() => {
        const interval = setInterval(processReward, 1000);
        return () => clearInterval(interval);
    }, [processReward]);

    return (
        <>
            {/* レベル・コインHUD */}
            <div className="game-hud">
                <div className="game-hud-level">
                    <span className="game-hud-level-num">Lv.{levelInfo.level}</span>
                    <div className="game-hud-xp-bar">
                        <div className="game-hud-xp-fill" style={{ width: `${progress * 100}%` }} />
                    </div>
                </div>
                <div className="game-hud-coins">
                    <span className="game-hud-coin-icon">🪙</span>
                    <span className="game-hud-coin-num">{coins}</span>
                </div>
            </div>

            {/* 報酬トースト */}
            {showReward && reward && (
                <div className={`reward-toast ${reward.type}`}>
                    <span className="reward-toast-message">{reward.message}</span>
                    {reward.value && reward.type === 'coins' && (
                        <span className="reward-toast-value">+{reward.value} 🪙</span>
                    )}
                    {reward.value && reward.type === 'xp' && (
                        <span className="reward-toast-value">+{reward.value} XP</span>
                    )}
                    {reward.type === 'levelup' && (
                        <span className="reward-toast-value">🎉</span>
                    )}
                    {reward.type === 'achievement' && (
                        <span className="reward-toast-value">+50 🪙</span>
                    )}
                    {reward.type === 'creature' && (
                        <span className="reward-toast-value">+{reward.value} 🪙</span>
                    )}
                </div>
            )}
        </>
    );
}
