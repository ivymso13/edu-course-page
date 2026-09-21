import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  simpleLinearRegression,
  multipleLinearRegression,
  STUDY_DATA,
  STUDY_TREND_LINE,
  predictStudyScore,
  STUDY_QUESTION_HOURS,
  PARK_DATA,
  predictVisitors,
  PARK_QUESTION_CONDITION,
  ICE_CREAM_DATA,
  ICE_CREAM_LABELS,
  classifyByKNN,
  classifyIceCreamCrowd,
  ICE_CREAM_NEW_CONDITION,
  ICE_CREAM_ACTUAL_CROWD,
  kMeans,
  CITY_CLIMATE,
  CITY_CLUSTER_K,
  clusterCities,
  alignBundlesToClusters,
} from "../lessons/ai-prediction-lab/game-core.js";

const lessonRoot = new URL("../lessons/ai-prediction-lab/", import.meta.url);

// --- 회귀 계산 정확성 ---------------------------------------------------------

test("simpleLinearRegression은 완전한 직선 데이터에서 정확한 기울기·절편을 구한다", () => {
  const { slope, intercept } = simpleLinearRegression([
    { x: 0, y: 10 },
    { x: 1, y: 12 },
    { x: 2, y: 14 },
  ]);
  assert.ok(Math.abs(slope - 2) < 1e-9);
  assert.ok(Math.abs(intercept - 10) < 1e-9);
});

test("multipleLinearRegression은 완전한 평면 데이터에서 정확한 절편·계수를 구한다", () => {
  // y = 5 + 2*x1 - 3*x2 를 정확히 만족하는 4개 점(미지수 3개보다 많아 최소제곱이 유일해로 수렴)
  const rows = [[0, 0], [1, 0], [0, 1], [2, 1]];
  const ys = rows.map(([x1, x2]) => 5 + 2 * x1 - 3 * x2);
  const [intercept, c1, c2] = multipleLinearRegression(rows, ys);
  assert.ok(Math.abs(intercept - 5) < 1e-6);
  assert.ok(Math.abs(c1 - 2) < 1e-6);
  assert.ok(Math.abs(c2 - (-3)) < 1e-6);
});

test("활동1: 공부 시간 데이터로 만든 추세선이 5개 데이터와 직접 계산한 최소제곱 결과와 일치한다", () => {
  const expected = simpleLinearRegression(STUDY_DATA.map((d) => ({ x: d.hours, y: d.score })));
  assert.ok(Math.abs(STUDY_TREND_LINE.slope - expected.slope) < 1e-9);
  assert.ok(Math.abs(STUDY_TREND_LINE.intercept - expected.intercept) < 1e-9);
});

test("활동1: predictStudyScore(6)은 추세선 값을 내림한 정수를 돌려준다", () => {
  const raw = STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * STUDY_QUESTION_HOURS;
  assert.equal(predictStudyScore(STUDY_QUESTION_HOURS), Math.floor(raw));
  assert.equal(predictStudyScore(STUDY_QUESTION_HOURS), 84);
});

test("활동1: 공부 시간이 늘어날수록 예측 점수도 늘어난다(단조 증가)", () => {
  const scores = [1, 2, 3, 4, 5, 6, 7].map((h) => predictStudyScore(h));
  for (let i = 1; i < scores.length; i += 1) assert.ok(scores[i] >= scores[i - 1]);
});

test("활동2: predictVisitors는 기온·날씨 데이터로 직접 계산한 최소제곱 결과와 일치한다", () => {
  const [intercept, tempCoef, rainCoef] = multipleLinearRegression(
    PARK_DATA.map((d) => [d.temp, d.rain]),
    PARK_DATA.map((d) => d.visitors),
  );
  const expected = Math.round(
    intercept + tempCoef * PARK_QUESTION_CONDITION.temp + rainCoef * PARK_QUESTION_CONDITION.rain,
  );
  assert.equal(predictVisitors(PARK_QUESTION_CONDITION.temp, PARK_QUESTION_CONDITION.rain), expected);
});

test("활동2: 기온이 오르면 방문객 예측이 늘고, 비가 오면 방문객 예측이 준다", () => {
  const base = predictVisitors(25, 0);
  assert.ok(predictVisitors(30, 0) > base, "기온이 오르면 방문객 수 예측이 늘어야 함");
  assert.ok(predictVisitors(25, 1) < base, "비가 오면 방문객 수 예측이 줄어야 함");
});

// --- 활동3: 분류(k-NN)와 관계없는 정보(사장님 기분·지나가는 고양이 수) 무관성 -------------

