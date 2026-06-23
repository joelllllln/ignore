/* =====================================================================
   HIVE WORLDS — audio.js
   Fully procedural sound via WebAudio. No files. Lazily unlocked on the
   first user gesture (browsers block autoplay).
   ===================================================================== */
const Audio2 = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  enabled: true, musicOn: true, started: false,
  _noiseBuf: null, _padTimer: 0, _step: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.8; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0; this.musicGain.connect(this.master);
    // noise buffer for explosions/hits
    const len = this.ctx.sampleRate * 1.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
  },
  unlock() { this.init(); if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); this.started = true; },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.9 : 0; },
  setMusic(v) { this.musicOn = v; if (this.musicGain) this.musicGain.gain.linearRampToValueAtTime(v ? 0.18 : 0, this.ctx.currentTime + 0.6); },

  _t() { return this.ctx.currentTime; },
  _osc(type, f0, f1, dur, gain, dest, detune) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, this._t());
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), this._t() + dur);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, this._t());
    g.gain.exponentialRampToValueAtTime(gain, this._t() + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, this._t() + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(); o.stop(this._t() + dur + 0.02);
  },
  _noise(dur, gain, lp, hp) {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this._t());
    g.gain.exponentialRampToValueAtTime(0.0001, this._t() + dur);
    let node = src;
    if (lp) { const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; node.connect(f); node = f; }
    if (hp) { const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; node.connect(f); node = f; }
    node.connect(g); g.connect(this.sfxGain);
    src.start(); src.stop(this._t() + dur + 0.02);
  },

  // ---- sfx library ----
  shot(type) {
    if (!this.ctx || !this.enabled) return;
    switch (type) {
      case "sniper": this._osc("sawtooth", 880, 120, 0.18, 0.18); this._noise(0.06, 0.12, 4000, 1200); break;
      case "cannon": this._osc("square", 160, 50, 0.18, 0.22); this._noise(0.12, 0.18, 800); break;
      case "frost": this._osc("sine", 1400, 600, 0.14, 0.10); this._osc("triangle", 2100, 900, 0.14, 0.05); break;
      case "tesla": this._osc("sawtooth", 600, 1800, 0.10, 0.10, null, 30); this._noise(0.08, 0.08, 6000, 2000); break;
      default: this._osc("square", 520, 180, 0.09, 0.12); break; // blaster
    }
  },
  hit() { this._noise(0.05, 0.07, 5000, 1500); },
  explosion(big) { this._noise(big ? 0.5 : 0.28, big ? 0.5 : 0.32, big ? 700 : 1200); this._osc("sine", big ? 120 : 200, 40, big ? 0.5 : 0.3, big ? 0.35 : 0.22); },
  kill(streak) { const base = 300 + Math.min(streak, 12) * 40; this._osc("triangle", base, base * 2.2, 0.12, 0.12); },
  place() { this._osc("square", 300, 600, 0.08, 0.12); this._osc("square", 600, 900, 0.1, 0.06); },
  buy() { this._osc("triangle", 600, 1200, 0.12, 0.14); this._osc("sine", 900, 1600, 0.14, 0.08); },
  click() { this._osc("square", 420, 360, 0.04, 0.08); },
  coreHit() { this._noise(0.18, 0.3, 500); this._osc("sine", 90, 50, 0.25, 0.25); },
  victory() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._osc("triangle", f, f, 0.3, 0.16), i * 120)); },
  boss() { this._osc("sawtooth", 70, 50, 0.9, 0.3); this._noise(0.9, 0.2, 400); },

  // ---- ambient pad: slow evolving chord, advanced from main loop ----
  music(dt) {
    if (!this.ctx || !this.enabled || !this.musicOn) return;
    this._padTimer -= dt;
    if (this._padTimer <= 0) {
      this._padTimer = 3.4;
      const roots = [110, 130.8, 98, 146.8];
      const root = roots[this._step % roots.length]; this._step++;
      [root, root * 1.5, root * 2, root * 2.5].forEach((f, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = rand(-6, 6);
        g.gain.setValueAtTime(0.0001, this._t());
        g.gain.linearRampToValueAtTime(0.05, this._t() + 1.4);
        g.gain.linearRampToValueAtTime(0.0001, this._t() + 3.6);
        o.connect(g); g.connect(this.musicGain);
        o.start(); o.stop(this._t() + 3.8);
      });
    }
  },
};
