/*
 * 顔の描画ロジック (純ロジック)。
 *
 * camera-view の frame.ts と同じ方針で、Moddable / XS の import もグローバル
 * (screen, trace 等) も持ち込まない。画面サイズと経過時間 (ms) だけを引数で受け取り、
 * 各パーツ (左右の目・口) の矩形を計算して返す。描画 (Poco) は main.ts が担当する。
 * こうしておくと同じ計算ロジックを実機と `deno test` の両方で検証できる。
 *
 * このアプリの顔は「黒背景に白い矩形の目と口」という素朴なスタックチャン顔。
 * アニメーションは 3 つ:
 *   - まばたき: 一定周期で目の高さを潰す。
 *   - 口の開閉: 口の高さを周期的に上下させる (話している風)。
 *   - 呼吸: 顔全体をゆっくり上下に揺らす。
 * いずれも「経過時間 t(ms) から状態を決める」関数なので、t を渡せば結果が一意に
 * 決まる (テスト可能)。乱数や現在時刻は使わない。
 */

/** 描画する矩形。左上 (x, y) とサイズ (w, h)。単位は px。 */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** 1 フレーム分の顔のレイアウト。main.ts はこの矩形を白で塗るだけ。 */
export interface FaceLayout {
	leftEye: Rect;
	rightEye: Rect;
	mouth: Rect;
}

// --- アニメーションのパラメータ (時間は ms) ---

/** まばたきの周期。この間隔ごとに 1 回まばたきする。 */
const BLINK_PERIOD_MS = 3500;
/** まばたき 1 回にかける時間 (閉じ始めてから開き切るまで)。 */
const BLINK_DURATION_MS = 160;
/** まばたき最大時の目の開度 (0=完全に閉じる, 1=開いたまま)。細い線にする。 */
const BLINK_MIN_OPEN = 0.08;

/** 口の開閉周期。 */
const MOUTH_PERIOD_MS = 1400;

/** 呼吸 (顔全体の上下動) の周期。 */
const BREATH_PERIOD_MS = 4000;

// --- レイアウトの比率 (画面サイズに対する割合。320x240 を主対象に調整) ---

/** 目の一辺のサイズ (正方形)。画面幅に対する割合。 */
const EYE_SIZE_RATIO = 0.16;
/** 目の中心の縦位置。画面高さに対する割合。 */
const EYE_CENTER_Y_RATIO = 0.4;
/** 左目の中心の横位置。画面幅に対する割合 (右目は左右対称)。 */
const LEFT_EYE_CENTER_X_RATIO = 0.32;

/** 口の中心位置。画面サイズに対する割合。 */
const MOUTH_CENTER_X_RATIO = 0.5;
const MOUTH_CENTER_Y_RATIO = 0.72;
/** 口の幅。画面幅に対する割合。 */
const MOUTH_WIDTH_RATIO = 0.3;
/** 口の高さ (閉じ時 / 全開時)。画面高さに対する割合。 */
const MOUTH_MIN_HEIGHT_RATIO = 0.03;
const MOUTH_MAX_HEIGHT_RATIO = 0.16;

/** 呼吸の振幅 (上下に動く最大 px)。画面高さに対する割合。 */
const BREATH_AMPLITUDE_RATIO = 0.02;

const TWO_PI = Math.PI * 2;

/**
 * まばたきの開度を返す (0=完全に閉じる, 1=全開)。
 * 周期内のまばたき区間だけ三角波で下がり、それ以外は 1 (開いたまま)。
 */
function blinkOpenness(t: number): number {
	const phase = ((t % BLINK_PERIOD_MS) + BLINK_PERIOD_MS) % BLINK_PERIOD_MS;
	if (phase >= BLINK_DURATION_MS) {
		return 1;
	}
	// 区間内の進み具合 0..1。中央 (0.5) で最も閉じる三角波。
	const progress = phase / BLINK_DURATION_MS;
	const closeAmount = 1 - Math.abs(2 * progress - 1);
	return 1 - closeAmount * (1 - BLINK_MIN_OPEN);
}

/** 口の開き具合を返す (0=閉じ, 1=全開)。サイン波で滑らかに開閉する。 */
function mouthOpenRatio(t: number): number {
	return (Math.sin((TWO_PI * t) / MOUTH_PERIOD_MS) + 1) / 2;
}

/** 呼吸による縦方向のオフセット (px)。サイン波で上下する。 */
function breathOffset(t: number, height: number): number {
	const amplitude = Math.round(height * BREATH_AMPLITUDE_RATIO);
	return Math.round(Math.sin((TWO_PI * t) / BREATH_PERIOD_MS) * amplitude);
}

/**
 * 画面サイズ (width, height) と経過時間 t(ms) から顔のレイアウトを計算する。
 * 純関数: 同じ引数なら必ず同じ結果を返す。
 */
export function computeFace(width: number, height: number, t: number): FaceLayout {
	// 呼吸で顔全体を縦にずらす量。
	const bob = breathOffset(t, height);

	// --- 目 ---
	const eyeSize = Math.round(width * EYE_SIZE_RATIO);
	const eyeCenterY = Math.round(height * EYE_CENTER_Y_RATIO) + bob;
	const leftEyeCenterX = Math.round(width * LEFT_EYE_CENTER_X_RATIO);
	// 右目は画面中央を軸に左目と対称な位置。
	const rightEyeCenterX = width - leftEyeCenterX;

	// まばたきで目の高さを潰す。幅は一定、高さだけ開度に比例。最低 2px は残す。
	const openness = blinkOpenness(t);
	const eyeHeight = Math.max(2, Math.round(eyeSize * openness));

	const makeEye = (centerX: number): Rect => ({
		x: centerX - Math.round(eyeSize / 2),
		y: eyeCenterY - Math.round(eyeHeight / 2),
		w: eyeSize,
		h: eyeHeight,
	});

	// --- 口 ---
	const mouthWidth = Math.round(width * MOUTH_WIDTH_RATIO);
	const mouthMinHeight = Math.round(height * MOUTH_MIN_HEIGHT_RATIO);
	const mouthMaxHeight = Math.round(height * MOUTH_MAX_HEIGHT_RATIO);
	const mouthHeight = Math.round(
		mouthMinHeight + (mouthMaxHeight - mouthMinHeight) * mouthOpenRatio(t),
	);
	const mouthCenterX = Math.round(width * MOUTH_CENTER_X_RATIO);
	const mouthCenterY = Math.round(height * MOUTH_CENTER_Y_RATIO) + bob;

	const mouth: Rect = {
		x: mouthCenterX - Math.round(mouthWidth / 2),
		y: mouthCenterY - Math.round(mouthHeight / 2),
		w: mouthWidth,
		h: mouthHeight,
	};

	return {
		leftEye: makeEye(leftEyeCenterX),
		rightEye: makeEye(rightEyeCenterX),
		mouth,
	};
}
