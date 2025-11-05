import { clamp, randomRange } from '../utils/math.js';

export class Particle {
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
