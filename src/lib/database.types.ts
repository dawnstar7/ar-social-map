/**
 * Supabaseデータベース型定義
 */

export interface Database {
    public: {
        Tables: {
            ar_objects: {
                Row: {
                    id: string;
                    owner_id: string;
                    is_public: boolean;
                    position: {
                        latitude: number;
                        longitude: number;
                        altitude: number;
                    };
                    name: string;
                    color: string;
                    object_type: 'static' | 'flying';
                    creature: 'dragon' | 'bird' | 'ufo' | null;
                    flight_config: {
                        pattern: 'circle' | 'random' | 'figure8';
                        radius: number;
                        minAltitude: number;
                        maxAltitude: number;
                        speed: number;
                    } | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    owner_id: string;
                    is_public?: boolean;
                    position: {
                        latitude: number;
                        longitude: number;
                        altitude: number;
                    };
                    name: string;
                    color: string;
                    object_type: 'static' | 'flying';
                    creature?: 'dragon' | 'bird' | 'ufo' | null;
                    flight_config?: {
                        pattern: 'circle' | 'random' | 'figure8';
                        radius: number;
                        minAltitude: number;
                        maxAltitude: number;
                        speed: number;
                    } | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    owner_id?: string;
                    is_public?: boolean;
                    position?: {
                        latitude: number;
                        longitude: number;
                        altitude: number;
                    };
                    name?: string;
                    color?: string;
                    object_type?: 'static' | 'flying';
                    creature?: 'dragon' | 'bird' | 'ufo' | null;
                    flight_config?: {
                        pattern: 'circle' | 'random' | 'figure8';
                        radius: number;
                        minAltitude: number;
                        maxAltitude: number;
                        speed: number;
                    } | null;
                };
            };
            follows: {
                Row: {
                    follower_id: string;
                    following_id: string;
                    created_at: string;
                };
                Insert: {
                    follower_id: string;
                    following_id: string;
                    created_at?: string;
                };
                Update: {
                    follower_id?: string;
                    following_id?: string;
                };
            };
            profiles: {
                Row: {
                    id: string;
                    display_name: string;
                    avatar_color: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    display_name: string;
                    avatar_color?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    display_name?: string;
                    avatar_color?: string;
                    updated_at?: string;
                };
            };
        };
    };
}
