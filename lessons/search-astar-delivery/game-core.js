import { runAStarGraphTrace, runUcsGraphTrace, HEURISTICS, nodeLabel } from "../shared/search-graph-lab.js?v=2026090908";

// ---------------------------------------------------------------------------
// 학교 지도 위 A* 탐색 — 3단계(균일 비용 탐색)와 같은 지도를 재사용해 "교과서 예시"로 쓴다.
// ---------------------------------------------------------------------------
export { HEURISTICS };

export function buildMapRounds(trace = runAStarGraphTrace()) {
  return trace.steps.map((step) => ({
    ...step,
    isSetup: step.pickCandidates.length <= 1,
    dupChildren: step.children.filter((c) => c.status === "open-worse-skip" || c.status === "open-replace"),
  }));
}

export function checkMapPickAnswer(round, selectedId) {
  return { correct: selectedId === round.expandedId };
}

// insert=true는 "새 값을 오픈 리스트에 넣는다(=기존 값을 교체한다)"는 학생의 선택.
export function checkMapDupAnswer(dupChild, insert) {
  const shouldInsert = dupChild.status === "open-replace";
  return { correct: insert === shouldInsert, shouldInsert };
}

// 3단계에서 본 균일 비용 탐색과 이번 A* 탐색이 같은 지도에서 같은 경로를 찾되,
// 몇 개 상태를 확인했는지는 다르다는 것을 정리 화면에서 비교하기 위한 값.
export function summarizeMap({ astarTrace = runAStarGraphTrace(), ucsTrace = runUcsGraphTrace() } = {}) {
  return {
    path: astarTrace.path,
    pathCost: astarTrace.pathCost,
    astarTested: astarTrace.order.length,
    ucsTested: ucsTrace.order.length,
    saved: ucsTrace.order.length - astarTrace.order.length,
  };
}

export function mapPathLabel(pathIds) {
  return pathIds.map((id) => nodeLabel(id)).join(" → ");
}

// ---------------------------------------------------------------------------
// 8-퍼즐 A* 탐색(새 문제 연습). 교과서의 8-퍼즐 예시 대신 이 활동만의 연습 문제로 쓴다.
// ---------------------------------------------------------------------------
export const NEW_GOAL_STATE = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 0]);
export const NEW_START = Object.freeze([1, 2, 3, 4, 8, 5, 0, 7, 6]);

export const MOVE_ORDER = Object.freeze([
  { key: "up", label: "위", delta: -3 },
  { key: "down", label: "아래", delta: 3 },
  { key: "left", label: "왼쪽", delta: -1 },
  { key: "right", label: "오른쪽", delta: 1 },
]);

export function boardKey(board) {
  return board.join(",");
}

export function misplacedTiles(board, goal = NEW_GOAL_STATE) {
  return board.reduce((count, tile, index) => count + (tile !== 0 && tile !== goal[index] ? 1 : 0), 0);
}

export function getNeighbors(board) {
  const blank = board.indexOf(0);
  const row = Math.floor(blank / 3);
  const col = blank % 3;
  return MOVE_ORDER.flatMap((move) => {
    if ((move.key === "up" && row === 0) ||
        (move.key === "down" && row === 2) ||
        (move.key === "left" && col === 0) ||
        (move.key === "right" && col === 2)) return [];
    const target = blank + move.delta;
    const next = [...board];
    [next[blank], next[target]] = [next[target], next[blank]];
    return [{ board: next, move: move.label }];
  });
}

function sortedOpen(open, bestG, closed) {
  return open
    .filter((item) => !closed.has(item.key) && bestG.get(item.key) === item.g)
    .sort((a, b) => a.f - b.f || a.serial - b.serial);
}

export function solveAstar(start, goal = NEW_GOAL_STATE) {
  const startBoard = [...start];
  const startKey = boardKey(startBoard);
  const goalKey = boardKey(goal);
  let serial = 0;
  const startNode = {
    key: startKey, board: startBoard, g: 0,
    h: misplacedTiles(startBoard, goal), parentKey: null, move: "시작", serial: serial++,
  };
  startNode.f = startNode.g + startNode.h;

  const open = [startNode];
  const bestG = new Map([[startKey, 0]]);
  const closed = new Set();
  const nodes = new Map([[startKey, startNode]]);
  const steps = [];

  while (open.length) {
    const candidates = sortedOpen(open, bestG, closed);
    if (!candidates.length) break;
    const current = candidates[0];
    open.splice(open.indexOf(current), 1);
    closed.add(current.key);
    steps.push({
      index: steps.length,
      chosenKey: current.key,
      chosen: current,
      candidates: candidates.map((candidate) => ({ ...candidate, board: [...candidate.board] })),
    });

    if (current.key === goalKey) {
      const path = [];
      let cursor = current;
      while (cursor) {
        path.push(cursor);
        cursor = cursor.parentKey ? nodes.get(cursor.parentKey) : null;
      }
      path.reverse();
      return { found: true, steps, path, opened: closed.size, cost: current.g };
    }

    for (const neighbor of getNeighbors(current.board)) {
      const key = boardKey(neighbor.board);
      const g = current.g + 1;
      if (closed.has(key) || (bestG.has(key) && bestG.get(key) <= g)) continue;
      const node = {
        key, board: neighbor.board, g,
        h: misplacedTiles(neighbor.board, goal),
        parentKey: current.key, move: neighbor.move, serial: serial++,
      };
      node.f = node.g + node.h;
      bestG.set(key, g);
      nodes.set(key, node);
      open.push(node);
    }
  }
  return { found: false, steps, path: [], opened: closed.size, cost: null };
}

export function checkChoice(step, selectedKey) {
  return { correct: step.chosenKey === selectedKey, answer: step.chosen };
}
