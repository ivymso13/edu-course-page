import {
  HUMAN, COMPUTER, BOARD_SIZE, createBoard, getGameStatus, evaluateMoves, buildDecisionTree,
  isLegalMove, getLegalMoves, applyMove, resolveNextMover, countPieces,
} from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const ROW_LABEL = ["1행", "2행", "3행", "4행"];
const COL_LABEL = ["1열", "2열", "3열", "4열"];
const OUTCOME_LABEL = { win: "컴퓨터가 유리해짐", draw: "무승부로 이어짐", lose: "상대가 유리해짐" };

const state = {
  board: createBoard(),
  current: HUMAN,
  over: false,
  history: [],
  scores: { win: 0, draw: 0, lose: 0 },
};

function describeMove(index) {
  return `${ROW_LABEL[Math.floor(index / BOARD_SIZE)]} ${COL_LABEL[index % BOARD_SIZE]}`;
}

function cellLabel(index, mark, isLegal) {
  const position = describeMove(index);
  if (mark === HUMAN) return `${position}, 흑(나) 돌`;
  if (mark === COMPUTER) return `${position}, 백(컴퓨터) 돌`;
  return `${position}, 비어 있음${isLegal ? " (둘 수 있음)" : ""}`;
}

function renderBoard() {
  const board = $("#board");
  const legalForHuman = state.current === HUMAN && !state.over ? new Set(getLegalMoves(state.board, HUMAN)) : new Set();
  board.innerHTML = state.board
    .map((mark, index) => {
      const isLegal = legalForHuman.has(index);
      const disabled = state.over || mark !== null ? "disabled" : "";
      const markClass = mark ? ` cell--${mark === HUMAN ? "b" : "w"}` : "";
      const legalClass = isLegal ? " cell--legal" : "";
      const glyph = mark === HUMAN ? "⚫" : mark === COMPUTER ? "⚪" : "";
      return `<button type="button" class="cell${markClass}${legalClass}" data-index="${index}" aria-label="${cellLabel(index, mark, isLegal)}" ${disabled}>${glyph}</button>`;
    })
    .join("");
  board.querySelectorAll(".cell").forEach((button) => {
    button.addEventListener("click", () => handleCellActivate(Number(button.dataset.index)));
  });
}

function renderPieceCount() {
  const { black, white } = countPieces(state.board);
  $("#piece-count").textContent = `⚫ 흑(나) ${black} · ⚪ 백(컴퓨터) ${white}`;
}

function handleBoardKeydown(event) {
  const cells = Array.from($("#board").querySelectorAll(".cell"));
  const focused = document.activeElement;
  const currentIndex = cells.indexOf(focused);
  if (currentIndex === -1) return;
  const row = Math.floor(currentIndex / BOARD_SIZE);
  const col = currentIndex % BOARD_SIZE;
  let nextIndex = null;
  if (event.key === "ArrowRight") nextIndex = row * BOARD_SIZE + ((col + 1) % BOARD_SIZE);
  else if (event.key === "ArrowLeft") nextIndex = row * BOARD_SIZE + ((col + BOARD_SIZE - 1) % BOARD_SIZE);
  else if (event.key === "ArrowDown") nextIndex = ((row + 1) % BOARD_SIZE) * BOARD_SIZE + col;
  else if (event.key === "ArrowUp") nextIndex = ((row + BOARD_SIZE - 1) % BOARD_SIZE) * BOARD_SIZE + col;
  if (nextIndex !== null) {
    event.preventDefault();
    cells[nextIndex].focus();
  }
}

function setTurnStatus(text) {
  $("#turn-status").textContent = text;
}

function handleCellActivate(index) {
  if (state.over || state.current !== HUMAN || !isLegalMove(state.board, HUMAN, index)) return;
  state.board = applyMove(state.board, HUMAN, index);
  afterMove(HUMAN);
}

