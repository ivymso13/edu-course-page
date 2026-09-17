import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function loadGroups() {
  const raw = await readFile(new URL("data/activity-groups.json", repoRoot), "utf8");
  return JSON.parse(raw);
}

const GROUP_PAGES = {
  "ai-learning": ["units/ai-learning/index.html", "lessons/ai-problem-method/index.html", "lessons/ai-prediction-lab/index.html"],
  "machine-learning-algorithms": ["units/machine-learning-algorithms/index.html", "lessons/ai-inference-ripeness/index.html", "lessons/ai-signal-noise/index.html", "lessons/ai-biased-data/index.html"],
  "ai-vocabulary": ["units/ai-vocabulary/index.html", "lessons/ai-keyword-bingo/index.html"],
  "ai-evaluation": ["units/ai-evaluation/index.html", "lessons/turing-test-questions/index.html", "lessons/arc-puzzle-challenge/index.html", "lessons/turing-vs-arc-compare/index.html"],
};

test("모든 group은 명시적인 active boolean 필드를 갖는다", async () => {
  const data = await loadGroups();
  assert.ok(data.groups.length >= 2);
  for (const group of data.groups) {
    assert.equal(typeof group.active, "boolean", `${group.id}의 active가 boolean이 아님`);
  }
});

test("새 그룹 ai-vocabulary는 초기 active=true다", async () => {
  const data = await loadGroups();
  const group = data.groups.find((candidate) => candidate.id === "ai-vocabulary");
  assert.ok(group, "ai-vocabulary group을 찾을 수 없음");
  assert.equal(group.active, true);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].id, "ai-keyword-bingo");
});

test("활동지 03·04·05는 공개하고 활동지 06은 비활성화한다", async () => {
  const data = await loadGroups();
  const learning = data.groups.find((candidate) => candidate.id === "ai-learning");
  const search = data.groups.find((candidate) => candidate.id === "ai-search");
  const problemCases = data.groups.find((candidate) => candidate.id === "search-problem-cases");
  const algorithms = data.groups.find((candidate) => candidate.id === "machine-learning-algorithms");
  assert.equal(learning.active, true);
  assert.equal(search.active, true);
  assert.equal(problemCases.active, true);
  assert.deepEqual(learning.children.map(({ active }) => active), [true, false]);
  assert.equal(algorithms.active, false);
  assert.deepEqual(algorithms.children.map(({ active }) => active), [true, true, true]);
  assert.deepEqual(search.children.map(({ active }) => active), [true, true, true, true]);
  assert.deepEqual(problemCases.children.map(({ active }) => active), [true, true]);
  for (const group of data.groups) {
    if (group.id !== "machine-learning-algorithms") {
      assert.equal(group.active, true, `${group.id}는 공개 상태여야 함`);
    }
  }
});

test("assets/group-guard.js와 assets/guard.css가 존재하고, 로더는 data/activity-groups.json을 스스로의 위치 기준 상대 경로로 불러온다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("assets/group-guard.js", repoRoot), "utf8"),
    readFile(new URL("assets/guard.css", repoRoot), "utf8"),
  ]);
  assert.ok(js.length > 0);
  assert.ok(css.length > 0);
  assert.match(js, /import\.meta\.url/);
  assert.match(js, /\.\.\/data\/activity-groups\.json/);
  assert.match(js, /fetch\(/);
});

test("루트 허브는 hub 스코프 가드를 선언하고, 모든 group에 data-group-card를 붙인다", async () => {
  const [html, data] = await Promise.all([
    readFile(new URL("index.html", repoRoot), "utf8"),
    loadGroups(),
  ]);
  assert.match(html, /data-guard-scope="hub"/);
  assert.match(html, /assets\/group-guard\.js/);
  assert.match(html, /assets\/guard\.css/);
  for (const group of data.groups) {
    assert.match(html, new RegExp(`data-group-card="${group.id}"`), `허브에 ${group.id}의 data-group-card가 없음`);
  }
});

test("guard.css는 잠금 배지가 .group-card의 grid-template-columns 3열을 깨지 않도록 전체 폭 행으로 배치한다", async () => {
  const css = await readFile(new URL("assets/guard.css", repoRoot), "utf8");
  assert.match(
    css,
    /\.group-card\s*>\s*\.group-status-badge\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
    "group-status-badge가 grid-column: 1 / -1로 전체 폭 행에 배치되어야 함(3열 grid 4번째 자식으로 끼어들며 레이아웃이 깨지는 문제 방지)"
  );
});

