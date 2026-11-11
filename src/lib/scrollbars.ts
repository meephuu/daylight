/** How long after the last scroll movement a scrollbar stays fully visible before it starts to fade. */
const VISIBLE_MS = 700;
/** How long the slow fade takes. */
const FADE_MS = 1100;

interface FadeState {
  timer: number | undefined;
  frame: number | undefined;
}

/**
 * Scrollbars are invisible until something scrolls (see index.css, where the thumb colour uses the
 * --sb-alpha variable). Scroll events do not bubble, so this listens in the capture phase: the scrolling
 * element jumps to full opacity, waits a moment after the movement stops, then fades out over about a
 * second. Browsers cannot animate scrollbar parts with CSS transitions, hence the small animation loop.
 */
export function initScrollbarFade(): void {
  const states = new WeakMap<Element, FadeState>();

  function stateOf(element: Element): FadeState {
    let state = states.get(element);
    if (!state) {
      state = { timer: undefined, frame: undefined };
      states.set(element, state);
    }
    return state;
  }

  function fadeOut(element: HTMLElement, state: FadeState) {
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / FADE_MS);
      if (progress >= 1) {
        element.style.removeProperty("--sb-alpha");
        state.frame = undefined;
        return;
      }
      element.style.setProperty("--sb-alpha", String(1 - progress));
      state.frame = window.requestAnimationFrame(step);
    };
    state.frame = window.requestAnimationFrame(step);
  }

  document.addEventListener(
    "scroll",
    (event) => {
      const target = event.target;
      const element = target instanceof HTMLElement ? target : document.documentElement;
      const state = stateOf(element);
      window.clearTimeout(state.timer);
      if (state.frame !== undefined) window.cancelAnimationFrame(state.frame);
      state.frame = undefined;
      element.style.setProperty("--sb-alpha", "1");
      state.timer = window.setTimeout(() => fadeOut(element, state), VISIBLE_MS);
    },
    { capture: true, passive: true },
  );
}
