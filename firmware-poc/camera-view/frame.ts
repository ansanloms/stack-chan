/*
 * フレーム処理の純ロジック。
 *
 * このファイルには Moddable / XS の import もグローバル (screen, trace 等) も一切
 * 持ち込まない。カメラ・描画器・Bitmap 生成は「引数」で受け取る (依存性の注入)。
 * こうしておくと:
 *   - 実機では main.ts が本物の Camera / Poco / Bitmap を渡す。
 *   - テストでは test/frame.test.ts が偽物 (fake) を渡す。
 * つまり同じロジックを実機と `deno test` の両方で動かせる。XS のハードウェアや
 * グローバルに依存しないので、Deno 上 (PC) で単体テストできるのがポイント。
 *
 * ここで定義する interface は「必要な部分だけ」を写した最小の型 (構造的部分型)。
 * 本物の Camera / Poco はこれらより多くのメンバを持つが、ここで要求する形さえ
 * 満たしていれば渡せる。
 */

/** 1 枚のフレーム。使い終わったら close() で解放する (バッファのリーク防止)。 */
export interface Frame {
	close(): void;
}

/** フレームを供給する側 (カメラドライバ) の、ここで使う部分だけの形。 */
export interface FrameSource {
	/** 次のフレームを読む。無ければ undefined。 */
	read(): Frame | undefined;
	/** フレームの幅 (px)。 */
	readonly width: number;
	/** フレームの高さ (px)。 */
	readonly height: number;
	/** フレームのピクセル形式 (Commodetto の形式定数)。Bitmap 生成に渡す。 */
	readonly imageType: number;
}

/** 描画器 (Poco) の、ここで使う部分だけの形。 */
export interface Renderer {
	/** 1 フレーム分の描画を開始する。 */
	begin(): void;
	/** ビットマップを座標 (x, y) に描く。 */
	drawBitmap(bitmap: unknown, x: number, y: number): void;
	/** 描画を確定し、画面へ転送する。 */
	end(): void;
}

/** フレームバッファを描画可能な Bitmap に変換する関数。 */
export type BitmapFactory = (
	width: number,
	height: number,
	imageType: number,
	frame: Frame,
) => unknown;

/**
 * フレームを 1 枚読み、全画面に描画してから解放する。
 * フレームが無ければ false を返す (何も描かない)。
 *
 * 処理順:
 *   1. camera.read() でフレーム取得。無ければ false。
 *   2. makeBitmap でフレームを Bitmap 化。
 *   3. render.begin() -> drawBitmap(原点 0,0) -> render.end() で全画面描画。
 *   4. frame.close() で必ず解放 (描画後に毎回。怠るとバッファが枯渇する)。
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
