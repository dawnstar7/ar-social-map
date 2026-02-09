import { useState, useEffect, lazy, Suspense } from 'react';
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

// Map3DViewを遅延ロード（マップタブ選択時のみロード）
const Map3DViewLazy = lazy(() =>
  import('./components/Map3DView').then(m => ({ default: m.Map3DView }))
);

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
    } else if (isInitialized && !userId) {
      initializeProfile('anonymous');
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
      {mode === 'home' && (
        <FeedView
          onNavigateToMap={() => setMode('map')}
          onNavigateToSearch={() => setMode('search')}
        />
      )}

      {mode === 'map' && (
        <Suspense fallback={
          <div className="map-container">
            <div className="map-header"><h2>🌍 マップ</h2></div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>3Dマップを読み込み中...</p>
              </div>
            </div>
          </div>
        }>
          <Map3DViewLazy />
        </Suspense>
      )}

      {mode === 'ar' && <ARView />}

      {mode === 'search' && (
        <SearchView onNavigateToMap={() => setMode('map')} />
      )}

      {mode === 'profile' && <ProfileView />}

      <BottomNavBar currentMode={mode} onModeChange={setMode} />
    </div>
  );
}

export default App;
