import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HUMAN,
  COMPUTER,
  EMPTY,
  BOARD_SIZE,
  CELL_COUNT,
  createBoard,
  getFlips,
  isLegalMove,
  getLegalMoves,
  applyMove,
  countPieces,
  getGameStatus,
  resolveNextMover,
  evaluateMoves,
  getBestMove,
  buildDecisionTree,
} from "../lessons/search-othello-minimax/game-core.js";

const lessonRoot = new URL("../lessons/search-othello-minimax/", import.meta.url);

function play(board, mover, move) {
  return applyMove(board, mover, move);
}

// --- 기본 보드/규칙 -----------------------------------------------------------

test("createBoard는 16칸짜리 판에 중앙 2x2 시작 배치를 만든다", () => {
  const board = createBoard();
  assert.equal(board.length, CELL_COUNT);
  const filled = board.filter((cell) => cell !== EMPTY);
  assert.equal(filled.length, 4);
  assert.equal(board[5], COMPUTER);
  assert.equal(board[6], HUMAN);
  assert.equal(board[9], HUMAN);
  assert.equal(board[10], COMPUTER);
});

test("시작 보드에서 흑(사람)이 둘 수 있는 자리는 정확히 4곳이고, 각각 정확히 한 칸씩만 뒤집는다", () => {
  const board = createBoard();
  const moves = getLegalMoves(board, HUMAN);
  assert.deepEqual(moves, [1, 4, 11, 14]);
  for (const move of moves) {
    assert.equal(getFlips(board, HUMAN, move).length, 1, `자리 ${move}는 정확히 1칸을 뒤집어야 함`);
  }
});

test("시작 보드에서 백(컴퓨터)이 둘 수 있는 자리도 정확히 4곳이다", () => {
  const board = createBoard();
  assert.deepEqual(getLegalMoves(board, COMPUTER), [2, 7, 8, 13]);
});

test("이미 돌이 있는 칸이나 상대 돌을 감싸지 못하는 칸은 둘 수 없다", () => {
  const board = createBoard();
  assert.equal(isLegalMove(board, HUMAN, 5), false, "이미 채워진 칸");
  assert.equal(isLegalMove(board, HUMAN, 0), false, "아무도 감싸지 못하는 구석 칸");
  assert.deepEqual(getFlips(board, HUMAN, 0), []);
});

test("applyMove는 실제로 감싸인 상대 돌을 모두 뒤집고, 원래 보드는 바꾸지 않는다(불변성)", () => {
  const board = createBoard();
  const original = board.slice();
  const next = applyMove(board, HUMAN, 1);
  assert.deepEqual(board, original, "applyMove가 원본 배열을 변형하면 안 됨");
  assert.equal(next[1], HUMAN);
  assert.equal(next[5], HUMAN, "감싸인 백 돌이 흑으로 뒤집혀야 함");
  const { black, white } = countPieces(next);
  assert.equal(black, 4, "기존 흑 2개 + 새로 둔 1개 + 뒤집힌 백 1개");
  assert.equal(white, 1, "기존 백 2개 중 1개가 뒤집혀 1개만 남음");
});

test("getGameStatus는 양쪽 다 둘 곳이 없을 때만 게임 종료로 판정하고, 돌 개수로 승자를 가린다", () => {
  const inProgress = createBoard();
  assert.equal(getGameStatus(inProgress).isOver, false);

  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 4);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 3);
  board = play(board, COMPUTER, 8);
  board = play(board, HUMAN, 12);
  board = play(board, COMPUTER, 7);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 13);
  board = play(board, HUMAN, 14);
  board = play(board, COMPUTER, 15);
  const status = getGameStatus(board);
  assert.equal(status.isOver, true);
  assert.equal(status.winner, COMPUTER);
  assert.equal(status.isDraw, false);
  assert.equal(status.blackCount + status.whiteCount, CELL_COUNT, "이 시나리오는 보드가 가득 찬 채로 끝남");
});