test("classifyByKNN은 자명하게 분리되는 두 군집에서 가장 가까운 라벨로 정확히 분류한다", () => {
  const rows = [[0, 0], [0, 1], [10, 10], [10, 11]];
  const labels = ["A", "A", "B", "B"];
  assert.equal(classifyByKNN(rows, labels, [0.5, 0.5], 2).predictedLabel, "A");
  assert.equal(classifyByKNN(rows, labels, [10.5, 10.5], 2).predictedLabel, "B");
});

test("활동3: classifyIceCreamCrowd는 사장님 기분·지나가는 고양이 수를 아예 입력으로 받지 않는다(함수 시그니처 자체가 기온·유동인구 2개 인자)", () => {
  assert.equal(classifyIceCreamCrowd.length, 2);
});

test("활동3: 기온·유동인구가 같으면, 원래 데이터에 없던 사장님 기분·지나가는 고양이 수 조합이 섞여 있어도 분류 결과는 항상 같다", () => {
  // 사장님 기분·지나가는 고양이 수는 애초에 classifyIceCreamCrowd의 인자가 아니므로, 이 테스트는
  // "여러 다른 상황을 시뮬레이션해도 같은 (기온,유동인구) 입력이면 같은 결과가 나온다"는
  // 함수의 순수성/일관성을 확인한다 — 실제 무관성은 위 시그니처 테스트가 구조적으로 보장한다.
  const first = classifyIceCreamCrowd(28, 150).predictedLabel;
  for (let i = 0; i < 5; i += 1) {
    assert.equal(classifyIceCreamCrowd(28, 150).predictedLabel, first);
  }
});

test("활동3: 데이터가 10개로 늘어났고, 새 조건의 AI 예측은 '붐빔'(5개 이웃 중 3:2 근소한 판정), 실제 결과는 '한산'으로 서로 다르다(경계 사례는 AI도 틀리기 쉬움)", () => {
  assert.equal(ICE_CREAM_DATA.length, 10);
  const { predictedLabel } = classifyIceCreamCrowd(
    ICE_CREAM_NEW_CONDITION.temp,
    ICE_CREAM_NEW_CONDITION.traffic,
  );
  assert.equal(predictedLabel, "붐빔");
  assert.equal(ICE_CREAM_ACTUAL_CROWD, "한산");
  assert.notEqual(predictedLabel, ICE_CREAM_ACTUAL_CROWD);
});

test("활동3: 훈련 데이터와 똑같은 조건으로 물으면(자기 자신이 가장 가까운 이웃) k=5 다수결도 원래 라벨과 같다", () => {
  // 10개 데이터 전부 직접 계산으로 검증됨: 각 행을 그대로 쿼리로 넣으면 k=5 다수결이
  // 자기 자신의 라벨과 일치한다.
  ICE_CREAM_DATA.forEach((d, i) => {
    assert.equal(classifyIceCreamCrowd(d.temp, d.traffic).predictedLabel, ICE_CREAM_LABELS[i]);
  });
});

test("활동3: 최소 하나의 붐빔·한산 라벨이 모두 존재하고, 데이터셋에는 사장님 기분(범주형)·지나가는 고양이 수(숫자형) 컬럼이 있지만 분류에는 쓰이지 않는다", () => {
  assert.ok(ICE_CREAM_LABELS.includes("붐빔"));
  assert.ok(ICE_CREAM_LABELS.includes("한산"));
  // ICE_CREAM_DATA 자체에는 mood/cats가 들어 있어야 화면 표에 보여줄 수 있다(학생이 직접
  // "이 정보는 관계없어 보인다"를 눈으로 비교해야 하므로) — 데이터에는 있되 분류에는 안 쓰인다는
  // 것을 함께 확인한다. 범주형(기분)과 숫자형(고양이 수), 서로 다른 형태의 무관한 정보를 함께 둔다.
  const validMoods = ["좋음", "나쁨"];
  for (const row of ICE_CREAM_DATA) {
    assert.ok(validMoods.includes(row.mood));
    assert.ok(typeof row.cats === "number");
  }
});

// --- 활동4: 군집(k-평균) -----------------------------------------------------

test("kMeans는 무작위성 없이 결정론적이다(같은 입력이면 항상 같은 결과)", () => {
  const points = CITY_CLIMATE.map((d) => ({ x: d.temp, y: d.precip }));
  const r1 = kMeans(points, 4);
  const r2 = kMeans(points, 4);
  assert.deepEqual(r1.assignments, r2.assignments);
  assert.deepEqual(r1.centroids, r2.centroids);
});

