// Solmar Bay v4 — procedural in-car radio.
//
// Three stations, each a tiny generative band: a bass line walking a
// chord progression, a soft pad, and a melody plucked from the
// chord's scale. A lookahead scheduler queues notes a bar ahead so
// the groove never stutters. Track titles rotate every 40 seconds
// from each station's own playlist.

const STATIONS = [
  {
    name: 'PALM FM',
    freq: '96.2',
    genre: 'Surf Rock',
    tempo: 128,
    wave: 'triangle',
    roots: [110, 87.31, 98, 130.81], // A2 F2 G2 C3
    tracks: ['Pipeline Sunset — The Breakers', 'Wax On Wax Off — Coral Kings', 'Boardwalk Breeze — Salty Dogs', 'High Tide Heart — The Breakers'],
  },
  {
    name: 'MIDNIGHT DRIVE',
    freq: '104.5',
    genre: 'Synthwave',
    tempo: 100,
    wave: 'sawtooth',
    roots: [55, 65.41, 49, 58.27], // A1 C2 G1 Bb1
    tracks: ['Neon Overpass — Vector Seven', 'Chrome Hearts — Night Circuit', 'Palm Static — Vector Seven', 'Afterglow Avenue — Night Circuit'],
  },
  {
    name: 'BAY TALK',
    freq: '87.9',
    genre: 'Talk & Soul',
    tempo: 92,
    wave: 'sine',
    roots: [130.81, 110, 146.83, 98], // C3 A2 D3 G2
    tracks: ['The Harbor Hour — with Dee Marlowe', 'Soul Kitchen — Sunday Slow Jam', 'The Harbor Hour — Calls From The Pier', 'Golden Hour Grooves — DJ Sol'],
  },
];

export function makeRadio(audio) {
  let stationIdx = 0;
  let trackIdx = 0;
  let trackTimer = 0;
  let timer = null;
  let nextNoteTime = 0;
  let step = 0;
  let radioGain = null;

  function station() {
    return STATIONS[stationIdx];
  }

  function scheduleStep(at, stepIdx) {
    const ctx = audio.context;
    if (!ctx || !radioGain) return;
    const st = station();
    const beat = 60 / st.tempo;
    const bar = Math.floor(stepIdx / 8) % st.roots.length;
    const root = st.roots[bar];
    const eighth = stepIdx % 8;
    // Bass on beats 0 and 4.
    if (eighth === 0 || eighth === 4) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = root / 2;
      g.gain.setValueAtTime(0.16, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + beat * 1.8);
      osc.connect(g);
      g.connect(radioGain);
      osc.start(at);
      osc.stop(at + beat * 2);
    }
    // Pad chord at the top of each bar.
    if (eighth === 0) {
      for (const mult of [1, 1.5, 2]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = st.wave;
        osc.frequency.value = root * mult;
        g.gain.setValueAtTime(0.045, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + beat * 7);
        osc.connect(g);
        g.connect(radioGain);
        osc.start(at);
        osc.stop(at + beat * 7.2);
      }
    }
    // Melody plucks on a pentatonic-ish pattern.
    const scale = [1, 1.189, 1.335, 1.498, 1.782, 2];
    if (eighth % 2 === 1) {
      const note = scale[(stepIdx * 5 + bar) % scale.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = st.wave;
      osc.frequency.value = root * 2 * note;
      g.gain.setValueAtTime(0.07, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.9);
      osc.connect(g);
      g.connect(radioGain);
      osc.start(at);
      osc.stop(at + beat);
    }
    // Hat ticks for the synthwave station.
    if (stationIdx === 1 && eighth % 2 === 0) {
      const len = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(g);
      g.connect(radioGain);
      src.start(at);
    }
  }

  function startScheduler() {
    const ctx = audio.context;
    if (!ctx || timer) return;
    if (!radioGain) {
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.6;
      radioGain.connect(audio.masterGain);
    }
    nextNoteTime = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(() => {
      const st = station();
      const eighthDur = 60 / st.tempo / 2;
      while (nextNoteTime < ctx.currentTime + 0.25) {
        scheduleStep(nextNoteTime, step);
        nextNoteTime += eighthDur;
        step += 1;
      }
    }, 90);
  }

  return {
    stationCount: STATIONS.length,
    get index() { return stationIdx; },
    get name() { return station().name; },
    get freq() { return station().freq; },
    get genre() { return station().genre; },
    get track() { return station().tracks[trackIdx]; },
    start() {
      audio.resume();
      startScheduler();
    },
    next() {
      stationIdx = (stationIdx + 1) % STATIONS.length;
      trackIdx = 0;
      trackTimer = 0;
      step = 0;
      audio.play('click');
      return this.name;
    },
    setStation(i) {
      stationIdx = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      trackIdx = 0;
      trackTimer = 0;
    },
    tick(dt) {
      trackTimer += dt;
      if (trackTimer > 40) {
        trackTimer = 0;
        trackIdx = (trackIdx + 1) % station().tracks.length;
      }
    },
  };
}
