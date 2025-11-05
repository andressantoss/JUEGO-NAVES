import {
  CONFIG,
  STATE,
  HIGH_SCORE_KEY,
  ADAPTIVE_DURATION,
  ADAPTIVE_COOLDOWN,
  QUALITY_LEVELS,
  QUALITY_PREF_KEY,
} from './config.js';
import { InputManager } from './input/inputManager.js';
import { AudioManager } from './audio/audioManager.js';
import { Starfield } from './render/starfield.js';
import { Player } from './entities/player.js';
import { HomingMissile } from './entities/projectiles.js';
import { WaveManager } from './managers/waveManager.js';
import { PowerUpManager } from './managers/powerUpManager.js';
import { UIOverlay } from './managers/uiOverlay.js';
import { Particle } from './entities/particle.js';
import { updateList } from './utils/collections.js';
import { clamp } from './utils/math.js';

function readStoredQuality() {
  try {
    return window.localStorage.getItem(QUALITY_PREF_KEY) || 'auto';
  } catch (error) {
    return 'auto';
  }
}

function storeQuality(id) {
  try {
    window.localStorage.setItem(QUALITY_PREF_KEY, id);
  } catch (error) {
    // ignore
  }
}

class AdaptiveQuality {
  constructor(levels, initialMode, onChange) {
    this.levels = levels;
    this.mode = initialMode;
    this.onChange = onChange;
    this.autoIndex = 0;
    this.currentIndex = 0;
    this.cooldown = 0;
    this.accumTime = 0;
    this.accumFrames = 0;
    this.setMode(initialMode);
  }

  setMode(mode) {
    const resolved = this._resolveMode(mode);
    this.mode = resolved;
    if (resolved === 'auto') {
      if (this.autoIndex < 0 || this.autoIndex >= this.levels.length) {
        this.autoIndex = 0;
      }
      this.currentIndex = this.autoIndex;
    } else {
      const explicitIndex = this.levels.findIndex((entry) => entry.id === resolved);
      this.currentIndex = explicitIndex >= 0 ? explicitIndex : 0;
    }
    storeQuality(resolved);
    this._apply();
  }

  _resolveMode(mode) {
    if (mode === 'auto') return 'auto';
    if (this.levels.some((entry) => entry.id === mode)) {
      return mode;
    }
    return 'auto';
  }

  _apply() {
    const level = this.levels[this.currentIndex];
    if (this.onChange) {
      this.onChange(level);
    }
  }

  update(dt) {
    if (this.mode !== 'auto') return;
    const level = this.levels[this.currentIndex];
    this.accumTime += dt;
    this.accumFrames += 1;
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    if (this.accumTime >= 1.5) {
      const fps = this.accumFrames / this.accumTime;
      this.accumTime = 0;
      this.accumFrames = 0;
      if (fps < level.fpsTarget && this.currentIndex < this.levels.length - 1 && this.cooldown <= 0) {
        this.currentIndex += 1;
        this.autoIndex = this.currentIndex;
        this.cooldown = 4.5;
        this._apply();
      } else if (fps > level.fpsTarget + 12 && this.currentIndex > 0 && this.cooldown <= 0) {
        this.currentIndex -= 1;
        this.autoIndex = this.currentIndex;
        this.cooldown = 6.5;
        this._apply();
      }
    }
  }

  get scale() {
    return this.levels[this.currentIndex].scale;
  }

