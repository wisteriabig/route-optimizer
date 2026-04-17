# 🚶 徒歩巡回ルート最適化アプリ

Google Maps API を使い、複数の経由地を徒歩で最短順に巡るルートを自動計算するWebアプリです。

---

## 📋 機能

- 🗺️ 地図クリック / 地名検索で経由地を追加
- 🔀 「最短ルートを計算」で最適な巡回順を自動算出
- 🎯 スタート地点 / ゴール地点を任意指定（未指定時は先頭地点へ戻る巡回）
- 🚶 初期計算は**徒歩固定**、計算後に区間ごとに「電車（公共交通）」へ切替可能
- ⏱️ 各区間の移動時間・合計時間・合計距離を表示
- 📱 スマートフォン対応（レスポンシブデザイン）

> 区間手段を電車に変更した場合でも、巡回順そのものは再最適化されません。

---

## 🛠️ セットアップ手順

### Step 1: Google Cloud で API キーを取得する

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 以下の3つの API を有効化:
   - Maps JavaScript API
   - Directions API
   - Places API
3. 「認証情報」→「APIキーを作成」
4. セキュリティのため、上記3つの API のみに使用を制限する

### Step 2: APIキーを `app.js` に直接設定する

GitHub Pages は静的配信のため、`.env` は利用しません。`app.js` 先頭の定数を書き換えてください:

```js
const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY'; // ← 実キーへ置き換え
```

推奨:
- Google Cloud 側で HTTP リファラー制限を設定する
- `https://wisteriabig.github.io/*` と `http://localhost/*` を許可する

### Step 3: ブラウザで開く

ビルド不要。HTTPサーバー経由で `index.html` を開くだけで動作します。

VS Code で開発する場合は **Live Server** 拡張機能が便利です:
1. VS Code に [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) をインストール
2. `index.html` を右クリック →「Open with Live Server」

---

## 📁 ファイル構成

```
.
├── index.html    # メインHTML（地図コンテナ・サイドバー）
├── app.js        # 全ロジック（Maps API・地点管理・ルート計算）
├── style.css     # スタイル（レスポンシブ対応）
└── .github/
    ├── copilot-instructions.md          # Copilot 全体ルール
    └── instructions/
        └── javascript.instructions.md   # JS専用ルール
```

---

## 🤖 GitHub Copilot での開発方法

このプロジェクトは GitHub Copilot を最大限に活用することを前提に設計されています。
`.github/copilot-instructions.md` に技術スタック・コーディング規約・機能仕様を記載してあるため、
Copilot Chat に以下のプロンプトを貼り付けるだけでコードを生成できます。

### プロンプト例（コア機能の一括生成）

```
Google Maps APIを使用した、徒歩での複数地点巡回ルート最適化Webアプリを
シングルページアプリケーションとして作成します。
以下の仕様に従って `index.html`, `app.js`, `style.css` を出力してください。

（以下、詳細仕様を続ける...）
```

> ✅ **ポイント:** `copilot-instructions.md` が自動的に読み込まれるため、
> 「Vanilla JSのみ」「APIキーはプレースホルダーで」などを毎回書かなくて済みます。

---

## ⚠️ 注意事項

- APIキーをそのまま GitHub に push しないでください
- Directions API の無料枠は月間 **約40,000リクエスト**（200ドル相当）
- `optimizeWaypoints` で最適化できる中間地点は最大 **25地点** まで

---

## 📝 ライセンス

個人趣味プロジェクト。自由に改変・利用してください。
