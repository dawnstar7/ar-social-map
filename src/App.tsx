import { useState, useEffect } from 'react';
import { SmartMapView } from './components/SmartMapView';
import { ARView } from './components/ARView';
import { ProfileView } from './components/ProfileView';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { BottomNavBar } from './components/BottomNavBar';
import { useObjectStore } from './store/objectStore';
import { useProfileStore } from './store/profileStore';
import { useFollowStore } from './store/followStore';
import './App.css';

type AppMode = 'home' | 'map' | 'ar' | 'search' | 'profile';

function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const { initialize, isInitialized, userId, fetchFollowedObjects } = useObjectStore();
  const { initializeProfile } = useProfileStore();
  const { initializeFollows, following } = useFollowStore();

  // Supabase初期化 + プロフィール + フォロー初期化
  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && userId) {
      initializeProfile(userId);
      initializeFollows(userId);
    }
  }, [isInitialized, userId, initializeProfile, initializeFollows]);

  // フォローリスト変更時 → フォロー中ユーザーのオブジェクトを取得
  useEffect(() => {
    if (isInitialized && following.length > 0) {
      fetchFollowedObjects(following);
    }
  }, [isInitialized, following, fetchFollowedObjects]);

  // 初期化中の表示
  if (!isInitialized) {
    return (
      <div className="app loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>接続中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ホームフィード */}
      {mode === 'home' && (
        <FeedView onNavigateToMap={() => setMode('map')} />
      )}

      {/* マップは常にマウントしておき、CSSで表示/非表示を切り替える */}
      <div style={{ display: mode === 'map' ? 'contents' : 'none' }}>
        <SmartMapView />
      </div>

      {/* AR */}
      {mode === 'ar' && <ARView />}

      {/* 検索 */}
      {mode === 'search' && (
        <SearchView onNavigateToMap={() => setMode('map')} />
      )}

      {/* プロフィール */}
      {mode === 'profile' && <ProfileView />}

      <BottomNavBar currentMode={mode} onModeChange={setMode} />
    </div>
  );
}

export default App;
