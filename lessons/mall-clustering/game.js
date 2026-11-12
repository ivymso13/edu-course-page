import {
  AGE,
  COLUMNS,
  FEATURES_2D,
  FEATURES_3D,
  INCOME,
  K_RANGE,
  N_INIT,
  SEED,
  SPENDING,
  clusterCounts,
  fitKMeans,
  floatMatrixRepr,
  intArrayRepr,
  predictKMeans,
  prepareLesson,
  pyFloat,
  rotate3D,
  silhouetteScore,
} from "./game-core.js";
import { displayPython, initNotebookCells } from "../penguins-data/notebook-ui.js";

const CSV_URL = "../../data/ml-practice/Mall_Customers.csv";
const SVG_NS = "http://www.w3.org/2000/svg";
// seaborn "bright" 팔레트(2차원 그래프)와 plotly qualitative.Bold 팔레트(3차원 그래프)의 앞쪽 색.
const BRIGHT = ["#023eff", "#ff7c00", "#1ac938", "#e8000b", "#8b2be2", "#9f4800", "#f14cc1", "#a3a3a3"];
const BOLD = ["#7f3c8d", "#11a579", "#3969ac", "#f2b701", "#e73f74"];
const PLOT = { width: 640, height: 440, left: 64, right: 20, top: 20, bottom: 56, font: 12, label: 14, r: 4.5 };
const VIEW3D = { width: 640, height: 520, scale: 150, cx: 320, cy: 270, yaw: -0.65, pitch: 0.42, step: Math.PI / 18 };
const AXIS_SHORT = { [INCOME]: "연간 소득(k$)", [SPENDING]: "소비 점수", [AGE]: "나이(세)" };

const $ = (selector) => document.querySelector(selector);
const state = { lesson: null, k: K_RANGE.default, model2: null, model3: null, page: 0, yaw: VIEW3D.yaw, pitch: VIEW3D.pitch };

function el(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== "") node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (parent) parent.appendChild(node);
  return node;
}

function clearSvg(chart) {
  [...chart.children].forEach((child) => {
    if (child.tagName !== "title" && child.tagName !== "desc") child.remove();
  });
}

function setOutput(target, text, placeholder = false) {
  const node = typeof target === "string" ? $(target) : target;
  node.textContent = text;
  node.classList.toggle("placeholder", placeholder);
}

function metric(label, value) {
  const item = el("div", { class: "metric" });
  item.append(el("span", {}, label), el("strong", {}, value));
  return item;
}

const fmt = (value, digits = 2) => Number(value.toFixed(digits)).toString();

// ---------- pandas 표 ----------

