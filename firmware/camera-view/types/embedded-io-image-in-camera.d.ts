/*
 * Local type declaration for Moddable's camera driver.
 *
 * The module "embedded:io/image/in/camera" exists in the Moddable SDK
 * (modules/io/imagein/camera) but, unlike most embedded:io modules, it ships no
 * .d.ts under @moddable/typings. This shim covers the surface used by this app.
 * Reference: modules/io/imagein/camera/esp32/camera.c
 */
declare module "embedded:io/image/in/camera" {
	/**
	 * A captured frame. It is a byte buffer (usable as the Bitmap backing store)
	 * that, in "buffer/disposable" mode, must be closed after use.
	 */
	export type CameraFrame = ByteBuffer & { close(): void };

	export interface CameraOptions {
		/** Requested frame width. The driver may grant a different size (see Camera.width). */
		width: number;
		/** Requested frame height. The driver may grant a different size (see Camera.height). */
		height: number;
		/**
		 * Commodetto pixel format constant (e.g. screen.pixelFormat), or "jpeg" to
		 * request hardware JPEG output (not supported by all sensors, e.g. GC0308).
		 */
		imageType: number | "jpeg";
		/** "buffer": reuse a caller-owned buffer. "buffer/disposable": driver owns the frame. */
		format: "buffer" | "buffer/disposable";
		/** Called when a new frame is available to read. */
		onReadable?: () => void;
	}

	export default class Camera {
		constructor(options: CameraOptions);
		/** Read the next frame. In "buffer/disposable" mode returns a frame (or undefined). */
		read(buffer?: ByteBuffer): CameraFrame | undefined;
		start(): void;
		stop(): void;
		close(): void;
		readonly width: number;
		readonly height: number;
		/** The pixel format of captured frames (Commodetto format constant). */
		readonly imageType: number;
		readonly format: string;
	}
}
