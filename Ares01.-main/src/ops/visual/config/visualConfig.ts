export type VisualQuality = 'low' | 'medium' | 'high';

/** Art tuning for ?visual=v2; dimensions marked DOC come from the NASA engineering data. */
export const visualConfig = {
  terrain: { widthM: 420, segments: 288, fogClear: 0.0012, fogHaze: 0.004, textureRepeat: 8 },
  camera: { fov: 42, introFov: 47, far: 6000, distance: 9.5, minDistance: 4.5, maxDistance: 28, elevation: 24, minElevation: 6, maxElevation: 65, targetHeight: 0.9, clearance: 0.8, yawResumeMs: 2500, idleOrbitAfter: 20 },
  rover: { wheelDiameterM: 0.525, wheelRadiusM: 0.2625, wheelWidthM: 0.2, trackWidthM: 2.32, wheelbaseM: 2.3, bodyWidthM: 1.15, bodyLengthM: 1.9, bodyHeightM: 0.62, wheelGroundOffsetM: 0.2525 },
  lighting: { sun: '#FFE3C4', sunIntensity: 2.6, hemisphereSky: '#D9B79A', hemisphereGround: '#5A2E1E', hemisphereIntensity: 0.55, shadowSize: 2048, shadowRange: 22.5, exposure: 1.0, horizon: '#D8A07A' },
  rocks: { boulderCapacity: 1024, pebbleCount: 360, startClearanceM: 6, detailTextureSize: 512 },
  beacon: { heightM: 18, radiusM: 0.4, ringRadiusM: 2.8 },
  effects: { grouserCount: 48, trackCount: 800, trackSpacingM: 0.25, dustCount: 140, dustKickSpeed: 0.3 },
  speedScale: 107,
} as const;

export function visualV2Enabled(search = typeof window === 'undefined' ? '' : window.location.search) {
  return new URLSearchParams(search).get('visual') === 'v2';
}

export function visualQuality(search = typeof window === 'undefined' ? '' : window.location.search): VisualQuality {
  const value = new URLSearchParams(search).get('quality');
  return value === 'low' || value === 'high' ? value : 'medium';
}
