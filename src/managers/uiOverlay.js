import { STATE } from '../config.js';

export class UIOverlay {
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
    qualitySelect,
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
    this.qualitySelect = qualitySelect;
  }

  update(
    score,
    best,
    lives,
    level,
    state,
    accuracy,
    adaptiveActive,
    resizing,
    shotLevel,
    shotLevelTimer,
    missileRemaining,
    qualityLabel,
  ) {
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
      message = `P para reanudar • R reinicia • F pantalla completa • Calidad ${qualityLabel}`;
    } else if (state === STATE.GAME_OVER) {
      message = `Game Over - R reinicia • F pantalla completa • Calidad ${qualityLabel}`;
    } else {
      const accuracyPercent = Math.round(accuracy * 100);
      message = 'Click/tocar dispara • Arrastra o usa WASD/Arrows • P pausa • R reinicia • F pantalla completa';
      message += ` • Precisión ${accuracyPercent}%`;
      message += ` • Calidad ${qualityLabel}`;
      message += ' • Espacio o botón fuego dispara';
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

  setQualityLabel(id) {
    if (!this.qualitySelect) return;
    this.qualitySelect.value = id;
  }
}
