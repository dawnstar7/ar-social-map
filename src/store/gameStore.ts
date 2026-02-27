/**
 * ゲームストア - ARcity ゲーミフィケーション
 *
 * コイン、経験値、レベル、実績、歩行トラッキング、
 * クリーチャーエッグ発見システム
 */

import { create } from 'zustand';
import type { GeoPosition } from '../utils/coordinates';

// ========== レベルシステム ==========
export interface LevelInfo {
    level: number;
    title: string;
    minXP: number;
    maxXP: number;
}

const LEVEL_TABLE: LevelInfo[] = [
    { level: 1, title: 'はじめの一歩', minXP: 0, maxXP: 100 },
    { level: 2, title: 'まちの探検家', minXP: 100, maxXP: 300 },
    { level: 3, title: 'デジタル市民', minXP: 300, maxXP: 600 },
    { level: 4, title: 'ARアーティスト', minXP: 600, maxXP: 1000 },
    { level: 5, title: 'クリエイター', minXP: 1000, maxXP: 1500 },
    { level: 6, title: 'マスタービルダー', minXP: 1500, maxXP: 2200 },
    { level: 7, title: 'レジェンド探検家', minXP: 2200, maxXP: 3000 },
    { level: 8, title: 'デジタルツイン王', minXP: 3000, maxXP: 4000 },
    { level: 9, title: 'ワールドシェイパー', minXP: 4000, maxXP: 5500 },
    { level: 10, title: '⭐ マスター', minXP: 5500, maxXP: 999999 },
];

export function getLevelInfo(xp: number): LevelInfo {
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_TABLE[i].minXP) return LEVEL_TABLE[i];
    }
    return LEVEL_TABLE[0];
}

export function getXPProgress(xp: number): number {
    const info = getLevelInfo(xp);
    if (info.level >= 10) return 1;
    const range = info.maxXP - info.minXP;
    return (xp - info.minXP) / range;
}

// ========== 実績システム ==========
export interface Achievement {
    id: string;
    icon: string;
    title: string;
    description: string;
    condition: (state: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_place',
        icon: '📍',
        title: '初めての足跡',
        description: 'オブジェクトを初めて配置した',
        condition: (s) => s.stats.objectsPlaced >= 1,
    },
    {
        id: 'place_5',
        icon: '🏗️',
        title: 'ビルダー',
        description: 'オブジェクトを5個配置した',
        condition: (s) => s.stats.objectsPlaced >= 5,
    },
    {
        id: 'place_20',
        icon: '🏙️',
        title: 'シティプランナー',
        description: 'オブジェクトを20個配置した',
        condition: (s) => s.stats.objectsPlaced >= 20,
    },
    {
        id: 'walk_500',
        icon: '🚶',
        title: 'おさんぽマスター',
        description: '合計500m歩いた',
        condition: (s) => s.stats.totalDistanceM >= 500,
    },
    {
        id: 'walk_2000',
        icon: '🏃',
        title: 'ランナー',
        description: '合計2km歩いた',
        condition: (s) => s.stats.totalDistanceM >= 2000,
    },
    {
        id: 'walk_10000',
        icon: '🌏',
        title: 'ワールドトラベラー',
        description: '合計10km歩いた',
        condition: (s) => s.stats.totalDistanceM >= 10000,
    },
    {
        id: 'egg_1',
        icon: '🥚',
        title: 'エッグハンター',
        description: 'クリーチャーエッグを初めて発見した',
        condition: (s) => s.stats.eggsCollected >= 1,
    },
    {
        id: 'egg_5',
        icon: '🐣',
        title: 'コレクター',
        description: 'クリーチャーエッグを5個集めた',
        condition: (s) => s.stats.eggsCollected >= 5,
    },
    {
        id: 'creature_all',
        icon: '👑',
        title: 'コンプリート',
        description: '全3種のクリーチャーを集めた',
        condition: (s) => s.creatures.length >= 3 &&
            ['dragon', 'bird', 'ufo'].every(c => s.creatures.some(cr => cr.type === c)),
    },
    {
        id: 'level_5',
        icon: '⭐',
        title: '中級探検家',
        description: 'レベル5に到達した',
        condition: (s) => getLevelInfo(s.xp).level >= 5,
    },
    {
        id: 'coins_1000',
        icon: '💰',
        title: 'リッチ',
        description: 'コインを合計1000枚獲得した',
        condition: (s) => s.stats.totalCoinsEarned >= 1000,
    },
    {
        id: 'daily_3',
        icon: '🔥',
        title: '3日連続ログイン',
        description: '3日連続でアプリを使った',
        condition: (s) => s.stats.loginStreak >= 3,
    },
    {
        id: 'daily_7',
        icon: '🔥',
        title: '7日連続ログイン',
        description: '7日連続でアプリを使った',
        condition: (s) => s.stats.loginStreak >= 7,
    },
];

