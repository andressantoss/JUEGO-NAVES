import { startGame } from './src/game.js';

const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d', { alpha: false });
context.imageSmoothingEnabled = true;

window.spaceMouseGame = startGame({
  canvas,
  context,
  scoreEl: document.getElementById('score-value'),
  bestEl: document.getElementById('best-value'),
  livesEl: document.getElementById('lives-value'),
  levelEl: document.getElementById('level-value'),
  messageEl: document.getElementById('messages'),
  shotIndicator: document.getElementById('shot-level-indicator'),
  shotIcon: document.getElementById('shot-level-icon'),
  shotTimer: document.getElementById('shot-level-timer'),
  missileIndicator: document.getElementById('missile-indicator'),
  missileTimer: document.getElementById('missile-timer'),
  muteButton: document.getElementById('mute-toggle'),
  fullscreenButton: document.getElementById('fullscreen-toggle'),
  qualitySelect: document.getElementById('quality-select'),
  container: document.getElementById('game-container'),
});
