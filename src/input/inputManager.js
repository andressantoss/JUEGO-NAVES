import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

class TouchControls {
  constructor(container, onFireChange) {
    this.container = container;
    this.onFireChange = onFireChange;
    this.fireButton = null;
    this.activePointers = new Set();
  }

  mount() {
    if (!this.container) return;
    const fireBtn = document.createElement('button');
    fireBtn.type = 'button';
    fireBtn.className = 'touch-fire-button';
    fireBtn.textContent = '🔥';
    fireBtn.setAttribute('aria-label', 'Disparar');
    const handlePointerDown = (event) => {
      event.preventDefault();
      this.activePointers.add(event.pointerId);
      this.onFireChange(true);
      fireBtn.setPointerCapture(event.pointerId);
    };
    const handlePointerUp = (event) => {
      this.activePointers.delete(event.pointerId);
      if (this.activePointers.size === 0) {
        this.onFireChange(false);
      }
      fireBtn.releasePointerCapture(event.pointerId);
    };
    fireBtn.addEventListener('pointerdown', handlePointerDown);
    fireBtn.addEventListener('pointerup', handlePointerUp);
    fireBtn.addEventListener('pointercancel', handlePointerUp);
    fireBtn.addEventListener('pointerleave', handlePointerUp);
    this.container.appendChild(fireBtn);
    this.fireButton = fireBtn;
  }
}

export class InputManager {
  constructor(targetCanvas, container) {
    this.canvas = targetCanvas;
    this.container = container;
    this.bounds = this.canvas.getBoundingClientRect();
    this.mouse = {
      x: CONFIG.logicWidth / 2,
      y: CONFIG.logicHeight * 0.75,
      isDown: false,
    };
    this.target = { x: this.mouse.x, y: this.mouse.y };
    this.keyboardVector = { x: 0, y: 0 };
    this._pressedKeys = new Set();
    this.keyboardSpeed = 900;
    this.pointerPriorityTimer = 0;
    this.pointerPriorityDuration = 1.2;
    this.pausePressed = false;
    this.restartPressed = false;
    this.fullscreenPressed = false;
    this._virtualFire = false;
    this._touchControls = new TouchControls(this._resolveTouchContainer(), (value) => {
      this._virtualFire = value;
    });
    this._touchControls.mount();
    this._setupEvents();
  }

  _resolveTouchContainer() {
    if (!this.container) return null;
    const overlay = this.container.querySelector('.touch-overlay');
    if (overlay) return overlay;
    const element = document.createElement('div');
    element.className = 'touch-overlay';
    this.container.appendChild(element);
    return element;
  }

  updateBounds(rect) {
    this.bounds = rect;
  }

  update(dt) {
    if (this.pointerPriorityTimer > 0) {
      this.pointerPriorityTimer = Math.max(0, this.pointerPriorityTimer - dt);
    }

    if (this._pressedKeys.size > 0) {
      this._recalculateAxis();
    }

    if (this.keyboardVector.x !== 0 || this.keyboardVector.y !== 0) {
      const speed = this.keyboardSpeed * dt;
      this.target.x = clamp(this.target.x + this.keyboardVector.x * speed, 0, CONFIG.logicWidth);
      this.target.y = clamp(this.target.y + this.keyboardVector.y * speed, 0, CONFIG.logicHeight);
    }

    if (this.pointerPriorityTimer === 0) {
      this.target.x = this.mouse.x;
      this.target.y = this.mouse.y;
    }
  }

  _setupEvents() {
    const updatePointer = (event) => {
      const rect = this.bounds || this.canvas.getBoundingClientRect();
      const scaleX = CONFIG.logicWidth / rect.width;
      const scaleY = CONFIG.logicHeight / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      this.mouse.x = clamp(x, 0, CONFIG.logicWidth);
      this.mouse.y = clamp(y, 0, CONFIG.logicHeight);
      this.pointerPriorityTimer = this.pointerPriorityDuration;
    };

    this.canvas.addEventListener('pointermove', (event) => {
      updatePointer(event);
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0) {
        this.mouse.isDown = true;
      }
      this.canvas.setPointerCapture(event.pointerId);
      updatePointer(event);
    });

    this.canvas.addEventListener('pointerup', (event) => {
      if (event.button === 0) {
        this.mouse.isDown = false;
      }
      this.canvas.releasePointerCapture(event.pointerId);
    });

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.key === 'p' || event.key === 'P') {
        this.pausePressed = true;
      } else if (event.key === 'r' || event.key === 'R') {
        this.restartPressed = true;
      } else if (event.key === 'f' || event.key === 'F') {
        this.fullscreenPressed = true;
      }

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this._pressedKeys.add('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this._pressedKeys.add('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this._pressedKeys.add('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this._pressedKeys.add('right');
          break;
        case ' ': // Space
        case 'Spacebar':
          this._virtualFire = true;
          break;
      }
    });

    window.addEventListener('keyup', (event) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this._pressedKeys.delete('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this._pressedKeys.delete('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this._pressedKeys.delete('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this._pressedKeys.delete('right');
          break;
        case ' ': // Space
        case 'Spacebar':
          this._virtualFire = false;
          break;
      }
    });

    window.addEventListener('blur', () => {
      this._pressedKeys.clear();
      this.keyboardVector.x = 0;
      this.keyboardVector.y = 0;
      this._virtualFire = false;
    });
  }

  _recalculateAxis() {
    let horizontal = 0;
    let vertical = 0;
    if (this._pressedKeys.has('left')) horizontal -= 1;
    if (this._pressedKeys.has('right')) horizontal += 1;
    if (this._pressedKeys.has('up')) vertical -= 1;
    if (this._pressedKeys.has('down')) vertical += 1;

    this.keyboardVector.x = horizontal;
    this.keyboardVector.y = vertical;
  }

  consumePause() {
    if (this.pausePressed) {
      this.pausePressed = false;
      return true;
    }
    return false;
  }

  consumeRestart() {
    if (this.restartPressed) {
      this.restartPressed = false;
      return true;
    }
    return false;
  }

  consumeFullscreen() {
    if (this.fullscreenPressed) {
      this.fullscreenPressed = false;
      return true;
    }
    return false;
  }

  isFiring() {
    return this.mouse.isDown || this._virtualFire;
  }

  getTargetPosition() {
    return this.target;
  }
}
