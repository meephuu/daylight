/**
 * The Focus timer's chime, made on the spot with the Web Audio API (no sound file), like the rain.
 * A focus run ending rings three soft bell notes going up; a break ending rings two, going down, so the
 * two can be told apart without looking.
 */

let context: AudioContext | null = null;

const VOLUME = 0.32;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/**
 * Wakes the audio while the user is pressing something (starting a run), so the chime may play later
 * without one: the webview only lets sound start after a user gesture.
 */
export function primeChime(): void {
  audio();
}

/** One bell note: a sine with a quieter, faster-fading overtone, struck and left to ring out. */
function bell(ctx: AudioContext, frequency: number, at: number, length: number) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(VOLUME, at + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);
  out.connect(ctx.destination);
  for (const [ratio, level, decay] of [
    [1, 1, 1],
    [2.76, 0.18, 0.35],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length * decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

/** Rings the chime for the end of a focus run ("focus") or of a break ("break"). */
export function playChime(kind: "focus" | "break"): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.05;
  // C6 E6 G6 up for a finished focus run; G5 C5 down for the end of a break.
  const notes = kind === "focus" ? [1046.5, 1318.5, 1568] : [784, 523.25];
  notes.forEach((frequency, index) => bell(ctx, frequency, start + index * 0.18, index === notes.length - 1 ? 2.2 : 1.4));
}
