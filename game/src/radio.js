// Radio: three procedural WebAudio stations — no audio files, no
// network. Each station is a small step sequencer with its own tempo,
// scale and sound: surf rock (bright triangle lead over a walking
// bass), synthwave (sawtooth bass pulse + arpeggio through a lowpass
// filter) and talk radio (sparse piano-ish stabs and a jingle — the
// "voices" are filtered noise murmurs). The HUD shows the station
// name and the current track; R or the HUD button switches station,
// and the track advances every 40 seconds. Everything is guarded so
// the game runs fine with no audio at all (headless capture, muted).

import { RADIO_STATIONS } from './config.js';

// Frequencies for the sequencers (Hz). Surf in A major pentatonic,
// synth in C minor, talk stabs in F major.
const SCALES = {
  surf: [110, 138.59, 164.81, 220, 246.94, 277.18, 329.63, 440],
  synth: [65.41, 77.78, 98, 130.81, 155.56, 196, 261.63, 311.13],
  talk: [87.31, 110, 130.81, 174.61, 220, 261.63],
};

const RECIPES = {
  surf: { bpm: 132, lead: 'triangle', bass: 'sine', bassGain: 0.16, leadGain: 0.11, pattern: [0, 3, 5, 3, 4, 7, 5, 2, 0, 3, 5, 7, 5, 4, 3, 2] },
  synth: { bpm: 104, lead: 'sawtooth', bass: 'sawtooth', bassGain: 0.12, leadGain: 0.07, pattern: [0, 0, 3, 0, 5, 0, 3, 4, 0, 0, 3, 0, 7, 5, 4, 3] },
  talk: { bpm: 80, lead: 'sine', bass: 'sine', bassGain: 0.08, leadGain: 0.09, pattern: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 4, -1, 2, -1, 1, -1] },
};

export class Radio {
  constructor(audio) {
    this.audio = audio; // the shared Audio instance
    this.stations = RADIO_STATIONS;
    this.idx = 0;
    this.trackIdx = 0;
    this.trackTimer = 40;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.started = false;
    this.jingleTimer = 20;
  }

  station() {
    return this.stations[this.idx % this.stations.length];
  }

  track() {
    const s = this.station();
    return s.tracks[this.trackIdx % s.tracks.length];
  }

  // Begin the scheduler once the AudioContext exists (after the first
  // user gesture). Safe to call repeatedly.
  start() {
    if (this.started) return;
    const ctx = this.audio.getContext();
    if (!ctx) return;
    this.started = true;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 200);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  next() {
    this.idx = (this.idx + 1) % this.stations.length;
    this.trackIdx = 0;
    this.trackTimer = 40;
    this.step = 0;
    this.audio.jingle();
    const ctx = this.audio.getContext();
    if (ctx) this.nextNoteTime = ctx.currentTime + 0.15;
  }

  setStation(i) {
    if (i >= 0 && i < this.stations.length && i !== this.idx) this.next();
  }

  update(dt) {
    this.trackTimer -= dt;
    if (this.trackTimer <= 0) {
      this.trackTimer = 40;
      this.trackIdx = (this.trackIdx + 1) % this.station().tracks.length;
    }
    // Talk radio gets a station jingle every ~25 seconds.
    if (this.station().id === 'talk') {
      this.jingleTimer -= dt;
      if (this.jingleTimer <= 0) {
        this.jingleTimer = 25;
        this.audio.jingle();
      }
    }
  }

  schedule() {
    const ctx = this.audio.getContext();
    const master = this.audio.getMaster();
    if (!ctx || !master || this.audio.muted) return;
    const recipe = RECIPES[this.station().id];
    const scale = SCALES[this.station().id];
    const stepDur = 60 / recipe.bpm / 2; // eighth notes
    while (this.nextNoteTime < ctx.currentTime + 0.5) {
      const t = this.nextNoteTime;
      const s = this.step % 16;
      // Bass on beats 1 and 3, root note.
      if (s === 0 || s === 8) {
        this.note(ctx, master, scale[0] / 2, t, stepDur * 3.5, recipe.bass, recipe.bassGain, 300);
      }
      // Lead from the pattern; -1 means rest.
      const deg = recipe.pattern[s];
      if (deg >= 0) {
        const freq = scale[deg % scale.length] * (deg >= scale.length ? 2 : 1);
        this.note(ctx, master, freq, t, stepDur * 0.9, recipe.lead, recipe.leadGain,
          this.station().id === 'synth' ? 1400 : 3200);
      }
      // Talk radio: a soft filtered-noise "murmur" under the music.
      if (this.station().id === 'talk' && s % 4 === 2) {
        this.murmur(ctx, master, t, 0.5);
      }
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  note(ctx, master, freq, t, dur, type, vol, cutoff) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  murmur(ctx, master, t, dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400 + Math.random() * 300;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }
}
