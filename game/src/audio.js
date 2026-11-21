// Every sound is synthesized with WebAudio — oscillators and filtered
// noise, no audio files and no network. The context only starts after a
// user gesture, and M mutes everything at the master gain.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A slow coastal pad: two detuned triangles over a soft bass pulse.
  const CHORDS = [[220, 277.2, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [146.8, 220, 293.7]];
  function startMusic() {
    if (!ensure() || musicTimer !== null) return;
    let chord = 0;
    const playChord = () => {
      if (muted || !ctx) return;
      const t = ctx.currentTime;
      for (const freq of CHORDS[chord % CHORDS.length]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 8;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.8);
        gain.gain.linearRampToValueAtTime(0, t + 3.8);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t);
        osc.stop(t + 4);
      }
      chord += 1;
    };
    playChord();
    musicTimer = window.setInterval(playChord, 4000);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.55;
      if (value) {
        this.engine(0);
        this.siren(false);
      }
    },
    isMuted() {
      return muted;
    },
    startMusic,
    stopMusic,
    click() {
      tone(660, 0.08, 'sine', 0.25);
    },
    gunshot() {
      noise(0.16, 0.5, 1400);
      tone(180, 0.1, 'square', 0.2, 60);
    },
    punch() {
      noise(0.08, 0.35, 500);
      tone(120, 0.08, 'sine', 0.3, 70);
    },
    hit() {
      tone(220, 0.12, 'sawtooth', 0.18, 90);
    },
    crash() {
      noise(0.3, 0.5, 900);
      tone(90, 0.25, 'square', 0.25, 40);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.3);
      window.setTimeout(() => tone(1320, 0.14, 'sine', 0.3), 90);
    },
    cash() {
      tone(1046, 0.09, 'triangle', 0.3);
      window.setTimeout(() => tone(1568, 0.16, 'triangle', 0.3), 80);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => {
        window.setTimeout(() => tone(f, 0.22, 'triangle', 0.32), i * 110);
      });
    },
    missionFailed() {
      [392, 330, 262].forEach((f, i) => {
        window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.18), i * 160);
      });
    },
    busted() {
      tone(440, 0.4, 'square', 0.2, 220);
      window.setTimeout(() => tone(330, 0.5, 'square', 0.2, 165), 350);
    },
    engine(level) {
      if (!ensure()) return;
      if (level <= 0.01) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch { /* already stopped */ }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(60 + level * 140, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + level * 0.06, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ensure()) return;
      if (!on) {
        if (sirenOsc) {
          try { sirenOsc.stop(); } catch { /* already stopped */ }
          sirenOsc = null;
          sirenGain = null;
        }
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = 0;
      }
    },
    updateSiren(dt) {
      if (!sirenOsc || !ctx) return;
      sirenTimer += dt;
      const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 950 : 720, ctx.currentTime, 0.03);
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.05);
    },
  };
}
