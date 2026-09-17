import {
  STUDY_DATA, STUDY_TREND_LINE, predictStudyScore, STUDY_QUESTION_HOURS,
  PARK_DATA, predictVisitors, PARK_QUESTION_CONDITION,
  ICE_CREAM_DATA, predictIceCreamSales, ICE_CREAM_NEW_CONDITION, ICE_CREAM_ACTUAL_SALES,
} from "./game-core.js";

const $ = (selector) => document.querySelector(selector);

const PHASES = { ONE: "one", TWO: "two", THREE: "three", RESULTS: "results" };
const STAGE_INFO = {
  [PHASES.ONE]: { index: 1, name: "하나의 속성으로 예측하기" },
  [PHASES.TWO]: { index: 2, name: "두 가지 속성으로 예측하기" },
  [PHASES.THREE]: { index: 3, name: "여러 속성으로 예측하기" },
  [PHASES.RESULTS]: { index: 3, name: "결과" },
};

let phase = PHASES.ONE;

function scrollTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

function showPhaseView() {
  $("#stage1-view").hidden = phase !== PHASES.ONE;
  $("#stage2-view").hidden = phase !== PHASES.TWO;
  $("#stage3-view").hidden = phase !== PHASES.THREE;
  $("#results-view").hidden = phase !== PHASES.RESULTS;
  $("#experiment-head").hidden = phase === PHASES.RESULTS;
  const info = STAGE_INFO[phase];
  $("#stage-label").textContent = `${info.index} / 3단계 · ${info.name}`;
  $("#progress-bar").style.width = `${(info.index / 3) * 100}%`;
}

