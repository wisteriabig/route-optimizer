const GOOGLE_MAPS_API_KEY = 'AIzaSyBhTnkxanjhu11B6zGEzZRMU94eVEwf_oI'; // GitHub Pages 公開時は実キーへ置き換え

let map = null;
let directionsService = null;
let directionsRenderer = null;
let waypoints = [];

/** @type {google.maps.places.Autocomplete | null} */
let autocomplete = null;

/** @type {ReturnType<typeof getUiElements>} */
let ui = null;
let uiEventsBound = false;

let selectedStartWaypointId = null;
let selectedGoalWaypointId = null;
let routeState = null;
let segmentPolylines = [];
let segmentModeChangeCounter = 0;
let isRouteCalculating = false;

const AUTO_START_VALUE = '__AUTO_START__';
const AUTO_GOAL_VALUE = '__AUTO_GOAL__';
const LONG_DISTANCE_THRESHOLD_METERS = 5000;

const SEGMENT_MODE = Object.freeze({
  WALKING: 'WALKING',
  TRANSIT: 'TRANSIT',
});

const SEGMENT_MODE_LABEL = Object.freeze({
  [SEGMENT_MODE.WALKING]: '徒歩',
  [SEGMENT_MODE.TRANSIT]: '電車（公共交通）',
});

const SEGMENT_STROKE_COLOR = Object.freeze({
  [SEGMENT_MODE.WALKING]: '#4285F4',
  [SEGMENT_MODE.TRANSIT]: '#FB8C00',
});

const DIRECTIONS_ERROR_MESSAGES = Object.freeze({
  ZERO_RESULTS: 'ルートが見つかりませんでした。地点の組み合わせを変更してください。',
  MAX_WAYPOINTS_EXCEEDED: '経由地が上限を超えています。最大25地点までに減らしてください。',
  REQUEST_DENIED: 'Directions API リクエストが拒否されました。APIキーと権限設定を確認してください。',
  OVER_QUERY_LIMIT: 'API利用上限を超えました。しばらく待ってから再試行してください。',
  INVALID_REQUEST: 'Directions APIへのリクエストが不正です。地点情報を見直してください。',
  NOT_FOUND: '指定した地点の一部が見つかりませんでした。地点名や位置を再確認してください。',
  UNKNOWN_ERROR: 'Google側で一時的なエラーが発生しました。時間を置いて再試行してください。',
});

document.addEventListener('DOMContentLoaded', () => {
  setupApp();
});

/**
 * アプリ全体を初期化する
 */
function setupApp() {
  ui = getUiElements();
  renderWaypointList();
  renderEmptyRouteResult();

  if (!uiEventsBound) {
    bindUiEvents();
    uiEventsBound = true;
  }

  if (isPlaceholderApiKey(GOOGLE_MAPS_API_KEY)) {
    renderApiKeyConfigurationHint();
    console.error('Google Maps APIキーが未設定です。app.js の GOOGLE_MAPS_API_KEY を実キーへ置き換えてください。');
    return;
  }

  window.initMap = initMap;
  loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);
}

/**
 * プレースホルダーキーかどうかを判定する
 * @param {string} apiKey - 判定対象のキー
 * @returns {boolean} プレースホルダーならtrue
 */
function isPlaceholderApiKey(apiKey) {
  return typeof apiKey !== 'string' || apiKey.trim() === '' || apiKey === 'YOUR_API_KEY';
}

/**
 * APIキー未設定時の案内を結果エリアに表示する
 */
function renderApiKeyConfigurationHint() {
  ui.routeResults.textContent = '';

  const message = document.createElement('p');
  message.className = 'empty-message';
  message.textContent = 'Google Maps APIキーが未設定です。app.js の GOOGLE_MAPS_API_KEY を実キーへ置き換えて再読み込みしてください。';

  ui.routeResults.appendChild(message);
}

/**
 * UI要素を取得して返す
 * @returns {{
 *  placeInput: HTMLInputElement,
 *  startSelect: HTMLSelectElement,
 *  goalSelect: HTMLSelectElement,
 *  waypointList: HTMLUListElement,
 *  waypointCount: HTMLSpanElement,
 *  calculateButton: HTMLButtonElement,
 *  routeResults: HTMLDivElement
 * }} UI要素オブジェクト
 */
function getUiElements() {
  return {
    placeInput: /** @type {HTMLInputElement} */ (document.getElementById('place-input')),
    startSelect: /** @type {HTMLSelectElement} */ (document.getElementById('start-select')),
    goalSelect: /** @type {HTMLSelectElement} */ (document.getElementById('goal-select')),
    waypointList: /** @type {HTMLUListElement} */ (document.getElementById('waypoint-list')),
    waypointCount: /** @type {HTMLSpanElement} */ (document.getElementById('waypoint-count')),
    calculateButton: /** @type {HTMLButtonElement} */ (document.getElementById('calculate-route-button')),
    routeResults: /** @type {HTMLDivElement} */ (document.getElementById('route-results')),
  };
}

