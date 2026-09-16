import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classify } from "../lessons/ai-inference-ripeness/game-core.js";

const lessonRoot = new URL("../lessons/ai-inference-ripeness/", import.meta.url);

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-filter="wrong"/);
  assert.match(html, /id="specimen-visual"/);
  assert.match(html, /role="img"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /event\.key === "1"/);
  assert.match(js, /event\.key === "2"/);
});

test("화면에는 숨은 점수나 가중치 설명이 없다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /가중치|색깔 점수|촉감 점수|임계값/);
});

test("정답 확인표에는 내 예측 열이 없고 쉬운 표현을 쓴다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /내 예측/);
  assert.doesNotMatch(html, /관측값|가설|데이터 로그|분류 규칙을 추론/);
  assert.match(html, /정답 확인표/);
  assert.match(html, /내 생각 점검/);
});

test("마트에서 과일 선별 AI를 훈련시키는 임무로 도입하고, 숨은 점수 규칙을 미리 밝히지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<title>잘 익은 과일 찾기/);
  assert.match(html, /마트/);
  assert.match(html, /AI를 훈련/);
  assert.doesNotMatch(html, /빨강이면 무조건|색깔 점수|촉감 점수/);
});

test("화면·기록·필터·SVG 설명 어디에도 계절 속성이 남아있지 않다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  const specimenJs = await readFile(new URL("specimen-visual.js", lessonRoot), "utf8");
  for (const [name, text] of [["index.html", html], ["game.js", js], ["styles.css", css], ["specimen-visual.js", specimenJs]]) {
    assert.doesNotMatch(text, /계절/, `${name}에 "계절" 문구가 남아있음`);
    assert.doesNotMatch(text, /season/i, `${name}에 season 관련 코드가 남아있음`);
    assert.doesNotMatch(text, /봄|여름|가을|겨울/, `${name}에 계절 문자열이 남아있음`);
  }
  assert.doesNotMatch(html, /세 가지 정보/);
  assert.doesNotMatch(html, /관계없는 정보/);
  assert.doesNotMatch(html, /노이즈/);
  assert.match(html, /색깔과 촉감/);
});

test("학습 12개와 시험 5개, 학습→전환→시험→결과 화면 구조를 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /학습 12/);
  assert.match(html, /시험 5/);
  assert.match(html, /id="question-view"/);
  assert.match(html, /id="test-view"/);
  assert.match(html, /id="transition-view"/);
  assert.match(html, /id="results-view"/);
  assert.match(html, /id="start-test-button"/);
  assert.match(html, /이제 AI가 배운 규칙을 시험합니다/);
  assert.match(html, /학습 점수와 시험 점수/);
});

test("시험 전환·결과 화면 문구는 문제별 정답을 미리 알려주지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /색깔 점수|촉감 점수|판정 기준은/);
});

test("game.js는 submitPrediction의 reveal 플래그로만 학습 정답 공개 여부를 분기하고, 시험은 submitTestBatch로 일괄 제출한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /outcome\.correct \? "correct" : "incorrect"/);
  assert.match(js, /submitTestBatch/);
  assert.doesNotMatch(js, /outcome\.reveal/, "더 이상 사용하지 않는 시험 문제별 reveal 분기가 남아있으면 안 됨");
});

test("전환 화면 안에 학습 12개 결과 전체 표(색깔·촉감·내 판단·실제 정답·O/X)와 규칙 정리 안내가 있다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="transition-summary-body"/);
  assert.match(html, /id="transition-train-score"/);
  assert.match(html, /id="transition-train-count"/);
  assert.match(html, /<th scope="col">내 판단<\/th>/);
  assert.match(html, /<th scope="col">실제 정답<\/th>/);
  assert.match(html, /색깔과 촉감을 비교해 규칙을 정리해 보세요/);
  assert.match(js, /renderTransitionSummary/);
  assert.match(js, /transitionSummaryBody\.innerHTML/);
});

test("시험 5문제를 한 화면에 모두 렌더링할 컨테이너와 카드마다 필요한 접근성 장치를 제공한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="test-grid"/);
  assert.match(html, /id="test-error"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /id="submit-test-button"/);
  assert.match(html, /시험 답안 제출/);
  assert.match(js, /<fieldset class="test-card"/);
  assert.match(js, /<legend>/);
  assert.match(js, /role="img"/);
  assert.match(js, /type="radio"/);
  assert.match(js, /name="test-answer-\$\{index\}"/);
});

test("시험 제출 전에는 정답을 노출하지 않고, 미응답이면 접근 가능한 오류와 첫 미응답 문항 포커스를 제공한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /missingIndex/);
  assert.match(js, /testError\.hidden = false/);
  assert.match(js, /답하지 않았습니다/);
  assert.match(js, /focus\(\)/);
});

test("시험 제출 후 결과 화면은 개별 정답이나 O\\/X 없이 전체 점수만 보여준다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const resultsMatch = html.match(/<div id="results-view"[\s\S]*?<\/div>\s*<\/section>/);
  assert.ok(resultsMatch, "results-view 섹션을 찾을 수 없음");
  const resultsHtml = resultsMatch[0];
  assert.doesNotMatch(resultsHtml, /table/);
  assert.doesNotMatch(resultsHtml, /class="result/);
  assert.match(resultsHtml, /id="test-score"/);
  assert.match(resultsHtml, /id="test-count"/);
});

