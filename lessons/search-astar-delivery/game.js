import { NODES, nodeLabel, runAStarGraphTrace, runUcsGraphTrace, HEURISTICS } from "../shared/search-graph-lab.js?v=2026090908";
import { renderGraphDiagram, renderListPanel, enableGraphZoom } from "../shared/search-graph-ui.js?v=2026090907";
import {
  buildMapRounds, checkMapPickAnswer, checkMapDupAnswer, summarizeMap, mapPathLabel,
  NEW_GOAL_STATE, NEW_START, solveAstar, checkChoice,
} from "./game-core.js?v=2026090902";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------------------------------------------------------------------
 * 활동 1 · 학교 지도 위 A* 탐색(교과서 예시)
 * 3단계(균일 비용 탐색)와 같은 학교 지도·인터랙션을 그대로 쓰되, g(n) 대신
 * f(n)=g(n)+h(n)이 가장 작은 상태를 고른다.
 * ------------------------------------------------------------------------- */
const NODE_SYMBOLS = { gate: "a", lobby: "b", yard: "c", cafeteria: "d", store: "e" };
const GRAPH_NODES = NODES.map((node) => ({
  ...node,
  label: `${node.label} (${NODE_SYMBOLS[node.id]})`,
  radius: node.id === "lobby" ? 44 : 36,
}));
const LIST_NODES = NODES.map((node) => ({ ...node, label: NODE_SYMBOLS[node.id] }));

// 그래프에서는 h(n)만 노드 안에 항상 보여준다(장소 고유값이라 방문 전에도 이미 아는 값).
// g(n)은 그 상태로 "들어오는 간선" 위에 띄운다 — 그 경로를 밟았을 때 든 비용이라는 뜻을
// 그대로 보여주기 위해서다. 다음 상태를 고르거나 새 후보를 오픈 리스트에 넣는 선택도
// 이제 노드가 아니라 그 간선(원 안의 g 값)을 클릭해서 한다.
const H_LABELS = Object.fromEntries(NODES.map((n) => [n.id, `h=${HEURISTICS[n.id]}`]));

const mapEl = {
  stageLabel: $("#map-stage-label"),
  progressBar: $("#map-progress-bar"),
  stepBadge: $("#map-step-badge"),
  traceView: $("#map-trace-view"),
  traceGraph: $("#map-trace-graph"),
  listPanel: $("#map-list-panel"),
  candidatePrompt: $("#map-candidate-prompt"),
  costChoiceSummary: $("#map-cost-choice-summary"),
  stepFeedback: $("#map-step-feedback"),
  closeAction: $("#map-close-action"),
  childrenReveal: $("#map-children-reveal"),
  dupQuestion: $("#map-dup-question"),
  nextStep: $("#map-next-step"),
  recordBody: $("#map-record-body"),
  summary: $("#map-summary"),
  summaryText: $("#map-summary-text"),
  compare: $("#map-compare"),
  continueButton: $("#map-continue"),
};

const astarTrace = runAStarGraphTrace();
const mapRounds = buildMapRounds(astarTrace);

let mapRoundIndex = 0;
let mapRoundState = null;
// "pick": 오픈 리스트에서 다음에 확장할 상태를 그래프에서 고르는 중.
// "reveal": 새로 발견한 상태(점선 노드)를 클릭해 오픈 리스트에 넣거나, 중복 상태의 두 간선 중
//   하나를 클릭해 오픈 리스트를 갱신하는 중.
// "done": 이번 라운드에서 더 할 일이 없어 "다음 단계"만 누르면 되는 상태.
let mapPhase = "pick";
// 아직 오픈 리스트에 넣지 않은, 그래프에 점선으로 나타난 후보들. id -> { id, g, h, f, parentId, cost }.
let mapPendingCandidates = new Map();
let mapPendingDup = null;
let mapPickAttempts = 0;

function mapPrevClosedFor(index) {
  return index === 0 ? [] : mapRounds[index - 1].closedAfter;
}

function mapTreeEdgesUpTo(roundIndex) {
  const parentOf = new Map();
  for (let i = 0; i < roundIndex; i += 1) {
    for (const child of mapRounds[i].children) {
      if (child.status === "new" || child.status === "open-replace") {
        parentOf.set(child.id, { parentId: mapRounds[i].expandedId, cost: child.cost });
      }
    }
  }
  return parentOf;
}

function initMapRoundState(round) {
  return {
    open: new Map(round.pickCandidates.map((c) => [c.id, { g: c.g, h: c.h, f: c.f }])),
    closed: new Map(mapPrevClosedFor(round.index).map((c) => [c.id, { g: c.g, h: c.h, f: c.f }])),
    parentOf: mapTreeEdgesUpTo(round.index),
  };
}

