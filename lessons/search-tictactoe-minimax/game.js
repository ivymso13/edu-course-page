import { HUMAN, COMPUTER, createBoard, getAvailableMoves, getGameStatus, evaluateMoves, buildDecisionTree } from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const ROW_LABEL = ["1행", "2행", "3행"];
const COL_LABEL = ["1열", "2열", "3열"];
const OUTCOME_LABEL = { win: "컴퓨터가 유리해짐", draw: "무승부로 이어짐", lose: "상대가 유리해짐" };

const state = {
  board: createBoard(),
  current: HUMAN,
  over: false,
  history: [],
  scores: { win: 0, draw: 0, lose: 0 },
};

function cellLabel(index, mark) {
  const position = `${ROW_LABEL[Math.floor(index / 3)]} ${COL_LABEL[index % 3]}`;
  if (mark === HUMAN) return `${position}, 나(X) 표시`;
  if (mark === COMPUTER) return `${position}, 컴퓨터(O) 표시`;
  return `${position}, 비어 있음`;
}

function renderBoard() {
  const board = $("#board");
  board.innerHTML = state.board
    .map((mark, index) => {
      const disabled = state.over || mark !== null ? "disabled" : "";
      return `<button type="button" class="cell${mark ? ` cell--${mark === HUMAN ? "x" : "o"}` : ""}" data-index="${index}" aria-label="${cellLabel(index, mark)}" ${disabled}>${mark ?? ""}</button>`;
    })
    .join("");
  board.querySelectorAll(".cell").forEach((button) => {
    button.addEventListener("click", () => handleCellActivate(Number(button.dataset.index)));
  });
}

function handleBoardKeydown(event) {
  const cells = Array.from($("#board").querySelectorAll(".cell"));
  const focused = document.activeElement;
  const currentIndex = cells.indexOf(focused);
  if (currentIndex === -1) return;
  const row = Math.floor(currentIndex / 3);
  const col = currentIndex % 3;
  let nextIndex = null;
  if (event.key === "ArrowRight") nextIndex = row * 3 + ((col + 1) % 3);
  else if (event.key === "ArrowLeft") nextIndex = row * 3 + ((col + 2) % 3);
  else if (event.key === "ArrowDown") nextIndex = ((row + 1) % 3) * 3 + col;
  else if (event.key === "ArrowUp") nextIndex = ((row + 2) % 3) * 3 + col;
  if (nextIndex !== null) {
    event.preventDefault();
    cells[nextIndex].focus();
  }
}

function setTurnStatus(text) {
  $("#turn-status").textContent = text;
}

function handleCellActivate(index) {
  if (state.over || state.current !== HUMAN || state.board[index] !== null) return;
  state.board[index] = HUMAN;
  renderBoard();
  const status = getGameStatus(state.board);
  if (status.isOver) {
    endGame(status);
    return;
  }
  state.current = COMPUTER;
  setTurnStatus("컴퓨터가 생각하는 중입니다…");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
  window.setTimeout(runComputerTurn, delay);
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
  state.board[chosen.move] = COMPUTER;
  renderBoard();
  const status = getGameStatus(state.board);
  if (status.isOver) {
    endGame(status);
    return;
  }
  state.current = HUMAN;
  setTurnStatus("당신 차례입니다 (X)");
  const firstOpenCell = $("#board").querySelector(".cell:not([disabled])");
  if (firstOpenCell) firstOpenCell.focus();
}

function endGame(status) {
  state.over = true;
  renderBoard();
  let resultText;
  if (status.winner === HUMAN) {
    state.scores.win += 1;
    resultText = "축하합니다! 이번 판은 당신이 이겼습니다.";
  } else if (status.winner === COMPUTER) {
    state.scores.lose += 1;
    resultText = "컴퓨터가 이겼습니다.";
  } else {
    state.scores.draw += 1;
    resultText = "무승부입니다.";
  }
  $("#score-win").textContent = String(state.scores.win);
  $("#score-draw").textContent = String(state.scores.draw);
  $("#score-lose").textContent = String(state.scores.lose);
  setTurnStatus(resultText);
  renderReview(resultText);
}

function describeMove(index) {
  return `${ROW_LABEL[Math.floor(index / 3)]} ${COL_LABEL[index % 3]}`;
}

function scoreLabel(score) {
  return score > 0 ? "+1" : score < 0 ? "-1" : "0";
}

function scoreBadgeClass(score) {
  return score > 0 ? "tree-score--win" : score < 0 ? "tree-score--lose" : "tree-score--draw";
}

function renderMiniBoard(board) {
  const cells = board
    .map((mark) => `<span class="mini-cell${mark ? ` mini-cell--${mark === HUMAN ? "x" : "o"}` : ""}">${mark ?? ""}</span>`)
    .join("");
  return `<div class="mini-board" aria-hidden="true">${cells}</div>`;
}

