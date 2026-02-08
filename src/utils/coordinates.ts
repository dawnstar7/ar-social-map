/**
 * 座標変換ユーティリティ
 * 緯度経度からAR空間のXYZ座標への変換を行う
 */

// WGS84楕円体パラメータ
const WGS84 = {
  a: 6378137.0,              // 赤道半径 (m)
  f: 1 / 298.257223563,      // 扁平率
  get e2() {                 // 離心率の二乗
    return 2 * this.f - this.f * this.f;
  }
};

export interface GeoPosition {
  latitude: number;   // 緯度 (度)
  longitude: number;  // 経度 (度)
  altitude: number;   // 高度 (m)
}

export interface ECEFPosition {
  x: number;
  y: number;
  z: number;
}

export interface ENUPosition {
  east: number;
  north: number;
  up: number;
}

export interface ThreeJSPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * 度をラジアンに変換
 */
function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * WGS84測地座標からECEF地心直交座標への変換
 * @param geo 緯度経度高度
 * @returns ECEF座標 (メートル)
 */
export function geodeticToECEF(geo: GeoPosition): ECEFPosition {
  const latRad = toRadians(geo.latitude);
  const lonRad = toRadians(geo.longitude);
  
  // 卯酉線曲率半径
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const N = WGS84.a / Math.sqrt(1 - WGS84.e2 * sinLat * sinLat);
  
  return {
    x: (N + geo.altitude) * cosLat * Math.cos(lonRad),
    y: (N + geo.altitude) * cosLat * Math.sin(lonRad),
    z: (N * (1 - WGS84.e2) + geo.altitude) * sinLat
  };
}

/**
 * ECEF座標からENU(East-North-Up)ローカル座標への変換
 * @param target ターゲット位置のECEF座標
 * @param origin 原点（デバイス位置）のECEF座標
 * @param originGeo 原点の測地座標
 * @returns ENU座標 (メートル)
 */
export function ecefToENU(
  target: ECEFPosition,
  origin: ECEFPosition,
  originGeo: GeoPosition
): ENUPosition {
  const latRad = toRadians(originGeo.latitude);
  const lonRad = toRadians(originGeo.longitude);
  
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);
  
  // ECEF差分ベクトル
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  
  // 回転行列を適用してENU座標に変換
  const east = -sinLon * dx + cosLon * dy;
  const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;
  
  return { east, north, up };
}

/**
 * ENU座標からThree.js座標への変換
 * Three.jsは右手座標系: X=右, Y=上, Z=手前
 * @param enu ENU座標
 * @returns Three.js座標
 */
export function enuToThreeJS(enu: ENUPosition): ThreeJSPosition {
  return {
    x: enu.east,    // East → +X (右)
    y: enu.up,      // Up → +Y (上)
    z: -enu.north   // North → -Z (Three.jsは-Zが前方)
  };
}

/**
 * コンパス方位（北からの角度）を適用して座標を回転
 * @param position 元の位置
 * @param headingDegrees デバイスの方位角（北=0、東=90）
 * @returns 回転後の位置
 */
export function applyHeading(
  position: ThreeJSPosition,
  headingDegrees: number
): ThreeJSPosition {
  const headingRad = toRadians(headingDegrees);
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  
  return {
    x: position.x * cos - position.z * sin,
    y: position.y,
    z: position.x * sin + position.z * cos
  };
}

/**
 * 緯度経度からAR空間のThree.js座標への統合変換
 * @param target 対象オブジェクトの位置
 * @param devicePosition デバイスの現在位置
 * @param heading デバイスの方位角（度）、省略時は0
 * @returns Three.js座標
 */
export function getRelativePosition(
  target: GeoPosition,
  devicePosition: GeoPosition,
  heading: number = 0
): ThreeJSPosition {
  // Step 1: WGS84 → ECEF
  const targetECEF = geodeticToECEF(target);
  const deviceECEF = geodeticToECEF(devicePosition);
  
  // Step 2: ECEF → ENU
  const enu = ecefToENU(targetECEF, deviceECEF, devicePosition);
  
  // Step 3: ENU → Three.js
  const threePos = enuToThreeJS(enu);
  
  // Step 4: コンパス補正
  return applyHeading(threePos, heading);
}

/**
 * 2点間の距離を計算（メートル）
 * @param pos1 位置1
 * @param pos2 位置2
 * @returns 距離（メートル）
 */
export function calculateDistance(pos1: GeoPosition, pos2: GeoPosition): number {
  const ecef1 = geodeticToECEF(pos1);
  const ecef2 = geodeticToECEF(pos2);
  
  const dx = ecef2.x - ecef1.x;
  const dy = ecef2.y - ecef1.y;
  const dz = ecef2.z - ecef1.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