function renderTable(container, headers, bodyRows, caption, footer = "") {
  const wrap = el("div", { class: "table-wrap", tabindex: 0, role: "region", "aria-label": `${caption} (좌우 스크롤 가능)` });
  const table = el("table", { class: "lab-table" });
  table.appendChild(el("caption", { class: "sr-only" }, caption));
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { scope: "col" }, ""));
  headers.forEach((name) => headRow.appendChild(el("th", { scope: "col" }, name)));
  thead.appendChild(headRow);
  const tbody = el("tbody");
  bodyRows.forEach(({ label, cells, ellipsis }) => {
    const tr = el("tr", ellipsis ? { class: "ellipsis-row" } : {});
    tr.appendChild(el("th", { scope: "row" }, label));
    cells.forEach((cell) => tr.appendChild(el("td", {}, cell)));
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  wrap.appendChild(table);
  const nodes = [wrap];
  if (footer) nodes.push(el("p", { class: "table-shape" }, footer));
  container.replaceChildren(...nodes);
}

function rowCells(row, columns, labels) {
  return columns.map((name) => (name === "centroid" ? String(labels[row.index]) : String(row[name])));
}

function dfColumns(labels) {
  return labels ? [...COLUMNS, "centroid"] : COLUMNS;
}

function indexedRows(start, end) {
  return state.lesson.rows.slice(start, end).map((row, offset) => ({ ...row, index: start + offset }));
}

function renderRows(container, start, end, caption, labels = null, columns = null) {
  const cols = columns ?? dfColumns(labels);
  renderTable(container, cols, indexedRows(start, end).map((row) => ({ label: String(row.index), cells: rowCells(row, cols, labels) })), caption);
}

// pandas가 긴 표를 보여 주듯 앞 5행 · … · 뒤 5행과 크기를 보여 준다.
function renderTruncatedDf(container, labels = null) {
  const total = state.lesson.rows.length;
  const cols = dfColumns(labels);
  const body = indexedRows(0, 5).map((row) => ({ label: String(row.index), cells: rowCells(row, cols, labels) }));
  body.push({ label: "…", cells: cols.map(() => "…"), ellipsis: true });
  indexedRows(total - 5, total).forEach((row) => body.push({ label: String(row.index), cells: rowCells(row, cols, labels) }));
  renderTable(container, cols, body, "df 출력", `${total} rows × ${cols.length} columns`);
}

function renderBrowse() {
  const total = state.lesson.rows.length;
  const size = Number($("#browse-size").value);
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  state.page = Math.min(Math.max(state.page, 0), lastPage);
  const start = state.page * size;
  const end = Math.min(start + size, total);
  const labels = state.model2?.labels ?? null;
  renderRows($("#browse-table"), start, end, `전체 데이터 ${start}~${end - 1}번 행`, labels);
  $("#browse-status").textContent = `${start}~${end - 1}번 행 / 전체 ${total}행`;
  $("#browse-prev").disabled = state.page === 0;
  $("#browse-next").disabled = state.page === lastPage;
}

function renderData() {
  const { rows } = state.lesson;
  $("#mall-shape").textContent = `${rows.length}행 × ${COLUMNS.length}열`;
  renderTruncatedDf($("#df-table"));
  renderRows($("#data-head-table"), 0, 5, "data.head() 결과", null, FEATURES_2D);
  renderBrowse();
}

// ---------- 2차원 군집 ----------

const WAIT_FIT = "3단계의 [모델 학습하기] 버튼을 누르면 결과가 나타납니다.";

function fitCode(k) {
  return `from sklearn.cluster import KMeans\n\n# 군집 모델 생성 및 학습(p121)\nmodel = KMeans(n_clusters=${k})\nmodel.fit(data)`;
}

function fit2D() {
  const X = state.lesson.X2;
  const model = fitKMeans(X, { k: state.k, nInit: N_INIT, seed: SEED });
  const pred = predictKMeans(model, X);
  state.model2 = { ...model, pred, counts: clusterCounts(model.labels, model.k), silhouette: silhouetteScore(X, pred) };
  render2D();
}

function reset2D() {
  state.model2 = null;
  render2D();
}

function clusterSummaryTable(container, model, features, caption) {
  const headers = ["고객 수", ...features.map((name) => `중심 ${AXIS_SHORT[name]}`)];
  renderTable(
    container,
    headers,
    model.centers.map((center, c) => ({ label: `군집 ${c}`, cells: [`${model.counts[c]}명`, ...center.map((value) => fmt(value))] })),
    caption,
  );
  const note = el("p", { class: "lab-note" }, "웹에서 정리한 보조 표: 군집 번호별 고객 수와 중심 좌표(소수 둘째 자리까지)입니다.");
  container.appendChild(note);
}

function renderLegend(container, model, colors, centerLabel) {
  if (!model) {
    container.replaceChildren();
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const items = model.counts.map((count, c) => {
    const item = el("span", { class: "cluster-legend-item" });
    const swatch = el("i", { class: "cluster-swatch", "aria-hidden": "true" });
    swatch.style.background = colors[c % colors.length];
    item.append(swatch, document.createTextNode(`군집 ${c} (${count}명)`));
    return item;
  });
  const center = el("span", { class: "cluster-legend-item cluster-legend-center" });
  center.append(el("i", { class: "cluster-center-mark", "aria-hidden": "true" }, centerLabel.mark), document.createTextNode(centerLabel.text));
  container.replaceChildren(...items, center);
}

function render2D() {
  const result = state.model2;
  $("#fit-2d").textContent = result ? "다시 학습하기" : "모델 학습하기";
  document.body.toggleAttribute("data-clustered", Boolean(result));
  displayPython($("#fit-code"), fitCode(state.k));
  const fitMetrics = $("#fit-metrics");
  const silMetrics = $("#silhouette-metrics");
  if (!result) {
    setOutput("#fit-output", "아직 학습하지 않았습니다.", true);
    for (const id of ["#pred-output", "#centers-output", "#silhouette-output"]) setOutput(id, WAIT_FIT, true);
    fitMetrics.replaceChildren();
    fitMetrics.hidden = true;
    silMetrics.replaceChildren();
    silMetrics.hidden = true;
    $("#cluster-summary").replaceChildren();
    $("#df-head-table").replaceChildren(el("p", { class: "lab-note placeholder-note" }, WAIT_FIT));
    renderLegend($("#cluster-legend"), null);
    renderChart2D();
    if (state.lesson) renderBrowse();
    return;
  }
  setOutput("#fit-output", `KMeans(n_clusters=${result.k})`);
  fitMetrics.hidden = false;
  fitMetrics.replaceChildren(
    metric("군집 수 (n_clusters)", `${result.k}개`),
    metric("시작 중심 시도 (n_init)", `${result.nInit}번`),
    metric("가장 좋은 시도의 반복", `${result.nIter}번 · ${result.converged ? "수렴" : "최대 반복 도달"}`),
    metric("inertia (거리 제곱합)", fmt(result.inertia, 1)),
  );
  setOutput("#pred-output", intArrayRepr(result.pred));
  setOutput("#centers-output", floatMatrixRepr(result.centers));
  clusterSummaryTable($("#cluster-summary"), result, FEATURES_2D, "군집별 고객 수와 중심");
  renderRows($("#df-head-table"), 0, 5, "df.head() 결과", result.labels);
  setOutput("#silhouette-output", pyFloat(result.silhouette));
  silMetrics.hidden = false;
  silMetrics.replaceChildren(metric(`실루엣 점수 (군집 ${result.k}개)`, result.silhouette.toFixed(3)));
  renderLegend($("#cluster-legend"), result, BRIGHT, { mark: "★", text: "Centroid (중심)" });
  renderChart2D();
  renderBrowse();
}

// ---------- 2차원 그래프 ----------

function niceTicks(min, max, count = 6) {
  const span = max - min;
  const rough = span / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((candidate) => span / candidate <= count) ?? 10 * power;
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

function renderChart2D() {
  const chart = $("#cluster-chart");
  clearSvg(chart);
  const result = state.model2;
  const caption = $("#chart-caption");
  if (!result) {
    caption.textContent = "3단계에서 모델을 학습하면 그래프가 나타납니다.";
    svg("text", { x: PLOT.width / 2, y: PLOT.height / 2, "text-anchor": "middle", class: "cluster-chart-empty", fill: "#6b7280", "font-size": 16 }, chart).textContent = "모델 학습 전";
    return;
  }
  const X = state.lesson.X2;
  const xs = X.map((p) => p[0]);
  const ys = X.map((p) => p[1]);
  const pad = (lo, hi) => [lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05];
  const [xMin, xMax] = pad(Math.min(...xs), Math.max(...xs));
  const [yMin, yMax] = pad(Math.min(...ys), Math.max(...ys));
  const innerW = PLOT.width - PLOT.left - PLOT.right;
  const innerH = PLOT.height - PLOT.top - PLOT.bottom;
  const sx = (x) => PLOT.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y) => PLOT.top + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  const grid = svg("g", { class: "cluster-grid", stroke: "#e5e7eb", "stroke-width": 1 }, chart);
  const ticks = svg("g", { class: "cluster-tick", fill: "#4b5563", "font-size": PLOT.font }, chart);
  niceTicks(xMin, xMax).forEach((x) => {
    svg("line", { x1: sx(x), x2: sx(x), y1: PLOT.top, y2: PLOT.top + innerH }, grid);
    svg("text", { x: sx(x), y: PLOT.top + innerH + 18, "text-anchor": "middle" }, ticks).textContent = String(x);
  });
  niceTicks(yMin, yMax).forEach((y) => {
    svg("line", { x1: PLOT.left, x2: PLOT.left + innerW, y1: sy(y), y2: sy(y) }, grid);
    svg("text", { x: PLOT.left - 8, y: sy(y) + 4, "text-anchor": "end" }, ticks).textContent = String(y);
  });
  svg("rect", { class: "cluster-axis", x: PLOT.left, y: PLOT.top, width: innerW, height: innerH, fill: "none", stroke: "#9ca3af" }, chart);
  const labels = svg("g", { class: "cluster-axis-label", fill: "#111827", "font-size": PLOT.label }, chart);
  svg("text", { x: PLOT.left + innerW / 2, y: PLOT.height - 12, "text-anchor": "middle" }, labels).textContent = INCOME;
  svg("text", { x: 14, y: PLOT.top + innerH / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${PLOT.top + innerH / 2})` }, labels).textContent = SPENDING;

  const points = svg("g", { class: "cluster-points", stroke: "#ffffff", "stroke-width": 0.8 }, chart);
  X.forEach(([x, y], i) => {
    const label = result.labels[i];
    const dot = svg("circle", { class: "cluster-point", "data-cluster": label, cx: sx(x).toFixed(1), cy: sy(y).toFixed(1), r: PLOT.r, fill: BRIGHT[label % BRIGHT.length] }, points);
    svg("title", {}, dot).textContent = `${i}번 고객 · 소득 ${x} · 소비 점수 ${y} · 군집 ${label}`;
  });
  const centers = svg("g", { class: "cluster-centers" }, chart);
  result.centers.forEach(([x, y], c) => {
    const star = svg("path", { class: "cluster-center", d: starPath(sx(x), sy(y), 13, 5.5), fill: "#000000", stroke: "#ffffff", "stroke-width": 1.2 }, centers);
    svg("title", {}, star).textContent = `군집 ${c} 중심 · 소득 ${fmt(x)} · 소비 점수 ${fmt(y)}`;
  });
  caption.textContent = `점 ${X.length}개(고객) · 색: 군집 번호 0~${result.k - 1} · 검은 별: 군집 중심 ${result.k}개`;
}

// ---------- 3차원 군집 ----------

function fit3D() {
  const X = state.lesson.X3;
  const model = fitKMeans(X, { k: 5, nInit: N_INIT, seed: SEED });
  state.model3 = { ...model, counts: clusterCounts(model.labels, model.k) };
  render3D();
}

function render3D() {
  const result = state.model3;
  $("#fit-3d").textContent = result ? "다시 학습하기" : "3개 특징으로 학습하기";
  const metrics = $("#fit3d-metrics");
  const box = $("#cluster-3d");
  box.dataset.ready = String(Boolean(result));
  box.querySelectorAll("[data-rotate]").forEach((button) => {
    button.disabled = !result;
  });
  if (!result) {
    metrics.replaceChildren();
    metrics.hidden = true;
    $("#cluster-3d-summary").replaceChildren();
    renderLegend($("#cluster-3d-legend"), null);
    renderChart3D();
    return;
  }
  metrics.hidden = false;
  metrics.replaceChildren(
    metric("사용한 속성", `${result.nFeatures}개`),
    metric("군집 수 · 시작 중심 시도", `${result.k}개 · ${result.nInit}번`),
    metric("가장 좋은 시도의 반복", `${result.nIter}번 · ${result.converged ? "수렴" : "최대 반복 도달"}`),
    metric("inertia (거리 제곱합)", fmt(result.inertia, 1)),
  );
  clusterSummaryTable($("#cluster-3d-summary"), result, FEATURES_3D, "3개 특징 군집별 고객 수와 중심");
  renderLegend($("#cluster-3d-legend"), result, BOLD, { mark: "◆", text: "Centroid (중심)" });
  renderChart3D();
}

function cubeMapper(X) {
  const mins = [0, 1, 2].map((j) => Math.min(...X.map((p) => p[j])));
  const maxs = [0, 1, 2].map((j) => Math.max(...X.map((p) => p[j])));
  return {
    mins,
    maxs,
    toCube: (p) => p.map((value, j) => (value - mins[j]) / (maxs[j] - mins[j]) - 0.5),
  };
}

function project(cubePoint) {
  const r = rotate3D(cubePoint, state.yaw, state.pitch);
  return { x: VIEW3D.cx + r.x * VIEW3D.scale * 1.6, y: VIEW3D.cy + r.y * VIEW3D.scale * 1.6, depth: r.depth };
}

function renderChart3D() {
  const chart = $("#cluster-3d-chart");
  clearSvg(chart);
  const result = state.model3;
  if (!result) {
    svg("text", { x: VIEW3D.width / 2, y: VIEW3D.height / 2, "text-anchor": "middle", class: "cluster-chart-empty", fill: "#6b7280", "font-size": 16 }, chart).textContent = "3개 특징으로 학습하기 전";
    $("#angle-status").textContent = "";
    return;
  }
  const X = state.lesson.X3;
  const { mins, maxs, toCube } = cubeMapper(X);
  // 상자의 모서리 12개
  const corners = [];
  for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) for (const c of [-0.5, 0.5]) corners.push([a, b, c]);
  const edges = [];
  corners.forEach((p, i) => corners.forEach((q, j) => {
    if (j > i && p.filter((v, d) => v !== q[d]).length === 1) edges.push([p, q]);
  }));
  const frame = svg("g", { class: "cluster-3d-frame", stroke: "#cbd5e1", "stroke-width": 1, fill: "none" }, chart);
  edges.forEach(([p, q]) => {
    const a = project(p);
    const b = project(q);
    svg("line", { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1) }, frame);
  });
  // 세 축: 원점 모서리(-0.5,-0.5,-0.5)에서 뻗는 선과 눈금·이름
  const axes = svg("g", { class: "cluster-3d-axes" }, chart);
  const origin = [-0.5, -0.5, -0.5];
  FEATURES_3D.forEach((name, d) => {
    const end = origin.slice();
    end[d] = 0.5;
    const a = project(origin);
    const b = project(end);
    svg("line", { class: "cluster-3d-axis", x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), stroke: "#374151", "stroke-width": 2 }, axes);
    // 세 축이 만나는 꼭짓점에는 눈금 글자가 겹치므로 0은 빼고, 글자는 상자 바깥쪽으로 조금 밀어 둔다.
    const center = project([0, 0, 0]);
    [0.25, 0.5, 0.75, 1].forEach((t) => {
      const point = origin.slice();
      point[d] = -0.5 + t;
      const s = project(point);
      const away = { x: s.x - center.x, y: s.y - center.y };
      const length = Math.hypot(away.x, away.y) || 1;
      const value = mins[d] + t * (maxs[d] - mins[d]);
      svg("circle", { class: "cluster-3d-tick-mark", cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 2, fill: "#374151" }, axes);
      svg("text", { class: "cluster-3d-tick", x: (s.x + (away.x / length) * 16).toFixed(1), y: (s.y + (away.y / length) * 16 + 4).toFixed(1), "text-anchor": "middle", "font-size": 11, fill: "#4b5563" }, axes).textContent = fmt(value, 0);
    });
    const labelPoint = origin.slice();
    labelPoint[d] = 0.72;
    const l = project(labelPoint);
    svg("text", { class: "cluster-3d-axis-label", x: l.x.toFixed(1), y: l.y.toFixed(1), "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "#111827" }, axes).textContent = AXIS_SHORT[name];
  });
  // 점과 중심을 깊이 순서(먼 것부터)로 그린다.
  const items = X.map((p, i) => ({ kind: "point", i, label: result.labels[i], value: p, s: project(toCube(p)) }));
  result.centers.forEach((center, c) => items.push({ kind: "center", i: c, label: c, value: center, s: project(toCube(center)) }));
  items.sort((a, b) => b.s.depth - a.s.depth);
  const marks = svg("g", { class: "cluster-3d-marks" }, chart);
  items.forEach((item) => {
    const { x, y } = item.s;
    const [income, spending, age] = item.value;
    if (item.kind === "point") {
      const dot = svg("circle", { class: "cluster-point", "data-cluster": item.label, cx: x.toFixed(1), cy: y.toFixed(1), r: 4.2, fill: BOLD[item.label % BOLD.length], "fill-opacity": 0.7, stroke: "#ffffff", "stroke-width": 0.6 }, marks);
      svg("title", {}, dot).textContent = `${item.i}번 고객 · 소득 ${income} · 소비 점수 ${spending} · 나이 ${age} · 군집 ${item.label}`;
    } else {
      const size = 10;
      const diamond = svg("path", { class: "cluster-center", d: `M${x},${y - size}L${x + size},${y}L${x},${y + size}L${x - size},${y}Z`, fill: "#000000", stroke: "#ffffff", "stroke-width": 1.5 }, marks);
      svg("title", {}, diamond).textContent = `군집 ${item.label} 중심 · 소득 ${fmt(income)} · 소비 점수 ${fmt(spending)} · 나이 ${fmt(age)}`;
    }
  });
  const degrees = (rad) => Math.round((rad * 180) / Math.PI);
  $("#angle-status").textContent = `현재 방향: 좌우 ${degrees(state.yaw)}° · 위아래 ${degrees(state.pitch)}°`;
}

const PITCH_LIMIT = Math.PI / 2 - 0.05;

function rotateBy(dYaw, dPitch) {
  if (!state.model3) return;
  state.yaw = Math.atan2(Math.sin(state.yaw + dYaw), Math.cos(state.yaw + dYaw));
  state.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, state.pitch + dPitch));
  renderChart3D();
}

function resetView() {
  state.yaw = VIEW3D.yaw;
  state.pitch = VIEW3D.pitch;
  renderChart3D();
}

function bindRotation() {
  const wrap = $("#cluster-3d-wrap");
  const step = VIEW3D.step;
  const actions = { left: () => rotateBy(-step, 0), right: () => rotateBy(step, 0), up: () => rotateBy(0, step), down: () => rotateBy(0, -step), reset: resetView };
  $("#cluster-3d").querySelectorAll("[data-rotate]").forEach((button) => {
    button.addEventListener("click", () => actions[button.dataset.rotate]());
  });
  wrap.addEventListener("keydown", (event) => {
    const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Home: "reset" };
    const action = map[event.key];
    if (!action || !state.model3) return;
    event.preventDefault();
    actions[action]();
  });
  let drag = null;
  wrap.addEventListener("pointerdown", (event) => {
    if (!state.model3) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    wrap.setPointerCapture?.(event.pointerId);
  });
  wrap.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    rotateBy(dx * 0.01, dy * 0.01);
  });
  const end = (event) => {
    if (drag && drag.id === event.pointerId) drag = null;
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
}

// ---------- 시작 ----------

function bind() {
  $("#browse-size").addEventListener("change", () => {
    state.page = 0;
    renderBrowse();
  });
  $("#browse-prev").addEventListener("click", () => {
    state.page -= 1;
    renderBrowse();
  });
  $("#browse-next").addEventListener("click", () => {
    state.page += 1;
    renderBrowse();
  });
  $("#k-select").addEventListener("change", (event) => {
    const k = Number(event.target.value);
    if (!Number.isInteger(k) || k < K_RANGE.min || k > K_RANGE.max) return;
    state.k = k;
    reset2D();
  });
  $("#fit-2d").addEventListener("click", fit2D);
  $("#fit-3d").addEventListener("click", fit3D);
  bindRotation();
}

async function init() {
  const status = $("#load-status");
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`데이터를 불러오지 못했습니다 (${response.status})`);
    state.lesson = prepareLesson(await response.text());
  } catch (error) {
    status.textContent = `데이터를 불러오지 못했습니다. 페이지를 새로고침해 주세요. (${error.message})`;
    status.classList.add("error");
    status.setAttribute("role", "alert");
    return;
  }
  bind();
  renderData();
  render2D();
  render3D();
  initNotebookCells();
  status.hidden = true;
  $("#lab-content").hidden = false;
  watchSteps();
}

// ---------- 단계 이동 (한 페이지 안의 앵커) ----------

function watchSteps() {
  const links = [...document.querySelectorAll('.lab-nav a[href^="#"]')];
  const mark = (id) =>
    links.forEach((link) => {
      if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  const sections = links.map((link) => document.getElementById(link.getAttribute("href").slice(1))).filter(Boolean);
  let pending = false;
  const update = () => {
    pending = false;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const line = window.innerHeight * 0.3;
    const current = atBottom ? sections[sections.length - 1] : sections.filter((section) => section.getBoundingClientRect().top <= line).pop() ?? sections[0];
    mark(current.id);
  };
  window.addEventListener("scroll", () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

$("#projector-toggle").addEventListener("click", () => {
  const active = document.body.classList.toggle("projector-mode");
  $("#projector-toggle").setAttribute("aria-pressed", String(active));
});

init();
