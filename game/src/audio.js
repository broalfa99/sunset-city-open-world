// Sunset City — sound: WebAudio oscillator/noise synthesis only.
// No audio files, no network. Everything is a no-op until the first
// user gesture unlocks the AudioContext (headless runs stay silent).

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    sirenTimer: 0,
    sirenHigh: false,

    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) {
        this.ctx = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.ctx && this.ctx.destination) {
        // Mute by dropping the master gain via engine/siren gains.
        if (this.engineGain) this.engineGain.gain.value = m ? 0 : 0.05;
        if (this.sirenGain) this.sirenGain.gain.value = m ? 0 : 0.03;
      }
    },

    _tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) { /* silent */ }
    },

    _noise(dur, filterFreq, gain = 0.2, type = 'lowpass') {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = filterFreq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.ctx.destination);
        src.start(t0);
      } catch (e) { /* silent */ }
    },

    setEngine(on, speed01) {
      if (!this.ctx || this.muted) {
        if (this.engineGain) this.engineGain.gain.value = 0;
        return;
      }
      try {
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          this.engineFilter = this.ctx.createBiquadFilter();
          this.engineFilter.type = 'lowpass';
          this.engineFilter.frequency.value = 420;
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0;
          this.engineOsc.connect(this.engineFilter);
          this.engineFilter.connect(this.engineGain);
          this.engineGain.connect(this.ctx.destination);
          this.engineOsc.start();
        }
        const target = on ? 0.045 + speed01 * 0.03 : 0;
        this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
        this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 150, this.ctx.currentTime, 0.1);
      } catch (e) { /* silent */ }
    },

    siren(on) {
      if (!this.ctx) {
        this.sirenOn = on;
        return;
      }
      try {
        if (on && !this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenOsc.type = 'sine';
          this.sirenOsc.frequency.value = 700;
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = this.muted ? 0 : 0.03;
          this.sirenOsc.connect(this.sirenGain);
          this.sirenGain.connect(this.ctx.destination);
          this.sirenOsc.start();
        }
        this.sirenOn = on;
        if (this.sirenGain) this.sirenGain.gain.value = on && !this.muted ? 0.03 : 0;
      } catch (e) { /* silent */ }
    },

    update(dt) {
      if (!this.ctx || !this.sirenOn || !this.sirenOsc) return;
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.45;
        this.sirenHigh = !this.sirenHigh;
        try {
          this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 950 : 700, this.ctx.currentTime, 0.05);
        } catch (e) { /* silent */ }
      }
    },

    gunshot() { this._noise(0.14, 900, 0.22); this._tone(160, 0.08, 'square', 0.1); },
    pickup() { this._tone(880, 0.07, 'sine', 0.12); this._tone(1320, 0.09, 'sine', 0.12, 0.07); },
    jingle() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.12, i * 0.11));
    },
    click() { this._tone(1000, 0.05, 'square', 0.07); },
    thud() { this._tone(85, 0.16, 'sine', 0.22); this._noise(0.1, 300, 0.12); },
    swoosh() { this._noise(0.18, 1400, 0.1, 'bandpass'); },
    screech() { this._noise(0.3, 2400, 0.07, 'highpass'); },
  };
  return audio;
}