test("kMeans는 자명하게 분리된 두 군집을 정확히 나눈다", () => {
  const points = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
    { x: 20, y: 20 }, { x: 21, y: 20 }, { x: 20, y: 21 },
  ];
  const { assignments } = kMeans(points, 2);
  assert.equal(assignments[0], assignments[1]);
  assert.equal(assignments[1], assignments[2]);
  assert.equal(assignments[3], assignments[4]);
  assert.equal(assignments[4], assignments[5]);
  assert.notEqual(assignments[0], assignments[3]);
});

test("활동4: CITY_CLIMATE는 12개 도시 데이터이고(월 필드 없음, 실제 도시 이름도 노출 안 함) CITY_CLUSTER_K는 4다", () => {
  assert.equal(CITY_CLIMATE.length, 12);
  assert.equal(CITY_CLUSTER_K, 4);
  for (const d of CITY_CLIMATE) {
    assert.deepEqual(Object.keys(d).sort(), ["precip", "temp"], "월/도시 이름 필드가 없어야 함(라벨 없는 데이터)");
    assert.ok(typeof d.temp === "number");
    assert.ok(typeof d.precip === "number");
  }
});

test("활동4: clusterCities()는 결정론적이며, 12개 도시를 정확히 4개 기후대 그룹(3/3/3/3명)으로 나눈다", () => {
  // 이전 버전(12개월의 연속된 기후)은 뚜렷한 4덩어리를 만들려고 값을 부자연스럽게 왜곡해야
  // 했다(11월이 9·10월보다 따뜻해지는 등 실제로 불가능한 역전까지 생김). 그래서 "서로 다른
  // 기후대의 여러 도시"로 소재를 바꿨다 — 도시마다 원래 기후가 다르므로 실제에 가까운
  // 근사값을 그대로 써도 자연스럽게 갈린다: 기온·강수량을 z-score로 정규화(단위·범위가 달라
  // 정규화 없이는 강수량이 거리 계산을 압도함)한 뒤 k=4로 계산한 결과를 손으로 검증함 —
  // 0~2번(열대: 싱가포르·자카르타·홍콩) / 3~5번(온대: 도쿄·서울·베이징) /
  // 6~8번(건조: 카이로·두바이·LA) / 9~11번(냉대: 모스크바·오슬로·울란바토르)로 정확히 갈린다.
  // 각 기후대에 경계에 걸친 도시(홍콩·베이징·LA·울란바토르)를 하나씩 섞어, 정규화 없이 눈으로
  // 보면(강수량 축이 기온 축보다 훨씬 커서) 다르게 묶일 수도 있게 일부러 설계했다.
  const a1 = clusterCities();
  const a2 = clusterCities();
  assert.deepEqual(a1, a2, "같은 입력이면 항상 같은 결과여야 함(결정론적)");
  assert.equal(a1.length, 12);
  assert.equal(new Set(a1).size, 4, "빈 그룹 없이 정확히 4개 그룹이어야 함");

  const tropical = new Set([a1[0], a1[1], a1[2]]);
  const temperate = new Set([a1[3], a1[4], a1[5]]);
  const arid = new Set([a1[6], a1[7], a1[8]]);
  const cold = new Set([a1[9], a1[10], a1[11]]);
  assert.equal(tropical.size, 1, "열대 도시 3곳은 같은 그룹이어야 함");
  assert.equal(temperate.size, 1, "온대 도시 3곳은 같은 그룹이어야 함");
  assert.equal(arid.size, 1, "건조 도시 3곳은 같은 그룹이어야 함");
  assert.equal(cold.size, 1, "냉대 도시 3곳은 같은 그룹이어야 함");
  const groups = new Set([...tropical, ...temperate, ...arid, ...cold]);
  assert.equal(groups.size, 4, "네 기후대 묶음이 서로 다른 그룹이어야 함");
});

test("alignBundlesToClusters: 학생 묶음이 AI 군집과 정확히 같은 도시끼리 묶였으면(이름·순서는 달라도) '다르게 묶인 데이터'가 없다", () => {
  const ai = clusterCities(); // [3,3,3,1,1,1,2,2,2,0,0,0]
  const bundles = [
    { members: [2, 0, 1] }, // 열대 3곳(순서 섞임) = AI 군집 3
    { members: [4, 3, 5] }, // 온대 3곳 = AI 군집 1
    { members: [7, 6, 8] }, // 건조 3곳 = AI 군집 2
    { members: [10, 9, 11] }, // 냉대 3곳 = AI 군집 0
  ];
  assert.deepEqual(alignBundlesToClusters(bundles, ai), []);
});

