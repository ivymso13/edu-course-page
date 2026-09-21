import {
  STUDY_DATA, STUDY_TREND_LINE, predictStudyScore, STUDY_QUESTION_HOURS,
  PARK_DATA, predictVisitors, PARK_QUESTION_CONDITION,
  ICE_CREAM_DATA, ICE_CREAM_LABELS, classifyIceCreamCrowd, ICE_CREAM_NEW_CONDITION, ICE_CREAM_ACTUAL_CROWD,
  CITY_CLIMATE, CITY_CLUSTER_K, clusterCities, alignBundlesToClusters,
} from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// PHASES.TWO("두 가지 속성으로 예측하기" 회귀 활동)는 숨김 처리했다 — 탭·다음 버튼
// 내비게이션에서 완전히 제외하고, 나머지 세 활동을 1·2·3으로 다시 번호 매긴다. 코드/HTML은
// 그대로 남겨 두어(삭제 아님) 필요하면 나중에 다시 노출할 수 있게 했다.
const PHASES = { ONE: "one", TWO: "two", THREE: "three", FOUR: "four", RESULTS: "results" };
const TOTAL_STAGES = 3;
const STAGE_INFO = {
  [PHASES.ONE]: { index: 1, name: "하나의 속성으로 예측하기" },
  [PHASES.TWO]: { index: 2, name: "두 가지 속성으로 예측하기" }, // 숨김 처리, 도달 불가
  [PHASES.THREE]: { index: 2, name: "여러 속성으로 예측하기" },
  [PHASES.FOUR]: { index: 3, name: "비슷한 것끼리 묶어보기" },
  [PHASES.RESULTS]: { index: 3, name: "결과" },
};
// 상단 탭 버튼으로 활동 1~3(내부적으로는 ONE·THREE·FOUR)을 순서와 상관없이 자유롭게
// 오갈 수 있다. 이동할 때 포커스를 옮길 제목과, 다시 그려야 할 화면(표 등)을 여기서
// 한곳에 모아 관리한다.
const STAGE_FOCUS_TARGET = {
  [PHASES.ONE]: "#experiment-title",
  [PHASES.TWO]: "#stage2-title",
  [PHASES.THREE]: "#stage3-title",
  [PHASES.FOUR]: "#stage4-title",
  [PHASES.RESULTS]: "#results-title",
};
const STAGE_RENDER = {
  [PHASES.ONE]: renderStage1,
  [PHASES.TWO]: renderStage2,
  [PHASES.THREE]: renderStage3,
  [PHASES.FOUR]: renderStage4,
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
  $("#stage4-view").hidden = phase !== PHASES.FOUR;
  $("#results-view").hidden = phase !== PHASES.RESULTS;
  $("#experiment-head").hidden = phase === PHASES.RESULTS;
  const info = STAGE_INFO[phase];
  $("#stage-label").textContent = `${info.index} / ${TOTAL_STAGES}단계 · ${info.name}`;
  $("#progress-bar").style.width = `${(info.index / TOTAL_STAGES) * 100}%`;

  $$("#stage-tabs .stage-tab").forEach((tab) => {
    const isCurrent = tab.dataset.stage === phase;
    tab.classList.toggle("is-current", isCurrent);
    if (isCurrent) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
}

// 상단 탭에서 활동을 고르면(완료 여부와 상관없이) 곧바로 그 화면으로 이동한다. "다음" 버튼과
// 달리 순서를 지키지 않아도 되므로, 데이터 표처럼 아직 안 그렸을 수 있는 화면만 다시 그린다.
function goToStage(target) {
  phase = target;
  showPhaseView();
  STAGE_RENDER[target]?.();
  scrollTop();
  $(STAGE_FOCUS_TARGET[target])?.focus?.();
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
    ["기온", "날씨", "방문객 수"],
    PARK_DATA.map((d) => [`${d.temp}℃`, d.weather, `${d.visitors.toLocaleString()}명`]),
  );
}

function renderIceCreamTable() {
  renderTable(
    $("#ice-cream-table"),
    ["기온", "유동인구", "사장님 기분", "지나가는 고양이 수", "매장 상태"],
    ICE_CREAM_DATA.map((d, i) => [
      `${d.temp}℃`, `${d.traffic}명`, d.mood, `${d.cats}마리`, ICE_CREAM_LABELS[i],
    ]),
  );
}

// --- 활동 1 전용 SVG 산점도 -----------------------------------------------
const CHART_W = 280;
const CHART_H = 200;
const PAD_L = 40;
const PAD_R = 14;
// y축의 가장 높은 눈금이 항상 PAD_T 자리(맨 위)에 그려지므로(computeYDomain 참고),
// "점수(점)" 캡션이 그 눈금 라벨과 같은 자리에서 겹치지 않도록 위쪽 여백을 넉넉히 둔다.
const PAD_T = 26;
const PAD_B = 30;
const X_DOMAIN = [0, 7];
const X_TICKS = [0, 1, 2, 3, 4, 5, 6, 7];

// 내 예측이 데이터 범위를 크게 벗어나도(예: 30점, 100점) 잘리지 않도록, y축 범위를
// 실제로 표시할 값들(데이터 + 내 예측 + AI 예측)에 맞춰 매번 다시 계산한다.
function niceStep(range) {
  if (range <= 30) return 5;
  if (range <= 60) return 10;
  if (range <= 120) return 20;
  return 25;
}

function computeYDomain(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(Math.max(max - min, 1));
  const lo = Math.floor(min / step) * step - step;
  const hi = Math.ceil(max / step) * step + step;
  const ticks = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

function chartX(x) {
  return PAD_L + ((x - X_DOMAIN[0]) / (X_DOMAIN[1] - X_DOMAIN[0])) * (CHART_W - PAD_L - PAD_R);
}

function makeChartY(yDomain) {
  return (y) => (CHART_H - PAD_B) - ((y - yDomain.lo) / (yDomain.hi - yDomain.lo)) * (CHART_H - PAD_T - PAD_B);
}

function renderStage1Chart({ showTrend, myGuess, aiPrediction }) {
  const values = STUDY_DATA.map((d) => d.score);
  if (myGuess) values.push(myGuess.y);
  if (aiPrediction) values.push(aiPrediction.y);
  const yDomain = computeYDomain(values);
  const chartY = makeChartY(yDomain);

  const gridLines = yDomain.ticks.map((t) =>
    `<line x1="${PAD_L}" y1="${chartY(t)}" x2="${CHART_W - PAD_R}" y2="${chartY(t)}" class="grid-line" />`,
  ).join("");
  const yLabels = yDomain.ticks.map((t) =>
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
    <text x="6" y="10" class="axis-caption" text-anchor="start">점수(점)</text>
  `;
  const points = STUDY_DATA.map((d) =>
    `<circle class="data-point" cx="${chartX(d.hours)}" cy="${chartY(d.score)}" r="5" />`,
  ).join("");

  let trendMarkup = "";
  let guideMarkup = "";
  if (showTrend) {
    const [x1, x2] = X_DOMAIN;
    const y1 = STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * x1;
    const y2 = STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * x2;
    trendMarkup = `<line x1="${chartX(x1)}" y1="${chartY(y1)}" x2="${chartX(x2)}" y2="${chartY(y2)}" class="trend-line" />`;
    const gx = chartX(STUDY_QUESTION_HOURS);
    guideMarkup = `<line x1="${gx}" y1="${PAD_T}" x2="${gx}" y2="${CHART_H - PAD_B}" class="target-guide-line" />`;
  }

  // 내 예측(주황)과 AI 예측(빨강)을 같은 x=6 자리에 함께 찍어, 그래프 위에서 바로 비교할 수 있게 한다.
  let myGuessMarkup = "";
  if (myGuess) {
    myGuessMarkup = `<circle class="data-point guess-point" cx="${chartX(myGuess.x)}" cy="${chartY(myGuess.y)}" r="6" />`;
  }
  let aiMarkup = "";
  if (aiPrediction) {
    aiMarkup = `<circle class="data-point predicted-point" cx="${chartX(aiPrediction.x)}" cy="${chartY(aiPrediction.y)}" r="6" />`;
  }

  $("#stage1-chart").innerHTML = `${gridLines}${axisLines}${guideMarkup}${axisCaptions}${yLabels}${xLabels}${points}${trendMarkup}${myGuessMarkup}${aiMarkup}`;
}

// --- 활동 1 ------------------------------------------------------------------
// 산점도는 표만 보고 스스로 예측하게 하려고 제출 전에는 숨겨 두고, 제출한 순간
// 추세선·AI 예측 지점(빨간 점)과 함께 처음으로 보여준다.
function renderStage1() {
  renderStudyTable();
  // 이미 예측을 공개한 뒤 탭으로 다른 활동에 갔다 돌아온 경우에는 그래프를 다시 숨기지 않는다
  // (재시작 시에는 restart()가 stage1-reveal을 먼저 hidden으로 되돌려 두므로 여기서 다시 숨겨진다).
  if ($("#stage1-reveal").hidden) {
    $("#stage1-chart-wrap").hidden = true;
  }
}

function handleStage1Submit(event) {
  event.preventDefault();
  const input = $("#stage1-guess");
  const guess = Number(input.value);
  const aiScore = predictStudyScore(STUDY_QUESTION_HOURS);

  $("#stage1-feedback").textContent = "내 예측과 AI의 예측을 그래프에서 비교해 보세요.";
  $("#stage1-my-score").innerHTML = `${guess}<span class="unit">점</span>`;
  $("#stage1-ai-score").innerHTML = `${aiScore}<span class="unit">점</span>`;
  $("#stage1-reveal").hidden = false;
  $("#stage1-chart-wrap").hidden = false;
  $("#stage1-chart").setAttribute(
    "aria-label",
    `공부 시간과 시험 점수의 관계를 지나는 추세선, 주황색 내 예측(6시간, ${guess}점), 빨간색 AI의 예측(6시간, ${aiScore}점)을 보여주는 산점도`,
  );
  renderStage1Chart({
    showTrend: true,
    myGuess: { x: STUDY_QUESTION_HOURS, y: guess },
    aiPrediction: { x: STUDY_QUESTION_HOURS, y: aiScore },
  });

  input.disabled = true;
  $("#stage1-form button[type=submit]").disabled = true;
  $("#stage1-next").disabled = false;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    $("#stage1-reveal")?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }, 50);
}

// --- 활동 2 ------------------------------------------------------------------
function renderStage2Chart({ myGuess, aiPrediction, livePoint } = {}) {
  const chartEl = $("#stage2-chart");
  if (!chartEl) return;

  const CHART_W = 540;
  const CHART_H = 220;
  const PAD_L = 60;
  const PAD_R = 36;
  const PAD_T = 30;
  const PAD_B = 34;
  const X_DOMAIN = [19, 27];
  const X_TICKS = [20, 21, 22, 23, 24, 25, 26, 27];

  const values = [1600, 1800, 2000, 2200, 2400, 2600];
  if (myGuess && typeof myGuess.y === "number" && !isNaN(myGuess.y)) values.push(myGuess.y);
  if (aiPrediction && typeof aiPrediction.y === "number") values.push(aiPrediction.y);
  if (livePoint && typeof livePoint.y === "number") values.push(livePoint.y);

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const lo = Math.min(1200, Math.floor((minVal - 100) / 200) * 200);
  const hi = Math.max(2800, Math.ceil((maxVal + 100) / 200) * 200);
  const ticks = [];
  for (let t = lo; t <= hi; t += 400) ticks.push(t);

  const chartX = (x) => PAD_L + ((x - X_DOMAIN[0]) / (X_DOMAIN[1] - X_DOMAIN[0])) * (CHART_W - PAD_L - PAD_R);
  const chartY = (y) => (CHART_H - PAD_B) - ((y - lo) / (hi - lo)) * (CHART_H - PAD_T - PAD_B);

  const gridLines = ticks.map((t) =>
    `<line x1="${PAD_L}" y1="${chartY(t)}" x2="${CHART_W - PAD_R}" y2="${chartY(t)}" class="grid-line" />`,
  ).join("");
  const yLabels = ticks.map((t) =>
    `<text x="${PAD_L - 8}" y="${chartY(t) + 3}" class="axis-label" text-anchor="end">${t.toLocaleString()}</text>`,
  ).join("");
  const xLabels = X_TICKS.map((t) =>
    `<text x="${chartX(t)}" y="${CHART_H - PAD_B + 14}" class="axis-label" text-anchor="middle">${t}℃</text>`,
  ).join("");
  const axisLines = `
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${CHART_H - PAD_B}" class="axis-line" />
    <line x1="${PAD_L}" y1="${CHART_H - PAD_B}" x2="${CHART_W - PAD_R}" y2="${CHART_H - PAD_B}" class="axis-line" />
  `;
  const axisCaptions = `
    <text x="${CHART_W - PAD_R}" y="${CHART_H - 6}" class="axis-caption" text-anchor="end">기온(℃)</text>
    <text x="6" y="10" class="axis-caption" text-anchor="start">방문객(명)</text>
  `;

  // 맑은 날 추세선 (y = 100 * x)
  const sunnyX1 = 19.5;
  const sunnyX2 = 26.5;
  const sunnyY1 = 100 * sunnyX1;
  const sunnyY2 = 100 * sunnyX2;
  const sunnyLine = `
    <line x1="${chartX(sunnyX1)}" y1="${chartY(sunnyY1)}" x2="${chartX(sunnyX2)}" y2="${chartY(sunnyY2)}" class="trend-line trend-line--sunny" />
    <text x="${chartX(sunnyX2) + 4}" y="${chartY(sunnyY2) + 3}" class="line-tag line-tag--sunny" text-anchor="start">맑음</text>
  `;

  // 비 오는 날 추세선 (y = 100 * x - 500)
  const rainyX1 = 19.5;
  const rainyX2 = 26.5;
  const rainyY1 = 100 * rainyX1 - 500;
  const rainyY2 = 100 * rainyX2 - 500;
  const rainyLine = `
    <line x1="${chartX(rainyX1)}" y1="${chartY(rainyY1)}" x2="${chartX(rainyX2)}" y2="${chartY(rainyY2)}" class="trend-line trend-line--rainy" />
    <text x="${chartX(rainyX2) + 4}" y="${chartY(rainyY2) + 3}" class="line-tag line-tag--rainy" text-anchor="start">비</text>
  `;

  // 데이터 점들
  const sunnyPoints = PARK_DATA.filter((d) => !d.rain).map((d) =>
    `<circle class="data-point data-point--sunny" cx="${chartX(d.temp)}" cy="${chartY(d.visitors)}" r="5" />`,
  ).join("");
  const rainyPoints = PARK_DATA.filter((d) => d.rain).map((d) =>
    `<circle class="data-point data-point--rainy" cx="${chartX(d.temp)}" cy="${chartY(d.visitors)}" r="5" />`,
  ).join("");

  // 26℃ 타겟 가이드라인 및 -500명 화살표
  const targetX = PARK_QUESTION_CONDITION.temp; // 26
  const gx = chartX(targetX);
  const targetSunnyY = chartY(100 * targetX); // 2600
  const targetRainyY = chartY(100 * targetX - 500); // 2100
  const guideMarkup = `
    <line x1="${gx}" y1="${PAD_T}" x2="${gx}" y2="${CHART_H - PAD_B}" class="target-guide-line" />
    <line x1="${gx + 8}" y1="${targetSunnyY}" x2="${gx + 8}" y2="${targetRainyY}" class="diff-guide-line" />
    <polygon points="${gx + 8},${targetRainyY} ${gx + 4},${targetRainyY - 6} ${gx + 12},${targetRainyY - 6}" class="diff-arrow-head" />
    <text x="${gx + 16}" y="${(targetSunnyY + targetRainyY) / 2 + 4}" class="diff-guide-text">-500명(비)</text>
    <circle cx="${gx}" cy="${targetSunnyY}" r="3.5" class="guide-ghost-point" />
  `;

  let myGuessMarkup = "";
  if (myGuess && typeof myGuess.y === "number") {
    myGuessMarkup = `<circle class="data-point guess-point" cx="${chartX(myGuess.x)}" cy="${chartY(myGuess.y)}" r="6" />`;
  }
  let aiMarkup = "";
  if (aiPrediction && typeof aiPrediction.y === "number") {
    aiMarkup = `<circle class="data-point predicted-point" cx="${chartX(aiPrediction.x)}" cy="${chartY(aiPrediction.y)}" r="6" />`;
  }
  let liveMarkup = "";
  if (livePoint && typeof livePoint.y === "number") {
    liveMarkup = `<circle class="data-point live-point" cx="${chartX(livePoint.x)}" cy="${chartY(livePoint.y)}" r="5.5" />`;
  }

  chartEl.innerHTML = `${gridLines}${axisLines}${axisCaptions}${yLabels}${xLabels}${sunnyLine}${rainyLine}${guideMarkup}${sunnyPoints}${rainyPoints}${myGuessMarkup}${aiMarkup}${liveMarkup}`;
}

function renderStage2() {
  renderParkTable();
  renderStage2Chart();
}

function toggleStage2ChartHint() {
  const revealBox = $("#stage2-reveal");
  const btn = $("#stage2-hint-chart-btn");
  if (!revealBox) return;

  const isCurrentlyHidden = revealBox.hidden;
  if (isCurrentlyHidden) {
    revealBox.hidden = false;
    renderStage2Chart();
    if (btn) {
      btn.innerHTML = `<span aria-hidden="true">📈</span> 도출 과정 그래프 접기`;
      btn.setAttribute("aria-expanded", "true");
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#stage2-chart-wrap")?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  } else {
    // 이미 제출 완료된 상태면 접지 않음
    if ($("#stage2-form button[type=submit]").disabled) return;
    revealBox.hidden = true;
    if (btn) {
      btn.innerHTML = `<span aria-hidden="true">📈</span> 도출 과정 그래프 먼저 보기`;
      btn.setAttribute("aria-expanded", "false");
    }
  }
}

function handleStage2Submit(event) {
  event.preventDefault();
  const input = $("#stage2-guess");
  const guess = Number(input.value);
  const aiVisitors = predictVisitors(PARK_QUESTION_CONDITION.temp, PARK_QUESTION_CONDITION.rain);

  $("#stage2-feedback").textContent = `내 예측: ${guess.toLocaleString()}명을 확인했습니다.`;
  $("#stage2-ai-visitors").textContent = `${aiVisitors.toLocaleString()}명`;
  if ($("#stage2-my-score")) {
    $("#stage2-my-score").textContent = `${guess.toLocaleString()}명`;
  }
  $("#stage2-reveal").hidden = false;
  const hintBtn = $("#stage2-hint-chart-btn");
  if (hintBtn) hintBtn.hidden = true;

  input.disabled = true;
  $("#stage2-form button[type=submit]").disabled = true;

  renderStage2Chart({
    myGuess: { x: PARK_QUESTION_CONDITION.temp, y: guess },
    aiPrediction: { x: PARK_QUESTION_CONDITION.temp, y: aiVisitors },
  });

  $("#stage2-explore").hidden = false;
  $("#stage2-temp").value = String(PARK_QUESTION_CONDITION.temp);
  const rainInput = $("#stage2-rain");
  if (rainInput.type === "checkbox") {
    rainInput.checked = Boolean(PARK_QUESTION_CONDITION.rain);
  } else {
    rainInput.value = String(PARK_QUESTION_CONDITION.rain);
  }
  onStage2ExploreInput();

  $("#stage2-next").disabled = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    $("#stage2-reveal")?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }, 50);
}

function onStage2ExploreInput() {
  const temp = Number($("#stage2-temp").value);
  const rainInput = $("#stage2-rain");
  const hasRain = rainInput.type === "checkbox" ? (rainInput.checked ? 1 : 0) : Number(rainInput.value);
  $("#stage2-temp-value").textContent = `${temp}℃`;
  if ($("#stage2-rain-value")) {
    $("#stage2-rain-value").textContent = hasRain ? "비" : "맑음";
  }
  const visitors = predictVisitors(temp, hasRain);
  $("#stage2-live").textContent = `AI 예측: ${visitors.toLocaleString()}명`;

  if (!$("#stage2-reveal").hidden) {
    const baseVisitors = temp * 100;
    const diffVisitors = hasRain ? 500 : 0;
    if ($("#stage2-breakdown-base")) $("#stage2-breakdown-base").innerHTML = `${baseVisitors.toLocaleString()}<span class="unit">명</span>`;
    if ($("#stage2-breakdown-diff")) $("#stage2-breakdown-diff").innerHTML = `${diffVisitors.toLocaleString()}<span class="unit">명</span>`;
    if ($("#stage2-breakdown-diff-desc")) $("#stage2-breakdown-diff-desc").textContent = hasRain ? "비 오는 날 차감" : "맑은 날 (차감 없음)";
    if ($("#stage2-breakdown-final")) $("#stage2-breakdown-final").innerHTML = `${visitors.toLocaleString()}<span class="unit">명</span>`;

    const guess = Number($("#stage2-guess").value);
    renderStage2Chart({
      myGuess: guess ? { x: PARK_QUESTION_CONDITION.temp, y: guess } : null,
      aiPrediction: { x: PARK_QUESTION_CONDITION.temp, y: predictVisitors(PARK_QUESTION_CONDITION.temp, PARK_QUESTION_CONDITION.rain) },
      livePoint: { x: temp, y: visitors },
    });
  }
}

// --- 활동 3: 분류(k-NN) 전용 SVG 산점도 --------------------------------------
// x축은 기온, y축은 유동인구 — 둘 다 수치형이라 활동 1의 산점도와 같은 방식으로
// 과거 사례를 실제 좌표에 점으로 찍고, 눈으로 바로 군집을 확인할 수 있다.
function stage3Domain() {
  const temps = ICE_CREAM_DATA.map((d) => d.temp);
  const traffics = ICE_CREAM_DATA.map((d) => d.traffic);
  return {
    temp: [Math.min(...temps) - 4, Math.max(...temps) + 4],
    traffic: [Math.min(...traffics) - 30, Math.max(...traffics) + 30],
  };
}

// 제출 시점의 "내 예측"은 탐색 슬라이더를 움직여도 그래프 위에서 위치가 바뀌지 않는다
// (그 학생이 실제로 제출한 조건이므로 고정). "AI의 예측"은 탐색 슬라이더 값에 맞춰
// 매번 다시 계산되어 그래프 위에서 움직인다(활동 2의 livePoint와 같은 방식).
let stage3MyGuess = null;

function renderStage3Chart({ myGuess, ai } = {}) {
  const chartEl = $("#stage3-chart");
  if (!chartEl) return;

  const W = 280, H = 200, PAD_L = 44, PAD_R = 14, PAD_T = 26, PAD_B = 30;
  const domain = stage3Domain();
  const x = (temp) => PAD_L + ((temp - domain.temp[0]) / (domain.temp[1] - domain.temp[0])) * (W - PAD_L - PAD_R);
  const y = (traffic) => (H - PAD_B) - ((traffic - domain.traffic[0]) / (domain.traffic[1] - domain.traffic[0])) * (H - PAD_T - PAD_B);

  const xTicks = [15, 20, 25, 30, 35].filter((t) => t >= domain.temp[0] && t <= domain.temp[1]);
  const yTicks = [50, 100, 150, 200, 250].filter((t) => t >= domain.traffic[0] && t <= domain.traffic[1]);

  const gridLines = yTicks.map((t) =>
    `<line x1="${PAD_L}" y1="${y(t)}" x2="${W - PAD_R}" y2="${y(t)}" class="grid-line" />`,
  ).join("");
  const yLabels = yTicks.map((t) =>
    `<text x="${PAD_L - 6}" y="${y(t) + 3}" class="axis-label" text-anchor="end">${t}</text>`,
  ).join("");
  const xLabels = xTicks.map((t) =>
    `<text x="${x(t)}" y="${H - PAD_B + 14}" class="axis-label" text-anchor="middle">${t}</text>`,
  ).join("");
  const axisLines = `
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" class="axis-line" />
    <line x1="${PAD_L}" y1="${H - PAD_B}" x2="${W - PAD_R}" y2="${H - PAD_B}" class="axis-line" />
  `;
  const axisCaptions = `
    <text x="${W - PAD_R}" y="${H - 4}" class="axis-caption" text-anchor="end">기온(℃)</text>
    <text x="6" y="10" class="axis-caption" text-anchor="start">유동인구(명)</text>
  `;

  const neighborIndices = new Set(ai?.neighborIndices ?? []);
  const dataPoints = ICE_CREAM_DATA.map((d, i) => {
    const cx = x(d.temp);
    const cy = y(d.traffic);
    const cls = ICE_CREAM_LABELS[i] === "붐빔" ? "class-point--busy" : "class-point--calm";
    const highlight = neighborIndices.has(i) ? " neighbor-highlight" : "";
    const r = neighborIndices.has(i) ? 7 : 5;
    return `<circle class="data-point ${cls}${highlight}" cx="${cx}" cy="${cy}" r="${r}" />`;
  }).join("");

  let neighborLines = "";
  let aiMarkup = "";
  if (ai) {
    const aqx = x(ai.temp);
    const aqy = y(ai.traffic);
    neighborLines = Array.from(neighborIndices).map((i) => {
      const d = ICE_CREAM_DATA[i];
      return `<line x1="${aqx}" y1="${aqy}" x2="${x(d.temp)}" y2="${y(d.traffic)}" class="neighbor-line" />`;
    }).join("");
    aiMarkup = `<circle class="data-point predicted-point" cx="${aqx + 5}" cy="${aqy - 5}" r="6" />`;
  }

  let myMarkup = "";
  if (myGuess) {
    const mqx = x(myGuess.temp);
    const mqy = y(myGuess.traffic);
    myMarkup = `<circle class="data-point guess-point" cx="${mqx - 5}" cy="${mqy + 5}" r="6" />`;
  }

  chartEl.innerHTML = `${gridLines}${axisLines}${axisCaptions}${yLabels}${xLabels}${dataPoints}${neighborLines}${myMarkup}${aiMarkup}`;
}

// --- 활동 3: 분류(classification) 체험 ---------------------------------------
function renderStage3() {
  renderIceCreamTable();
}

function handleStage3Submit(event) {
  event.preventDefault();
  const checked = document.querySelector('input[name="stage3-guess"]:checked');
  const myGuessLabel = checked?.value;
  const { predictedLabel: aiLabel, neighbors } = classifyIceCreamCrowd(
    ICE_CREAM_NEW_CONDITION.temp,
    ICE_CREAM_NEW_CONDITION.traffic,
  );
  const isMatch = aiLabel === ICE_CREAM_ACTUAL_CROWD;

  $("#stage3-feedback").textContent = `내 예측: ${myGuessLabel}을(를) 확인했습니다.`;
  $("#stage3-my-guess").textContent = myGuessLabel;
  $("#stage3-ai-label").textContent = aiLabel;
  $("#stage3-actual-label").textContent = ICE_CREAM_ACTUAL_CROWD;
  $("#stage3-match-badge").textContent = isMatch ? "일치" : "불일치";
  $("#stage3-match-text").textContent = isMatch
    ? "AI의 예측과 실제 결과가 일치했습니다."
    : "AI의 예측과 실제 결과가 달랐습니다.";
  $("#stage3-match-callout").classList.toggle("is-mismatch", !isMatch);
  $("#stage3-reveal").hidden = false;

  stage3MyGuess = {
    label: myGuessLabel,
    temp: ICE_CREAM_NEW_CONDITION.temp,
    traffic: ICE_CREAM_NEW_CONDITION.traffic,
  };

  document.querySelectorAll('input[name="stage3-guess"]').forEach((radio) => { radio.disabled = true; });
  $("#stage3-form button[type=submit]").disabled = true;

  $("#stage3-explore").hidden = false;
  $("#stage3-temp").value = String(ICE_CREAM_NEW_CONDITION.temp);
  $("#stage3-traffic").value = String(ICE_CREAM_NEW_CONDITION.traffic);
  $("#stage3-mood").checked = ICE_CREAM_NEW_CONDITION.mood === "좋음";
  $("#stage3-cats").value = String(ICE_CREAM_NEW_CONDITION.cats);
  onStage3ExploreInput();

  $("#stage3-next").disabled = false;
}

function onStage3ExploreInput() {
  const temp = Number($("#stage3-temp").value);
  const traffic = Number($("#stage3-traffic").value);
  const cats = Number($("#stage3-cats").value);

  $("#stage3-temp-value").textContent = `${temp}℃`;
  $("#stage3-traffic-value").textContent = `${traffic}명`;
  $("#stage3-cats-value").textContent = `${cats}마리`;

  // 사장님 기분·지나가는 고양이 수는 classifyIceCreamCrowd의 입력값으로 아예 쓰이지 않는다
  // (무관한 정보라는 점을 거리 계산에서 흉내 내는 게 아니라 함수 시그니처 자체로 보장한다) —
  // 그래서 기분 토글·고양이 수 슬라이더를 바꿔도 아래 실시간 예측값은 전혀 바뀌지 않는다.
  const { predictedLabel, neighbors } = classifyIceCreamCrowd(temp, traffic);
  $("#stage3-live").textContent = `AI 예측: ${predictedLabel}`;

  if (!$("#stage3-reveal").hidden) {
    renderStage3Chart({
      myGuess: stage3MyGuess,
      ai: { temp, traffic, neighborIndices: neighbors.map((n) => n.index) },
    });
  }
}

// --- 활동 4: 12개 도시 기온·강수량 직접 군집하기 → AI와 비교 --------------------
// STEP 1에서는 처음부터 그룹 번호를 주지 않는다. 학생이 비슷하다고 생각하는 점을 먼저
// "선택"한 뒤 [선택한 도시 묶기]로 그때그때 새 묶음("묶음 A", "묶음 B", ...)을 만든다.
// 표 행·산점도 점 클릭이 같은 선택 토글(toggleCitySelection)을 공유한다. STEP 2에서는
// 학생이 만든 묶음과 AI(clusterCities, k=4)가 만든 군집을, 묶음 번호가 아니라 "어떤
// 데이터가 함께 묶였는지"(alignBundlesToClusters)로 비교한다.
const CLUSTER_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#9333ea",
];
const BUNDLE_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

// 학생의 선택/묶음 상태와 현재 내부 단계. 다른 활동처럼 상단 탭으로 다른 활동에 갔다
// 돌아와도 이 상태가 유지된다.
let stage4Selection = new Set(); // 아직 묶지 않고 "선택"만 된 city index
let stage4Bundles = []; // [{ id, name: "묶음 A", color, members: [cityIndex, ...] }, ...]
let stage4NextBundleLetter = 0; // 새 묶음에 쓸 다음 글자(해제돼도 재사용 안 함)
let stage4NextBundleId = 1;
let stage4EditingBundleId = null; // [수정] 중이면 그 묶음의 id
let stage4EditingBundleMeta = null; // 수정 중인 묶음의 이름·색(재생성 시 그대로 재사용)
let stage4Step = "assign";

// 실제 도시 이름을 보여주면 "싱가포르=열대"처럼 상식으로 바로 답을 맞혀버릴 수 있다. 그래서
// 표에는 도시 이름 대신 순서 없는 알파벳 라벨(A~L)을 붙이고, 행 순서도 원래 데이터 순서(기후대별
// 그룹핑)가 힌트가 되지 않도록 섞는다. 이 섞기는 표시 순서에만 영향을 줄 뿐 군집 계산
// (clusterCities)과는 무관하므로 무작위(Math.random)로 해도 된다 — 새로고침마다 순서가 달라진다.
const DISPLAY_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
function shuffledIndices(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const stage4DisplayOrder = shuffledIndices(CITY_CLIMATE.length);
function cityLabel(index) {
  return DISPLAY_LABELS[stage4DisplayOrder.indexOf(index)];
}

function climateDomain() {
  const temps = CITY_CLIMATE.map((d) => d.temp);
  const precips = CITY_CLIMATE.map((d) => d.precip);
  return {
    x: [Math.min(...temps) - 4, Math.max(...temps) + 4],
    y: [Math.max(0, Math.min(...precips) - 30), Math.max(...precips) + 30],
  };
}

// 강수량 범위(0~수천mm)가 커서 눈금 간격을 고정값(예: 100)으로 두면 촘촘하거나
// 데이터 대부분이 눈금 밖에 찍히므로, y축 최댓값에 맞춰 "적당한" 간격을 고른다.
function climateYStep(maxValue) {
  if (maxValue <= 300) return 50;
  if (maxValue <= 600) return 100;
  if (maxValue <= 1200) return 200;
  if (maxValue <= 3000) return 500;
  return 1000;
}

// groups: city index -> group key(숫자 또는 묶음 id) 배열, 또는 null(전부 미배정).
// colorFor(key)가 있으면 그 색을 인라인으로 칠하고(묶음은 개수가 가변적이라 고정 클래스 대신
// 인라인 색을 씀), 없으면 AI의 4개 군집처럼 cluster-point--0~3 클래스를 그대로 쓴다.
// selection이 있으면 아직 묶이지 않고 선택만 된 점에 점선 링을 표시한다.
function renderClimateChart(svgSelector, { groups = null, selection = null, colorFor = null } = {}) {
  const svg = $(svgSelector);
  if (!svg) return;

  // 맨 위 눈금이 항상 PAD_T 높이에 그려질 수 있으므로(눈금이 y축 최댓값과 겹치는 경우),
  // "연간 강수량(mm)" 캡션이 그 눈금 라벨과 겹치지 않도록 위쪽 여백을 넉넉히 둔다.
  const W = 280, H = 220, PAD_L = 42, PAD_R = 14, PAD_T = 26, PAD_B = 30;
  const domain = climateDomain();
  const x = (v) => PAD_L + ((v - domain.x[0]) / (domain.x[1] - domain.x[0])) * (W - PAD_L - PAD_R);
  const y = (v) => (H - PAD_B) - ((v - domain.y[0]) / (domain.y[1] - domain.y[0])) * (H - PAD_T - PAD_B);
  const xTicks = [0, 10, 20, 30].filter((t) => t >= domain.x[0] && t <= domain.x[1]);
  const yStep = climateYStep(domain.y[1]);
  const yTicks = [];
  for (let t = 0; t <= domain.y[1]; t += yStep) {
    if (t >= domain.y[0]) yTicks.push(t);
  }

  const gridLines = yTicks.map((t) =>
    `<line x1="${PAD_L}" y1="${y(t)}" x2="${W - PAD_R}" y2="${y(t)}" class="grid-line" />`,
  ).join("");
  const yLabels = yTicks.map((t) =>
    `<text x="${PAD_L - 6}" y="${y(t) + 3}" class="axis-label" text-anchor="end">${t}</text>`,
  ).join("");
  const xLabels = xTicks.map((t) =>
    `<text x="${x(t)}" y="${H - PAD_B + 14}" class="axis-label" text-anchor="middle">${t}</text>`,
  ).join("");
  const axisLines = `
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" class="axis-line" />
    <line x1="${PAD_L}" y1="${H - PAD_B}" x2="${W - PAD_R}" y2="${H - PAD_B}" class="axis-line" />
  `;
  const axisCaptions = `
    <text x="${W - PAD_R}" y="${H - 4}" class="axis-caption" text-anchor="end">연평균 기온(℃)</text>
    <text x="6" y="10" class="axis-caption" text-anchor="start">연간 강수량(mm)</text>
  `;

  const points = CITY_CLIMATE.map((d, i) => {
    const group = groups ? groups[i] : null;
    const isSelected = selection ? selection.has(i) : false;
    let colorClass = "cluster-point--neutral";
    let styleAttr = "";
    if (group !== null && group !== undefined) {
      if (colorFor) {
        colorClass = "";
        styleAttr = ` style="fill:${colorFor(group)}"`;
      } else {
        colorClass = `cluster-point--${group % 4}`;
      }
    }
    const cls = ["data-point", colorClass, isSelected ? "is-selected" : ""].filter(Boolean).join(" ");
    return `<circle class="${cls}" data-city-index="${i}" cx="${x(d.temp)}" cy="${y(d.precip)}" r="6"${styleAttr}><title>${cityLabel(i)} / ${d.temp}℃ / ${d.precip}mm</title></circle>`;
  }).join("");

  svg.innerHTML = `${gridLines}${axisLines}${axisCaptions}${yLabels}${xLabels}${points}`;
}

function cityBundle(index) {
  return stage4Bundles.find((b) => b.members.includes(index)) ?? null;
}

function colorForBundleId(id) {
  return stage4Bundles.find((b) => b.id === id)?.color ?? "#94a3b8";
}

function stage4GroupsArray() {
  return CITY_CLIMATE.map((_, i) => cityBundle(i)?.id ?? null);
}

// 표 형태로 12개 도시 전체를 한눈에 보여준다(카드로 흩어놓으면 값을 한눈에 비교하기 어렵다는
// 피드백을 반영). 그룹 버튼은 없고, 각 행 끝의 "선택" 버튼(키보드로 완전히 조작 가능한
// 공식 컨트롤)과 행 클릭(마우스 편의)이 같은 선택 토글을 공유한다.
function renderCityTable() {
  const table = $("#city-cluster-table");
  if (!table) return;
  const thead = `<thead><tr><th scope="col">데이터</th><th scope="col">연평균 기온(℃)</th><th scope="col">연간 강수량(mm)</th><th scope="col">선택</th></tr></thead>`;
  const tbody = `<tbody>${stage4DisplayOrder.map((i) => {
    const d = CITY_CLIMATE[i];
    const label = cityLabel(i);
    const bundle = cityBundle(i);
    const isSelected = stage4Selection.has(i) && !bundle;
    const rowStyle = bundle ? ` style="background:${bundle.color}22"` : "";
    return `
      <tr data-city-index="${i}" data-label="${label}" class="${isSelected ? "is-selected" : ""}"${rowStyle}>
        <td class="city-label-cell">${bundle ? `<span class="bundle-swatch" style="background:${bundle.color}"></span>` : ""}${label}</td>
        <td>${d.temp}℃</td>
        <td>${d.precip}mm</td>
        <td><button type="button" class="city-select-btn${isSelected ? " is-selected" : ""}" data-city-index="${i}" aria-pressed="${isSelected}">${isSelected ? "선택됨" : "선택"}</button></td>
      </tr>
    `;
  }).join("")}</tbody>`;
  table.innerHTML = thead + tbody;
}

// 선택 토글 하나는 그 행만 갱신한다(표 전체를 다시 그리면 클릭한 버튼 자체가 파괴되어
// 키보드 포커스가 body로 날아간다 — 12개 행을 순서대로 훑는 키보드 사용자에게 치명적).
function updateCityRow(index) {
  const row = document.querySelector(`tr[data-city-index="${index}"]`);
  if (!row) return;
  const bundle = cityBundle(index);
  const isSelected = stage4Selection.has(index) && !bundle;
  const label = row.dataset.label;

  row.classList.toggle("is-selected", isSelected);
  row.style.background = bundle ? `${bundle.color}22` : "";

  const labelCell = row.querySelector(".city-label-cell");
  if (labelCell) {
    labelCell.innerHTML = bundle ? `<span class="bundle-swatch" style="background:${bundle.color}"></span>${label}` : label;
  }

  const btn = row.querySelector(".city-select-btn");
  if (btn) {
    btn.classList.toggle("is-selected", isSelected);
    btn.setAttribute("aria-pressed", String(isSelected));
    btn.textContent = isSelected ? "선택됨" : "선택";
  }
}

function renderBundleList() {
  const el = $("#stage4-bundle-list");
  if (!el) return;
  if (stage4Bundles.length === 0) {
    el.innerHTML = `<p class="bundle-list-empty">아직 만든 묶음이 없어요. 비슷한 도시를 선택하고 "선택한 도시 묶기"를 눌러보세요.</p>`;
    return;
  }
  el.innerHTML = stage4Bundles.map((b) => {
    const labels = b.members.map((i) => cityLabel(i)).sort().join(", ");
    return `
      <div class="bundle-card">
        <span class="bundle-swatch" style="background:${b.color}"></span>
        <span class="bundle-card-label">${b.name} : ${labels}</span>
        <div class="bundle-card-actions">
          <button type="button" data-edit-bundle="${b.id}">수정</button>
          <button type="button" data-dissolve-bundle="${b.id}">해제</button>
        </div>
      </div>
    `;
  }).join("");
}

function updateStage4Progress() {
  const bundled = stage4Bundles.reduce((sum, b) => sum + b.members.length, 0);
  $("#stage4-progress").textContent = `${CITY_CLIMATE.length}개 중 ${bundled}개 데이터가 묶였습니다.`;
}

function updateBundleSelectedButton() {
  $("#stage4-bundle-selected").disabled = stage4Selection.size === 0;
}

function refreshStage4Preview() {
  renderClimateChart("#stage4-preview-chart", {
    groups: stage4GroupsArray(),
    selection: stage4Selection,
    colorFor: colorForBundleId,
  });
}

// 묶음 생성/수정/해제처럼 여러 행이 한꺼번에 바뀌는 동작은 표를 통째로 다시 그린다(이때는
// 포커스가 표 안이 아니라 묶기·수정·해제 버튼에 있으므로 괜찮다).
function refreshStage4Assign() {
  renderCityTable();
  refreshStage4Preview();
  renderBundleList();
  updateStage4Progress();
  updateBundleSelectedButton();
}

// 점 하나를 선택/해제한다. 이미 묶인 점을 클릭하면 그 묶음에서 빼서 바로 선택 상태로
// 돌려놓는다(다시 선택해서 묶음 해제·재배치할 수 있어야 한다는 요구사항).
function toggleCitySelection(index) {
  const bundle = cityBundle(index);
  if (bundle) {
    bundle.members = bundle.members.filter((m) => m !== index);
    if (bundle.members.length === 0) {
      stage4Bundles = stage4Bundles.filter((b) => b.id !== bundle.id);
      if (stage4EditingBundleId === bundle.id) {
        stage4EditingBundleId = null;
        stage4EditingBundleMeta = null;
      }
    }
    stage4Selection.add(index);
  } else if (stage4Selection.has(index)) {
    stage4Selection.delete(index);
  } else {
    stage4Selection.add(index);
  }
  updateCityRow(index);
  renderBundleList();
  updateStage4Progress();
  updateBundleSelectedButton();
  refreshStage4Preview();
}

function handleCreateBundle() {
  if (stage4Selection.size === 0) return;
  const members = Array.from(stage4Selection);
  let id, name, color;
  if (stage4EditingBundleId !== null && stage4EditingBundleMeta) {
    id = stage4EditingBundleId;
    ({ name, color } = stage4EditingBundleMeta);
  } else {
    id = stage4NextBundleId;
    stage4NextBundleId += 1;
    name = `묶음 ${BUNDLE_LETTERS[stage4NextBundleLetter % BUNDLE_LETTERS.length]}`;
    color = CLUSTER_COLORS[stage4NextBundleLetter % CLUSTER_COLORS.length];
    stage4NextBundleLetter += 1;
  }
  stage4Bundles.push({ id, name, color, members });
  stage4Selection.clear();
  stage4EditingBundleId = null;
  stage4EditingBundleMeta = null;
  refreshStage4Assign();
}

function handleEditBundle(id) {
  const bundle = stage4Bundles.find((b) => b.id === id);
  if (!bundle) return;
  stage4EditingBundleId = bundle.id;
  stage4EditingBundleMeta = { name: bundle.name, color: bundle.color };
  stage4Selection = new Set(bundle.members);
  stage4Bundles = stage4Bundles.filter((b) => b.id !== id);
  refreshStage4Assign();
}

function handleDissolveBundle(id) {
  stage4Bundles = stage4Bundles.filter((b) => b.id !== id);
  if (stage4EditingBundleId === id) {
    stage4EditingBundleId = null;
    stage4EditingBundleMeta = null;
  }
  refreshStage4Assign();
}

function showStage4Step() {
  $("#stage4-assign-view").hidden = stage4Step !== "assign";
  $("#stage4-result-view").hidden = stage4Step !== "result";
  $("#stage4-step1-badge").classList.toggle("step-badge--active", stage4Step === "assign");
  $("#stage4-step2-badge").classList.toggle("step-badge--active", stage4Step === "result");
}

// 번호가 아니라 "어떤 데이터가 함께 묶였는지"로 비교한다(alignBundlesToClusters,
// game-core.js) — 학생 묶음 이름·AI 군집 번호가 우연히 달라도 불필요하게 "틀림"으로 뜨지
// 않도록, 각 묶음을 AI 군집 중 가장 많이 겹치는 곳에 다수결로 대응시킨 뒤 비교한다.
function renderStage4Result() {
  const groups = stage4GroupsArray();
  renderClimateChart("#stage4-my-chart", { groups, colorFor: colorForBundleId });
  const aiAssignments = clusterCities();
  renderClimateChart("#stage4-ai-chart", { groups: aiAssignments });

  $("#stage4-compare-stats").textContent =
    `내가 만든 묶음은 총 ${stage4Bundles.length}개, AI는 ${CITY_CLUSTER_K}개의 군집으로 나눴습니다. `
    + "묶음 번호가 서로 같은 것을 뜻하지는 않습니다 — 어떤 도시끼리 함께 묶였는지를 비교해 보세요.";

  const mismatched = alignBundlesToClusters(stage4Bundles, aiAssignments);
  $("#stage4-diff-list").textContent = mismatched.length === 0
    ? "없음(내가 만든 묶음이 AI의 군집과 같은 도시끼리 묶였어요)"
    : mismatched.map((i) => cityLabel(i)).sort().join(", ");
}

// --- 활동 4 ------------------------------------------------------------------
function renderStage4() {
  refreshStage4Assign();
  showStage4Step();
  if (stage4Step === "result") {
    renderStage4Result();
  }
}

function handleStage4Compare() {
  stage4Step = "result";
  showStage4Step();
  renderStage4Result();
  scrollTop();
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
  const hintBtn = $("#stage2-hint-chart-btn");
  if (hintBtn) {
    hintBtn.hidden = false;
    hintBtn.innerHTML = `<span aria-hidden="true">📈</span> 도출 과정 그래프 먼저 보기`;
    hintBtn.setAttribute("aria-expanded", "false");
  }
  renderStage2Chart();

  document.querySelectorAll('input[name="stage3-guess"]').forEach((radio) => {
    radio.checked = false;
    radio.disabled = false;
  });
  $("#stage3-form button[type=submit]").disabled = false;
  $("#stage3-feedback").textContent = "";
  $("#stage3-reveal").hidden = true;
  $("#stage3-explore").hidden = true;
  $("#stage3-next").disabled = true;
  $("#stage3-checklist").querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });
  stage3MyGuess = null;
  renderStage3Chart({});

  stage4Selection = new Set();
  stage4Bundles = [];
  stage4NextBundleLetter = 0;
  stage4NextBundleId = 1;
  stage4EditingBundleId = null;
  stage4EditingBundleMeta = null;
  stage4Step = "assign";
  refreshStage4Assign();
  showStage4Step();

  scrollTop();
}

// --- 이벤트 바인딩 -------------------------------------------------------------
$("#stage1-form").addEventListener("submit", handleStage1Submit);
// 활동 2(속성 2개 회귀)는 숨김 처리했으므로, 활동 1 다음은 바로 활동 2로 번호가 바뀐
// 분류 활동(PHASES.THREE)으로 넘어간다.
$("#stage1-next").addEventListener("click", () => goToStage(PHASES.THREE));

$("#stage2-form").addEventListener("submit", handleStage2Submit);
$("#stage2-hint-chart-btn")?.addEventListener("click", toggleStage2ChartHint);
$("#stage2-temp").addEventListener("input", onStage2ExploreInput);
$("#stage2-rain").addEventListener("input", onStage2ExploreInput);
$("#stage2-rain").addEventListener("change", onStage2ExploreInput);
$("#stage2-next").addEventListener("click", () => goToStage(PHASES.THREE));

$("#stage3-form").addEventListener("submit", handleStage3Submit);
$("#stage3-temp").addEventListener("input", onStage3ExploreInput);
$("#stage3-traffic").addEventListener("input", onStage3ExploreInput);
$("#stage3-mood").addEventListener("change", onStage3ExploreInput);
$("#stage3-cats").addEventListener("input", onStage3ExploreInput);
$("#stage3-next").addEventListener("click", () => goToStage(PHASES.FOUR));

// 표 행·"선택" 버튼, 산점도 점, 묶음 목록의 [수정]/[해제]는 각각 이벤트 위임으로 처리한다
// (재렌더될 때마다 개별 리스너를 다시 붙일 필요가 없다).
$("#city-cluster-table").addEventListener("click", (event) => {
  const target = event.target.closest("[data-city-index]");
  if (!target) return;
  toggleCitySelection(Number(target.dataset.cityIndex));
});
$("#stage4-preview-chart").addEventListener("click", (event) => {
  const target = event.target.closest("[data-city-index]");
  if (!target) return;
  toggleCitySelection(Number(target.dataset.cityIndex));
});
$("#stage4-bundle-selected").addEventListener("click", handleCreateBundle);
$("#stage4-bundle-list").addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-bundle]");
  if (editBtn) { handleEditBundle(Number(editBtn.dataset.editBundle)); return; }
  const dissolveBtn = event.target.closest("[data-dissolve-bundle]");
  if (dissolveBtn) handleDissolveBundle(Number(dissolveBtn.dataset.dissolveBundle));
});
$("#stage4-compare-btn").addEventListener("click", handleStage4Compare);
$("#stage4-next").addEventListener("click", () => goToStage(PHASES.RESULTS));

// 상단 탭: 완료 여부와 상관없이 활동 1~4를 자유롭게 오갈 수 있다.
$$("#stage-tabs .stage-tab").forEach((tab) => {
  tab.addEventListener("click", () => goToStage(tab.dataset.stage));
});

$("#restart-button").addEventListener("click", restart);
$("#projector-toggle").addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  $("#projector-toggle").setAttribute("aria-pressed", String(enabled));
});

showPhaseView();
renderStage1();
