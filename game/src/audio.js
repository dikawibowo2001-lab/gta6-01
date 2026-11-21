// Sound: everything is synthesized with the Web Audio API — no audio
// files, no network. A soft synth pad loops underneath, the radio
// module (radio.js) schedules procedural station music through the
// shared AudioContext, and one-shot blips cover gunfire, sirens,
// pickups, crashes, explosions, race countdowns and the
// mission-complete jingle. All of it stays silent until the first user
// gesture creates the AudioContext.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.sirenNodes = null;
    this.ambientNodes = null;
    this.engineNodes = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this.startAmbient();
      return true;
    } catch {
      return false;
    }
  }

  // The radio module schedules its own notes through this context.
  getContext() {
    return this.ctx;
  }

  getMaster() {
    return this.master;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // A slow two-oscillator pad with a wandering filter: the sunset hum.
  startAmbient() {
    if (!this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 164.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.ambientNodes = { gain, o1, o2, lfo };
  }

  // A two-tone siren that wails while the heat is on.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.4);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { gain, osc, lfo };
    } else if (!on && this.sirenNodes) {
      const { gain, osc, lfo } = this.sirenNodes;
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      const stop = () => {
        try { osc.stop(); lfo.stop(); } catch { /* already stopped */ }
      };
      setTimeout(stop, 400);
      this.sirenNodes = null;
    }
  }

  // Engine hum whose pitch follows the car's speed.
  setEngine(speedFrac, on) {
    if (!this.ctx) return;
    if (on && !this.engineNodes) {
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.engineNodes = { gain, osc, filter };
    }
    if (this.engineNodes) {
      if (!on) {
        try { this.engineNodes.osc.stop(); } catch { /* stopped */ }
        this.engineNodes = null;
        return;
      }
      this.engineNodes.osc.frequency.value = 55 + speedFrac * 130;
      this.engineNodes.filter.frequency.value = 220 + speedFrac * 500;
    }
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, low) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 900;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  shot(player) {
    if (player) this.noise(0.14, 0.4, 1400);
    else this.noise(0.1, 0.18, 900);
  }

  shotgunBlast() {
    this.noise(0.28, 0.55, 800);
    this.blip(70, 0.22, 'sawtooth', 0.3, 35);
  }

  crash() {
    this.noise(0.25, 0.35, 500);
    this.blip(90, 0.2, 'sawtooth', 0.2, 40);
  }

  explosion() {
    this.noise(0.7, 0.6, 300);
    this.blip(55, 0.5, 'sawtooth', 0.35, 28);
    setTimeout(() => this.noise(0.4, 0.3, 200), 120);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.2);
    setTimeout(() => this.blip(990, 0.14, 'sine', 0.2), 90);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 130));
  }

  missionFail() {
    this.blip(320, 0.3, 'sawtooth', 0.18, 140);
  }

  busted() {
    this.blip(440, 0.25, 'square', 0.15, 220);
    setTimeout(() => this.blip(440, 0.35, 'square', 0.15, 220), 300);
  }

  click() {
    this.blip(880, 0.05, 'sine', 0.12);
  }

  // Radio station jingle: a bright three-note sting on switch.
  jingle() {
    const notes = [784, 988, 1175];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.18), i * 90));
  }

  // Race countdown: low beep for 3-2-1, high beep for GO.
  countBeep(go) {
    this.blip(go ? 880 : 440, go ? 0.4 : 0.15, 'square', 0.22);
  }

  // Cash-register cha-ching for a garage purchase.
  chaChing() {
    this.blip(1319, 0.1, 'sine', 0.2);
    setTimeout(() => this.blip(1568, 0.18, 'sine', 0.2), 90);
  }

  // Nitro hiss.
  nitro() {
    this.noise(0.35, 0.22, 2400);
  }
}
