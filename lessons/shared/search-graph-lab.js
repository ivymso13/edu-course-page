// '균일 비용 탐색' 활동이 쓰는 학교 장소 그래프와 UCS 엔진.
// 교과서(균일비용탐색.pptx, 30~33쪽)의 도시 a~e 그래프와 정확히 같은 구조·비용을 학교 장소로 옮겨 담았다.
// a=정문, b=중앙현관, c=운동장, d=급식실, e=매점.
// 아래 UCS 엔진(buildAdjacency/pathCostFor/runUcsGraphTrace)은 이 고정 그래프뿐 아니라
// generateRandomGraph()가 만든 연습용 랜덤 그래프에도 그대로 쓸 수 있도록 그래프를 매개변수로 받는다.

export const NODES = [
  { id: "gate", label: "정문", icon: "🏫", x: 70, y: 210 },
  { id: "lobby", label: "중앙현관", x: 320, y: 95 },
  { id: "yard", label: "운동장", x: 270, y: 355 },
  { id: "cafeteria", label: "급식실", x: 480, y: 355 },
  { id: "store", label: "매점", icon: "🏪", x: 570, y: 210 },
];

export const EDGES = [
  { a: "gate", b: "lobby", cost: 5 },
  { a: "gate", b: "yard", cost: 4 },
  { a: "lobby", b: "yard", cost: 5 },
  { a: "lobby", b: "cafeteria", cost: 8 },
  { a: "lobby", b: "store", cost: 9 },
  { a: "yard", b: "cafeteria", cost: 3 },
  { a: "cafeteria", b: "store", cost: 5 },
];

export const START = "gate";
export const GOAL = "store";

// 지능적 탐색.pptx(34~37쪽) 휴리스틱값 예시와 동일한 그래프·값이다(도시 a~e를 학교 장소로 옮긴 것과
// 같은 매핑: a=정문, b=중앙현관, c=운동장, d=급식실, e=매점). 각 값은 그 장소에서 매점(목표)까지의 직선거리.
export const HEURISTICS = { gate: 10, lobby: 9, yard: 7, cafeteria: 5, store: 0 };

const DEFAULT_GRAPH = { nodes: NODES, edges: EDGES, start: START, goal: GOAL };

const NODES_BY_ID = new Map(NODES.map((n) => [n.id, n]));

// nodes를 생략하면 고정 학교 그래프에서 찾는다. 랜덤 그래프의 라벨을 찾으려면 nodes를 넘긴다.
export function nodeLabel(id, nodes) {
  if (!nodes) return NODES_BY_ID.get(id)?.label ?? id;
  return nodes.find((n) => n.id === id)?.label ?? id;
}

function buildAdjacency(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const edge of edges) {
    adj.get(edge.a).push({ to: edge.b, cost: edge.cost });
    adj.get(edge.b).push({ to: edge.a, cost: edge.cost });
  }
  // 같은 비용일 때도 항상 같은 순서로 자식을 생성하도록 도착 노드 id 기준으로 정렬해 둔다.
  for (const list of adj.values()) list.sort((x, y) => x.to.localeCompare(y.to));
  return adj;
}

function reconstructPath(parent, goalId, startId) {
  const path = [goalId];
  let cur = goalId;
  while (cur !== startId) {
    cur = parent.get(cur);
    path.push(cur);
  }
  return path.reverse();
}

export function pathCostFor(pathIds, graph = DEFAULT_GRAPH) {
  const adj = buildAdjacency(graph.nodes, graph.edges);
  let total = 0;
  for (let i = 1; i < pathIds.length; i += 1) {
    const from = pathIds[i - 1];
    const to = pathIds[i];
    const edge = adj.get(from).find((e) => e.to === to);
    if (!edge) throw new Error(`${from}-${to} 사이에는 간선이 없습니다.`);
    total += edge.cost;
  }
  return total;
}

