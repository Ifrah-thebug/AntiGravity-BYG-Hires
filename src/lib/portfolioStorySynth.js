/** Gentle music-box loop — used when no MP3 is available (no external download needed). */

const MELODY = [
  523.25, 587.33, 659.25, 783.99, 659.25, 587.33,
  493.88, 523.25, 587.33, 659.25, 587.33, 523.25,
];

const BASS = [261.63, 329.63, 392.0, 329.63];

export function createStorybookSynth() {
  let ctx = null;
  let melodyTimer = null;
  let padOsc = null;
  let padGain = null;
  let masterGain = null;
  let step = 0;
  let bassStep = 0;

  function playNote(freq, duration = 0.7, volume = 0.12) {
    if (!ctx || !masterGain) return;

    const osc = ctx.createOscillator();
    const bell = ctx.createOscillator();
    const env = ctx.createGain();
    const bellEnv = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;

    osc.type = 'triangle';
    osc.frequency.value = freq;
    bell.type = 'sine';
    bell.frequency.value = freq * 2;
    bellEnv.gain.value = 0.04;

    const t = ctx.currentTime;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(volume, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    bellEnv.gain.setValueAtTime(0.0001, t);
    bellEnv.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    bellEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.6);

    osc.connect(env);
    bell.connect(bellEnv);
    env.connect(filter);
    bellEnv.connect(filter);
    filter.connect(masterGain);
    osc.start(t);
    bell.start(t);
    osc.stop(t + duration + 0.05);
    bell.stop(t + duration + 0.05);
  }

  function start() {
    if (ctx) return;
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(ctx.destination);

    padOsc = ctx.createOscillator();
    padGain = ctx.createGain();
    padOsc.type = 'sine';
    padOsc.frequency.value = 196;
    padGain.gain.value = 0.04;
    padOsc.connect(padGain);
    padGain.connect(masterGain);
    padOsc.start();

    melodyTimer = setInterval(() => {
      playNote(MELODY[step % MELODY.length], 0.85, 0.1);
      if (step % 3 === 0) {
        playNote(BASS[bassStep % BASS.length], 1.1, 0.06);
        bassStep += 1;
      }
      step += 1;
    }, 820);
  }

  async function resume() {
    if (ctx?.state === 'suspended') await ctx.resume();
  }

  function stop() {
    if (melodyTimer) {
      clearInterval(melodyTimer);
      melodyTimer = null;
    }
    try {
      padOsc?.stop();
    } catch {
      /* already stopped */
    }
    padOsc = null;
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
    masterGain = null;
    step = 0;
    bassStep = 0;
  }

  return { start, stop, resume };
}