// 사람/컴퓨터 어느 쪽이 두었든 공통으로: 다시 그리고, 게임이 끝났는지 확인하고,
// 다음 차례(상대가 둘 곳이 없으면 자동 패스)를 판정해 상태 문구와 다음 동작을 정한다.
function afterMove(justMovedMark) {
  const status = getGameStatus(state.board);
  if (status.isOver) {
    endGame(status);
    return;
  }

  // state.current를 먼저 다음 차례로 갱신한 뒤 그려야, renderBoard()가 계산하는
  // "지금 사람이 둘 수 있는 칸" 강조 표시가 한 턴 밀리지 않고 정확히 맞아떨어진다.
  const { mover, passed } = resolveNextMover(state.board, justMovedMark);
  state.current = mover;
  renderBoard();
  renderPieceCount();

  if (mover === HUMAN) {
    setTurnStatus(passed ? "컴퓨터가 둘 수 없어 건너뛰었습니다. 당신 차례입니다 (흑)" : "당신 차례입니다 (흑)");
    const firstOpenCell = $("#board").querySelector(".cell:not([disabled])");
    if (firstOpenCell) firstOpenCell.focus();
  } else {
    setTurnStatus(passed ? "당신이 둘 수 없어 건너뛰었습니다. 컴퓨터가 생각하는 중입니다…" : "컴퓨터가 생각하는 중입니다…");
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
    window.setTimeout(runComputerTurn, delay);
  }
}

function runComputerTurn() {
  const evaluated = evaluateMoves(state.board, COMPUTER, HUMAN);
  const chosen = evaluated[0];
  state.history.push({
    moveNumber: state.history.length + 1,
    boardBefore: state.board.slice(),
    candidates: evaluated,
    chosenMove: chosen.move,
  });
  state.board = applyMove(state.board, COMPUTER, chosen.move);
  afterMove(COMPUTER);
}

function endGame(status) {
  state.over = true;
  renderBoard();
  renderPieceCount();
  let resultText;
  if (status.winner === HUMAN) {
    state.scores.win += 1;
    resultText = `축하합니다! 흑 ${status.blackCount} : 백 ${status.whiteCount}로 당신이 이겼습니다.`;
  } else if (status.winner === COMPUTER) {
    state.scores.lose += 1;
    resultText = `흑 ${status.blackCount} : 백 ${status.whiteCount}로 컴퓨터가 이겼습니다.`;
  } else {
    state.scores.draw += 1;
    resultText = `흑 ${status.blackCount} : 백 ${status.whiteCount}로 무승부입니다.`;
  }
  $("#score-win").textContent = String(state.scores.win);
  $("#score-draw").textContent = String(state.scores.draw);
  $("#score-lose").textContent = String(state.scores.lose);
  setTurnStatus(resultText);
  renderReview(resultText);
}

function scoreLabel(score) {
  return score > 0 ? "+1" : score < 0 ? "-1" : "0";
}

function scoreBadgeClass(score) {
  return score > 0 ? "tree-score--win" : score < 0 ? "tree-score--lose" : "tree-score--draw";
}

function renderMiniBoard(board) {
  const cells = board
    .map((mark) => {
      const glyph = mark === HUMAN ? "⚫" : mark === COMPUTER ? "⚪" : "";
      return `<span class="mini-cell${mark ? ` mini-cell--${mark === HUMAN ? "b" : "w"}` : ""}">${glyph}</span>`;
    })
    .join("");
  return `<div class="mini-board mini-board--4x4" aria-hidden="true">${cells}</div>`;
}

// MAX/MIN이 형제 후보들 중에서 값을 골라 자기 자리의 값으로 삼는 과정을 문장으로 보여준다.
// 후보 값이 전부 같으면(무승부로 흘러가는 흔한 경우) "가장 큰/작은 값을 고른다"는 설명이
// 실제로 보여주는 대비가 없어 반복 소음만 되므로, 값이 실제로 갈릴 때만 표시한다.
function renderComparisonNote(items, turnLabel) {
  if (items.length < 2) return "";
  if (items.every((item) => item.score === items[0].score)) return "";
  const parts = items
    .map((item) => `${describeMove(item.move)} = ${scoreLabel(item.score)}${item.isChosen ? " (선택)" : ""}`)
    .join(", ");
  const picked = items.find((item) => item.isChosen) ?? items[0];
  const compareWord = turnLabel === "MAX" ? "가장 큰" : "가장 작은";
  const roleExplanation = turnLabel === "MAX"
    ? "컴퓨터(MAX)는 자신에게 가장 유리한 점수를 얻기 위해"
    : "상대(MIN)는 컴퓨터에게 가장 불리한 점수를 주기 위해";
  return `<div class="tree-compare-note" role="note">
      <span class="tree-propagation-badge">↑ 값 전달 (역전파)</span>
      <p class="tree-compare-text">${roleExplanation} 후보 값(${parts})을 비교합니다. → ${turnLabel}는 이 중 ${compareWord} 값 <strong>${scoreLabel(picked.score)}</strong>을 이 자리의 값으로 올립니다.</p>
    </div>`;
}