// MAX/MIN이 형제 후보들 중에서 값을 골라 자기 자리의 값으로 삼는 과정을 문장으로 보여준다.
function renderComparisonNote(items, turnLabel) {
  if (items.length === 0) return "";
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

  // 복수 자식: 부모 중앙(50, 0)에서 분기점(50, midY)을 거쳐 각 자식 중앙(childX, height)으로 연결
  const items = children.map((child, index) => {
    const childX = Number((((index + 0.5) / count) * 100).toFixed(2));
    const isChosen = Boolean(child.isChosen);
    const edgeClass = isChosen ? "tree-edge tree-edge--chosen" : "tree-edge tree-edge--alt";
    const d = `M 50 0 L 50 ${midY} L ${childX} ${midY} L ${childX} ${height}`;
    return { isChosen, childX, edgeClass, d };
  });

  // 대안 가지를 먼저 그리고, 선택된 가지(굵은 강조선)를 위에 렌더링
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

// 실제 렌더링된 DOM 좌표(getBoundingClientRect)를 측정해 부모 카드 중심에서 자식 카드 중심으로
// 오차 없이 정확히 연결되도록 SVG 간선 좌표 및 점수 역전파 화살표 크기/위치를 보정한다.
export function updateTreeConnectors(container = document) {
  const diagrams = container.querySelectorAll(".tree-diagram");
  diagrams.forEach((diagram) => {
    // 1. 루트 간선
    const rootNode = diagram.querySelector(":scope > .tree-node--root");
    const rootSvg = diagram.querySelector(":scope > .tree-connector-svg");
    const rootChildrenList = diagram.querySelector(":scope > .tree-children--root");
    if (rootNode && rootSvg && rootChildrenList) {
      updateConnectorGeometry(rootNode, rootSvg, rootChildrenList);
    }

    // 2. 하위 가지 간선들
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

  // SVG viewBox(0 0 100 36)와 preserveAspectRatio="none"으로 인한 가로 비대칭 스케일을 상쇄해 화살표가 찌그러지지 않고 원형을 유지하게 함
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

  // 복수 자식: 부모 중심 -> 수평 분기 -> 각 자식 중심
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

function renderTreeNode(node, level = 1) {
  const moverText = node.movedBy === COMPUTER ? "컴퓨터(O)" : "상대(X)";
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

  // 비교 노트: 실제 복수 후보가 존재하는 분기점에서만 표시 (단일 수 연속 진행선에는 중복 배치하지 않음)
  const compareNote = !node.terminal && node.children && node.children.length > 1
    ? renderComparisonNote(
        node.children.map((child) => ({ move: child.move, score: child.score, isChosen: child.isChosen })),
        node.nextTurn === COMPUTER ? "MAX" : "MIN",
      )
    : "";

  const hasChildren = Boolean(node.children && node.children.length > 0);
  const connectorHtml = hasChildren ? renderTreeConnector(node.children) : "";

  const childrenHtml = hasChildren
    ? `<ul class="tree-children">${node.children.map((child) => {
        const hasSubChildren = Boolean(child.children && child.children.length > 0);
        const hasMultiple = Boolean(child.children && child.children.length > 1);
        const branchClasses = [
          "tree-branch-item",
          child.isChosen ? "is-chosen-branch" : "",
          hasSubChildren ? "has-children-branch" : "",
          hasMultiple ? "has-branching-branch" : "",
        ].filter(Boolean).join(" ");
        return `<li class="${branchClasses}">${renderTreeNode(child, level + 1)}</li>`;
      }).join("")}</ul>`
    : "";

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

// 지금 보드에서 컴퓨터의 선택이 만들어지는 과정을, 실제 로직과 같은 값으로 구성된
// 제한된 깊이의 Min-Max 의사결정 트리로 보여준다(전체 트리 대신 대표 가지만 표시).
function renderDecisionTree(tree) {
  const flowGuide = `<div class="tree-flow-guide" aria-label="의사결정 트리 읽는 순서">
      <div class="tree-flow-step">
        <span class="tree-flow-step__badge">1. 후보 탐색 ↓</span>
        <span class="tree-flow-step__text">위에서 아래로 가능한 수를 순차적으로 확장</span>
      </div>
      <span class="tree-flow-arrow" aria-hidden="true">→</span>
      <div class="tree-flow-step">
        <span class="tree-flow-step__badge">2. 말단 판정 ★</span>
        <span class="tree-flow-step__text">끝난 판에서 +1(승), 0(무), -1(패) 확정</span>
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
                <p class="tree-state">컴퓨터가 둘 차례입니다. 비어 있는 칸마다 상대의 최선 대응을 따져 본 뒤 가장 유리한 수를 골라냅니다.</p>
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

// 트리 전체 구조가 한눈에 들어오도록, 트리가 놓인 컨테이너(카드 내부 또는 전체화면 팝업)
// 너비에 맞춰 항상 축소 배율을 다시 계산해 적용한다.
// (닫힌 <details> 안에서는 레이아웃 크기를 잴 수 없으므로, 보이는 상태일 때만 호출해야 한다.)
const MIN_TREE_FIT_SCALE = 0.42;

function applyTreeFit(decisionTree) {
  const wrap = decisionTree.querySelector(".tree-scale-wrap");
  const diagram = decisionTree.querySelector(".tree-diagram");
  if (!wrap || !diagram) return;

  // 배율을 적용하기 전에 원래(축소되지 않은) 크기를 측정해야 한다.
  diagram.style.transform = "";
  const naturalWidth = diagram.scrollWidth;
  const naturalHeight = diagram.scrollHeight;
  const wrapWidth = wrap.clientWidth || naturalWidth;
  const fitScale = Math.max(MIN_TREE_FIT_SCALE, Math.min(1, wrapWidth / naturalWidth));

  diagram.style.transform = `scale(${fitScale})`;
  // top left 기준으로 축소해야, 컨테이너보다 넓어 auto-margin이 0으로 접히는 좁은 화면에서도
  // 왼쪽 끝부터 정확히 채워지고(중앙 기준이면 잘린 것처럼 오른쪽으로 밀려 보임), 여유가 있는
  // 화면에서는 기존 margin:auto 중앙 정렬이 그대로 유지된다.
  diagram.style.transformOrigin = "top left";
  wrap.style.height = `${naturalHeight * fitScale}px`;
  wrap.style.overflowY = "hidden";
  // 최소 배율까지 줄여도 다 안 들어오면(팝업 안에서도 매우 깊은 트리 등), 가로 스크롤을 허용해 잘리지 않게 한다.
  wrap.style.overflowX = fitScale <= MIN_TREE_FIT_SCALE ? "auto" : "hidden";
}

// "크게 보기"를 누른 트리 하나를 화면 전체를 덮는 팝업으로 옮겨 보여준다(새 창이 아니라
// 같은 탭 안의 오버레이). 팝업 안에서도 같은 축소 로직을 더 넓은 너비 기준으로 다시 적용한다.
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

function renderCandidateList(candidates) {
  const top = candidates.slice(0, 3);
  return `<ul class="candidate-list">${top
    .map((candidate, rank) => {
      const chosenBadge = rank === 0 ? '<span class="candidate-chosen">선택함 (최선 수)</span>' : "";
      const replyText = candidate.humanReply !== null
        ? `상대의 최선 대응 예상: <strong>${describeMove(candidate.humanReply)}</strong>`
        : "이 수를 두면 바로 게임이 끝남";
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
        <p class="review-item-lead">컴퓨터는 둘 수 있는 ${entry.candidates.length}개의 수를 모두 살펴보고, 각 수마다 상대가 어떻게 최선으로 대응할지까지 미리 따져 본 뒤 가장 유리한 수를 골랐습니다.</p>
        ${renderCandidateList(entry.candidates)}
        <details class="tree-details">
          <summary>Min-Max 의사결정 트리로 보기 <span class="summary-hint">(후보 탐색 ↓ · 말단 점수 · 값 전달 ↑)</span></summary>
          ${renderDecisionTree(tree)}
        </details>
      </li>`;
    })
    .join("");
  $("#review-summary").textContent = state.history.length > 0
    ? `${resultText} 컴퓨터가 둔 ${state.history.length}번의 수를 하나씩 살펴보며, 상대의 최선 대응까지 내다보고 수를 고르는 과정을 확인해 보세요. "Min-Max 의사결정 트리로 보기"를 열면 그 판단이 후보 수 → MAX/MIN 차례 → 말단 점수 → 값 전달 → 최종 선택까지 어떻게 만들어지는지 직접 따라갈 수 있습니다.`
    : `${resultText} 이번 게임에서는 컴퓨터가 둘 차례가 없었습니다.`;
  $("#review").hidden = false;
  $("#glossary").hidden = false;
  $("#review-title").focus({ preventScroll: false });
  // 트리가 렌더링된 후 SVG 간선 위치를 실제 DOM 배치에 맞게 보정
  requestAnimationFrame(() => updateTreeConnectors($("#review")));
}

function restartGame() {
  state.board = createBoard();
  state.current = HUMAN;
  state.over = false;
  state.history = [];
  $("#review").hidden = true;
  $("#glossary").hidden = true;
  setTurnStatus("당신 차례입니다 (X)");
  renderBoard();
  $("#board").querySelector(".cell").focus();
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

// 지금 화면에 보이는 모든 트리(열려 있는 복기 항목 안 + 전체화면 팝업 안)의 축소 배율을
// 다시 계산해 적용한다. 닫힌 <details> 안의 트리는 크기를 잴 수 없으므로 건드리지 않는다.
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
