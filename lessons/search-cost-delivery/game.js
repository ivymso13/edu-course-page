import { runUcsGraphTrace, nodeLabel, NODES } from "../shared/search-graph-lab.js?v=2026082401";
import { renderGraphDiagram, renderListPanel, enableGraphZoom } from "../shared/search-graph-ui.js?v=2026090401";
import { buildRounds, checkPickAnswer, checkDupAnswer, summarize, pathLabel, FEWER_HOPS_PATH } from "./game-core.js?v=2026082401";

const $ = (selector) => document.querySelector(selector);
const el = {
  humanChallenge: $("#human-challenge"),
  commuteAnswer: $("#commute-answer"),
  commuteCost: $("#commute-cost"),
  commuteFeedback: $("#commute-feedback"),
  continueToUcs: $("#continue-to-ucs"),
  complexChallenge: $("#complex-challenge"),
  complexGraph: $("#complex-graph"),
  complexAnswer: $("#complex-answer"),
  complexCost: $("#complex-cost"),
  complexFeedback: $("#complex-feedback"),
  startComputerMethod: $("#start-computer-method"),
  methodTransition: $("#method-transition"),
  beginUcsProblem: $("#begin-ucs-problem"),
  costProgress: $("#cost-progress"),
  ucsConcept: $("#ucs-concept"),
  predictGraph: $("#predict-graph"),
  startUcsButton: $("#start-ucs-button"),
  predictView: $("#predict-view"),
  experiment: $("#experiment"),
  stageLabel: $("#stage-label"),
  progressBar: $("#progress-bar"),
  stepBadge: $("#step-badge"),
  stepInstruction: $("#step-instruction"),
  traceGraph: $("#trace-graph"),
  listPanel: $("#list-panel"),
  candidatePrompt: $("#candidate-prompt"),
  costChoiceSummary: $("#cost-choice-summary"),
  nextStep: $("#next-step"),
  stepFeedback: $("#step-feedback"),
  closeAction: $("#close-action"),
  childrenReveal: $("#children-reveal"),
  dupQuestion: $("#dup-question"),
  recordBody: $("#record-body"),
  traceView: $("#trace-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  resultsGraph: $("#results-graph"),
  costCompare: $("#cost-compare"),
  restartButton: $("#restart-button"),
  projectorToggle: $("#projector-toggle"),
  practiceView: $("#practice-view"),
  showPracticeButton: $("#show-practice-button"),
};

const trace = runUcsGraphTrace();
const rounds = buildRounds(trace);
const NODE_SYMBOLS = { gate: "a", lobby: "b", yard: "c", cafeteria: "d", store: "e" };
const GRAPH_NODES = NODES.map((node) => ({
  ...node,
  label: `${node.label} (${NODE_SYMBOLS[node.id]})`,
  radius: node.id === "lobby" ? 44 : 36,
}));
const LIST_NODES = NODES.map((node) => ({ ...node, label: NODE_SYMBOLS[node.id] }));

let currentRoundIndex = 0;
let roundState = null;
// "pick": 오픈 리스트에서 다음에 확장할 상태를 그래프에서 고르는 중.
// "close": 방금 고른 상태를 다시 클릭해 닫힌 리스트로 옮기는 중.
// "reveal": 새로 발견한 상태(점선 노드)를 클릭해 오픈 리스트에 넣거나, 중복 상태의 두 간선 중
//   하나를 클릭해 오픈 리스트를 갱신하는 중. 이 둘은 한 라운드 안에서 동시에 열려 있을 수 있다.
// "done": 이번 라운드에서 더 할 일이 없어 "다음 단계"만 누르면 되는 상태.
let interactionPhase = "pick";
// 아직 오픈 리스트에 넣지 않은, 그래프에 점선으로 나타난 후보들. id -> { id, g, parentId, cost }.
let pendingCandidates = new Map();
// 지금 답해야 하는 중복 상태 하나(있으면). round.dupChildren[0]과 같다.
let pendingDup = null;
let pickAttempts = 0;
let ucsProblemStarted = false;
let ucsExperimentStarted = false;

function updateCostProgress(stage) {
  for (const item of el.costProgress.querySelectorAll("li")) {
    const itemStage = Number(item.dataset.stage);
    item.classList.toggle("is-current", itemStage === stage);
    item.classList.toggle("is-complete", itemStage < stage);
    if (itemStage === stage) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
}

function showCostStage(stage) {
  el.humanChallenge.hidden = true;
  el.complexChallenge.hidden = true;
  el.methodTransition.hidden = true;
  el.ucsConcept.hidden = true;
  el.predictView.hidden = true;
  el.experiment.hidden = true;

  let target;
  if (stage === 1) {
    el.humanChallenge.hidden = false;
    target = el.humanChallenge;
  } else if (stage === 2) {
    el.complexChallenge.hidden = false;
    target = el.complexChallenge;
  } else if (ucsExperimentStarted) {
    el.experiment.hidden = false;
    target = el.experiment;
  } else if (ucsProblemStarted) {
    el.ucsConcept.hidden = false;
    el.predictView.hidden = false;
    target = el.ucsConcept;
  } else {
    el.methodTransition.hidden = false;
    target = el.methodTransition;
  }
  updateCostProgress(stage);
  target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

el.costProgress.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-go-stage]");
  if (button) showCostStage(Number(button.dataset.goStage));
});

