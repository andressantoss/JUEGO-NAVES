import { CONFIG } from '../config.js';
import { randomRange } from '../utils/math.js';

export const ASTEROID_DATA = {
  L: { radius: 64, health: 3, score: 10 },
  M: { radius: 40, health: 2, score: 20 },
  S: { radius: 24, health: 1, score: 30 },
};

export class Asteroid {
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
