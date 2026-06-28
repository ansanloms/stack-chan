/*
 * Frame-handling logic, kept free of any Moddable/XS imports and globals so it
 * can be unit-tested under `deno test`. The SDK objects (camera, renderer,
 * bitmap factory) are injected by main.ts; here they are only structural
 * interfaces.
 */

/** A captured frame that must be released after use. */
export interface Frame {
	close(): void;
}

/** Minimal view of the camera driver needed to render a frame. */
export interface FrameSource {
	read(): Frame | undefined;
	readonly width: number;
	readonly height: number;
	readonly imageType: number;
}

/** Minimal view of the Poco renderer. */
export interface Renderer {
	begin(): void;
	drawBitmap(bitmap: unknown, x: number, y: number): void;
	end(): void;
}

/** Wraps a frame buffer as a drawable bitmap. */
export type BitmapFactory = (
	width: number,
	height: number,
	imageType: number,
	frame: Frame,
) => unknown;

/**
 * Read one frame and draw it full-screen, then release it.
 * Returns false when no frame was available (nothing is drawn).
 *
 * The frame is always closed after drawing to avoid leaking buffers, and the
 * draw is bracketed by begin()/end().
 */
export function renderFrame(
	camera: FrameSource,
	render: Renderer,
	makeBitmap: BitmapFactory,
): boolean {
	const frame = camera.read();
	if (!frame) {
		return false;
	}

	const bitmap = makeBitmap(camera.width, camera.height, camera.imageType, frame);
	render.begin();
	render.drawBitmap(bitmap, 0, 0);
	render.end();

	frame.close();
	return true;
}