function getLevelLabel(level, isTerminal) {
  if (isTerminal) return "말단 판정";
  if (level === 1) return "1단계 · 후보 수";
  if (level === 2) return "2단계 · 상대 대응";
  return "대표 진행선";
}

// 부모 노드 중앙에서 자식 노드 중앙으로 정확히 이어지는 간선(Edges) 및 역전파 흐름을 그린다.
function renderTreeConnector(children) {
  if (!children || children.length === 0) return "";
  const count = children.length;
  const height = 36;
  const midY = height / 2;

  if (count === 1) {
    const isChosen = Boolean(children[0].isChosen);
    const edgeClass = isChosen ? "tree-edge tree-edge--chosen" : "tree-edge tree-edge--alt";
    const flowGroup = isChosen
      ? `<g class="tree-edge-flow-group" transform="translate(50, ${midY}) scale(0.4, 1)" aria-label="점수 역전파 방향: 아래에서 위로">
          <circle cx="0" cy="0" r="9" class="tree-edge-flow-circle" />
          <text x="0" y="3.5" text-anchor="middle" class="tree-edge-flow-text">↑</text>
        </g>`
      : "";
    return `<svg class="tree-connector-svg tree-connector-svg--single" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 50 0 L 50 ${height}" class="${edgeClass}" vector-effect="non-scaling-stroke" />
      ${flowGroup}
    </svg>`;
  }

  const items = children.map((child, index) => {
    const childX = Number((((index + 0.5) / count) * 100).toFixed(2));
    const isChosen = Boolean(child.isChosen);
    const edgeClass = isChosen ? "tree-edge tree-edge--chosen" : "tree-edge tree-edge--alt";
    const d = `M 50 0 L 50 ${midY} L ${childX} ${midY} L ${childX} ${height}`;
    return { isChosen, childX, edgeClass, d };
  });

  items.sort((a, b) => (a.isChosen ? 1 : 0) - (b.isChosen ? 1 : 0));

  const chosenItem = items.find((item) => item.isChosen);
  const flowY = midY + (height - midY) / 2;
  const flowGroup = chosenItem
    ? `<g class="tree-edge-flow-group" transform="translate(${chosenItem.childX}, ${flowY}) scale(0.15, 1)" aria-label="점수 역전파 방향: 아래에서 위로">
        <circle cx="0" cy="0" r="9" class="tree-edge-flow-circle" />
        <text x="0" y="3.5" text-anchor="middle" class="tree-edge-flow-text">↑</text>
      </g>`
    : "";

  return `<svg class="tree-connector-svg" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
    ${items.map((item) => `<path d="${item.d}" class="${item.edgeClass}" vector-effect="non-scaling-stroke" />`).join("\n    ")}
    ${flowGroup}
  </svg>`;
}

export function updateTreeConnectors(container = document) {
  const diagrams = container.querySelectorAll(".tree-diagram");
  diagrams.forEach((diagram) => {
    const rootNode = diagram.querySelector(":scope > .tree-node--root");
    const rootSvg = diagram.querySelector(":scope > .tree-connector-svg");
    const rootChildrenList = diagram.querySelector(":scope > .tree-children--root");
    if (rootNode && rootSvg && rootChildrenList) {
      updateConnectorGeometry(rootNode, rootSvg, rootChildrenList);
    }

    const nestedBranches = diagram.querySelectorAll(".tree-branch-item");
    nestedBranches.forEach((branch) => {
      const parentNode = branch.querySelector(":scope > .tree-node");
      const connectorSvg = branch.querySelector(":scope > .tree-connector-svg");
      const childrenList = branch.querySelector(":scope > .tree-children");
      if (parentNode && connectorSvg && childrenList) {
        updateConnectorGeometry(parentNode, connectorSvg, childrenList);
      }
    });
  });
}

