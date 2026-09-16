// 틱택토 규칙과 Min-Max 탐색을 담당하는 순수 로직 모듈(DOM 의존 없음).
export const HUMAN = "X";
export const COMPUTER = "O";
export const EMPTY = null;

export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function createBoard() {
  return Array(9).fill(EMPTY);
}

export function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === EMPTY) moves.push(i);
  }
  return moves;
}

export function getWinningLine(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== EMPTY && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  return null;
}

export function checkWinner(board) {
  return getWinningLine(board)?.mark ?? null;
}

export function getGameStatus(board) {
  const winning = getWinningLine(board);
  const draw = !winning && getAvailableMoves(board).length === 0;
  return {
    winner: winning ? winning.mark : null,
    winningLine: winning ? winning.line : null,
    isDraw: draw,
    isOver: Boolean(winning) || draw,
  };
}

function otherMark(mark, computerMark, humanMark) {
  return mark === computerMark ? humanMark : computerMark;
}

// mark 차례에서 최선의 수를 재귀적으로 탐색한다. 점수는 항상 컴퓨터 관점으로 매겨,
// 컴퓨터는 최대화(maximize)하고 상대(사람)는 최소화(minimize)하도록 만든다.
// depth를 점수에 반영해 "더 빨리 이기는 수"와 "최대한 늦게 지는 수"를 가려낸다.
function minimax(board, mark, computerMark, humanMark, depth) {
  const status = getGameStatus(board);
  if (status.isOver) {
    if (status.winner === computerMark) return { move: null, score: 10 - depth };
    if (status.winner === humanMark) return { move: null, score: depth - 10 };
    return { move: null, score: 0 };
  }

  let best = null;
  for (const move of getAvailableMoves(board)) {
    const next = board.slice();
    next[move] = mark;
    const result = minimax(next, otherMark(mark, computerMark, humanMark), computerMark, humanMark, depth + 1);
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
// 점수와 함께 돌려준다(부분 게임 트리: 컴퓨터의 수 → 상대의 최선 대응 → 이후 최선 진행의 결과).
// 점수가 높은 순으로 정렬되며, candidates[0]이 컴퓨터가 선택할 최선의 수다.
export function evaluateMoves(board, computerMark = COMPUTER, humanMark = HUMAN) {
  const moves = getAvailableMoves(board);
  const candidates = moves.map((move) => {
    const afterComputer = board.slice();
    afterComputer[move] = computerMark;
    const status = getGameStatus(afterComputer);
    if (status.isOver) {
      const score = status.winner === computerMark ? 10 - 1 : status.isDraw ? 0 : -10 + 1;
      return { move, score, humanReply: null, outcome: status.winner === computerMark ? "win" : status.isDraw ? "draw" : "lose" };
    }
    const humanBest = minimax(afterComputer, humanMark, computerMark, humanMark, 1);
    const outcome = humanBest.score > 0 ? "win" : humanBest.score < 0 ? "lose" : "draw";
    return { move, score: humanBest.score, humanReply: humanBest.move, outcome };
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function getBestMove(board, computerMark = COMPUTER, humanMark = HUMAN) {
  const [best] = evaluateMoves(board, computerMark, humanMark);
  return best ?? null;
}

// 트리에서 한 번에 보여줄 후보 수(컴퓨터 차례)와 대응 수(상대 차례)의 개수.
// 전체 게임 트리는 초반일수록 가지 수가 매우 많아지므로, 학생이 지금 판단을 이해하는 데
// 필요한 만큼만 대표로 보여주고 나머지는 "생략됨"으로 안내한다.
const TREE_ROOT_BRANCHES = 3;
const TREE_REPLY_BRANCHES = 2;

// 실제 게임에서 쓰는 depth 가중 점수(10-depth 등)는 "더 빨리 이기는 수"를 가려내기 위한
// 내부 구현 세부사항이다. 학생에게 보여줄 값은 항상 승리 +1 / 무승부 0 / 패배 -1 이어야
// Min-Max 오개념(점수가 클수록 더 좋다는 것 이상의 의미가 있다는 오해)을 막을 수 있다.
// minimax 계열 점수는 항상 "이 자리에서 최적으로 진행했을 때의 결과"만을 나타내므로,
// 부호(양수/0/음수)만 보아도 실제 승패 범주와 정확히 일치한다.
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
// - 1단계(컴퓨터 후보 수, MAX)는 최대 TREE_ROOT_BRANCHES개까지 대표로 보여준다.
// - 그중 실제로 선택된 가지만 더 깊이 펼쳐서, 상대(MIN)의 대응 후보를 최대
//   TREE_REPLY_BRANCHES개까지 보여준다.
// - 실제로 선택된 가지의, 실제로 가정한 상대 대응 이후로는 두 사람이 계속 최선을 다한다고
//   가정한 단 하나의 진행(주 진행선)만 게임이 끝날 때까지 이어서 보여줘 진짜 말단 점수를
//   확인할 수 있게 한다. 그 밖의 모든 가지는 "생략됨"으로 표시하고, 이미 계산된
//   최종 결과값만 보여준다(실제 게임 로직은 언제나 전체 깊이까지 정확히 계산한 값을 쓴다).
export function buildDecisionTree(board, computerMark = COMPUTER, humanMark = HUMAN, chosenMove = null) {
  const otherOf = (mark) => (mark === computerMark ? humanMark : computerMark);

  // mover가 boardBeforeMove에 move를 두어 만들어지는 노드를 만든다.
  // expand: "branches"(형제 후보들을 보여주고, 그중 최선의 한 가지만 principal로 계속 확장),
  //         "principal"(형제 없이 최선 수만 골라 끝까지 이어감), "stop"(더 펼치지 않고 값만 표시).
  function buildMoveNode(boardBeforeMove, mover, move, relativeScoreForMover, expand, isChosen) {
    const nextBoard = boardBeforeMove.slice();
    nextBoard[move] = mover;
    const status = getGameStatus(nextBoard);
    const score = toOutcomeScore(mover, computerMark, relativeScoreForMover);

    if (status.isOver) {
      const { outcome } = terminalOutcome(status, computerMark, humanMark);
      return {
        board: nextBoard, movedBy: mover, move, terminal: true, outcome,
        truncated: false, nextTurn: null, score, optionCount: 0, children: [], isChosen,
      };
    }

    const nextTurn = otherOf(mover);
    if (expand === "stop") {
      return {
        board: nextBoard, movedBy: mover, move, terminal: false, outcome: null,
        truncated: true, nextTurn, score, optionCount: null, children: [], isChosen,
      };
    }

    const evaluated = evaluateMoves(nextBoard, nextTurn, mover);
    if (expand === "principal") {
      const best = evaluated[0];
      const child = buildMoveNode(nextBoard, nextTurn, best.move, best.score, "principal", true);
      return {
        board: nextBoard, movedBy: mover, move, terminal: false, outcome: null,
        truncated: false, nextTurn, score, optionCount: evaluated.length, children: [child], isChosen,
      };
    }

    // expand === "branches": 대표 후보 TREE_REPLY_BRANCHES개를 보여주고,
    // 그중 가장 앞선(=nextTurn에게 가장 유리한) 후보만 principal로 계속 확장한다.
    const shown = evaluated.slice(0, TREE_REPLY_BRANCHES);
    const children = shown.map((candidate, index) =>
      buildMoveNode(nextBoard, nextTurn, candidate.move, candidate.score, index === 0 ? "principal" : "stop", index === 0),
    );
    return {
      board: nextBoard, movedBy: mover, move, terminal: false, outcome: null,
      truncated: false, nextTurn, score, optionCount: evaluated.length, children, isChosen,
      omittedChildren: evaluated.length - shown.length,
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
    board,
    computerMark,
    humanMark,
    turn: "MAX",
    chosenMove: resolvedChosenMove,
    totalCandidates: rootEvaluated.length,
    omittedCandidates: rootEvaluated.length - shownRoot.length,
    branches,
  };
}
