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

## 前提

- [Deno](https://deno.com/)。
- device をビルドするなら [Moddable SDK](https://www.moddable.com/) (環境変数 `MODDABLE` 設定済み) と ESP32-S3 向け ESP-IDF ツールチェーン。Moddable の ESP32 ビルドは内部で ESP-IDF を使う。

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

## WSL での実機ビルド・書き込み

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
- esp32 / esp32-s3 ビルドには ESP-IDF と Xtensa ツールチェーンのセットアップ
  (`IDF_PATH` 設定 + `. $IDF_PATH/export.sh`) が必要。未設定だと
  `### Error: $IDF_PATH not set` になる。
- ビルド・書き込みは WSL のログインシェルで行う (`MODDABLE` / ESP-IDF の環境変数が読み込まれた
  状態であること)。

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
