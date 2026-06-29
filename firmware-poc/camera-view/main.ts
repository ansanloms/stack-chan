/*
 * camera-view: M5Stack CoreS3 のカメラ映像を画面に表示するだけのアプリ。
 *
 * このファイルは「XS / Moddable SDK のグルー (接着剤)」。実機の各ハードウェア
 * (ディスプレイ・カメラ) を Moddable のモジュールで掴み、フレーム処理の純ロジック
 * (./frame) に渡すだけ。ロジック本体を frame.ts に分離してあるのは、そちらを SDK 非依存
 * にして `deno test` で検証できるようにするため (frame.ts 冒頭の説明を参照)。
 *
 * --- Moddable 初見向けメモ ---
 * - import 先の "commodetto/Poco" 等は Moddable の「仮想モジュール」。npm/Deno の
 *   パッケージではなく、ビルドツール mcconfig が manifest.json 経由で実体 (XS 用の
 *   JS / native) に解決する。実行環境はブラウザでも Node でもなく XS エンジン。
 * - device(XS) のグローバルや API は Web/Deno とは別物。ここで使う `screen` や
 *   `trace` も XS 側のグローバル。
 */

// Commodetto = Moddable の軽量グラフィックスライブラリ。
//   Poco   : 低レベル 2D 描画エンジン (矩形やビットマップを画面へ転送する)。
//   Bitmap : ピクセルデータ (フレームバッファ) を「画像」として扱うラッパ。
// commodetto/* は Moddable の仮想モジュールで、型は @moddable/typings の .d.ts に
// 解決される (deno.json の sloppy-imports + prefix マップ経由)。拡張子を書けないため
// no-sloppy-imports は不可避。意図的なので行単位で ignore する。
// deno-lint-ignore no-sloppy-imports
import Poco from "commodetto/Poco";
// deno-lint-ignore no-sloppy-imports
import Bitmap from "commodetto/Bitmap";

// カメラドライバ (TC53 IO スタイル)。Moddable SDK 同梱だが型定義 (.d.ts) は
// 付属しないので、型は types/embedded-io-image-in-camera.d.ts で自前定義している。
import Camera from "embedded:io/image/in/camera";

// フレーム処理の純ロジック。SDK 非依存にしてあるので main から依存を注入して使う。
// mcconfig は拡張子なしの specifier を要求するため "./frame" とし、no-sloppy-imports
// はここでも ignore する。
// deno-lint-ignore no-sloppy-imports
import { type Frame, renderFrame } from "./frame";

// `screen` はグローバル。manifest が include する Commodetto のデバイスセットアップ
// (esp32 用 setup/commodetto) が、CoreS3 の ili9341 ディスプレイを表す PixelsOut を
// `screen` として用意してくれる。screen.width/height は画面解像度 (CoreS3 は 320x240)、
// screen.pixelFormat は画面のピクセル形式 (CoreS3 は RGB565LE)。

// Poco を画面に紐付けて描画器を作る。
// Poco は画面全体のバッファを持たず、`pixels` で指定した小さな作業バッファ
// (ここでは「画面横幅 x 16 行」分) に少しずつ描いてはディスプレイへ転送する
// (バンドレンダリング)。少ない RAM で全画面描画するための仕組み。
const render = new Poco(screen, { pixels: screen.width * 16 });

// カメラの生フレーム (バッファ) を Bitmap として包む小さなヘルパ。
// Bitmap(幅, 高さ, ピクセル形式, バッファ, オフセット) で「このバッファは
// この形式の画像」と Poco に教える。frame は frame.ts 上は最小の Frame 型
// (close() を持つだけ) だが、実体は描画可能なバッファなので ByteBuffer へキャストする。
const makeBitmap = (width: number, height: number, imageType: number, frame: Frame) =>
	new Bitmap(width, height, imageType, frame as unknown as ByteBuffer, 0);

// カメラを初期化する。
const camera = new Camera({
	// 取得したいフレームの解像度。画面と同じにして全画面表示する
	// (ドライバが別解像度しか許さない場合は camera.width/height が実際の値になる)。
	width: screen.width,
	height: screen.height,
	// フレームのピクセル形式を画面と一致させると、変換なしでそのまま描ける。
	// CoreS3 のカメラ GC0308 はハードウェア JPEG 非対応なので生フレーム (RGB565) を扱う。
	imageType: screen.pixelFormat,
	// "buffer/disposable": read() がドライバ内部のバッファを返す方式。コピーを避ける
	// 代わりに、使い終わったら frame.close() で必ず解放する必要がある (frame.ts で実施)。
	format: "buffer/disposable",
	// 新しいフレームが用意できるたびに呼ばれるコールバック。
	// 実際の「読む→描く→解放する」は renderFrame に委譲する。
	onReadable() {
		// renderFrame は描画できれば true、フレームが無ければ false を返す。
		if (!renderFrame(camera, render, makeBitmap)) {
			// trace() は XS のデバッグ出力 (console.log 相当)。xsbug やシリアルに出る。
			trace("camera: no frame\n");
		}
	},
});

// 実際に確保された解像度をログに出して確認できるようにする。
trace(`camera: ${camera.width} x ${camera.height}\n`);

// キャプチャ開始。以降フレームが届くたび onReadable が呼ばれる。
camera.start();
