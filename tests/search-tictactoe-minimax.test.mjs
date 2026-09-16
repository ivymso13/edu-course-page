import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HUMAN,
  COMPUTER,
  WIN_LINES,
  createBoard,
  getAvailableMoves,
  getWinningLine,
  checkWinner,
  getGameStatus,
  evaluateMoves,
  getBestMove,
  buildDecisionTree,
} from "../lessons/search-tictactoe-minimax/game-core.js";

const lessonRoot = new URL("../lessons/search-tictactoe-minimax/", import.meta.url);

// --- 승패 판정 -------------------------------------------------------------

test("createBoard는 9칸이 모두 빈 새 판을 만든다", () => {
  const board = createBoard();
  assert.equal(board.length, 9);
  assert.ok(board.every((cell) => cell === null));
});

test("가로·세로·대각선 8가지 승리 줄을 모두 정확히 판정한다", () => {
  assert.equal(WIN_LINES.length, 8);
  for (const line of WIN_LINES) {
    const board = createBoard();
    for (const index of line) board[index] = COMPUTER;
    assert.deepEqual(getWinningLine(board), { mark: COMPUTER, line });
    assert.equal(checkWinner(board), COMPUTER);
  }
});

test("승리 줄이 없으면 승자를 null로 판정한다", () => {
  const board = createBoard();
  board[0] = HUMAN;
  board[1] = COMPUTER;
  assert.equal(checkWinner(board), null);
  assert.equal(getWinningLine(board), null);
});

test("무승부(칸이 다 차고 승자가 없음)를 정확히 판정한다", () => {
  // X O X / X O O / O X X -> 승자 없이 가득 참
  const board = [HUMAN, COMPUTER, HUMAN, HUMAN, COMPUTER, COMPUTER, COMPUTER, HUMAN, HUMAN];
  assert.equal(checkWinner(board), null);
  const status = getGameStatus(board);
  assert.equal(status.isDraw, true);
  assert.equal(status.isOver, true);
  assert.equal(status.winner, null);
});

test("승리 후에는 무승부로 판정하지 않고, 진행 중인 판은 isOver가 false다", () => {
  const board = createBoard();
  board[0] = COMPUTER;
  board[4] = COMPUTER;
  board[8] = COMPUTER;
  const status = getGameStatus(board);
  assert.equal(status.isOver, true);
  assert.equal(status.isDraw, false);
  assert.equal(status.winner, COMPUTER);
  assert.deepEqual(status.winningLine, [0, 4, 8]);

  const inProgress = createBoard();
  inProgress[0] = HUMAN;
  assert.equal(getGameStatus(inProgress).isOver, false);
});

// --- 가능한 수 ---------------------------------------------------------------

test("getAvailableMoves는 비어 있는 칸의 인덱스만 오름차순으로 반환한다", () => {
  assert.deepEqual(getAvailableMoves(createBoard()), [0, 1, 2, 3, 4, 5, 6, 7, 8]);

  const board = createBoard();
  board[2] = HUMAN;
  board[5] = COMPUTER;
  assert.deepEqual(getAvailableMoves(board), [0, 1, 3, 4, 6, 7, 8]);
});

test("칸이 다 차면 가능한 수가 없다", () => {
  const board = [HUMAN, COMPUTER, HUMAN, HUMAN, COMPUTER, COMPUTER, COMPUTER, HUMAN, HUMAN];
  assert.deepEqual(getAvailableMoves(board), []);
});

// --- Min-Max: 합법적인 수만 두고, 패배하지 않는다 ------------------------------

test("evaluateMoves와 getBestMove는 항상 실제로 비어 있는 칸만 후보로 내놓는다", () => {
  const board = createBoard();
  board[0] = HUMAN;
  board[4] = COMPUTER;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const available = new Set(getAvailableMoves(board));
  assert.equal(evaluated.length, available.size);
  for (const candidate of evaluated) assert.ok(available.has(candidate.move));
  const best = getBestMove(board, COMPUTER, HUMAN);
  assert.ok(available.has(best.move));
});

