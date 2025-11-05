import { CONFIG } from '../config.js';

export class Starfield {
  constructor() {
    const baseArea = 1600 * 900;
    const currentArea = CONFIG.logicWidth * CONFIG.logicHeight;
    const densityFactor = Math.max(1, Math.min(1.6, currentArea / baseArea));
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
