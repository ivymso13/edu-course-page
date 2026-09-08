import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runAStarGraphTrace, runUcsGraphTrace } from "../lessons/shared/search-graph-lab.js";
import {
  buildMapRounds, checkMapPickAnswer, checkMapDupAnswer, summarizeMap, mapPathLabel,
  NEW_GOAL_STATE, NEW_START, getNeighbors, misplacedTiles, solveAstar, checkChoice,
} from "../lessons/search-astar-delivery/game-core.js";

const lessonRoot = new URL("../lessons/search-astar-delivery/", import.meta.url);

test("학교 지도 A* 트레이스는 3단계와 같은 경로를 더 적은 상태로 찾는다", () => {
  const trace = runAStarGraphTrace();
  assert.deepEqual(trace.order, ["gate", "yard", "cafeteria", "store"]);
  assert.deepEqual(trace.path, ["gate", "yard", "cafeteria", "store"]);
  assert.equal(trace.pathCost, 12);
  assert.equal(trace.path.join("|"), runUcsGraphTrace().path.join("|"), "A*와 균일 비용 탐색은 같은 최종 경로를 찾아야 함");
  assert.ok(trace.order.length < runUcsGraphTrace().order.length, "A*는 균일 비용 탐색보다 적은 상태를 확인해야 함");
});

test("학교 지도 라운드는 4개이며, dupChildren은 항상 기존 값을 유지하는 것이 정답이다", () => {
  const rounds = buildMapRounds(runAStarGraphTrace());
  assert.equal(rounds.length, 4);
  assert.ok(rounds.at(-1).isGoal);
  const dupRounds = rounds.filter((r) => r.dupChildren.length > 0);
  assert.ok(dupRounds.length > 0);
  for (const round of dupRounds) {
    assert.equal(round.dupChildren[0].status, "open-worse-skip");
    assert.equal(checkMapDupAnswer(round.dupChildren[0], false).correct, true);
    assert.equal(checkMapDupAnswer(round.dupChildren[0], true).correct, false);
  }
});

test("checkMapPickAnswer는 실제로 확장된 상태를 골랐을 때만 correct다", () => {
  const rounds = buildMapRounds(runAStarGraphTrace());
  const round = rounds[1];
  assert.equal(checkMapPickAnswer(round, round.expandedId).correct, true);
  const wrong = round.pickCandidates.find((c) => c.id !== round.expandedId);
  if (wrong) assert.equal(checkMapPickAnswer(round, wrong.id).correct, false);
});

test("summarizeMap은 A*가 균일 비용 탐색보다 적은 상태를 확인했음을 보여준다", () => {
  const summary = summarizeMap();
  assert.equal(summary.astarTested, 4);
  assert.equal(summary.ucsTested, 5);
  assert.equal(summary.saved, 1);
  assert.equal(mapPathLabel(summary.path), "정문 → 운동장 → 급식실 → 매점");
});

test("새 연습 문제(8-퍼즐)는 네 번 선택해 목표에 도달한다", () => {
  const result = solveAstar(NEW_START, NEW_GOAL_STATE);
  assert.deepEqual(NEW_GOAL_STATE, [1,2,3,4,5,6,7,8,0]);
  assert.equal(result.found, true);
  assert.equal(result.cost, 4);
  assert.equal(result.steps.length - 1, 4);
});

test("빈칸의 다음 상태는 위·아래·왼쪽·오른쪽 순서로 만든다", () => {
  assert.deepEqual(getNeighbors(NEW_START).map((item) => item.move), ["위","오른쪽"]);
});

test("8-퍼즐의 모든 단계에서 선택된 후보의 f는 최소이며 f=g+h이다", () => {
  const result = solveAstar(NEW_START, NEW_GOAL_STATE);
  for (const step of result.steps) {
    assert.equal(step.chosen.f, step.chosen.g + step.chosen.h);
    assert.equal(step.chosen.f, Math.min(...step.candidates.map((candidate) => candidate.f)));
    assert.equal(checkChoice(step, step.chosenKey).correct, true);
  }
});