test("resolveNextMover는 상대가 둘 수 있으면 상대 차례를, 상대가 둘 수 없고 나는 둘 수 있으면 패스로 내 차례를 이어준다", () => {
  const board = createBoard();
  assert.deepEqual(resolveNextMover(board, HUMAN), { mover: COMPUTER, passed: false });

  // 사람이 백을 모두 감쌀 수 없게 만든 인위적 보드: 흑만 둘 곳이 있고 백은 없는 상태를 구성한다.
  let noWhiteMoves = createBoard();
  noWhiteMoves = play(noWhiteMoves, HUMAN, 1);
  noWhiteMoves = play(noWhiteMoves, COMPUTER, 0);
  noWhiteMoves = play(noWhiteMoves, HUMAN, 4);
  noWhiteMoves = play(noWhiteMoves, COMPUTER, 2);
  noWhiteMoves = play(noWhiteMoves, HUMAN, 3);
  noWhiteMoves = play(noWhiteMoves, COMPUTER, 8);
  noWhiteMoves = play(noWhiteMoves, HUMAN, 12);
  noWhiteMoves = play(noWhiteMoves, COMPUTER, 7);
  noWhiteMoves = play(noWhiteMoves, HUMAN, 11);
  noWhiteMoves = play(noWhiteMoves, COMPUTER, 13);
  noWhiteMoves = play(noWhiteMoves, HUMAN, 14);
  const result = resolveNextMover(noWhiteMoves, HUMAN);
  assert.deepEqual(getLegalMoves(noWhiteMoves, COMPUTER), [15]);
  assert.deepEqual(result, { mover: COMPUTER, passed: false });
});

test("resolveNextMover는 양쪽 다 둘 수 없으면 mover를 null로 돌려준다(게임 종료 신호)", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 4);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 3);
  board = play(board, COMPUTER, 8);
  board = play(board, HUMAN, 12);
  board = play(board, COMPUTER, 7);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 13);
  board = play(board, HUMAN, 14);
  board = play(board, COMPUTER, 15);
  assert.equal(getGameStatus(board).isOver, true);
  assert.deepEqual(resolveNextMover(board, COMPUTER), { mover: null, passed: false });
});

// --- 패스(둘 수 없어 건너뜀) --------------------------------------------------

test("실제로 상대가 둘 수 없어 패스해야 하는 보드를 찾아내고, resolveNextMover가 이를 정확히 판정한다", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 4);
  assert.deepEqual(getLegalMoves(board, COMPUTER), [8, 13, 14, 15]);
  const afterComputer = play(board, COMPUTER, 8);
  assert.deepEqual(getLegalMoves(afterComputer, HUMAN), [], "이 자리에서는 흑이 둘 곳이 없어야 함");
  assert.deepEqual(resolveNextMover(afterComputer, COMPUTER), { mover: COMPUTER, passed: true });
});

// --- Min-Max: 합법적인 자리만 두고, 패배하지 않는다 --------------------------

test("evaluateMoves와 getBestMove는 항상 실제로 둘 수 있는 자리만 후보로 내놓고, 점수 내림차순으로 정렬한다", () => {
  const board = createBoard();
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const legal = new Set(getLegalMoves(board, COMPUTER));
  assert.equal(evaluated.length, legal.size);
  for (const candidate of evaluated) assert.ok(legal.has(candidate.move));
  for (let i = 1; i < evaluated.length; i += 1) {
    assert.ok(evaluated[i - 1].score >= evaluated[i].score);
  }
  const best = getBestMove(board, COMPUTER, HUMAN);
  assert.ok(legal.has(best.move));
});

test("evaluateMoves는 상대가 패스해야 하는 상황을 replyPass로 정확히 알려주고, replyMove는 컴퓨터 자신의 다음 수를 가리킨다", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 4);
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const candidate = evaluated.find((c) => c.move === 8);
  assert.ok(candidate, "8은 둘 수 있는 후보여야 함");
  assert.equal(candidate.replyPass, true);
  assert.equal(candidate.replyMover, COMPUTER);
  const afterComputer = play(board, COMPUTER, 8);
  assert.ok(
    getLegalMoves(afterComputer, COMPUTER).includes(candidate.replyMove),
    "패스 이후 replyMove는 컴퓨터 자신이 둘 수 있는 자리여야 함",
  );
});