function updateConnectorGeometry(parentNode, svg, childrenList) {
  const childBranches = Array.from(childrenList.children).filter((el) => el.classList.contains("tree-branch-item"));
  const childNodes = childBranches.map((branch) => branch.querySelector(":scope > .tree-node")).filter(Boolean);
  if (childNodes.length === 0) return;

  const svgRect = svg.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height) return;

  const scaleX = Number((100 / svgRect.width).toFixed(6));

  const parentRect = parentNode.getBoundingClientRect();
  const parentCenterX = parentRect.left + parentRect.width / 2;
  const parentX = Math.max(0, Math.min(100, ((parentCenterX - svgRect.left) / svgRect.width) * 100));

  const count = childNodes.length;
  const height = 36;
  const midY = height / 2;

  if (count === 1) {
    const childRect = childNodes[0].getBoundingClientRect();
    const childCenterX = childRect.left + childRect.width / 2;
    const childX = Math.max(0, Math.min(100, ((childCenterX - svgRect.left) / svgRect.width) * 100));
    const path = svg.querySelector("path.tree-edge") || svg.querySelector("path");
    if (path) {
      path.setAttribute("d", `M ${parentX.toFixed(2)} 0 L ${childX.toFixed(2)} ${height}`);
    }
    const flowGroup = svg.querySelector(".tree-edge-flow-group");
    if (flowGroup) {
      const circle = flowGroup.querySelector(".tree-edge-flow-circle");
      const text = flowGroup.querySelector(".tree-edge-flow-text");
      const midX = (parentX + childX) / 2;
      flowGroup.setAttribute("transform", `translate(${midX.toFixed(2)}, ${midY}) scale(${scaleX}, 1)`);
      if (circle) {
        circle.setAttribute("cx", "0");
        circle.setAttribute("cy", "0");
        circle.setAttribute("r", "9");
      }
      if (text) {
        text.setAttribute("x", "0");
        text.setAttribute("y", "3.5");
      }
    }
    return;
  }

  const paths = Array.from(svg.querySelectorAll("path.tree-edge")).length > 0
    ? Array.from(svg.querySelectorAll("path.tree-edge"))
    : Array.from(svg.querySelectorAll("path"));
  const chosenIndex = childBranches.findIndex((branch) => branch.classList.contains("is-chosen-branch"));

  childNodes.forEach((childNode, index) => {
    const childRect = childNode.getBoundingClientRect();
    const childCenterX = childRect.left + childRect.width / 2;
    const childX = Math.max(0, Math.min(100, ((childCenterX - svgRect.left) / svgRect.width) * 100));

    const isChosen = index === chosenIndex || childNode.classList.contains("is-chosen");
    const path = paths.find((p) =>
      isChosen ? p.classList.contains("tree-edge--chosen") : p.classList.contains("tree-edge--alt") && !p.dataset.matched
    ) || paths[index];

    if (path) {
      path.dataset.matched = "true";
      path.setAttribute("d", `M ${parentX.toFixed(2)} 0 L ${parentX.toFixed(2)} ${midY} L ${childX.toFixed(2)} ${midY} L ${childX.toFixed(2)} ${height}`);
    }

    if (isChosen) {
      const flowGroup = svg.querySelector(".tree-edge-flow-group");
      if (flowGroup) {
        const circle = flowGroup.querySelector(".tree-edge-flow-circle");
        const text = flowGroup.querySelector(".tree-edge-flow-text");
        const flowY = midY + (height - midY) / 2;
        flowGroup.setAttribute("transform", `translate(${childX.toFixed(2)}, ${flowY}) scale(${scaleX}, 1)`);
        if (circle) {
          circle.setAttribute("cx", "0");
          circle.setAttribute("cy", "0");
          circle.setAttribute("r", "9");
        }
        if (text) {
          text.setAttribute("x", "0");
          text.setAttribute("y", "3.5");
        }
      }
    }
  });

  paths.forEach((p) => delete p.dataset.matched);
}

// 자식 노드 목록을 <ul class="tree-children"> 로 감싸 렌더링한다(일반 수 노드/패스 노드 공용).
function renderChildrenList(children, level) {
  if (!children || children.length === 0) return "";
  return `<ul class="tree-children">${children
    .map((child) => {
      const hasSubChildren = Boolean(child.children && child.children.length > 0);
      const hasMultiple = Boolean(child.children && child.children.length > 1);
      const branchClasses = [
        "tree-branch-item",
        child.isChosen ? "is-chosen-branch" : "",
        hasSubChildren ? "has-children-branch" : "",
        hasMultiple ? "has-branching-branch" : "",
      ].filter(Boolean).join(" ");
      return `<li class="${branchClasses}">${renderTreeNode(child, level + 1)}</li>`;
    })
    .join("")}</ul>`;
}