// 균일 비용 탐색(UCS)을 한 상태씩 확장하며, 오픈/닫힌 리스트의 변화를 그대로 기록한다.
// 각 단계(step)는 "누구를 확장했는지"와 "그 확장으로 생성된 자식 상태들이 각각
// 어떻게 처리됐는지(new / closed-skip / open-worse-skip / open-replace)"를 담는다.
export function runUcsGraphTrace(graph = DEFAULT_GRAPH) {
  const { nodes, edges, start, goal } = graph;
  const adj = buildAdjacency(nodes, edges);
  const byId = (a, b) => (a.g === b.g ? a.id.localeCompare(b.id) : a.g - b.g);
  let open = [{ id: start, g: 0 }];
  const closed = [];
  const closedG = new Map();
  const parent = new Map();
  const steps = [];

  while (open.length > 0) {
    open.sort(byId);
    const pickCandidates = open.map((entry) => ({ ...entry }));
    const winner = open[0];
    open = open.slice(1);
    const isGoal = winner.id === goal;

    closed.push({ id: winner.id, g: winner.g });
    closedG.set(winner.id, winner.g);

    const children = [];
    if (!isGoal) {
      for (const edge of adj.get(winner.id)) {
        const childId = edge.to;
        const newG = winner.g + edge.cost;
        if (closedG.has(childId)) {
          children.push({ id: childId, cost: edge.cost, newG, status: "closed-skip", existingG: closedG.get(childId) });
          continue;
        }
        const existingIndex = open.findIndex((entry) => entry.id === childId);
        if (existingIndex === -1) {
          open.push({ id: childId, g: newG });
          parent.set(childId, winner.id);
          children.push({ id: childId, cost: edge.cost, newG, status: "new" });
        } else if (newG < open[existingIndex].g) {
          const existingG = open[existingIndex].g;
          open[existingIndex] = { id: childId, g: newG };
          parent.set(childId, winner.id);
          children.push({ id: childId, cost: edge.cost, newG, status: "open-replace", existingG });
        } else {
          children.push({ id: childId, cost: edge.cost, newG, status: "open-worse-skip", existingG: open[existingIndex].g });
        }
      }
    }

    steps.push({
      index: steps.length,
      expandedId: winner.id,
      g: winner.g,
      isGoal,
      pickCandidates,
      children,
      openAfter: [...open].sort(byId),
      closedAfter: closed.map((entry) => ({ ...entry })),
    });

    if (isGoal) break;
  }

  const reached = closedG.has(goal);
  const path = reached ? reconstructPath(parent, goal, start) : null;
  return {
    steps,
    path,
    pathCost: reached ? closedG.get(goal) : null,
    order: closed.map((entry) => entry.id),
  };
}