// 4x4 오델로는 완전 탐색(가지치기 없음) 기준 전체 게임 트리가 틱택토와 비슷한 규모(약 34만 노드,
// 수십 ms)라 이 방식이 가능하다. 이 테스트는 사람의 모든 합법적 선택(패스 자동 처리 포함)을
// 재귀적으로 전수 탐색하므로 실측 약 300ms가 걸린다 — 갑자기 크게 느려지면 BASE_SCORE나
// minimax 로직에 회귀가 생겼다는 신호다.
test("사람이 어떤 합법적인 자리를 두더라도(전수 조사) Min-Max 컴퓨터는 절대 지지 않는다", () => {
  function playOutAllHumanChoices(board, mover, moveCount) {
    const status = getGameStatus(board);
    if (status.isOver) {
      assert.notEqual(status.winner, HUMAN, `사람이 이기면 안 됨: ${JSON.stringify(board)}`);
      assert.ok(status.whiteCount >= status.blackCount, "컴퓨터가 이기거나 최소 비기기라도 해야 함");
      return;
    }
    assert.ok(moveCount <= CELL_COUNT + 6, "게임이 합리적인 수(칸 수 + 패스 여유) 안에 끝나야 함");

    if (mover === HUMAN) {
      const moves = getLegalMoves(board, HUMAN);
      if (moves.length === 0) {
        const { mover: next } = resolveNextMover(board, COMPUTER);
        playOutAllHumanChoices(board, next, moveCount + 1);
        return;
      }
      for (const move of moves) {
        const next = applyMove(board, HUMAN, move);
        const { mover: nextMover } = resolveNextMover(next, HUMAN);
        playOutAllHumanChoices(next, nextMover, moveCount + 1);
      }
    } else {
      const best = getBestMove(board, COMPUTER, HUMAN);
      const next = applyMove(board, COMPUTER, best.move);
      const { mover: nextMover } = resolveNextMover(next, COMPUTER);
      playOutAllHumanChoices(next, nextMover, moveCount + 1);
    }
  }

  playOutAllHumanChoices(createBoard(), HUMAN, 0);
});

test("두 명 모두 최선을 다하면(컴퓨터 대 컴퓨터 자기대국) 컴퓨터 쪽이 이긴다", () => {
  let board = createBoard();
  let mover = HUMAN;
  for (let i = 0; i < CELL_COUNT + 6; i += 1) {
    const status = getGameStatus(board);
    if (status.isOver) break;
    if (getLegalMoves(board, mover).length === 0) {
      mover = resolveNextMover(board, mover === HUMAN ? COMPUTER : HUMAN).mover;
      continue;
    }
    const computerMark = mover;
    const humanMark = mover === HUMAN ? COMPUTER : HUMAN;
    const best = getBestMove(board, computerMark, humanMark);
    board = applyMove(board, mover, best.move);
    mover = resolveNextMover(board, computerMark).mover;
  }
  const finalStatus = getGameStatus(board);
  assert.equal(finalStatus.isOver, true);
  assert.equal(finalStatus.winner, COMPUTER);
});

// --- Min-Max 의사결정 트리(buildDecisionTree) -------------------------------

test("buildDecisionTree는 실제로 둘 수 있는 자리만 후보(MAX 가지)로 내놓고, 선택된 자리를 정확히 표시한다", () => {
  const board = createBoard();
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);

  assert.equal(tree.turn, "MAX");
  assert.equal(tree.totalCandidates, evaluated.length);
  assert.ok(tree.branches.length > 0 && tree.branches.length <= tree.totalCandidates);
  assert.equal(tree.branches.length + tree.omittedCandidates, tree.totalCandidates);

  const legal = new Set(getLegalMoves(board, COMPUTER));
  for (const branch of tree.branches) assert.ok(legal.has(branch.move));

  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.ok(chosen, "선택된 가지가 트리에 포함되어야 함");
  assert.equal(chosen.move, evaluated[0].move);
  assert.equal(tree.chosenMove, evaluated[0].move);
});