// 그 상태의 현재 g(n)을 오픈/닫힌 리스트에서 찾는다(어느 쪽에 있는지 모를 때 쓰는 헬퍼).
function currentG(id) {
  return (mapRoundState.open.get(id) || mapRoundState.closed.get(id))?.g;
}

function renderFromMapRoundState({ interactiveIds = null, interactiveVerb, resultMarks = {} } = {}) {
  const visibleIds = NODES.map((n) => n.id);
  const visibleSet = new Set(visibleIds);
  const statesById = {};
  for (const [id] of mapRoundState.closed) statesById[id] = "closed";
  for (const [id] of mapRoundState.open) statesById[id] = "open";
  const interactiveSet = new Set(interactiveIds || []);
  const edgesOverride = [];
  for (const [childId, { parentId, cost }] of mapRoundState.parentOf.entries()) {
    if (!visibleSet.has(childId) || !visibleSet.has(parentId)) continue;
    const g = currentG(childId);
    if (interactiveSet.has(childId)) {
      edgesOverride.push({
        a: parentId, b: childId, displayValue: g, displayText: `${cost}`, pick: true,
        pickLabel: `${nodeLabel(childId)} 간선 값 ${cost}, 누적 g=${g} ${interactiveVerb || "선택하기"}`,
      });
    } else {
      edgesOverride.push({ a: parentId, b: childId, cost: `${cost}` });
    }
  }
  // 정문(시작 상태)처럼 들어오는 간선이 없는 상태는 간선을 그릴 수 없으니 노드 자체를 클릭해 고른다.
  const nodeInteractiveIds = [...interactiveSet].filter((id) => !mapRoundState.parentOf.has(id));
  renderGraphDiagram(mapEl.traceGraph, {
    nodes: GRAPH_NODES,
    statesById,
    gById: H_LABELS,
    metricLabel: "",
    metricVariant: "h",
    visibleIds,
    edgesOverride,
    interactiveIds: nodeInteractiveIds,
    interactiveVerb: interactiveVerb || "선택하기",
    resultMarks,
    label: "지금까지 A* 탐색이 발견한 상태들의 탐색 트리",
  });
  renderListPanel(mapEl.listPanel, {
    nodes: LIST_NODES,
    open: [...mapRoundState.open].map(([id, v]) => ({ id, ...v })),
    closed: [...mapRoundState.closed].map(([id, v]) => ({ id, ...v })),
    format: (entry) => `(g=${entry.g}, f=${entry.f})`,
  });
}

// "reveal" 단계 전용 렌더 — 아직 남은 mapPendingCandidates(점선 노드)와 mapPendingDup(간선 선택지)를
// mapRoundState 위에 겹쳐 그린다.
function renderMapRevealPhase() {
  const candidates = [...mapPendingCandidates.values()];
  const extraEdges = [];
  const committedOverrides = new Map();
  const compareById = {};
  if (mapPendingDup) {
    committedOverrides.set(mapPendingDup.id, {
      choice: "keep",
      choiceLabel: `${nodeLabel(mapPendingDup.id)} 기존 f=${existingDupF(mapPendingDup)} 유지하기`,
      displayValue: mapPendingDup.existingG,
      displayText: `${mapRoundState.parentOf.get(mapPendingDup.id)?.cost}`,
    });
    extraEdges.push({
      a: mapRounds[mapRoundIndex].expandedId,
      b: mapPendingDup.id,
      cost: mapPendingDup.cost,
      displayValue: mapPendingDup.newG,
      pending: true,
      choice: "replace",
      choiceLabel: `${nodeLabel(mapPendingDup.id)} 새 f=${mapPendingDup.newF}으로 갱신하기`,
      displayText: `${mapPendingDup.cost}`,
    });
    compareById[mapPendingDup.id] = {
      existingF: existingDupF(mapPendingDup),
      newF: mapPendingDup.newF,
    };
  }
  const visibleIds = NODES.map((n) => n.id);
  const visibleSet = new Set(visibleIds);
  const statesById = {};
  for (const [id] of mapRoundState.closed) statesById[id] = "closed";
  for (const [id] of mapRoundState.open) statesById[id] = "open";
  for (const c of candidates) statesById[c.id] = "candidate";
  const committedEdges = [...mapRoundState.parentOf.entries()]
    .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
    .map(([childId, { parentId, cost }]) => {
      const override = committedOverrides.get(childId);
      return override ? { a: parentId, b: childId, ...override } : { a: parentId, b: childId, cost: `${cost}` };
    });
  const candidateEdges = candidates
    .filter((c) => visibleSet.has(c.parentId))
    .map((c) => ({
      a: c.parentId, b: c.id, pending: true, pick: true, displayValue: c.g, displayText: `${c.cost}`,
      pickLabel: `${nodeLabel(c.id)} 간선 값 ${c.cost}, 누적 g=${c.g} 오픈 리스트에 추가하기`,
    }));
  renderGraphDiagram(mapEl.traceGraph, {
    nodes: GRAPH_NODES,
    statesById,
    gById: H_LABELS,
    metricLabel: "",
    metricVariant: "h",
    compareById,
    visibleIds,
    edgesOverride: [...committedEdges, ...candidateEdges, ...extraEdges],
    interactiveVerb: "오픈 리스트에 추가하기",
    label: "지금까지 A* 탐색이 발견한 상태들의 탐색 트리. 점선 간선이나 중복 후보의 두 간선을 클릭하세요.",
  });
  renderListPanel(mapEl.listPanel, {
    nodes: LIST_NODES,
    open: [...mapRoundState.open].map(([id, v]) => ({ id, ...v })),
    closed: [...mapRoundState.closed].map(([id, v]) => ({ id, ...v })),
    format: (entry) => `(g=${entry.g}, f=${entry.f})`,
  });
}