// A* 탐색을 한 상태씩 확장하며, runUcsGraphTrace와 같은 형태(steps[].pickCandidates/children/...)로
// 기록한다. 차이는 두 가지뿐이다: (1) 후보를 g(n) 대신 f(n)=g(n)+h(n)이 가장 작은 순으로 고르고,
// (2) 각 후보에 h(n)·f(n) 값을 함께 담는다. 오픈 리스트 교체 여부는 A*에서도 g(n) 비교로 판단한다
// (h(n)은 상태마다 고정값이라 g(n)이 더 작으면 f(n)도 항상 더 작기 때문).
export function runAStarGraphTrace(graph = DEFAULT_GRAPH, heuristics = HEURISTICS) {
  const { nodes, edges, start, goal } = graph;
  const adj = buildAdjacency(nodes, edges);
  const h = (id) => heuristics[id] ?? 0;
  const withF = ({ id, g }) => ({ id, g, h: h(id), f: g + h(id) });
  const byId = (a, b) => (a.f === b.f ? a.id.localeCompare(b.id) : a.f - b.f);
  let open = [withF({ id: start, g: 0 })];
  const closed = [];
  const closedG = new Map();
  const parent = new Map();
  const steps = [];

  while (open.length > 0) {
    open.sort(byId);
    const pickCandidates = open.map((entry) => ({ ...entry }));
    const winner = open[0];
    open = open.slice(1);
    const isGoal = winner.id === goal;

    closed.push({ id: winner.id, g: winner.g, h: winner.h, f: winner.f });
    closedG.set(winner.id, winner.g);

    const children = [];
    if (!isGoal) {
      for (const edge of adj.get(winner.id)) {
        const childId = edge.to;
        const newG = winner.g + edge.cost;
        const childH = h(childId);
        if (closedG.has(childId)) {
          children.push({ id: childId, cost: edge.cost, newG, h: childH, newF: newG + childH, status: "closed-skip", existingG: closedG.get(childId) });
          continue;
        }
        const existingIndex = open.findIndex((entry) => entry.id === childId);
        if (existingIndex === -1) {
          open.push(withF({ id: childId, g: newG }));
          parent.set(childId, winner.id);
          children.push({ id: childId, cost: edge.cost, newG, h: childH, newF: newG + childH, status: "new" });
        } else if (newG < open[existingIndex].g) {
          const existingG = open[existingIndex].g;
          open[existingIndex] = withF({ id: childId, g: newG });
          parent.set(childId, winner.id);
          children.push({ id: childId, cost: edge.cost, newG, h: childH, newF: newG + childH, status: "open-replace", existingG });
        } else {
          children.push({ id: childId, cost: edge.cost, newG, h: childH, newF: newG + childH, status: "open-worse-skip", existingG: open[existingIndex].g });
        }
      }
    }

    steps.push({
      index: steps.length,
      expandedId: winner.id,
      g: winner.g,
      h: winner.h,
      f: winner.f,
      isGoal,
      pickCandidates,
      children,
      openAfter: [...open].sort(byId),
      closedAfter: closed.map((entry) => ({ ...entry })),
    });

    if (isGoal) break;
  }

  const reached = closedG.has(goal);
  const path = reached ? reconstructPath(parent, goal, start) : null;
  return {
    steps,
    path,
    pathCost: reached ? closedG.get(goal) : null,
    order: closed.map((entry) => entry.id),
  };
}

// 다익스트라: goal로부터 모든 노드까지의 실제 최단 거리. generateAdmissibleHeuristics가
// "이 어림값이 실제로 넘치지 않는지" 판단하는 기준으로 쓴다(간선 비용이 모두 양수이므로 성립).
function shortestDistances(nodes, edges, sourceId) {
  const adj = buildAdjacency(nodes, edges);
  const dist = new Map(nodes.map((n) => [n.id, Infinity]));
  dist.set(sourceId, 0);
  const visited = new Set();
  while (visited.size < nodes.length) {
    let current = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) { best = d; current = id; }
    }
    if (current === null) break;
    visited.add(current);
    for (const { to, cost } of adj.get(current)) {
      const candidate = dist.get(current) + cost;
      if (candidate < dist.get(to)) dist.set(to, candidate);
    }
  }
  return dist;
}