test("buildDecisionTree의 루트에서 MAX(컴퓨터)는 보여준 후보 가지 중 점수가 가장 높은 것을 선택한다", () => {
  const board = createBoard();
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
  const maxScore = Math.max(...tree.branches.map((branch) => branch.score));
  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.equal(chosen.score, maxScore, "MAX는 보여준 후보 중 가장 큰 값을 선택해야 함");
});

test("buildDecisionTree에서 선택된 가지 아래 MIN(상대) 대응 후보 중, 실제로 가정한 대응이 가장 낮은 값을 갖는다", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
  const chosenBranch = tree.branches.find((branch) => branch.isChosen);
  assert.ok(!chosenBranch.terminal, "이 시나리오에서는 컴퓨터의 첫 수만으로 게임이 끝나지 않아야 함");
  assert.equal(chosenBranch.isPass, false);
  assert.ok(chosenBranch.children.length > 0, "선택된 가지는 상대의 대응 후보를 보여줘야 함");

  const minScore = Math.min(...chosenBranch.children.map((child) => child.score));
  const chosenReply = chosenBranch.children.find((child) => child.isChosen);
  assert.ok(chosenReply, "MIN이 실제로 선택하는 대응 가지가 있어야 함");
  assert.equal(chosenReply.score, minScore, "MIN은 컴퓨터에게 가장 불리한(가장 낮은) 값을 선택해야 함");
});

test("상대가 둘 수 없는 실제 상황에서는 패스 노드가 하나 끼어들고, 그 아래에 컴퓨터의 다음 수가 이어진다", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 4);
  const afterComputer8 = play(board, COMPUTER, 8);
  assert.deepEqual(resolveNextMover(afterComputer8, COMPUTER), { mover: COMPUTER, passed: true });

  const tree = buildDecisionTree(board, COMPUTER, HUMAN, 8);
  const branch = tree.branches.find((b) => b.move === 8);
  assert.ok(branch, "8은 대표 가지로 표시되어야 함(선택된 수)");
  assert.equal(branch.terminal, false);
  assert.equal(branch.children.length, 1, "패스는 분기가 없으므로 자식이 정확히 하나여야 함");

  const passNode = branch.children[0];
  assert.equal(passNode.isPass, true);
  assert.equal(passNode.move, null);
  assert.equal(passNode.skippedMark, HUMAN, "패스당한 쪽은 사람(흑)이어야 함");
  assert.equal(passNode.nextTurn, COMPUTER, "패스 후에는 다시 컴퓨터 차례여야 함");
  assert.ok(passNode.children.length > 0, "패스 노드 아래에는 실제 다음 수가 이어져야 함");
  for (const child of passNode.children) {
    assert.equal(child.movedBy, COMPUTER, "패스 이후 실제로 두는 쪽은 컴퓨터여야 함");
  }
});

test("buildDecisionTree는 게임이 즉시 끝나는 자리를 두면 그 즉시 말단 점수(+1/0/-1)를 매긴다", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  board = play(board, COMPUTER, 0);
  board = play(board, HUMAN, 4);
  board = play(board, COMPUTER, 2);
  board = play(board, HUMAN, 3);
  board = play(board, COMPUTER, 8);
  board = play(board, HUMAN, 12);
  board = play(board, COMPUTER, 7);
  board = play(board, HUMAN, 11);
  board = play(board, COMPUTER, 13);
  board = play(board, HUMAN, 14);
  assert.deepEqual(getLegalMoves(board, COMPUTER), [15]);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, 15);
  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.equal(chosen.terminal, true);
  assert.equal(chosen.outcome, "computer");
  assert.equal(chosen.score, 1);
  assert.equal(chosen.children.length, 0);
});

test("buildDecisionTree의 모든 노드 점수는 항상 -1, 0, 1 중 하나이며, 말단 노드의 점수는 실제 승패와 일치한다", () => {
  function assertScoreRange(node) {
    assert.ok([-1, 0, 1].includes(node.score), `score는 -1/0/1이어야 하는데 ${node.score}`);
    if (node.terminal) {
      const expected = node.outcome === "computer" ? 1 : node.outcome === "human" ? -1 : 0;
      assert.equal(node.score, expected, "말단 노드의 score는 outcome과 정확히 일치해야 함");
    }
    for (const child of node.children) assertScoreRange(child);
  }

  const boards = [createBoard()];
  let b1 = createBoard();
  b1 = play(b1, HUMAN, 1);
  boards.push(b1);
  let b2 = createBoard();
  b2 = play(b2, HUMAN, 1);
  b2 = play(b2, COMPUTER, 0);
  boards.push(b2);

  for (const board of boards) {
    const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
    if (evaluated.length === 0) continue;
    const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
    for (const branch of tree.branches) assertScoreRange(branch);
  }
});

