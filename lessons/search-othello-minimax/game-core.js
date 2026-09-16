// 4x4 오델로 규칙과 Min-Max 탐색을 담당하는 순수 로직 모듈(DOM 의존 없음).
export const HUMAN = "B";
export const COMPUTER = "W";
export const EMPTY = null;
export const BOARD_SIZE = 4;
export const CELL_COUNT = 16;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function otherMark(mark) {
  return mark === HUMAN ? COMPUTER : HUMAN;
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function createBoard() {
  const board = Array(CELL_COUNT).fill(EMPTY);
  board[5] = COMPUTER;
  board[6] = HUMAN;
  board[9] = HUMAN;
  board[10] = COMPUTER;
  return board;
}

// index에 mark를 두면 뒤집히는 칸들을 8방향으로 스캔해 반환한다(둘 수 없는 자리면 빈 배열).
export function getFlips(board, mark, index) {
  if (board[index] !== EMPTY) return [];
  const opponent = otherMark(mark);
  const row0 = Math.floor(index / BOARD_SIZE);
  const col0 = index % BOARD_SIZE;
  const flips = [];
  for (const [dr, dc] of DIRECTIONS) {
    let row = row0 + dr;
    let col = col0 + dc;
    const line = [];
    while (inBounds(row, col) && board[row * BOARD_SIZE + col] === opponent) {
      line.push(row * BOARD_SIZE + col);
      row += dr;
      col += dc;
    }
    if (line.length > 0 && inBounds(row, col) && board[row * BOARD_SIZE + col] === mark) {
      flips.push(...line);
    }
  }
  return flips;
}

export function isLegalMove(board, mark, index) {
  return board[index] === EMPTY && getFlips(board, mark, index).length > 0;
}

export function getLegalMoves(board, mark) {
  const moves = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (isLegalMove(board, mark, i)) moves.push(i);
  }
  return moves;
}

export function applyMove(board, mark, index) {
  const flips = getFlips(board, mark, index);
  const next = board.slice();
  next[index] = mark;
  for (const idx of flips) next[idx] = mark;
  return next;
}

export function countPieces(board) {
  let black = 0;
  let white = 0;
  for (const cell of board) {
    if (cell === HUMAN) black += 1;
    else if (cell === COMPUTER) white += 1;
  }
  return { black, white };
}

export function getGameStatus(board) {
  const blackLegalMoves = getLegalMoves(board, HUMAN);
  const whiteLegalMoves = getLegalMoves(board, COMPUTER);
  const { black, white } = countPieces(board);
  const isOver = blackLegalMoves.length === 0 && whiteLegalMoves.length === 0;
  let winner = null;
  let isDraw = false;
  if (isOver) {
    if (black > white) winner = HUMAN;
    else if (white > black) winner = COMPUTER;
    else isDraw = true;
  }
  return { isOver, winner, isDraw, blackCount: black, whiteCount: white, blackLegalMoves, whiteLegalMoves };
}

// justMovedMark가 막 수를 둔 뒤, 다음에 실제로 둘 차례(패스 포함)를 판정한다.
// 상대가 둘 수 있으면 상대 차례, 상대가 둘 수 없고 justMovedMark는 둘 수 있으면 상대 턴을 건너뛰고 다시 justMovedMark 차례(passed=true),
// 둘 다 둘 수 없으면(게임 종료 상태) mover=null.
export function resolveNextMover(board, justMovedMark) {
  const opponent = otherMark(justMovedMark);
  if (getLegalMoves(board, opponent).length > 0) return { mover: opponent, passed: false };
  if (getLegalMoves(board, justMovedMark).length > 0) return { mover: justMovedMark, passed: true };
  return { mover: null, passed: false };
}

// 말단(게임 종료) 점수는 "더 빨리 이기는 수"를 가려내기 위해 depth를 반영한다(패스도 한 턴으로 세어 depth+1).
// BASE_SCORE는 4x4 보드(빈 칸 최대 12개 + 패스 여유)를 넉넉히 덮는 값이면 충분하다.
const BASE_SCORE = 40;

