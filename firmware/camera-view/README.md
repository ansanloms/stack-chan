# camera-view

M5Stack CoreS3 のオンボードカメラ (GC0308) の映像を、本体の ili9341 ディスプレイ(320x240) にそのまま表示するだけの Moddable アプリ。ネットワーク・ホスト・サーボ・顔表示は含まない。

描画は Commodetto Poco (低レベル 2D) を直接使い、class を持たない命令型の最小構成。GC0308 の生フレーム (RGB565LE) を変換も圧縮もせず、画面のピクセル形式に合わせて Poco でblit する。カメラの読み取りは `embedded:io/image/in/camera` の API に従う。

リポジトリ共通の前提・型・テストの仕組みは [ルート README](../../README.md) を参照。

## ビルドと書き込み

CoreS3 を USB 接続して、リポジトリルートで、

```sh
deno task build:camera-view
# = cd firmware/camera-view && mcconfig -d -m -p esp32/m5stack_cores3
```

`mcconfig` がビルドと USB 書き込みまで行う。カメラドライバと GC0308 のピン定義は Moddable SDK 本体と `esp32/m5stack_cores3` ターゲットに含まれ、追加の C コードは不要。

## ファイル

- `main.ts` — XS / SDK グルー (Poco / Camera 生成、`screen` / `trace` グローバル、副作用)。
- `frame.ts` — フレーム処理の純ロジック (SDK 非依存、依存は引数注入)。`deno test` 対象。
- `types/embedded-io-image-in-camera.d.ts` — カメラの型 shim。`@moddable/typings` にカメラの型が無いため自前で用意し、`deno.json` の exact マップで使う。
- `deno.json` — この app の型検査設定 (XS 環境)。

## テスト

`frame.ts` のフレームライフサイクル (描画して必ず close する / フレーム不在時は何もしない) を `test/frame.test.ts` で検証する。

```sh
deno test
```

## 制約 (既知)

- 実機での動作確認は未実施。
- カメラ映像を外部へ送る機能は持たない。GC0308 はハードウェア JPEG 非対応で Moddable にソフト JPEG エンコーダも無いため、送信するなら生フレームをホスト (Deno) 側へ送ってそこで圧縮する構成が別途必要になる。