test("한 수만 두면 이기는 상황에서는 반드시 그 이기는 수를 고른다", () => {
  const board = createBoard();
  board[0] = COMPUTER;
  board[1] = COMPUTER; // 2번 칸을 두면 즉시 승리
  board[3] = HUMAN;
  board[4] = HUMAN;
  const best = getBestMove(board, COMPUTER, HUMAN);
  assert.equal(best.move, 2);
});

test("상대가 다음 수에 이길 수 있는 위협이 있으면 반드시 막는다", () => {
  const board = createBoard();
  board[0] = HUMAN;
  board[1] = HUMAN; // 사람이 2번 칸에 두면 승리 -> 컴퓨터는 2번을 막아야 함
  board[4] = COMPUTER;
  const best = getBestMove(board, COMPUTER, HUMAN);
  assert.equal(best.move, 2);
});

function playOutAllHumanChoices(board, mover, moveCount) {
  const status = getGameStatus(board);
  if (status.isOver) {
    assert.notEqual(status.winner, HUMAN, `사람이 이기면 안 됨(합법 최선 수를 둔 컴퓨터가 패배함): ${JSON.stringify(board)}`);
    return;
  }
  // 무한 재귀 방지: 최대 9수까지만 진행(3x3 판의 전체 깊이)
  assert.ok(moveCount <= 9, "게임이 9수 안에 끝나야 함");

  if (mover === HUMAN) {
    for (const move of getAvailableMoves(board)) {
      const next = board.slice();
      next[move] = HUMAN;
      playOutAllHumanChoices(next, COMPUTER, moveCount + 1);
    }
  } else {
    const best = getBestMove(board, COMPUTER, HUMAN);
    const next = board.slice();
    next[best.move] = COMPUTER;
    playOutAllHumanChoices(next, HUMAN, moveCount + 1);
  }
}

test("사람이 어떤 합법적인 수를 두더라도(전수 조사) Min-Max 컴퓨터는 절대 지지 않는다 - 사람이 먼저 둘 때", () => {
  playOutAllHumanChoices(createBoard(), HUMAN, 0);
});

test("사람이 어떤 합법적인 수를 두더라도(전수 조사) Min-Max 컴퓨터는 절대 지지 않는다 - 컴퓨터가 먼저 둘 때", () => {
  playOutAllHumanChoices(createBoard(), COMPUTER, 0);
});

test("두 명 모두 최선을 다하면(컴퓨터 대 컴퓨터) 결과는 항상 무승부다", () => {
  let board = createBoard();
  let mover = HUMAN;
  for (let i = 0; i < 9; i += 1) {
    const status = getGameStatus(board);
    if (status.isOver) break;
    const computerMark = mover;
    const humanMark = mover === HUMAN ? COMPUTER : HUMAN;
    const best = getBestMove(board, computerMark, humanMark);
    board[best.move] = mover;
    mover = mover === HUMAN ? COMPUTER : HUMAN;
  }
  const finalStatus = getGameStatus(board);
  assert.equal(finalStatus.isDraw, true);
  assert.equal(finalStatus.winner, null);
});

test("evaluateMoves는 부분 게임 트리(컴퓨터의 수 -> 상대의 최선 대응)를 함께 제공한다", () => {
  const board = createBoard();
  board[4] = COMPUTER;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  assert.ok(evaluated.length > 0);
  for (const candidate of evaluated) {
    assert.ok("move" in candidate);
    assert.ok("score" in candidate);
    assert.ok(["win", "draw", "lose"].includes(candidate.outcome));
    if (candidate.humanReply !== null) {
      const afterComputer = board.slice();
      afterComputer[candidate.move] = COMPUTER;
      assert.ok(
        getAvailableMoves(afterComputer).includes(candidate.humanReply),
        "상대의 최선 대응은 컴퓨터가 둔 뒤 남은 빈 칸 중 하나여야 함",
      );
    }
  }
  // 점수 내림차순 정렬: 첫 후보가 컴퓨터에게 가장 유리한 수
  for (let i = 1; i < evaluated.length; i += 1) {
    assert.ok(evaluated[i - 1].score >= evaluated[i].score);
  }
});

// --- Min-Max 의사결정 트리(buildDecisionTree) -------------------------------

