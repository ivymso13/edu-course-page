import {
  COLUMNS,
  COLUMN_LABEL,
  DESCRIBE_ROWS,
  MULTI_FEATURES,
  SIMPLE_FEATURES,
  column,
  ipythonTuple,
  newSeed,
  numpyRepr1d,
  numpyReprColumn,
  numpyStr1d,
  pandasColumnFormatter,
  pandasFloat6,
  parseNeck,
  predictOne,
  prepareLesson,
  pyFloat,
  shuffledSplit,
  trainAndScore,
} from "./game-core.js";
import { displayPython, initNotebookCells } from "../penguins-data/notebook-ui.js";

const CSV_URL = "../../data/ml-practice/jeans.csv";
const SVG_NS = "http://www.w3.org/2000/svg";
// 분류 실습의 .chart-wrap과 같이 고정 viewBox를 쓰고, 좁은 화면에서는 래퍼 안에서 좌우로 스크롤한다.
const PLOT = { width: 640, height: 420, left: 64, right: 20, top: 20, bottom: 56, font: 12, label: 14, r: 3.5 };
const POINT_COLOR = "#1f5fbf";
const LINE_COLOR = "#d62728";
const PREVIEW_LINES = 6;

const $ = (selector) => document.querySelector(selector);
const state = { lesson: null, split: null, simple: null, multiple: null, page: 0, newNeck: null };

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

function setOutput(target, text, placeholder = false) {
  const node = typeof target === "string" ? $(target) : target;
  node.textContent = text;
  node.classList.toggle("placeholder", placeholder);
}

// ---------- pandas 표 ----------