function minimax(board, mark, computerMark, humanMark, depth) {
  const status = getGameStatus(board);
  if (status.isOver) {
    if (status.winner === computerMark) return { move: null, score: BASE_SCORE - depth };
    if (status.winner === humanMark) return { move: null, score: depth - BASE_SCORE };
    return { move: null, score: 0 };
  }

  const moves = getLegalMoves(board, mark);
  if (moves.length === 0) {
    // 이 자리에서 mark는 둘 수 없어 패스 — 상대에게 넘기되, 패스도 한 턴이므로 depth를 늘린다.
    return minimax(board, otherMark(mark), computerMark, humanMark, depth + 1);
  }

  let best = null;
  for (const move of moves) {
    const next = applyMove(board, mark, move);
    const result = minimax(next, otherMark(mark), computerMark, humanMark, depth + 1);
    const candidate = { move, score: result.score };
    if (best === null) {
      best = candidate;
    } else if (mark === computerMark && candidate.score > best.score) {
      best = candidate;
    } else if (mark === humanMark && candidate.score < best.score) {
      best = candidate;
    }
  }
  return best;
}

// 컴퓨터가 둘 수 있는 모든 수를 살펴보고, 그 수를 둔 뒤 상대의 최선 대응까지 내다본 결과를
// 점수와 함께 돌려준다. 상대가 둘 곳이 없어 패스하면(replyPass=true) replyMover/replyMove는
// 다시 컴퓨터 자신의 다음 수를 가리킨다(minimax가 내부적으로 패스를 넘겨 처리하므로 그대로 얻어진다).
export function evaluateMoves(board, computerMark = COMPUTER, humanMark = HUMAN) {
  const moves = getLegalMoves(board, computerMark);
  const candidates = moves.map((move) => {
    const afterComputer = applyMove(board, computerMark, move);
    const status = getGameStatus(afterComputer);
    if (status.isOver) {
      const score = status.winner === computerMark ? BASE_SCORE - 1 : status.isDraw ? 0 : -(BASE_SCORE - 1);
      return {
        move, score, replyMover: null, replyMove: null, replyPass: false,
        outcome: status.winner === computerMark ? "win" : status.isDraw ? "draw" : "lose",
      };
    }
    const { mover: replyMover, passed: replyPass } = resolveNextMover(afterComputer, computerMark);
    const replyResult = minimax(afterComputer, humanMark, computerMark, humanMark, 1);
    const outcome = replyResult.score > 0 ? "win" : replyResult.score < 0 ? "lose" : "draw";
    return { move, score: replyResult.score, replyMover, replyMove: replyResult.move, replyPass, outcome };
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function getBestMove(board, computerMark = COMPUTER, humanMark = HUMAN) {
  const [best] = evaluateMoves(board, computerMark, humanMark);
  return best ?? null;
}

// 트리에서 한 번에 보여줄 후보 수(컴퓨터 차례)와 대응 수(상대 차례)의 개수.
const TREE_ROOT_BRANCHES = 3;
const TREE_REPLY_BRANCHES = 2;

// 실제 게임에서 쓰는 depth 가중 점수는 내부 구현 세부사항이다. 학생에게 보여줄 값은 항상
// 승리 +1 / 무승부 0 / 패배 -1이어야 한다(부호만으로 실제 승패 범주와 일치).
function toOutcomeScore(mark, computerMark, relativeScore) {
  const computerRelative = mark === computerMark ? relativeScore : -relativeScore;
  if (computerRelative > 0) return 1;
  if (computerRelative < 0) return -1;
  return 0;
}

function terminalOutcome(status, computerMark, humanMark) {
  if (status.winner === computerMark) return { score: 1, outcome: "computer" };
  if (status.winner === humanMark) return { score: -1, outcome: "human" };
  return { score: 0, outcome: "draw" };
}

// 지금 보드에서 컴퓨터(MAX)의 선택이 어떻게 만들어지는지 학생이 눈으로 따라갈 수 있도록,
// 실제로 쓰인 것과 같은 Min-Max 값들로 구성된 제한된 깊이의 의사결정 트리를 만든다.
// 오델로는 둘 수 있는 자리가 없으면 자동으로 패스하므로, 그 지점에는 전용 "패스 노드"
// (자식이 하나뿐이고 MAX/MIN 배지 대신 "패스"로 표시되는 노드)를 끼워 넣는다.
export function buildDecisionTree(board, computerMark = COMPUTER, humanMark = HUMAN, chosenMove = null) {
  function buildContinuation(boardNow, actingMover, expand) {
    const evaluated = evaluateMoves(boardNow, actingMover, otherMark(actingMover));
    if (expand === "principal") {
      const best = evaluated[0];
      const child = buildMoveNode(boardNow, actingMover, best.move, best.score, "principal", true);
      return { children: [child], optionCount: evaluated.length, omittedChildren: 0 };
    }
    const shown = evaluated.slice(0, TREE_REPLY_BRANCHES);
    const children = shown.map((candidate, index) =>
      buildMoveNode(boardNow, actingMover, candidate.move, candidate.score, index === 0 ? "principal" : "stop", index === 0),
    );
    return { children, optionCount: evaluated.length, omittedChildren: evaluated.length - shown.length };
  }

  function buildPassNode(boardNow, actingMover, skippedMark, expand) {
    const { children, optionCount, omittedChildren } = buildContinuation(boardNow, actingMover, expand);
    return {
      board: boardNow, isPass: true, move: null, movedBy: null,
      terminal: false, outcome: null, truncated: false,
      nextTurn: actingMover, skippedMark,
      score: children[0]?.score ?? 0,
      optionCount, omittedChildren, children, isChosen: true,
    };
  }

  // mover가 boardBeforeMove에 move를 두어 만들어지는 노드를 만든다.
  // expand: "branches"(형제 후보들을 보여주고, 그중 최선의 한 가지만 principal로 계속 확장),
  //         "principal"(형제 없이 최선 수만 골라 끝까지 이어감), "stop"(더 펼치지 않고 값만 표시).
  function buildMoveNode(boardBeforeMove, mover, move, relativeScoreForMover, expand, isChosen) {
    const nextBoard = applyMove(boardBeforeMove, mover, move);
    const status = getGameStatus(nextBoard);
    const score = toOutcomeScore(mover, computerMark, relativeScoreForMover);

    if (status.isOver) {
      const { outcome } = terminalOutcome(status, computerMark, humanMark);
      return {
        board: nextBoard, movedBy: mover, move, isPass: false, terminal: true, outcome,
        truncated: false, nextTurn: null, score, optionCount: 0, children: [], isChosen,
      };
    }

    const { mover: actingMover, passed } = resolveNextMover(nextBoard, mover);

    if (expand === "stop") {
      return {
        board: nextBoard, movedBy: mover, move, isPass: false, terminal: false, outcome: null,
        truncated: true, nextTurn: actingMover, score, optionCount: null, children: [], isChosen,
      };
    }

    if (passed) {
      const passChild = buildPassNode(nextBoard, actingMover, otherMark(mover), expand);
      return {
        board: nextBoard, movedBy: mover, move, isPass: false, terminal: false, outcome: null,
        truncated: false, nextTurn: actingMover, score, optionCount: 1, children: [passChild], isChosen,
      };
    }

    const { children, optionCount, omittedChildren } = buildContinuation(nextBoard, actingMover, expand);
    return {
      board: nextBoard, movedBy: mover, move, isPass: false, terminal: false, outcome: null,
      truncated: false, nextTurn: actingMover, score, optionCount, omittedChildren, children, isChosen,
    };
  }

  const rootEvaluated = evaluateMoves(board, computerMark, humanMark);
  const resolvedChosenMove = chosenMove ?? rootEvaluated[0]?.move ?? null;
  const shownRoot = rootEvaluated.slice(0, TREE_ROOT_BRANCHES);
  const branches = shownRoot.map((candidate) => {
    const isChosenBranch = candidate.move === resolvedChosenMove;
    return buildMoveNode(board, computerMark, candidate.move, candidate.score, isChosenBranch ? "branches" : "stop", isChosenBranch);
  });

  return {
    board, computerMark, humanMark, turn: "MAX",
    chosenMove: resolvedChosenMove,
    totalCandidates: rootEvaluated.length,
    omittedCandidates: rootEvaluated.length - shownRoot.length,
    branches,
  };
}
