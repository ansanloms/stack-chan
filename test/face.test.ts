/*
 * Unit tests for the firmware face-layout logic.
 *
 * Like frame.test.ts, these live outside firmware/ because firmware/face is
 * scoped to the XS environment (its own deno.json: no Deno globals, no @std).
 * `face.ts` is SDK-free, so the host/Deno test imports it directly and checks
 * the pure geometry/animation math for given screen sizes and elapsed times.
 */

import { assert, assertEquals } from "jsr:@std/assert@^1";
import { computeFace, type Rect } from "../firmware/face/face.ts";

const W = 320;
const H = 240;

/** A rect is inside the screen bounds. */
function within(r: Rect, w: number, h: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
}

/** Horizontal center of a rect. */
function centerX(r: Rect): number {
  return r.x + r.w / 2;
}

Deno.test("eyes are horizontally symmetric about the screen center", () => {
  const f = computeFace(W, H, 0);
  // left/right eye centers are mirror images about W/2 (allow 1px rounding).
  const mirrored = W - centerX(f.leftEye);
  assert(Math.abs(centerX(f.rightEye) - mirrored) <= 1);
  // same size eyes
  assertEquals(f.leftEye.w, f.rightEye.w);
  assertEquals(f.leftEye.h, f.rightEye.h);
});

Deno.test("all face parts stay within screen bounds across a time sweep", () => {
  for (let t = 0; t <= 8000; t += 37) {
    const f = computeFace(W, H, t);
    assert(within(f.leftEye, W, H), `leftEye out of bounds at t=${t}`);
    assert(within(f.rightEye, W, H), `rightEye out of bounds at t=${t}`);
    assert(within(f.mouth, W, H), `mouth out of bounds at t=${t}`);
  }
});

Deno.test("eyes are fully open between blinks and nearly closed mid-blink", () => {
  // t well outside the blink window (blink lasts 160ms each 3500ms): fully open.
  const open = computeFace(W, H, 1000);
  const eyeSize = Math.round(W * 0.16);
  assertEquals(open.leftEye.h, eyeSize);

  // mid-blink (about half of the 160ms window): eye height collapses to a line.
  const blink = computeFace(W, H, 80);
  assert(
    blink.leftEye.h <= Math.round(eyeSize * 0.3),
    `expected thin eye mid-blink, got h=${blink.leftEye.h}`,
  );
  // even when closed, a minimum height is kept so the eye never vanishes.
  assert(blink.leftEye.h >= 2);
});

Deno.test("mouth height stays within its closed/open range over time", () => {
  const min = Math.round(H * 0.03);
  const max = Math.round(H * 0.16);
  for (let t = 0; t <= 4000; t += 23) {
    const f = computeFace(W, H, t);
    assert(
      f.mouth.h >= min && f.mouth.h <= max,
      `mouth height ${f.mouth.h} out of [${min}, ${max}] at t=${t}`,
    );
  }
});

Deno.test("computeFace is deterministic for the same inputs", () => {
  assertEquals(computeFace(W, H, 1234), computeFace(W, H, 1234));
});
