/**
 * Textures for the patterned vinyl finishes (marble, splatter, liquid), drawn as small SVGs and used as a
 * background image under the grooves. Each is drawn in a 200x200 box (the record's centre at 100,100, the
 * label's edge at a radius of about 49) and scales to any size, from the 32px swatch to the record itself.
 * The shapes are fixed (seeded), so every record of one finish is pressed the same; only the colours change.
 * Built strings are cached, so a spinning record or a re-render never rebuilds them.
 */

const cache = new Map<string, string>();

function cached(key: string, build: () => string): string {
  let url = cache.get(key);
  if (!url) {
    url = `url("data:image/svg+xml,${encodeURIComponent(build())}")`;
    cache.set(key, url);
  }
  return url;
}

/** A small seeded random source, so the patterns are the same on every run. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (value: number) => Math.round(value * 10) / 10;

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${body}</svg>`;

/** The whole box as a filter region, in user units, so the noise scales with the record. */
const region = `filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200" color-interpolation-filters="sRGB"`;

/**
 * Marble: smoke of a second colour swirled through the vinyl, like a colour-in-colour pressing. A soft,
 * large noise decides where the smoke gathers; inside it, fine ridged noise pulled into wisps by a third noise
 * draws the strands, over a faint haze of the same ink.
 */
export function marbleTexture(ink: string): string {
  return cached(`marble|${ink}`, () =>
    svg(
      `<filter id="m" ${region}>` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="2" seed="3" result="cloudNoise"/>` +
        `<feColorMatrix in="cloudNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 0 0 0 -0.98" result="cloud"/>` +
        `<feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="4" seed="5" result="ridges"/>` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="9" result="warp"/>` +
        `<feDisplacementMap in="ridges" in2="warp" scale="40" xChannelSelector="R" yChannelSelector="G" result="wisps"/>` +
        `<feColorMatrix in="wisps" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -5 0 0 0 1.6" result="strands"/>` +
        `<feComposite in="strands" in2="cloud" operator="arithmetic" k1="1" result="smokeRaw"/>` +
        `<feGaussianBlur in="smokeRaw" stdDeviation="0.35" result="smoke"/>` +
        `<feGaussianBlur in="cloud" stdDeviation="6" result="hazeRaw"/>` +
        `<feComponentTransfer in="hazeRaw" result="haze"><feFuncA type="linear" slope="0.3"/></feComponentTransfer>` +
        `<feMerge result="all"><feMergeNode in="haze"/><feMergeNode in="smoke"/></feMerge>` +
        `<feFlood style="flood-color:${ink}"/>` +
        `<feComposite in2="all" operator="in"/>` +
        `</filter>` +
        `<rect width="200" height="200" filter="url(#m)"/>`,
    ),
  );
}

/**
 * Splatter: ink flung outward from the centre as the record was pressed, so each mark is a drop with a tail
 * pointing back at the label, longer and thinner towards the edge, with loose specks in between. A little
 * noise roughens the edges so they read as ink, not vector shapes.
 */