// 둘 수 있는 자리가 없어 자동으로 건너뛴 차례를 보여주는 전용 노드(분기 없이 자식 하나로 이어짐).
function renderPassNode(node, level) {
  const skippedText = node.skippedMark === COMPUTER ? "컴퓨터(백)" : "상대(흑)";
  const actingText = node.nextTurn === COMPUTER ? "컴퓨터(백)" : "상대(흑)";
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const connectorHtml = hasChildren ? renderTreeConnector(node.children) : "";
  const childrenHtml = renderChildrenList(node.children, level);

  return `<div class="tree-node tree-node--pass is-chosen">
      <div class="tree-node-head">
        <span class="tree-level-tag">패스</span>
        <span class="tree-move">${skippedText}가 둘 수 있는 자리가 없음</span>
        <span class="tree-turn-badge tree-turn-badge--pass">패스</span>
      </div>
      <div class="tree-node-body">
        ${renderMiniBoard(node.board)}
        <div class="tree-node-info">
          <p class="tree-state">${skippedText}가 이번 차례를 건너뛰어, ${actingText}가 이어서 둡니다.</p>
        </div>
      </div>
    </div>
    ${connectorHtml}
    ${childrenHtml}`;
}

function renderTreeNode(node, level = 1) {
  if (node.isPass) return renderPassNode(node, level);

  const moverText = node.movedBy === COMPUTER ? "컴퓨터(백)" : "상대(흑)";
  const isMaxMover = node.movedBy === COMPUTER;
  const turnBadge = node.terminal
    ? '<span class="tree-turn-badge tree-turn-badge--terminal">말단 노드</span>'
    : isMaxMover
      ? '<span class="tree-turn-badge tree-turn-badge--max">MAX (컴퓨터)</span>'
      : '<span class="tree-turn-badge tree-turn-badge--min">MIN (상대)</span>';

  const stateText = node.terminal
    ? node.outcome === "computer"
      ? "게임 종료 · 컴퓨터 승 (+1)"
      : node.outcome === "human"
        ? "게임 종료 · 상대 승 (-1)"
        : "게임 종료 · 무승부 (0)"
    : node.nextTurn === COMPUTER
      ? "다음은 MAX(컴퓨터) 차례 · 점수 최대화"
      : "다음은 MIN(상대) 차례 · 점수 최소화";

  const chosenBadge = node.isChosen
    ? '<span class="tree-chosen-badge">★ 선택된 수</span>'
    : '<span class="tree-alt-badge">대안 후보</span>';

  const scoreMeaning = node.terminal ? "말단 점수" : "전달된 점수";

  const terminalUpwardHint = node.terminal
    ? `<p class="tree-leaf-hint">↑ 말단 결과 점수 <strong>${scoreLabel(node.score)}</strong>이(가) 위 부모 노드로 역전파됩니다.</p>`
    : "";

  const truncatedNote = node.truncated
    ? `<div class="tree-notice tree-truncated-note"><span class="tree-notice-icon" aria-hidden="true">✂️</span>표시 생략: 하위 분기 생략 (계산 점수 <strong>${scoreLabel(node.score)}</strong> 반영)</div>`
    : "";

  const omittedNote = node.omittedChildren
    ? `<div class="tree-notice tree-omitted-note"><span class="tree-notice-icon" aria-hidden="true">ℹ️</span>상대 후보 ${node.optionCount}개 중 대표 ${node.children.length}개 표시</div>`
    : "";

  const compareNote = !node.terminal && node.children && node.children.length > 1
    ? renderComparisonNote(
        node.children.map((child) => ({ move: child.move, score: child.score, isChosen: child.isChosen })),
        node.nextTurn === COMPUTER ? "MAX" : "MIN",
      )
    : "";

  const hasChildren = Boolean(node.children && node.children.length > 0);
  const connectorHtml = hasChildren ? renderTreeConnector(node.children) : "";
  const childrenHtml = renderChildrenList(node.children, level);

  const levelTag = `<span class="tree-level-tag${node.terminal ? " tree-level-tag--terminal" : ""}">${getLevelLabel(level, node.terminal)}</span>`;

  return `<div class="tree-node${node.isChosen ? " is-chosen" : ""}${node.terminal ? " is-terminal" : ""}${hasChildren ? " has-children" : ""}">
      <div class="tree-node-head">
        ${levelTag}
        <span class="tree-move">${moverText} → ${describeMove(node.move)}</span>
        ${turnBadge}
        ${chosenBadge}
        <span class="tree-score ${scoreBadgeClass(node.score)}" title="${scoreMeaning}: ${scoreLabel(node.score)}">
          <span class="tree-score-label">${scoreMeaning}</span>
          <strong>${scoreLabel(node.score)}</strong>
        </span>
      </div>
      <div class="tree-node-body">
        ${renderMiniBoard(node.board)}
        <div class="tree-node-info">
          <p class="tree-state">${stateText}</p>
          ${terminalUpwardHint}
        </div>
      </div>
      ${truncatedNote}
      ${omittedNote}
    </div>
    ${connectorHtml}
    ${childrenHtml}
    ${compareNote}`;
}