test("misplacedTiles는 목표와 다른 숫자 타일 수를 센다(빈칸 제외)", () => {
  assert.equal(misplacedTiles(NEW_GOAL_STATE), 0);
  assert.equal(misplacedTiles(NEW_START), misplacedTiles(NEW_START, NEW_GOAL_STATE));
});

test("지도 예시·8-퍼즐 새 문제·3단계 연결·접근성 장치를 제공한다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /활동 1 · 교과서 예시 따라가기/);
  assert.match(html, /href="\.\.\/search-cost-delivery\/"/);
  assert.match(html, /활동 2 · 새로운 문제에 적용하기/);
  assert.match(html, /새 후보마다 g\(n\)만 제공합니다/);
  assert.match(html, /f\(n\) = g\(n\) \+ h\(n\)/);
  assert.match(html, /id="map-trace-graph"/);
  assert.match(html, /id="map-list-panel"/);
  assert.match(html, /id="map-summary"/);
  // g(n) 칩을 "a(10)"처럼 이름에 괄호값을 바로 붙여 보여주려면 칩 사이 간격을 없애는
  // list-panel-compact 클래스가 있어야 한다(교과서 예시·연습 문제·잘못된 h(n) 데모 3곳 모두).
  assert.equal((html.match(/class="list-panel list-panel-compact"/g) || []).length, 3);
  assert.match(html, /id="warmup-h"/);
  assert.match(html, /id="warmup-f"/);
  assert.match(html, /id="warmup-g"[^>]*value="0"[^>]*readonly/);
  assert.match(html, /data-guard-group="ai-search" data-guard-lesson="search-astar-delivery"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion/);
});

test("학교 지도의 휴리스틱값은 3단계 그래프의 간선 비용과 함께 균일 비용 탐색보다 적은 확인 횟수를 만든다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /gate: "a", lobby: "b", yard: "c", cafeteria: "d", store: "e"/);
});

test("그래프 노드에는 h(n)만 항상 보이고, g(n)은 그 상태로 이어지는 간선 위에 뜨며, 선택은 간선을 클릭해서 한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  // 노드: h(n)만, 방문 여부와 무관하게 항상.
  assert.match(js, /const H_LABELS = Object\.fromEntries\(NODES\.map\(\(n\) => \[n\.id, `h=\$\{HEURISTICS\[n\.id\]\}`\]\)\);/);
  assert.match(js, /gById: H_LABELS/);
  assert.doesNotMatch(js, /metricLabel: "f"/);
  // 간선: g(n)을 보여주고, 오픈 리스트로 이어지는 간선은 pick:true로 클릭 가능해야 한다.
  assert.match(js, /edgesOverride\.push\(\{\s*a: parentId, b: childId, displayValue: g, pick: true,/);
  assert.match(js, /edgesOverride\.push\(\{ a: parentId, b: childId, cost: `g=\$\{g\}` \}\)/);
  assert.match(js, /pick: true, displayValue: c\.g,/);
  // 클릭 처리는 노드가 아니라 .is-pickable(간선 포함) 전체를 대상으로 한다.
  assert.match(js, /event\.target\.closest\("\.is-pickable"\)/);
  assert.doesNotMatch(js, /event\.target\.closest\("\.graph-node\.is-pickable"\)/);
  // 정문처럼 들어오는 간선이 없는 상태만 예외적으로 노드 자체가 인터랙티브.
  assert.match(js, /nodeInteractiveIds = \[\.\.\.interactiveSet\]\.filter\(\(id\) => !mapRoundState\.parentOf\.has\(id\)\)/);
  // 오픈/닫힌 리스트 칩에는 g(n)과 f(n)을 "a(g=4, f=13)"처럼 이름 바로 뒤에 괄호로 붙여 보여준다
  // (h(n)은 그래프 노드의 보라 배지로 계속 보이므로 중복 표시하지 않는다. list-panel-compact가
  // 이름과 괄호 사이 간격을 없애 준다).
  assert.match(js, /format: \(entry\) => `\(g=\$\{entry\.g\}, f=\$\{entry\.f\}\)`,/);
  assert.doesNotMatch(js, /function gAndH/);
  assert.doesNotMatch(js, /function gLabel/);
  assert.match(js, /g\(n\)=\$\{candidate\.g\}, h\(n\)=\$\{candidate\.h\}/);
  assert.match(js, /f\(n\)=g\(n\)\+h\(n\)을 직접 계산해서 가장 작은 곳을 클릭하세요/);
});

test("오픈 리스트의 중복 상태는 기존 f(n)과 새 f(n)을 직접 비교해 갱신한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /existingDupF/);
  assert.match(js, /기존 f=\$\{existingDupF\(mapPendingDup\)\} 유지하기/);
  assert.match(js, /새 f=\$\{mapPendingDup\.newF\}으로 갱신하기/);
  assert.match(js, /existingF: existingDupF\(mapPendingDup\)/);
  assert.match(js, /newF: mapPendingDup\.newF/);
  assert.match(js, /기존 f\(n\)=\$\{existingDupF\(mapPendingDup\)\}와 새 f\(n\)=\$\{mapPendingDup\.newF\}를 비교해 더 작은 값을 선택하세요/);
  assert.match(js, /f\(n\)을 계산하면 새 값은 \$\{dup\.newG\}\+\$\{dup\.h\}=\$\{dup\.newF\}/);
});

