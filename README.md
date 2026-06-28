# stack-chan

M5Stack CoreS3 で動かすｽﾀｯｸﾁｬﾝのファームウェア。C ではなく JavaScript /TypeScript で書き、[Moddable SDK](https://www.moddable.com/) (XS エンジン) でビルドする。

ホスト側のツール・サービスは [Deno](https://deno.com/) で書く。

## アーキテクチャ

2 つの実行環境が同居する。

device(XS) と host(Deno) はグローバル環境も解決規則も別物なので、ツール設定 (型検査・lint・テスト) を明確に分けている。

### device (`firmware/`)

M5Stack CoreS3 上の XS エンジンで動く。Moddable SDK のモジュール (`commodetto/*`, `piu/*`, `embedded:io/*` 等) を使い、`mcconfig` でビルドして実機に焼く。Deno / Node では動かない。SDK の仮想モジュールは型のみの `.d.ts` として提供され、実体は XS / native 実装。

### host

開発マシンや raspi で動く Deno コード。ビルド / 型検査 / テストのタスク、将来的には画像エンコードや LLM プロキシ等で device と通信する。

## リポジトリ構成

```
firmware/<app>/   Moddable / XS アプリ (device に焼く)。各 app が自分の deno.json を持つ
test/             firmware の純ロジックに対する Deno テスト
deno.json         ルート。host 環境の設定 + タスク (firmware は exclude)
```

現在の app:

- `firmware/camera-view/` — カメラ映像を画面表示する最小アプリ。詳細は
  [firmware/camera-view/README.md](firmware/camera-view/README.md)。
- `firmware/face/` — スタックチャンの顔 (黒背景に白い目と口) を表示するアプリ。
  まばたき・口の開閉・呼吸のアニメーション付き。カメラに依存しないので実機だけでなく
  シミュレータ (`mcconfig -p sim/m5stack`) でもそのまま動く。

## 前提

- [Deno](https://deno.com/)。
- device をビルドするなら以下も必要。
  - [Moddable SDK](https://www.moddable.com/) のコマンドラインツール (`mcconfig` 等) が PATH にあること。`.ts` を含むアプリは `mcconfig` が `tsc` を呼ぶため TypeScript も要る。
  - **ESP-IDF v6.0** (Moddable SDK 8.2.3 が要求するバージョン)。Espressif 公式手順で導入する (下記「ESP-IDF v6.0 のセットアップ」)。

## タスク

ルートの `deno.json` に定義。app ごとのタスクは `<verb>:<app>`、`deno task build` / `deno task check` は `:*` で全 app に展開する。

```sh
deno install                  # 型定義 (@moddable/typings) をルート node_modules へ
deno task build               # 全 firmware app をビルド・書き込み (mcconfig)
deno task build:camera-view   # 個別
deno task check               # 全 firmware app の型検査
deno task check:camera-view   # 個別
deno test                     # firmware 純ロジックのテスト
deno task lint                # deno lint + fmt --check
deno task fix                 # deno lint --fix + fmt
```

## ESP-IDF v6.0 のセットアップ

Moddable SDK 8.2.3 は ESP-IDF v6.0 を要求する。Espressif の公式手順で導入する (nix の `nixpkgs-esp-dev` は既定が v5.5.2 で、v6.0 へ上げると esptool/kconfiglib のバージョン不整合でイメージ生成に失敗するため、公式インストールを使う)。

```sh
mkdir -p ~/esp32 && cd ~/esp32
git clone -b v6.0 --recursive https://github.com/espressif/esp-idf.git esp-idf-v6.0
cd esp-idf-v6.0 && ./install.sh esp32s3
```

ビルドするシェルで毎回、環境を読み込む。

```sh
export IDF_PATH=~/esp32/esp-idf-v6.0
. $IDF_PATH/export.sh
```

## WSL での USB シリアル接続と書き込み

開発環境が Windows + WSL2 の場合、CoreS3 の USB シリアルは既定では WSL から見えない。

[usbipd-win](https://github.com/dorssel/usbipd-win) で WSL2 にアタッチする (手順は[ビルドログ](https://ansanloms.github.io/blog/articles/20260525-stack-chan-build-log/index.html)に準拠)。

Windows に usbipd を入れる (初回のみ)。

```powershell
winget install usbipd
```

WSL のシェルから Windows 側の `usbipd.exe` を呼んでアタッチする。

```sh
usbipd.exe list                             # CoreS3 の BUSID を確認
sudo.exe usbipd.exe bind --busid <BUSID>    # 初回のみ
usbipd.exe attach --wsl --busid <BUSID>     # WSL2 にアタッチ
ls /dev/ttyACM*                             # 例: /dev/ttyACM0 (環境により /dev/ttyUSB*)
```

アタッチしたポートを `UPLOAD_PORT` で渡してビルド・書き込み。

```sh
UPLOAD_PORT=/dev/ttyACM0 deno task build:camera-view
```

`mcconfig` がビルドと書き込みを一括で行う (`UPLOAD_PORT` 未指定時は esptool が自動検出)。

### 環境メモ

- `mcconfig` は既定でビルド成果物を `$MODDABLE/build` 配下へ書く。SDK が読み取り専用
  (nix store 等) だと `### Error: Permission denied` になるため、`build:camera-view`
  タスクは `-o build` で書き込み可能な出力先を明示している。
- esp32-s3 ビルドには ESP-IDF v6.0 が必要 (上記セットアップ)。`IDF_PATH` 設定 +
  `. $IDF_PATH/export.sh` を済ませること。未設定だと `### Error: $IDF_PATH not set`、
  バージョン不一致だと `Expected ESP IDF v6.0, found ...` になる。
- `.ts` のコンパイルは `mcconfig` が `tsc` を呼ぶ。tsc が PATH に必要。Moddable は
  TypeScript の target/lib に es2025 を指定するが、安定版 tsc (5.9) は es2024 までの
  対応なので、ビルド環境側で es2024 へ寄せる必要がある (この環境では nix の
  `moddable-sdk` パッケージが tsc 同梱と es2024 化を行っている)。
- ビルド・書き込みは ESP-IDF 環境を読み込んだシェルで行う (`. export.sh` 済み)。

## シミュレータ (mcsim) / デバッガ (xsbug)

実機に焼かずに PC 上で動かす GUI シミュレータ `mcsim` と、GUI デバッガ `xsbug` が使える。両者は GTK ベースのアプリで、この環境では nix の `moddable-sdk` パッケージがまとめてビルド・PATH 提供する (`mcsim` / `xsbug` コマンド)。実行には X / Wayland の表示環境が要る (WSL2 なら WSLg)。

アプリをシミュレータでビルド・起動する。`-p` にシミュレータターゲットを渡す。

```sh
cd firmware/<app>
mcconfig -d -m -p sim/m5stack -o build
```

- ターゲットは `$MODDABLE/build/simulators/` にある skin から選ぶ (`m5stack` / `m5stickc` / `moddable_two` 等)。CoreS3 専用 skin は無いが、CoreS3 も classic M5Stack も画面は 320x240 なので `sim/m5stack` で代用する。skin は枠の見た目と画面領域を定義するだけで、CPU や周辺機器はエミュレートしない。
- `-d` (debug) でビルドすると `xsbug` が自動起動して接続する。`trace()` 出力やブレークがここに出る。
- ビルド済みアプリは `mcsim <出力先>/bin/lin/<target>/release/<app>/mc.so` で直接起動もできる (mcconfig を介さず GUI だけ立ち上げる場合)。

### WSL (WSLg) で起動する場合

WSLg 上では GTK の Wayland バックエンドだとウィンドウが画面に出ないことがある (ソケット接続は成功するが浮上しない)。X11 (Xwayland) バックエンドに固定すると確実に表示される。

```sh
GDK_BACKEND=x11 mcsim .../release/<app>/mc.so
```

`mcconfig` 経由で起動する場合も同じ環境変数を渡せばよい。

### camera-view はシミュレータでは動かない

シミュレータは XS エンジンと Piu / Commodetto の描画を PC 上で再現するが、ハードウェア固有ドライバは持たない。camera-view が使う `embedded:io/image/in/camera` (GC0308) は esp32 専用実装で、シミュレータには無い。そのため camera-view の検証は実機で行う必要がある。シミュレータと xsbug は、カメラに依存しない描画 / UI / ロジックのアプリ (例: `firmware/face`) や、将来の app を実機なしで試すために用意してある。

## TypeScript / 型

device コードも TypeScript で書く。`mcconfig` は SDK 同梱の typings で .ts を直接ビルドするので、ビルドに追加セットアップは不要。

エディタ補完と型検査には Moddable の型定義 `@moddable/typings` を使う。これはルート `deno.json` に dev 依存として宣言し(`nodeModulesDir: auto`)、`deno install` でルートの `node_modules` (gitignore 済み)に入る。

型検査は `deno check` で行う。各 firmware app は自分の `deno.json` を型検査専用設定として持つ。

- `compilerOptions.lib` を `["es2024"]` にして DOM / Deno グローバルを排除し XS 環境に寄せる。`types` で XS のアンビエント宣言 (`@moddable/typings/xs.d.ts`) を読む。
- Moddable の仮想モジュールは型のみの `.d.ts`。Deno に tsconfig の `paths` は無いが、 `"unstable": ["sloppy-imports"]` + `imports` の末尾スラッシュ付きプレフィックスマップ(例 `"commodetto/"`) で bare specifier を `.d.ts` へ解決する(推移依存も同様)。新しいSDK 名前空間を使い始めたらプレフィックスを 1 行足す。型の無いモジュールだけ exact マップでローカル `.d.ts` shim に向ける。
- ルート `deno.json` は `firmware` を `exclude` し、XS 用の設定が host コードへ漏れないようにする。エディタは各 app の `deno.json` により denols で型解決される。

## テスト

device の I/O・描画・グローバル (`screen` / `trace` 等) は Deno で実行できず、実機でしか確認できない。テスト可能にするため、環境非依存の純ロジックは SDK import を持たないモジュール (依存は引数で注入) として切り出し、`test/` に置いた Deno テストで検証する。

SDK グルーは `mcconfig` で焼いて実機で確認する。