function appendMapRecordRow(id, g, h, f) {
  if (mapEl.recordBody.querySelector(".empty-row")) mapEl.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  row.innerHTML = `<th scope="row">${mapEl.recordBody.children.length + 1}</th><td>${nodeLabel(id)}</td><td>${g}</td><td>${h}</td><td>${f}</td>`;
  mapEl.recordBody.appendChild(row);
}

function updateMapStageLabel(round) {
  mapEl.stageLabel.textContent = `단계 ${round.index + 1} / ${mapRounds.length} · A* 탐색`;
  mapEl.progressBar.style.width = `${Math.round(((round.index + 1) / mapRounds.length) * 100)}%`;
  mapEl.stepBadge.textContent = `단계 ${round.index + 1}`;
}

// 중복 상태 후보(mapPendingDup)의 "기존 값" f(n)을 구한다. 오픈 리스트를 교체할지 말지는
// g(n) 비교로 정확히 판단할 수 있지만(같은 장소의 h(n)은 항상 같으므로), 이 활동은 시종일관
// "f(n)이 작은 쪽을 고른다"고 가르치므로 화면에는 g가 아니라 f로 두 값을 비교해서 보여준다.
function existingDupF(dup) {
  return dup.existingG + dup.h;
}

function mapChildRowHtml(child, statusLabel) {
  return `<div class="child-row" data-status="${child.status}"><span>${nodeLabel(child.id)}</span><span>f=${child.newF}</span><span class="child-status">${statusLabel}</span></div>`;
}

function showMapRound(index) {
  mapRoundIndex = index;
  mapPhase = "pick";
  mapPendingCandidates = new Map();
  mapPendingDup = null;
  mapPickAttempts = 0;
  const round = mapRounds[index];
  mapRoundState = initMapRoundState(round);
  updateMapStageLabel(round);
  renderFromMapRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다음 상태로 선택하기" });
  mapEl.stepFeedback.hidden = true;
  mapEl.stepFeedback.className = "step-feedback";
  mapEl.closeAction.hidden = true;
  mapEl.closeAction.innerHTML = "";
  mapEl.childrenReveal.innerHTML = "";
  mapEl.dupQuestion.hidden = true;
  mapEl.dupQuestion.innerHTML = "";
  mapEl.nextStep.hidden = true;

  const comparison = round.pickCandidates.map((candidate) => `${nodeLabel(candidate.id)} g(n)=${candidate.g}, h(n)=${candidate.h}`).join(" · ");
  mapEl.costChoiceSummary.innerHTML = `<span>현재 후보 비교</span><strong>${comparison}</strong><p class="cost-choice-hint">f(n)=g(n)+h(n)을 직접 계산해서 가장 작은 곳을 클릭하세요.</p>`;

  mapEl.candidatePrompt.textContent = round.pickCandidates.length > 1
    ? "그래프에서 f(n)이 가장 작은 간선을 클릭하세요."
    : "오픈 리스트에는 이 상태 하나뿐입니다. 그래프에서 클릭해 확장하세요.";
}

function checkMapRoundComplete() {
  if (mapPendingCandidates.size > 0 || mapPendingDup) return;
  mapPhase = "done";
  mapEl.nextStep.hidden = false;
  mapEl.nextStep.textContent = mapRounds[mapRoundIndex].isGoal ? "지도 탐색 정리 보기 →" : "다음 단계 →";
  mapEl.nextStep.focus();
}

