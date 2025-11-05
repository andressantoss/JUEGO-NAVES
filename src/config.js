export const CONFIG = {
  baseSpawn: 0.8,
  difficultyPerSec: 0.015,
  difficultyPerScore: 0.0008,
  difficultyMax: 3.0,
  logicWidth: 1920,
  logicHeight: 1080,
  powerDropChance: 0.06,
  doubleShotDuration: 12,
  maxAsteroids: 40,
  spreadDeg: 7,
  missileDuration: 10,
  missileCooldown: 0.45,
  missileSpeed: 520,
  missileTurnRate: 3.4,
};

export const QUALITY_LEVELS = [
  { id: 'ultra', scale: 1.0, fpsTarget: 54 },
  { id: 'high', scale: 0.85, fpsTarget: 48 },
  { id: 'medium', scale: 0.7, fpsTarget: 42 },
  { id: 'low', scale: 0.55, fpsTarget: 36 },
];

export const ADAPTIVE_DURATION = 10;
export const ADAPTIVE_COOLDOWN = 20;

export const STATE = {
  RUNNING: 'running',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
};

export const HIGH_SCORE_KEY = 'space-mouse-mini-highscore';
export const MUTE_PREF_KEY = 'space-mouse-mini-muted';
export const QUALITY_PREF_KEY = 'space-mouse-mini-quality';
