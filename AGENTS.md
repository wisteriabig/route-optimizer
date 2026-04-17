# AGENTS.md — AIエージェント向けガイド

このファイルは GitHub Copilot のエージェントモード（VS Code の Agent Mode）や
その他のAIコーディングエージェントが参照する補足情報です。

---

## エージェントへの最初の指示

このリポジトリで作業を始める前に、以下を必ず確認してください:

1. `.github/copilot-instructions.md` を読む（全体ルール）
2. `.github/instructions/javascript.instructions.md` を読む（JS専用ルール）
3. `README.md` のセットアップ手順を確認する

---

## プロジェクトの現在地（ステータス）

| ファイル | 状態 | 備考 |
|----------|------|------|
| `index.html` | ✅ 作成済み | SPA レイアウト・地図コンテナ・サイドバーを実装 |
| `app.js` | ✅ 作成済み | Maps API読込・地点管理・ルート計算ロジックを実装 |
| `style.css` | ✅ 作成済み | レスポンシブUI（モバイルオーバーレイ）を実装 |

> ファイルが作成されたら ✅ に更新してください。

---

## よく行うタスクとコマンド

### ローカルで動作確認する（ビルド不要）
```bash
# VS Code の Live Server 拡張機能を使う場合:
# → index.html を右クリック → "Open with Live Server"

# Python の簡易サーバーを使う場合（Python 3 が必要）:
python -m http.server 8080
# ブラウザで http://localhost:8080 を開く
```

### APIキーを設定する
```js
// app.js の先頭にある以下の行を編集:
const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY';
//                           ↑ ここに実際のキーを貼り付ける
```

---

## エージェントに依頼できるタスク例

以下の形式でタスクを依頼してください:

```
【タスク】現在地ボタンを追加する
【対象ファイル】app.js, index.html, style.css
【詳細】
- ブラウザの Geolocation API を使い、「現在地を使う」ボタンを追加
- 現在地取得後、そこを地図の中心にセットし、出発点候補として追加
- エラー時（位置情報拒否など）は日本語メッセージを表示
```

---

## やってはいけないこと（エージェントへの制約）

- `npm install` や `yarn` でパッケージを追加しない
- React / Vue / Angular などのフレームワークを導入しない
- webpack / Vite / Parcel などのバンドラーを設定しない
- `index.html` 以外の HTML ファイルを増やさない（SPA のため）
- 実際の API キーを含むコードをコミットしない

---

## デバッグのヒント

```js
// ブラウザの DevTools コンソールで試せる確認コマンド

// Google Maps API がロードされているか確認
console.log(typeof google !== 'undefined' ? '✅ Maps API OK' : '❌ Maps API 未ロード');

// 現在の経由地リストを確認
console.table(waypoints.map(w => ({ name: w.name, lat: w.latLng.lat(), lng: w.latLng.lng() })));

// Directions API のレスポンスを確認（calculateRoute の result を渡す）
// console.log(JSON.stringify(result.routes[0].waypoint_order));
```