function renderTable(container, headers, bodyRows, caption) {
  const wrap = el("div", { class: "table-wrap", tabindex: 0, role: "region", "aria-label": `${caption} (좌우 스크롤 가능)` });
  const table = el("table", { class: "lab-table" });
  if (caption) table.appendChild(el("caption", { class: "sr-only" }, caption));
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", { scope: "col" }, ""));
  headers.forEach((name) => headRow.appendChild(el("th", { scope: "col" }, name)));
  thead.appendChild(headRow);
  const tbody = el("tbody");
  bodyRows.forEach(({ label, cells }) => {
    const tr = el("tr");
    tr.appendChild(el("th", { scope: "row" }, label));
    cells.forEach((cell) => tr.appendChild(el("td", {}, cell)));
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  wrap.appendChild(table);
  container.replaceChildren(wrap);
}

function renderRowsTable(container, start, end, caption) {
  const rows = state.lesson.rows;
  const visible = rows.slice(start, end);
  const formatters = Object.fromEntries(COLUMNS.map((name) => [name, pandasColumnFormatter(column(visible, name))]));
  renderTable(
    container,
    COLUMNS,
    visible.map((row, offset) => ({ label: String(start + offset), cells: COLUMNS.map((name) => formatters[name](row[name])) })),
    caption,
  );
}

function renderBrowse() {
  const total = state.lesson.rows.length;
  const size = Number($("#browse-size").value);
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  state.page = Math.min(Math.max(state.page, 0), lastPage);
  const start = state.page * size;
  const end = Math.min(start + size, total);
  renderRowsTable($("#browse-table"), start, end, `전체 데이터 ${start}~${end - 1}번 행`);
  $("#browse-status").textContent = `${start}~${end - 1}번 행 / 전체 ${total}행`;
  $("#browse-prev").disabled = state.page === 0;
  $("#browse-next").disabled = state.page === lastPage;
}

function renderExplore() {
  const { rows, summary, corr } = state.lesson;
  $("#regression-shape").textContent = `${rows.length}행 × ${COLUMNS.length}열 · 중복 행 포함`;
  renderRowsTable($("#head-table"), 0, 5, "df.head() 결과");
  renderBrowse();
  renderTable(
    $("#describe-table"),
    COLUMNS,
    DESCRIBE_ROWS.map((stat) => ({ label: stat, cells: COLUMNS.map((name) => pandasFloat6(summary[name][stat])) })),
    "df.describe() 결과",
  );
  renderTable(
    $("#corr-table"),
    COLUMNS,
    COLUMNS.map((a) => ({ label: a, cells: COLUMNS.map((b) => pandasFloat6(corr[a][b])) })),
    "df.corr(numeric_only=True) 결과",
  );
  const ranked = COLUMNS.filter((name) => name !== "waist").sort((a, b) => corr.waist[b] - corr.waist[a]);
  $("#corr-note").textContent = `허리둘레(waist)와의 상관계수: ${ranked
    .map((name) => `${COLUMN_LABEL[name]} ${corr.waist[name].toFixed(2)}`)
    .join(" · ")}. 1에 가까울수록 함께 커지는 경향이 강합니다.`;

  const full = ipythonTuple([numpyReprColumn(column(rows, "neck")), numpyRepr1d(column(rows, "waist"))]);
  const lines = full.split("\n");
  setOutput("#xy-preview", `${lines.slice(0, PREVIEW_LINES).join("\n")}\n        ...`);
  setOutput("#xy-full", full);
}

// ---------- 분할 · 학습 ----------

function renderSplit() {
  const metrics = $("#split-metrics");
  metrics.replaceChildren(
    metric("전체", `${state.lesson.rows.length}행`),
    metric("훈련 데이터 (70%)", `${state.split.train.length}행`),
    metric("테스트 데이터 (30%)", `${state.split.test.length}행`),
  );
}

function metric(label, value) {
  const item = el("div", { class: "metric" });
  item.append(el("span", {}, label), el("strong", {}, value));
  return item;
}

function resetModels() {
  state.simple = null;
  state.multiple = null;
  renderSimple();
  renderMultiple();
}

function makeSplit() {
  state.split = shuffledSplit(state.lesson.rows.length, newSeed());
  renderSplit();
  resetModels();
}

const WAIT_FIT = "위의 [모델 학습하기] 버튼을 누르면 결과가 나타납니다.";

function renderSimple() {
  const result = state.simple;
  $("#fit-simple").textContent = result ? "다시 학습하기" : "모델 학습하기";
  document.body.toggleAttribute("data-simple-fitted", Boolean(result));
  if (!result) {
    setOutput("#fit-output", "아직 학습하지 않았습니다.", true);
    for (const id of ["#coef-output", "#score-output", "#predict-output", "#new-predict-output"]) setOutput(id, WAIT_FIT, true);
    $("#coef-note").textContent = "";
    $("#neck-error").textContent = "";
    renderChart();
    setPredictionEnabled(false);
    return;
  }
  const { model, test, pred, r2 } = result;
  setOutput("#fit-output", "LinearRegression()");
  setOutput("#coef-output", `${numpyStr1d(model.coef)} ${pyFloat(model.intercept)}`);
  const sign = model.intercept < 0 ? "−" : "+";
  $("#coef-note").textContent =
    `회귀계수(coef_)는 목둘레가 1cm 늘 때 예측 허리둘레가 약 ${model.coef[0].toFixed(2)}cm 변한다는 뜻이고, ` +
    `절편(intercept_)은 cm 단위의 상수입니다. 예측식: 허리둘레 ≈ ${model.coef[0].toFixed(2)} × 목둘레 ${sign} ${Math.abs(model.intercept).toFixed(2)}`;
  setOutput("#score-output", pyFloat(r2));
  setOutput("#predict-output", `예측값: ${numpyStr1d(pred.slice(0, 5))}\n실제값: ${numpyStr1d(test.y.slice(0, 5))}`);
  setPredictionEnabled(true);
  renderNewPrediction();
  renderChart();
}

function fitSimple() {
  state.simple = trainAndScore(state.lesson.rows, state.split, SIMPLE_FEATURES);
  renderSimple();
  renderMultiple();
}

function renderMultiple() {
  const result = state.multiple;
  $("#fit-multiple").textContent = result ? "다시 학습하기" : "다중 회귀 모델 학습하기";
  const compare = $("#compare-metrics");
  if (!result) {
    setOutput("#multiple-output", "위의 [다중 회귀 모델 학습하기] 버튼을 누르면 결과가 나타납니다.", true);
    compare.replaceChildren();
    compare.hidden = true;
    return;
  }
  setOutput("#multiple-output", `모델 결정 계수: ${pyFloat(result.r2)}`);
  compare.hidden = false;
  compare.replaceChildren(
    metric("목둘레만 사용 (단순 선형 회귀)", state.simple ? state.simple.r2.toFixed(3) : "5단계에서 학습 전"),
    metric("목둘레·몸무게·엉덩이둘레 (다중 선형 회귀)", result.r2.toFixed(3)),
  );
}

function fitMultiple() {
  state.multiple = trainAndScore(state.lesson.rows, state.split, MULTI_FEATURES);
  renderMultiple();
}

// ---------- 새 목둘레 예측 ----------

function setPredictionEnabled(enabled) {
  const form = $("#predict-form");
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !enabled;
  });
  form.toggleAttribute("data-disabled", !enabled);
}

function renderNewPrediction() {
  if (!state.simple) return;
  const parsed = parseNeck($("#neck-input").value);
  const input = $("#neck-input");
  if (!parsed.ok) {
    $("#neck-error").textContent = parsed.message;
    input.setAttribute("aria-invalid", "true");
    state.newNeck = null;
    setOutput("#new-predict-output", "", true);
    renderChart();
    return;
  }
  input.removeAttribute("aria-invalid");
  $("#neck-error").textContent = "";
  state.newNeck = parsed.value;
  const value = predictOne(state.simple.model, [parsed.value]);
  displayPython($("#new-predict-code"), `model.predict([[${pyFloat(parsed.value)}]])`);
  setOutput("#new-predict-output", `${numpyRepr1d([value])}\n\n→ 목둘레 ${parsed.value}cm이면 허리둘레를 약 ${value.toFixed(1)}cm로 예측합니다.`);
  renderChart();
}

// ---------- 그래프 ----------