function renderDecisionTree(tree) {
  const flowGuide = `<div class="tree-flow-guide" aria-label="의사결정 트리 읽는 순서">
      <div class="tree-flow-step">
        <span class="tree-flow-step__badge">1. 후보 탐색 ↓</span>
        <span class="tree-flow-step__text">위에서 아래로 가능한 자리를 순차적으로 확장(둘 수 없으면 패스)</span>
      </div>
      <span class="tree-flow-arrow" aria-hidden="true">→</span>
      <div class="tree-flow-step">
        <span class="tree-flow-step__badge">2. 말단 판정 ★</span>
        <span class="tree-flow-step__text">끝난 판의 돌 개수를 비교해 +1(승), 0(무), -1(패) 확정</span>
      </div>
      <span class="tree-flow-arrow" aria-hidden="true">→</span>
      <div class="tree-flow-step">
        <span class="tree-flow-step__badge">3. 점수 전달 ↑</span>
        <span class="tree-flow-step__text">MIN은 최솟값, MAX는 최댓값을 위로 전달해 최종 선택</span>
      </div>
    </div>`;

  const rootOmitted = tree.omittedCandidates > 0
    ? `<div class="tree-notice tree-omitted-note"><span class="tree-notice-icon" aria-hidden="true">ℹ️</span>컴퓨터 후보 ${tree.totalCandidates}개 중 점수 높은 대표 ${tree.branches.length}개 표시</div>`
    : "";

  const rootConnector = renderTreeConnector(tree.branches);

  const branchesHtml = tree.branches
    .map((branch) => {
      const hasSubChildren = Boolean(branch.children && branch.children.length > 0);
      const hasMultiple = Boolean(branch.children && branch.children.length > 1);
      const branchClasses = [
        "tree-branch-item",
        branch.isChosen ? "is-chosen-branch" : "",
        hasSubChildren ? "has-children-branch" : "",
        hasMultiple ? "has-branching-branch" : "",
      ].filter(Boolean).join(" ");
      return `<li class="${branchClasses}">${renderTreeNode(branch, 1)}</li>`;
    })
    .join("");

  const rootCompareNote = renderComparisonNote(
    tree.branches.map((branch) => ({ move: branch.move, score: branch.score, isChosen: branch.isChosen })),
    "MAX",
  );

  return `<div class="decision-tree">
      ${flowGuide}
      <div class="tree-scale-controls">
        <button type="button" class="tree-fit-toggle">크게 보기</button>
      </div>
      <div class="tree-scale-wrap">
        <div class="tree-diagram">
          <div class="tree-node tree-node--root is-chosen has-children">
            <div class="tree-node-head">
              <span class="tree-level-tag">루트 · 현재 보드</span>
              <span class="tree-move">지금 게임판 상황</span>
              <span class="tree-turn-badge tree-turn-badge--max">MAX 차례 (컴퓨터)</span>
              <span class="tree-root-goal">최종 판단: 최댓값 선택</span>
            </div>
            <div class="tree-node-body">
              ${renderMiniBoard(tree.board)}
              <div class="tree-node-info">
                <p class="tree-state">컴퓨터가 둘 차례입니다. 비어 있는 자리마다 상대의 최선 대응(패스 포함)을 따져 본 뒤 가장 유리한 자리를 골라냅니다.</p>
              </div>
            </div>
            ${rootOmitted}
          </div>
          ${rootConnector}
          <ul class="tree-children tree-children--root">${branchesHtml}</ul>
          <div class="tree-root-summary">${rootCompareNote}</div>
        </div>
      </div>
    </div>`;
}

