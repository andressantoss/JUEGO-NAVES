import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

export class Bullet {
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

export class HomingMissile {
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

export class EnemyBullet {
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