// --- 데이터 표 렌더링(고정 데이터를 game-core.js에서 그대로 읽어와 화면과 어긋나지 않게 한다) ---
function renderTable(tableEl, headers, rows) {
  const thead = `<thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
  tableEl.innerHTML = thead + tbody;
}

function renderStudyTable() {
  renderTable($("#study-table"), ["공부 시간", "시험 점수"], STUDY_DATA.map((d) => [`${d.hours}시간`, `${d.score}점`]));
}

function renderParkTable() {
  renderTable(
    $("#park-table"),
    ["기온", "강수량", "방문객 수"],
    PARK_DATA.map((d) => [`${d.temp}℃`, `${d.rain}mm`, `${d.visitors.toLocaleString()}명`]),
  );
}

function renderIceCreamTable() {
  renderTable(
    $("#ice-cream-table"),
    ["기온", "비", "주말", "화분 개수", "직원 이름 글자 수", "실제 판매량"],
    ICE_CREAM_DATA.map((d) => [`${d.temp}℃`, d.rain ? "O" : "X", d.weekend ? "O" : "X", `${d.pots}개`, `${d.nameLength}글자`, `${d.sales}개`]),
  );
}

// --- 활동 1 전용 SVG 산점도 -----------------------------------------------
const CHART_W = 280;
const CHART_H = 200;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 30;
const X_DOMAIN = [0, 7];
const Y_DOMAIN = [40, 95];
const X_TICKS = [0, 1, 2, 3, 4, 5, 6, 7];
const Y_TICKS = [40, 50, 60, 70, 80, 90];

function chartX(x) {
  return PAD_L + ((x - X_DOMAIN[0]) / (X_DOMAIN[1] - X_DOMAIN[0])) * (CHART_W - PAD_L - PAD_R);
}

function chartY(y) {
  return (CHART_H - PAD_B) - ((y - Y_DOMAIN[0]) / (Y_DOMAIN[1] - Y_DOMAIN[0])) * (CHART_H - PAD_T - PAD_B);
}

function renderStage1Chart({ showTrend, highlight }) {
  const gridLines = Y_TICKS.map((t) =>
    `<line x1="${PAD_L}" y1="${chartY(t)}" x2="${CHART_W - PAD_R}" y2="${chartY(t)}" class="grid-line" />`,
  ).join("");
  const yLabels = Y_TICKS.map((t) =>
    `<text x="${PAD_L - 6}" y="${chartY(t) + 3}" class="axis-label" text-anchor="end">${t}</text>`,
  ).join("");
  const xLabels = X_TICKS.map((t) =>
    `<text x="${chartX(t)}" y="${CHART_H - PAD_B + 14}" class="axis-label" text-anchor="middle">${t}</text>`,
  ).join("");
  const axisLines = `
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${CHART_H - PAD_B}" class="axis-line" />
    <line x1="${PAD_L}" y1="${CHART_H - PAD_B}" x2="${CHART_W - PAD_R}" y2="${CHART_H - PAD_B}" class="axis-line" />
  `;
  const axisCaptions = `
    <text x="${CHART_W - PAD_R}" y="${CHART_H - 4}" class="axis-caption" text-anchor="end">공부 시간(시간)</text>
    <text x="6" y="${PAD_T - 2}" class="axis-caption" text-anchor="start">점수(점)</text>
  `;
  const points = STUDY_DATA.map((d) =>
    `<circle class="data-point" cx="${chartX(d.hours)}" cy="${chartY(d.score)}" r="5" />`,
  ).join("");

  let trendMarkup = "";
  if (showTrend) {
    const [x1, x2] = X_DOMAIN;
    const y1 = STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * x1;
    const y2 = STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * x2;
    trendMarkup = `<line x1="${chartX(x1)}" y1="${chartY(y1)}" x2="${chartX(x2)}" y2="${chartY(y2)}" class="trend-line" />`;
  }

  let highlightMarkup = "";
  if (highlight) {
    highlightMarkup = `<circle class="data-point predicted-point" cx="${chartX(highlight.x)}" cy="${chartY(highlight.y)}" r="6" />`;
  }

  $("#stage1-chart").innerHTML = `${gridLines}${axisLines}${axisCaptions}${yLabels}${xLabels}${points}${trendMarkup}${highlightMarkup}`;
}

// --- 활동 1 ------------------------------------------------------------------
function renderStage1() {
  renderStudyTable();
  renderStage1Chart({ showTrend: false, highlight: null });
}

function handleStage1Submit(event) {
  event.preventDefault();
  const input = $("#stage1-guess");
  const guess = Number(input.value);
  const aiScore = predictStudyScore(STUDY_QUESTION_HOURS);

  $("#stage1-feedback").textContent = `내 예측: ${guess}점을 확인했습니다.`;
  $("#stage1-ai-score").textContent = `${aiScore}점`;
  $("#stage1-reveal").hidden = false;
  renderStage1Chart({ showTrend: true, highlight: { x: STUDY_QUESTION_HOURS, y: aiScore } });

  input.disabled = true;
  $("#stage1-form button[type=submit]").disabled = true;
  $("#stage1-next").disabled = false;
}

function goToStage2() {
  phase = PHASES.TWO;
  showPhaseView();
  renderStage2();
  scrollTop();
  $("#stage2-title")?.focus?.();
}

// --- 활동 2 ------------------------------------------------------------------
function renderStage2() {
  renderParkTable();
}

function handleStage2Submit(event) {
  event.preventDefault();
  const input = $("#stage2-guess");
  const guess = Number(input.value);
  const aiVisitors = predictVisitors(PARK_QUESTION_CONDITION.temp, PARK_QUESTION_CONDITION.rain);

  $("#stage2-feedback").textContent = `내 예측: ${guess.toLocaleString()}명을 확인했습니다.`;
  $("#stage2-ai-visitors").textContent = `${aiVisitors.toLocaleString()}명`;
  $("#stage2-reveal").hidden = false;

  input.disabled = true;
  $("#stage2-form button[type=submit]").disabled = true;

  $("#stage2-explore").hidden = false;
  $("#stage2-temp").value = String(PARK_QUESTION_CONDITION.temp);
  $("#stage2-rain").value = String(PARK_QUESTION_CONDITION.rain);
  onStage2ExploreInput();

  $("#stage2-next").disabled = false;
}

function onStage2ExploreInput() {
  const temp = Number($("#stage2-temp").value);
  const rain = Number($("#stage2-rain").value);
  $("#stage2-temp-value").textContent = `${temp}℃`;
  $("#stage2-rain-value").textContent = `${rain}mm`;
  const visitors = predictVisitors(temp, rain);
  $("#stage2-live").textContent = `AI 예측: ${visitors.toLocaleString()}명`;
}

function goToStage3() {
  phase = PHASES.THREE;
  showPhaseView();
  renderStage3();
  scrollTop();
  $("#stage3-title")?.focus?.();
}

// --- 활동 3 ------------------------------------------------------------------
function renderStage3() {
  renderIceCreamTable();
}

function handleStage3Submit(event) {
  event.preventDefault();
  const input = $("#stage3-guess");
  const guess = Number(input.value);
  const aiSales = predictIceCreamSales(
    ICE_CREAM_NEW_CONDITION.temp,
    ICE_CREAM_NEW_CONDITION.rain,
    ICE_CREAM_NEW_CONDITION.weekend,
  );
  const error = Math.abs(ICE_CREAM_ACTUAL_SALES - aiSales);

  $("#stage3-feedback").textContent = `내 예측: ${guess}개를 확인했습니다.`;
  $("#stage3-my-guess").innerHTML = `${guess}<span class="unit">개</span>`;
  $("#stage3-ai-sales").innerHTML = `${aiSales}<span class="unit">개</span>`;
  $("#stage3-actual-sales").innerHTML = `${ICE_CREAM_ACTUAL_SALES}<span class="unit">개</span>`;
  $("#stage3-error").textContent = `${error}개`;
  $("#stage3-reveal").hidden = false;

  input.disabled = true;
  $("#stage3-form button[type=submit]").disabled = true;

  $("#stage3-explore").hidden = false;
  $("#stage3-temp").value = String(ICE_CREAM_NEW_CONDITION.temp);
  $("#stage3-rain").checked = ICE_CREAM_NEW_CONDITION.rain;
  $("#stage3-weekend").checked = ICE_CREAM_NEW_CONDITION.weekend;
  $("#stage3-pots").value = String(ICE_CREAM_NEW_CONDITION.pots);
  $("#stage3-name-length").value = String(ICE_CREAM_NEW_CONDITION.nameLength);
  onStage3ExploreInput();

  $("#stage3-next").disabled = false;
}

function onStage3ExploreInput() {
  const temp = Number($("#stage3-temp").value);
  const rain = $("#stage3-rain").checked;
  const weekend = $("#stage3-weekend").checked;
  const pots = Number($("#stage3-pots").value);
  const nameLength = Number($("#stage3-name-length").value);

  $("#stage3-temp-value").textContent = `${temp}℃`;
  $("#stage3-pots-value").textContent = `${pots}개`;
  $("#stage3-name-length-value").textContent = `${nameLength}글자`;

  // 화분 개수·이름 글자 수는 predictIceCreamSales의 입력값으로 아예 쓰이지 않는다(무관한 정보라는
  // 점을 계수를 0으로 흉내 내는 게 아니라 함수 시그니처 자체로 보장한다) — 그래서 두 슬라이더를
  // 움직여도(pots, nameLength) 아래 실시간 예측값은 전혀 바뀌지 않는다.
  const sales = predictIceCreamSales(temp, rain, weekend);
  $("#stage3-live").textContent = `AI 예측: ${sales}개`;
}

function goToResults() {
  phase = PHASES.RESULTS;
  showPhaseView();
  scrollTop();
  $("#results-title")?.focus?.();
}

// --- 재시작 -------------------------------------------------------------------
function restart() {
  phase = PHASES.ONE;
  showPhaseView();

  $("#stage1-guess").value = "";
  $("#stage1-guess").disabled = false;
  $("#stage1-form button[type=submit]").disabled = false;
  $("#stage1-feedback").textContent = "";
  $("#stage1-reveal").hidden = true;
  $("#stage1-next").disabled = true;
  renderStage1();

  $("#stage2-guess").value = "";
  $("#stage2-guess").disabled = false;
  $("#stage2-form button[type=submit]").disabled = false;
  $("#stage2-feedback").textContent = "";
  $("#stage2-reveal").hidden = true;
  $("#stage2-explore").hidden = true;
  $("#stage2-next").disabled = true;

  $("#stage3-guess").value = "";
  $("#stage3-guess").disabled = false;
  $("#stage3-form button[type=submit]").disabled = false;
  $("#stage3-feedback").textContent = "";
  $("#stage3-reveal").hidden = true;
  $("#stage3-explore").hidden = true;
  $("#stage3-next").disabled = true;
  $("#stage3-checklist").querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });

  scrollTop();
}

// --- 이벤트 바인딩 -------------------------------------------------------------
$("#stage1-form").addEventListener("submit", handleStage1Submit);
$("#stage1-next").addEventListener("click", goToStage2);

$("#stage2-form").addEventListener("submit", handleStage2Submit);
$("#stage2-temp").addEventListener("input", onStage2ExploreInput);
$("#stage2-rain").addEventListener("input", onStage2ExploreInput);
$("#stage2-next").addEventListener("click", goToStage3);

$("#stage3-form").addEventListener("submit", handleStage3Submit);
$("#stage3-temp").addEventListener("input", onStage3ExploreInput);
$("#stage3-rain").addEventListener("change", onStage3ExploreInput);
$("#stage3-weekend").addEventListener("change", onStage3ExploreInput);
$("#stage3-pots").addEventListener("input", onStage3ExploreInput);
$("#stage3-name-length").addEventListener("input", onStage3ExploreInput);
$("#stage3-next").addEventListener("click", goToResults);

$("#restart-button").addEventListener("click", restart);
$("#projector-toggle").addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  $("#projector-toggle").setAttribute("aria-pressed", String(enabled));
});

showPhaseView();
renderStage1();