function revealMapChildren(round) {
  mapPhase = "reveal";
  const newChildren = round.children.filter((c) => c.status === "new");
  const closedSkipChildren = round.children.filter((c) => c.status === "closed-skip");
  mapPendingCandidates = new Map(newChildren.map((c) => [c.id, { id: c.id, g: c.newG, h: c.h, f: c.newF, parentId: round.expandedId, cost: c.cost }]));
  mapPendingDup = round.dupChildren[0] || null;

  const hints = [];
  if (mapPendingCandidates.size > 0) hints.push("점선으로 나타난 새 간선을 클릭해 오픈 리스트에 넣으세요.");
  if (mapPendingDup) hints.push(`${nodeLabel(mapPendingDup.id)}로 가는 두 후보 간선 중 f(n)이 더 작은 쪽을 클릭하세요.`);
  mapEl.candidatePrompt.textContent = hints.length ? hints.join(" ") : "새로 바뀔 상태가 없습니다.";

  mapEl.childrenReveal.innerHTML = closedSkipChildren.length
    ? `<p class="children-reveal-hint">${closedSkipChildren.map((c) => `${nodeLabel(c.id)}은(는) 이미 닫힌 리스트에 있어 다시 열지 않습니다.`).join(" ")}</p>`
    : "";
  if (mapPendingDup) {
    mapEl.dupQuestion.hidden = false;
    mapEl.dupQuestion.innerHTML = `<p><strong>${nodeLabel(round.expandedId)}</strong>에서 <strong>${nodeLabel(mapPendingDup.id)}</strong>로 가는 새 경로를 찾았습니다. 기존 f(n)=${existingDupF(mapPendingDup)}와 새 f(n)=${mapPendingDup.newF}를 비교해 더 작은 값을 선택하세요.</p>`;
  }

  renderMapRevealPhase();
  checkMapRoundComplete();
}

function handleAddMapCandidate(id) {
  const candidate = mapPendingCandidates.get(id);
  if (!candidate) return;
  mapRoundState.open.set(id, { g: candidate.g, h: candidate.h, f: candidate.f });
  mapRoundState.parentOf.set(id, { parentId: candidate.parentId, cost: candidate.cost });
  mapPendingCandidates.delete(id);
  renderMapRevealPhase();
  checkMapRoundComplete();
}

function handleMapDupChoice(insertChosen) {
  if (!mapPendingDup) return;
  const round = mapRounds[mapRoundIndex];
  const dup = mapPendingDup;
  const outcome = checkMapDupAnswer(dup, insertChosen);

  if (outcome.shouldInsert) {
    mapRoundState.open.set(dup.id, { g: dup.newG, h: dup.h, f: dup.newF });
    mapRoundState.parentOf.set(dup.id, { parentId: round.expandedId, cost: dup.cost });
  }
  mapPendingDup = null;
  renderMapRevealPhase();

  const existingF = existingDupF(dup);
  mapEl.dupQuestion.innerHTML = `
    <p><strong>${nodeLabel(dup.id)}</strong>의 기존 f(n)=${existingF}와 새 f(n)=${dup.newF}를 비교했습니다.</p>
    <div class="step-feedback ${outcome.correct ? "correct" : "incorrect"}">
      <strong>${outcome.correct ? "맞아요." : "다시 확인해 볼까요."}</strong>
      <p>f(n)을 계산하면 새 값은 ${dup.newG}+${dup.h}=${dup.newF}, 기존 값은 ${dup.existingG}+${dup.h}=${existingF}입니다. ${outcome.shouldInsert
        ? `새 f(n)=${dup.newF}이(가) 기존 f(n)=${existingF}보다 작으므로, 더 작은 값으로 교체해야 합니다.`
        : `새 f(n)=${dup.newF}이(가) 기존 f(n)=${existingF}보다 크거나 같으므로, 기존 값을 그대로 남겨야 합니다.`}</p>
    </div>
  `;
  mapEl.childrenReveal.insertAdjacentHTML("beforeend", mapChildRowHtml(dup, outcome.shouldInsert ? "더 작은 f값으로 갱신됨" : "기존 f값이 더 작아 제외"));
  checkMapRoundComplete();
}

function handleMapPick(clickedId) {
  const round = mapRounds[mapRoundIndex];
  const outcome = checkMapPickAnswer(round, clickedId);
  mapEl.stepFeedback.hidden = false;
  mapEl.stepFeedback.className = "step-feedback";
  if (!outcome.correct) {
    mapPickAttempts += 1;
    mapEl.stepFeedback.classList.add("incorrect");
    mapEl.stepFeedback.innerHTML = mapPickAttempts === 1
      ? `<strong>한 번 더 비교해 보세요.</strong><p>오픈 리스트에 있는 모든 f(n) 중 가장 작은 값을 찾으면 됩니다.</p>`
      : `<strong>힌트</strong><p><b>${round.f}</b>보다 큰 f(n)은 다음 상태가 될 수 없습니다.</p>`;
    renderFromMapRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다시 선택하기", resultMarks: { [clickedId]: "incorrect" } });
    return;
  }

  mapEl.stepFeedback.classList.add("correct");
  mapEl.stepFeedback.innerHTML = `<strong>정답이에요.</strong><p>${nodeLabel(round.expandedId)}의 f(n)=${round.g}+${round.h}=${round.f}이 가장 작으므로 이 상태를 확정합니다.</p>`;
  handleMapClose();
}

