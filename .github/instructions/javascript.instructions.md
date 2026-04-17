---
applyTo: "**/*.js"
---

# JavaScript ファイル向け追加ルール

## Google Maps API の使い方

### 初期化パターン（必ずこの形で書く）
```js
/**
 * Google Maps API スクリプトを動的に読み込み、初期化する
 */
function loadGoogleMapsAPI() {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

// グローバルに公開（callback=initMap で呼ばれるため）
window.initMap = function() {
  // ここで map を初期化
};
```

### DirectionsService の呼び出しパターン
```js
/**
 * ルートを計算して地図に描画する
 * @param {google.maps.LatLng} origin - 出発地
 * @param {google.maps.LatLng} destination - 到着地
 * @param {Array<google.maps.DirectionsWaypoint>} waypoints - 中間地点
 */
async function calculateRoute(origin, destination, waypoints) {
  const request = {
    origin,
    destination,
    waypoints,
    optimizeWaypoints: true,        // 最短順を自動計算
    travelMode: google.maps.TravelMode.WALKING,
  };

  try {
    const result = await new Promise((resolve, reject) => {
      directionsService.route(request, (result, status) => {
        if (status === 'OK') resolve(result);
        else reject(new Error(`Directions API エラー: ${status}`));
      });
    });

    directionsRenderer.setDirections(result);
    displayRouteSummary(result.routes[0]);
  } catch (err) {
    alert(`ルートの計算に失敗しました。\n${err.message}`);
    console.error(err);
  }
}
```

## エラーハンドリング必須ケース

以下のケースは必ずエラーを表示するコードを書く:

1. **APIキー未設定**
   ```js
   if (GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY') {
     alert('APIキーを設定してください。app.js の GOOGLE_MAPS_API_KEY を編集してください。');
     return;
   }
   ```

2. **経由地が1つ未満でルート計算ボタンを押した場合**
   ```js
   if (waypoints.length < 1) {
     alert('経由地を1つ以上追加してください。');
     return;
   }
   ```

3. **Directions API のステータスエラー**
   - `ZERO_RESULTS`: 徒歩でアクセス不可能な地点の組み合わせ
   - `MAX_WAYPOINTS_EXCEEDED`: 経由地が25を超えた（無料枠の制限）
   - `REQUEST_DENIED`: APIキーの権限不足

## 地点データの形式

地点は以下のオブジェクト形式で統一する:
```js
const waypointItem = {
  id: Date.now(),                          // 一意なID（削除時に使用）
  name: '東京タワー',                       // 表示名
  latLng: new google.maps.LatLng(35.6586, 139.7454),  // 座標
  marker: markerInstance,                   // 地図上のマーカー
};
```

## 禁止事項

- `document.write()` の使用禁止
- `innerHTML` へのユーザー入力の直接代入禁止（XSS対策）
  ```js
  // NG
  element.innerHTML = userInput;
  // OK
  element.textContent = userInput;
  ```
- `eval()` の使用禁止