/**
 * Rain, made on the spot with the Web Audio API (no sound file): a steady wash of filtered brown noise
 * for the downpour, a softer band of brighter noise for the hiss on the glass, and single drops (tiny
 * filtered clicks) landing at random. Fades in and out over about two seconds.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let sources: AudioBufferSourceNode[] = [];
let dropTimer: number | undefined;
let stopTimer: number | undefined;

const VOLUME = 0.55;
const FADE_S = 1.8;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        // Integrated noise: deep and soft, like a heavy shower far off.
        last = (last + 0.02 * white) / 1.02;
        data[index] = last * 3.5;
      } else {
        data[index] = white;
      }
    }
  }
  return buffer;
}

function loop(ctx: AudioContext, buffer: AudioBuffer, nodes: AudioNode[]): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  let tail: AudioNode = source;
  for (const node of nodes) {
    tail.connect(node);
    tail = node;
  }
  tail.connect(master!);
  source.start();
  return source;
}

function drop(ctx: AudioContext) {
  if (!master) return;
  const length = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (length / 6));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800 + Math.random() * 3800;
  band.Q.value = 2 + Math.random() * 4;
  const gain = ctx.createGain();
  gain.gain.value = 0.05 + Math.random() * 0.12;
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  source.connect(band).connect(gain).connect(pan).connect(master);
  source.start();
}

export function startRain(): void {
  window.clearTimeout(stopTimer);
  if (!context) context = new AudioContext();
  const ctx = context;
  void ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 900;
    const body = ctx.createGain();
    body.gain.value = 0.9;
    sources.push(loop(ctx, noiseBuffer(ctx, 4, true), [lowpass, body]));

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 5200;
    band.Q.value = 0.6;
    const hiss = ctx.createGain();
    hiss.gain.value = 0.035;
    sources.push(loop(ctx, noiseBuffer(ctx, 3, false), [band, hiss]));

    const scheduleDrop = () => {
      drop(ctx);
      dropTimer = window.setTimeout(scheduleDrop, 25 + Math.random() * 140);
    };
    scheduleDrop();
  }
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(VOLUME, now + FADE_S);
}

export function stopRain(): void {
  if (!context || !master) return;
  const ctx = context;
  const gain = master;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE_S);
  window.clearTimeout(stopTimer);
  // Once faded, tear it all down so nothing runs in the background.
  stopTimer = window.setTimeout(() => {
    window.clearTimeout(dropTimer);
    sources.forEach((source) => source.stop());
    sources = [];
    gain.disconnect();
    master = null;
  }, FADE_S * 1000 + 100);
}