  get label() {
    const name = this.levels[this.currentIndex].id;
    if (this.mode === 'auto') {
      return `Auto (${name})`;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  get modeId() {
    return this.mode;
  }
}

function resizeCanvas(canvas, ctx, input, scale) {
  const dpr = window.devicePixelRatio || 1;
  const renderScale = scale || 1;
  canvas.width = CONFIG.logicWidth * dpr * renderScale;
  canvas.height = CONFIG.logicHeight * dpr * renderScale;
  ctx.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
  canvas.style.aspectRatio = `${CONFIG.logicWidth} / ${CONFIG.logicHeight}`;
  const rect = canvas.getBoundingClientRect();
  const uiScale = Math.min(rect.width, rect.height) / CONFIG.logicHeight;
  document.documentElement.style.setProperty('--ui-scale', uiScale.toFixed(3));
  if (input) {
    input.updateBounds(rect);
  }
}

function handleMissileCollisions(game) {
  for (let i = 0; i < game.missiles.length; i += 1) {
    const missile = game.missiles[i];
    if (!missile.active) continue;
    for (let j = 0; j < game.enemies.length; j += 1) {
      const enemy = game.enemies[j];
      if (!enemy.active) continue;
      const dx = missile.position.x - enemy.position.x;
      const dy = missile.position.y - enemy.position.y;
      const radius = missile.radius + enemy.radius;
      if (dx * dx + dy * dy <= radius * radius) {
        missile.active = false;
        for (let spark = 0; spark < 6; spark += 1) {
          game.particles.push(new Particle(missile.position.x, missile.position.y, '#ffc870'));
        }
        const destroyed = enemy.takeDamage(missile.damage);
        if (destroyed) {
          game.addScore(enemy.scoreValue);
          game.audio.playExplosion();
          game._spawnExplosion(enemy.position.x, enemy.position.y);
          game.powerUpManager.requestDrop(enemy.position.x, enemy.position.y);
          if (enemy.type === 'asteroid' && enemy.split) {
            enemy.split(game);
          }
        }
        break;
      }
    }
  }
}

export class Game {
  constructor({
    canvas,
    context,
    scoreEl,
    bestEl,
    livesEl,
    levelEl,
    messageEl,
    shotIndicator,
    shotIcon,
    shotTimer,
    missileIndicator,
    missileTimer,
    muteButton,
    fullscreenButton,
    qualitySelect,
    container,
  }) {
    this.canvas = canvas;
    this.ctx = context;
    this.state = STATE.RUNNING;
    this.score = 0;
    this.best = parseInt(window.localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    this.lives = 3;
    this.level = 1;
    this.player = new Player();
    this.bullets = [];
    this.enemyBullets = [];
    this.missiles = [];
    this.enemies = [];
    this.particles = [];
    this.starfield = new Starfield();
    this.waveManager = new WaveManager();
    this.powerUpManager = new PowerUpManager(this);
    this.input = new InputManager(canvas, container);
    this.audio = new AudioManager();
    this.ui = new UIOverlay(
      scoreEl,
      bestEl,
      livesEl,
      levelEl,
      messageEl,
      shotIndicator,
      shotIcon,
      shotTimer,
      missileIndicator,
      missileTimer,
      muteButton,
      fullscreenButton,
      qualitySelect,
    );
    this.lastTime = performance.now();
    this.elapsedTime = 0;
    this.factorBase = 1;
    this.factorEffective = 1;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.adaptive = { active: false, timer: 0, cooldown: 0 };
    this.resizePause = false;
    this.resumeAfterResize = false;
    this._resizeTimeout = null;
    this._loop = this._loop.bind(this);
    const storedQuality = readStoredQuality();
    this.quality = new AdaptiveQuality(QUALITY_LEVELS, storedQuality, (level) => {
      this.ui.setQualityLabel(this.quality.modeId);
      resizeCanvas(this.canvas, this.ctx, this.input, level.scale);
    });
    resizeCanvas(this.canvas, this.ctx, this.input, this.quality.scale);
    this.ui.setFullscreenLabel(Boolean(document.fullscreenElement));
    this.ui.setMuteLabel(this.audio.isMuted());
    this._setupEventHooks(muteButton, fullscreenButton, qualitySelect);
    requestAnimationFrame(this._loop);
  }

  _setupEventHooks(muteButton, fullscreenButton, qualitySelect) {
    window.addEventListener('resize', () => {
      this.handleResizeStart();
      if (this._resizeTimeout) {
        clearTimeout(this._resizeTimeout);
      }
      this._resizeTimeout = window.setTimeout(() => {
        resizeCanvas(this.canvas, this.ctx, this.input, this.quality.scale);
        this.handleResizeEnd();
      }, 140);
    });

    document.addEventListener('fullscreenchange', () => {
      this.ui.setFullscreenLabel(Boolean(document.fullscreenElement));
      resizeCanvas(this.canvas, this.ctx, this.input, this.quality.scale);
      this.handleResizeEnd();
    });

    document.addEventListener('webkitfullscreenchange', () => {
      const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      this.ui.setFullscreenLabel(isFullscreen);
      resizeCanvas(this.canvas, this.ctx, this.input, this.quality.scale);
      this.handleResizeEnd();
    });

    muteButton.addEventListener('click', () => {
      this.toggleMute();
    });

    fullscreenButton.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    if (qualitySelect) {
      qualitySelect.addEventListener('change', (event) => {
        const value = event.target.value;
        this.quality.setMode(value);
        this.ui.setQualityLabel(this.quality.modeId);
      });
      this.ui.setQualityLabel(this.quality.modeId);
    }

    const unlockAudio = () => {
      this.audio.resume();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }

  handleResizeStart() {
    if (this.resizePause) return;
    this.resizePause = true;
    if (this.state === STATE.RUNNING) {
      this.state = STATE.PAUSED;
      this.resumeAfterResize = true;
    }
  }

  handleResizeEnd() {
    this.resizePause = false;
    if (this.resumeAfterResize && this.state !== STATE.GAME_OVER) {
      this.state = STATE.RUNNING;
    }
    this.resumeAfterResize = false;
  }

  toggleFullscreen() {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      this.handleResizeStart();
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } else if (this.canvas.parentElement?.requestFullscreen) {
      this.handleResizeStart();
      this.canvas.parentElement.requestFullscreen();
    } else if (this.canvas.parentElement?.webkitRequestFullscreen) {
      this.handleResizeStart();
      this.canvas.parentElement.webkitRequestFullscreen();
    }
  }

  toggleMute() {
    const muted = this.audio.toggleMute();
    this.ui.setMuteLabel(muted);
  }

  togglePause() {
    if (this.state === STATE.GAME_OVER) return;
    if (this.state === STATE.RUNNING) {
      this.state = STATE.PAUSED;
    } else if (this.state === STATE.PAUSED && !this.resizePause) {
      this.state = STATE.RUNNING;
    }
  }

  reset() {
    this.state = STATE.RUNNING;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.elapsedTime = 0;
    this.factorBase = 1;
    this.factorEffective = 1;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.adaptive = { active: false, timer: 0, cooldown: 0 };
    this.player.reset();
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    this.missiles.length = 0;
    this.enemies.length = 0;
    this.particles.length = 0;
    this.waveManager.reset();
    this.powerUpManager.reset();
  }

  endGame() {
    this.state = STATE.GAME_OVER;
    if (this.score > this.best) {
      this.best = this.score;
      window.localStorage.setItem(HIGH_SCORE_KEY, String(this.best));
    }
  }

  addScore(points) {
    this.score += points;
    const oldLevel = this.level;
    if (this.level < 10) {
      const nextLevelScore = this.level * 10000;
      if (this.score >= nextLevelScore) {
        this.level += 1;
      }
    }
    if (this.level > oldLevel && this.level === 4) {
      this.waveManager.bossTimer = 60;
    }
  }

  addLife(amount) {
    this.lives = Math.min(5, this.lives + amount);
  }

  addAsteroid(asteroid) {
    this.enemies.push(asteroid);
  }

  countAsteroids() {
    let total = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (enemy.type === 'asteroid' && enemy.active) {
        total += 1;
      }
    }
    return total;
  }

  activateShotUpgrade() {
    this.player.activateShotUpgrade(CONFIG.doubleShotDuration);
  }

  activateMissiles() {
    this.player.activateMissiles(CONFIG.missileDuration);
  }

  spawnMissile(x, y) {
    const missile = new HomingMissile(x, y, CONFIG.missileSpeed, CONFIG.missileTurnRate);
    this.missiles.push(missile);
    this.audio.playMissile();
  }

  hasActiveBoss() {
    return this.enemies.some((enemy) => enemy.type === 'boss' && enemy.active);
  }

  getAccuracy() {
    if (this.shotsFired === 0) return 1;
    return clamp(this.shotsHit / this.shotsFired, 0, 1);
  }

  _updateDifficulty(dt) {
    const timeComponent = Math.min(this.elapsedTime * CONFIG.difficultyPerSec, 1.5);
    const scoreComponent = Math.min(this.score * CONFIG.difficultyPerScore, CONFIG.difficultyMax);
    this.factorBase = clamp(1 + timeComponent + scoreComponent, 1, CONFIG.difficultyMax);

    if (this.adaptive.cooldown > 0) {
      this.adaptive.cooldown = Math.max(0, this.adaptive.cooldown - dt);
    }

    if (this.adaptive.active) {
      this.adaptive.timer -= dt;
      if (this.adaptive.timer <= 0) {
        this.adaptive.active = false;
      }
    }

    const accuracy = this.getAccuracy();
    if (!this.adaptive.active && this.adaptive.cooldown <= 0 && (this.lives === 1 || accuracy < 0.2)) {
      this.adaptive.active = true;
      this.adaptive.timer = ADAPTIVE_DURATION;
      this.adaptive.cooldown = ADAPTIVE_COOLDOWN;
    }

    const adaptiveMultiplier = this.adaptive.active ? 0.8 : 1;
    const adjusted = this.factorBase * adaptiveMultiplier;
    this.factorEffective = clamp(adjusted, 0.8, CONFIG.difficultyMax);
  }

  _spawnExplosion(x, y) {
    for (let i = 0; i < 14; i += 1) {
      this.particles.push(new Particle(x, y, '#ffc870'));
    }
  }

  _handleCollisions() {
    for (let i = 0; i < this.bullets.length; i += 1) {
      const bullet = this.bullets[i];
      if (!bullet.active) continue;
      for (let j = 0; j < this.enemies.length; j += 1) {
        const enemy = this.enemies[j];
        if (!enemy.active) continue;
        const dx = bullet.position.x - enemy.position.x;
        const dy = bullet.position.y - enemy.position.y;
        const radius = bullet.radius + enemy.radius;
        if (dx * dx + dy * dy <= radius * radius) {
          bullet.active = false;
          this.shotsHit += 1;
          const destroyed = enemy.takeDamage();
          if (destroyed) {
            this.addScore(enemy.scoreValue);
            this.audio.playExplosion();
            this._spawnExplosion(enemy.position.x, enemy.position.y);
            this.powerUpManager.requestDrop(enemy.position.x, enemy.position.y);
            if (enemy.type === 'asteroid' && enemy.split) {
              enemy.split(this);
            }
          }
          break;
        }
      }
    }

    if (!this.player.isInvulnerable()) {
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        if (!enemy.active) continue;
        if (enemy.collisionDelay && enemy.collisionDelay > 0) continue;
        const dx = this.player.position.x - enemy.position.x;
        const dy = this.player.position.y - enemy.position.y;
        const radius = this.player.radius + enemy.radius * 0.7;
        if (dx * dx + dy * dy <= radius * radius) {
          enemy.active = false;
          this.audio.playExplosion();
          this._spawnExplosion(enemy.position.x, enemy.position.y);
          if (enemy.type === 'asteroid' && enemy.split) {
            enemy.split(this);
          }
          this.player.registerHit();
          this.lives -= 1;
          if (this.lives <= 0) {
            this.endGame();
          }
          break;
        }
      }
    }

    for (let i = 0; i < this.enemyBullets.length; i += 1) {
      const bullet = this.enemyBullets[i];
      if (!bullet.active || this.player.isInvulnerable()) continue;
      const dx = this.player.position.x - bullet.position.x;
      const dy = this.player.position.y - bullet.position.y;
      const radius = this.player.radius + bullet.radius;
      if (dx * dx + dy * dy <= radius * radius) {
        bullet.active = false;
        this.audio.playExplosion();
        this._spawnExplosion(this.player.position.x, this.player.position.y);
        this.player.registerHit();
        this.lives -= 1;
        if (this.lives <= 0) {
          this.endGame();
        }
      }
    }
  }

  update(dt) {
    this.input.update(dt);
    this.quality.update(dt);
    this.starfield.update(dt * 0.9);

    if (this.state !== STATE.RUNNING) {
      return;
    }

    this.elapsedTime += dt;
    this._updateDifficulty(dt);

    const target = this.input.getTargetPosition();
    this.player.update(dt, target);

    if (this.input.isFiring()) {
      this.player.tryShoot(
        this.bullets,
        this.audio,
        (x, y) => {
          this.spawnMissile(x, y);
        },
        () => {
          this.shotsFired += 1;
        },
      );
    }

    this.waveManager.update(dt, this.factorEffective, this);

    updateList(this.bullets, (bullet) => {
      bullet.update(dt);
      return bullet.active;
    });
    updateList(this.enemyBullets, (shot) => {
      shot.update(dt);
      return shot.active;
    });
    updateList(this.missiles, (missile) => {
      missile.update(dt, this.enemies);
      return missile.active;
    });
    updateList(this.enemies, (enemy) => {
      enemy.update(dt, this.factorEffective, this.player.position, this.enemyBullets, this.audio);
      return enemy.active;
    });
    this.powerUpManager.update(dt);
    updateList(this.particles, (particle) => {
      particle.update(dt);
      return particle.active;
    });

    this._handleCollisions();
    handleMissileCollisions(this);

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  draw() {
    const ctx = this.ctx;
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.logicHeight);
    bgGradient.addColorStop(0, '#050b1c');
    bgGradient.addColorStop(0.45, '#08183c');
    bgGradient.addColorStop(1, '#030512');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CONFIG.logicWidth, CONFIG.logicHeight);

    const nebula = ctx.createRadialGradient(
      CONFIG.logicWidth * 0.75,
      CONFIG.logicHeight * 0.25,
      80,
      CONFIG.logicWidth * 0.75,
      CONFIG.logicHeight * 0.25,
      520,
    );
    nebula.addColorStop(0, 'rgba(120, 92, 255, 0.35)');
    nebula.addColorStop(0.6, 'rgba(120, 92, 255, 0.08)');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, CONFIG.logicWidth, CONFIG.logicHeight);

