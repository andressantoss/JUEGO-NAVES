import { CONFIG } from '../config.js';
import { randomRange } from '../utils/math.js';

export class PowerUp {
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