function prevClosedFor(index) {
  return index === 0 ? [] : rounds[index - 1].closedAfter;
}

function treeEdgesUpTo(roundIndex) {
  const parentOf = new Map();
  for (let i = 0; i < roundIndex; i += 1) {
    for (const child of rounds[i].children) {
      if (child.status === "new" || child.status === "open-replace") {
        parentOf.set(child.id, { parentId: rounds[i].expandedId, cost: child.cost });
      }
    }
  }
  return parentOf;
}

function initRoundState(round) {
  return {
    open: new Map(round.pickCandidates.map((c) => [c.id, c.g])),
    closed: new Map(prevClosedFor(round.index).map((c) => [c.id, c.g])),
    parentOf: treeEdgesUpTo(round.index),
  };
}

function renderFromRoundState({ interactiveIds = null, interactiveVerb, resultMarks = {}, label } = {}) {
  // 학교 지도는 처음부터 정문~매점 정점을 모두 보여주고, 간선은 여전히 컴퓨터가 실제로
  // 발견한 만큼만(edgesOverride) 점진적으로 드러낸다.
  const visibleIds = NODES.map((n) => n.id);
  const visibleSet = new Set(visibleIds);
  const statesById = {};
  const gById = {};
  for (const [id, g] of roundState.closed) { statesById[id] = "closed"; gById[id] = g; }
  for (const [id, g] of roundState.open) { statesById[id] = "open"; gById[id] = g; }
  const edgesOverride = [...roundState.parentOf.entries()]
    .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
    .map(([childId, { parentId, cost }]) => ({ a: parentId, b: childId, cost }));
  renderGraphDiagram(el.traceGraph, {
    nodes: GRAPH_NODES,
    statesById,
    gById,
    visibleIds,
    edgesOverride,
    interactiveIds,
    interactiveVerb: interactiveVerb || "선택하기",
    resultMarks,
    label: label || "지금까지 컴퓨터가 발견한 상태들의 탐색 트리",
  });
  renderListPanel(el.listPanel, {
    nodes: LIST_NODES,
    open: [...roundState.open].map(([id, g]) => ({ id, g })),
    closed: [...roundState.closed].map(([id, g]) => ({ id, g })),
  });
}

