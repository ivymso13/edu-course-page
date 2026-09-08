import assert from "node:assert/strict";
import test from "node:test";
import { runUcsGraphTrace, runAStarGraphTrace, HEURISTICS, pathCostFor, NODES, EDGES, START, GOAL, generateRandomGraph, generateAdmissibleHeuristics } from "../lessons/shared/search-graph-lab.js";

// 이 그래프·비용은 균일비용탐색.pptx(30~33쪽) 도시 a~e 예제와 동일한 구조를 학교 장소로 옮긴 것이다.
// 교과서 트레이스: a→c→b→d→e 순으로 5번 확장, 최종 경로 a-c-d-e(비용 12).
const trace = runUcsGraphTrace();

test("확장 순서는 교과서와 동일하게 정문→운동장→중앙현관→급식실→매점이다", () => {
  assert.deepEqual(trace.order, ["gate", "yard", "lobby", "cafeteria", "store"]);
});

test("최종 경로는 정문→운동장→급식실→매점, 비용은 12다", () => {
  assert.deepEqual(trace.path, ["gate", "yard", "cafeteria", "store"]);
  assert.equal(trace.pathCost, 12);
  assert.equal(pathCostFor(trace.path), 12);
});

test("정문→중앙현관→매점(2번 이동)은 정문→운동장→급식실→매점(3번 이동)보다 이동 횟수는 적지만 비용은 더 크다", () => {
  const fewerHops = pathCostFor(["gate", "lobby", "store"]);
  assert.equal(fewerHops, 14);
  assert.ok(fewerHops > trace.pathCost, "이동 횟수가 적다고 항상 더 싸지는 않다는 대비가 성립해야 함");
});

test("운동장 확장 단계에서, 이미 오픈 리스트에 있던 더 싼 중앙현관(5)이 더 비싼 새 값(9)을 밀어낸다", () => {
  const step = trace.steps.find((s) => s.expandedId === "yard");
  const lobbyChild = step.children.find((c) => c.id === "lobby");
  assert.equal(lobbyChild.status, "open-worse-skip");
  assert.equal(lobbyChild.newG, 9);
  assert.equal(lobbyChild.existingG, 5);
});

test("급식실 확장 단계에서, 오픈 리스트의 더 비싼 매점(14)이 더 싼 새 값(12)으로 교체된다", () => {
  const step = trace.steps.find((s) => s.expandedId === "cafeteria");
  const storeChild = step.children.find((c) => c.id === "store");
  assert.equal(storeChild.status, "open-replace");
  assert.equal(storeChild.newG, 12);
  assert.equal(storeChild.existingG, 14);
});

test("각 단계의 pickCandidates에는 그 시점 오픈 리스트 전체가 g(n) 오름차순으로 담긴다", () => {
  for (const step of trace.steps) {
    const gs = step.pickCandidates.map((c) => c.g);
    assert.deepEqual(gs, [...gs].sort((a, b) => a - b));
    assert.equal(step.pickCandidates[0].id, step.expandedId);
  }
});

test("목표 상태(매점)를 확장하는 단계는 자식을 만들지 않고 그 자리에서 멈춘다", () => {
  const goalStep = trace.steps.at(-1);
  assert.equal(goalStep.expandedId, GOAL);
  assert.equal(goalStep.isGoal, true);
  assert.deepEqual(goalStep.children, []);
  assert.deepEqual(goalStep.openAfter, []);
});

test("노드는 5개, 간선은 7개이고 시작·목표는 그래프에 실제로 존재하는 노드다", () => {
  assert.equal(NODES.length, 5);
  assert.equal(EDGES.length, 7);
  assert.ok(NODES.some((n) => n.id === START));
  assert.ok(NODES.some((n) => n.id === GOAL));
});

test("같은 입력에 대해 트레이스 결과는 항상 동일하다(결정론적)", () => {
  const again = runUcsGraphTrace();
  assert.deepEqual(again.order, trace.order);
  assert.deepEqual(again.path, trace.path);
});

// 지능적 탐색.pptx(34~37쪽) 휴리스틱값 예시와 동일한 그래프·값이다.
// 교과서 트레이스: a→c→d→e 순으로 4번 확장, 균일 비용 탐색(5번)보다 적게 확인한다.
const astarTrace = runAStarGraphTrace();

test("휴리스틱값은 각 장소에서 매점까지의 직선거리이며 목표의 휴리스틱값은 0이다", () => {
  assert.deepEqual(HEURISTICS, { gate: 12, lobby: 9, yard: 7, cafeteria: 5, store: 0 });
  assert.equal(HEURISTICS[GOAL], 0);
});

test("A* 탐색은 정문→운동장→급식실→매점 순으로 4번만 확장해 균일 비용 탐색과 같은 경로를 찾는다", () => {
  assert.deepEqual(astarTrace.order, ["gate", "yard", "cafeteria", "store"]);
  assert.deepEqual(astarTrace.path, trace.path);
  assert.equal(astarTrace.pathCost, trace.pathCost);
  assert.ok(astarTrace.order.length < trace.order.length);
});