test("buildDecisionTree는 실제로 비어 있는 칸만 후보 수(MAX 가지)로 내놓고, 선택된 수를 정확히 표시한다", () => {
  const board = createBoard();
  board[4] = HUMAN;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);

  assert.equal(tree.turn, "MAX");
  assert.equal(tree.totalCandidates, evaluated.length);
  assert.ok(tree.branches.length > 0 && tree.branches.length <= tree.totalCandidates);
  assert.equal(tree.branches.length + tree.omittedCandidates, tree.totalCandidates);

  const available = new Set(getAvailableMoves(board));
  for (const branch of tree.branches) assert.ok(available.has(branch.move));

  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.ok(chosen, "선택된 가지가 트리에 포함되어야 함");
  assert.equal(chosen.move, evaluated[0].move);
  assert.equal(tree.chosenMove, evaluated[0].move);
});

test("buildDecisionTree의 루트에서 MAX(컴퓨터)는 보여준 후보 가지 중 점수가 가장 높은 것을 선택한다", () => {
  const board = createBoard();
  board[0] = HUMAN;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
  const maxScore = Math.max(...tree.branches.map((branch) => branch.score));
  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.equal(chosen.score, maxScore, "MAX는 보여준 후보 중 가장 큰 값을 선택해야 함");
});

test("buildDecisionTree에서 선택된 가지 아래의 MIN(상대) 대응 후보 중, 실제로 가정한 대응이 가장 낮은 값을 갖는다", () => {
  const board = createBoard();
  board[4] = HUMAN;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
  const chosenBranch = tree.branches.find((branch) => branch.isChosen);
  assert.ok(!chosenBranch.terminal, "중앙을 상대가 먼저 두면 컴퓨터의 첫 수만으로 게임이 끝나지 않아야 함");
  assert.equal(chosenBranch.nextTurn, HUMAN);
  assert.ok(chosenBranch.children.length > 0, "선택된 가지는 상대의 대응 후보를 보여줘야 함");

  const minScore = Math.min(...chosenBranch.children.map((child) => child.score));
  const chosenReply = chosenBranch.children.find((child) => child.isChosen);
  assert.ok(chosenReply, "MIN이 실제로 선택하는 대응 가지가 있어야 함");
  assert.equal(chosenReply.score, minScore, "MIN은 컴퓨터에게 가장 불리한(가장 낮은) 값을 선택해야 함");
});

test("buildDecisionTree는 게임이 즉시 끝나는 수를 두면 그 즉시 말단 점수(+1/0/-1)를 매긴다", () => {
  const board = createBoard();
  board[0] = COMPUTER;
  board[1] = COMPUTER;
  board[3] = HUMAN;
  board[4] = HUMAN;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
  const chosen = tree.branches.find((branch) => branch.isChosen);
  assert.equal(chosen.terminal, true);
  assert.equal(chosen.outcome, "computer");
  assert.equal(chosen.score, 1);
  assert.equal(chosen.children.length, 0);
});

test("buildDecisionTree의 모든 노드 점수는 항상 -1, 0, 1 중 하나이며(depth 가중치 없음), 말단 노드의 점수는 실제 승패와 일치한다", () => {
  function assertScoreRange(node) {
    assert.ok([-1, 0, 1].includes(node.score), `score는 -1/0/1이어야 하는데 ${node.score}`);
    if (node.terminal) {
      const expected = node.outcome === "computer" ? 1 : node.outcome === "human" ? -1 : 0;
      assert.equal(node.score, expected, "말단 노드의 score는 outcome과 정확히 일치해야 함");
    }
    for (const child of node.children) assertScoreRange(child);
  }

  const boards = [createBoard()];
  const b1 = createBoard();
  b1[4] = HUMAN;
  boards.push(b1);
  const b2 = createBoard();
  b2[0] = HUMAN;
  b2[4] = COMPUTER;
  b2[1] = HUMAN;
  boards.push(b2);

  for (const board of boards) {
    const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
    if (evaluated.length === 0) continue;
    const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);
    for (const branch of tree.branches) assertScoreRange(branch);
  }
});