// ========== クリーチャーシステム ==========
export type CreatureType = 'dragon' | 'bird' | 'ufo';
export type CreatureRarity = 'common' | 'rare' | 'legendary';

export interface OwnedCreature {
    id: string;
    type: CreatureType;
    name: string;
    rarity: CreatureRarity;
    level: number;
    xp: number;
    discoveredAt: number; // timestamp
}

export interface CreatureEgg {
    id: string;
    position: GeoPosition;
    creatureType: CreatureType;
    rarity: CreatureRarity;
    expiresAt: number; // timestamp
}

export const CREATURE_INFO: Record<CreatureType, { emoji: string; name: string; color: string }> = {
    dragon: { emoji: '🐉', name: 'ドラゴン', color: '#ff6600' },
    bird: { emoji: '🦅', name: 'フェニックス', color: '#4488ff' },
    ufo: { emoji: '🛸', name: 'UFO', color: '#00ff88' },
};

export const RARITY_INFO: Record<CreatureRarity, { label: string; color: string; multiplier: number }> = {
    common: { label: 'コモン', color: '#aaaaaa', multiplier: 1 },
    rare: { label: 'レア', color: '#4488ff', multiplier: 2 },
    legendary: { label: 'レジェンド', color: '#ffaa00', multiplier: 5 },
};

// ========== デイリーミッション ==========
export interface DailyMission {
    id: string;
    icon: string;
    title: string;
    description: string;
    target: number;
    current: number;
    reward: { coins: number; xp: number };
    completed: boolean;
}

// ========== ゲームステート ==========
interface GameStats {
    objectsPlaced: number;
    totalDistanceM: number;
    eggsCollected: number;
    totalCoinsEarned: number;
    loginStreak: number;
    lastLoginDate: string; // YYYY-MM-DD
    sessionsToday: number;
}

interface GameState {
    coins: number;
    xp: number;
    stats: GameStats;
    creatures: OwnedCreature[];
    unlockedAchievements: string[];
    dailyMissions: DailyMission[];
    dailyMissionsDate: string; // YYYY-MM-DD

    // マップ上のエッグ
    eggs: CreatureEgg[];

    // 歩行トラッキング
    lastPosition: GeoPosition | null;

    // 通知
    pendingRewards: { type: 'coins' | 'xp' | 'achievement' | 'levelup' | 'egg' | 'creature'; message: string; value?: number }[];
}

interface GameStore extends GameState {
    // 初期化
    initialize: () => void;

    // コイン & XP
    addCoins: (amount: number, reason?: string) => void;
    addXP: (amount: number, reason?: string) => void;

    // 歩行トラッキング
    updatePosition: (pos: GeoPosition) => void;

    // オブジェクト配置報酬
    onObjectPlaced: () => void;

    // エッグシステム
    generateEggs: (center: GeoPosition) => void;
    collectEgg: (eggId: string) => void;

    // デイリーミッション
    generateDailyMissions: () => void;
    updateMissionProgress: (missionId: string, progress: number) => void;
    claimMissionReward: (missionId: string) => void;