// 연습용 랜덤 그래프에도 "개념적으로 틀릴 수 없는"(admissible: 실제 최단 거리를 절대 넘지 않고,
// consistent: h(n) <= 그 간선 비용 + h(이웃))인 휴리스틱값을 만들어 준다. 그래야 A* 탐색이
// 이 그래프에서도 항상 정확한(최적) 경로를 찾는다는, 이 활동이 가르치는 핵심 성질이 랜덤
// 연습 문제에서도 절대 깨지지 않는다.
// 규칙: 목표와 간선으로 바로 연결된 장소는 그 간선 비용을 어림값으로 쓰고 싶어 하고(교과서
// 예시의 중앙현관·급식실처럼), 그 외는 실제 최단 거리의 40~80% 사이에서 적당히 어림잡는다.
// 다만 둘 다 "희망값"일 뿐이라, 아래에서 실제 최단 거리보다 크지 않게 낮추고(admissible),
// 이웃끼리 값이 서로 모순되지 않을 때까지(consistent) 벨만-포드 방식으로 다시 다듬는다.
export function generateAdmissibleHeuristics(graph) {
  const { nodes, edges, goal } = graph;
  const trueDist = shortestDistances(nodes, edges, goal);

  const wishlist = new Map([[goal, 0]]);
  for (const node of nodes) {
    if (node.id === goal) continue;
    const directEdge = edges.find((e) => (e.a === node.id && e.b === goal) || (e.b === node.id && e.a === goal));
    if (directEdge) {
      wishlist.set(node.id, directEdge.cost);
    } else {
      const ratio = 0.4 + (Math.random() * 0.4); // 0.4~0.8배: 어림값다운 오차를 일부러 남긴다.
      wishlist.set(node.id, Math.round(trueDist.get(node.id) * ratio));
    }
  }

  const h = new Map(nodes.map((n) => [n.id, Math.min(wishlist.get(n.id), trueDist.get(n.id))]));
  h.set(goal, 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { a, b, cost } of edges) {
      if (h.get(a) > cost + h.get(b)) { h.set(a, cost + h.get(b)); changed = true; }
      if (h.get(b) > cost + h.get(a)) { h.set(b, cost + h.get(a)); changed = true; }
    }
  }
  return Object.fromEntries(h);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const NODE_LETTERS = "ABCDEFGHIJ";

const LAYOUT_MARGIN = 70;
const LAYOUT_W = 640;
const LAYOUT_H = 420;
// 정점 반지름(36) + 중복 선택 간선 버블 반지름(21)의 2배(114)보다 커야, 짧은 간선의 가운데
// 버블이 그 간선 자신의 양쪽 끝 정점 원과 겹치지 않는다(모든 정점 쌍에 적용되므로 간선으로
// 이어진 쌍도 자동으로 이 거리 이상 떨어진다).
const MIN_NODE_DIST = 122;
const EDGE_CLEARANCE = 44;
// relaxNodeSpacing은 MIN_NODE_DIST를 목표로 삼지만 구석에 몰리는 등 여유 공간이 부족하면
// 완전히 수렴하지 못할 수 있다. 그래서 간선 하나하나의 실제 길이도 이 값(정점 반지름 36 +
// 선택 버블 반지름 21의 2배보다 살짝 더) 이상인지 최종적으로 다시 확인한다.
const MIN_EDGE_LEN = 118;

// 정점 원의 반지름(36px)이 뷰박스(640x420) 안쪽에 항상 완전히 들어오도록 여유를 두고 자른다.
function clampToCanvas(p) {
  p.x = Math.min(LAYOUT_W - 40, Math.max(40, p.x));
  p.y = Math.min(LAYOUT_H - 40, Math.max(40, p.y));
}

// 정점 원(반지름 36px)끼리 겹치지 않게, 서로 너무 가까운 쌍을 계속 밀어내며 수렴시킨다.
function relaxNodeSpacing(ids, pos) {
  for (let iter = 0; iter < 300; iter += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = pos.get(ids[i]);
        const b = pos.get(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt((dx * dx) + (dy * dy));
        if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
        if (dist < MIN_NODE_DIST) {
          moved = true;
          const push = (MIN_NODE_DIST - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
          clampToCanvas(a); clampToCanvas(b);
        }
      }
    }
    if (!moved) break;
  }
}