test("buildDecisionTree는 선택된 가지를 실제 게임이 끝날 때(말단)까지 하나의 주 진행선으로 이어서 보여준다", () => {
  const board = createBoard();
  board[4] = HUMAN;
  const evaluated = evaluateMoves(board, COMPUTER, HUMAN);
  const tree = buildDecisionTree(board, COMPUTER, HUMAN, evaluated[0].move);

  function followPrincipal(node, depth) {
    assert.ok(depth <= 9, "주 진행선은 9수 이내에 끝나야 함");
    if (node.terminal) return node;
    const next = node.children.find((child) => child.isChosen) ?? node.children[0];
    assert.ok(next, "게임이 끝나지 않았다면 이어지는 가지가 있어야 함");
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
  assert.ok(tree.omittedCandidates > 0, "빈 판에서는 후보가 많아 생략이 발생해야 함");

  const nonChosenBranches = tree.branches.filter((branch) => !branch.isChosen);
  assert.ok(nonChosenBranches.length > 0);
  for (const branch of nonChosenBranches) {
    if (!branch.terminal) {
      assert.equal(branch.truncated, true, "선택되지 않은 가지는 더 펼치지 않고 생략 표시해야 함");
      assert.equal(branch.children.length, 0);
    }
  }
});

// --- HTML/CSS/JS 구조 검증 ------------------------------------------------

test("독립 lesson 페이지가 fonts.css·guard.css와 그룹/활동 가드 속성을 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>게임 트리 예시 1 \| 탐색의 다양한 문제 해결 사례/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="search-problem-cases"/);
  assert.match(html, /data-guard-lesson="search-tictactoe-minimax"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/search-problem-cases\/"/);
});

test("게임판·상태 안내·재시작 버튼 등 핵심 구조 요소가 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="board"/);
  assert.match(html, /id="turn-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="restart-button"/);
  assert.match(html, /id="score-win"/);
  assert.match(html, /id="score-draw"/);
  assert.match(html, /id="score-lose"/);
});

test("게임 종료 후에만 드러나는 복기(부분 게임 트리) 영역과 용어 설명이 있고, 문서 순서상 게임판 다음에 온다", async () => {
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

test("용어 설명은 Min-Max/게임 트리/최선 대응을 다루되, 게임판 소개 문구에는 나오지 않는다(체험 후 설명)", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const glossaryMatch = html.match(/<section id="glossary"[\s\S]*?<\/section>/);
  assert.ok(glossaryMatch, "glossary 섹션을 찾을 수 없음");
  assert.match(glossaryMatch[0], /게임 트리/);
  assert.match(glossaryMatch[0], /Min-Max/);
  assert.match(glossaryMatch[0], /최선 대응/);

  const introMatch = html.match(/<section id="intro"[\s\S]*?<\/section>/);
  assert.ok(introMatch, "intro 섹션을 찾을 수 없음");
  assert.doesNotMatch(introMatch[0], /게임 트리/);
});

test("game.js는 evaluateMoves로 상대의 최선 대응까지 계산해 복기 화면을 만든다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /evaluateMoves/);
  assert.match(js, /humanReply/);
  assert.match(js, /function renderReview/);
  assert.match(js, /function renderCandidateList/);
});

test("game.js는 buildDecisionTree로 각 수마다 Min-Max 의사결정 트리를 그리고, 복기 항목 안에 토글로 넣는다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /buildDecisionTree/);
  assert.match(js, /function renderDecisionTree/);
  assert.match(js, /function renderTreeNode/);
  assert.match(js, /<details class="tree-details">/);
  assert.match(js, /Min-Max 의사결정 트리로 보기/);
});

test("이 활동지는 series-nav/series-step 대신 lesson-pager로 다음 활동(오델로)과 이어진다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /series-nav/);
  assert.doesNotMatch(html, /series-step/);
  assert.doesNotMatch(css, /\.series-step/);
  assert.match(html, /class="lesson-pager"/);
  assert.match(html, /href="\.\.\/search-othello-minimax\/"/);
  assert.match(css, /\.lesson-pager\s*\{/);
});

test("Min-Max 의사결정 트리는 후보 수·MAX\\/MIN 차례·말단 점수·최종 선택을 화면에 표시하는 CSS 훅을 갖춘다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.tree-node/);
  assert.match(css, /\.tree-turn-badge/);
  assert.match(css, /\.tree-chosen-badge/);
  assert.match(css, /\.tree-score--win/);
  assert.match(css, /\.tree-score--lose/);
  assert.match(css, /\.tree-score--draw/);
  assert.match(css, /\.mini-board/);
  assert.match(css, /\.tree-details summary/);
});