    this.starfield.draw(ctx);
    this.powerUpManager.draw(ctx);
    for (const bullet of this.bullets) bullet.draw(ctx);
    for (const missile of this.missiles) missile.draw(ctx);
    for (const enemyBullet of this.enemyBullets) enemyBullet.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    this.player.draw(ctx);
    for (const particle of this.particles) particle.draw(ctx);

    if (this.state === STATE.PAUSED && !this.resizePause) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, CONFIG.logicWidth, CONFIG.logicHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', CONFIG.logicWidth / 2, CONFIG.logicHeight / 2);
      ctx.restore();
    } else if (this.state === STATE.GAME_OVER) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, CONFIG.logicWidth, CONFIG.logicHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 70px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CONFIG.logicWidth / 2, CONFIG.logicHeight / 2 - 40);
      ctx.font = '32px sans-serif';
      ctx.fillText(`Puntuación: ${this.score}`, CONFIG.logicWidth / 2, CONFIG.logicHeight / 2 + 10);
      ctx.fillText('Pulsa R para reiniciar', CONFIG.logicWidth / 2, CONFIG.logicHeight / 2 + 60);
      ctx.restore();
    }
  }

  _loop(currentTime) {
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const dt = Math.min(delta, 0.05);

    if (this.input.consumePause()) {
      this.togglePause();
    }
    if (this.input.consumeRestart()) {
      this.reset();
    }
    if (this.input.consumeFullscreen()) {
      this.toggleFullscreen();
    }

    this.update(dt);
    this.ui.update(
      this.score,
      this.best,
      this.lives,
      this.level,
      this.state,
      this.getAccuracy(),
      this.adaptive.active,
      this.resizePause,
      this.player.shotLevel,
      this.player.shotLevelTimer,
      this.player.missileTimer,
      this.quality.label,
    );
    this.draw();
    requestAnimationFrame(this._loop);
  }
}

export function startGame(options) {
  return new Game(options);
}
