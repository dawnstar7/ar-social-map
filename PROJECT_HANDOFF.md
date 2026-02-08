# 3D Map AR Social App - Project Handoff 🚀

This document contains all necessary information to hand off this project to another AI assistant (e.g., Claude Code) or developer.

## 📌 Project Overview
A web-based 3D map and AR application with social features.
- **3D Map**: Uses **CesiumJS** with Google Photorealistic 3D Tiles.
- **AR View**: Uses device orientation (gyroscope) to overlay 3D objects on camera feed.
- **Social Features**: Uses **Supabase** for real-time object syncing and anonymous authentication.
- **Flying Objects**: Autonomous flying dragons/ufo behavior.

## 🛠 Tech Stack
- **Framework**: React + Vite + TypeScript
- **3D Map**: Cesium (Resium)
- **AR**: DeviceOrientation Event + Three.js (via React Three Fiber)
- **Backend / Database**: Supabase (PostgreSQL + RLS)
- **Styling**: Vanilla CSS (variables, responsive)
- **Mobile Debug**: vConsole (for mobile browser debugging)

## 📂 Key File Structure
```
src/
├── components/
│   ├── Map3DView.tsx       # Main 3D map view (Cesium)
│   ├── ARView.tsx          # AR camera view
│   ├── ErrorBoundary.tsx   # Error handling for map crashes
│   └── ...
├── store/
│   └── objectStore.ts      # Zustand store + Supabase sync logic
├── lib/
│   ├── supabase.ts         # Supabase client setup
│   └── database.types.ts   # Generated database types
├── utils/
│   ├── developerObjects.ts # Hardcoded flying objects logic
│   └── flyingBehavior.ts   # Flight path calculation
└── App.tsx                 # Main entry, handles mode switching
```

## ⚙️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (.env.local)
Create a `.env.local` file in the root directory with the following keys:
```env
VITE_CESIUM_TOKEN=your_cesium_ion_token
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Setup
You need to set up a Supabase project.

**A. Enable Anonymous Auth**
- Go to `Authentication` -> `Providers`.
- Enable **Anonymous Sign-ins**.

**B. Run Database Schema**
Execute the following SQL in the Supabase SQL Editor:
```sql
-- Create AR Objects Table
CREATE TABLE IF NOT EXISTS ar_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    position JSONB NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#ff4444',
    object_type TEXT NOT NULL DEFAULT 'static',
    creature TEXT,
    flight_config JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ar_objects ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own objects" ON ar_objects
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view public objects" ON ar_objects
    FOR SELECT USING (is_public = true);
```

### 4. Run Development Server
```bash
npm run dev
```

## ✅ Implemented Features
- [x] **3D Map**: View global 3D tiles, place pins via crosshair.
- [x] **AR Mode**: Switch to camera view, see placed objects in AR.
- [x] **Flying Objects**: Dragons, UFOs, Birds with autonomous flight paths.
- [x] **Supabase Sync**: Objects are saved to DB and synced across users.
- [x] **Anonymous Auth**: Users are automatically authenticated anonymously.
- [x] **Mobile Support**: Added ErrorBoundary and fallback UI for devices without WebGL support.

## 🚧 Next Steps / Future Work
- **Follow System**: Allow users to follow specific users and see only their objects.
- **User Profiles**: Simple profile settings (name, avatar color).
- **Persistent Flight State**: Sync flight animation state across clients (currently local calculation).