function handleMapClose() {
  const round = mapRounds[mapRoundIndex];
  mapRoundState.open.delete(round.expandedId);
  mapRoundState.closed.set(round.expandedId, { g: round.g, h: round.h, f: round.f });
  appendMapRecordRow(round.expandedId, round.g, round.h, round.f);
  mapEl.closeAction.hidden = true;

  if (round.isGoal) {
    mapPhase = "done";
    renderFromMapRoundState();
    mapEl.candidatePrompt.textContent = "목표 상태에 도착했습니다!";
    mapEl.nextStep.hidden = false;
    mapEl.nextStep.textContent = "지도 탐색 정리 보기 →";
    mapEl.nextStep.focus();
  } else {
    revealMapChildren(round);
  }
}

function handleMapGraphActivate(event) {
  if (mapPhase === "pick") {
    // 대부분은 오픈 리스트로 이어지는 간선(g 값 원)을 클릭해서 고른다. 정문처럼 들어오는
    // 간선이 없는 상태만 노드 자체가 .is-pickable이다.
    const pickable = event.target.closest(".is-pickable");
    if (pickable) handleMapPick(pickable.dataset.node);
    return;
  }
  if (mapPhase === "reveal") {
    const edgeChoice = event.target.closest(".graph-edge-choice[data-choice]");
    if (edgeChoice) {
      handleMapDupChoice(edgeChoice.dataset.choice === "replace");
      return;
    }
    // 새로 발견한 후보는 노드가 아니라 그 후보로 이어지는 점선 간선(g 값 원)을 클릭해서 넣는다.
    const pickable = event.target.closest(".is-pickable");
    if (pickable) handleAddMapCandidate(pickable.dataset.node);
  }
}

mapEl.traceGraph.addEventListener("click", handleMapGraphActivate);
mapEl.traceGraph.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (!event.target.closest(".is-pickable")) return;
  event.preventDefault();
  handleMapGraphActivate(event);
});

mapEl.nextStep.addEventListener("click", () => {
  const round = mapRounds[mapRoundIndex];
  if (round.isGoal) {
    finishMapTrace();
    return;
  }
  showMapRound(mapRoundIndex + 1);
});

function renderMapSummary() {
  const summary = summarizeMap({ astarTrace, ucsTrace: runUcsGraphTrace() });
  mapEl.summaryText.textContent = `A* 탐색은 ${mapPathLabel(summary.path)} 경로(비용 ${summary.pathCost})를 찾는 데 ${summary.astarTested}개 상태만 확인했습니다. 3단계의 균일 비용 탐색은 같은 지도에서 같은 경로를 찾는 데 ${summary.ucsTested}개 상태를 확인했습니다. 목표까지 남은 거리를 어림잡은 h(n) 덕분에 ${summary.saved}개 상태를 더 적게 확인한 것입니다.`;
  mapEl.compare.innerHTML = `
    <div class="stat-block"><span>3단계 균일 비용 탐색이 확인한 상태 수</span><strong>${summary.ucsTested}개</strong></div>
    <div class="stat-block"><span>이번 A* 탐색이 확인한 상태 수</span><strong>${summary.astarTested}개</strong></div>
    <div class="stat-block"><span>덜 확인한 상태 수</span><strong>${summary.saved}개</strong></div>
  `;
}

function finishMapTrace() {
  mapEl.traceView.hidden = true;
  mapEl.summary.hidden = false;
  renderMapSummary();
  mapEl.summary.querySelector("h3").focus();
}

mapEl.continueButton.addEventListener("click", () => showView("new"));

/* ---------------------------------------------------------------------------
 * 활동 2 · 8-퍼즐 A* 탐색(새 문제 연습)
 * ------------------------------------------------------------------------- */
const puzzle = {
  start: NEW_START,
  goal: NEW_GOAL_STATE,
  result: solveAstar(NEW_START, NEW_GOAL_STATE),
  step: 0,
  correct: 0,
  answered: false,
  calcVerified: false,
  lastPicked: null,
};

function boardMarkup(board, label = "퍼즐판") {
  return `<div class="puzzle-board" role="img" aria-label="${label}: ${board.map((v) => v || "빈칸").join(", ")}">${board.map((tile) => `<span class="tile${tile === 0 ? " blank" : ""}">${tile || '<i aria-hidden="true">빈칸</i>'}</span>`).join("")}</div>`;
}

