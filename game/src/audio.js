// Solmar Bay v4 — procedural sound effects (WebAudio, no files).
//
// Every sound is synthesised: oscillators for tones, filtered noise
// buffers for impacts. The context starts suspended and resumes on
// the first user gesture; until then every call is a safe no-op.

export function makeAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  const sfx = {
    shot() { tone(180, 0.12, 'square', 0.25, 60); noise(0.08, 0.3, 3000, 'highpass'); },
    shotgun() { noise(0.25, 0.5, 1200); tone(90, 0.2, 'sine', 0.4, 40); },
    explosion() { noise(0.9, 0.7, 400); tone(70, 0.8, 'sine', 0.6, 28); },
    crash() { noise(0.3, 0.45, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.12, 'sine', 0.25), 90); },
    click() { tone(1200, 0.05, 'square', 0.12); },
    cash() { tone(880, 0.08, 'triangle', 0.25); setTimeout(() => tone(1320, 0.14, 'triangle', 0.25), 80); },
    horn() { tone(370, 0.25, 'sawtooth', 0.2); tone(466, 0.25, 'sawtooth', 0.15); },
    denied() { tone(220, 0.15, 'square', 0.2, 160); },
    mission() { tone(523, 0.12, 'triangle', 0.3); setTimeout(() => tone(784, 0.2, 'triangle', 0.3), 120); },
    wantedUp() { tone(440, 0.1, 'square', 0.2); setTimeout(() => tone(554, 0.12, 'square', 0.2), 100); },
  };

  return {
    // Call from a user gesture (click / key) to unlock audio.
    resume() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    get context() { return ensure(); },
    get masterGain() { return master; },
    get isMuted() { return muted; },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    play(name) {
      if (sfx[name]) sfx[name]();
    },
    // Continuous engine hum; rpm in [0, 1] bends the pitch.
    engine(rpm, on) {
      if (!ensure() || muted) return;
      if (!on) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch (e) { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        gain.gain.value = 0.06;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain, filter };
      }
      engineNodes.osc.frequency.value = 55 + rpm * 130;
      engineNodes.filter.frequency.value = 300 + rpm * 900;
    },
    // Two-tone police siren loop.
    siren(on) {
      if (!ensure() || muted) return;
      if (!on) {
        if (sirenNodes) {
          clearInterval(sirenNodes.timer);
          try { sirenNodes.osc.stop(); } catch (e) { /* already stopped */ }
          sirenNodes = null;
        }
        return;
      }
      if (sirenNodes) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 750;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      let high = true;
      const timer = setInterval(() => {
        high = !high;
        osc.frequency.value = high ? 950 : 750;
      }, 380);
      sirenNodes = { osc, timer };
    },
  };
}
