import { MUTE_PREF_KEY } from '../config.js';

const EFFECT_DEFINITIONS = {
  shoot: {
    duration: 0.16,
    generator: (t) => 0.8 * Math.sin(2 * Math.PI * (520 + -420 * t) * t),
    gain: 0.18,
  },
  enemyShoot: {
    duration: 0.22,
    generator: (t) => 0.6 * Math.sin(2 * Math.PI * (260 - 80 * t) * t),
    gain: 0.12,
  },
  missile: {
    duration: 0.34,
    generator: (t) => 0.7 * Math.sin(2 * Math.PI * (320 - 140 * t) * t) * Math.exp(-3.5 * t),
    gain: 0.14,
  },
  explosion: {
    duration: 0.5,
    generator: (t) => (Math.random() * 2 - 1) * Math.exp(-4 * t),
    gain: 0.25,
  },
  powerUp: {
    duration: 0.27,
    generator: (t) => 0.9 * Math.sin(2 * Math.PI * (660 + 220 * t) * t),
    gain: 0.15,
  },
};

export class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.musicGain = null;
    this.effectBuffers = new Map();
    this.muted = this._readMutePreference();
    this.musicNodes = [];
  }

  _readMutePreference() {
    try {
      const stored = window.localStorage.getItem(MUTE_PREF_KEY);
      return stored === 'true';
    } catch (error) {
      return false;
    }
  }

  _storeMutePreference(value) {
    try {
      window.localStorage.setItem(MUTE_PREF_KEY, value ? 'true' : 'false');
    } catch (error) {
      // Ignore storage errors (private mode, etc.)
    }
  }

  _ensureContext() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.context.destination);

    this.effectsGain = this.context.createGain();
    this.effectsGain.gain.value = 1;
    this.effectsGain.connect(this.masterGain);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.05;
    this.musicGain.connect(this.masterGain);

    this._buildEffectBuffers();
    this._ensureBackgroundMusic();
  }

  _buildEffectBuffers() {
    if (!this.context) return;
    const sampleRate = this.context.sampleRate;
    for (const [name, definition] of Object.entries(EFFECT_DEFINITIONS)) {
      const frameCount = Math.floor(sampleRate * definition.duration);
      const buffer = this.context.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        const t = i / sampleRate;
        data[i] = definition.generator(t);
      }
      this.effectBuffers.set(name, { buffer, gain: definition.gain });
    }
  }

  _ensureBackgroundMusic() {
    if (!this.context || this.musicNodes.length > 0) return;
    const padOsc = this.context.createOscillator();
    padOsc.type = 'sine';
    padOsc.frequency.setValueAtTime(144, this.context.currentTime);

    const padOsc2 = this.context.createOscillator();
    padOsc2.type = 'sine';
    padOsc2.frequency.setValueAtTime(188, this.context.currentTime);

    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;

    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.25;

    const musicGain = this.musicGain;
    const modGain = this.context.createGain();
    modGain.gain.value = 0.4;

    lfo.connect(lfoGain);
    lfoGain.connect(modGain.gain);
    padOsc.connect(modGain);
    padOsc2.connect(modGain);
    modGain.connect(musicGain);

    padOsc.start();
    padOsc2.start();
    lfo.start();
    this.musicNodes.push(padOsc, padOsc2, lfo, modGain, lfoGain);
  }

  async resume() {
    this._ensureContext();
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  toggleMute() {
    const nextMute = !this.muted;
    this.setMuted(nextMute);
    return this.muted;
  }

  setMuted(value) {
    this.muted = value;
    this._storeMutePreference(value);
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value ? 0 : 1, this.context.currentTime, 0.1);
    }
  }

  isMuted() {
    return this.muted;
  }

  playEffect(name) {
    if (this.muted) return;
    this._ensureContext();
    if (!this.context) return;
    const entry = this.effectBuffers.get(name);
    if (!entry) return;
    const source = this.context.createBufferSource();
    source.buffer = entry.buffer;
    const gain = this.context.createGain();
    gain.gain.value = entry.gain;
    source.connect(gain);
    gain.connect(this.effectsGain);
    source.start();
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
  }

  playShoot() {
    this.playEffect('shoot');
  }

  playEnemyShoot() {
    this.playEffect('enemyShoot');
  }

  playMissile() {
    this.playEffect('missile');
  }

  playExplosion() {
    this.playEffect('explosion');
  }

  playPowerUp() {
    this.playEffect('powerUp');
  }
}
