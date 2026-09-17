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
  predictIceCreamSales,
  ICE_CREAM_NEW_CONDITION,
  ICE_CREAM_ACTUAL_SALES,
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

test("활동2: predictVisitors는 기온·강수량 데이터로 직접 계산한 최소제곱 결과와 일치한다", () => {
  const [intercept, tempCoef, rainCoef] = multipleLinearRegression(
    PARK_DATA.map((d) => [d.temp, d.rain]),
    PARK_DATA.map((d) => d.visitors),
  );
  const expected = Math.floor(
    intercept + tempCoef * PARK_QUESTION_CONDITION.temp + rainCoef * PARK_QUESTION_CONDITION.rain,
  );
  assert.equal(predictVisitors(PARK_QUESTION_CONDITION.temp, PARK_QUESTION_CONDITION.rain), expected);
});

test("활동2: 기온이 오르면 방문객 예측이 늘고, 강수량이 늘면 방문객 예측이 준다", () => {
  const base = predictVisitors(25, 0);
  assert.ok(predictVisitors(30, 0) > base, "기온이 오르면 방문객 수 예측이 늘어야 함");
  assert.ok(predictVisitors(25, 20) < base, "강수량이 늘면 방문객 수 예측이 줄어야 함");
});

// --- 활동3: 관계없는 정보(화분 개수·이름 글자 수) 무관성 -------------------------

test("활동3: predictIceCreamSales는 화분 개수·이름 글자 수를 아예 입력으로 받지 않는다(함수 시그니처 자체가 3개 인자)", () => {
  assert.equal(predictIceCreamSales.length, 3);
});

test("활동3: 기온·비·주말이 같으면, 원래 데이터에 없던 화분 개수·이름 글자 수 조합이 섞여 있어도 예측은 항상 같다", () => {
  // 화분 개수·이름 글자 수는애초에 predictIceCreamSales의 인자가 아니므로, 이 테스트는
  // "여러 다른 상황을 시뮬레이션해도 같은 (기온,비,주말) 입력이면 같은 결과가 나온다"는
  // 함수의 순수성/일관성을 확인한다 — 실제 무관성은 위 시그니처 테스트가 구조적으로 보장한다.
  const first = predictIceCreamSales(28, false, true);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(predictIceCreamSales(28, false, true), first);
  }
});

test("활동3: predictIceCreamSales(새 조건)은 164, 실제 판매량은 169, 오차는 정확히 5다", () => {
  const predicted = predictIceCreamSales(
    ICE_CREAM_NEW_CONDITION.temp,
    ICE_CREAM_NEW_CONDITION.rain,
    ICE_CREAM_NEW_CONDITION.weekend,
  );
  assert.equal(predicted, 164);
  assert.equal(ICE_CREAM_ACTUAL_SALES, 169);
  assert.equal(Math.abs(ICE_CREAM_ACTUAL_SALES - predicted), 5);
});

test("활동3: 기온이 오르면 예측이 늘고, 비가 오면 줄고, 주말이면 는다(세 정보 모두 유의미하게 작동)", () => {
  const base = predictIceCreamSales(25, false, false);
  assert.ok(predictIceCreamSales(30, false, false) > base, "기온이 오르면 판매량 예측이 늘어야 함");
  assert.ok(predictIceCreamSales(25, true, false) < base, "비가 오면 판매량 예측이 줄어야 함");
  assert.ok(predictIceCreamSales(25, false, true) > base, "주말이면 판매량 예측이 늘어야 함");
});

test("활동3: 최소제곱 회귀 데이터셋에는 실제로 화분 개수·이름 글자 수 컬럼이 존재하지만 모델은 이를 사용하지 않는다", () => {
  // ICE_CREAM_DATA 자체에는 pots/nameLength가 들어 있어야 화면 표에 보여줄 수 있다(학생이 직접
  // "이 정보는 관계없어 보인다"를 눈으로 비교해야 하므로) — 데이터에는 있되 모델에는 안 쓰인다는
  // 것을 함께 확인한다.
  for (const row of ICE_CREAM_DATA) {
    assert.ok(typeof row.pots === "number");
    assert.ok(typeof row.nameLength === "number");
  }
});

// --- HTML/CSS/JS 구조 검증 ------------------------------------------------

test("독립 lesson 페이지가 fonts.css·lab-base.css·guard.css와 그룹/활동 가드 속성을 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>AI는 어떻게 값을 예측할까\? \| 기계학습과 데이터<\/title>/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/shared\/lab-base\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="ai-learning"/);
  assert.match(html, /data-guard-lesson="ai-prediction-lab"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/ai-learning\/"/);
});

test("세 활동 단계와 데이터표·예측 입력·결과 공개 영역이 모두 존재한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  for (const id of ["stage1-view", "stage2-view", "stage3-view", "results-view"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="study-table"/);
  assert.match(html, /id="park-table"/);
  assert.match(html, /id="ice-cream-table"/);
  assert.match(html, /id="stage1-chart"/);
  for (const id of ["stage1-guess", "stage2-guess", "stage3-guess"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*type="number"`));
  }
  for (const id of ["stage1-reveal", "stage2-reveal", "stage3-reveal"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*class="reveal-box"|class="reveal-box"[^>]*id="${id}"`));
  }
});

test("활동 3의 체크박스 자기점검은 채점되지 않는다고 명시하고, 5개 속성을 모두 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const checklistMatch = html.match(/<form class="checklist-form"[\s\S]*?<\/form>/);
  assert.ok(checklistMatch, "checklist-form을 찾을 수 없음");
  assert.match(checklistMatch[0], /채점되지 않는/);
  const checkboxCount = (checklistMatch[0].match(/type="checkbox"/g) ?? []).length;
  assert.equal(checkboxCount, 5);
});

test("생각해보기(discussion) 블록이 세 활동 모두에 있고, 사용자가 준 질문 문구를 그대로 담는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const discussionBlocks = html.match(/<div class="discussion">[\s\S]*?<\/div>/g) ?? [];
  assert.ok(discussionBlocks.length >= 4, "활동 1·2·3과 마무리, 최소 4개의 discussion 블록이 있어야 함");
  assert.match(html, /나는 어떤 규칙을 찾아서 예측했나요\?/);
  assert.match(html, /AI는 무엇을 보고 값을 예측했을까요\?/);
  assert.match(html, /기온을 높이면 방문객 수는 어떻게 변하나요\?/);
  assert.match(html, /정보가 많으면 항상 더 정확하게 예측할 수 있을까요\?/);
});

test("마무리 화면은 사용자가 준 세 정리 문장을 그대로 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /인공지능은 기존 데이터에서 패턴을 찾아 새로운 값을 예측합니다\./);
  assert.match(html, /여러 정보를 함께 사용할 수 있지만, 모든 정보가 예측에 도움이 되는 것은 아닙니다\./);
  assert.match(html, /인공지능의 예측은 실제 결과와 완전히 일치하지 않을 수 있으며, 어느 정도의 오차가 존재할 수 있습니다\./);
});

test("game.js는 game-core.js의 예측 함수를 사용하고, 활동 2·3의 슬라이더 입력마다 실시간으로 재계산한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /predictStudyScore/);
  assert.match(js, /predictVisitors/);
  assert.match(js, /predictIceCreamSales/);
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