export function splatterTexture(ink: string): string {
  return cached(`splatter|${ink}`, () => {
    const random = seeded(23);
    const marks: string[] = [];
    // Streaks: a fine tail at the inside, a slim drop-shaped head at the outside.
    for (let index = 0; index < 52; index += 1) {
      const angle = (index / 52) * 360 + (random() - 0.5) * 7;
      // About two in five are long streaks that run from the label's edge most of the way to the rim.
      const long = random() < 0.4;
      const start = long ? 50.5 + random() * 5 : 51 + random() * 30;
      const length = long ? 26 + random() * 18 : 3 + random() ** 1.2 * 22;
      const head = 0.3 + random() ** 1.8 * 1.1;
      const end = Math.min(start + length, 97 - head);
      const span = end - start;
      marks.push(
        `<path transform="rotate(${r1(angle)} 100 100) translate(${r1(100 + start)} 100)" d="M0 0Q${r1(span * 0.6)} ${r1(-head * 0.2)} ${r1(span)} ${r1(-head)}A${r1(head * 1.8)} ${r1(head)} 0 1 1 ${r1(span)} ${r1(head)}Q${r1(span * 0.6)} ${r1(head * 0.2)} 0 0Z"/>`,
      );
      // Most streaks drop a speck or two further out along the same line.
      if (random() < 0.7) {
        const at = end + head + 2 + random() * 8;
        if (at < 96) {
          const size = 0.3 + random() * 0.6;
          marks.push(
            `<ellipse transform="rotate(${r1(angle + (random() - 0.5) * 3)} 100 100)" cx="${r1(100 + at)}" cy="100" rx="${r1(size * 2.2)}" ry="${r1(size * 0.75)}"/>`,
          );
        }
      }
    }
    // Loose specks, stretched along the spin.
    for (let index = 0; index < 64; index += 1) {
      const angle = random() * 360;
      const at = 51 + random() * 45;
      const size = 0.3 + random() ** 2.4 * 1.2;
      marks.push(
        `<ellipse transform="rotate(${r1(angle)} 100 100)" cx="${r1(100 + at)}" cy="100" rx="${r1(size * 2)}" ry="${r1(size * 0.75)}"/>`,
      );
    }
    return svg(
      `<filter id="s" ${region}>` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="3" result="grain"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="grain" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>` +
        `</filter>` +
        `<g filter="url(#s)" style="fill:${ink}" fill-opacity="0.92">${marks.join("")}</g>`,
    );
  });
}

/** The droplets and bubbles in a liquid record, fixed so every liquid record is poured the same. */
const liquidBits = (() => {
  const random = seeded(41);
  const holes: string[] = [];
  const drops: string[] = [];
  // Clear bubbles inside the colour.
  for (let index = 0; index < 16; index += 1) {
    const angle = random() * Math.PI * 2;
    const at = 54 + random() * 40;
    const size = 0.8 + random() ** 2 * 3.2;
    holes.push(`<circle cx="${r1(100 + Math.cos(angle) * at)}" cy="${r1(100 + Math.sin(angle) * at)}" r="${r1(size)}"/>`);
  }
  // Droplets of colour out in the clear.
  for (let index = 0; index < 22; index += 1) {
    const angle = random() * Math.PI * 2;
    const at = 52 + random() * 44;
    const size = 0.6 + random() ** 2 * 2.6;
    drops.push(`<circle cx="${r1(100 + Math.cos(angle) * at)}" cy="${r1(100 + Math.sin(angle) * at)}" r="${r1(size)}"/>`);
  }
  return `<g fill="#f00">${drops.join("")}</g><g fill="#00f">${holes.join("")}</g>`;
})();

/**
 * Liquid: clear vinyl with a pool of colour poured through it, like a "liquid-filled" pressing. The colour
 * is a thresholded noise (smooth, rounded pools with clear pockets), with loose droplets of colour and
 * bubbles of clear, a little deeper in the middle of each pool and glossy along its edges.
 *
 * The pool's noise is bent by a second "current" noise. The record on the turntable moves that current
 * (`#<id>-flow`, an feOffset) and its strength (`#<id>-warp`, an feDisplacementMap) while it turns, so the
 * colour flows and changes shape; the swatches use it at rest. (Only these two change per frame: they reuse
 * the noise Chromium has already drawn, where changing the noise itself would redraw it every frame.)
 * Returns the SVG's inner markup.
 */
export function liquidMarkup(color: string, id: string): string {
  return (
    // Drawn with the record's centre at 0,0, over a region wider than the record, so the moving current never
    // runs out of noise at the edge.
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="-140" y="-140" width="280" height="280" color-interpolation-filters="sRGB">` +
    // The droplets are drawn red and the bubbles blue, so the filter can tell them apart: droplets join the
    // pool, bubbles cut it.
    `<feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="21" result="noise"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="6" result="current"/>` +
    `<feOffset id="${id}-flow" in="current" dx="0" dy="0" result="drift"/>` +
    `<feDisplacementMap id="${id}-warp" in="noise" in2="drift" scale="14" xChannelSelector="R" yChannelSelector="G" result="flowing"/>` +
    `<feColorMatrix in="flowing" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="level"/>` +
    `<feComponentTransfer in="level" result="pool"><feFuncA type="linear" slope="70" intercept="-29.6"/></feComponentTransfer>` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="drops"/>` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="holes"/>` +
    `<feMerge result="shape"><feMergeNode in="pool"/><feMergeNode in="drops"/></feMerge>` +
    `<feComposite in="shape" in2="holes" operator="out" result="liquid"/>` +
    // Colour, a little deeper where the pool is thick (its middle). The record blends it onto what is behind
    // it like coloured glass (LiquidPour), so it is painted solid here.
    `<feGaussianBlur in="liquid" stdDeviation="5" result="depth"/>` +
    `<feFlood style="flood-color:${color}" result="paint"/>` +
    `<feComposite in="paint" in2="liquid" operator="in" result="body"/>` +
    `<feFlood flood-color="#000" flood-opacity="0.16"/>` +
    `<feComposite in2="depth" operator="in"/>` +
    `<feComposite in2="liquid" operator="in" result="shade"/>` +
    // Gloss: a thin, faint glint where the pool's surface curves at its edge, lit from the upper left (a
    // tight highlight, kept faint: a real meniscus only catches a sliver of light).
    `<feGaussianBlur in="liquid" stdDeviation="0.7" result="bump"/>` +
    `<feSpecularLighting in="bump" surfaceScale="2.5" specularConstant="0.9" specularExponent="50" lighting-color="#fff" result="light"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>` +
    `<feComposite in="light" in2="liquid" operator="in" result="glint"/>` +
    `<feComponentTransfer in="glint" result="gloss"><feFuncA type="linear" slope="0.8"/></feComponentTransfer>` +
    `<feMerge><feMergeNode in="body"/><feMergeNode in="shade"/><feMergeNode in="gloss"/></feMerge>` +
    `</filter>` +
    `<g transform="translate(100 100)" filter="url(#${id})"><g transform="translate(-100 -100)">${liquidBits}</g></g>`
  );
}

/** The liquid finish at rest, as a background image (the swatches). */
export function liquidTexture(color: string): string {
  return cached(`liquid|${color}`, () => svg(liquidMarkup(color, "l")));
}
