

export type UGCType = 'TEXT' | 'MEDIA' | 'MODEL' | 'AUDIO';

export interface UGCProperties {
    // Common
    scale?: number;
    rotation?: [number, number, number]; // Euler angles [x, y, z] in radians

    // TEXT
    text?: string;
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    isEmissive?: boolean;

    // MEDIA (Photo/Video)
    url?: string;
    mediaType?: 'image' | 'video';
    aspectRatio?: number;

    // MODEL
    modelUrl?: string; // .glb URL
    animationName?: string;

    // AUDIO
    audioUrl?: string;
    volume?: number;
    maxDistance?: number;
    loop?: boolean;
}

// 既存のPlacedObjectと互換性を持たせるための拡張インターフェース
// (store/objectStore.ts で PlacedObject にこれらをオプショナルで追加する形になる想定)
