# WorkOut

自宅での自重トレーニングと食事（PFC）を、できるだけ少ないタップで記録するための個人用 PWA。

## 設計方針

- **記録の摩擦を極限まで減らす**: 前回の記録がプリセット済みで ✓ を押すだけ、保存ボタンなし（自動保存）、ワンタップ食事記録
- **自宅・自重が前提**: 回数 or 秒数だけ記録。加重は種目ごとに任意でオン
- **端末内で完結**: データは IndexedDB（Dexie）に保存。サーバー・ログイン不要。JSON でバックアップ
- **AI はおまけ**: 写真や文章からの PFC 推定と目標値の相談に Claude / ChatGPT / Gemini を切り替えて使える。API キー未設定なら非表示

## 機能

| 画面 | 内容 |
| --- | --- |
| ホーム | 体重の ± 入力、今日のワークアウト、食事の残りカロリー/PFC、よく食べるもの |
| トレ | 「前回と同じで開始」/ 種目を選んで開始、セッション画面（✓ で完了 → 休憩タイマー自動開始）、履歴 |
| 食事 | リング/バーの目標比較、ワンタップ記録、ざっくり記録、AI 推定（写真 / 「牛丼の並とサラダ」のように食べたものを文章で伝える / 商品の栄養成分表示・原材料名を撮って登録）、食事セット、前日コピー |
| 記録 | 体重推移（7日平均）、継続カレンダー、種目ごとの最大/合計回数の推移 |
| 設定 | プロフィールから目標を自動計算（Mifflin-St Jeor）/ AI に相談、休憩タイマー、AI プロバイダ、バックアップ |

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ に PWA 込みで出力
npm run lint
npm run e2e        # 開発サーバー(5199)に対してスマホ相当の自動操作とスクリーンショット
npm run pwa:check  # vite preview(4173) に対して Service Worker / マニフェストの登録確認
npm run update:check  # 新バージョン検知 → 更新バナー → 再読み込みの流れを確認（preview 起動中に実行）
npm run migration:check  # v1 の IndexedDB を用意して v2 マイグレーション（種目の order 付与）を確認
```

`npm run e2e` などのスクリプトは `puppeteer-core` でローカルの Chrome を使います。パスが違う場合は `CHROME_PATH` で指定してください。E2E は `npm run dev:e2e` で 5199 番ポートの開発サーバーを立ててから実行します。

## 技術

React 19 / Vite 8 / TypeScript / Dexie / react-router (HashRouter) / vite-plugin-pwa / lucide-react / zod

AI 連携はブラウザから各社 API を直接呼びます（Claude は `@anthropic-ai/sdk` の `dangerouslyAllowBrowser`、OpenAI と Gemini は `fetch`）。キーは端末の IndexedDB にのみ保存し、バックアップにも含めません。

## バージョン管理

`package.json` の `version` が唯一の正。`major.minor.patch` で、**満足のいく出来になるまで major は 0（ベータ）**。設定画面の最下部に `v0.1.0 β` が出る。

| 上げる桁 | いつ | コマンド |
| --- | --- | --- |
| patch | バグ修正・微調整 | `npm run release:patch` |
| minor | 機能追加 | `npm run release:minor` |
| major | ベータ卒業や大きな作り直し（当面は使わない） | `npm run release:major` |

コマンドは version を書き換えたコミットと `vX.Y.Z` タグを作る（作業ツリーがクリーンな状態で実行）。その後 `git push --follow-tags` すると、main のデプロイに加えてタグから GitHub Release が自動生成される（`.github/workflows/release.yml`）。

## デプロイ / CI

- `main` に push すると GitHub Actions（`.github/workflows/ci-deploy.yml`）が 型チェック → lint → ビルド → E2E → PWA 確認 を実行し、通れば GitHub Pages に自動デプロイします
- 公開 URL: https://hirag-62.github.io/WorkOut-App/
- PR でも同じチェックが走ります（デプロイはしない）。E2E のスクリーンショットは Actions の Artifacts（`e2e-shots`）から見られます
- 手動で再デプロイしたいときは Actions の「CI / Deploy」→ Run workflow

`vite.config.ts` の `base` は `./` なので、サブパス配下でもそのまま動きます。PWA のカメラ利用には HTTPS が必要です（GitHub Pages は HTTPS）。

### スマホで使う

1. iPhone は Safari、Android は Chrome で上の URL を開く
2. 「ホーム画面に追加」でアプリとして起動できる（全画面・オフライン対応）
3. AI 機能を使う場合は 設定 → AI で API キーを入力（端末内にのみ保存）
4. 新しいバージョンが公開されると、アプリを開いた/復帰したときに上部に「新しいバージョンがあります」バナーが出る。「更新」で反映。設定画面の最下部で現在のバージョンを確認できる
