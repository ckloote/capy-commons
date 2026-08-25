// audio.js — tiny WebAudio synth: squeaks, plucks, chimes, ambient wind & birds
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // minor penta-ish ladder
const BASE = 261.63; // C4

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._ambient();
  }
  _now() { return this.ctx.currentTime; }

  _tone(freq, t0, dur, { type = 'sine', gain = 0.2, glideTo = null, attack = 0.01 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  squeak() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone(900 + Math.random() * 300, t, 0.09, { type: 'square', gain: 0.06, glideTo: 1600 });
    this._tone(1400, t + 0.1, 0.07, { type: 'square', gain: 0.05, glideTo: 1900 });
  }
  pickup() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone(660, t, 0.12, { type: 'triangle', gain: 0.18 });
    this._tone(990, t + 0.07, 0.18, { type: 'triangle', gain: 0.16 });
  }
  // each friend gets a rising step of a pentatonic ladder — the island slowly builds a chord
  friendJoin(n) {
    if (!this.ctx) return;
    const t = this._now();
    const root = BASE * Math.pow(2, PENTA[n % PENTA.length] / 12);
    [1, 1.5, 2].forEach((m, i) => {
      this._tone(root * m, t + i * 0.09, 0.5, { type: 'triangle', gain: 0.16 });
    });
  }
  rune() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone(1318, t, 0.9, { type: 'sine', gain: 0.12 });
    this._tone(1976, t + 0.05, 1.1, { type: 'sine', gain: 0.07 });
  }
  denied() {
    if (!this.ctx) return;
    const t = this._now();
    this._tone(220, t, 0.15, { type: 'triangle', gain: 0.1, glideTo: 190 });
  }
  splash() {
    if (!this.ctx) return;
    const t = this._now();
    const noise = this._noiseSrc(0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(f); f.connect(g); g.connect(this.master);
  }
  finale() {
    if (!this.ctx) return;
    const t = this._now();
    const melody = [0, 5, 7, 12, 10, 7, 12, 17];
    melody.forEach((st, i) => {
      const f = BASE * Math.pow(2, st / 12);
      this._tone(f, t + i * 0.22, 0.5, { type: 'triangle', gain: 0.16 });
      this._tone(f * 2, t + i * 0.22, 0.4, { type: 'sine', gain: 0.05 });
    });
    // warm pad
    [BASE, BASE * 1.5, BASE * 2, BASE * 2.5].forEach((f) => {
      this._tone(f, t + 1.8, 4.5, { type: 'sine', gain: 0.05, attack: 1.2 });
    });
  }

  _noiseSrc(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.start();
    return src;
  }

  _ambient() {
    // soft wind: looping filtered noise
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 380;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this._windGain = g;
    // occasional birdsong
    const chirp = () => {
      if (!this.ctx) return;
      const t = this._now();
      const base = 1800 + Math.random() * 1400;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        this._tone(base + Math.random() * 300, t + i * 0.14, 0.1,
          { type: 'sine', gain: 0.025, glideTo: base * 1.25 });
      }
      this._birdTimer = setTimeout(chirp, 4000 + Math.random() * 9000);
    };
    this._birdTimer = setTimeout(chirp, 3000);
  }
}