function renderCandidateList(candidates) {
  const top = candidates.slice(0, 3);
  return `<ul class="candidate-list">${top
    .map((candidate, rank) => {
      const chosenBadge = rank === 0 ? '<span class="candidate-chosen">선택함 (최선 수)</span>' : "";
      let replyText;
      if (candidate.replyMove === null) {
        replyText = "이 자리에 두면 바로 게임이 끝남";
      } else if (candidate.replyPass) {
        replyText = `상대가 둘 수 없어 패스 → 컴퓨터가 이어서 둘 것으로 예상되는 자리: <strong>${describeMove(candidate.replyMove)}</strong>`;
      } else {
        replyText = `상대의 최선 대응 예상: <strong>${describeMove(candidate.replyMove)}</strong>`;
      }
      const rankBadge = `<span class="candidate-rank">${rank + 1}순위</span>`;
      return `<li class="candidate-item${rank === 0 ? " candidate-item--chosen" : ""}">
        <div class="candidate-head">
          ${rankBadge}
          <strong class="candidate-move">${describeMove(candidate.move)}</strong>
          ${chosenBadge}
          <span class="candidate-outcome candidate-outcome--${candidate.outcome}">${OUTCOME_LABEL[candidate.outcome]}</span>
        </div>
        <p class="candidate-reply">${replyText}</p>
      </li>`;
    })
    .join("")}</ul>`;
}

function renderReview(resultText) {
  const list = $("#review-list");
  list.innerHTML = state.history
    .map((entry) => {
      const tree = buildDecisionTree(entry.boardBefore, COMPUTER, HUMAN, entry.chosenMove);
      return `<li class="review-item">
        <div class="review-item-header">
          <span class="review-move-badge">${entry.moveNumber}번째 컴퓨터 수</span>
          <h3>컴퓨터의 선택: ${describeMove(entry.chosenMove)}</h3>
        </div>
        <p class="review-item-lead">컴퓨터는 둘 수 있는 ${entry.candidates.length}개의 자리를 모두 살펴보고, 각 자리마다 상대가 어떻게 최선으로 대응할지(패스 상황 포함)까지 미리 따져 본 뒤 가장 유리한 자리를 골랐습니다.</p>
        ${renderCandidateList(entry.candidates)}
        <details class="tree-details">
          <summary>Min-Max 의사결정 트리로 보기 <span class="summary-hint">(후보 수 ↓ · 말단 점수 · 값 전달 ↑ · 패스 포함)</span></summary>
          ${renderDecisionTree(tree)}
        </details>
      </li>`;
    })
    .join("");
  $("#review-summary").textContent = state.history.length > 0
    ? `${resultText} 컴퓨터가 둔 ${state.history.length}번의 수를 하나씩 살펴보며, 상대의 최선 대응(패스 포함)까지 내다보고 자리를 고르는 과정을 확인해 보세요. "Min-Max 의사결정 트리로 보기"를 열면 그 판단이 후보 수 → MAX/MIN 차례(또는 패스) → 말단 점수 → 값 전달 → 최종 선택까지 어떻게 만들어지는지 직접 따라갈 수 있습니다.`
    : `${resultText} 이번 게임에서는 컴퓨터가 둘 차례가 없었습니다.`;
  $("#review").hidden = false;
  $("#glossary").hidden = false;
  $("#review-title").focus({ preventScroll: false });
  requestAnimationFrame(() => updateTreeConnectors($("#review")));
}

function restartGame() {
  state.board = createBoard();
  state.current = HUMAN;
  state.over = false;
  state.history = [];
  $("#review").hidden = true;
  $("#glossary").hidden = true;
  setTurnStatus("당신 차례입니다 (흑)");
  renderBoard();
  renderPieceCount();
  $("#board").querySelector(".cell").focus();
}

// 트리는 기본적으로 카드 너비에 맞춰 축소해 구조 전체를 한눈에 보여주고,
// "크게 보기"를 누르면 화면 전체를 덮는 팝업(같은 탭 안 오버레이, 새 창 아님)으로 옮겨
// 훨씬 넓은 너비 기준으로 다시 축소 배율을 계산해 보여준다.
const MIN_TREE_FIT_SCALE = 0.42;