test("alignBundlesToClusters: 묶음 번호(이름·순서)가 아니라 실제로 함께 묶인 도시를 기준으로 비교한다 — 섞어 넣은 도시만 '다름'으로 나온다", () => {
  const ai = clusterCities(); // [3,3,3,1,1,1,2,2,2,0,0,0]
  const bundles = [
    { members: [0, 1, 9] }, // 열대 2곳(AI 군집3) + 냉대 1곳(AI 군집0) 다수결로 군집3에 대응 -> 9만 다름
    { members: [2] }, // 열대 1곳만 있는 묶음 -> 다수결 자체가 AI 군집3이라 다르지 않음
    { members: [3, 4, 5] },
    { members: [6, 7, 8] },
    { members: [10, 11] },
  ];
  assert.deepEqual(alignBundlesToClusters(bundles, ai), [9]);
});

test("alignBundlesToClusters: 빈 묶음(멤버 0명)은 비교에서 그냥 건너뛴다", () => {
  const ai = clusterCities();
  const bundles = [{ members: [] }, { members: [0, 1, 2] }];
  assert.deepEqual(alignBundlesToClusters(bundles, ai), []);
});

// --- HTML/CSS/JS 구조 검증 ------------------------------------------------

test("독립 lesson 페이지가 fonts.css·lab-base.css·guard.css와 그룹/활동 가드 속성을 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>AI는 어떤 문제를 풀 수 있을까\? \| 기계학습과 데이터<\/title>/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/shared\/lab-base\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="ai-learning"/);
  assert.match(html, /data-guard-lesson="ai-prediction-lab"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/ai-learning\/"/);
});

test("네 활동 단계와 데이터표·예측 입력·결과 공개 영역이 모두 존재한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  for (const id of ["stage1-view", "stage2-view", "stage3-view", "stage4-view", "results-view"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="study-table"/);
  assert.match(html, /id="park-table"/);
  assert.match(html, /id="ice-cream-table"/);
  assert.match(html, /id="stage1-chart"/);
  for (const id of ["stage1-guess", "stage2-guess"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*type="number"`));
  }
  for (const id of ["stage1-reveal", "stage2-reveal", "stage3-reveal"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*class="reveal-box"|class="reveal-box"[^>]*id="${id}"`));
  }
});

test("활동 1의 산점도는 표만 보고 스스로 예측하도록 예측 제출 전에는 숨겨져 있다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="stage1-chart-wrap"[^>]*hidden/, "그래프 래퍼는 처음에 hidden 상태여야 함");
  assert.match(js, /\$\("#stage1-chart-wrap"\)\.hidden = false/, "제출 시 그래프를 보여줘야 함");
  assert.match(js, /\$\("#stage1-chart-wrap"\)\.hidden = true/, "재시작 시 다시 숨겨야 함");
});

test("활동 1은 내 예측과 AI의 예측을 점수로도, 그래프의 점으로도 함께 표시해 비교한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  const revealMatch = html.match(/<aside class="reveal-box" id="stage1-reveal"[\s\S]*?<\/aside>/);
  assert.ok(revealMatch, "stage1-reveal을 찾을 수 없음");
  assert.match(revealMatch[0], /class="score-compare"/);
  assert.match(revealMatch[0], /id="stage1-my-score"/);
  assert.match(revealMatch[0], /id="stage1-ai-score"/);
  assert.match(html, /class="legend-chip legend-chip--mine"/);
  assert.match(html, /class="legend-chip legend-chip--ai"/);
  assert.match(js, /guess-point/);
  assert.match(js, /predicted-point/);
  assert.match(js, /\$\("#stage1-my-score"\)\.innerHTML/);
  assert.match(js, /\$\("#stage1-ai-score"\)\.innerHTML/);
});

test("상단 탭은 숨김 처리된 (구)활동 2를 제외하고 세 활동만 오갈 수 있게 보여준다(내부적으로는 one·three·four)", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  const tabsMatch = html.match(/<nav class="stage-tabs"[\s\S]*?<\/nav>/);
  assert.ok(tabsMatch, "stage-tabs 내비게이션을 찾을 수 없음");
  assert.match(tabsMatch[0], /data-stage="one"/);
  assert.doesNotMatch(tabsMatch[0], /data-stage="two"/, "숨김 처리된 활동은 탭에 노출되면 안 됨");
  assert.match(tabsMatch[0], /data-stage="three"/);
  assert.match(tabsMatch[0], /data-stage="four"/);
  const tabTexts = Array.from(tabsMatch[0].matchAll(/<button[^>]*>([^<]+)<\/button>/g)).map((m) => m[1]);
  assert.deepEqual(tabTexts, ["활동 1", "활동 2", "활동 3"], "탭 라벨이 1·2·3으로 다시 번호 매겨져야 함");
  assert.match(js, /function goToStage\(/);
  assert.match(js, /\$\$\("#stage-tabs \.stage-tab"\)\.forEach/);
  assert.match(js, /aria-current/);
});