test("group-guard.js의 허브 가드는 fetch 실패 시(catch) 카드를 잠그지 않고 열어 둔다(fail-open)", async () => {
  const js = await readFile(new URL("assets/group-guard.js", repoRoot), "utf8");
  const catchBlockMatch = js.match(/async function guardHub[\s\S]*?catch \(error\) \{([\s\S]*?)\n\}/);
  assert.ok(catchBlockMatch, "guardHub의 catch 블록을 찾을 수 없음");
  assert.doesNotMatch(catchBlockMatch[1], /markCardLocked/, "허브 fetch 실패 시 카드를 잠그면 안 됨(file:// 등에서 모든 카드가 영구 잠기는 문제)");
  assert.match(catchBlockMatch[1], /status\.set\(card, "active"\)/, "허브 fetch 실패 시 카드를 active로 되돌려(fail-open) 클릭이 통과되어야 함");
});

test("모든 unit·lesson 페이지는 공통 가드(pending 초기 상태, 소속 group-id, 준비 중 안내, 홈 복귀 링크)를 갖는다", async () => {
  for (const [groupId, pages] of Object.entries(GROUP_PAGES)) {
    for (const page of pages) {
      const html = await readFile(new URL(page, repoRoot), "utf8");
      assert.match(html, /data-guard\("pending"\)|setAttribute\("data-guard", "pending"\)/, `${page}에 초기 pending 가드 스크립트가 없음`);
      assert.match(html, new RegExp(`data-guard-scope="page"[^>]*data-guard-group="${groupId}"|data-guard-group="${groupId}"[^>]*data-guard-scope="page"`), `${page}의 data-guard-group이 ${groupId}가 아님`);
      assert.match(html, /id="guard-blocked"/, `${page}에 guard-blocked 안내가 없음`);
      assert.match(html, /id="guard-content"/, `${page}에 guard-content 래퍼가 없음`);
      assert.match(html, /class="guard-home-link"/, `${page}에 홈 복귀 링크가 없음`);
      assert.match(html, /assets\/group-guard\.js/, `${page}에 group-guard.js 로드가 없음`);
      assert.match(html, /assets\/guard\.css/, `${page}에 guard.css 로드가 없음`);
    }
  }
});

test("모든 group의 children은 명시적인 active boolean 필드를 갖는다", async () => {
  const data = await loadGroups();
  for (const group of data.groups) {
    for (const child of group.children) {
      assert.equal(typeof child.active, "boolean", `${group.id}의 ${child.id}에 active boolean이 없음`);
    }
  }
});

test("ai-evaluation 그룹의 활동 3개는 모두 active=true다(개별 활동 숨김은 현재 쓰지 않음)", async () => {
  const data = await loadGroups();
  const group = data.groups.find((candidate) => candidate.id === "ai-evaluation");
  assert.ok(group, "ai-evaluation group을 찾을 수 없음");
  const byId = Object.fromEntries(group.children.map((child) => [child.id, child]));
  assert.equal(byId["turing-test-questions"].active, true);
  assert.equal(byId["arc-puzzle-challenge"].active, true);
  assert.equal(byId["turing-vs-arc-compare"].active, true);
  assert.equal(group.active, true);
});

test("모든 활동 페이지(<body>)는 data-guard-lesson으로 자기 자신의 child id를 선언한다", async () => {
  const LESSON_PAGE_TO_ID = {
    "lessons/ai-keyword-bingo/index.html": "ai-keyword-bingo",
    "lessons/ai-inference-ripeness/index.html": "ai-inference-ripeness",
    "lessons/ai-signal-noise/index.html": "ai-signal-noise",
    "lessons/ai-biased-data/index.html": "ai-biased-data",
    "lessons/ai-problem-method/index.html": "ai-problem-method",
    "lessons/ai-prediction-lab/index.html": "ai-prediction-lab",
    "lessons/search-tictactoe-minimax/index.html": "search-tictactoe-minimax",
    "lessons/search-othello-minimax/index.html": "search-othello-minimax",
    "lessons/turing-test-questions/index.html": "turing-test-questions",
    "lessons/arc-puzzle-challenge/index.html": "arc-puzzle-challenge",
    "lessons/turing-vs-arc-compare/index.html": "turing-vs-arc-compare",
  };
  for (const [page, lessonId] of Object.entries(LESSON_PAGE_TO_ID)) {
    const html = await readFile(new URL(page, repoRoot), "utf8");
    assert.match(html, new RegExp(`data-guard-lesson="${lessonId}"`), `${page}에 data-guard-lesson="${lessonId}"가 없음`);
  }
});

test("모든 활동지 목록 페이지는 각 하위 활동 카드에 data-lesson-card로 child id를 붙인다", async () => {
  for (const [groupId, pages] of Object.entries(GROUP_PAGES)) {
    const groupPagePath = pages[0]; // GROUP_PAGES의 각 배열 첫 항목은 units/<group-id>/index.html
    const html = await readFile(new URL(groupPagePath, repoRoot), "utf8");
    const data = await loadGroups();
    const group = data.groups.find((candidate) => candidate.id === groupId);
    for (const child of group.children) {
      assert.match(html, new RegExp(`data-lesson-card="${child.id}"`), `${groupPagePath}에 ${child.id}의 data-lesson-card가 없음`);
    }
  }
});