test("README와 활동지 목록 페이지 소개 문구는 시험 5문제를 한 화면에서 동시에 치른다고 설명한다", async () => {
  const [readme, groupPage] = await Promise.all([
    readFile(new URL("../../README.md", lessonRoot), "utf8"),
    readFile(new URL("../../units/machine-learning-algorithms/index.html", lessonRoot), "utf8"),
  ]);
  assert.match(readme, /한 화면에 모두 띄워|동시에/);
  assert.match(groupPage, /한 화면에서 동시에/);
});

test("시험 안내는 '한 번도 보여주지 않은 새 과일' 대신 같은 판단 규칙을 다른 과일에 적용한다고 설명한다", async () => {
  const [html, readme, groupPage] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../../README.md", lessonRoot), "utf8"),
    readFile(new URL("../../units/machine-learning-algorithms/index.html", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /한 번도 보여주지 않은|처음 보는 과일/);
  assert.match(html, /같은 판단 규칙|같은 규칙/);

  const activity1Section = groupPage.match(/<a class="lesson-card" href="\.\.\/\.\.\/lessons\/ai-inference-ripeness\/"[^>]*>[\s\S]*?<\/a>/)[0];
  assert.doesNotMatch(activity1Section, /처음 보는 과일/);

  const activity1Readme = readme.match(/^1\. .*$/m)[0];
  assert.doesNotMatch(activity1Readme, /처음 보는 과일/);
});

test("학습 12개 완료 전환 화면 안내는 짧은 단계 목록(transition-steps)으로 나뉘어 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<ul class="transition-steps">/);
  const stepsMatch = html.match(/<ul class="transition-steps">([\s\S]*?)<\/ul>/);
  assert.ok(stepsMatch, "transition-steps 목록을 찾을 수 없음");
  const stepCount = (stepsMatch[1].match(/<li>/g) || []).length;
  assert.ok(stepCount >= 2, "전환 안내가 여러 단계로 나뉘어 있어야 함");
});

test("전환 화면에는 학습 순서/색깔별 보기 토글이 있고 기본값은 색깔별 보기다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="transition-view-color"[^>]*aria-pressed="true"/);
  assert.match(html, /id="transition-view-order"[^>]*aria-pressed="false"/);
  assert.match(js, /transitionViewMode = "color"/);
  assert.match(js, /sortByColorAndTexture/);
});

test("결과표 바로 위에 같은 색깔·촉감 비교 분석 팁이 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const summaryMatch = html.match(/<div class="transition-summary">[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(summaryMatch, "transition-summary 블록을 찾을 수 없음");
  const tipIndex = summaryMatch[0].indexOf("같은 색깔끼리 비교");
  const tableIndex = summaryMatch[0].indexOf("transition-summary-body");
  assert.ok(tipIndex !== -1, "분석 팁 문구를 찾을 수 없음");
  assert.ok(tipIndex < tableIndex, "분석 팁은 결과표보다 앞에 있어야 함");
});

test("전환 화면에 선택형 힌트 사다리가 있고 처음에는 닫혀 있으며 키보드/스크린리더 장치를 갖춘다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="hint-list"/);
  assert.match(html, /id="hint-button"[^>]*aria-expanded="false"/);
  assert.match(html, /aria-controls="hint-list"/);
  assert.match(html, /id="hint-status"[^>]*aria-live="polite"/);
  assert.match(js, /TRAIN_HINTS/);
  assert.match(js, /nextHintCount/);
  assert.doesNotMatch(js, /감점|패널티|불이익/);
});

test("힌트 4단계는 game-core의 TRAIN_HINTS를 그대로 사용해 목록을 만든다(문구 중복 없음)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /TRAIN_HINTS\.map/);
});

test("숨은 판정 규칙(빨강 항상 익음·초록 항상 안 익음·노랑\\/주황은 단단함만 안 익음)은 그대로 유지된다", () => {
  assert.equal(classify({ color: "빨강", texture: "단단함" }), "잘 익음");
  assert.equal(classify({ color: "빨강", texture: "말랑함" }), "잘 익음");
  assert.equal(classify({ color: "초록", texture: "단단함" }), "안 익음");
  assert.equal(classify({ color: "초록", texture: "말랑함" }), "안 익음");
  assert.equal(classify({ color: "노랑", texture: "단단함" }), "안 익음");
  assert.equal(classify({ color: "노랑", texture: "중간" }), "잘 익음");
  assert.equal(classify({ color: "주황", texture: "단단함" }), "안 익음");
  assert.equal(classify({ color: "주황", texture: "말랑함" }), "잘 익음");
});

test("활동1 페이지·활동지 목록 페이지·data/lessons.json의 난이도 표기가 '보통'으로 통일되어 있다", async () => {
  const [html, groupPage, lessonsJson] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../../units/machine-learning-algorithms/index.html", lessonRoot), "utf8"),
    readFile(new URL("../../data/lessons.json", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<dt>난이도<\/dt><dd>보통<\/dd>/);

  const activity1Card = groupPage.match(/<a class="lesson-card" href="\.\.\/\.\.\/lessons\/ai-inference-ripeness\/"[^>]*>[\s\S]*?<\/a>/)[0];
  assert.match(activity1Card, /실습 · 보통/);

  const lessons = JSON.parse(lessonsJson).lessons;
  const activity1 = lessons.find((lesson) => lesson.id === "ai-inference-ripeness");
  assert.equal(activity1.difficulty, "보통");
  const activity2 = lessons.find((lesson) => lesson.id === "ai-signal-noise");
  const activity3 = lessons.find((lesson) => lesson.id === "ai-biased-data");
  assert.equal(activity2.difficulty, "입문", "활동2 난이도는 그대로 보존되어야 함");
  assert.equal(activity3.difficulty, "입문", "활동3 난이도는 그대로 보존되어야 함");
});
