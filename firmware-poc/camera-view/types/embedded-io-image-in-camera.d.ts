/*
 * カメラドライバ "embedded:io/image/in/camera" の型定義 (自前)。
 *
 * このモジュールは Moddable SDK 本体に実装がある (modules/io/imagein/camera) が、
 * 他の embedded:io モジュールと違い @moddable/typings に型 (.d.ts) が付属しない。
 * そのため型検査が通るよう、このアプリで使う範囲だけをここで宣言している。
 * 参照実装: modules/io/imagein/camera/esp32/camera.c
 *
 * このファイルは firmware/camera-view/deno.json の imports で
 *   "embedded:io/image/in/camera" -> このファイル
 * に明示マップしている (型のみの shim なので実行時の実体は SDK 側)。
 */
declare module "embedded:io/image/in/camera" {
	/**
	 * 取得した 1 フレーム。中身は描画に使えるバイトバッファ (ByteBuffer) で、
	 * かつ close() を持つ。"buffer/disposable" モードでは使用後に close() で解放する。
	 */
	export type CameraFrame = ByteBuffer & { close(): void };

	/** Camera コンストラクタに渡す設定。 */
	export interface CameraOptions {
		/** 取得したいフレーム幅。ドライバが別値しか許さない場合は Camera.width が実値。 */
		width: number;
		/** 取得したいフレーム高さ。同上 (Camera.height が実値)。 */
		height: number;
		/**
		 * ピクセル形式。Commodetto の形式定数 (例: screen.pixelFormat)、または
		 * "jpeg" でハードウェア JPEG を要求する (GC0308 等は非対応)。
		 */
		imageType: number | "jpeg";
		/**
		 * フレームの受け渡し方式。
		 * - "buffer": 呼び出し側のバッファを再利用する。
		 * - "buffer/disposable": ドライバ内部のバッファを返す (コピー回避。要 close())。
		 */
		format: "buffer" | "buffer/disposable";
		/** 新しいフレームが読めるようになったら呼ばれる。 */
		onReadable?: () => void;
	}

	/** カメラドライバ本体。 */
	export default class Camera {
		constructor(options: CameraOptions);
		/** 次のフレームを読む。"buffer/disposable" では取得した CameraFrame を返す (無ければ undefined)。 */
		read(buffer?: ByteBuffer): CameraFrame | undefined;
		/** キャプチャを開始する。 */
		start(): void;
		/** キャプチャを停止する。 */
		stop(): void;
		/** ドライバを閉じる。 */
		close(): void;
		/** 実際に確保されたフレーム幅 (px)。 */
		readonly width: number;
		/** 実際に確保されたフレーム高さ (px)。 */
		readonly height: number;
		/** フレームのピクセル形式 (Commodetto の形式定数)。 */
		readonly imageType: number;
		/** 現在の受け渡し方式 ("buffer" / "buffer/disposable")。 */
		readonly format: string;
	}
}