function applyTreeFit(decisionTree) {
  const wrap = decisionTree.querySelector(".tree-scale-wrap");
  const diagram = decisionTree.querySelector(".tree-diagram");
  if (!wrap || !diagram) return;

  diagram.style.transform = "";
  const naturalWidth = diagram.scrollWidth;
  const naturalHeight = diagram.scrollHeight;
  const wrapWidth = wrap.clientWidth || naturalWidth;
  const fitScale = Math.max(MIN_TREE_FIT_SCALE, Math.min(1, wrapWidth / naturalWidth));

  diagram.style.transform = `scale(${fitScale})`;
  diagram.style.transformOrigin = "top left";
  wrap.style.height = `${naturalHeight * fitScale}px`;
  wrap.style.overflowY = "hidden";
  wrap.style.overflowX = fitScale <= MIN_TREE_FIT_SCALE ? "auto" : "hidden";
}

let treeOverlayState = null; // { node, parent, next, trigger }

function openTreeOverlay(decisionTree, trigger) {
  const overlay = $("#tree-overlay");
  const body = $("#tree-overlay-body");
  if (!overlay || !body || treeOverlayState) return;

  const moveBadge = decisionTree.closest(".review-item")?.querySelector(".review-move-badge");
  $("#tree-overlay-title").textContent = moveBadge
    ? `${moveBadge.textContent} · Min-Max 의사결정 트리`
    : "Min-Max 의사결정 트리";

  treeOverlayState = { node: decisionTree, parent: decisionTree.parentNode, next: decisionTree.nextSibling, trigger };
  decisionTree.classList.add("is-in-overlay");
  body.appendChild(decisionTree);
  overlay.hidden = false;
  document.body.classList.add("tree-overlay-open");
  requestAnimationFrame(() => {
    applyTreeFit(decisionTree);
    updateTreeConnectors(decisionTree);
  });
  $("#tree-overlay-close").focus();
}

function closeTreeOverlay() {
  const overlay = $("#tree-overlay");
  if (!overlay || overlay.hidden || !treeOverlayState) return;
  const { node, parent, next, trigger } = treeOverlayState;
  node.classList.remove("is-in-overlay");
  parent.insertBefore(node, next);
  overlay.hidden = true;
  document.body.classList.remove("tree-overlay-open");
  treeOverlayState = null;
  requestAnimationFrame(() => {
    applyTreeFit(node);
    updateTreeConnectors(node);
  });
  if (trigger) trigger.focus();
}

$("#restart-button").addEventListener("click", restartGame);
$("#board").addEventListener("keydown", handleBoardKeydown);

const projectorToggle = $("#projector-toggle");
if (projectorToggle) {
  projectorToggle.addEventListener("click", () => {
    const enabled = document.body.classList.toggle("projector-mode");
    projectorToggle.setAttribute("aria-pressed", String(enabled));
    requestAnimationFrame(() => {
      refitVisibleTrees();
      updateTreeConnectors();
    });
  });
}

function refitVisibleTrees() {
  document.querySelectorAll(".tree-details[open] .decision-tree").forEach((decisionTree) => applyTreeFit(decisionTree));
  if (treeOverlayState) applyTreeFit(treeOverlayState.node);
}

$("#review-list").addEventListener("click", (event) => {
  const opener = event.target.closest(".tree-fit-toggle");
  if (!opener) return;
  const decisionTree = opener.closest(".decision-tree");
  if (decisionTree) openTreeOverlay(decisionTree, opener);
});

const treeOverlay = $("#tree-overlay");
if (treeOverlay) {
  $("#tree-overlay-close").addEventListener("click", closeTreeOverlay);
  treeOverlay.addEventListener("click", (event) => {
    if (event.target === treeOverlay) closeTreeOverlay();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && treeOverlayState) closeTreeOverlay();
});

// "Min-Max 의사결정 트리로 보기"를 펼치는 즉시(추가 클릭 없이) 전체화면 팝업을 띄운다.
// 팝업을 닫으면 트리는 카드 안으로 돌아가고, 그 카드의 "크게 보기" 버튼으로 다시 열 수 있다.
document.addEventListener("toggle", (event) => {
  if (event.target && event.target.classList && event.target.classList.contains("tree-details") && event.target.open) {
    const decisionTree = event.target.querySelector(".decision-tree");
    if (decisionTree) openTreeOverlay(decisionTree, decisionTree.querySelector(".tree-fit-toggle"));
  }
}, true);

window.addEventListener("resize", () => {
  requestAnimationFrame(() => {
    refitVisibleTrees();
    updateTreeConnectors();
  });
});

renderBoard();
renderPieceCount();