// "reveal" 단계 전용 렌더 — 아직 남은 pendingCandidates(점선 노드)와 pendingDup(간선 선택지)를
// roundState 위에 겹쳐 그린다. 둘 다 소진되면 자연히 일반 노드/간선만 남는다.
function renderRevealPhase() {
  const candidates = [...pendingCandidates.values()];
  const extraEdges = [];
  const committedOverrides = new Map();
  const compareById = {};
  if (pendingDup) {
    committedOverrides.set(pendingDup.id, {
      choice: "keep",
      choiceLabel: `${nodeLabel(pendingDup.id)} 기존 값 g=${pendingDup.existingG} 유지하기`,
      displayValue: pendingDup.existingG,
    });
    extraEdges.push({
      a: rounds[currentRoundIndex].expandedId,
      b: pendingDup.id,
      cost: pendingDup.cost,
      displayValue: pendingDup.newG,
      pending: true,
      choice: "replace",
      choiceLabel: `${nodeLabel(pendingDup.id)} 새 값 g=${pendingDup.newG}으로 교체하기`,
    });
    compareById[pendingDup.id] = { existingG: pendingDup.existingG, newG: pendingDup.newG };
  }
  const visibleIds = NODES.map((n) => n.id);
  const visibleSet = new Set(visibleIds);
  const statesById = {};
  const gById = {};
  for (const [id, g] of roundState.closed) { statesById[id] = "closed"; gById[id] = g; }
  for (const [id, g] of roundState.open) { statesById[id] = "open"; gById[id] = g; }
  for (const c of candidates) { statesById[c.id] = "candidate"; gById[c.id] = c.g; }
  const committedEdges = [...roundState.parentOf.entries()]
    .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
    .map(([childId, { parentId, cost }]) => {
      const override = committedOverrides.get(childId);
      return override ? { a: parentId, b: childId, cost, ...override } : { a: parentId, b: childId, cost };
    });
  const candidateEdges = candidates
    .filter((c) => visibleSet.has(c.parentId))
    .map((c) => ({ a: c.parentId, b: c.id, cost: c.cost, pending: true }));
  renderGraphDiagram(el.traceGraph, {
    nodes: GRAPH_NODES,
    statesById,
    gById,
    compareById,
    visibleIds,
    edgesOverride: [...committedEdges, ...candidateEdges, ...extraEdges],
    interactiveIds: [...pendingCandidates.keys()],
    interactiveVerb: "오픈 리스트에 추가하기",
    label: "지금까지 컴퓨터가 발견한 상태들의 탐색 트리. 점선 노드나 두 후보 간선을 클릭하세요.",
  });
  renderListPanel(el.listPanel, {
    nodes: LIST_NODES,
    open: [...roundState.open].map(([id, g]) => ({ id, g })),
    closed: [...roundState.closed].map(([id, g]) => ({ id, g })),
  });
}

function appendRecordRow(id, g) {
  if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  row.innerHTML = `<th scope="row">${el.recordBody.children.length + 1}</th><td>${nodeLabel(id)}</td><td>${g}</td>`;
  el.recordBody.appendChild(row);
}

function updateStageLabel(round) {
  el.stageLabel.textContent = `단계 ${round.index + 1} / ${rounds.length} · 균일 비용 탐색`;
  el.progressBar.style.width = `${Math.round(((round.index + 1) / rounds.length) * 100)}%`;
  el.stepBadge.textContent = `단계 ${round.index + 1}`;
}

function childRowHtml(child, statusLabel) {
  return `<div class="child-row" data-status="${child.status}"><span>${nodeLabel(child.id)}</span><span>g=${child.newG}</span><span class="child-status">${statusLabel}</span></div>`;
}

function showRound(index) {
  currentRoundIndex = index;
  interactionPhase = "pick";
  pendingCandidates = new Map();
  pendingDup = null;
  pickAttempts = 0;
  const round = rounds[index];
  roundState = initRoundState(round);
  updateStageLabel(round);
  renderFromRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다음 상태로 선택하기" });
  el.stepFeedback.hidden = true;
  el.stepFeedback.className = "step-feedback";
  el.closeAction.hidden = true;
  el.closeAction.innerHTML = "";
  el.childrenReveal.innerHTML = "";
  el.dupQuestion.hidden = true;
  el.dupQuestion.innerHTML = "";
  el.nextStep.hidden = true;

  const comparison = round.pickCandidates.map((candidate) => `${nodeLabel(candidate.id)} g(n)=${candidate.g}`).join(" · ");
  el.costChoiceSummary.innerHTML = `<span>현재 후보 비교</span><strong>${comparison}</strong>`;

  el.candidatePrompt.textContent = round.pickCandidates.length > 1
    ? "그래프에서 g(n)이 가장 작은 상태를 클릭하세요."
    : "오픈 리스트에는 이 상태 하나뿐입니다. 그래프에서 클릭해 확장하세요.";
}

function checkRoundComplete() {
  if (pendingCandidates.size > 0 || pendingDup) return;
  interactionPhase = "done";
  el.nextStep.hidden = false;
  el.nextStep.textContent = rounds[currentRoundIndex].isGoal ? "결과 보기 →" : "다음 단계 →";
  el.nextStep.focus();
}

