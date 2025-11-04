// Mini juego de naves controlado con el mouse usando Canvas 2D.
// Código estructurado por entidades y managers con comentarios en español.

(() => {
  'use strict';

  const CONFIG = {
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

  const ADAPTIVE_DURATION = 10;
  const ADAPTIVE_COOLDOWN = 20;

  const STATE = {
    RUNNING: 'running',
    PAUSED: 'paused',
    GAME_OVER: 'game-over',
  };

  const HIGH_SCORE_KEY = 'space-mouse-mini-highscore';

  const root = document.documentElement;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;

  const hudScore = document.getElementById('score-value');
  const hudBest = document.getElementById('best-value');
  const hudLives = document.getElementById('lives-value');
  const hudLevel = document.getElementById('level-value');
  const hudMessages = document.getElementById('messages');
  const hudShotLevelIndicator = document.getElementById('shot-level-indicator');
  const hudShotLevelIcon = document.getElementById('shot-level-icon');
  const hudShotLevelTimer = document.getElementById('shot-level-timer');
  const hudMissileIndicator = document.getElementById('missile-indicator');
  const hudMissileTimer = document.getElementById('missile-timer');
  const muteButton = document.getElementById('mute-toggle');
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const gameContainer = document.getElementById('game-container');

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max) => Math.random() * (max - min) + min;
  const chance = (probability) => Math.random() < probability;
  const weightedPick = (options) => {
    let total = 0;
    for (const option of options) {
      total += option.weight;
    }
    let roll = Math.random() * total;
    for (const option of options) {
      if (roll < option.weight) {
        return option.value;
      }
      roll -= option.weight;
    }
    return options[options.length - 1].value;
  };

  function resizeCanvas(game) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CONFIG.logicWidth * dpr;
    canvas.height = CONFIG.logicHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = canvas.getBoundingClientRect();
    const uiScale = Math.min(rect.width, rect.height) / CONFIG.logicHeight;
    root.style.setProperty('--ui-scale', uiScale.toFixed(3));
    if (game && game.input) {
      game.input.updateBounds(rect);
    }
  }

  class InputManager {
    constructor(targetCanvas) {
      this.canvas = targetCanvas;
      this.bounds = this.canvas.getBoundingClientRect();
      this.mouse = {
        x: CONFIG.logicWidth / 2,
        y: CONFIG.logicHeight * 0.75,
        isDown: false,
      };
      this.pausePressed = false;
      this.restartPressed = false;
      this.fullscreenPressed = false;
      this._targetBuffer = { x: this.mouse.x, y: this.mouse.y };
      this._setupEvents();
    }

    updateBounds(rect) {
      this.bounds = rect;
    }

    _setupEvents() {
      const updateMouse = (event) => {
        const rect = this.bounds || this.canvas.getBoundingClientRect();
        const scaleX = CONFIG.logicWidth / rect.width;
        const scaleY = CONFIG.logicHeight / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        this.mouse.x = clamp(x, 0, CONFIG.logicWidth);
        this.mouse.y = clamp(y, 0, CONFIG.logicHeight);
      };

      this.canvas.addEventListener('pointermove', (event) => {
        updateMouse(event);
      });

      this.canvas.addEventListener('pointerdown', (event) => {
        if (event.button === 0) {
          this.mouse.isDown = true;
        }
        this.canvas.setPointerCapture(event.pointerId);
        updateMouse(event);
      });

      this.canvas.addEventListener('pointerup', (event) => {
        if (event.button === 0) {
          this.mouse.isDown = false;
        }
        this.canvas.releasePointerCapture(event.pointerId);
      });

      window.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        if (event.key === 'p' || event.key === 'P') {
          this.pausePressed = true;
        } else if (event.key === 'r' || event.key === 'R') {
          this.restartPressed = true;
        } else if (event.key === 'f' || event.key === 'F') {
          this.fullscreenPressed = true;
        }
      });
    }

    consumePause() {
      if (this.pausePressed) {
        this.pausePressed = false;
        return true;
      }
      return false;
    }

    consumeRestart() {
      if (this.restartPressed) {
        this.restartPressed = false;
        return true;
      }
      return false;
    }

    consumeFullscreen() {
      if (this.fullscreenPressed) {
        this.fullscreenPressed = false;
        return true;
      }
      return false;
    }

    isFiring() {
      return this.mouse.isDown;
    }

    getTargetPosition() {
      this._targetBuffer.x = this.mouse.x;
      this._targetBuffer.y = this.mouse.y;
      return this._targetBuffer;
    }
  }

  class AudioManager {
    constructor() {
      this.context = null;
      this.muted = false;
    }

    _ensureContext() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.context = new AudioContext();
        }
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    resume() {
      if (this.context && this.context.state === 'suspended') {
        return this.context.resume();
      }
      return Promise.resolve();
    }

    playShoot() {
      if (this.muted) return;
      this._ensureContext();
      if (!this.context) return;
      const ctxAudio = this.context;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = 'square';
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.18, ctxAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + 0.15);
    }

    playEnemyShoot() {
      if (this.muted) return;
      this._ensureContext();
      if (!this.context) return;
      const ctxAudio = this.context;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, ctxAudio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctxAudio.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctxAudio.currentTime);
      gain.gain.linearRampToValueAtTime(0.0, ctxAudio.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + 0.22);
    }

    playMissile() {
      if (this.muted) return;
      this._ensureContext();
      if (!this.context) return;
      const ctxAudio = this.context;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctxAudio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctxAudio.currentTime + 0.3);
      gain.gain.setValueAtTime(0.14, ctxAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + 0.34);
    }

    playExplosion() {
      if (this.muted) return;
      this._ensureContext();
      if (!this.context) return;
      const ctxAudio = this.context;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctxAudio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctxAudio.currentTime + 0.45);
      gain.gain.setValueAtTime(0.25, ctxAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctxAudio.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + 0.5);
    }

    playPowerUp() {
      if (this.muted) return;
      this._ensureContext();
      if (!this.context) return;
      const ctxAudio = this.context;
      const osc = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctxAudio.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctxAudio.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctxAudio.currentTime);
      gain.gain.linearRampToValueAtTime(0.0, ctxAudio.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctxAudio.destination);
      osc.start();
      osc.stop(ctxAudio.currentTime + 0.27);
    }
  }

  class Starfield {
    constructor() {
      const baseArea = 1600 * 900;
      const currentArea = CONFIG.logicWidth * CONFIG.logicHeight;
      const densityFactor = clamp(currentArea / baseArea, 1, 1.6);
      const generateCount = (base) => Math.max(10, Math.round(base * densityFactor));
      this.layers = [
        { stars: this._generate(generateCount(80)), speed: 20, size: 1 },
        { stars: this._generate(generateCount(60)), speed: 38, size: 2 },
        { stars: this._generate(generateCount(40)), speed: 70, size: 3 },
      ];
    }

    _generate(count) {
      const stars = new Array(count);
      for (let i = 0; i < count; i += 1) {
        stars[i] = {
          x: Math.random() * CONFIG.logicWidth,
          y: Math.random() * CONFIG.logicHeight,
        };
      }
      return stars;
    }

    update(dt) {
      for (const layer of this.layers) {
        for (const star of layer.stars) {
          star.y += layer.speed * dt;
          if (star.y > CONFIG.logicHeight) {
            star.y = 0;
            star.x = Math.random() * CONFIG.logicWidth;
          }
        }
      }
    }

    draw(context) {
      for (let i = 0; i < this.layers.length; i += 1) {
        const layer = this.layers[i];
        const alpha = 0.25 + i * 0.15;
        context.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        for (const star of layer.stars) {
          if (layer.size >= 2) {
            context.save();
            context.globalAlpha = alpha * 0.55;
            context.shadowBlur = 12 + layer.size * 3;
            context.shadowColor = `rgba(140, 180, 255, ${0.5 + i * 0.2})`;
            context.fillStyle = `rgba(200, 220, 255, ${0.7 + i * 0.1})`;
            context.beginPath();
            context.arc(star.x, star.y, layer.size + 0.6, 0, Math.PI * 2);
            context.fill();
            context.restore();
          } else {
            context.beginPath();
            context.arc(star.x, star.y, layer.size, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
    }
  }

  class Player {
    constructor() {
      this.position = { x: CONFIG.logicWidth / 2, y: CONFIG.logicHeight * 0.75 };
      this.target = { x: this.position.x, y: this.position.y };
      this.radius = 20;
      this.speed = 900;
      this.cooldownBase = 0.16;
      this.shotTimer = 0;
      this.invulnerability = 0;
      this.hitFlash = 0;
      this.shotLevel = 1;
      this.shotLevelTimer = 0;
      this.missileActive = false;
      this.missileTimer = 0;
      this.missileCooldownTimer = 0;
    }

    reset() {
      this.position.x = CONFIG.logicWidth / 2;
      this.position.y = CONFIG.logicHeight * 0.75;
      this.target.x = this.position.x;
      this.target.y = this.position.y;
      this.shotTimer = 0;
      this.invulnerability = 0;
      this.hitFlash = 0;
      this.shotLevel = 1;
      this.shotLevelTimer = 0;
      this.missileActive = false;
      this.missileTimer = 0;
      this.missileCooldownTimer = 0;
    }

    update(dt, targetPosition) {
      this.target.x = clamp(targetPosition.x, this.radius, CONFIG.logicWidth - this.radius);
      this.target.y = clamp(targetPosition.y, this.radius, CONFIG.logicHeight - this.radius);
      const smoothing = 1 - Math.exp(-dt * 12);
      this.position.x += (this.target.x - this.position.x) * smoothing;
      this.position.y += (this.target.y - this.position.y) * smoothing;
      this.shotTimer = Math.max(0, this.shotTimer - dt);
      this.invulnerability = Math.max(0, this.invulnerability - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.missileCooldownTimer = Math.max(0, this.missileCooldownTimer - dt);
      if (this.shotLevel > 1) {
        this.shotLevelTimer = Math.max(0, this.shotLevelTimer - dt);
        if (this.shotLevelTimer <= 0) {
          this.shotLevel = 1;
        }
      }
      if (this.missileActive) {
        this.missileTimer = Math.max(0, this.missileTimer - dt);
        if (this.missileTimer <= 0) {
          this.missileActive = false;
        }
      }
    }

    registerHit() {
      this.invulnerability = 1.0;
      this.hitFlash = 0.3;
    }

    isInvulnerable() {
      return this.invulnerability > 0;
    }

    activateShotUpgrade(duration) {
      const maxDuration = duration * 3;
      this.shotLevel += 1;
      this.shotLevelTimer = clamp(this.shotLevelTimer + duration, duration, maxDuration);
    }

    activateMissiles(duration) {
      const maxDuration = duration * 3;
      this.missileActive = true;
      this.missileTimer = clamp(this.missileTimer + duration, duration, maxDuration);
      this.missileCooldownTimer = 0;
    }

    tryShoot(bullets, audio, spawnMissile, onShoot) {
      if (this.shotTimer > 0) return;
      this.shotTimer = this.cooldownBase;
      const baseY = this.position.y - this.radius - 6;
      const speed = 780;
      const baseAngle = -Math.PI / 2;

      const numShots = this.shotLevel;
      if (numShots === 1) {
        bullets.push(new Bullet(this.position.x, baseY, 0, -speed));
      } else {
        const spreadDegPerShot = CONFIG.spreadDeg;
        for (let i = 0; i < numShots; i += 1) {
          const angleOffsetDeg = (i - (numShots - 1) / 2) * spreadDegPerShot;
          const angleOffsetRad = (angleOffsetDeg * Math.PI) / 180;
          const finalAngle = baseAngle + angleOffsetRad;
          const vx = Math.cos(finalAngle) * speed;
          const vy = Math.sin(finalAngle) * speed;
          const xOffset = (i - (numShots - 1) / 2) * 12;
          bullets.push(new Bullet(this.position.x + xOffset, baseY, vx, vy));
        }
      }

      if (audio) audio.playShoot();
      if (onShoot) onShoot();
      if (this.missileActive && spawnMissile && this.missileCooldownTimer <= 0) {
        spawnMissile(this.position.x, this.position.y - this.radius * 0.2);
        this.missileCooldownTimer = CONFIG.missileCooldown;
      }
    }

    draw(context) {
      context.save();
      context.translate(this.position.x, this.position.y);
      const headRadius = this.radius * 0.9;
      const bodyRadius = this.radius * 0.7;
      const baseColor = this.hitFlash > 0 ? '#ffd1a9' : '#f6c6ff';
      const earColor = this.hitFlash > 0 ? '#ffb987' : '#f5a9ff';

      // Cuerpo del gato
      const bodyGradient = context.createLinearGradient(0, -bodyRadius, 0, bodyRadius * 1.6);
      bodyGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      bodyGradient.addColorStop(0.5, baseColor);
      bodyGradient.addColorStop(1, '#8c68ff');
      context.fillStyle = bodyGradient;
      context.beginPath();
      context.ellipse(0, this.radius * 0.55, bodyRadius, bodyRadius * 1.35, 0, 0, Math.PI * 2);
      context.fill();

      // Cola propulsora
      const flicker = 1 + Math.random() * 0.4;
      context.save();
      const tailGradient = context.createLinearGradient(0, this.radius * 0.75, 0, this.radius * (1.9 + flicker * 0.4));
      tailGradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      tailGradient.addColorStop(0.3, 'rgba(255, 200, 160, 0.6)');
      tailGradient.addColorStop(1, 'rgba(255, 90, 160, 0)');
      context.fillStyle = tailGradient;
      context.beginPath();
      context.moveTo(-this.radius * 0.25, this.radius * 0.85);
      context.lineTo(this.radius * 0.25, this.radius * 0.85);
      context.lineTo(0, this.radius * (1.9 + flicker * 0.6));
      context.closePath();
      context.fill();
      context.restore();

      // Cabeza (cara del gato)
      const headGradient = context.createLinearGradient(0, -headRadius, 0, headRadius);
      headGradient.addColorStop(0, '#ffffff');
      headGradient.addColorStop(0.5, baseColor);
      headGradient.addColorStop(1, '#9f8cff');
      context.fillStyle = headGradient;
      context.beginPath();
      context.arc(0, 0, headRadius, 0, Math.PI * 2);
      context.fill();

      // Orejas
      context.fillStyle = earColor;
      context.beginPath();
      context.moveTo(-headRadius * 0.65, -headRadius * 0.2);
      context.lineTo(-headRadius * 0.25, -headRadius * 0.85);
      context.lineTo(-headRadius * 0.05, -headRadius * 0.1);
      context.closePath();
      context.fill();

      context.beginPath();
      context.moveTo(headRadius * 0.65, -headRadius * 0.2);
      context.lineTo(headRadius * 0.25, -headRadius * 0.85);
      context.lineTo(headRadius * 0.05, -headRadius * 0.1);
      context.closePath();
      context.fill();

      // Orejas internas
      context.fillStyle = 'rgba(255, 225, 235, 0.9)';
      context.beginPath();
      context.moveTo(-headRadius * 0.45, -headRadius * 0.28);
      context.lineTo(-headRadius * 0.23, -headRadius * 0.75);
      context.lineTo(-headRadius * 0.05, -headRadius * 0.18);
      context.closePath();
      context.fill();

      context.beginPath();
      context.moveTo(headRadius * 0.45, -headRadius * 0.28);
      context.lineTo(headRadius * 0.23, -headRadius * 0.75);
      context.lineTo(headRadius * 0.05, -headRadius * 0.18);
      context.closePath();
      context.fill();

      // Ojos
      context.fillStyle = '#1f2b46';
      context.beginPath();
      context.ellipse(-headRadius * 0.35, -headRadius * 0.05, headRadius * 0.22, headRadius * 0.26, -0.1, 0, Math.PI * 2);
      context.ellipse(headRadius * 0.35, -headRadius * 0.05, headRadius * 0.22, headRadius * 0.26, 0.1, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(-headRadius * 0.42, -headRadius * 0.15, headRadius * 0.08, 0, Math.PI * 2);
      context.arc(headRadius * 0.28, -headRadius * 0.18, headRadius * 0.08, 0, Math.PI * 2);
      context.fill();

      // Nariz
      context.fillStyle = '#ff85a2';
      context.beginPath();
      context.moveTo(0, headRadius * 0.15);
      context.lineTo(-headRadius * 0.08, headRadius * 0.05);
      context.lineTo(headRadius * 0.08, headRadius * 0.05);
      context.closePath();
      context.fill();

      // Boca
      context.strokeStyle = '#5f3a57';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, headRadius * 0.15);
      context.bezierCurveTo(0, headRadius * 0.24, -headRadius * 0.08, headRadius * 0.26, -headRadius * 0.16, headRadius * 0.22);
      context.moveTo(0, headRadius * 0.15);
      context.bezierCurveTo(0, headRadius * 0.24, headRadius * 0.08, headRadius * 0.26, headRadius * 0.16, headRadius * 0.22);
      context.stroke();

      // Bigotes
      context.lineWidth = 1.6;
      context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      context.beginPath();
      context.moveTo(-headRadius * 0.25, headRadius * 0.12);
      context.lineTo(-headRadius * 0.58, headRadius * 0.05);
      context.moveTo(-headRadius * 0.25, headRadius * 0.18);
      context.lineTo(-headRadius * 0.6, headRadius * 0.2);
      context.moveTo(-headRadius * 0.25, headRadius * 0.24);
      context.lineTo(-headRadius * 0.55, headRadius * 0.35);
      context.moveTo(headRadius * 0.25, headRadius * 0.12);
      context.lineTo(headRadius * 0.58, headRadius * 0.05);
      context.moveTo(headRadius * 0.25, headRadius * 0.18);
      context.lineTo(headRadius * 0.6, headRadius * 0.2);
      context.moveTo(headRadius * 0.25, headRadius * 0.24);
      context.lineTo(headRadius * 0.55, headRadius * 0.35);
      context.stroke();

      if (this.isInvulnerable()) {
        context.globalAlpha = 0.6 + Math.sin(performance.now() * 0.02) * 0.2;
        context.strokeStyle = '#f6ff8f';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
        context.stroke();
      }

      context.restore();
    }
  }

  class Bullet {
    constructor(x, y, velocityX, velocityY) {
      this.position = { x, y };
      this.velocity = { x: velocityX, y: velocityY };
      this.radius = 6;
      this.active = true;
    }

    update(dt) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      if (
        this.position.y < -40 ||
        this.position.y > CONFIG.logicHeight + 40 ||
        this.position.x < -40 ||
        this.position.x > CONFIG.logicWidth + 40
      ) {
        this.active = false;
      }
    }

    draw(context) {
      context.save();
      const radius = this.radius;
      const gradient = context.createRadialGradient(
        this.position.x,
        this.position.y,
        radius * 0.2,
        this.position.x,
        this.position.y,
        radius * 1.8,
      );
      gradient.addColorStop(0, '#fff6d1');
      gradient.addColorStop(0.35, '#ffdd6f');
      gradient.addColorStop(1, 'rgba(255, 220, 112, 0)');
      context.fillStyle = gradient;
      context.shadowColor = 'rgba(255, 220, 112, 0.8)';
      context.shadowBlur = 15;
      context.beginPath();
      context.arc(this.position.x, this.position.y, radius * 1.1, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  class HomingMissile {
    constructor(x, y, speed, turnRate) {
      this.position = { x, y };
      this.velocity = { x: 0, y: -speed };
      this.speed = speed;
      this.turnRate = turnRate;
      this.radius = 10;
      this.damage = 3;
      this.active = true;
      this.target = null;
      this.rotation = -Math.PI / 2;
      this.trailTimer = 0;
    }

    acquireTarget(enemies) {
      let nearest = null;
      let nearestDistSq = Infinity;
      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        if (!enemy.active) continue;
        const dx = enemy.position.x - this.position.x;
        const dy = enemy.position.y - this.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearest = enemy;
          nearestDistSq = distSq;
        }
      }
      this.target = nearest;
    }

    update(dt, enemies) {
      if (!this.active) return;
      this.trailTimer += dt;
      if (!this.target || !this.target.active) {
        this.acquireTarget(enemies);
      }

      if (this.target && this.target.active) {
        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;
        const dist = Math.hypot(dx, dy) || 1;
        const desiredAngle = Math.atan2(dy, dx);
        const currentAngle = Math.atan2(this.velocity.y, this.velocity.x);
        let angleDiff = ((desiredAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const maxTurn = this.turnRate * dt;
        angleDiff = clamp(angleDiff, -maxTurn, maxTurn);
        const newAngle = currentAngle + angleDiff;
        this.velocity.x = Math.cos(newAngle) * this.speed;
        this.velocity.y = Math.sin(newAngle) * this.speed;
        this.rotation = newAngle;
      } else {
        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
      }

      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      if (
        this.position.y < -100 ||
        this.position.y > CONFIG.logicHeight + 150 ||
        this.position.x < -150 ||
        this.position.x > CONFIG.logicWidth + 150
      ) {
        this.active = false;
      }
    }

    draw(context) {
      if (!this.active) return;
      context.save();
      context.translate(this.position.x, this.position.y);
      context.rotate(this.rotation);

      // Flame trail
      context.save();
      const trailGradient = context.createLinearGradient(-4, 0, -24, 0);
      trailGradient.addColorStop(0, 'rgba(255, 180, 120, 0.9)');
      trailGradient.addColorStop(1, 'rgba(255, 80, 150, 0)');
      context.fillStyle = trailGradient;
      context.beginPath();
      context.moveTo(-6, -4);
      context.lineTo(-22, 0);
      context.lineTo(-6, 4);
      context.closePath();
      context.fill();
      context.restore();

      const bodyGradient = context.createLinearGradient(-4, -8, 18, 8);
      bodyGradient.addColorStop(0, '#ffe1f3');
      bodyGradient.addColorStop(0.5, '#ff7ec9');
      bodyGradient.addColorStop(1, '#ffa6ff');
      context.fillStyle = bodyGradient;
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-4, 8);
      context.lineTo(-4, -8);
      context.closePath();
      context.fill();
      context.stroke();

      context.restore();
    }
  }

  class EnemyBullet {
    constructor(x, y, velocityX, velocityY, radius = 10) {
      this.position = { x, y };
      this.velocity = { x: velocityX, y: velocityY };
      this.radius = radius;
      this.active = true;
    }

    update(dt) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      if (
        this.position.y < -40 ||
        this.position.y > CONFIG.logicHeight + 80 ||
        this.position.x < -80 ||
        this.position.x > CONFIG.logicWidth + 80
      ) {
        this.active = false;
      }
    }

    draw(context) {
      context.save();
      const gradient = context.createRadialGradient(
        this.position.x,
        this.position.y,
        this.radius * 0.25,
        this.position.x,
        this.position.y,
        this.radius * 1.6,
      );
      gradient.addColorStop(0, '#ffd6d6');
      gradient.addColorStop(0.4, '#ff7373');
      gradient.addColorStop(1, 'rgba(255, 77, 77, 0)');
      context.fillStyle = gradient;
      context.shadowColor = 'rgba(255, 96, 132, 0.85)';
      context.shadowBlur = 18;
      context.beginPath();
      context.arc(this.position.x, this.position.y, this.radius * 1.05, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  class Enemy {
    constructor(type, x, y, config) {
      this.type = type;
      this.position = { x, y };
      this.velocity = {
        x: config.velocityX || 0,
        y: config.velocityY || 0,
      };
      this.baseSpeed = config.baseSpeed || 0;
      this.radius = config.radius || 24;
      this.health = config.health || 1;
      this.scoreValue = config.scoreValue || 100;
      this.rotation = config.rotation || 0;
      this.rotationSpeed = config.rotationSpeed || 0;
      this.waveAmplitude = config.waveAmplitude || 0;
      this.waveFrequency = config.waveFrequency || 0;
      this.wavePhase = config.wavePhase || 0;
      this.fireCooldown = config.fireCooldown || Infinity;
      this.fireTimer = config.fireInitial || this.fireCooldown;
      this.enemyShotSpeed = config.enemyShotSpeed || 0;
      this.kamiSteerSpeed = config.kamiSteerSpeed || 0;
      this.hoverY = config.hoverY || null;
      this.vertices = config.vertices || null;
      this.active = true;
      this.timer = 0;
    }

    static createDrone(x, y) {
      return new Enemy('drone', x, y, {
        radius: 22,
        baseSpeed: randomRange(120, 160),
        waveAmplitude: randomRange(60, 110),
        waveFrequency: randomRange(3.5, 5.5),
        rotationSpeed: randomRange(-1.1, 1.1),
        health: 2,
        scoreValue: 160,
        fireCooldown: 2.2,
        fireInitial: randomRange(0.8, 1.6),
        enemyShotSpeed: 360,
      });
    }

    static createKamikaze(x, y) {
      return new Enemy('kamikaze', x, y, {
        radius: 20,
        baseSpeed: randomRange(180, 220),
        rotationSpeed: randomRange(-2.5, 2.5),
        health: 1,
        scoreValue: 190,
        kamiSteerSpeed: 280,
      });
    }

    static createBoss(x, y, baseFactor) {
      return new Enemy('boss', x, y, {
        radius: 70,
        baseSpeed: 45,
        health: Math.round(50 * baseFactor),
        scoreValue: 1200,
        fireCooldown: 1.35,
        fireInitial: 1.0,
        enemyShotSpeed: 420,
        hoverY: 220,
      });
    }

    takeDamage(amount = 1) {
      this.health -= amount;
      if (this.health <= 0) {
        this.active = false;
        return true;
      }
      return false;
    }

    update(dt, factorD, playerPosition, enemyBullets, audio) {
      this.timer += dt;
      if (this.type === 'drone') {
        this.wavePhase += dt * this.waveFrequency;
        this.position.x += Math.sin(this.wavePhase) * this.waveAmplitude * dt;
        this.position.y += this.baseSpeed * factorD * dt;
        this.rotation += this.rotationSpeed * dt;
        this.fireTimer -= dt * factorD;
        if (this.fireTimer <= 0) {
          this.fireTimer = this.fireCooldown / factorD + randomRange(0.05, 0.25);
          const dx = playerPosition.x - this.position.x;
          const dy = playerPosition.y - this.position.y;
          const len = Math.hypot(dx, dy) || 1;
          const speed = this.enemyShotSpeed * factorD;
          enemyBullets.push(new EnemyBullet(this.position.x, this.position.y, (dx / len) * speed, (dy / len) * speed, 12));
          if (audio) audio.playEnemyShoot();
        }
      } else if (this.type === 'kamikaze') {
        const dx = playerPosition.x - this.position.x;
        const dy = playerPosition.y - this.position.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.velocity.x += (dx / dist) * this.kamiSteerSpeed * dt;
        this.velocity.y += (dy / dist) * this.kamiSteerSpeed * dt;
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y) || 1;
        const desiredSpeed = this.baseSpeed * factorD;
        const adjust = desiredSpeed / currentSpeed;
        this.velocity.x *= adjust;
        this.velocity.y *= adjust;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.rotation += this.rotationSpeed * dt;
      } else if (this.type === 'boss') {
        if (this.hoverY !== null) {
          if (this.position.y < this.hoverY) {
            this.position.y += this.baseSpeed * factorD * dt;
          } else {
            this.position.y = this.hoverY;
          }
        } else {
          this.position.y += this.baseSpeed * factorD * dt;
        }
        this.position.x += Math.sin(this.timer * 1.3) * 80 * dt;
        this.fireTimer -= dt * factorD;
        if (this.fireTimer <= 0) {
          this.fireTimer = this.fireCooldown / factorD;
          const angleToPlayer = Math.atan2(playerPosition.y - this.position.y, playerPosition.x - this.position.x);
          const spread = [-0.25, 0, 0.25];
          const bulletSpeed = this.enemyShotSpeed * factorD;
          for (let i = 0; i < spread.length; i += 1) {
            const angle = angleToPlayer + spread[i];
            enemyBullets.push(
              new EnemyBullet(
                this.position.x,
                this.position.y,
                Math.cos(angle) * bulletSpeed,
                Math.sin(angle) * bulletSpeed,
                16,
              ),
            );
          }
          if (audio) audio.playEnemyShoot();
        }
      }

      if (
        this.position.y > CONFIG.logicHeight + 160 ||
        this.position.x < -160 ||
        this.position.x > CONFIG.logicWidth + 160
      ) {
        this.active = false;
      }
    }

    draw(context) {
      context.save();
      context.translate(this.position.x, this.position.y);
      context.rotate(this.rotation);

      if (this.type === 'drone') {
        context.shadowBlur = 22;
        context.shadowColor = 'rgba(255, 111, 182, 0.55)';
        const bodyGradient = context.createLinearGradient(0, -this.radius, 0, this.radius);
        bodyGradient.addColorStop(0, '#ff6fb0');
        bodyGradient.addColorStop(0.5, '#ff2f8a');
        bodyGradient.addColorStop(1, '#ff174f');
        context.fillStyle = bodyGradient;
        context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius, 0);
        context.lineTo(0, this.radius);
        context.lineTo(-this.radius, 0);
        context.closePath();
        context.fill();
        context.stroke();
        const coreGradient = context.createRadialGradient(0, 0, 0, 0, 0, this.radius * 0.6);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.beginPath();
        context.fillStyle = coreGradient;
        context.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        context.fill();
      } else if (this.type === 'kamikaze') {
        const bodyGradient = context.createLinearGradient(0, -this.radius, 0, this.radius);
        bodyGradient.addColorStop(0, '#fff0cc');
        bodyGradient.addColorStop(0.5, '#ffb347');
        bodyGradient.addColorStop(1, '#ff6f61');
        context.fillStyle = bodyGradient;
        context.shadowBlur = 15;
        context.shadowColor = 'rgba(255, 166, 82, 0.4)';
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius * 0.6, this.radius);
        context.lineTo(-this.radius * 0.6, this.radius);
        context.closePath();
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        context.lineWidth = 2;
        context.stroke();
      } else {
        context.shadowBlur = 28;
        context.shadowColor = 'rgba(130, 151, 255, 0.45)';
        const hullGradient = context.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        hullGradient.addColorStop(0, '#c1c8ff');
        hullGradient.addColorStop(0.4, '#7e89ff');
        hullGradient.addColorStop(1, '#4655ff');
        context.fillStyle = hullGradient;
        context.strokeStyle = 'rgba(82, 98, 255, 0.75)';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius, -this.radius * 0.3);
        context.lineTo(this.radius * 0.7, this.radius);
        context.lineTo(-this.radius * 0.7, this.radius);
        context.lineTo(-this.radius, -this.radius * 0.3);
        context.closePath();
        context.fill();
        context.stroke();
        const coreGradient = context.createRadialGradient(0, 0, 0, 0, 0, this.radius * 0.5);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = coreGradient;
        context.beginPath();
        context.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    }
  }

  const ASTEROID_DATA = {
    L: { radius: 64, health: 3, score: 10 },
    M: { radius: 40, health: 2, score: 20 },
    S: { radius: 24, health: 1, score: 30 },
  };

  class Asteroid {
    constructor(size, x, y, velocityX, velocityY) {
      this.type = 'asteroid';
      this.size = size;
      const data = ASTEROID_DATA[size];
      this.radius = data.radius;
      this.health = data.health;
      this.scoreValue = data.score;
      this.position = { x, y };
      this.baseVelocity = { x: velocityX, y: velocityY };
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = randomRange(-0.6, 0.6);
      this.vertices = this._createVertices();
      this.active = true;
      this.collisionDelay = 0.15;
    }

    static create(size, x, y, vx, vy) {
      return new Asteroid(size, x, y, vx, vy);
    }

    static spawnLarge(x, y) {
      const vx = randomRange(-65, 65);
      const vy = randomRange(95, 135);
      return new Asteroid('L', x, y, vx, vy);
    }

    _createVertices() {
      const verts = [];
      const sides = 10;
      for (let i = 0; i < sides; i += 1) {
        const angle = (Math.PI * 2 * i) / sides;
        const jitter = randomRange(0.72, 1.08);
        verts.push({
          x: Math.cos(angle) * this.radius * jitter,
          y: Math.sin(angle) * this.radius * jitter,
        });
      }
      return verts;
    }

    takeDamage(amount = 1) {
      this.health -= amount;
      if (this.health <= 0) {
        this.active = false;
        return true;
      }
      return false;
    }

    update(dt, factorD) {
      this.collisionDelay = Math.max(0, this.collisionDelay - dt);
      this.position.x += this.baseVelocity.x * factorD * dt;
      this.position.y += this.baseVelocity.y * factorD * dt;
      this.rotation += this.rotationSpeed * dt;
      if (
        this.position.y > CONFIG.logicHeight + 200 ||
        this.position.x < -220 ||
        this.position.x > CONFIG.logicWidth + 220
      ) {
        this.active = false;
      }
    }

    split(game) {
      if (this.size === 'S') {
        return;
      }
      const nextSize = this.size === 'L' ? 'M' : 'S';
      const desiredChildren = 2;
      const currentAsteroids = game.countAsteroids();
      const availableSlots = Math.max(0, CONFIG.maxAsteroids - currentAsteroids);
      const spawnCount = Math.min(desiredChildren, availableSlots);
      const baseAngle = Math.atan2(this.baseVelocity.y, this.baseVelocity.x) || Math.PI / 2;
      const baseMagnitude = Math.hypot(this.baseVelocity.x, this.baseVelocity.y) || 1;

      for (let i = 0; i < spawnCount; i += 1) {
        const direction = i === 0 ? -1 : 1;
        const angleOffset = (randomRange(25, 35) * Math.PI) / 180;
        const angle = baseAngle + direction * angleOffset;
        const speedMultiplier = randomRange(1.1, 1.3);
        const magnitude = baseMagnitude * speedMultiplier;
        const vx = Math.cos(angle) * magnitude;
        const vyRaw = Math.sin(angle) * magnitude;
        const vy = Math.max(Math.abs(vyRaw), 70);
        const child = Asteroid.create(nextSize, this.position.x, this.position.y, vx, vy);
        child.collisionDelay = 0.3;
        game.addAsteroid(child);
      }

      const missingChildren = desiredChildren - spawnCount;
      if (missingChildren > 0) {
        const bonusScore = ASTEROID_DATA[nextSize].score * missingChildren;
        game.addScore(bonusScore);
      }
    }

    draw(context) {
      context.save();
      context.translate(this.position.x, this.position.y);
      context.rotate(this.rotation);
      context.strokeStyle = '#ffe4c4';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(this.vertices[0].x, this.vertices[0].y);
      for (let i = 1; i < this.vertices.length; i += 1) {
        context.lineTo(this.vertices[i].x, this.vertices[i].y);
      }
      context.closePath();
      context.stroke();
      context.restore();
    }
  }

  class PowerUp {
    constructor(type, x, y, config) {
      this.type = type;
      this.position = { x, y };
      this.velocity = { x: 0, y: config.speed || 160 };
      this.radius = config.radius || 20;
      this.active = true;
      this.timer = 0;
      this.spin = Math.random() * Math.PI * 2;
      this.spinSpeed = randomRange(-2, 2);
      this.floatAmplitude = config.floatAmplitude || 18;
      this.collisionDelay = 0.2;
    }

    static createLife(x, y) {
      return new PowerUp('life', x, y, { radius: 18, speed: 140, floatAmplitude: 14 });
    }

    static createShotUpgrade(x, y) {
      return new PowerUp('shotUpgrade', x, y, { radius: 24, speed: 120, floatAmplitude: 20 });
    }

    static createMissile(x, y) {
      return new PowerUp('missile', x, y, { radius: 22, speed: 130, floatAmplitude: 18 });
    }

    update(dt) {
      this.timer += dt;
      this.collisionDelay = Math.max(0, this.collisionDelay - dt);
      this.position.y += this.velocity.y * dt;
      this.position.x += Math.sin(this.timer * 3) * this.floatAmplitude * dt;
      this.spin += this.spinSpeed * dt;
      if (this.position.y > CONFIG.logicHeight + 80) {
        this.active = false;
      }
    }

    checkPickup(player) {
      if (this.collisionDelay > 0) return false;
      const dx = player.position.x - this.position.x;
      const dy = player.position.y - this.position.y;
      const combined = player.radius + this.radius;
      return dx * dx + dy * dy <= combined * combined;
    }

    draw(context) {
      context.save();
      context.translate(this.position.x, this.position.y);
      if (this.type === 'shotUpgrade') {
        const radius = this.radius;
        context.rotate(this.spin * 0.2);
        const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
        gradient.addColorStop(0, '#ffe2a4');
        gradient.addColorStop(0.4, '#ffc15a');
        gradient.addColorStop(1, '#ff7a50');
        context.fillStyle = gradient;
        context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        context.lineWidth = 2.4;
        context.shadowBlur = 22;
        context.shadowColor = 'rgba(255, 166, 70, 0.55)';
        context.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = '#1d1f2f';
        context.font = 'bold 30px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('x+', 0, 4);
      } else if (this.type === 'life') {
        const gradient = context.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius);
        gradient.addColorStop(0, '#e6ffe4');
        gradient.addColorStop(0.5, '#8cff82');
        gradient.addColorStop(1, '#2dd17d');
        context.fillStyle = gradient;
        context.shadowBlur = 18;
        context.shadowColor = 'rgba(130, 255, 160, 0.5)';
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        context.lineWidth = 2.4;
        context.beginPath();
        context.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
        context.stroke();
      } else {
        const gradient = context.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        gradient.addColorStop(0, '#d9fbff');
        gradient.addColorStop(0.4, '#6fe4ff');
        gradient.addColorStop(1, '#3ea3ff');
        context.fillStyle = gradient;
        context.shadowBlur = 20;
        context.shadowColor = 'rgba(111, 234, 255, 0.55)';
        context.beginPath();
        context.moveTo(0, -this.radius);
        context.lineTo(this.radius * 0.85, 0);
        context.lineTo(0, this.radius);
        context.lineTo(-this.radius * 0.85, 0);
        context.closePath();
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = '#0f2445';
        context.font = 'bold 24px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('MS', 0, 2);
      }
      context.restore();
    }
  }

  class PowerUpManager {
    constructor(game) {
      this.game = game;
      this.items = [];
    }

    reset() {
      this.items.length = 0;
    }

    requestDrop(x, y) {
      const game = this.game;
      if (game.elapsedTime < 10) return;
      const baseChance = CONFIG.powerDropChance;
      const boostedChance = game.factorEffective > 2 ? baseChance * 1.5 : baseChance;
      const dropChance = clamp(boostedChance, 0, 0.3);
      if (!chance(dropChance)) return;
      const options = [];
      options.push({ value: 'shotUpgrade', weight: 0.65 });
      options.push({ value: 'missile', weight: game.player.missileActive ? 0.4 : 0.7 });
      if (game.lives < 5) {
        options.push({ value: 'life', weight: game.lives < 3 ? 0.7 : 0.3 });
      }
      const type = weightedPick(options);
      this.spawn(type, x, y);
    }

    spawn(type, x, y) {
      let item;
      if (type === 'shotUpgrade') {
        item = PowerUp.createShotUpgrade(x, y);
      } else if (type === 'missile') {
        item = PowerUp.createMissile(x, y);
      } else {
        item = PowerUp.createLife(x, y);
      }
      this.items.push(item);
    }

    update(dt) {
      const player = this.game.player;
      let write = 0;
      for (let i = 0; i < this.items.length; i += 1) {
        const item = this.items[i];
        item.update(dt);
        if (!item.active) continue;
        if (item.checkPickup(player)) {
          this.apply(item);
          continue;
        }
        this.items[write] = item;
        write += 1;
      }
      this.items.length = write;
    }

    apply(item) {
      if (item.type === 'shotUpgrade') {
        this.game.activateShotUpgrade(CONFIG.doubleShotDuration);
        this.game.addScore(120);
      } else if (item.type === 'missile') {
        this.game.activateMissiles();
        this.game.addScore(140);
      } else if (item.type === 'life') {
        this.game.addLife(1);
        this.game.addScore(150);
      }
      this.game.audio.playPowerUp();
      item.active = false;
    }

    draw(context) {
      for (const item of this.items) {
        item.draw(context);
      }
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.position = { x, y };
      this.velocity = {
        x: randomRange(-120, 120),
        y: randomRange(-180, 60),
      };
      this.life = 0.5;
      this.color = color;
      this.active = true;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) {
        this.active = false;
        return;
      }
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.velocity.y += 240 * dt;
    }

    draw(context) {
      const alpha = clamp(this.life / 0.5, 0, 1);
      context.save();
      const radius = 4 + (1 - alpha) * 2;
      const gradient = context.createRadialGradient(
        this.position.x,
        this.position.y,
        0,
        this.position.x,
        this.position.y,
        radius,
      );
      gradient.addColorStop(0, `rgba(255, 232, 180, ${alpha.toFixed(2)})`);
      gradient.addColorStop(0.6, `rgba(255, 180, 120, ${(alpha * 0.8).toFixed(2)})`);
      gradient.addColorStop(1, 'rgba(255, 120, 80, 0)');
      context.fillStyle = gradient;
      context.shadowColor = 'rgba(255, 165, 120, 0.45)';
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  class WaveManager {
    constructor() {
      this.elapsed = 0;
      this.spawnTimer = 0;
      this.bossTimer = 60;
    }

    reset() {
      this.elapsed = 0;
      this.spawnTimer = 0;
      this.bossTimer = 60;
    }

    update(dt, factorD, game) {
      this.elapsed += dt;
      this.spawnTimer -= dt;
      if (game.level >= 4) {
        this.bossTimer -= dt;
      }

      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.2, (CONFIG.baseSpawn / factorD) * randomRange(0.7, 1.3));
        const enemy = this._createEnemy(game.level);
        if (enemy) {
          if (enemy.type === 'asteroid') {
            if (game.countAsteroids() >= CONFIG.maxAsteroids) {
              const sizeKey = enemy.size || 'L';
              game.addScore(ASTEROID_DATA[sizeKey].score);
            } else {
              game.addAsteroid(enemy);
            }
          } else {
            game.enemies.push(enemy);
          }
        }
      }

      if (this.bossTimer <= 0) {
        this.bossTimer = 60;
        if (!game.hasActiveBoss()) {
          game.enemies.push(this._createBoss(game.factorBase));
        }
      }
    }

    _createEnemy(level) {
      const x = randomRange(80, CONFIG.logicWidth - 80);
      const typeOptions = [{ value: 'asteroid', weight: 1.2 }];

      if (level >= 2) {
        typeOptions.push({ value: 'drone', weight: 0.5 + level * 0.1 });
      }
      if (level >= 3) {
        typeOptions.push({ value: 'kamikaze', weight: 0.4 + level * 0.1 });
      }

      const type = weightedPick(typeOptions);

      if (type === 'drone') {
        return Enemy.createDrone(x, -60);
      }
      if (type === 'kamikaze') {
        return Enemy.createKamikaze(x, -90);
      }
      return Asteroid.spawnLarge(x, -80);
    }

    _createBoss(baseFactor) {
      const x = randomRange(240, CONFIG.logicWidth - 240);
      return Enemy.createBoss(x, -160, baseFactor);
    }
  }

  class UIOverlay {
    constructor(
      scoreEl,
      bestEl,
      livesEl,
      levelEl,
      messageEl,
      shotLevelEl,
      shotLevelIconEl,
      shotLevelTimerEl,
      missileEl,
      missileTimerEl,
      muteBtn,
      fullscreenBtn,
    ) {
      this.scoreEl = scoreEl;
      this.bestEl = bestEl;
      this.livesEl = livesEl;
      this.levelEl = levelEl;
      this.messageEl = messageEl;
      this.shotLevelIndicator = shotLevelEl;
      this.shotLevelIconEl = shotLevelIconEl;
      this.shotLevelTimerEl = shotLevelTimerEl;
      this.missileIndicator = missileEl;
      this.missileTimerEl = missileTimerEl;
      this.muteButton = muteBtn;
      this.fullscreenButton = fullscreenBtn;
    }

    update(score, best, lives, level, state, accuracy, adaptiveActive, resizing, shotLevel, shotLevelTimer, missileRemaining) {
      this.scoreEl.textContent = score.toString().padStart(6, '0');
      this.bestEl.textContent = best.toString().padStart(6, '0');
      this.livesEl.textContent = `${lives}`;
      this.levelEl.textContent = `${level}`;

      const hasShotUpgrade = shotLevel > 1;
      if (this.shotLevelIndicator) {
        this.shotLevelIndicator.classList.toggle('hud-power--hidden', !hasShotUpgrade);
        if (hasShotUpgrade) {
          this.shotLevelIconEl.textContent = `x${shotLevel}`;
          this.shotLevelTimerEl.textContent = `${Math.ceil(shotLevelTimer)}`;
        }
      }

      const hasMissiles = missileRemaining > 0;
      if (this.missileIndicator) {
        this.missileIndicator.classList.toggle('hud-power--hidden', !hasMissiles);
        if (hasMissiles && this.missileTimerEl) {
          this.missileTimerEl.textContent = `${Math.ceil(missileRemaining)}`;
        }
      }

      let message;
      if (resizing) {
        message = 'Ajustando tamaño de pantalla...';
      } else if (state === STATE.PAUSED) {
        message = 'P para reanudar • R reinicia • F pantalla completa';
      } else if (state === STATE.GAME_OVER) {
        message = 'Game Over - R para reiniciar • F pantalla completa';
      } else {
        const accuracyPercent = Math.round(accuracy * 100);
        message = `P pausa • R reinicia • F pantalla completa • Click dispara • Precisión ${accuracyPercent}%`;
        if (adaptiveActive) {
          message += ' • Adaptación activa';
        }
        if (hasShotUpgrade) {
          message += ` • Disparo x${shotLevel} ${Math.ceil(shotLevelTimer)}s`;
        }
        if (hasMissiles) {
          message += ` • Misiles ${Math.ceil(missileRemaining)}s`;
        }
      }

      this.messageEl.textContent = message;
      this.messageEl.classList.toggle('highlight', state !== STATE.RUNNING || adaptiveActive || resizing);
    }

    setMuteLabel(muted) {
      this.muteButton.textContent = muted ? 'Sonido: Silencio' : 'Sonido: Activo';
    }

    setFullscreenLabel(isFullscreen) {
      this.fullscreenButton.textContent = isFullscreen ? 'Pantalla: Completa' : 'Pantalla: Normal';
    }
  }

  function updateList(list, updater) {
    let write = 0;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      updater(item);
      if (item.active) {
        list[write] = item;
        write += 1;
      }
    }
    list.length = write;
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

  class Game {
    constructor() {
      this.state = STATE.RUNNING;
      this.score = 0;
      this.best = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
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
      this.ui = new UIOverlay(
        hudScore,
        hudBest,
        hudLives,
        hudLevel,
        hudMessages,
        hudShotLevelIndicator,
        hudShotLevelIcon,
        hudShotLevelTimer,
        hudMissileIndicator,
        hudMissileTimer,
        muteButton,
        fullscreenButton,
      );
      this.input = new InputManager(canvas);
      this.audio = new AudioManager();
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
      resizeCanvas(this);
      this.ui.setFullscreenLabel(Boolean(document.fullscreenElement));
      this.ui.setMuteLabel(this.audio.muted);
      this._setupEventHooks();
      requestAnimationFrame(this._loop);
    }

    _setupEventHooks() {
      window.addEventListener('resize', () => {
        this.handleResizeStart();
        if (this._resizeTimeout) {
          clearTimeout(this._resizeTimeout);
        }
        this._resizeTimeout = window.setTimeout(() => {
          resizeCanvas(this);
          this.handleResizeEnd();
        }, 140);
      });

      document.addEventListener('fullscreenchange', () => {
        this.ui.setFullscreenLabel(Boolean(document.fullscreenElement));
        resizeCanvas(this);
        this.handleResizeEnd();
      });

      document.addEventListener('webkitfullscreenchange', () => {
        const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        this.ui.setFullscreenLabel(isFullscreen);
        resizeCanvas(this);
        this.handleResizeEnd();
      });
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
      } else if (gameContainer.requestFullscreen) {
        this.handleResizeStart();
        gameContainer.requestFullscreen();
      } else if (gameContainer.webkitRequestFullscreen) {
        this.handleResizeStart();
        gameContainer.webkitRequestFullscreen();
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
        localStorage.setItem(HIGH_SCORE_KEY, String(this.best));
      }
    }

    addScore(points) {
      this.score += points;
      const oldLevel = this.level;
      if (this.level < 10) {
        const nextLevelScore = this.level * 10000;
        if (this.score >= nextLevelScore) {
          this.level++;
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
      if (this.audio && this.audio.playMissile) {
        this.audio.playMissile();
      }
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
      if (
        !this.adaptive.active &&
        this.adaptive.cooldown <= 0 &&
        (this.lives === 1 || accuracy < 0.2)
      ) {
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
      this.starfield.update(dt * 0.9);

      if (this.state !== STATE.RUNNING) {
        return;
      }

      this.elapsedTime += dt;
      this._updateDifficulty(dt);

      const target = this.input.getTargetPosition();
      this.player.update(dt, target);

      if (this.input.isFiring()) {
        if (!this.audio.context || this.audio.context.state === 'suspended') {
          this.audio._ensureContext();
          this.audio.resume();
        }
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

      updateList(this.bullets, (bullet) => bullet.update(dt));
      updateList(this.enemyBullets, (shot) => shot.update(dt));
      updateList(this.missiles, (missile) => missile.update(dt, this.enemies));
      updateList(this.enemies, (enemy) =>
        enemy.update(dt, this.factorEffective, this.player.position, this.enemyBullets, this.audio),
      );
      this.powerUpManager.update(dt);
      updateList(this.particles, (particle) => particle.update(dt));

      this._handleCollisions();
      handleMissileCollisions(this);

      if (this.lives <= 0) {
        this.endGame();
      }
    }

    draw() {
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

      for (const bullet of this.bullets) {
        bullet.draw(ctx);
      }

      for (const missile of this.missiles) {
        missile.draw(ctx);
      }

      for (const enemyBullet of this.enemyBullets) {
        enemyBullet.draw(ctx);
      }

      for (const enemy of this.enemies) {
        enemy.draw(ctx);
      }

      this.player.draw(ctx);

      for (const particle of this.particles) {
        particle.draw(ctx);
      }

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
      );
      this.draw();
      requestAnimationFrame(this._loop);
    }
  }

  const game = new Game();

  muteButton.addEventListener('click', () => {
    game.toggleMute();
  });

  fullscreenButton.addEventListener('click', () => {
    game.toggleFullscreen();
  });

  window.spaceMouseGame = game;
})();