    // 実績
    checkAchievements: () => void;

    // 通知
    popReward: () => { type: string; message: string; value?: number } | null;

    // セーブ/ロード
    save: () => void;
}

const STORAGE_KEY = 'arcity_game_v1';

const today = () => new Date().toISOString().split('T')[0];

// Haversine距離計算（メートル）
function haversineDistance(a: GeoPosition, b: GeoPosition): number {
    const R = 6371000;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// デフォルトステート
const defaultState: GameState = {
    coins: 0,
    xp: 0,
    stats: {
        objectsPlaced: 0,
        totalDistanceM: 0,
        eggsCollected: 0,
        totalCoinsEarned: 0,
        loginStreak: 0,
        lastLoginDate: '',
        sessionsToday: 0,
    },
    creatures: [],
    unlockedAchievements: [],
    dailyMissions: [],
    dailyMissionsDate: '',
    eggs: [],
    lastPosition: null,
    pendingRewards: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
    ...defaultState,

    initialize: () => {
        // localStorageから復元
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved) as Partial<GameState>;
                set({
                    coins: data.coins ?? 0,
                    xp: data.xp ?? 0,
                    stats: { ...defaultState.stats, ...data.stats },
                    creatures: data.creatures ?? [],
                    unlockedAchievements: data.unlockedAchievements ?? [],
                    dailyMissions: data.dailyMissions ?? [],
                    dailyMissionsDate: data.dailyMissionsDate ?? '',
                    eggs: data.eggs ?? [],
                });
            }
        } catch (e) {
            console.warn('ゲームデータ復元エラー:', e);
        }

        // ログインストリーク更新
        const todayStr = today();
        const { stats } = get();

        if (stats.lastLoginDate !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const newStreak = stats.lastLoginDate === yesterdayStr
                ? stats.loginStreak + 1
                : 1;

            set((s) => ({
                stats: {
                    ...s.stats,
                    lastLoginDate: todayStr,
                    loginStreak: newStreak,
                    sessionsToday: 1,
                },
                pendingRewards: [
                    ...s.pendingRewards,
                    { type: 'coins' as const, message: `ログインボーナス！`, value: 10 * newStreak },
                ],
                coins: s.coins + 10 * newStreak,
                xp: s.xp + 5 * newStreak,
            }));
        }

        // デイリーミッション生成
        get().generateDailyMissions();

        // セーブ
        get().save();
    },

    addCoins: (amount, reason) => {
        set((s) => ({
            coins: s.coins + amount,
            stats: { ...s.stats, totalCoinsEarned: s.stats.totalCoinsEarned + amount },
            pendingRewards: reason
                ? [...s.pendingRewards, { type: 'coins' as const, message: reason, value: amount }]
                : s.pendingRewards,
        }));
        get().checkAchievements();
        get().save();
    },

    addXP: (amount, reason) => {
        const prevLevel = getLevelInfo(get().xp).level;
        set((s) => ({
            xp: s.xp + amount,
            pendingRewards: reason
                ? [...s.pendingRewards, { type: 'xp' as const, message: reason, value: amount }]
                : s.pendingRewards,
        }));

        const newLevel = getLevelInfo(get().xp).level;
        if (newLevel > prevLevel) {
            const info = getLevelInfo(get().xp);
            set((s) => ({
                pendingRewards: [
                    ...s.pendingRewards,
                    { type: 'levelup' as const, message: `レベル${info.level}「${info.title}」に到達！`, value: info.level },
                ],
                coins: s.coins + newLevel * 50, // レベルアップボーナス
            }));
        }
        get().checkAchievements();
        get().save();
    },

    updatePosition: (pos) => {
        const { lastPosition } = get();

        if (lastPosition) {
            const dist = haversineDistance(lastPosition, pos);

            // 歩行として妥当な移動のみカウント (0.5m〜100m)
            // GPSジッター除外 & 瞬間移動除外
            if (dist >= 0.5 && dist <= 100) {
                set((s) => ({
                    stats: { ...s.stats, totalDistanceM: s.stats.totalDistanceM + dist },
                }));

                // 100mごとにコイン＆XP
                const prevHundreds = Math.floor((get().stats.totalDistanceM - dist) / 100);
                const newHundreds = Math.floor(get().stats.totalDistanceM / 100);
                if (newHundreds > prevHundreds) {
                    get().addCoins(5);
                    get().addXP(10);

                    // デイリーミッション「歩く」進捗
                    const walkMission = get().dailyMissions.find(m => m.id === 'daily_walk');
                    if (walkMission && !walkMission.completed) {
                        get().updateMissionProgress('daily_walk', walkMission.current + 100);
                    }
                }
            }
        }

        set({ lastPosition: pos });
        get().checkAchievements();

        // 10秒ごとにセーブ（位置更新頻度が高いため）
        if (!(get() as any)._saveTimer) {
            (get() as any)._saveTimer = setTimeout(() => {
                get().save();
                (get() as any)._saveTimer = null;
            }, 10000);
        }
    },

    onObjectPlaced: () => {
        set((s) => ({
            stats: { ...s.stats, objectsPlaced: s.stats.objectsPlaced + 1 },
        }));
        get().addCoins(20, 'オブジェクト配置');
        get().addXP(25);

        // デイリーミッション進捗
        const placeMission = get().dailyMissions.find(m => m.id === 'daily_place');
        if (placeMission && !placeMission.completed) {
            get().updateMissionProgress('daily_place', placeMission.current + 1);
        }
    },

    generateEggs: (center) => {
        const { eggs } = get();

        // 既存の未期限切れエッグが3個以上なら生成しない
        const now = Date.now();
        const activeEggs = eggs.filter(e => e.expiresAt > now);
        if (activeEggs.length >= 3) {
            set({ eggs: activeEggs });
            return;
        }

        // 周囲にランダムエッグを生成（300m〜1000m範囲）
        const newEggs: CreatureEgg[] = [];
        const numToGenerate = 3 - activeEggs.length;

        for (let i = 0; i < numToGenerate; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 700; // 300m〜1000m

            // 緯度経度をメートルからオフセット
            const dLat = (dist * Math.cos(angle)) / 111320;
            const dLon = (dist * Math.sin(angle)) / (111320 * Math.cos(center.latitude * Math.PI / 180));

            // レアリティ判定
            const roll = Math.random();
            const rarity: CreatureRarity = roll < 0.05 ? 'legendary' : roll < 0.25 ? 'rare' : 'common';

            // クリーチャータイプ
            const types: CreatureType[] = ['dragon', 'bird', 'ufo'];
            const type = types[Math.floor(Math.random() * types.length)];

            newEggs.push({
                id: crypto.randomUUID(),
                position: {
                    latitude: center.latitude + dLat,
                    longitude: center.longitude + dLon,
                    altitude: 0,
                },
                creatureType: type,
                rarity,
                expiresAt: now + 3600000, // 1時間で消える
            });
        }

        set({ eggs: [...activeEggs, ...newEggs] });
        get().save();
    },

    collectEgg: (eggId) => {
        const egg = get().eggs.find(e => e.id === eggId);
        if (!egg) return;

        const info = CREATURE_INFO[egg.creatureType];
        const rarityInfo = RARITY_INFO[egg.rarity];

        // クリーチャーを追加
        const newCreature: OwnedCreature = {
            id: crypto.randomUUID(),
            type: egg.creatureType,
            name: `${info.name}`,
            rarity: egg.rarity,
            level: 1,
            xp: 0,
            discoveredAt: Date.now(),
        };

        const coinReward = 50 * rarityInfo.multiplier;
        const xpReward = 100 * rarityInfo.multiplier;

        set((s) => ({
            eggs: s.eggs.filter(e => e.id !== eggId),
            creatures: [...s.creatures, newCreature],
            stats: { ...s.stats, eggsCollected: s.stats.eggsCollected + 1 },
            pendingRewards: [
                ...s.pendingRewards,
                {
                    type: 'creature' as const,
                    message: `${rarityInfo.label}の${info.emoji}${info.name}を発見！`,
                    value: coinReward,
                },
            ],
        }));

        get().addCoins(coinReward);
        get().addXP(xpReward);

        // デイリーミッション進捗
        const eggMission = get().dailyMissions.find(m => m.id === 'daily_egg');
        if (eggMission && !eggMission.completed) {
            get().updateMissionProgress('daily_egg', eggMission.current + 1);
        }
    },

    generateDailyMissions: () => {
        const todayStr = today();
        if (get().dailyMissionsDate === todayStr) return; // 既に生成済み

        const missions: DailyMission[] = [
            {
                id: 'daily_walk',
                icon: '🚶',
                title: '500m歩こう',
                description: '今日500m以上移動する',
                target: 500,
                current: 0,
                reward: { coins: 100, xp: 50 },
                completed: false,
            },
            {
                id: 'daily_place',
                icon: '📍',
                title: 'オブジェクトを配置',
                description: 'オブジェクトを2つ配置する',
                target: 2,
                current: 0,
                reward: { coins: 80, xp: 40 },
                completed: false,
            },
            {
                id: 'daily_egg',
                icon: '🥚',
                title: 'エッグを発見',
                description: 'クリーチャーエッグを1つ見つける',
                target: 1,
                current: 0,
                reward: { coins: 120, xp: 60 },
                completed: false,
            },
        ];

        set({ dailyMissions: missions, dailyMissionsDate: todayStr });
        get().save();
    },

    updateMissionProgress: (missionId, progress) => {
        set((s) => ({
            dailyMissions: s.dailyMissions.map(m => {
                if (m.id !== missionId || m.completed) return m;
                const newCurrent = Math.min(progress, m.target);
                return { ...m, current: newCurrent };
            }),
        }));
        get().save();
    },

    claimMissionReward: (missionId) => {
        const mission = get().dailyMissions.find(m => m.id === missionId);
        if (!mission || mission.completed || mission.current < mission.target) return;

        set((s) => ({
            dailyMissions: s.dailyMissions.map(m =>
                m.id === missionId ? { ...m, completed: true } : m
            ),
        }));

        get().addCoins(mission.reward.coins, `ミッション達成: ${mission.title}`);
        get().addXP(mission.reward.xp);
    },

    checkAchievements: () => {
        const state = get();
        const newAchievements: string[] = [];

        for (const achievement of ACHIEVEMENTS) {
            if (state.unlockedAchievements.includes(achievement.id)) continue;
            if (achievement.condition(state)) {
                newAchievements.push(achievement.id);
            }
        }

        if (newAchievements.length > 0) {
            set((s) => ({
                unlockedAchievements: [...s.unlockedAchievements, ...newAchievements],
                pendingRewards: [
                    ...s.pendingRewards,
                    ...newAchievements.map(id => {
                        const a = ACHIEVEMENTS.find(a => a.id === id)!;
                        return { type: 'achievement' as const, message: `🏆 ${a.title}`, value: 50 };
                    }),
                ],
                coins: s.coins + newAchievements.length * 50, // 実績ボーナス
            }));
            get().save();
        }
    },

    popReward: () => {
        const { pendingRewards } = get();
        if (pendingRewards.length === 0) return null;

        const reward = pendingRewards[0];
        set((s) => ({ pendingRewards: s.pendingRewards.slice(1) }));
        return reward;
    },

    save: () => {
        const s = get();
        const data: Partial<GameState> = {
            coins: s.coins,
            xp: s.xp,
            stats: s.stats,
            creatures: s.creatures,
            unlockedAchievements: s.unlockedAchievements,
            dailyMissions: s.dailyMissions,
            dailyMissionsDate: s.dailyMissionsDate,
            eggs: s.eggs,
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('ゲームデータ保存エラー:', e);
        }
    },
}));