function renderPuzzleReference() {
  const root = $('[data-reference="new"]');
  root.innerHTML = `
    <article><span>초기 상태</span>${boardMarkup(puzzle.start, "초기 상태")}</article>
    <div class="reference-arrow" aria-hidden="true">→</div>
    <article><span>목표 상태</span>${boardMarkup(puzzle.goal, "목표 상태")}</article>`;
}

function puzzleSteps() {
  return puzzle.result.steps.slice(1);
}

function practiceCandidatesMarkup(step, currentKey) {
  const indexed = step.candidates.map((candidate, index) => ({ candidate, index }));
  const waiting = indexed.filter(({ candidate }) => candidate.parentKey !== currentKey);
  const created = indexed.filter(({ candidate }) => candidate.parentKey === currentKey);
  const renderGroup = (items, type) => {
    if (!items.length) return "";
    const waitingGroup = type === "waiting";
    return `<section class="candidate-group ${type}" aria-labelledby="${type}-candidates-title">
      <div class="candidate-group-heading">
        <span class="origin-badge">${waitingGroup ? "이전 후보" : "새 후보"}</span>
        <div><h4 id="${type}-candidates-title">${waitingGroup ? "이전 단계부터 기다리던 후보" : "현재 상태에서 새로 만든 후보"}</h4><p>${waitingGroup ? "앞 단계에서 선택되지 않아 오픈 리스트에 남아 있었습니다." : "현재 상태의 빈칸을 움직여 이번 단계에 추가했습니다."}</p></div>
      </div>
      <div class="candidate-grid">
        ${items.map(({ candidate, index }) => `<article class="candidate-card candidate-entry" data-key="${candidate.key}">
          <span class="candidate-number">후보 ${index + 1}</span>
          <span class="saved-state-mark ${waitingGroup ? "saved" : "added"}">${waitingGroup ? "✓ 오픈 리스트에 저장됨" : "+ 이번 단계에 추가됨"}</span>
          ${boardMarkup(candidate.board, `후보 ${index + 1}`)}
          ${waitingGroup
            ? `<dl class="saved-metrics" aria-label="후보 ${index + 1}에 저장된 값"><div><dt>g(n)</dt><dd>${candidate.g}</dd></div><div><dt>h(n)</dt><dd>${candidate.h}</dd></div><div><dt>f(n)</dt><dd>${candidate.f}</dd></div></dl>`
            : `<div class="metric-inputs">
                <label class="given-metric"><span>g(n)</span><output aria-label="후보 ${index + 1}에 주어진 g(n) 값">${candidate.g}</output></label>
                ${["h", "f"].map((metric) => `<label><span>${metric}(n)</span><input type="number" inputmode="numeric" min="0" max="30" data-candidate-index="${index}" data-metric="${metric}" aria-label="후보 ${index + 1}의 ${metric} 값" ${puzzle.calcVerified ? `value="${candidate[metric]}" disabled` : ""} required></label>`).join("")}
              </div>`}
          ${puzzle.calcVerified ? `<button type="button" class="candidate-select" data-key="${candidate.key}" ${puzzle.answered ? "disabled" : ""}>이 상태 선택</button>` : ""}
        </article>`).join("")}
      </div>
    </section>`;
  };
  return `<form class="candidate-calculation">
    <aside class="open-list-guide"><strong>한 줄에 있는 두 구역 모두 오픈 리스트입니다.</strong> 새 후보의 값을 계산한 뒤, 이전 후보와 새 후보를 합쳐 f(n)이 가장 작은 상태를 선택하세요.</aside>
    <div class="candidate-groups-row" aria-label="이전 후보와 새 후보 전체">
      ${renderGroup(waiting, "waiting")}
      ${renderGroup(created, "created")}
    </div>
    ${puzzle.calcVerified ? '<p class="calculation-status">새 후보의 값이 모두 맞았습니다. 이전 후보까지 포함하여 f(n)이 가장 작은 상태를 선택하세요.</p>' : '<button type="submit" class="check-candidate-values">값 확인하기</button>'}
  </form>`;
}

