import { CONFIG } from '../config.js';
import { randomRange } from '../utils/math.js';
import { EnemyBullet } from './projectiles.js';

export class Enemy {
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
