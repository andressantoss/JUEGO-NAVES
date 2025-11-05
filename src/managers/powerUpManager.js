import { CONFIG } from '../config.js';
import { chance, clamp, weightedPick } from '../utils/math.js';
import { PowerUp } from '../entities/powerUp.js';

export class PowerUpManager {
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
      this.game.activateShotUpgrade();
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