function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = (dx * dx) + (dy * dy);
  if (len2 < 1) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = (((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + (t * dx);
  const cy = a.y + (t * dy);
  return Math.hypot(p.x - cx, p.y - cy);
}

// 간선 하나가 자신과 무관한 정점 위를 그냥 지나가는 첫 사례를 찾는다(있으면 그 정점 id를 반환).
function findEdgeNodeOverlap(ids, edges, pos) {
  for (const edge of edges) {
    const a = pos.get(edge.a);
    const b = pos.get(edge.b);
    for (const id of ids) {
      if (id === edge.a || id === edge.b) continue;
      if (pointToSegmentDist(pos.get(id), a, b) < EDGE_CLEARANCE) return id;
    }
  }
  return null;
}

// 후보 간선 하나가 자신의 두 끝점이 아닌 다른 정점들과 충분히 떨어져 있는지(=지나쳐 가리지 않는지) 확인한다.
function edgeClearsOtherNodes(edge, ids, pos) {
  const a = pos.get(edge.a);
  const b = pos.get(edge.b);
  for (const id of ids) {
    if (id === edge.a || id === edge.b) continue;
    if (pointToSegmentDist(pos.get(id), a, b) < EDGE_CLEARANCE) return false;
  }
  return true;
}

function ccw(p, q, r) {
  return (((q.x - p.x) * (r.y - p.y)) - ((q.y - p.y) * (r.x - p.x)));
}

// 두 선분이 (끝점을 공유하지 않고) 실제로 교차하는지 판정한다.
function segmentsProperlyCross(a1, a2, b1, b2) {
  const d1 = ccw(b1, b2, a1);
  const d2 = ccw(b1, b2, a2);
  const d3 = ccw(a1, a2, b1);
  const d4 = ccw(a1, a2, b2);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function edgesShareNode(e1, e2) {
  return e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b;
}

// 간선 목록 중 서로 끝점을 공유하지 않으면서 교차하는 첫 쌍을 찾는다.
function findCrossingEdgePair(edges, pos) {
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const e1 = edges[i];
      const e2 = edges[j];
      if (edgesShareNode(e1, e2)) continue;
      if (segmentsProperlyCross(pos.get(e1.a), pos.get(e1.b), pos.get(e2.a), pos.get(e2.b))) return [e1, e2];
    }
  }
  return null;
}

// 후보 간선이 기존 간선 중 어느 것과도(끝점 공유 제외) 교차하지 않는지 확인한다.
function edgeCrossesAny(candidate, edges, pos) {
  for (const edge of edges) {
    if (edgesShareNode(candidate, edge)) continue;
    if (segmentsProperlyCross(pos.get(candidate.a), pos.get(candidate.b), pos.get(edge.a), pos.get(edge.b))) return true;
  }
  return false;
}

// 정점 간격(relaxNodeSpacing)과 간선-무관 정점 겹침(findEdgeNodeOverlap)을 함께 완전히
// 수렴시킨다. 교차 수정 등 다른 보정이 정점을 옮긴 뒤에는 반드시 이 둘을 처음부터 다시
// 완전히 맞춰야, 이전에 고친 조건이 새 보정 때문에 다시 깨지는 일이 없다.
function resolveSpacingAndClearance(ids, edges, pos) {
  relaxNodeSpacing(ids, pos);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const offendingId = findEdgeNodeOverlap(ids, edges, pos);
    if (!offendingId) break;
    const p = pos.get(offendingId);
    const angle = Math.random() * 2 * Math.PI;
    p.x += Math.cos(angle) * 70;
    p.y += Math.sin(angle) * 70;
    clampToCanvas(p);
    relaxNodeSpacing(ids, pos);
  }
}

// 최종 간선 목록에 교차·간선-정점 겹침·너무 짧은 간선(자기 버블이 자기 끝점과 겹침) 중
// 하나라도 남아 있는지 확인한다. generateRandomGraph가 이 결과를 보고 처음부터 다시 시도할지
// 판단한다.
function layoutHasIssues(ids, edges, pos) {
  if (findCrossingEdgePair(edges, pos)) return true;
  if (findEdgeNodeOverlap(ids, edges, pos)) return true;
  for (const edge of edges) {
    const a = pos.get(edge.a);
    const b = pos.get(edge.b);
    if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_EDGE_LEN) return true;
  }
  return false;
}