function revealChildren(round) {
  interactionPhase = "reveal";
  const newChildren = round.children.filter((c) => c.status === "new");
  const closedSkipChildren = round.children.filter((c) => c.status === "closed-skip");
  pendingCandidates = new Map(newChildren.map((c) => [c.id, { id: c.id, g: c.newG, parentId: round.expandedId, cost: c.cost }]));
  pendingDup = round.dupChildren[0] || null;

  const hints = [];
  if (pendingCandidates.size > 0) hints.push("점선으로 나타난 새 상태를 클릭해 오픈 리스트에 넣으세요.");
  if (pendingDup) hints.push(`${nodeLabel(pendingDup.id)}로 가는 두 후보 간선 중 더 작은 값을 클릭하세요.`);
  el.candidatePrompt.textContent = hints.length ? hints.join(" ") : "새로 바뀔 상태가 없습니다.";

  el.childrenReveal.innerHTML = closedSkipChildren.length
    ? `<p class="children-reveal-hint">${closedSkipChildren.map((c) => `${nodeLabel(c.id)}은(는) 이미 닫힌 리스트에 있어 다시 열지 않습니다.`).join(" ")}</p>`
    : "";
  if (pendingDup) {
    el.dupQuestion.hidden = false;
    el.dupQuestion.innerHTML = `<p><strong>${nodeLabel(round.expandedId)}</strong>에서 <strong>${nodeLabel(pendingDup.id)}</strong>로 가는 새 경로를 찾았습니다. 그래프에서 ${nodeLabel(pendingDup.id)}로 이어지는 두 후보 간선(기존 값 ${pendingDup.existingG} / 새 값 ${pendingDup.newG}) 중 더 작은 쪽을 클릭하세요.</p>`;
  }

  renderRevealPhase();
  checkRoundComplete();
}

function handleAddCandidate(id) {
  const candidate = pendingCandidates.get(id);
  if (!candidate) return;
  roundState.open.set(id, candidate.g);
  roundState.parentOf.set(id, { parentId: candidate.parentId, cost: candidate.cost });
  pendingCandidates.delete(id);
  renderRevealPhase();
  checkRoundComplete();
}

function handleDupChoice(insertChosen) {
  if (!pendingDup) return;
  const round = rounds[currentRoundIndex];
  const dup = pendingDup;
  const outcome = checkDupAnswer(dup, insertChosen);

  if (outcome.shouldInsert) {
    roundState.open.set(dup.id, dup.newG);
    roundState.parentOf.set(dup.id, { parentId: round.expandedId, cost: dup.cost });
  }
  pendingDup = null;
  renderRevealPhase();

  el.dupQuestion.innerHTML = `
    <p><strong>${nodeLabel(round.expandedId)}</strong>에서 <strong>${nodeLabel(dup.id)}</strong>로 가는 새 경로를 찾았습니다(비용 ${dup.newG}). 오픈 리스트에는 이미 ${nodeLabel(dup.id)}(g=${dup.existingG})가 있습니다.</p>
    <div class="step-feedback ${outcome.correct ? "correct" : "incorrect"}">
      <strong>${outcome.correct ? "맞아요." : "다시 확인해 볼까요."}</strong>
      <p>${outcome.shouldInsert
        ? `새 값 ${dup.newG}이(가) 기존 값 ${dup.existingG}보다 작으므로, 더 작은 값으로 교체해야 합니다.`
        : `새 값 ${dup.newG}이(가) 기존 값 ${dup.existingG}보다 크거나 같으므로, 기존 값을 그대로 남겨야 합니다.`}</p>
    </div>
  `;
  el.childrenReveal.insertAdjacentHTML("beforeend", childRowHtml(dup, outcome.shouldInsert ? "더 작은 값으로 교체됨" : "기존 값이 더 작아 제외"));
  checkRoundComplete();
}

function handlePick(clickedId) {
  const round = rounds[currentRoundIndex];
  const outcome = checkPickAnswer(round, clickedId);
  el.stepFeedback.hidden = false;
  el.stepFeedback.className = "step-feedback";
  if (!outcome.correct) {
    pickAttempts += 1;
    el.stepFeedback.classList.add("incorrect");
    el.stepFeedback.innerHTML = pickAttempts === 1
      ? `<strong>한 번 더 비교해 보세요.</strong><p>오픈 리스트에 있는 모든 g(n) 중 가장 작은 값을 찾으면 됩니다.</p>`
      : `<strong>힌트</strong><p><b>${round.g}</b>보다 큰 값은 다음 상태가 될 수 없습니다.</p>`;
    renderFromRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다시 선택하기", resultMarks: { [clickedId]: "incorrect" } });
    return;
  }

  el.stepFeedback.classList.add("correct");
  el.stepFeedback.innerHTML = `<strong>정답이에요.</strong><p>${nodeLabel(round.expandedId)}의 g(n)=${round.g}이 가장 작으므로 이 상태를 확정합니다.</p>`;
  handleClose();
}