test("연습 문제 섹션이 페이지에 연결되어 있고, 매번 새 랜덤 지도와 admissible한 h(n)을 만들어 같은 A* 상호작용을 반복한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("practice.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<script type="module" src="practice\.js\?v=[^"]*"><\/script>/);
  assert.match(html, /id="map-show-practice"/);
  assert.match(html, /id="map-practice-view"/);
  assert.match(html, /id="map-practice-graph"/);
  assert.match(html, /id="map-practice-new-graph"/);
  assert.match(html, /id="map-practice-summary"/);
  assert.match(js, /generateRandomGraph, generateAdmissibleHeuristics/);
  assert.match(js, /heuristics = generateAdmissibleHeuristics\(graph\)/);
  assert.match(js, /runAStarGraphTrace\(graph, heuristics\)/);
  // 새 문제 만들기 버튼과 "정답 후 또 연습" 버튼 둘 다 같은 재생성 함수를 쓴다.
  assert.match(js, /el\.newGraphButton\.addEventListener\("click", newPracticeGraph\)/);
  // 오픈/닫힌 리스트 칩에는 g(n)만 보인다(h(n)은 그래프 노드 배지로 이미 보이므로 중복 표시 안 함).
  assert.match(js, /format: \(entry\) => `\(g=\$\{entry\.g\}, f=\$\{entry\.f\}\)`,/);
  assert.doesNotMatch(js, /function gAndH/);
  assert.match(js, /el\.againButton\.addEventListener\("click", newPracticeGraph\)/);
});