test("키보드 접근성: 칸은 button 요소이고 방향키로 이동할 수 있으며, CSS에 focus-visible 스타일이 있다", async () => {
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
  assert.match(css, /:focus-visible/);
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

test("data/activity-groups.json과 data/lessons.json에 이 활동이 search-problem-cases 두 번째 활동으로 등록되어 있다", async () => {
  const [groupsRaw, lessonsRaw] = await Promise.all([
    readFile(new URL("../../data/activity-groups.json", lessonRoot), "utf8"),
    readFile(new URL("../../data/lessons.json", lessonRoot), "utf8"),
  ]);
  const groups = JSON.parse(groupsRaw).groups;
  const searchGroup = groups.find((group) => group.id === "search-problem-cases");
  assert.ok(searchGroup, "search-problem-cases 그룹을 찾을 수 없음");
  const child = searchGroup.children.find((candidate) => candidate.id === "search-tictactoe-minimax");
  assert.ok(child, "search-tictactoe-minimax가 search-problem-cases 그룹의 활동으로 등록되어 있어야 함");
  assert.equal(child.path, "lessons/search-tictactoe-minimax/");
  assert.equal(child.order, 1);
  assert.equal(searchGroup.children.length, 2, "search-problem-cases는 이제 틱택토 + 오델로 두 활동 구조여야 함");

  const lessons = JSON.parse(lessonsRaw).lessons;
  const lesson = lessons.find((candidate) => candidate.id === "search-tictactoe-minimax");
  assert.ok(lesson, "search-tictactoe-minimax가 data/lessons.json에 등록되어 있어야 함");
  assert.equal(lesson.path, "lessons/search-tictactoe-minimax/");
  assert.equal(lesson.unit, "탐색의 다양한 문제 해결 사례");
  assert.equal(lesson.order, 1);

  const lessonIds = lessons.map((candidate) => candidate.id);
  assert.ok(!lessonIds.includes("search-route-case"), "경로 탐색 활동은 제거되어 data/lessons.json에 남아 있으면 안 됨");
  assert.ok(!lessonIds.includes("search-local-case"), "지역 탐색 활동은 제거되어 data/lessons.json에 남아 있으면 안 됨");
});

test("경로 탐색·지역 탐색 lesson 디렉터리는 완전히 제거되었다", async () => {
  await assert.rejects(readFile(new URL("../lessons/search-route-case/index.html", import.meta.url)));
  await assert.rejects(readFile(new URL("../lessons/search-local-case/index.html", import.meta.url)));
});

// --- 시각 디자인 및 반응형 계층 검증 ------------------------------------------

test("의사결정 트리는 후보 탐색(↓)·말단 판정(★)·점수 역전파(↑) 순서를 나타내는 시각 가이드와 역전파 훅을 갖춘다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /class="tree-flow-guide"/);
  assert.match(js, /후보 탐색/);
  assert.match(js, /말단 판정/);
  assert.match(js, /점수 전달/);
  assert.match(js, /class="tree-propagation-badge"/);
  assert.match(js, /역전파/);
  assert.match(css, /\.tree-flow-guide/);
  assert.match(css, /\.tree-propagation-badge/);
  assert.match(css, /\.tree-compare-note/);
});

test("MAX(컴퓨터)와 MIN(상대) 단계가 색상·테두리·배지로 명확히 구분된다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /tree-turn-badge--max/);
  assert.match(js, /tree-turn-badge--min/);
  assert.match(css, /\.tree-turn-badge--max/);
  assert.match(css, /\.tree-turn-badge--min/);
});

test("선택된 가지(주 진행선)와 생략·대안 가지가 간선·배지·콜아웃으로 구분된다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /class="tree-chosen-badge"/);
  assert.match(js, /class="tree-alt-badge"/);
  assert.match(js, /class="tree-notice tree-truncated-note"/);
  assert.match(js, /class="tree-notice tree-omitted-note"/);
  assert.match(css, /\.tree-branch-item/);
  assert.match(css, /\.tree-notice/);
  assert.match(css, /\.tree-truncated-note/);
  assert.match(css, /\.tree-omitted-note/);
});