function handleClose() {
  const round = rounds[currentRoundIndex];
  roundState.open.delete(round.expandedId);
  roundState.closed.set(round.expandedId, round.g);
  appendRecordRow(round.expandedId, round.g);
  el.closeAction.hidden = true;

  if (round.isGoal) {
    interactionPhase = "done";
    renderFromRoundState();
    el.candidatePrompt.textContent = "목표 상태에 도착했습니다!";
    el.nextStep.hidden = false;
    el.nextStep.textContent = "결과 보기 →";
    el.nextStep.focus();
  } else {
    revealChildren(round);
  }
}

function handleGraphActivate(event) {
  if (interactionPhase === "pick") {
    const nodeGroup = event.target.closest(".graph-node.is-pickable");
    if (nodeGroup) handlePick(nodeGroup.dataset.node);
    return;
  }
  if (interactionPhase === "close") {
    const nodeGroup = event.target.closest(".graph-node.is-pickable");
    if (nodeGroup) handleClose();
    return;
  }
  if (interactionPhase === "reveal") {
    const edgeChoice = event.target.closest(".graph-edge-choice");
    if (edgeChoice) {
      handleDupChoice(edgeChoice.dataset.choice === "replace");
      return;
    }
    const nodeGroup = event.target.closest(".graph-node.is-pickable");
    if (nodeGroup) handleAddCandidate(nodeGroup.dataset.node);
  }
}

el.traceGraph.addEventListener("click", handleGraphActivate);
el.traceGraph.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (!event.target.closest(".is-pickable")) return;
  event.preventDefault();
  handleGraphActivate(event);
});

el.nextStep.addEventListener("click", () => {
  const round = rounds[currentRoundIndex];
  if (round.isGoal) {
    finishTrace();
    return;
  }
  showRound(currentRoundIndex + 1);
});

function finishTrace() {
  el.traceView.hidden = true;
  el.resultsView.hidden = false;
  renderResults();
  el.resultsView.querySelector("h2").focus();
}

// "여러 그래프에서 연습하기" 버튼을 눌러야 아래 연습 문제(랜덤 그래프) 섹션이 열린다.
function revealPractice() {
  if (!el.practiceView) return;
  el.practiceView.hidden = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.practiceView.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}

function renderResults() {
  const summary = summarize({ trace });
  el.resultsSummary.textContent = `균일 비용 탐색은 총 ${summary.testedCount}개 장소를 확정해 매점에 도착했고, 그 경로(${pathLabel(summary.path)})의 실제 이동 시간은 ${summary.pathCost}분입니다. 이동 횟수만 보면 ${pathLabel(summary.fewerHopsPath)}(${summary.fewerHopsHops}번 이동)가 더 짧아 보이지만, 실제로는 ${summary.fewerHopsCost}분이 걸려 균일 비용 탐색이 찾은 길보다 ${summary.saved}분 더 걸립니다.`;
  const statesById = {};
  for (const id of summary.path) statesById[id] = "path";
  const lastRound = rounds.at(-1);
  const gById = {};
  for (const entry of lastRound.closedAfter) gById[entry.id] = entry.g;
  renderGraphDiagram(el.resultsGraph, {
    nodes: GRAPH_NODES,
    statesById,
    gById,
    visibleIds: NODES.map((n) => n.id),
    edgesOverride: [...treeEdgesUpTo(lastRound.index + 1).entries()].map(([childId, { parentId, cost }]) => ({ a: parentId, b: childId, cost })),
    pathIds: summary.path,
    label: "컴퓨터가 최종적으로 만든 탐색 트리. 정문에서 매점까지의 최종 경로가 초록색으로 표시됩니다.",
  });
  el.costCompare.innerHTML = `
    <div class="stat-block"><span>가장 적은 이동(${summary.fewerHopsHops}번) 경로 시간</span><strong>${summary.fewerHopsCost}분</strong></div>
    <div class="stat-block"><span>균일 비용 탐색 경로 시간</span><strong>${summary.pathCost}분</strong></div>
    <div class="stat-block"><span>균일 비용 탐색이 아낀 시간</span><strong>${summary.saved}분</strong></div>
  `;
}