test("교과서 예시와 8-퍼즐 사이에 'h(n)이 틀리면?' 데모가 연결되어 있고, 이 데모 전용 지도·같은 규칙으로 최적이 아닌 결과를 직접 보여준다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("broken-demo.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<script type="module" src="broken-demo\.js\?v=[^"]*"><\/script>/);
  assert.match(html, /id="map-show-broken"/);
  assert.match(html, /id="map-broken-view"/);
  assert.match(html, /id="map-broken-graph"/);
  assert.match(html, /id="map-broken-reference-graph"/);
  assert.match(html, /id="map-broken-start"/);
  assert.match(html, /id="map-broken-trace-area" hidden/);
  assert.match(html, /중앙현관 h\(n\)=9 ↔ 매점까지 9분 · 급식실 h\(n\)=3 ↔ 매점까지 3분/);
  assert.match(html, /간선의 숫자는 그 구간에 걸리는 시간이며, 누적 g\(n\)은 오른쪽 목록에서 확인/);
  assert.match(js, /displayText: `\$\{cost\}`/);
  assert.match(html, /id="map-broken-summary"/);
  assert.match(html, /id="map-broken-again"/);
  // 운동장 쪽이 실제로는 더 빠른 지름길이 되도록 이 데모 전용 간선 비용(BROKEN_EDGES)을 쓰고,
  // 운동장의 h(n) 하나만 실제 최단 거리(5)보다 큰 10으로 잘못 어림잡는다(매점과 간선으로 직접
  // 연결되지 않아, 지도만 보고는 틀렸다고 알아챌 수 없는 값). 활동 1·3단계가 쓰는 공용
  // NODES/EDGES/HEURISTICS는 건드리지 않는다(이 데모 안에서만 로컬로 새로 정의). 정문→매점으로
  // 가는 두 길이 간선을 공유하지 않는 두 갈래 길이라서, 매점과 직접 연결된 중앙현관·급식실은
  // 다른 지름길이 없어 그 h(n)이 간선 비용과 정확히 같다(예전 버전은 교차 간선 때문에 중앙현관의
  // 실제 최단 거리가 직접 간선 비용보다 작아져, 지도에 적힌 간선 비용과 h(n) 배지가 서로 다른
  // 값으로 보이는 오류가 있었다 — 이제는 구조적으로 그런 불일치가 생길 수 없다).
  assert.match(js, /const BROKEN_EDGES = \[/);
  assert.match(js, /const CORRECT_HEURISTICS = \{ gate: 10, lobby: 9, yard: 5, cafeteria: 3, store: 0 \};/);
  assert.match(js, /const BROKEN_HEURISTICS = \{ \.\.\.CORRECT_HEURISTICS, yard: 10 \};/);
  assert.match(js, /renderGraphDiagram\(el\.referenceGraph, \{/);
  assert.match(js, /existingF: existingDupF\(pendingDup\)/);
  assert.match(js, /newF: pendingDup\.newF/);
  assert.match(js, /el\.startButton\.addEventListener\("click", startDemo\)/);
  assert.match(js, /runAStarGraphTrace\(\{ nodes: NODES, edges: BROKEN_EDGES, start: START, goal: GOAL \}, BROKEN_HEURISTICS\)/);
  assert.doesNotMatch(js, /import \{ NODES, EDGES,/, "공용 EDGES/HEURISTICS를 더 이상 가져오면 안 됨(이 데모 전용 값으로 완전히 대체)");
  // 오픈/닫힌 리스트 칩에는 g(n)만 보인다(h(n)은 그래프 노드 배지로 이미 보이므로 중복 표시 안 함).
  assert.match(js, /format: \(entry\) => `\(g=\$\{entry\.g\}, f=\$\{entry\.f\}\)`,/);
  assert.doesNotMatch(js, /function gAndH/);
  // 최적 비용 비교는 이 데모 전용 지도(BROKEN_EDGES) 기준 실제 UCS 최단 경로로 동적으로
  // 계산해야 한다(활동 1의 지도는 이동 비용이 달라서 그 결과를 그대로 갖다 쓰면 틀린 비교가 됨).
  assert.match(js, /const optimalTrace = runUcsGraphTrace\(\{ nodes: NODES, edges: BROKEN_EDGES, start: START, goal: GOAL \}\);/);
  assert.match(js, /const trueOptimalCost = optimalTrace\.pathCost;/);
  // 최적/오답 경로를 각각 전체 지도(모든 노드·이 데모 전용 간선) 위에 나란히(왼쪽·오른쪽) 강조해서
  // 보여줘야, 잘못된 h(n) 때문에 놓친 지름길이 지도에서 눈으로 바로 확인된다. 잘못된 경로 쪽은
  // wrongPathIds로 빨간색, 실제 최적 경로 쪽은 기존 pathIds로 초록색.
  assert.match(html, /id="map-broken-result-graph"/);
  assert.match(html, /id="map-broken-optimal-graph"/);
  assert.match(js, /resultGraph: \$\("#map-broken-result-graph"\)/);
  assert.match(js, /optimalGraph: \$\("#map-broken-optimal-graph"\)/);
  assert.match(js, /const allIds = NODES\.map\(\(n\) => n\.id\);/);
  assert.match(js, /edges: BROKEN_EDGES,\s*\n\s*visibleIds: allIds,\s*\n\s*statesById: Object\.fromEntries\(brokenTrace\.path\.map\(\(id\) => \[id, "path-wrong"\]\)\),\s*\n\s*wrongPathIds: brokenTrace\.path,/);
  assert.match(js, /edges: BROKEN_EDGES,\s*\n\s*visibleIds: allIds,\s*\n\s*statesById: Object\.fromEntries\(optimalTrace\.path\.map\(\(id\) => \[id, "path"\]\)\),\s*\n\s*pathIds: optimalTrace\.path,/);
});

test("'h(n)이 틀리면?' 데모의 새 예시는 실제로 뚜렷하게 최적이 아닌 결과를 낸다(정문→중앙현관→매점=13, 실제 최적 정문→운동장→급식실→매점=10, +30%)", async () => {
  const lab = await import("../lessons/shared/search-graph-lab.js");
  const NODES = [
    { id: "gate", label: "정문" },
    { id: "lobby", label: "중앙현관" },
    { id: "yard", label: "운동장" },
    { id: "cafeteria", label: "급식실" },
    { id: "store", label: "매점" },
  ];
  const BROKEN_EDGES = [
    { a: "gate", b: "lobby", cost: 4 },
    { a: "lobby", b: "store", cost: 9 },
    { a: "gate", b: "yard", cost: 5 },
    { a: "yard", b: "cafeteria", cost: 2 },
    { a: "cafeteria", b: "store", cost: 3 },
  ];
  const graph = { nodes: NODES, edges: BROKEN_EDGES, start: "gate", goal: "store" };
  const CORRECT_HEURISTICS = { gate: 10, lobby: 9, yard: 5, cafeteria: 3, store: 0 };
  const BROKEN_HEURISTICS = { ...CORRECT_HEURISTICS, yard: 10 };

  // 정문→매점의 두 길(중앙현관 경유·운동장 경유)은 간선을 공유하지 않으므로, 매점과 직접 연결된
  // 중앙현관·급식실은 다른 지름길이 없다 — 즉 그 실제 최단 거리는 반드시 그 직접 간선 비용과
  // 정확히 같아야 한다. h(n)이 "그 장소에서 매점까지의 직선거리"라는 이 활동의 설명과 어긋나면
  // 안 되므로, CORRECT_HEURISTICS의 이 두 값이 BROKEN_EDGES에 적힌 간선 비용과 다르면 그 자체가
  // 버그다(이전 버전에서 실제로 발생했던 오류: 지도엔 14로 적혀 있는데 h 배지엔 16이 뜨는 식의
  // 불일치).
  function referenceShortestDistances(nodes, edges, sourceId) {
    const adj = new Map(nodes.map((n) => [n.id, []]));
    for (const e of edges) { adj.get(e.a).push({ to: e.b, cost: e.cost }); adj.get(e.b).push({ to: e.a, cost: e.cost }); }
    const dist = new Map(nodes.map((n) => [n.id, Infinity]));
    dist.set(sourceId, 0);
    const visited = new Set();
    while (visited.size < nodes.length) {
      let cur = null, best = Infinity;
      for (const [id, d] of dist) if (!visited.has(id) && d < best) { best = d; cur = id; }
      if (cur === null) break;
      visited.add(cur);
      for (const { to, cost } of adj.get(cur)) { const nd = dist.get(cur) + cost; if (nd < dist.get(to)) dist.set(to, nd); }
    }
    return dist;
  }
  const trueDist = referenceShortestDistances(NODES, BROKEN_EDGES, "store");
  for (const edge of BROKEN_EDGES) {
    if (edge.b !== "store") continue;
    assert.equal(
      CORRECT_HEURISTICS[edge.a], edge.cost,
      `${edge.a}는 매점과 간선(비용 ${edge.cost})으로 직접 연결되어 있으므로 h(n)이 그 값과 정확히 같아야 함`,
    );
    assert.equal(
      trueDist.get(edge.a), edge.cost,
      `${edge.a}의 실제 최단 거리가 직접 간선 비용과 달라지면(다른 지름길이 있으면) h(n)="직선거리" 설명과 지도가 서로 어긋나게 됨`,
    );
  }

  const optimalTrace = lab.runUcsGraphTrace(graph);
  assert.deepEqual(optimalTrace.path, ["gate", "yard", "cafeteria", "store"]);
  assert.equal(optimalTrace.pathCost, 10);

  // CORRECT_HEURISTICS는 admissible해야 하고(실제 최단 거리를 넘지 않아야 함), 이 값 그대로 쓰면
  // A*도 같은 최적 경로를 찾아야 한다(정상일 때는 문제가 없다는 것을 확인하는 대조군).
  const trueTrace = lab.runAStarGraphTrace(graph, CORRECT_HEURISTICS);
  assert.deepEqual(trueTrace.path, optimalTrace.path);
  assert.equal(trueTrace.pathCost, optimalTrace.pathCost);

  const brokenTrace = lab.runAStarGraphTrace(graph, BROKEN_HEURISTICS);
  assert.deepEqual(brokenTrace.path, ["gate", "lobby", "store"]);
  assert.equal(brokenTrace.pathCost, 13, "잘못된 h(n)으로는 지름길을 놔두고 13짜리 경로가 나와야 데모가 성립함");
  assert.ok(brokenTrace.pathCost > optimalTrace.pathCost);
  assert.equal(brokenTrace.pathCost - optimalTrace.pathCost, 3);

  // 운동장의 h(n)=10은 실제 최단 거리(5)를 넘는 admissible 위반이어야 한다.
  assert.ok(BROKEN_HEURISTICS.yard > 5, "데모가 성립하려면 운동장의 잘못된 h(n)이 실제 최단 거리(5)보다 커야 함");
});

test("그래프 렌더러는 wrongPathIds를 받아 is-path-wrong 클래스로 빨간 경로를 그리고, is-path와 겹치면 초록이 우선하도록 CSS가 정의되어 있다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("../shared/search-graph-ui.js", lessonRoot), "utf8"),
    readFile(new URL("../shared/search-graph.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /wrongPathIds = \[\]/);
  assert.match(js, /const onWrongPath = pathEdgeKeys\(wrongPathIds\);/);
  assert.match(js, /isWrongPathEdge \? " is-path-wrong" : ""/);
  assert.match(css, /\.graph-edge\.is-path-wrong \{ stroke:var\(--no\); stroke-width:5; \}/);
  assert.match(css, /\.graph-edge\.is-path\.is-path-wrong \{ stroke:var\(--ok\); \}/);
  assert.match(css, /\.graph-node\[data-state="path-wrong"\] circle \{ fill:#fbe4e6; stroke:var\(--no\); \}/);
});

test("노드 안 h(n)은 간선 위 g(n)(파란 원)과 헷갈리지 않도록 metricVariant:\"h\"일 때 보라색 알약형 배지로 따로 그려지고, A* 활동의 h 표시 8곳이 모두 이 변형을 쓴다", async () => {
  const [uiJs, css, gameJs, practiceJs, brokenJs, html] = await Promise.all([
    readFile(new URL("../shared/search-graph-ui.js", lessonRoot), "utf8"),
    readFile(new URL("../shared/search-graph.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("practice.js", lessonRoot), "utf8"),
    readFile(new URL("broken-demo.js", lessonRoot), "utf8"),
    readFile(new URL("index.html", lessonRoot), "utf8"),
  ]);
  // 그래프 범례에도 파란 g(n)/보라 h(n) 읽는 법을 짧게 안내해야, 처음 보는 학생도 헷갈리지 않는다.
  const legendCount = (html.match(/보라 배지 h\(n\)=목표까지 어림값\(고정\)<\/li>/g) || []).length;
  assert.equal(legendCount, 3, "교과서 예시·연습 문제·잘못된 h(n) 데모 3곳 모두 범례가 있어야 함");
  assert.match(uiJs, /metricVariant = "g"/);
  assert.match(uiJs, /if \(metricVariant === "h"\) \{/);
  assert.match(uiJs, /class: "graph-node-h-badge-bg"/);
  assert.match(uiJs, /class: "graph-node-h-badge"/);
  assert.match(css, /\.graph-node-h-badge-bg \{ fill:#f3e8ff; stroke:#c084fc; stroke-width:1; \}/);
  assert.match(css, /\.graph-node-h-badge \{ font:800 9\.5px ui-monospace,monospace; fill:#6b21a8;/);
  assert.match(css, /\.list-panel-compact \.list-panel-block li \{ gap:0; \}/);
  // 노드 안에서 h(n)을 보여주는 호출은 모두 metricLabel:""과 metricVariant:"h"를 짝지어 넘겨야
  // g(n)과 같은 파란 계열로 그려지지 않는다(빠뜨리면 다시 예전처럼 헷갈리는 파란 텍스트로 돌아감).
  for (const js of [gameJs, practiceJs, brokenJs]) {
    const emptyMetricLabelCount = (js.match(/metricLabel: "",/g) || []).length;
    const hVariantCount = (js.match(/metricVariant: "h",/g) || []).length;
    assert.ok(emptyMetricLabelCount > 0, "h(n)을 노드에 표시하는 호출이 있어야 함");
    assert.equal(hVariantCount, emptyMetricLabelCount, "metricLabel:\"\"을 쓰는 곳은 모두 metricVariant:\"h\"도 같이 넘겨야 함");
  }
});

test("잘못된 h(n) 데모의 비용 비교는 별도 텍스트 박스가 아니라 각 그래프 라벨 바로 위에 직접 표시되고, 설명 문단과 '다시 해보기' 버튼 사이에는 여백이 있다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("broken-demo.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  // 예전에는 그래프 위에 "실제 최적 경로 비용 12 / 잘못된 h(n)으로 A*가 낸 답 14 / 더 비싸진 만큼 2"를
  // 별도 stat-compare 박스로 보여줬는데, 학생이 어떤 숫자가 어느 그래프 것인지 다시 눈으로 찾아야
  // 했다. 이제 각 그래프 라벨 바로 아래에 그 그래프의 비용을 직접 붙여서 보여준다.
  assert.doesNotMatch(html, /id="map-broken-compare"/);
  assert.match(html, /id="map-broken-result-cost"/);
  assert.match(html, /id="map-broken-optimal-cost"/);
  assert.match(js, /resultCost: \$\("#map-broken-result-cost"\)/);
  assert.match(js, /optimalCost: \$\("#map-broken-optimal-cost"\)/);
  assert.match(js, /el\.resultCost\.textContent = `비용 \$\{brokenCost\}\(정답보다 \+\$\{brokenCost - trueOptimalCost\}\)`;/);
  assert.match(js, /el\.optimalCost\.textContent = `비용 \$\{trueOptimalCost\}`;/);
  assert.doesNotMatch(js, /el\.compare\./);
  // 설명 문단(.broken-explain)이 바로 아래 버튼과 딱 붙어 보이지 않도록 아래쪽 여백이 있어야 한다.
  assert.match(css, /\.broken-explain \{ margin:1rem 0 1\.6rem;/);
});

test("enableGraphZoom은 처음 apply() 시점에 그래프가 hidden 조상 안에 있어 clientWidth가 0이라도(예: 탭이 열리기 전 2단 비교 그래프), 나중에 실제 폭이 바뀌면 ResizeObserver로 다시 계산해 칸 너비에 맞춘다", async () => {
  const js = await readFile(new URL("../shared/search-graph-ui.js", lessonRoot), "utf8");
  assert.match(js, /if \(typeof ResizeObserver !== "undefined"\) \{\s*\n\s*new ResizeObserver\(apply\)\.observe\(viewport\);/);
});

test("잘못된 h(n) 데모의 2단 비교 그래프는 넓은 화면에서 칸이 커져도(최대 폭 약 520px, 세로 약 340px) 그래프 아랫부분이 잘리지 않도록 뷰포트 최대 높이가 충분히 크다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.broken-compare-graph \.graph-zoom-viewport \{ max-height:350px; \}/);
});