function niceTicks(min, max, count = 6) {
  const span = max - min;
  const rough = span / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((candidate) => span / candidate <= count) ?? 10 * power;
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

function renderChart() {
  const chart = $("#regression-chart");
  [...chart.children].forEach((child) => {
    if (child.tagName !== "title" && child.tagName !== "desc") child.remove();
  });
  const caption = $("#chart-caption");
  const result = state.simple;
  if (!result) {
    caption.textContent = "5단계에서 모델을 학습하면 그래프가 나타납니다.";
    svg("text", { x: PLOT.width / 2, y: PLOT.height / 2, "text-anchor": "middle", class: "regression-chart-empty", fill: "#6b7280", "font-size": 16 }, chart).textContent = "모델 학습 전";
    return;
  }
  const xs = result.test.X.map((row) => row[0]);
  const ys = result.test.y;
  const allX = column(state.lesson.rows, "neck");
  const allY = column(state.lesson.rows, "waist");
  const pad = (lo, hi) => [lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04];
  let [xMin, xMax] = pad(Math.min(...allX), Math.max(...allX));
  let [yMin, yMax] = pad(Math.min(...allY), Math.max(...allY));
  if (state.newNeck !== null) {
    const newY = predictOne(result.model, [state.newNeck]);
    xMin = Math.min(xMin, state.newNeck - 0.5);
    xMax = Math.max(xMax, state.newNeck + 0.5);
    yMin = Math.min(yMin, newY - 2);
    yMax = Math.max(yMax, newY + 2);
  }
  const innerW = PLOT.width - PLOT.left - PLOT.right;
  const innerH = PLOT.height - PLOT.top - PLOT.bottom;
  const sx = (x) => PLOT.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y) => PLOT.top + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  const grid = svg("g", { class: "regression-grid", stroke: "#e5e7eb", "stroke-width": 1 }, chart);
  const ticks = svg("g", { class: "regression-tick", fill: "#4b5563", "font-size": PLOT.font }, chart);
  niceTicks(xMin, xMax).forEach((x) => {
    svg("line", { x1: sx(x), x2: sx(x), y1: PLOT.top, y2: PLOT.top + innerH }, grid);
    svg("text", { x: sx(x), y: PLOT.top + innerH + 18, "text-anchor": "middle" }, ticks).textContent = String(x);
  });
  niceTicks(yMin, yMax).forEach((y) => {
    svg("line", { x1: PLOT.left, x2: PLOT.left + innerW, y1: sy(y), y2: sy(y) }, grid);
    svg("text", { x: PLOT.left - 8, y: sy(y) + 4, "text-anchor": "end" }, ticks).textContent = String(y);
  });
  svg("rect", { class: "regression-axis", x: PLOT.left, y: PLOT.top, width: innerW, height: innerH, fill: "none", stroke: "#9ca3af" }, chart);
  const labels = svg("g", { class: "regression-axis-label", fill: "#111827", "font-size": PLOT.label }, chart);
  svg("text", { x: PLOT.left + innerW / 2, y: PLOT.height - 12, "text-anchor": "middle" }, labels).textContent = "neck";
  svg("text", { x: 14, y: PLOT.top + innerH / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${PLOT.top + innerH / 2})` }, labels).textContent = "waist";

  const points = svg("g", { class: "regression-points", fill: POINT_COLOR, "fill-opacity": 0.55 }, chart);
  xs.forEach((x, i) => svg("circle", { class: "regression-point", cx: sx(x).toFixed(1), cy: sy(ys[i]).toFixed(1), r: PLOT.r }, points));

  // plt.plot(X_test, pred)와 같은 직선을 x 순서대로 정렬해 그린다.
  const sorted = xs.map((x, i) => [x, result.pred[i]]).sort((a, b) => a[0] - b[0]);
  const lineStart = sorted[0];
  const lineEnd = sorted[sorted.length - 1];
  svg("line", {
    class: "regression-line",
    x1: sx(lineStart[0]), y1: sy(lineStart[1]), x2: sx(lineEnd[0]), y2: sy(lineEnd[1]),
    stroke: LINE_COLOR, "stroke-width": 3, "stroke-linecap": "round",
  }, chart);

  let captionText = `파란 점: 테스트 데이터 ${xs.length}명 · 빨간 선: 모델의 예측`;
  if (state.newNeck !== null) {
    const newY = predictOne(result.model, [state.newNeck]);
    const group = svg("g", { class: "regression-new-point" }, chart);
    svg("line", { x1: sx(state.newNeck), x2: sx(state.newNeck), y1: PLOT.top + innerH, y2: sy(newY), stroke: "#111827", "stroke-dasharray": "4 4" }, group);
    svg("circle", { cx: sx(state.newNeck), cy: sy(newY), r: 7, fill: "#ffffff", stroke: "#111827", "stroke-width": 3 }, group);
    captionText += ` · ◯: 새로 입력한 목둘레 ${state.newNeck}cm의 예측`;
  }
  caption.textContent = captionText;
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
  $("#reshuffle").addEventListener("click", makeSplit);
  $("#fit-simple").addEventListener("click", fitSimple);
  $("#fit-multiple").addEventListener("click", fitMultiple);
  $("#predict-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderNewPrediction();
  });
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
  renderExplore();
  makeSplit();
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