test("진행률 표시는 3단계 기준으로 계산된다(TOTAL_STAGES) — 숨김 처리된 활동을 빼고 다시 번호 매김", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /TOTAL_STAGES\s*=\s*3/);
  assert.match(js, /\$\("#stage-label"\)\.textContent = `\$\{info\.index\} \/ \$\{TOTAL_STAGES\}단계/);
  // 활동1 다음은 숨겨진 (구)활동2를 건너뛰고 바로 (새 번호 활동2인) PHASES.THREE로 간다.
  assert.match(js, /\$\("#stage1-next"\)\.addEventListener\("click", \(\) => goToStage\(PHASES\.THREE\)\)/);
});

test("제출/완료 후 결과 영역 맨 위에 이 활동이 회귀·분류·군집 중 무엇인지 단어로 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const stage1Reveal = html.match(/<aside class="reveal-box" id="stage1-reveal"[\s\S]*?<\/aside>/);
  assert.ok(stage1Reveal, "stage1-reveal을 찾을 수 없음");
  assert.match(stage1Reveal[0], /<span class="method-tag">회귀<\/span>/);

  const stage3Reveal = html.match(/<aside class="reveal-box" id="stage3-reveal"[\s\S]*?<\/aside>/);
  assert.ok(stage3Reveal, "stage3-reveal을 찾을 수 없음");
  assert.match(stage3Reveal[0], /<span class="method-tag">분류<\/span>/);

  const stage4Result = html.match(/<div class="stage-flow" id="stage4-result-view"[\s\S]*?id="stage4-next"/);
  assert.ok(stage4Result, "stage4-result-view를 찾을 수 없음");
  assert.match(stage4Result[0], /<span class="method-tag">군집<\/span>/);

  // 세 태그 모두 제출 전까지는 숨겨져 있는 영역(hidden 속성) 안에 있어야 "정답을 누르면" 나타난다.
  assert.match(html, /<aside class="reveal-box" id="stage1-reveal" hidden/);
  assert.match(html, /<aside class="reveal-box" id="stage3-reveal" hidden>/);
  assert.match(html, /<div class="stage-flow" id="stage4-result-view" hidden>/);
});

test("활동을 끝내면(제출/완료 시점) 각 활동마다 그 방식이 무엇인지 간단한 개념 설명도 함께 나온다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const stage1Reveal = html.match(/<aside class="reveal-box" id="stage1-reveal"[\s\S]*?<\/aside>/);
  assert.ok(stage1Reveal, "stage1-reveal을 찾을 수 없음");
  assert.match(stage1Reveal[0], /class="concept-note"/);
  assert.match(stage1Reveal[0], /회귀\(Regression\)란\?/);

  const stage3Reveal = html.match(/<aside class="reveal-box" id="stage3-reveal"[\s\S]*?<\/aside>/);
  assert.ok(stage3Reveal, "stage3-reveal을 찾을 수 없음");
  assert.match(stage3Reveal[0], /class="concept-note"/);
  assert.match(stage3Reveal[0], /분류\(Classification\)란\?/);

  const stage4Result = html.match(/<div class="stage-flow" id="stage4-result-view"[\s\S]*?id="stage4-next"/);
  assert.ok(stage4Result, "stage4-result-view를 찾을 수 없음");
  assert.match(stage4Result[0], /군집\(Clustering\)이란\?/);
});

test("활동 3의 체크박스 자기점검은 채점되지 않는다고 명시하고, 4개 속성을 모두 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const checklistMatch = html.match(/<form class="checklist-form"[\s\S]*?<\/form>/);
  assert.ok(checklistMatch, "checklist-form을 찾을 수 없음");
  assert.match(checklistMatch[0], /채점되지 않는/);
  const checkboxCount = (checklistMatch[0].match(/type="checkbox"/g) ?? []).length;
  assert.equal(checkboxCount, 4);
});

test("활동 3은 숫자 입력이 아니라 붐빔/한산 2지선다 분류로 예측을 받고, 결과를 그래프로도 보여준다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  const formMatch = html.match(/<form class="predict-form" id="stage3-form">[\s\S]*?<\/form>/);
  assert.ok(formMatch, "stage3-form을 찾을 수 없음");
  assert.match(formMatch[0], /name="stage3-guess" value="붐빔"/);
  assert.match(formMatch[0], /name="stage3-guess" value="한산"/);
  assert.doesNotMatch(formMatch[0], /type="number"/);

  assert.match(html, /id="stage3-chart"/);
  assert.match(html, /class="legend-chip legend-chip--calm"/);
  assert.match(html, /class="legend-chip legend-chip--busy"/);
  assert.match(js, /classifyIceCreamCrowd/);
  assert.match(js, /neighborIndices/);
  assert.match(js, /\$\("#stage3-match-badge"\)\.textContent/);
});

test("활동 4 STEP 1: 라벨 없는 도시별 데이터를 표로 한눈에 보여주고, 처음부터 그룹 번호를 주지 않는다(점 선택 → 묶기 방식)", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="city-cluster-table"/);
  assert.match(html, /id="stage4-bundle-selected"[^>]*disabled/, "선택 전엔 묶기 버튼이 비활성이어야 함");
  assert.match(html, /id="stage4-compare-btn"/, "AI와 비교하기 버튼이 있어야 함");
  assert.doesNotMatch(html, /draggable="true"/, "드래그 앤 드롭 대신 클릭으로 선택해야 함(접근성)");
  assert.doesNotMatch(js, /class="group-pill|그룹 1~4|data-group=/, "처음부터 그룹 1~4 버튼을 주면 안 됨");

  assert.match(js, /function renderCityTable/);
  assert.match(js, /class="city-select-btn/, "행마다 키보드로 조작 가능한 선택 토글 버튼이 있어야 함");
  assert.match(js, /<th scope="col">데이터<\/th>/);
  assert.match(js, /<th scope="col">연평균 기온\(℃\)<\/th>/);
  assert.match(js, /<th scope="col">연간 강수량\(mm\)<\/th>/);
  assert.match(js, /function toggleCitySelection/);
  assert.match(js, /function handleCreateBundle/);
  assert.match(js, /function handleEditBundle/);
  assert.match(js, /function handleDissolveBundle/);
  assert.match(js, /function updateStage4Progress/);

  assert.match(html, /id="stage4-preview-chart"/);
  assert.match(html, /id="stage4-bundle-list"/);
  assert.match(js, /cluster-point--neutral/);
});

test("활동 4: 표에는 실제 도시 이름 대신 순서 없는 라벨(A~L)을 쓰고, 행 표시 순서도 원본 데이터 순서(기후대별 묶음)가 힌트가 되지 않도록 섞는다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  const fnMatch = js.match(/function renderCityTable\(\) \{[\s\S]*?\n\}/);
  assert.ok(fnMatch, "renderCityTable 함수를 찾을 수 없음");
  assert.doesNotMatch(fnMatch[0], /\$\{d\.(month|city|name)\}/, "표에 실제 이름/식별자를 노출하면 안 됨");
  assert.match(fnMatch[0], /cityLabel\(/, "익명 라벨(A~L)을 써야 함");
  assert.match(fnMatch[0], /stage4DisplayOrder/, "섞인 표시 순서를 써야 함");

  assert.match(js, /function shuffledIndices/);
  assert.match(js, /Math\.random\(\)/, "표시 순서 섞기는 군집 계산과 무관하므로 무작위로 섞어도 됨");
});

test("활동 4: 선택 토글 하나는 표 전체를 다시 그리지 않고 그 행만 갱신한다(표 전체 재렌더는 클릭한 버튼 자체를 파괴해 키보드 포커스를 잃게 만듦)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  const toggleMatch = js.match(/function toggleCitySelection\(index\) \{[\s\S]*?\n\}/);
  assert.ok(toggleMatch, "toggleCitySelection 함수를 찾을 수 없음");
  assert.match(toggleMatch[0], /updateCityRow\(/, "행 단위 갱신 함수를 호출해야 함");
  assert.doesNotMatch(toggleMatch[0], /renderCityTable\(\)/, "선택 토글이 표 전체를 다시 그리면 안 됨(포커스 유실)");

  const updateMatch = js.match(/function updateCityRow\(index\) \{[\s\S]*?\n\}/);
  assert.ok(updateMatch, "updateCityRow 함수를 찾을 수 없음");
  assert.doesNotMatch(updateMatch[0], /querySelector\(`tr.*`\)\.innerHTML/, "행 전체를 통째로 다시 쓰면 안 됨(버튼 노드 유지)");

  // 표에서 선택을 토글하면 옆 산점도도 즉시 갱신되어야 한다.
  assert.match(toggleMatch[0], /refreshStage4Preview\(\)/);
});

test("활동 4: 이미 묶인 점을 다시 클릭하면 그 묶음에서 빠져나와 선택 상태가 되어(해제/재배치 가능) 묶음이 비면 사라진다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  const toggleMatch = js.match(/function toggleCitySelection\(index\) \{[\s\S]*?\n\}/);
  assert.ok(toggleMatch, "toggleCitySelection 함수를 찾을 수 없음");
  assert.match(toggleMatch[0], /bundle\.members\.filter/, "묶음에서 해당 도시를 제거해야 함");
  assert.match(toggleMatch[0], /stage4Bundles = stage4Bundles\.filter/, "멤버가 없어진 묶음은 삭제해야 함");
  assert.match(toggleMatch[0], /stage4Selection\.add\(index\)/, "묶음에서 뺀 도시는 다시 선택 상태가 되어야 함(재배치 가능)");
});

test("활동 4 STEP 2: 내가 만든 묶음과 AI가 만든 군집을 각각 독립된 산점도로 나란히 보여주고, 묶음 번호가 아니라 함께 묶인 데이터를 기준으로 비교한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /class="compare-grid"/);
  assert.match(html, /id="stage4-my-chart"/);
  assert.match(html, /id="stage4-ai-chart"/);
  assert.match(html, /id="stage4-compare-stats"/);
  assert.match(html, /id="stage4-diff-list"/);
  assert.match(html, /군집\(Clustering\)이란\?/);
  assert.match(html, /사람과 AI가 데이터를 묶은 결과는 서로 다를 수도 있습니다\./);

  assert.match(js, /function renderClimateChart/);
  assert.match(js, /function renderStage4Result/);
  assert.match(js, /alignBundlesToClusters\(stage4Bundles, aiAssignments\)/, "묶음 번호가 아니라 정렬 기반으로 비교해야 함");
  assert.match(js, /clusterCities\(\)/);
});

test("활동 4에는 채점 UI(점수 비교·일치 콜아웃)나 오답 판정 문구가 없다(군집에는 정답이 없다는 기획 의도) — '정해진 정답은 없습니다'라는 안내 문구만 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const stage4Match = html.match(/<div id="stage4-view"[\s\S]*?<div id="results-view"/);
  assert.ok(stage4Match, "stage4-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(stage4Match[0], /class="score-compare"/);
  assert.doesNotMatch(stage4Match[0], /class="error-callout"/);
  assert.doesNotMatch(stage4Match[0], /오답|일치했습니다/);
  assert.match(stage4Match[0], /정해진 정답은 없습니다/);
});

test("생각해보기(discussion) 블록은 마무리 화면에만 있고, 사용자가 준 정리 문구를 그대로 담는다(활동 1~4는 모두 제거됨)", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const discussionBlocks = html.match(/<div class="discussion">[\s\S]*?<\/div>/g) ?? [];
  assert.equal(discussionBlocks.length, 1, "마무리 화면에만 discussion 블록 1개가 있어야 함");
  assert.doesNotMatch(html, /나는 어떤 규칙을 찾아서 예측했나요\?/, "활동 1의 생각해보기 질문은 제거되어야 함");
  assert.doesNotMatch(html, /AI는 무엇을 보고 값을 예측했을까요\?/, "활동 1의 생각해보기 질문은 제거되어야 함");
  assert.doesNotMatch(html, /기온을 높이면 방문객 수는 어떻게 변하나요\?/, "활동 2의 생각해보기 질문은 제거되어야 함");
  assert.doesNotMatch(html, /정보가 많으면 항상 더 정확하게 예측할 수 있을까요\?/, "활동 3의 생각해보기 질문은 제거되어야 함");
  assert.doesNotMatch(html, /내가 만든 묶음은 몇 개인가요\?/, "활동 4의 성찰 질문은 제거되어야 함");
});

test("활동 1~4에는 생각해보기(discussion) 블록이 없다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const stage1Match = html.match(/<div id="stage1-view"[\s\S]*?<div id="stage2-view"/);
  assert.ok(stage1Match, "stage1-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(stage1Match[0], /class="discussion"/);
  const stage2Match = html.match(/<div id="stage2-view"[\s\S]*?<div id="stage3-view"/);
  assert.ok(stage2Match, "stage2-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(stage2Match[0], /class="discussion"/);
  const stage3Match = html.match(/<div id="stage3-view"[\s\S]*?<div id="stage4-view"/);
  assert.ok(stage3Match, "stage3-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(stage3Match[0], /class="discussion"/);
  const stage4Match = html.match(/<div id="stage4-view"[\s\S]*?<div id="results-view"/);
  assert.ok(stage4Match, "stage4-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(stage4Match[0], /class="discussion"/);
});

test("마무리 화면은 사용자가 준 정리 문장(군집 관련 문장 포함)을 그대로 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /인공지능은 기존 데이터에서 패턴을 찾아 새로운 값을 예측합니다\./);
  assert.match(html, /여러 정보를 함께 사용할 수 있지만, 모든 정보가 예측에 도움이 되는 것은 아닙니다\./);
  assert.match(html, /인공지능의 예측은 실제 결과와 완전히 일치하지 않을 수 있으며, 어느 정도의 오차가 존재할 수 있습니다\./);
  assert.match(html, /정답 라벨이 없는 데이터에서는 AI가 스스로 비슷한 것끼리 묶을 뿐, 그룹의 의미는 사람이 해석해야 합니다\./);
});

test("game.js는 game-core.js의 예측·분류 함수를 사용하고, 활동 2·3의 슬라이더 입력마다 실시간으로 재계산한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /predictStudyScore/);
  assert.match(js, /predictVisitors/);
  assert.match(js, /classifyIceCreamCrowd/);
  assert.match(js, /addEventListener\("input", onStage2ExploreInput\)/);
  assert.match(js, /addEventListener\("input", onStage3ExploreInput\)/);
});

test("키보드 접근성: focus-visible 스타일이 있고(lab-base.css), 실시간 결과 영역은 aria-live를 갖는다", async () => {
  const [html, labBase] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
  ]);
  assert.match(labBase, /:focus-visible/);
  assert.match(html, /id="stage2-live" aria-live="polite"/);
  assert.match(html, /id="stage3-live" aria-live="polite"/);
  assert.match(html, /id="stage1-feedback" class="predict-feedback" aria-live="polite"/);
});

test("prefers-reduced-motion을 존중한다(lab-base.css의 공통 규칙과 game.js의 스크롤 처리)", async () => {
  const [labBase, js] = await Promise.all([
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(labBase, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("좁은 화면(480px)에 대응하는 반응형 CSS가 있다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /@media \(max-width: 480px\)/);
});

test("외부 네트워크 요청 없이 저장소 안의 상대 경로 자산만 사용한다", async () => {
  const [html, css, js, gameCore] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("game-core.js", lessonRoot), "utf8"),
  ]);
  for (const [name, text] of [["index.html", html], ["styles.css", css], ["game.js", js], ["game-core.js", gameCore]]) {
    assert.doesNotMatch(text, /https?:\/\//, `${name}에 외부 네트워크 참조가 있으면 안 됨`);
  }
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)).map((match) => match[1]);
  assert.ok(scriptSrcs.length > 0, "script src를 찾을 수 없음");
  for (const src of scriptSrcs) {
    assert.ok(
      src === "../../assets/group-guard.js" || src === "game.js",
      `허용되지 않은 script src: ${src}`,
    );
  }
});

test("ai-problem-method와 양방향으로 이어지는 lesson-pager가 있다", async () => {
  const [ownHtml, siblingHtml] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../ai-problem-method/index.html", lessonRoot), "utf8"),
  ]);
  assert.match(ownHtml, /class="lesson-pager"/);
  assert.match(ownHtml, /href="\.\.\/ai-problem-method\/"/);
  assert.match(siblingHtml, /class="lesson-pager"/);
  assert.match(siblingHtml, /href="\.\.\/ai-prediction-lab\/"/);
});

test("data/activity-groups.json과 data/lessons.json에 이 활동이 ai-learning 두 번째 활동으로 등록되어 있다", async () => {
  const [groupsRaw, lessonsRaw] = await Promise.all([
    readFile(new URL("../../data/activity-groups.json", lessonRoot), "utf8"),
    readFile(new URL("../../data/lessons.json", lessonRoot), "utf8"),
  ]);
  const groups = JSON.parse(groupsRaw).groups;
  const learningGroup = groups.find((group) => group.id === "ai-learning");
  assert.ok(learningGroup, "ai-learning 그룹을 찾을 수 없음");
  assert.equal(learningGroup.children.length, 2, "ai-learning은 이제 두 활동 구조여야 함");
  const child = learningGroup.children.find((candidate) => candidate.id === "ai-prediction-lab");
  assert.ok(child, "ai-prediction-lab이 ai-learning 그룹의 활동으로 등록되어 있어야 함");
  assert.equal(child.path, "lessons/ai-prediction-lab/");
  assert.equal(child.order, 2);
  // 아직 다듬는 중이라 비공개(active:false) 상태 — 완성되면 true로 전환한다.
  assert.equal(child.active, false);

  const lessons = JSON.parse(lessonsRaw).lessons;
  const lesson = lessons.find((candidate) => candidate.id === "ai-prediction-lab");
  assert.ok(lesson, "ai-prediction-lab이 data/lessons.json에 등록되어 있어야 함");
  assert.equal(lesson.path, "lessons/ai-prediction-lab/");
  assert.equal(lesson.unit, "기계학습과 데이터");
  assert.equal(lesson.order, 2);
});
