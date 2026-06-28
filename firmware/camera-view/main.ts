/*
 * Camera preview for M5Stack CoreS3 (GC0308).
 *
 * Captures raw frames from the on-board camera and draws them straight to the
 * ili9341 display with Commodetto Poco (low-level 2D, no Piu scene graph).
 * No network, no host, no JPEG: the GC0308 has no hardware JPEG and Moddable
 * ships no software JPEG encoder, so this stays on raw RGB565 frames.
 *
 * This file is the XS/SDK glue (drivers + globals + side effects). The frame
 * lifecycle is in ./frame, kept SDK-free so it can be unit-tested under deno test.
 * Camera read pattern follows the Moddable SDK docs for
 * "embedded:io/image/in/camera" (modules/io/imagein/camera).
 */

import Poco from "commodetto/Poco";
import Bitmap from "commodetto/Bitmap";
import Camera from "embedded:io/image/in/camera";
import { type Frame, renderFrame } from "./frame";

// `screen` (the display) is a global set up by Commodetto's device startup.
const render = new Poco(screen, { pixels: screen.width * 16 });

// Match the display pixel format (RGB565LE on CoreS3) so frames need no conversion.
const makeBitmap = (width: number, height: number, imageType: number, frame: Frame) =>
	new Bitmap(width, height, imageType, frame as unknown as ByteBuffer, 0);

const camera = new Camera({
	width: screen.width,
	height: screen.height,
	imageType: screen.pixelFormat,
	// read() returns an internal frame buffer that must be closed after use.
	format: "buffer/disposable",
	onReadable() {
		if (!renderFrame(camera, render, makeBitmap)) {
			trace("camera: no frame\n");
		}
	}
});

trace(`camera: ${camera.width} x ${camera.height}\n`);
camera.start();
