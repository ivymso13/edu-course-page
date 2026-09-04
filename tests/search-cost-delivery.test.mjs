import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runUcsGraphTrace } from "../lessons/shared/search-graph-lab.js";
import { buildRounds, checkPickAnswer, checkDupAnswer, summarize, pathLabel, FEWER_HOPS_PATH } from "../lessons/search-cost-delivery/game-core.js";

const lessonRoot = new URL("../lessons/search-cost-delivery/", import.meta.url);
const trace = runUcsGraphTrace();
const rounds = buildRounds(trace);

test("라운드는 트레이스의 확장 단계 수(5)만큼 만들어지고, 마지막 라운드만 목표 상태다", () => {
  assert.equal(rounds.length, 5);
  assert.ok(rounds.slice(0, -1).every((r) => !r.isGoal));
  assert.ok(rounds.at(-1).isGoal);
});

test("각 라운드는 중복 상태(dupChildren)를 0개 또는 1개만 갖는다", () => {
  for (const round of rounds) assert.ok(round.dupChildren.length <= 1);
  assert.equal(rounds.filter((r) => r.dupChildren.length === 1).length, 3, "운동장·중앙현관·급식실 확장 단계에서 중복이 발생해야 함");
});

test("checkPickAnswer는 실제로 확장된 상태를 골랐을 때만 correct다", () => {
  const round = rounds[1];
  assert.equal(checkPickAnswer(round, round.expandedId).correct, true);
  const wrong = round.pickCandidates.find((c) => c.id !== round.expandedId);
  if (wrong) assert.equal(checkPickAnswer(round, wrong.id).correct, false);
});

test("checkDupAnswer는 open-replace면 넣는 것이, open-worse-skip이면 넣지 않는 것이 정답이다", () => {
  const replaceRound = rounds.find((r) => r.dupChildren[0]?.status === "open-replace");
  const skipRound = rounds.find((r) => r.dupChildren[0]?.status === "open-worse-skip");
  assert.equal(checkDupAnswer(replaceRound.dupChildren[0], true).correct, true);
  assert.equal(checkDupAnswer(replaceRound.dupChildren[0], false).correct, false);
  assert.equal(checkDupAnswer(skipRound.dupChildren[0], false).correct, true);
  assert.equal(checkDupAnswer(skipRound.dupChildren[0], true).correct, false);
});

test("summarize()는 이동 횟수가 적은 경로가 균일 비용 탐색 최적 경로보다 비싸거나 같음을 보여준다", () => {
  const summary = summarize({ trace });
  assert.ok(summary.saved >= 0);
  assert.equal(summary.hops, summary.path.length - 1);
  assert.equal(summary.fewerHopsPath, FEWER_HOPS_PATH);
});

test("pathLabel은 노드 id를 한글 장소 이름으로 바꿔 화살표로 잇는다", () => {
  assert.equal(pathLabel(["gate", "yard", "store"]), "정문 → 운동장 → 매점");
});

test("독립 lesson 페이지와 접근성 장치, 그래프 기반 예측 UI를 제공한다", async () => {
  const [html, labCss, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-cost-delivery"/);
  assert.match(html, /id="predict-graph"/);
  assert.doesNotMatch(html, /id="predict-choice"/);
  assert.doesNotMatch(html, /정문 → 중앙현관 → 매점/);
  assert.match(html, /id="start-ucs-button"[^>]*>균일 비용 탐색으로 진짜 빠른 길 찾아보기/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("균일 비용 탐색의 정의와 g(n) 표기, 오픈 리스트·닫힌 리스트, 맹목적(무정보) 탐색 용어가 화면에 등장한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /균일 비용 탐색/);
  assert.match(html, /g\(n\)/);
  assert.match(html, /오픈 리스트/);
  assert.match(html, /닫힌 리스트/);
  assert.match(html, /맹목적 탐색\(무정보 탐색, uninformed search\)/);
});

test("집에서 학교까지의 사람용 도전 뒤에 경로 선택 없이 UCS 활동이 열린다", async () => {
  const [html, js, practiceJs] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("practice.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="human-challenge"/);
  assert.match(html, /집에서 학교까지 가장 적게 걸리는 시간은/);
  assert.match(html, /id="commute-cost"[^>]*type="number"/);
  assert.doesNotMatch(html, /data-cost=/);
  assert.match(html, /id="ucs-concept" class="concept-bridge" hidden/);
  assert.match(html, /id="complex-challenge"/);
  assert.match(html, /id="method-transition"/);
  assert.match(html, /사람의 계산에서 컴퓨터의 탐색으로/);
  assert.match(html, /직접 찾아보기/);
  assert.match(html, /복잡한 지도 도전/);
  assert.match(html, /data-go-stage="1"/);
  assert.match(html, /data-go-stage="2"/);
  assert.match(html, /data-go-stage="3"/);
  assert.match(html, /균일 비용 탐색/);
  assert.match(html, /장소 24개와 길 48개/);
  assert.match(js, /한 번 더 비교해 보세요/);
  assert.match(js, /정답이 아닙니다/);
  assert.match(html, /id="complex-cost"[^>]*type="number"/);
  assert.match(html, /이번에도 가장 적게 걸리는 시간을 바로 찾을 수 있을까/);
  assert.match(html, /학교까지 걸리는 가장 짧은 시간 예상하기/);
  assert.match(js, /정답입니다/);
  assert.match(js, /el\.continueToUcs\.hidden = true/);
  assert.match(js, /el\.startComputerMethod\.hidden = true/);
  assert.match(js, /\["편의점", "🏪"\]/);
  assert.match(js, /\["학교", "🏫"\]/);
  assert.match(practiceJs, /minNodes: 5, maxNodes: 6/);
});

test("고정 그래프는 장소명과 a~e를 함께 표시하고 오픈·닫힌 리스트는 알파벳만 사용한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /gate: "a", lobby: "b", yard: "c", cafeteria: "d", store: "e"/);
  assert.match(js, /label: `\$\{node\.label\} \(\$\{NODE_SYMBOLS\[node\.id\]\}\)`/);
  assert.match(js, /nodes: LIST_NODES/);
  assert.match(js, /nodes: GRAPH_NODES/);
  assert.match(js, /node\.id === "lobby" \? 44 : 36/);
});