test("게임판과 복기 영역이 단계 배지 및 컨테이너 스타일로 명확히 분리되고 트리는 가로 넘침 방지 스크롤을 갖춘다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /class="section-step-badge"/);
  assert.match(html, /section-step-badge--review/);
  assert.match(html, /section-step-badge--glossary/);
  assert.match(css, /\.section-step-badge/);
  assert.match(css, /\.decision-tree\s*\{[^}]*overflow-x:\s*auto/s);
});

test("프로젝터 모드에서 트리의 테두리·간선·가이드가 고대비로 전환된다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.projector-mode \.decision-tree/);
  assert.match(css, /\.projector-mode \.tree-flow-guide/);
  assert.match(css, /\.projector-mode \.tree-children/);
  assert.match(css, /\.projector-mode \.tree-node/);
  assert.match(css, /\.projector-mode \.tree-edge--chosen/);
  assert.match(css, /\.projector-mode \.tree-edge--alt/);
});

test("부모-자식 간선은 세로 목록 대신 좌우 수평 분기 레이아웃(flex-direction: row)으로 연결된다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /function renderTreeConnector/);
  assert.match(js, /class="tree-diagram"/);
  assert.match(css, /\.tree-diagram\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.tree-children\s*\{[^}]*flex-direction:\s*row/s);
  assert.match(css, /\.tree-children\s*\{[^}]*justify-content:\s*center/s);
  assert.match(css, /\.tree-branch-item\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.tree-branch-item\s*\{[^}]*flex-direction:\s*column/s);
});

test("부모 중앙에서 자식 중앙으로 정확히 이어지는 SVG 간선과 최적 가지 강조선(4px)을 그린다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /<svg class="tree-connector-svg/);
  assert.match(js, /viewBox="0 0 100 \$\{height\}"/);
  assert.match(js, /M 50 0/);
  assert.match(js, /tree-edge--chosen/);
  assert.match(js, /tree-edge--alt/);
  assert.match(js, /vector-effect="non-scaling-stroke"/);

  assert.match(css, /\.tree-connector-svg/);
  assert.match(css, /\.tree-edge--chosen\s*\{[^}]*stroke-width:\s*4px/s);
  assert.match(css, /\.tree-edge--chosen\s*\{[^}]*stroke:\s*var\(--accent\)/s);
  assert.match(css, /\.tree-edge--alt\s*\{[^}]*stroke-dasharray:/s);
});

test("루트(MAX) → 후보 수 → 상대 대응(MIN) → 말단/대표 진행선의 4단계 계층 태그와 역전파 화살표가 명확하다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /function getLevelLabel/);
  assert.match(js, /루트 · 현재 보드/);
  assert.match(js, /1단계 · 후보 수/);
  assert.match(js, /2단계 · 상대 대응/);
  assert.match(js, /대표 진행선/);
  assert.match(js, /말단 판정/);
  assert.match(js, /class="tree-level-tag/);
  assert.match(js, /class="tree-edge-flow-group"/);
  assert.match(js, /class="tree-edge-flow-circle"/);
  assert.match(js, /class="tree-edge-flow-text"/);
  assert.match(js, />↑</);

  assert.match(css, /\.tree-level-tag/);
  assert.match(css, /\.tree-level-tag--terminal/);
  assert.match(css, /\.tree-edge-flow-circle/);
  assert.match(css, /\.tree-edge-flow-text/);
});

test("모바일에서는 트리 다이어그램 최소 너비(660px)와 가로 스크롤로 분기 관계를 보존한다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.tree-diagram\s*\{[^}]*min-width:\s*660px/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.tree-diagram\s*\{[\s\S]*?min-width:\s*660px/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.decision-tree\s*\{[\s\S]*?overflow-x:\s*auto/s);
});

test("점수 역전파 화살표는 가로 왜곡 상쇄(scaleX)를 갖추어 크기가 일정하게 유지된다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");

  // SVG 크기 계산 및 transform scale을 통한 가로 왜곡 상쇄 검증
  assert.match(js, /100\s*\/\s*svgRect\.width/);
  assert.match(js, /flowGroup\.setAttribute\(\s*"transform",\s*`translate\(/);
  assert.match(js, /scale\(\$\{scaleX\}, 1\)/);
});
