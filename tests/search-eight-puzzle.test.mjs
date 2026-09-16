import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);

test("8-퍼즐은 강 건너기와 다른 독립 페이지로 제공된다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<h1 id="page-title">8-퍼즐로 보는 맹목적 탐색<\/h1>/);
  assert.match(html, /data-guard-lesson="search-eight-puzzle"/);
  assert.doesNotMatch(html, /id="river-game"/);
  assert.match(html, /href="\.\.\/search-bfs-delivery\/"/);
});

test("8-퍼즐 화면은 초기·목표 상태와 BFS 층별 공개 구조를 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="start-grid"/);
  assert.match(html, /id="goal-grid"/);
  assert.match(html, /id="search-levels"/);
  assert.match(html, /id="reveal-round"/);
  assert.match(html, /BFS와 DFS/);
});

test("BFS 상태는 초기 상태부터 깊이별 한 줄로 누적된다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /초기 상태부터 깊이별로 넓혀 보기/);
  assert.doesNotMatch(html, /층/);
  assert.doesNotMatch(js, /층/);
  assert.match(js, /function createInitialLevel/);
  assert.match(js, /function candidateLevel/);
  assert.match(js, /function expandState/);
  assert.match(js, /puzzleMoves\(parsePuzzleKey\(card\.dataset\.key\)\)/);
  assert.doesNotMatch(html, /눌러서 펼치기/);
  assert.match(html, /각 상태를 눌러서 다음 상태를 확인하세요/);
  assert.match(js, /seenThisLevel/);
  assert.doesNotMatch(js, /el\.levels\.innerHTML\s*=\s*""/);
  assert.doesNotMatch(js, /el\.trace\.hidden\s*=\s*true/);
  assert.match(css, /flex-wrap:nowrap/);
  assert.match(css, /overflow-x:auto/);
});

test("8-퍼즐은 새 상태와 중복 상태를 색상 외 텍스트로 구분한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  // 목표 상태인 새 상태는 "목표 상태"로 문구가 대체되므로(tests/search-eight-puzzle-goal-highlight.test.mjs 참고),
  // 여기서는 새 상태·중복 상태를 구분하는 문구 자체가 남아 있는지만 확인한다.
  assert.match(js, /"새 상태"/);
  assert.match(js, /"중복 상태 · 제외"/);
});

test("활동 데이터에는 강 건너기와 8-퍼즐이 별도 항목으로 등록된다", async () => {
  const data = JSON.parse(await readFile(new URL("../../data/activity-groups.json", lessonRoot), "utf8"));
  const group = data.groups.find((item) => item.id === "ai-search");
  assert.equal(group.children.length, 4);
  assert.equal(group.children[0].id, "search-bfs-delivery");
  assert.equal(group.children[1].id, "search-eight-puzzle");
  assert.equal(group.children[1].path, "lessons/search-eight-puzzle/");
  assert.equal(group.children[3].id, "search-astar-delivery");
});