test("A* 각 단계에서 확장된 상태의 f(n)은 그 시점 오픈 리스트 중 가장 작다", () => {
  for (const step of astarTrace.steps) {
    assert.equal(step.f, step.g + step.h);
    assert.equal(step.f, Math.min(...step.pickCandidates.map((c) => c.f)));
  }
});

test("closedAfter 항목에도 h(n)·f(n)이 채워져 있다(다음 라운드에서 닫힌 리스트를 다시 그릴 때 undefined가 되지 않도록)", () => {
  for (const step of astarTrace.steps) {
    for (const entry of step.closedAfter) {
      assert.equal(typeof entry.h, "number", `${entry.id}의 h(n)이 숫자가 아님`);
      assert.equal(entry.f, entry.g + entry.h, `${entry.id}의 f(n)이 g+h와 다름`);
    }
  }
});

test("A*는 중앙현관을 두 번 더 싸게 재발견하지 못해 오픈 리스트에 남겨 둔다(open-worse-skip)", () => {
  const lobbyRevisits = astarTrace.steps.flatMap((s) => s.children.filter((c) => c.id === "lobby" && c.status !== "new"));
  assert.ok(lobbyRevisits.length > 0);
  assert.ok(lobbyRevisits.every((c) => c.status === "open-worse-skip"));
});

// 다익스트라(모든 노드→goal 실제 최단 거리)를 독립적으로 다시 구현해, generateAdmissibleHeuristics가
// 만든 값을 검증하는 기준으로 쓴다(생성 함수 내부와 같은 코드를 재사용하면 같은 버그를 공유할 수 있으므로).
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

test("generateAdmissibleHeuristics는 랜덤 그래프에서도 항상 admissible·consistent하며, A*가 항상 실제 최단 경로를 찾는다(개념적 오류가 없음)", () => {
  for (let trial = 0; trial < 200; trial += 1) {
    const graph = generateRandomGraph({ minNodes: 6, maxNodes: 9 });
    const h = generateAdmissibleHeuristics(graph);
    const trueDist = referenceShortestDistances(graph.nodes, graph.edges, graph.goal);

    assert.equal(h[graph.goal], 0, "목표 상태의 h는 항상 0이어야 함");
    for (const node of graph.nodes) {
      assert.ok(h[node.id] <= trueDist.get(node.id) + 1e-9, `admissible 위반: ${node.id}의 h=${h[node.id]}가 실제 최단 거리 ${trueDist.get(node.id)}보다 큼`);
    }
    for (const edge of graph.edges) {
      assert.ok(h[edge.a] <= edge.cost + h[edge.b] + 1e-9, `consistent 위반: ${edge.a}->${edge.b}`);
      assert.ok(h[edge.b] <= edge.cost + h[edge.a] + 1e-9, `consistent 위반: ${edge.b}->${edge.a}`);
    }

    const trace = runAStarGraphTrace(graph, h);
    assert.equal(trace.pathCost, trueDist.get(graph.start), "A*가 찾은 경로 비용이 실제 최단 거리와 달라 최적성이 깨짐");
  }
});

test("고정 학교 지도에서도 admissible하지 않은 h(n) 하나(운동장 7→11)가 있으면 A*는 규칙을 그대로 따르고도 최적이 아닌(14) 경로를 낸다(엔진 자체의 일반적 성질 확인 — 실제 'h(n)이 틀리면?' 데모는 search-astar-delivery.test.mjs에서 자체 지도로 따로 검증한다)", () => {
  const broken = { ...HEURISTICS, yard: 11 };
  const brokenTrace = runAStarGraphTrace(undefined, broken);
  const trueOptimalCost = runUcsGraphTrace().pathCost;
  assert.equal(trueOptimalCost, 12);
  assert.equal(brokenTrace.pathCost, 14, "잘못된 h(n)으로는 14짜리(정문→중앙현관→매점) 경로가 나와야 함");
  assert.deepEqual(brokenTrace.path, ["gate", "lobby", "store"]);
  assert.ok(brokenTrace.pathCost > trueOptimalCost, "admissible 위반 시 결과가 실제 최적보다 비싸질 수 있음을 보여야 함");
});

test("generateAdmissibleHeuristics는 목표와 직접 연결된 장소에는 대체로 그 간선 비용을 그대로 어림값으로 쓴다", () => {
  let adjacentTotal = 0;
  let exactMatches = 0;
  for (let trial = 0; trial < 100; trial += 1) {
    const graph = generateRandomGraph({ minNodes: 6, maxNodes: 9 });
    const h = generateAdmissibleHeuristics(graph);
    for (const node of graph.nodes) {
      if (node.id === graph.goal) continue;
      const direct = graph.edges.find((e) => (e.a === node.id && e.b === graph.goal) || (e.b === node.id && e.a === graph.goal));
      if (!direct) continue;
      adjacentTotal += 1;
      if (h[node.id] === direct.cost) exactMatches += 1;
    }
  }
  assert.ok(adjacentTotal > 0);
  assert.ok(exactMatches / adjacentTotal > 0.8, `직접 연결된 장소의 대부분은 간선 비용과 정확히 같아야 함 (실제: ${exactMatches}/${adjacentTotal})`);
});