test("buildDecisionTree는 선택된 가지를 실제 게임이 끝날 때(말단)까지 하나의 주 진행선으로 이어서 보여준다(패스 노드는 그냥 통과)", () => {
  let board = createBoard();
  board = play(board, HUMAN, 1);
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);

  function followPrincipal(node, depth) {
    assert.ok(depth <= CELL_COUNT + 6, "주 진행선은 합리적인 수 이내에 끝나야 함");
    if (node.terminal) return node;
    const next = node.children.find((child) => child.isChosen) ?? node.children[0];
    assert.ok(next, "게임이 끝나지 않았다면 이어지는 가지가 있어야 함(패스 노드 포함)");
    return followPrincipal(next, depth + 1);
  }

  const chosen = tree.branches.find((branch) => branch.isChosen);
  const terminal = followPrincipal(chosen, 1);
  assert.equal(terminal.terminal, true);
  assert.ok([-1, 0, 1].includes(terminal.score));
});

test("buildDecisionTree는 대표로 보여주지 않는 가지·대응을 truncated 또는 omittedCandidates/omittedChildren으로 정확히 안내한다", () => {
  const board = createBoard();
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);

  const nonChosenBranches = tree.branches.filter((branch) => !branch.isChosen);
  assert.ok(nonChosenBranches.length > 0);
  for (const branch of nonChosenBranches) {
    if (!branch.terminal && !branch.isPass) {
      assert.equal(branch.truncated, true, "선택되지 않은 가지는 더 펼치지 않고 생략 표시해야 함");
      assert.equal(branch.children.length, 0);
    }
  }
});

// --- HTML/CSS/JS 구조 검증 ------------------------------------------------

test("독립 lesson 페이지가 fonts.css·guard.css와 그룹/활동 가드 속성을 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>돌 뒤집기 게임 탐색 \| 탐색의 다양한 문제 해결 사례/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="search-problem-cases"/);
  assert.match(html, /data-guard-lesson="search-othello-minimax"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/search-problem-cases\/"/);
});

test("게임판·돌 개수 표시·상태 안내·재시작 버튼 등 핵심 구조 요소가 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="board"/);
  assert.match(html, /id="turn-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="piece-count"[^>]*aria-live="polite"/);
  assert.match(html, /id="restart-button"/);
  assert.match(html, /id="score-win"/);
  assert.match(html, /id="score-draw"/);
  assert.match(html, /id="score-lose"/);
});

test("게임 종료 후에만 드러나는 복기 영역과 용어 설명이 있고, 문서 순서상 게임판 다음에 온다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="review"[^>]*hidden/);
  assert.match(html, /id="glossary"[^>]*hidden/);
  assert.match(html, /id="review-list"/);

  const activityIndex = html.indexOf('id="activity"');
  const reviewIndex = html.indexOf('id="review"');
  const glossaryIndex = html.indexOf('id="glossary"');
  assert.ok(activityIndex !== -1 && reviewIndex !== -1 && glossaryIndex !== -1);
  assert.ok(activityIndex < reviewIndex, "게임판(activity)이 복기 영역보다 앞에 있어야 함");
  assert.ok(reviewIndex < glossaryIndex, "용어 설명(glossary)은 복기 영역 뒤에 와야 함");
});

test("용어 설명은 Min-Max/게임 트리/패스를 다룬다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const glossaryMatch = html.match(/<section id="glossary"[\s\S]*?<\/section>/);
  assert.ok(glossaryMatch, "glossary 섹션을 찾을 수 없음");
  assert.match(glossaryMatch[0], /게임 트리/);
  assert.match(glossaryMatch[0], /Min-Max/);
  assert.match(glossaryMatch[0], /패스/);
});