el.commuteAnswer.addEventListener("submit", (event) => {
  event.preventDefault();
  const enteredCost = el.commuteCost.value.trim();
  el.commuteFeedback.hidden = false;
  if (enteredCost === "") {
    el.commuteFeedback.className = "step-feedback incorrect";
    el.commuteFeedback.innerHTML = `<strong>시간을 입력하세요.</strong><p>지도에서 집부터 학교까지 이어지는 길의 시간을 더해 보세요.</p>`;
    el.commuteCost.focus();
    return;
  }
  const correct = Number(enteredCost) === 11;
  el.commuteFeedback.className = `step-feedback ${correct ? "correct" : "incorrect"}`;
  if (!correct) {
    el.commuteFeedback.innerHTML = `<strong>정답이 아닙니다.</strong><p>다시 풀어보세요.</p>`;
    el.commuteCost.select();
    el.continueToUcs.hidden = true;
  } else {
    el.commuteFeedback.innerHTML = `<strong>가장 빠른 길을 찾았습니다.</strong><p>집 → 공원 → 도서관 → 언덕 → 학교는 3 + 3 + 2 + 3 = <b>11분</b>입니다. 가장 곧아 보이는 길이 반드시 가장 빠르지는 않습니다.</p>`;
    el.commuteCost.disabled = true;
    el.commuteAnswer.querySelector('button[type="submit"]').hidden = true;
    el.continueToUcs.hidden = false;
    el.continueToUcs.focus();
  }
});

el.continueToUcs.addEventListener("click", () => {
  el.humanChallenge.hidden = true;
  el.complexChallenge.hidden = false;
  updateCostProgress(2);
  el.complexChallenge.querySelector("h2").focus();
  el.complexChallenge.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.startComputerMethod.addEventListener("click", () => {
  el.complexChallenge.hidden = true;
  el.methodTransition.hidden = false;
  updateCostProgress(3);
  el.methodTransition.querySelector("h2").focus();
  el.methodTransition.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.beginUcsProblem.addEventListener("click", () => {
  ucsProblemStarted = true;
  el.methodTransition.hidden = true;
  el.ucsConcept.hidden = false;
  el.predictView.hidden = false;
  el.ucsConcept.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.complexAnswer.addEventListener("submit", (event) => {
  event.preventDefault();
  if (el.complexCost.value.trim() === "") {
    el.complexFeedback.hidden = false;
    el.complexFeedback.className = "step-feedback incorrect";
    el.complexFeedback.innerHTML = `<strong>예상 시간을 입력하세요.</strong><p>정확히 계산하지 못해도 괜찮습니다. 현재 생각한 시간을 분 단위로 적어 보세요.</p>`;
    el.complexCost.focus();
    return;
  }
  const correct = Number(el.complexCost.value) === 11;
  el.complexFeedback.hidden = false;
  el.complexFeedback.className = `step-feedback ${correct ? "correct" : "incorrect"}`;
  if (correct) {
    el.complexFeedback.innerHTML = `<strong>정답입니다.</strong><p>정답을 찾았지만 모든 경로를 빠짐없이 비교했는지 확신하기는 쉽지 않습니다. 이제 컴퓨터가 같은 문제를 해결하는 규칙을 알아봅시다.</p>`;
    el.complexCost.disabled = true;
    el.complexAnswer.querySelector('button[type="submit"]').hidden = true;
    el.startComputerMethod.hidden = false;
    el.startComputerMethod.focus();
  } else {
    el.complexFeedback.innerHTML = `<strong>정답이 아닙니다.</strong><p>다시 풀어보세요.</p>`;
    el.complexCost.select();
    el.startComputerMethod.hidden = true;
  }
});

function renderComplexGraph() {
  const ns = "http://www.w3.org/2000/svg";
  const cols = 6;
  const rows = 4;
  const places = [
    ["집", "🏠"], ["골목", "🛣️"], ["놀이터", "🛝"], ["약국", "💊"], ["정류장", "🚏"], ["카페", "☕"],
    ["편의점", "🏪"], ["공원", "🌳"], ["병원", "🏥"], ["은행", "🏦"], ["우체국", "📮"], ["소방서", "🚒"],
    ["시장", "🧺"], ["도서관", "📚"], ["체육관", "🏟️"], ["주민센터", "🏢"], ["마트", "🛒"], ["경찰서", "🚓"],
    ["육교", "🌉"], ["광장", "⛲"], ["학원", "✏️"], ["주차장", "🅿️"], ["문구점", "📒"], ["학교", "🏫"],
  ];
  const nodes = Array.from({ length: cols * rows }, (_, index) => ({
    id: index,
    x: 70 + (index % cols) * 150,
    y: 70 + Math.floor(index / cols) * 125,
  }));
  const edges = [];
  const addEdge = (a, b) => edges.push({ a, b, cost: ((a * 7 + b * 3) % 9) + 1 });
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) addEdge(row * cols + col, row * cols + col + 1);
  }
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols; col += 1) addEdge(row * cols + col, (row + 1) * cols + col);
  }
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      if ((row + col) % 2 === 0) addEdge(row * cols + col, (row + 1) * cols + col + 1);
    }
  }
  addEdge(1, 8);
  addEdge(15, 22);
  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y); line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    line.setAttribute("class", "complex-edge");
    el.complexGraph.appendChild(line);
    const cost = document.createElementNS(ns, "text");
    cost.setAttribute("x", (a.x + b.x) / 2); cost.setAttribute("y", (a.y + b.y) / 2 - 7);
    cost.setAttribute("class", "complex-cost"); cost.textContent = edge.cost;
    el.complexGraph.appendChild(cost);
  }
  for (const node of nodes) {
    const group = document.createElementNS(ns, "g");
    group.setAttribute("class", `complex-node${node.id === 0 ? " is-start" : ""}${node.id === nodes.length - 1 ? " is-goal" : ""}`);
    group.setAttribute("transform", `translate(${node.x} ${node.y})`);
    const circle = document.createElementNS(ns, "circle"); circle.setAttribute("r", "25");
    const icon = document.createElementNS(ns, "text");
    icon.setAttribute("class", "complex-node-icon"); icon.textContent = places[node.id][1];
    const label = document.createElementNS(ns, "text");
    label.setAttribute("class", "complex-node-label"); label.setAttribute("y", "39"); label.textContent = places[node.id][0];
    group.append(circle, icon, label); el.complexGraph.appendChild(group);
  }
}

