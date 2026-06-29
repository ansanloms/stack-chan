/*
 * face: スタックチャンの顔を画面に表示するアプリ。
 *
 * このファイルは XS / Moddable SDK のグルー。ディスプレイ (Poco) とタイマ (Timer) を
 * 掴み、顔のレイアウト計算 (./face) に経過時間を渡して、返ってきた矩形を描くだけ。
 * 計算ロジックは face.ts に分離してあり、そちらは SDK 非依存で `deno test` で検証する。
 *
 * camera-view と違いカメラに依存しないので、実機 (CoreS3) だけでなくシミュレータ
 * (mcconfig -p sim/m5stack) でもそのまま動く。
 */

// Commodetto Poco = 低レベル 2D 描画エンジン。矩形を画面へ転送する。
// commodetto/* は Moddable の仮想モジュールで型は @moddable/typings の .d.ts に
// 解決される。拡張子を書けないため no-sloppy-imports は不可避。行単位で ignore する。
// deno-lint-ignore no-sloppy-imports
import Poco from "commodetto/Poco";

// Timer = XS の周期タイマ。Timer.repeat(コールバック, 間隔ms) でアニメを回す。
import Timer from "timer";

// 顔のレイアウト計算 (純ロジック)。拡張子なし specifier を mcconfig が要求するため
// ここでも no-sloppy-imports を ignore する。
// deno-lint-ignore no-sloppy-imports
import { computeFace, type FaceLayout } from "./face";

// `screen` はグローバル。manifest が include する Commodetto のデバイスセットアップが
// CoreS3 の ili9341 ディスプレイ (シミュレータでは skin の画面) を `screen` として用意する。
// Poco を画面に紐付けて描画器を作る (pixels 未指定で既定のバンドバッファを使う)。
const render = new Poco(screen);

// 色を作る。スタックチャンの顔は黒背景に白いパーツ。
const black = render.makeColor(0, 0, 0);
const white = render.makeColor(255, 255, 255);

// アニメーションのフレームレート。20fps 程度で十分滑らかに見える。
const FPS = 20;
const INTERVAL_MS = Math.round(1000 / FPS);

// 経過時間 (ms)。毎フレーム INTERVAL_MS ずつ加算して face.ts に渡す。
// 実時間ではなくフレーム数ベースだが、まばたき・呼吸の見た目には十分。
let elapsed = 0;

/** 顔のレイアウトを 1 フレーム描画する。黒で全消し → 白でパーツを塗る。 */
function draw(layout: FaceLayout): void {
	// begin() は引数なしで画面全体を更新対象にする。
	render.begin();
	render.fillRectangle(black, 0, 0, screen.width, screen.height);
	for (const r of [layout.leftEye, layout.rightEye, layout.mouth]) {
		render.fillRectangle(white, r.x, r.y, r.w, r.h);
	}
	// end() で描いた内容をディスプレイへ転送する。
	render.end();
}

// 起動時に 1 フレーム描いてすぐ顔を出す。
draw(computeFace(screen.width, screen.height, elapsed));

// 以降は一定間隔で経過時間を進めて描き直す。
Timer.repeat(() => {
	elapsed += INTERVAL_MS;
	draw(computeFace(screen.width, screen.height, elapsed));
}, INTERVAL_MS);

trace(`face: ${screen.width} x ${screen.height}\n`);
