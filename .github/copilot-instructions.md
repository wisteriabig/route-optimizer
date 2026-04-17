# GitHub Copilot Instructions — 徒歩巡回ルート最適化アプリ

## プロジェクト概要

Google Maps API を使用した **シングルページ Web アプリ（SPA）**。
ユーザーが複数の地点を登録し、徒歩での最短巡回ルートを自動計算・地図表示するツール。

- **構成ファイル:** `index.html` / `app.js` / `style.css` の3ファイルのみ
- **外部依存:** Google Maps JavaScript API（CDN経由）のみ。npmやバンドラー不使用
- **ターゲット:** 個人趣味開発。シンプルさと動作確認のしやすさを最優先

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| 言語 | Vanilla JavaScript（ES2020+）, HTML5, CSS3 |
| 地図 | Google Maps JavaScript API v3 |
| ルート計算 | Google Directions API（`optimizeWaypoints: true`, `WALKING`モード） |
| 地点検索 | Google Places Autocomplete |
| フレームワーク | **なし**（React / Vue 等は使わない） |
| ビルドツール | **なし**（webpack / Vite 等は使わない） |
| テスト | **なし**（趣味開発のためスキップ） |

---

## コーディングガイドライン

### JavaScript
- `const` / `let` を使う。`var` は使わない
- 非同期処理は `async/await` を使う。コールバック地獄は避ける
- APIキーは必ず `const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY';` という形式で `app.js` の先頭に定義する
- Google Maps の `<script>` タグは `index.html` に直書きせず、`app.js` 内で動的に生成・挿入する
  ```js
  // 良い例
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
  document.head.appendChild(script);
  ```
- 関数名・変数名は **英語のキャメルケース**。コメントは **日本語OK**
- グローバル変数は最小限に。`map`, `directionsService`, `directionsRenderer`, `waypoints` の4つ程度に抑える

### CSS
- レスポンシブ対応必須。`@media (max-width: 768px)` でモバイル対応を入れる
- CSS変数（カスタムプロパティ）で色・間隔を管理する
  ```css
  :root {
    --color-primary: #4285F4;   /* Google Blue */
    --color-danger: #EA4335;
    --sidebar-width: 320px;
  }
  ```
- Flexbox / Grid を使う。`float` は使わない

### HTML
- `<!DOCTYPE html>` から始まる完全なHTML文書として出力する
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` を必ず入れる
- セマンティックタグ（`<main>`, `<aside>`, `<header>` など）を使う

---

## 機能仕様（実装済みもしくは実装すべき機能）

### 地点の追加
- [ ] 地図クリックで経由地を追加（マーカー表示）
- [ ] Places Autocomplete 検索窓から地点名で追加

### 地点の管理
- [ ] サイドバーに追加済み地点をリスト表示
- [ ] 各地点を個別に削除できる「×」ボタン

### ルート最適化
- [ ] 「最短ルートを計算」ボタン
- [ ] `DirectionsService` で `optimizeWaypoints: true` を指定
- [ ] 移動手段は `TravelMode.WALKING` 固定
- [ ] 地図上にルートをポリライン描画

### 結果表示
- [ ] 各区間の移動時間を表示
- [ ] 合計所要時間・合計距離を表示

---

## 重要な制約・注意点

- **APIキーをコードに直書きしない**こと。`YOUR_API_KEY` というプレースホルダーを使い、本番キーはユーザーが差し替える
- Directions API のレスポンスで経由地の最適順序は `routes[0].waypoint_order` に入っている
- `optimizeWaypoints` は中間地点（出発・到着以外）のみ並び替える。出発点と到着点は固定
- Places Autocomplete はモバイルで `pacContainer`（候補リスト）がはみ出しやすいので `z-index` に注意

---

## Copilot へのお願い

コードを生成するとき:
1. 上記の技術スタックと制約を**必ず守る**
2. 各関数に **日本語のJSDocコメント** を書く
3. エラーハンドリングを入れる（APIキー未設定・ルート計算失敗など）
4. 3ファイル（`index.html`, `app.js`, `style.css`）を**分割してそれぞれコードブロックで出力**する