// Fruchterman-Reingold 방식의 힘 기반 배치로 초안을 잡은 뒤(간선으로 이어진 정점끼리는
// 스프링처럼 당기고, 모든 정점 쌍은 서로 밀어냄), 정점 간격을 수렴시킨다. 그래도 어떤 간선이
// 관계없는 정점 위를 지나가면, 그 정점만 무작위로 살짝 밀어내고 간격을 다시 수렴시키는 것을
// 반복한다 — 두 조건을 동시에 만족시키려다 서로 밀어내며 진동하는 것보다 훨씬 안정적으로 수렴한다.
function forceDirectedLayout(ids, edges) {
  const usableW = LAYOUT_W - (LAYOUT_MARGIN * 2);
  const usableH = LAYOUT_H - (LAYOUT_MARGIN * 2);
  const k = Math.sqrt((usableW * usableH) / ids.length) * 0.85;
  const pos = new Map(ids.map((id, i) => {
    const angle = (2 * Math.PI * i) / ids.length;
    return [id, {
      x: LAYOUT_MARGIN + (usableW / 2) + ((usableW / 2.4) * Math.cos(angle)),
      y: LAYOUT_MARGIN + (usableH / 2) + ((usableH / 2.4) * Math.sin(angle)),
    }];
  }));

  let temperature = Math.max(usableW, usableH) / 6;
  for (let iter = 0; iter < 260; iter += 1) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = pos.get(ids[i]);
        const b = pos.get(ids[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt((dx * dx) + (dy * dy)) || 0.01;
        const force = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        const di = disp.get(ids[i]);
        const dj = disp.get(ids[j]);
        di.x += ux * force; di.y += uy * force;
        dj.x -= ux * force; dj.y -= uy * force;
      }
    }
    for (const edge of edges) {
      const a = pos.get(edge.a);
      const b = pos.get(edge.b);
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt((dx * dx) + (dy * dy)) || 0.01;
      const force = (dist * dist) / k;
      const ux = dx / dist;
      const uy = dy / dist;
      const da = disp.get(edge.a);
      const db = disp.get(edge.b);
      da.x -= ux * force; da.y -= uy * force;
      db.x += ux * force; db.y += uy * force;
    }
    for (const id of ids) {
      const d = disp.get(id);
      const dist = Math.sqrt((d.x * d.x) + (d.y * d.y)) || 0.01;
      const capped = Math.min(dist, temperature);
      const p = pos.get(id);
      p.x += (d.x / dist) * capped;
      p.y += (d.y / dist) * capped;
      p.x = Math.min(LAYOUT_MARGIN + usableW, Math.max(LAYOUT_MARGIN, p.x));
      p.y = Math.min(LAYOUT_MARGIN + usableH, Math.max(LAYOUT_MARGIN, p.y));
    }
    temperature *= 0.985;
  }

  resolveSpacingAndClearance(ids, edges, pos);

  // 간선끼리 서로 교차하면(선이 겹치면) 교차점 근처의 비용 값이 겹쳐 안 보이게 되므로,
  // 교차하는 쌍을 찾아 그중 한 끝점만 무작위로 밀어내고, 정점 간격·간선-정점 겹침을
  // 처음부터 다시 완전히 수렴시키는 것을 반복한다(하나만 고쳐서 매번 다시 수렴시키는
  // 방식이라야, 이 수정이 앞서 고친 간격·겹침 조건을 깨뜨리지 않는다).
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const crossing = findCrossingEdgePair(edges, pos);
    if (!crossing) break;
    const [e1] = crossing;
    const nodeId = Math.random() < 0.5 ? e1.a : e1.b;
    const p = pos.get(nodeId);
    const angle = Math.random() * 2 * Math.PI;
    p.x += Math.cos(angle) * 70;
    p.y += Math.sin(angle) * 70;
    clampToCanvas(p);
    resolveSpacingAndClearance(ids, edges, pos);
  }

  for (const id of ids) {
    const p = pos.get(id);
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
  }
  return pos;
}

