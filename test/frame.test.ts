/*
 * Unit tests for the firmware frame-handling logic.
 *
 * These live outside firmware/ because firmware/camera-view is scoped to the XS
 * environment (its own deno.json: no Deno globals, no @std). Deno tests run in
 * the host/Deno environment and import the SDK-free `frame.ts` directly,
 * injecting fakes for the camera, renderer and bitmap factory.
 */

import { assert, assertEquals } from "jsr:@std/assert@^1";
import {
  type Frame,
  type FrameSource,
  type Renderer,
  renderFrame,
} from "../firmware/camera-view/frame.ts";

Deno.test("renderFrame draws full-screen then closes the frame, in order", () => {
  const calls: string[] = [];
  let closed = false;
  const frame: Frame = {
    close() {
      closed = true;
      calls.push("close");
    },
  };
  const camera: FrameSource = {
    read: () => frame,
    width: 320,
    height: 240,
    imageType: 7,
  };
  const render: Renderer = {
    begin: () => calls.push("begin"),
    drawBitmap: (_bitmap, x, y) => calls.push(`draw(${x},${y})`),
    end: () => calls.push("end"),
  };
  let madeWith: unknown[] | null = null;
  const makeBitmap = (w: number, h: number, t: number, f: Frame) => {
    madeWith = [w, h, t, f];
    return { tag: "bitmap" };
  };

  const ok = renderFrame(camera, render, makeBitmap);

  assert(ok);
  // begin -> draw at origin -> end -> close (frame always released after draw)
  assertEquals(calls, ["begin", "draw(0,0)", "end", "close"]);
  assertEquals(madeWith, [320, 240, 7, frame]);
  assert(closed);
});

Deno.test("renderFrame returns false and draws nothing when no frame is available", () => {
  const calls: string[] = [];
  const camera: FrameSource = {
    read: () => undefined,
    width: 1,
    height: 1,
    imageType: 0,
  };
  const render: Renderer = {
    begin: () => calls.push("begin"),
    drawBitmap: () => calls.push("draw"),
    end: () => calls.push("end"),
  };
  let made = false;
  const makeBitmap = () => {
    made = true;
    return {};
  };

  const ok = renderFrame(camera, render, makeBitmap);

  assertEquals(ok, false);
  assertEquals(calls, []);
  assertEquals(made, false);
});