test("game.js는 evaluateMoves로 상대의 최선 대응(패스 포함)까지 계산해 복기 화면을 만든다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /evaluateMoves/);
  assert.match(js, /replyPass/);
  assert.match(js, /function renderReview/);
  assert.match(js, /function renderCandidateList/);
});

test("game.js는 buildDecisionTree로 각 수마다 Min-Max 의사결정 트리를 그리고, 패스 노드를 별도로 렌더링한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /buildDecisionTree/);
  assert.match(js, /function renderDecisionTree/);
  assert.match(js, /function renderTreeNode/);
  assert.match(js, /function renderPassNode/);
  assert.match(js, /node\.isPass/);
  assert.match(js, /<details class="tree-details">/);
  assert.match(js, /Min-Max 의사결정 트리로 보기/);
});

test("트리는 카드 너비에 맞춰 축소해서 보여주다가, \"크게 보기\"를 누르면 전체화면 팝업으로 옮겨 보여준다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(js, /function applyTreeFit/);
  assert.match(js, /function openTreeOverlay/);
  assert.match(js, /function closeTreeOverlay/);
  assert.match(js, />크게 보기</);
  assert.match(css, /\.tree-overlay\s*\{/);
  assert.match(css, /\.tree-scale-wrap/);
});

test("키보드 접근성: 칸은 button 요소이고 방향키로 4x4 그리드를 이동할 수 있으며, CSS에 focus-visible 스타일이 있다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /<div[^>]*class="cell"/);
  assert.match(js, /<button type="button" class="cell/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /ArrowUp/);
  assert.match(js, /ArrowDown/);
  assert.match(js, /BOARD_SIZE/);
  assert.match(css, /:focus-visible/);
});

test("둘 수 있는 빈 칸은 cell--legal로 표시되고, aria-label에도 안내가 포함된다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /cell--legal/);
  assert.match(js, /둘 수 있음/);
  assert.match(css, /\.cell--legal::after/);
});

test("prefers-reduced-motion을 CSS와 JS 모두에서 존중한다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("모바일 화면에 대응하는 반응형 CSS가 있다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /min-height: 44px/);
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

test("틱택토 활동으로 돌아가는 lesson-pager가 있다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /class="lesson-pager"/);
  assert.match(html, /href="\.\.\/search-tictactoe-minimax\/"/);
  assert.match(html, /href="\.\.\/\.\.\/units\/search-problem-cases\/"/);
  assert.match(css, /\.lesson-pager\s*\{/);
});

test("data/activity-groups.json과 data/lessons.json에 이 활동이 search-problem-cases 두 번째 활동으로 등록되어 있다", async () => {
  const [groupsRaw, lessonsRaw] = await Promise.all([
    readFile(new URL("../../data/activity-groups.json", lessonRoot), "utf8"),
    readFile(new URL("../../data/lessons.json", lessonRoot), "utf8"),
  ]);
  const groups = JSON.parse(groupsRaw).groups;
  const searchGroup = groups.find((group) => group.id === "search-problem-cases");
  assert.ok(searchGroup, "search-problem-cases 그룹을 찾을 수 없음");
  assert.equal(searchGroup.children.length, 2, "이제 활동이 두 개여야 함(틱택토 + 오델로)");
  const child = searchGroup.children.find((candidate) => candidate.id === "search-othello-minimax");
  assert.ok(child, "search-othello-minimax가 search-problem-cases 그룹의 활동으로 등록되어 있어야 함");
  assert.equal(child.path, "lessons/search-othello-minimax/");
  assert.equal(child.order, 2);
  assert.equal(child.active, true);

  const lessons = JSON.parse(lessonsRaw).lessons;
  const lesson = lessons.find((candidate) => candidate.id === "search-othello-minimax");
  assert.ok(lesson, "search-othello-minimax가 data/lessons.json에 등록되어 있어야 함");
  assert.equal(lesson.path, "lessons/search-othello-minimax/");
  assert.equal(lesson.unit, "탐색의 다양한 문제 해결 사례");
  assert.equal(lesson.order, 2);
});