// 정점 7~10개짜리 연습용 랜덤 그래프를 만든다. 신장 트리로 연결성을 보장한 뒤 간선을 몇 개 더
// 추가해 "같은 목적지로 가는 두 경로 중 더 싼 쪽 고르기" 상황(중복 상태)이 나올 여지를 만든다.
// 시작은 무작위 정점, 목표는 그 정점에서 간선 수 기준으로 가장 먼 정점으로 골라 경로가 너무 짧지 않게 한다.
export function generateRandomGraph({ minNodes = 7, maxNodes = 10 } = {}) {
  const n = randInt(minNodes, maxNodes);
  const ids = Array.from({ length: n }, (_, i) => `n${i}`);

  const edgeKeys = new Set();
  const edges = [];
  function addEdge(a, b) {
    if (a === b) return false;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    edges.push({ a, b, cost: randInt(2, 12) });
    return true;
  }

  // 먼저 신장 트리만으로 배치를 확정한다(트리는 순환이 없어 간선끼리 교차할 일이 거의 없다).
  // 여분 간선은 이 배치가 정해진 "뒤에", 짧은 후보부터 순서대로, 이미 있는 간선과 교차하거나
  // 관계없는 정점을 스치거나 자기 자신이 너무 짧은(버블이 끝점과 겹치는) 후보는 애초에
  // 제외하면서 고른다. 그렇게 완성한 전체 간선 목록을 최종적으로 다시 한번 검증해, 그래도
  // (구석에 몰리는 등 드문 사정으로) 문제가 남아 있으면 아예 다른 무작위 신장 트리로 처음부터
  // 다시 시도한다 — 거의 항상 몇 번 안에 문제없는 배치를 찾는다.
  const extraTarget = randInt(1, Math.max(1, Math.ceil(n / 4)));
  let positions;
  for (let regen = 0; regen < 15; regen += 1) {
    edgeKeys.clear();
    edges.length = 0;
    const shuffled = shuffle(ids);
    for (let i = 1; i < shuffled.length; i += 1) {
      addEdge(shuffled[i], shuffled[randInt(0, i - 1)]);
    }
    positions = forceDirectedLayout(ids, edges);
    if (findCrossingEdgePair(edges, positions)) continue;

    const candidatePairs = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        const key = `${a}|${b}`;
        if (edgeKeys.has(key)) continue;
        const dist = Math.hypot(positions.get(a).x - positions.get(b).x, positions.get(a).y - positions.get(b).y);
        candidatePairs.push({ a, b, dist });
      }
    }
    candidatePairs.sort((p, q) => p.dist - q.dist);
    let added = 0;
    for (const pair of candidatePairs) {
      if (added >= extraTarget) break;
      if (pair.dist < MIN_EDGE_LEN) continue;
      const candidate = { a: pair.a, b: pair.b };
      if (edgeCrossesAny(candidate, edges, positions)) continue;
      if (!edgeClearsOtherNodes(candidate, ids, positions)) continue;
      if (addEdge(pair.a, pair.b)) added += 1;
    }

    if (!layoutHasIssues(ids, edges, positions)) break;
  }
  const nodes = ids.map((id, i) => ({
    id,
    label: NODE_LETTERS[i] ?? id,
    x: positions.get(id).x,
    y: positions.get(id).y,
  }));

  const adjHops = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) {
    adjHops.get(edge.a).push(edge.b);
    adjHops.get(edge.b).push(edge.a);
  }
  const start = ids[randInt(0, n - 1)];
  const hops = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const next of adjHops.get(cur)) {
      if (!hops.has(next)) {
        hops.set(next, hops.get(cur) + 1);
        queue.push(next);
      }
    }
  }
  let goal = start;
  let maxHops = 0;
  for (const [id, h] of hops) {
    if (h > maxHops) {
      maxHops = h;
      goal = id;
    }
  }

  const startNode = nodes.find((node) => node.id === start);
  const goalNode = nodes.find((node) => node.id === goal);
  startNode.icon = "🚩";
  goalNode.icon = "🏁";

  return { nodes, edges, start, goal };
}