renderComplexGraph();

el.startUcsButton.addEventListener("click", () => {
  ucsExperimentStarted = true;
  el.predictView.hidden = true;
  el.experiment.hidden = false;
  showRound(0);
  el.experiment.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.restartButton.addEventListener("click", () => {
  el.resultsView.hidden = true;
  el.traceView.hidden = false;
  el.recordBody.innerHTML = '<tr class="empty-row"><td colspan="3">아직 확정된 장소가 없습니다.</td></tr>';
  showRound(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.experiment.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

el.showPracticeButton?.addEventListener("click", revealPractice);

el.projectorToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projectorToggle.setAttribute("aria-pressed", String(enabled));
});

renderGraphDiagram(el.predictGraph, { nodes: GRAPH_NODES });

enableGraphZoom(el.predictGraph, document.querySelector('[data-zoom-for="predict-graph"]'));
enableGraphZoom(el.traceGraph, document.querySelector('[data-zoom-for="trace-graph"]'));
enableGraphZoom(el.resultsGraph, document.querySelector('[data-zoom-for="results-graph"]'));

// ?debug=results 로 접속하면 5단계를 전부 정답으로 자동 진행해 결과 화면으로 바로 건너뛴다.
// 검토용 지름길일 뿐, 평소 학생 화면에는 영향이 없다.
if (new URLSearchParams(location.search).get("debug") === "results") {
  el.predictView.hidden = true;
  el.experiment.hidden = false;
  for (let i = 0; i < rounds.length; i += 1) {
    showRound(i);
    const round = rounds[i];
    handlePick(round.expandedId);
    handleClose();
    if (!round.isGoal) {
      for (const id of [...pendingCandidates.keys()]) handleAddCandidate(id);
      if (pendingDup) handleDupChoice(checkDupAnswer(pendingDup, true).shouldInsert);
    }
  }
  finishTrace();
  document.querySelector(".reveal-box").scrollIntoView({ block: "start" });
}
