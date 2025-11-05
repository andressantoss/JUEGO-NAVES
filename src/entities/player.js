import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';
import { Bullet } from './projectiles.js';

export class Player {
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

    const bodyGradient = context.createLinearGradient(0, -bodyRadius, 0, bodyRadius * 1.6);
    bodyGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    bodyGradient.addColorStop(0.5, baseColor);
    bodyGradient.addColorStop(1, '#8c68ff');
    context.fillStyle = bodyGradient;
    context.beginPath();
    context.ellipse(0, this.radius * 0.55, bodyRadius, bodyRadius * 1.35, 0, 0, Math.PI * 2);
    context.fill();

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

    const headGradient = context.createLinearGradient(0, -headRadius, 0, headRadius);
    headGradient.addColorStop(0, '#ffffff');
    headGradient.addColorStop(0.5, baseColor);
    headGradient.addColorStop(1, '#9f8cff');
    context.fillStyle = headGradient;
    context.beginPath();
    context.arc(0, 0, headRadius, 0, Math.PI * 2);
    context.fill();

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

    context.fillStyle = '#ff85a2';
    context.beginPath();
    context.moveTo(0, headRadius * 0.15);
    context.lineTo(-headRadius * 0.08, headRadius * 0.05);
    context.lineTo(headRadius * 0.08, headRadius * 0.05);
    context.closePath();
    context.fill();

    context.strokeStyle = '#5f3a57';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, headRadius * 0.15);
    context.bezierCurveTo(0, headRadius * 0.24, -headRadius * 0.08, headRadius * 0.26, -headRadius * 0.16, headRadius * 0.22);
    context.moveTo(0, headRadius * 0.15);
    context.bezierCurveTo(0, headRadius * 0.24, headRadius * 0.08, headRadius * 0.26, headRadius * 0.16, headRadius * 0.22);
    context.stroke();

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