/**
 * UIイベントを登録する
 */
function bindUiEvents() {
  ui.calculateButton.addEventListener('click', () => {
    void calculateOptimizedRoute();
  });

  ui.startSelect.addEventListener('change', handleStartSelectionChange);
  ui.goalSelect.addEventListener('change', handleGoalSelectionChange);
}

/**
 * スタート地点セレクタ変更時の処理
 */
function handleStartSelectionChange() {
  selectedStartWaypointId = parseWaypointSelectValue(ui.startSelect.value, AUTO_START_VALUE);
  clearRouteView();
  renderWaypointList();
}

/**
 * ゴール地点セレクタ変更時の処理
 */
function handleGoalSelectionChange() {
  selectedGoalWaypointId = parseWaypointSelectValue(ui.goalSelect.value, AUTO_GOAL_VALUE);
  clearRouteView();
  renderWaypointList();
}

/**
 * セレクタ値を地点IDとして解釈する
 * @param {string} value - セレクタ値
 * @param {string} autoValue - 自動選択時の値
 * @returns {number | null} 地点ID（自動時はnull）
 */
function parseWaypointSelectValue(value, autoValue) {
  if (value === autoValue) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Google Maps JavaScript APIを動的に読み込む
 * @param {string} apiKey - Google Maps APIキー
 */
function loadGoogleMapsApi(apiKey) {
  if (window.google && window.google.maps) {
    console.info('Google Maps APIは既に読み込み済みです。');
    initMap();
    return;
  }

  const existingScript = document.querySelector('script[data-maps-loader="true"]');
  if (existingScript) {
    console.info('Google Maps API読み込みは既に開始済みです。');
    return;
  }

  const script = document.createElement('script');
  script.dataset.mapsLoader = 'true';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=initMap`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    alert('Google Maps API の読み込みに失敗しました。APIキー・通信環境・リファラ制限を確認してください。');
    console.error('Google Maps API script load failed.');
  };
  document.head.appendChild(script);

  console.info('Google Maps APIの読み込みを開始しました。');
}

/**
 * Google Mapsを初期化する（callback=initMap で実行）
 */
function initMap() {
  try {
    if (map) {
      console.info('Mapは既に初期化済みです。');
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      throw new Error('#map が見つかりません。');
    }

    map = new google.maps.Map(mapElement, {
      center: { lat: 35.681236, lng: 139.767125 },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      suppressPolylines: true,
    });

    map.addListener('click', handleMapClick);
    initializeAutocomplete();

    console.info('Map初期化完了');
  } catch (error) {
    alert('地図の初期化に失敗しました。コンソールログを確認してください。');
    console.error('initMap error:', error);
  }
}

/**
 * Places Autocompleteを初期化する
 */
function initializeAutocomplete() {
  autocomplete = new google.maps.places.Autocomplete(ui.placeInput, {
    fields: ['name', 'formatted_address', 'geometry'],
  });

  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', handlePlaceSelected);

  console.info('Places Autocomplete初期化完了');
}

/**
 * 地図クリックで地点を追加する
 * @param {google.maps.MapMouseEvent} event - クリックイベント
 */
function handleMapClick(event) {
  if (!event.latLng) {
    console.warn('クリック座標を取得できませんでした。', event);
    return;
  }

  const name = createCoordinateLabel(event.latLng);
  addWaypoint(event.latLng, name);
}

/**
 * 検索候補選択で地点を追加する
 */
function handlePlaceSelected() {
  const place = autocomplete && autocomplete.getPlace();
  if (!place || !place.geometry || !place.geometry.location) {
    alert('地点の座標情報を取得できませんでした。候補から再選択してください。');
    console.warn('Invalid place from autocomplete:', place);
    return;
  }

  const name = (place.name || place.formatted_address || createCoordinateLabel(place.geometry.location)).trim();
  addWaypoint(place.geometry.location, name);
  ui.placeInput.value = '';

  map.panTo(place.geometry.location);
  if ((map.getZoom() || 0) < 15) {
    map.setZoom(15);
  }
}

/**
 * 座標ラベル文字列を生成する
 * @param {google.maps.LatLng} latLng - 座標
 * @returns {string} 表示用ラベル
 */
function createCoordinateLabel(latLng) {
  const lat = latLng.lat().toFixed(5);
  const lng = latLng.lng().toFixed(5);
  return `地点 ${waypoints.length + 1} (${lat}, ${lng})`;
}

/**
 * 地点を追加してUIを更新する
 * @param {google.maps.LatLng} latLng - 座標
 * @param {string} name - 地点名
 */
function addWaypoint(latLng, name) {
  if (!map) {
    console.warn('地図未初期化のため地点追加を中断しました。');
    return;
  }

  const marker = new google.maps.Marker({
    map,
    position: latLng,
    title: name,
    label: String(waypoints.length + 1),
  });

  const waypointItem = {
    id: Date.now() + Math.floor(Math.random() * 100000),
    name,
    latLng,
    marker,
  };

  waypoints.push(waypointItem);
  renderWaypointList();
  clearRouteView();

  console.info('地点追加', {
    id: waypointItem.id,
    name: waypointItem.name,
    lat: latLng.lat(),
    lng: latLng.lng(),
  });
}

/**
 * 指定IDの地点を削除する
 * @param {number} waypointId - 地点ID
 */
function removeWaypoint(waypointId) {
  const index = waypoints.findIndex((item) => item.id === waypointId);
  if (index < 0) {
    console.warn('削除対象が見つかりません。', waypointId);
    return;
  }

  const removed = waypoints[index];
  removed.marker.setMap(null);
  waypoints.splice(index, 1);

  renderWaypointList();
  clearRouteView();

  console.info('地点削除', { id: removed.id, name: removed.name });
}

/**
 * 地点一覧を描画する
 */
function renderWaypointList() {
  ui.waypointList.textContent = '';

  if (waypoints.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'waypoint-empty';
    empty.textContent = '地点がまだありません。';
    ui.waypointList.appendChild(empty);
  } else {
    waypoints.forEach((waypoint, index) => {
      waypoint.marker.setLabel(String(index + 1));
      waypoint.marker.setTitle(`${index + 1}. ${waypoint.name}`);
      ui.waypointList.appendChild(createWaypointListItem(waypoint, index));
    });
  }

  ui.waypointCount.textContent = `${waypoints.length}件`;
  updateEndpointSelectors();
}

/**
 * 地点一覧の1行要素を作成する
 * @param {{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}} waypoint - 地点データ
 * @param {number} index - 表示番号
 * @returns {HTMLLIElement} 一覧行
 */
function createWaypointListItem(waypoint, index) {
  const item = document.createElement('li');
  item.className = 'waypoint-item';

  const left = document.createElement('div');
  left.className = 'waypoint-left';

  const number = document.createElement('span');
  number.className = 'waypoint-number';
  number.textContent = String(index + 1);

  const dot = document.createElement('span');
  dot.className = 'waypoint-dot';
  dot.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'waypoint-name';
  name.textContent = waypoint.name;

  left.append(number, dot, name);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'waypoint-remove';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', `${waypoint.name} を削除`);
  removeButton.addEventListener('click', () => {
    removeWaypoint(waypoint.id);
  });

  item.append(left, removeButton);
  return item;
}

/**
 * スタート/ゴールセレクタの選択肢を更新する
 */
function updateEndpointSelectors() {
  const availableIds = new Set(waypoints.map((point) => point.id));

  if (selectedStartWaypointId !== null && !availableIds.has(selectedStartWaypointId)) {
    selectedStartWaypointId = null;
  }
  if (selectedGoalWaypointId !== null && !availableIds.has(selectedGoalWaypointId)) {
    selectedGoalWaypointId = null;
  }

  ui.startSelect.textContent = '';
  ui.goalSelect.textContent = '';

  ui.startSelect.appendChild(createSelectOption(AUTO_START_VALUE, '自動（先頭地点）'));
  ui.goalSelect.appendChild(createSelectOption(AUTO_GOAL_VALUE, '自動（スタート地点に戻る）'));

  waypoints.forEach((waypoint, index) => {
    const label = `${index + 1}. ${waypoint.name}`;
    ui.startSelect.appendChild(createSelectOption(String(waypoint.id), label));
    ui.goalSelect.appendChild(createSelectOption(String(waypoint.id), label));
  });

  ui.startSelect.value = selectedStartWaypointId === null ? AUTO_START_VALUE : String(selectedStartWaypointId);
  ui.goalSelect.value = selectedGoalWaypointId === null ? AUTO_GOAL_VALUE : String(selectedGoalWaypointId);

  const disableSelectors = waypoints.length === 0;
  ui.startSelect.disabled = disableSelectors;
  ui.goalSelect.disabled = disableSelectors;
}

/**
 * select用option要素を作成する
 * @param {string} value - 値
 * @param {string} label - 表示文言
 * @returns {HTMLOptionElement} option要素
 */
function createSelectOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

/**
 * ルート描画と結果表示をクリアする
 */
function clearRouteView() {
  routeState = null;
  clearSegmentPolylines();

  if (directionsRenderer) {
    directionsRenderer.set('directions', null);
  }

  renderEmptyRouteResult();
}

/**
 * マップ上の区間ポリラインをクリアする
 */
function clearSegmentPolylines() {
  segmentPolylines.forEach((polyline) => {
    polyline.setMap(null);
  });
  segmentPolylines = [];
}

/**
 * ルート結果初期表示を描画する
 */
function renderEmptyRouteResult() {
  ui.routeResults.textContent = '';

  const message = document.createElement('p');
  message.className = 'empty-message';
  message.textContent = 'ルートを計算すると、区間ごとの時間と合計値を表示します。';

  const note = document.createElement('p');
  note.className = 'route-limit-note';
  note.textContent = '計算後、区間ごとに「徒歩 / 電車（公共交通）」を切り替えできます。';

  ui.routeResults.append(message, note);
}

/**
 * 最適化ルートを計算して表示する
 * @returns {Promise<void>} 非同期完了Promise
 */
async function calculateOptimizedRoute() {
  if (waypoints.length < 1) {
    alert('経由地を1つ以上追加してください');
    console.warn('経由地0件で計算が実行されました。');
    return;
  }

  if (!map || !directionsService || !directionsRenderer) {
    alert('地図の初期化中です。少し待ってから再実行してください。');
    console.warn('未初期化状態で計算が実行されました。');
    return;
  }

  if (isRouteCalculating) {
    console.info('ルート計算中のため、重複実行をスキップしました。');
    return;
  }

  const endpoints = resolveRouteEndpoints();
  if (!endpoints.start || !endpoints.goal) {
    alert('スタート地点またはゴール地点を解決できませんでした。地点を再選択してください。');
    console.error('resolveRouteEndpoints failed:', endpoints);
    return;
  }

  if (waypoints.length === 1 && endpoints.isRoundTrip) {
    clearRouteView();
    renderSinglePointSummary(endpoints.start);
    map.panTo(endpoints.start.latLng);
    if ((map.getZoom() || 0) < 15) {
      map.setZoom(15);
    }
    return;
  }

  const request = buildDirectionsRequest(endpoints);
  console.info('Directions request', {
    start: endpoints.start.name,
    goal: endpoints.goal.name,
    isRoundTrip: endpoints.isRoundTrip,
    totalWaypoints: waypoints.length,
    intermediateWaypoints: request.waypoints ? request.waypoints.length : 0,
    travelMode: request.travelMode,
  });

  try {
    isRouteCalculating = true;
    ui.calculateButton.disabled = true;

    const result = await runDirectionsRequest(request);
    const route = result.routes && result.routes[0];
    if (!route) {
      throw new Error('Directions APIのレスポンスにルート情報がありません。');
    }

    const orderedWaypoints = buildOrderedWaypoints(route.waypoint_order || [], endpoints);
    routeState = buildRouteState(route, orderedWaypoints, endpoints);

    directionsRenderer.set('directions', null);
    drawRoutePolylines();
    fitMapToWaypoints(orderedWaypoints);
    renderRouteSummary();

    console.info('ルート計算成功', {
      waypoint_order: route.waypoint_order || [],
      segmentCount: routeState.segments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    alert(`ルートの計算に失敗しました。\n${message}`);
    console.error('ルート計算失敗', error);
  } finally {
    isRouteCalculating = false;
    ui.calculateButton.disabled = false;
  }
}

/**
 * 現在のスタート/ゴール設定から経路計算対象を解決する
 * @returns {{
 *  start: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker} | null,
 *  goal: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker} | null,
 *  intermediateWaypoints: Array<{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}>,
 *  isRoundTrip: boolean
 * }} 解決した設定
 */
function resolveRouteEndpoints() {
  const start = findWaypointById(selectedStartWaypointId) || waypoints[0] || null;
  if (!start) {
    return {
      start: null,
      goal: null,
      intermediateWaypoints: [],
      isRoundTrip: false,
    };
  }

  const explicitGoal = findWaypointById(selectedGoalWaypointId);
  const goal = explicitGoal || start;
  const isRoundTrip = start.id === goal.id;

  const intermediateWaypoints = waypoints.filter((point) => {
    return point.id !== start.id && point.id !== goal.id;
  });

  return {
    start,
    goal,
    intermediateWaypoints,
    isRoundTrip,
  };
}

/**
 * IDで地点を検索する
 * @param {number | null} waypointId - 地点ID
 * @returns {{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker} | null} 地点データ
 */
function findWaypointById(waypointId) {
  if (waypointId === null) {
    return null;
  }

  const found = waypoints.find((point) => point.id === waypointId);
  return found || null;
}

/**
 * Directionsリクエストを作成する
 * @param {{
 *  start: {latLng: google.maps.LatLng},
 *  goal: {latLng: google.maps.LatLng},
 *  intermediateWaypoints: Array<{latLng: google.maps.LatLng}>
 * }} endpoints - 経路端点情報
 * @returns {google.maps.DirectionsRequest} リクエスト
 */
function buildDirectionsRequest(endpoints) {
  const middle = endpoints.intermediateWaypoints.map((point) => ({
    location: point.latLng,
    stopover: true,
  }));

  return {
    origin: endpoints.start.latLng,
    destination: endpoints.goal.latLng,
    waypoints: middle,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.WALKING,
  };
}

/**
 * Directions APIをPromise化して実行する
 * @param {google.maps.DirectionsRequest} request - リクエスト
 * @returns {Promise<google.maps.DirectionsResult>} 計算結果
 */
function runDirectionsRequest(request) {
  return new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      console.info('Directions status:', status);
      if (status === 'OK' && result) {
        resolve(result);
        return;
      }
      reject(new Error(getDirectionsErrorMessage(status)));
    });
  });
}

/**
 * Directions APIステータスの日本語メッセージを返す
 * @param {string} status - Directionsステータス
 * @returns {string} エラーメッセージ
 */
function getDirectionsErrorMessage(status) {
  return DIRECTIONS_ERROR_MESSAGES[status] || `Directions APIで不明なエラーが発生しました（${status}）。`;
}

/**
 * waypoint_orderに従った巡回順配列を作成する
 * @param {number[]} waypointOrder - 最適化順序
 * @param {{
 *  start: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  goal: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  intermediateWaypoints: Array<{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}>,
 *  isRoundTrip: boolean
 * }} endpoints - 端点情報
 * @returns {Array<{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}>} 巡回順地点配列
 */
function buildOrderedWaypoints(waypointOrder, endpoints) {
  const fallbackOrder = endpoints.isRoundTrip
    ? [endpoints.start, ...endpoints.intermediateWaypoints, endpoints.start]
    : [endpoints.start, ...endpoints.intermediateWaypoints, endpoints.goal];

  if (!Array.isArray(waypointOrder) || waypointOrder.length === 0) {
    return fallbackOrder;
  }

  const optimizedMiddle = waypointOrder
    .map((index) => endpoints.intermediateWaypoints[index])
    .filter(Boolean);

  if (optimizedMiddle.length !== endpoints.intermediateWaypoints.length) {
    console.warn('waypoint_order不整合のため追加順を利用します。', waypointOrder);
    return fallbackOrder;
  }

  return endpoints.isRoundTrip
    ? [endpoints.start, ...optimizedMiddle, endpoints.start]
    : [endpoints.start, ...optimizedMiddle, endpoints.goal];
}

/**
 * Directions結果から表示用ルート状態を構築する
 * @param {google.maps.DirectionsRoute} route - ルート情報
 * @param {Array<{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}>} orderedWaypoints - 巡回順地点
 * @param {{
 *  start: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  goal: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  isRoundTrip: boolean
 * }} endpoints - 端点情報
 * @returns {{
 *  start: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  goal: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *  isRoundTrip: boolean,
 *  orderedWaypoints: Array<{id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker}>,
 *  segments: Array<{
 *    from: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *    to: {id:number,name:string,latLng:google.maps.LatLng,marker:google.maps.Marker},
 *    mode: 'WALKING' | 'TRANSIT',
 *    walkingMetrics: ReturnType<typeof createLegMetrics>,
 *    transitMetrics: ReturnType<typeof createLegMetrics> | null,
 *    activeMetrics: ReturnType<typeof createLegMetrics>,
 *    pendingToken: number
 *  }>
 * }} 表示用ルート状態
 */
function buildRouteState(route, orderedWaypoints, endpoints) {
  const legs = Array.isArray(route.legs) ? route.legs : [];

  const segments = legs.map((leg, index) => {
    const from = orderedWaypoints[index] || {
      id: -1 * (index + 1),
      name: leg.start_address || `地点 ${index + 1}`,
      latLng: leg.start_location,
      marker: null,
    };
    const to = orderedWaypoints[index + 1] || {
      id: -1 * (index + 2),
      name: leg.end_address || `地点 ${index + 2}`,
      latLng: leg.end_location,
      marker: null,
    };

    const walkingMetrics = createLegMetrics(leg, null);
    return {
      from,
      to,
      mode: SEGMENT_MODE.WALKING,
      walkingMetrics,
      transitMetrics: null,
      activeMetrics: walkingMetrics,
      pendingToken: 0,
    };
  });

  return {
    start: endpoints.start,
    goal: endpoints.goal,
    isRoundTrip: endpoints.isRoundTrip,
    orderedWaypoints,
    segments,
  };
}

/**
 * 区間メトリクスを作成する
 * @param {google.maps.DirectionsLeg} leg - 区間情報
 * @param {google.maps.LatLng[] | null} overviewPath - ルート概要パス
 * @returns {{
 *  distanceValue: number,
 *  durationValue: number,
 *  distanceText: string,
 *  durationText: string,
 *  path: google.maps.LatLng[]
 * }} 区間メトリクス
 */
function createLegMetrics(leg, overviewPath) {
  const distanceValue = leg.distance && typeof leg.distance.value === 'number' ? leg.distance.value : 0;
  const durationValue = leg.duration && typeof leg.duration.value === 'number' ? leg.duration.value : 0;

  return {
    distanceValue,
    durationValue,
    distanceText: leg.distance && leg.distance.text ? leg.distance.text : formatDistance(distanceValue),
    durationText: leg.duration && leg.duration.text ? leg.duration.text : formatDuration(durationValue),
    path: extractPathFromLeg(leg, overviewPath),
  };
}

/**
 * 区間情報から描画用パス配列を抽出する
 * @param {google.maps.DirectionsLeg} leg - 区間情報
 * @param {google.maps.LatLng[] | null} overviewPath - ルート概要パス
 * @returns {google.maps.LatLng[]} 描画用パス
 */
function extractPathFromLeg(leg, overviewPath) {
  if (Array.isArray(overviewPath) && overviewPath.length > 1) {
    return overviewPath.slice();
  }

  const path = [];
  if (Array.isArray(leg.steps)) {
    leg.steps.forEach((step) => {
      if (Array.isArray(step.path) && step.path.length > 0) {
        path.push(...step.path);
      }
    });
  }

  if (path.length === 0) {
    if (leg.start_location) {
      path.push(leg.start_location);
    }
    if (leg.end_location) {
      path.push(leg.end_location);
    }
  }

  return path;
}

/**
 * 地点1件時の結果表示を行う
 * @param {{name:string}} waypoint - 地点情報
 */
function renderSinglePointSummary(waypoint) {
  ui.routeResults.textContent = '';

  const summary = document.createElement('div');
  summary.className = 'summary-grid';
  summary.append(
    createSummaryCard('合計所要時間', '0分'),
    createSummaryCard('合計距離', '0.00 km')
  );

  const note = document.createElement('p');
  note.className = 'single-note';
  note.textContent = `地点「${waypoint.name}」のみのため移動はありません。`;

  ui.routeResults.append(summary, note);
}

/**
 * ルートサマリーを描画する
 */
function renderRouteSummary() {
  if (!routeState) {
    renderEmptyRouteResult();
    return;
  }

  if (routeState.segments.length === 0) {
    renderSinglePointSummary(routeState.start);
    return;
  }

  ui.routeResults.textContent = '';

  const totals = routeState.segments.reduce(
    (acc, segment) => {
      return {
        meters: acc.meters + segment.activeMetrics.distanceValue,
        seconds: acc.seconds + segment.activeMetrics.durationValue,
      };
    },
    { meters: 0, seconds: 0 }
  );

  const summary = document.createElement('div');
  summary.className = 'summary-grid';
  summary.append(
    createSummaryCard('合計所要時間', formatDuration(totals.seconds)),
    createSummaryCard('合計距離', formatDistance(totals.meters))
  );

  const endpoint = document.createElement('p');
  endpoint.className = 'route-endpoint';
  endpoint.textContent = routeState.isRoundTrip
    ? `スタート/ゴール: ${routeState.start.name}`
    : `スタート: ${routeState.start.name} / ゴール: ${routeState.goal.name}`;

  const order = document.createElement('p');
  order.className = 'route-order';
  order.textContent = `巡回順: ${routeState.orderedWaypoints.map((point) => point.name).join(' → ')}`;

  const legend = document.createElement('p');
  legend.className = 'mode-legend';
  legend.textContent = '地図線色: 青=徒歩 / オレンジ=電車（公共交通）';

  const limitNote = document.createElement('p');
  limitNote.className = 'route-limit-note';
  limitNote.textContent = '区間を電車へ変更しても巡回順は再最適化されません。必要に応じてスタート/ゴールを変更して再計算してください。';

  const title = document.createElement('h3');
  title.className = 'segment-title-header';
  title.textContent = '各区間の移動時間（区間ごとに手段変更可能）';

  const list = document.createElement('ol');
  list.className = 'segment-list';
  routeState.segments.forEach((segment, index) => {
    list.appendChild(createSegmentListItem(segment, index));
  });

  ui.routeResults.append(summary, endpoint, order, legend, limitNote, title, list);
}

/**
 * 区間一覧の1行要素を作成する
 * @param {{
 *  from: {name:string},
 *  to: {name:string},
 *  mode: 'WALKING' | 'TRANSIT',
 *  walkingMetrics: ReturnType<typeof createLegMetrics>,
 *  activeMetrics: ReturnType<typeof createLegMetrics>
 * }} segment - 区間データ
 * @param {number} segmentIndex - 区間番号
 * @returns {HTMLLIElement} 区間一覧要素
 */
function createSegmentListItem(segment, segmentIndex) {
  const item = document.createElement('li');
  item.className = 'segment-item';

  const title = document.createElement('p');
  title.className = 'segment-item-title';
  title.textContent = `${segment.from.name} → ${segment.to.name}`;

  const controlRow = document.createElement('div');
  controlRow.className = 'segment-control-row';

  const controlLabel = document.createElement('span');
  controlLabel.className = 'segment-control-label';
  controlLabel.textContent = '移動手段';

  const modeSelect = document.createElement('select');
  modeSelect.className = 'segment-mode-select';
  modeSelect.dataset.segmentIndex = String(segmentIndex);
  modeSelect.append(
    createModeOption(SEGMENT_MODE.WALKING, SEGMENT_MODE_LABEL[SEGMENT_MODE.WALKING]),
    createModeOption(SEGMENT_MODE.TRANSIT, SEGMENT_MODE_LABEL[SEGMENT_MODE.TRANSIT])
  );
  modeSelect.value = segment.mode;
  modeSelect.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.currentTarget);
    void handleSegmentModeChange(segmentIndex, target.value);
  });

  controlRow.append(controlLabel, modeSelect);

  const meta = document.createElement('p');
  meta.className = 'segment-item-meta';
  meta.textContent = `手段: ${SEGMENT_MODE_LABEL[segment.mode]} / 所要時間: ${segment.activeMetrics.durationText} / 距離: ${segment.activeMetrics.distanceText}`;

  item.append(title, controlRow, meta);

  if (segment.mode === SEGMENT_MODE.WALKING && segment.walkingMetrics.distanceValue >= LONG_DISTANCE_THRESHOLD_METERS) {
    const suggestion = document.createElement('p');
    suggestion.className = 'segment-suggestion';
    suggestion.textContent = '長距離区間です。必要に応じて「電車（公共交通）」を試してください。';
    item.appendChild(suggestion);
  }

  return item;
}

/**
 * 移動手段selectのoption要素を作成する
 * @param {'WALKING' | 'TRANSIT'} value - 手段値
 * @param {string} label - 表示文言
 * @returns {HTMLOptionElement} option要素
 */
function createModeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

/**
 * 区間の移動手段を変更する
 * @param {number} segmentIndex - 区間番号
 * @param {string} nextMode - 変更後手段
 * @returns {Promise<void>} 非同期完了Promise
 */
async function handleSegmentModeChange(segmentIndex, nextMode) {
  if (!routeState || !routeState.segments[segmentIndex]) {
    console.warn('区間手段変更対象が見つかりません。', segmentIndex);
    return;
  }

  if (nextMode !== SEGMENT_MODE.WALKING && nextMode !== SEGMENT_MODE.TRANSIT) {
    console.warn('未対応の移動手段が指定されました。', nextMode);
    renderRouteSummary();
    return;
  }

  const segment = routeState.segments[segmentIndex];
  const previousMode = segment.mode;
  if (nextMode === previousMode) {
    return;
  }

  if (nextMode === SEGMENT_MODE.WALKING) {
    segment.mode = SEGMENT_MODE.WALKING;
    segment.activeMetrics = segment.walkingMetrics;
    renderRouteSummary();
    drawRoutePolylines();
    console.info('区間手段を徒歩に変更しました。', {
      segmentIndex,
      from: segment.from.name,
      to: segment.to.name,
    });
    return;
  }

  const requestToken = ++segmentModeChangeCounter;
  segment.pendingToken = requestToken;
  setSegmentControlsDisabled(true);

  try {
    const transitMetrics = await requestTransitSegmentMetrics(segment.from, segment.to);
    if (segment.pendingToken !== requestToken) {
      return;
    }

    segment.transitMetrics = transitMetrics;
    segment.mode = SEGMENT_MODE.TRANSIT;
    segment.activeMetrics = transitMetrics;

    console.info('区間手段を電車に変更しました。', {
      segmentIndex,
      from: segment.from.name,
      to: segment.to.name,
      duration: transitMetrics.durationText,
    });
  } catch (error) {
    if (segment.pendingToken === requestToken) {
      segment.mode = previousMode;
      segment.activeMetrics = previousMode === SEGMENT_MODE.TRANSIT && segment.transitMetrics
        ? segment.transitMetrics
        : segment.walkingMetrics;
    }

    const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    alert(`区間「${segment.from.name} → ${segment.to.name}」を電車へ変更できませんでした。\n${message}`);
    console.error('区間手段変更失敗', error);
  } finally {
    if (segment.pendingToken === requestToken) {
      segment.pendingToken = 0;
    }

    setSegmentControlsDisabled(false);
    renderRouteSummary();
    drawRoutePolylines();
  }
}

/**
 * 区間手段セレクタの操作可否を切り替える
 * @param {boolean} disabled - trueで無効化
 */
function setSegmentControlsDisabled(disabled) {
  const selects = ui.routeResults.querySelectorAll('.segment-mode-select');
  selects.forEach((element) => {
    const select = /** @type {HTMLSelectElement} */ (element);
    select.disabled = disabled;
  });
}

/**
 * 指定区間を電車（公共交通）で再計算する
 * @param {{name:string,latLng:google.maps.LatLng}} from - 出発地点
 * @param {{name:string,latLng:google.maps.LatLng}} to - 到着地点
 * @returns {Promise<ReturnType<typeof createLegMetrics>>} 区間メトリクス
 */
async function requestTransitSegmentMetrics(from, to) {
  const request = {
    origin: from.latLng,
    destination: to.latLng,
    travelMode: google.maps.TravelMode.TRANSIT,
    // Transit requests often need a departureTime to find available schedules
    transitOptions: {
      departureTime: new Date(),
    },
  };

  const result = await runDirectionsRequest(request);
  const route = result.routes && result.routes[0];
  const leg = route && route.legs && route.legs[0];

  if (!route || !leg) {
    throw new Error('電車ルートのレスポンスに区間情報がありません。');
  }

  const overviewPath = Array.isArray(route.overview_path) ? route.overview_path : null;
  return createLegMetrics(leg, overviewPath);
}

/**
 * 現在のrouteStateに基づいてポリラインを描画する
 */
function drawRoutePolylines() {
  clearSegmentPolylines();

  if (!map || !routeState) {
    return;
  }

  routeState.segments.forEach((segment) => {
    const path = segment.activeMetrics.path;
    if (!Array.isArray(path) || path.length < 2) {
      return;
    }

    const polyline = new google.maps.Polyline({
      map,
      path,
      strokeColor: SEGMENT_STROKE_COLOR[segment.mode] || SEGMENT_STROKE_COLOR[SEGMENT_MODE.WALKING],
      strokeOpacity: 0.9,
      strokeWeight: 6,
    });

    segmentPolylines.push(polyline);
  });
}

/**
 * 指定地点群が見えるように地図表示範囲を調整する
 * @param {Array<{latLng:google.maps.LatLng}>} points - 対象地点配列
 */
function fitMapToWaypoints(points) {
  if (!map || !Array.isArray(points) || points.length === 0) {
    return;
  }

  if (points.length === 1) {
    map.panTo(points[0].latLng);
    if ((map.getZoom() || 0) < 15) {
      map.setZoom(15);
    }
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  points.forEach((point) => {
    if (point && point.latLng) {
      bounds.extend(point.latLng);
    }
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, 64);
  }
}

/**
 * サマリーカードを作成する
 * @param {string} label - ラベル
 * @param {string} value - 値
 * @returns {HTMLDivElement} サマリーカード
 */
function createSummaryCard(label, value) {
  const card = document.createElement('div');
  card.className = 'summary-card';

  const labelElement = document.createElement('span');
  labelElement.className = 'summary-label';
  labelElement.textContent = label;

  const valueElement = document.createElement('strong');
  valueElement.className = 'summary-value';
  valueElement.textContent = value;

  card.append(labelElement, valueElement);
  return card;
}

/**
 * 距離メートル値をkm文字列に変換する
 * @param {number} meters - 距離（m）
 * @returns {string} km文字列
 */
function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return '0.00 km';
  }

  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
}

/**
 * 秒数を日本語の時間文字列に変換する
 * @param {number} seconds - 秒数
 * @returns {string} 時間文字列
 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0分';
  }

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes}分`;
  }
  if (minutes === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${minutes}分`;
}