function renderPuzzleTrace() {
  const root = $('[data-activity="new"]');
  const steps = puzzleSteps();
  const step = steps[puzzle.step];
  const current = puzzle.result.steps[puzzle.step].chosen;
  const isLast = puzzle.step === steps.length - 1;
  if (!step) return;

  root.innerHTML = `
    <div class="trace-heading">
      <div><span>새 문제</span><strong>선택 ${puzzle.step + 1} / ${steps.length}</strong></div>
      <div class="progress" aria-hidden="true"><i style="width:${Math.round(((puzzle.step + 1) / steps.length) * 100)}%"></i></div>
    </div>
    <div class="current-state">
      <div><span>현재 확인한 상태</span>${boardMarkup(current.board, "현재 확인한 상태")}</div>
      <div class="current-info">
        <p>${current.move === "시작" ? "초기 상태입니다." : `빈칸을 <b>${current.move}</b>로 움직여 도착했습니다.`}</p>
        <dl class="current-metrics" aria-label="현재 상태의 g(n), h(n), f(n) 값">
          <div><dt>g(n)</dt><dd>${current.g}</dd></div>
          <i aria-hidden="true">+</i>
          <div><dt>h(n)</dt><dd>${current.h}</dd></div>
          <i aria-hidden="true">=</i>
          <div class="metric-f"><dt>f(n)</dt><dd>${current.f}</dd></div>
        </dl>
      </div>
    </div>
    <div class="candidate-area">
      <div class="candidate-heading"><h3>${!puzzle.calcVerified ? "주어진 g(n)을 보고 h(n), f(n)을 계산하세요" : "후보 중 다음에 확인할 상태는?"}</h3><p>${puzzle.calcVerified ? "f(n)이 가장 작은 후보를 선택하세요." : "값을 모두 맞히면 상태를 선택할 수 있습니다."}</p></div>
      ${practiceCandidatesMarkup(step, current.key)}
    </div>
    <div class="trace-feedback" aria-live="polite" ${puzzle.answered ? "" : "hidden"}></div>
    <button class="primary-action trace-next" type="button" ${puzzle.answered ? "" : "hidden"}>${isLast ? "활동 정리하기" : "다음 선택으로"} <span aria-hidden="true">→</span></button>`;

  if (puzzle.answered) showStoredFeedback();
}

function showStoredFeedback() {
  const root = $('[data-activity="new"]');
  const step = puzzleSteps()[puzzle.step];
  const picked = puzzle.lastPicked;
  const feedback = $(".trace-feedback", root);
  if (!feedback || !picked) return;
  const correct = picked === step.chosenKey;
  $$(".candidate-card", root).forEach((card) => {
    if (card.dataset.key === step.chosenKey) card.classList.add("correct");
    if (card.dataset.key === picked && !correct) card.classList.add("incorrect");
  });
  feedback.hidden = false;
  feedback.className = `trace-feedback ${correct ? "correct" : "incorrect"}`;
  feedback.innerHTML = correct
    ? `<strong>맞았습니다.</strong> f(n)=${step.chosen.f}로 가장 작은 상태입니다.`
    : `<strong>확인해 봅시다.</strong> 다음 상태는 f(n)=${step.chosen.g}+${step.chosen.h}=${step.chosen.f}인 퍼즐판입니다.`;
}

function choosePuzzleCandidate(key) {
  if (puzzle.answered) return;
  const step = puzzleSteps()[puzzle.step];
  const outcome = checkChoice(step, key);
  puzzle.answered = true;
  puzzle.lastPicked = key;
  if (outcome.correct) puzzle.correct += 1;
  renderPuzzleTrace();
  $(".trace-next", $('[data-activity="new"]')).focus();
}

function advancePuzzleTrace() {
  const steps = puzzleSteps();
  if (puzzle.step < steps.length - 1) {
    puzzle.step += 1;
    puzzle.answered = false;
    puzzle.calcVerified = false;
    puzzle.lastPicked = null;
    renderPuzzleTrace();
    $('[data-activity="new"]').scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } else {
    showView("result");
  }
}

/* ---------------------------------------------------------------------------
 * 공통: 단계 이동, 정리 화면, 다시 하기
 * ------------------------------------------------------------------------- */
function showView(name) {
  $$(".lesson-view").forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  $$(".stage-nav button").forEach((button) => {
    button.toggleAttribute("aria-current", button.dataset.view === name);
  });
  if (name === "result") renderResult();
  const heading = $(`#${name}-view h2`);
  heading?.focus();
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
}

function renderResult() {
  const summary = summarizeMap({ astarTrace, ucsTrace: runUcsGraphTrace() });
  const puzzleTotal = puzzleSteps().length;
  $("#score-summary").innerHTML = `
    <article><span>지도 예시: A* vs 3단계 균일 비용 탐색</span><strong>${summary.astarTested} / ${summary.ucsTested}개 상태</strong><p>같은 경로(비용 ${summary.pathCost})를 ${summary.saved}개 더 적게 확인했습니다</p></article>
    <article><span>새 문제(8-퍼즐)</span><strong>${puzzle.correct} / ${puzzleTotal}</strong><p>목표까지 ${puzzle.result.cost}번 이동</p></article>`;
}

function resetAll() {
  Object.assign(puzzle, { step: 0, correct: 0, answered: false, calcVerified: false, lastPicked: null });
  renderPuzzleTrace();
  mapEl.traceView.hidden = false;
  mapEl.summary.hidden = true;
  showMapRound(0);
  $("#warmup-form").reset();
  $("#warmup-form").classList.remove("correct", "incorrect");
  $$("#warmup-form input, #warmup-form button").forEach((control) => { control.disabled = false; });
  $("#warmup-feedback").hidden = true;
  const start = $("#start-textbook");
  start.disabled = true;
  start.textContent = "계산 연습 후 시작할 수 있습니다";
  showView("intro");
}

