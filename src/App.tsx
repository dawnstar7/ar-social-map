import { useState, useEffect } from 'react';
import { Map3DView } from './components/Map3DView';
import { ARView } from './components/ARView';
import { ProfileView } from './components/ProfileView';
import { BottomNavBar } from './components/BottomNavBar';
import { useObjectStore } from './store/objectStore';
import { useProfileStore } from './store/profileStore';
import { useFollowStore } from './store/followStore';
import './App.css';

type AppMode = 'map' | 'ar' | 'profile';

function App() {
  const [mode, setMode] = useState<AppMode>('map');
  const { initialize, isInitialized, userId } = useObjectStore();
  const { initializeProfile } = useProfileStore();
  const { initializeFollows } = useFollowStore();

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
      {/* マップは常にマウントしておき、CSSで表示/非表示を切り替える */}
      <div style={{ display: mode === 'map' ? 'contents' : 'none' }}>
        <Map3DView />
      </div>
      {mode === 'ar' && <ARView />}
      {mode === 'profile' && <ProfileView />}
      <BottomNavBar currentMode={mode} onModeChange={setMode} />
    </div>
  );
}

export default App;
