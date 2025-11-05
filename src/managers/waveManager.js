import { CONFIG } from '../config.js';
import { randomRange, weightedPick } from '../utils/math.js';
import { Enemy } from '../entities/enemy.js';
import { Asteroid, ASTEROID_DATA } from '../entities/asteroid.js';

export class WaveManager {
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