const HEURISTIC_EDGES = NODES.filter((node) => node.id !== "store")
  .map((node) => ({ a: node.id, b: "store", cost: HEURISTICS[node.id] }));
renderGraphDiagram($("#intro-heuristic-graph"), {
  nodes: GRAPH_NODES,
  edgesOverride: HEURISTIC_EDGES,
  label: "학교 지도의 각 장소에서 매점으로 이어지는 선 위에 어림값 h(n)을 표시한 그림",
});
enableGraphZoom($("#intro-heuristic-graph"), document.querySelector('[data-zoom-for="intro-heuristic-graph"]'));

renderPuzzleReference();
renderPuzzleTrace();
showMapRound(0);

enableGraphZoom(mapEl.traceGraph, document.querySelector('[data-zoom-for="map-trace-graph"]'));

document.addEventListener("click", (event) => {
  const nav = event.target.closest(".stage-nav button[data-view]");
  if (nav && !nav.disabled) return showView(nav.dataset.view);
  const next = event.target.closest("[data-next]");
  if (next) return showView(next.dataset.next);
  const candidate = event.target.closest("button.candidate-card, .candidate-select");
  if (candidate) return choosePuzzleCandidate(candidate.dataset.key);
  const traceNext = event.target.closest(".trace-next");
  if (traceNext) return advancePuzzleTrace();
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest(".candidate-calculation");
  if (!form) return;
  event.preventDefault();
  const step = puzzleSteps()[puzzle.step];
  let wrongCount = 0;
  $$("input[data-candidate-index]", form).forEach((input) => {
    const candidate = step.candidates[Number(input.dataset.candidateIndex)];
    const correct = Number(input.value) === candidate[input.dataset.metric];
    input.classList.toggle("input-correct", correct);
    input.classList.toggle("input-incorrect", !correct);
    input.setAttribute("aria-invalid", String(!correct));
    if (!correct) wrongCount += 1;
  });
  const feedback = $(".trace-feedback", form.closest("[data-activity]"));
  feedback.hidden = false;
  if (wrongCount === 0) {
    puzzle.calcVerified = true;
    renderPuzzleTrace();
    $(".candidate-select", form.closest("[data-activity]"))?.focus();
  } else {
    feedback.className = "trace-feedback incorrect";
    feedback.innerHTML = `<strong>${wrongCount}개의 값을 다시 확인하세요.</strong> h(n)은 이 8-퍼즐에서 제자리가 아닌 숫자 타일 수이며, f(n)은 주어진 g(n)에 h(n)을 더한 값입니다.`;
    $("input.input-incorrect", form)?.focus();
  }
});

$("#warmup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const hInput = $("#warmup-h");
  const fInput = $("#warmup-f");
  const correct = Number(hInput.value) === 10 && Number(fInput.value) === 10;
  const form = event.currentTarget;
  form.classList.remove("correct", "incorrect");
  form.classList.add(correct ? "correct" : "incorrect");
  const feedback = $("#warmup-feedback");
  feedback.hidden = false;
  feedback.className = `trace-feedback ${correct ? "correct" : "incorrect"}`;
  if (correct) {
    feedback.innerHTML = "<strong>맞았습니다.</strong> 정문에서 매점까지의 어림값은 10이므로 h(n)=10이고, f(n)=g(n)+h(n)=0+10=10입니다.";
    $$("#warmup-form input, #warmup-form button").forEach((control) => { control.disabled = true; });
    const start = $("#start-textbook");
    start.disabled = false;
    start.innerHTML = '교과서 예시 시작하기 <span aria-hidden="true">→</span>';
    start.focus();
  } else {
    feedback.innerHTML = "<strong>다시 계산해 보세요.</strong> 위 표에서 정문의 어림값을 확인한 뒤, 그 h(n) 값에 주어진 g(n)=0을 더하세요.";
    hInput.focus();
  }
});

$("#restart-button").addEventListener("click", resetAll);

const previewStep = new URLSearchParams(window.location.search).get("preview");
const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (isLocalPreview && previewStep === "3") showView("new");
// ?preview=practice 또는 ?preview=broken이면, 지도 라운드를 처음부터 끝까지 다 풀지 않아도
// 바로 그 섹션을 볼 수 있게 "교과서 예시" 탭으로만 옮겨 둔다(실제로 열고 시작하는 것은
// practice.js/broken-demo.js가 각자 같은 preview 값을 보고 스스로 처리한다).
if (isLocalPreview && (previewStep === "practice" || previewStep === "broken")) showView("textbook");
