// "만약 h(n)이 틀리면?" 데모: 활동 1과 같은 5개 장소(정문·중앙현관·운동장·급식실·매점)를 쓰되,
// 이번에는 운동장 쪽이 실제로는 더 빠른 지름길이 되도록 이동 비용을 다르게 설계한 지도를 가정한다
// (이 데모 전용 BROKEN_EDGES — 활동 1·3단계의 지도는 건드리지 않는다). 정문에서 매점으로 가는
// 두 길(정문→중앙현관→매점, 정문→운동장→급식실→매점)이 서로 다른 노드를 거칠 뿐 겹치는 간선이
// 없는 두 갈래 길이라서, 중앙현관·급식실처럼 매점과 간선으로 직접 연결된 곳은 그 간선 비용이
// 곧 실제 최단 거리와 정확히 같다(다른 지름길로 더 싸게 갈 방법이 없으므로) — h(n)이 "그 장소에서
// 매점까지의 직선거리"라는 이 활동의 설명과 어긋나지 않도록, 이 두 값은 반드시 지도의 간선 비용과
// 같아야 한다. 이 지도에서 운동장의 h(n)만 실제 값(5)보다 큰 10으로 잘못 어림잡아 A*를 그대로
// 수행해 본다. 운동장은 매점과 간선으로 직접 연결돼 있지 않은 장소라서 일부러 골랐다 — 만약 매점과
// 바로 이어진 장소(중앙현관·급식실)였다면 그 간선 비용 자체가 지도에 이미 적혀 있어서, 그보다 큰
// 값을 어림잡는다는 게 애초에 말이 안 된다. 알고리즘 자체(간선을 클릭해 f(n)이 가장 작은 상태를
// 고르는 규칙)는 활동 1과 똑같이 정확히 따르지만, h(n) 하나가 admissible하지 않기 때문에(실제
// 최단 거리 5를 초과) 지름길(운동장→급식실→매점)을 놔두고 돌아가는 길(중앙현관→매점)로 가게 되어,
// 최적이 아닌(비용 13, 실제 최적 10보다 30% 더 비싼) 경로로 끝난다는 것을 직접 보여준다.
import { NODES, START, GOAL, nodeLabel, runAStarGraphTrace, runUcsGraphTrace } from "../shared/search-graph-lab.js?v=2026090902";
import { renderGraphDiagram, renderListPanel, enableGraphZoom } from "../shared/search-graph-ui.js?v=2026090907";
import { buildMapRounds, checkMapPickAnswer, checkMapDupAnswer } from "./game-core.js?v=2026090902";

const $ = (selector) => document.querySelector(selector);
const el = {
  section: $("#map-broken-view"),
  referenceGraph: $("#map-broken-reference-graph"),
  startButton: $("#map-broken-start"),
  experimentHead: $("#map-broken-experiment-head"),
  stageLabel: $("#map-broken-stage-label"),
  progressBar: $("#map-broken-progress-bar"),
  traceArea: $("#map-broken-trace-area"),
  graph: $("#map-broken-graph"),
  listPanel: $("#map-broken-list-panel"),
  prompt: $("#map-broken-prompt"),
  costChoiceSummary: $("#map-broken-cost-choice-summary"),
  feedback: $("#map-broken-feedback"),
  childrenReveal: $("#map-broken-children-reveal"),
  dupQuestion: $("#map-broken-dup-question"),
  nextStep: $("#map-broken-next-step"),
  recordBody: $("#map-broken-record-body"),
  summary: $("#map-broken-summary"),
  summaryText: $("#map-broken-summary-text"),
  resultCost: $("#map-broken-result-cost"),
  optimalCost: $("#map-broken-optimal-cost"),
  resultGraph: $("#map-broken-result-graph"),
  optimalGraph: $("#map-broken-optimal-graph"),
  againButton: $("#map-broken-again"),
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

if (el.section) {
  // 같은 5개 장소를 쓰지만, 정문에서 매점으로 가는 겹치지 않는 두 갈래 길(정문→중앙현관→매점,
  // 정문→운동장→급식실→매점)로만 이루어진 지도를 이 데모 전용으로 새로 설계했다(활동 1·3단계가
  // 쓰는 공용 EDGES는 그대로 둔다). 두 길이 서로 다른 간선만 지나므로, 매점과 직접 연결된
  // 중앙현관·급식실은 다른 지름길이 없어 그 간선 비용이 곧 실제 최단 거리이기도 하다.
  const BROKEN_EDGES = [
    { a: "gate", b: "lobby", cost: 4 },
    { a: "lobby", b: "store", cost: 9 },
    { a: "gate", b: "yard", cost: 5 },
    { a: "yard", b: "cafeteria", cost: 2 },
    { a: "cafeteria", b: "store", cost: 3 },
  ];
  // 이 지도에서 각 장소부터 매점까지의 실제 최단 거리와 정확히 같은 값(admissible하면서 가장
  // 빡빡한 어림값) — 매점과 직접 연결된 중앙현관(9)·급식실(3)은 그 간선 비용과 정확히 같다.
  // 운동장만 실제 값(5)보다 큰 10으로 잘못 어림잡는다 — 매점과 직접 연결된 간선이 없는 곳이라
  // 지도만 봐서는 "너무 크다"고 바로 알아챌 수 없는 값이다.
  const CORRECT_HEURISTICS = { gate: 10, lobby: 9, yard: 5, cafeteria: 3, store: 0 };
  const BROKEN_HEURISTICS = { ...CORRECT_HEURISTICS, yard: 10 };
  const NODE_SYMBOLS = { gate: "a", lobby: "b", yard: "c", cafeteria: "d", store: "e" };
  const GRAPH_NODES = NODES.map((node) => ({
    ...node,
    label: `${node.label} (${NODE_SYMBOLS[node.id]})`,
    radius: node.id === "lobby" ? 44 : 36,
  }));
  const LIST_NODES = NODES.map((node) => ({ ...node, label: NODE_SYMBOLS[node.id] }));
  const H_LABELS = Object.fromEntries(NODES.map((n) => [n.id, `h=${BROKEN_HEURISTICS[n.id]}`]));

  // 탐색 트리의 파란 원은 누적값 g(n)이므로 실제 간선 시간과 다를 수 있다. 학생이 둘을
  // 혼동하지 않도록, 모든 실제 간선 시간을 표시한 원본 지도를 활동 시작 전에 따로 보여준다.
  renderGraphDiagram(el.referenceGraph, {
    nodes: GRAPH_NODES,
    edges: BROKEN_EDGES,
    visibleIds: NODES.map((node) => node.id),
    gById: H_LABELS,
    metricLabel: "",
    metricVariant: "h",
    label: "실제 간선 시간과 휴리스틱값을 함께 표시한 지도. 중앙현관에서 매점은 9분이고 h는 9, 급식실에서 매점은 3분이고 h는 3이다. 운동장의 h만 10으로 과대 추정되어 있다.",
  });

  const brokenTrace = runAStarGraphTrace({ nodes: NODES, edges: BROKEN_EDGES, start: START, goal: GOAL }, BROKEN_HEURISTICS);
  const rounds = buildMapRounds(brokenTrace);

  let roundIndex = 0;
  let roundState = null;
  let phase = "pick";
  let pendingCandidates = new Map();
  let pendingDup = null;

  function currentG(id) {
    return (roundState.open.get(id) || roundState.closed.get(id))?.g;
  }

  function existingDupF(dup) {
    return dup.existingG + dup.h;
  }

  function prevClosedFor(index) {
    return index === 0 ? [] : rounds[index - 1].closedAfter;
  }

  function treeEdgesUpTo(roundIdx) {
    const parentOf = new Map();
    for (let i = 0; i < roundIdx; i += 1) {
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
      open: new Map(round.pickCandidates.map((c) => [c.id, { g: c.g, h: c.h, f: c.f }])),
      closed: new Map(prevClosedFor(round.index).map((c) => [c.id, { g: c.g, h: c.h, f: c.f }])),
      parentOf: treeEdgesUpTo(round.index),
    };
  }

  function renderFromRoundState({ interactiveIds = null, interactiveVerb, resultMarks = {} } = {}) {
    const visibleIds = NODES.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    for (const [id] of roundState.closed) statesById[id] = "closed";
    for (const [id] of roundState.open) statesById[id] = "open";
    const interactiveSet = new Set(interactiveIds || []);
    const edgesOverride = [];
    for (const [childId, { parentId, cost }] of roundState.parentOf.entries()) {
      if (!visibleSet.has(childId) || !visibleSet.has(parentId)) continue;
      const g = currentG(childId);
      if (interactiveSet.has(childId)) {
        edgesOverride.push({
          a: parentId, b: childId, displayValue: g, displayText: `${cost}`, pick: true,
          pickLabel: `${nodeLabel(childId)} g=${g} ${interactiveVerb || "선택하기"}`,
        });
      } else {
        edgesOverride.push({ a: parentId, b: childId, cost: `${cost}` });
      }
    }
    const nodeInteractiveIds = [...interactiveSet].filter((id) => !roundState.parentOf.has(id));
    renderGraphDiagram(el.graph, {
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
      label: "잘못된 h(n)으로 진행한 A* 탐색이 지금까지 발견한 상태들의 탐색 트리",
    });
    renderListPanel(el.listPanel, {
      nodes: LIST_NODES,
      open: [...roundState.open].map(([id, v]) => ({ id, ...v })),
      closed: [...roundState.closed].map(([id, v]) => ({ id, ...v })),
      format: (entry) => `(g=${entry.g}, f=${entry.f})`,
    });
  }

  function renderRevealPhase() {
    const candidates = [...pendingCandidates.values()];
    const extraEdges = [];
    const committedOverrides = new Map();
    const compareById = {};
    if (pendingDup) {
      committedOverrides.set(pendingDup.id, {
        choice: "keep",
        choiceLabel: `${nodeLabel(pendingDup.id)} 기존 f=${existingDupF(pendingDup)} 유지하기`,
        displayValue: pendingDup.existingG,
        displayText: `f=${existingDupF(pendingDup)}`,
      });
      extraEdges.push({
        a: rounds[roundIndex].expandedId,
        b: pendingDup.id,
        displayValue: pendingDup.newG,
        displayText: `f=${pendingDup.newF}`,
        pending: true,
        choice: "replace",
        choiceLabel: `${nodeLabel(pendingDup.id)} 새 f=${pendingDup.newF}으로 갱신하기`,
      });
      compareById[pendingDup.id] = {
        existingF: existingDupF(pendingDup),
        newF: pendingDup.newF,
      };
    }
    const visibleIds = NODES.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    for (const [id] of roundState.closed) statesById[id] = "closed";
    for (const [id] of roundState.open) statesById[id] = "open";
    for (const c of candidates) statesById[c.id] = "candidate";
    const committedEdges = [...roundState.parentOf.entries()]
      .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
      .map(([childId, { parentId, cost }]) => {
        const override = committedOverrides.get(childId);
        return override ? { a: parentId, b: childId, ...override } : { a: parentId, b: childId, cost: `${cost}` };
      });
    const candidateEdges = candidates
      .filter((c) => visibleSet.has(c.parentId))
      .map((c) => ({
        a: c.parentId, b: c.id, pending: true, pick: true, displayValue: c.g, displayText: `${c.cost}`,
        pickLabel: `${nodeLabel(c.id)} g=${c.g} 오픈 리스트에 추가하기`,
      }));
    renderGraphDiagram(el.graph, {
      nodes: GRAPH_NODES,
      statesById,
      gById: H_LABELS,
      metricLabel: "",
      metricVariant: "h",
      compareById,
      visibleIds,
      edgesOverride: [...committedEdges, ...candidateEdges, ...extraEdges],
      label: "잘못된 h(n)으로 진행한 A* 탐색이 지금까지 발견한 상태들의 탐색 트리. 점선 간선이나 중복 후보의 두 간선을 클릭하세요.",
    });
    renderListPanel(el.listPanel, {
      nodes: LIST_NODES,
      open: [...roundState.open].map(([id, v]) => ({ id, ...v })),
      closed: [...roundState.closed].map(([id, v]) => ({ id, ...v })),
      format: (entry) => `(g=${entry.g}, f=${entry.f})`,
    });
  }

  function appendRecordRow(id, g, h, f) {
    if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
    const row = document.createElement("tr");
    row.innerHTML = `<th scope="row">${el.recordBody.children.length + 1}</th><td>${nodeLabel(id)}</td><td>${g}</td><td>${h}</td><td>${f}</td>`;
    el.recordBody.appendChild(row);
  }

  function updateStageLabel(round) {
    el.stageLabel.textContent = `단계 ${round.index + 1} / ${rounds.length} · A* 탐색(잘못된 h)`;
    el.progressBar.style.width = `${Math.round(((round.index + 1) / rounds.length) * 100)}%`;
  }

  function childRowHtml(child, statusLabel) {
    return `<div class="child-row" data-status="${child.status}"><span>${nodeLabel(child.id)}</span><span>f=${child.newF}</span><span class="child-status">${statusLabel}</span></div>`;
  }

  function showRound(index) {
    roundIndex = index;
    phase = "pick";
    pendingCandidates = new Map();
    pendingDup = null;
    const round = rounds[index];
    roundState = initRoundState(round);
    updateStageLabel(round);
    renderFromRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다음 상태로 선택하기" });
    el.feedback.hidden = true;
    el.feedback.className = "step-feedback";
    el.childrenReveal.innerHTML = "";
    el.dupQuestion.hidden = true;
    el.dupQuestion.innerHTML = "";
    el.nextStep.hidden = true;

    const comparison = round.pickCandidates.map((c) => `${nodeLabel(c.id)} g(n)=${c.g}, h(n)=${c.h}`).join(" · ");
    el.costChoiceSummary.innerHTML = `<span>현재 후보 비교</span><strong>${comparison}</strong><p class="cost-choice-hint">f(n)=g(n)+h(n)을 직접 계산해서 가장 작은 곳을 클릭하세요.</p>`;

    el.prompt.textContent = round.pickCandidates.length > 1
      ? "그래프에서 f(n)이 가장 작은 간선을 클릭하세요."
      : "오픈 리스트에는 이 상태 하나뿐입니다. 그래프에서 클릭해 확장하세요.";
  }

  function checkRoundComplete() {
    if (pendingCandidates.size > 0 || pendingDup) return;
    phase = "done";
    el.nextStep.hidden = false;
    el.nextStep.textContent = rounds[roundIndex].isGoal ? "결과 보기 →" : "다음 단계 →";
    el.nextStep.focus();
  }

  function revealChildren(round) {
    phase = "reveal";
    const newChildren = round.children.filter((c) => c.status === "new");
    const closedSkipChildren = round.children.filter((c) => c.status === "closed-skip");
    pendingCandidates = new Map(newChildren.map((c) => [c.id, { id: c.id, g: c.newG, h: c.h, f: c.newF, parentId: round.expandedId, cost: c.cost }]));
    pendingDup = round.dupChildren[0] || null;

    const hints = [];
    if (pendingCandidates.size > 0) hints.push("점선으로 나타난 새 간선을 클릭해 오픈 리스트에 넣으세요.");
    if (pendingDup) hints.push(`${nodeLabel(pendingDup.id)}로 가는 두 후보 간선 중 f(n)이 더 작은 쪽을 클릭하세요.`);
    el.prompt.textContent = hints.length ? hints.join(" ") : "새로 바뀔 상태가 없습니다.";

    el.childrenReveal.innerHTML = closedSkipChildren.length
      ? `<p class="children-reveal-hint">${closedSkipChildren.map((c) => `${nodeLabel(c.id)}은(는) 이미 닫힌 리스트에 있어 다시 열지 않습니다.`).join(" ")}</p>`
      : "";
    if (pendingDup) {
      el.dupQuestion.hidden = false;
      el.dupQuestion.innerHTML = `<p><strong>${nodeLabel(round.expandedId)}</strong>에서 <strong>${nodeLabel(pendingDup.id)}</strong>로 가는 새 경로를 찾았습니다. 기존 f(n)=${existingDupF(pendingDup)}와 새 f(n)=${pendingDup.newF}를 비교해 더 작은 값을 선택하세요.</p>`;
    }

    renderRevealPhase();
    checkRoundComplete();
  }

  function handleAddCandidate(id) {
    const candidate = pendingCandidates.get(id);
    if (!candidate) return;
    roundState.open.set(id, { g: candidate.g, h: candidate.h, f: candidate.f });
    roundState.parentOf.set(id, { parentId: candidate.parentId, cost: candidate.cost });
    pendingCandidates.delete(id);
    renderRevealPhase();
    checkRoundComplete();
  }

  function handleDupChoice(insertChosen) {
    if (!pendingDup) return;
    const round = rounds[roundIndex];
    const dup = pendingDup;
    const outcome = checkMapDupAnswer(dup, insertChosen);

    if (outcome.shouldInsert) {
      roundState.open.set(dup.id, { g: dup.newG, h: dup.h, f: dup.newF });
      roundState.parentOf.set(dup.id, { parentId: round.expandedId, cost: dup.cost });
    }
    pendingDup = null;
    renderRevealPhase();

    const existingF = existingDupF(dup);
    el.dupQuestion.innerHTML = `
      <p><strong>${nodeLabel(dup.id)}</strong>의 기존 f(n)=${existingF}와 새 f(n)=${dup.newF}를 비교했습니다.</p>
      <div class="step-feedback ${outcome.correct ? "correct" : "incorrect"}">
        <strong>${outcome.correct ? "맞아요." : "다시 확인해 볼까요."}</strong>
        <p>f(n)을 계산하면 새 값은 ${dup.newG}+${dup.h}=${dup.newF}, 기존 값은 ${dup.existingG}+${dup.h}=${existingF}입니다. ${outcome.shouldInsert
          ? `새 f(n)=${dup.newF}이(가) 기존 f(n)=${existingF}보다 작으므로, 더 작은 값으로 교체해야 합니다.`
          : `새 f(n)=${dup.newF}이(가) 기존 f(n)=${existingF}보다 크거나 같으므로, 기존 값을 그대로 남겨야 합니다.`}</p>
      </div>
    `;
    el.childrenReveal.insertAdjacentHTML("beforeend", childRowHtml(dup, outcome.shouldInsert ? "더 작은 f값으로 갱신됨" : "기존 f값이 더 작아 제외"));
    checkRoundComplete();
  }

  function handlePick(clickedId) {
    const round = rounds[roundIndex];
    const outcome = checkMapPickAnswer(round, clickedId);
    el.feedback.hidden = false;
    el.feedback.className = "step-feedback";
    if (!outcome.correct) {
      el.feedback.classList.add("incorrect");
      el.feedback.innerHTML = `<strong>다시 확인해 볼까요.</strong><p>오픈 리스트에 있는 모든 f(n) 중 가장 작은 값을 찾으면 됩니다.</p>`;
      renderFromRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다시 선택하기", resultMarks: { [clickedId]: "incorrect" } });
      return;
    }
    el.feedback.classList.add("correct");
    el.feedback.innerHTML = `<strong>규칙대로 정답이에요.</strong><p>${nodeLabel(round.expandedId)}의 f(n)=${round.g}+${round.h}=${round.f}이 가장 작으므로 이 상태를 확정합니다.</p>`;
    handleClose();
  }

  function handleClose() {
    const round = rounds[roundIndex];
    roundState.open.delete(round.expandedId);
    roundState.closed.set(round.expandedId, { g: round.g, h: round.h, f: round.f });
    appendRecordRow(round.expandedId, round.g, round.h, round.f);

    if (round.isGoal) {
      phase = "done";
      renderFromRoundState();
      el.prompt.textContent = "목표 상태에 도착했습니다!";
      el.nextStep.hidden = false;
      el.nextStep.textContent = "결과 보기 →";
      el.nextStep.focus();
    } else {
      revealChildren(round);
    }
  }

  function handleGraphActivate(event) {
    if (phase === "pick") {
      const pickable = event.target.closest(".is-pickable");
      if (pickable) handlePick(pickable.dataset.node);
      return;
    }
    if (phase === "reveal") {
      const edgeChoice = event.target.closest(".graph-edge-choice[data-choice]");
      if (edgeChoice) {
        handleDupChoice(edgeChoice.dataset.choice === "replace");
        return;
      }
      const pickable = event.target.closest(".is-pickable");
      if (pickable) handleAddCandidate(pickable.dataset.node);
    }
  }

  el.graph.addEventListener("click", handleGraphActivate);
  el.graph.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.closest(".is-pickable")) return;
    event.preventDefault();
    handleGraphActivate(event);
  });

  el.nextStep.addEventListener("click", () => {
    const round = rounds[roundIndex];
    if (round.isGoal) {
      finishTrace();
      return;
    }
    showRound(roundIndex + 1);
  });

  function finishTrace() {
    el.traceArea.hidden = true;
    el.experimentHead.hidden = true;
    el.summary.hidden = false;
    renderSummary();
    el.summary.querySelector("h3").focus();
  }

  function renderSummary() {
    // 이 데모 전용 지도(BROKEN_EDGES) 기준 실제 최적 경로 — 활동 1의 지도와는 이동 비용이
    // 다르므로 반드시 이 지도로 다시 계산해야 한다(공용 그래프 기본값을 쓰면 틀린 비교가 된다).
    const optimalTrace = runUcsGraphTrace({ nodes: NODES, edges: BROKEN_EDGES, start: START, goal: GOAL });
    const trueOptimalCost = optimalTrace.pathCost;
    const brokenCost = brokenTrace.pathCost;
    const brokenPathLabel = brokenTrace.path.map((id) => nodeLabel(id)).join(" → ");
    const optimalPathLabel = optimalTrace.path.map((id) => nodeLabel(id)).join(" → ");
    el.summaryText.textContent = `잘못된 h(n)으로 진행한 A*는 ${brokenPathLabel} 경로(비용 ${brokenCost})를 답으로 냈습니다. 하지만 이 지도에서 실제 가장 빠른 길의 비용은 ${trueOptimalCost}입니다.`;
    // 비용 비교를 별도 텍스트 박스로 떼어놓지 않고, 그 경로를 보여주는 그래프 바로 위에 직접
    // 표시해 어떤 경로가 얼마인지 한눈에 대조되게 한다.
    el.resultCost.textContent = `비용 ${brokenCost}(정답보다 +${brokenCost - trueOptimalCost})`;
    el.optimalCost.textContent = `비용 ${trueOptimalCost}`;

    // "찾아낸 만큼만" 자란 탐색 트리가 아니라, 학교 지도 전체(모든 장소·모든 길)를 각각 그린
    // 다음 그 위에 경로만 강조한다 — 잘못된 경로는 빨간색(wrongPathIds), 실제 최적 경로는
    // 기존 초록색(pathIds)이라 급식실 쪽 지름길을 A*가 아예 확인해 보지도 못했다는 사실이
    // 왼쪽·오른쪽 지도를 나란히 대조하면 눈으로 바로 보인다.
    const allIds = NODES.map((n) => n.id);
    renderGraphDiagram(el.resultGraph, {
      nodes: GRAPH_NODES,
      edges: BROKEN_EDGES,
      visibleIds: allIds,
      statesById: Object.fromEntries(brokenTrace.path.map((id) => [id, "path-wrong"])),
      wrongPathIds: brokenTrace.path,
      gById: H_LABELS,
      metricLabel: "",
      metricVariant: "h",
      label: `잘못된 h(n)으로 A*가 찾은 경로(${brokenPathLabel}, 비용 ${brokenCost})를 빨간색으로 강조한 학교 지도 전체`,
    });
    renderGraphDiagram(el.optimalGraph, {
      nodes: GRAPH_NODES,
      edges: BROKEN_EDGES,
      visibleIds: allIds,
      statesById: Object.fromEntries(optimalTrace.path.map((id) => [id, "path"])),
      pathIds: optimalTrace.path,
      gById: H_LABELS,
      metricLabel: "",
      metricVariant: "h",
      label: `실제 최적 경로(${optimalPathLabel}, 비용 ${trueOptimalCost})를 초록색으로 강조한 학교 지도 전체`,
    });
  }

  function startDemo() {
    el.startButton.hidden = true;
    el.experimentHead.hidden = false;
    el.summary.hidden = true;
    el.traceArea.hidden = false;
    showRound(0);
    el.traceArea.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  el.againButton.addEventListener("click", startDemo);
  el.startButton.addEventListener("click", startDemo);

  enableGraphZoom(el.graph, document.querySelector('[data-zoom-for="map-broken-graph"]'));
  enableGraphZoom(el.resultGraph, document.querySelector('[data-zoom-for="map-broken-result-graph"]'));
  enableGraphZoom(el.optimalGraph, document.querySelector('[data-zoom-for="map-broken-optimal-graph"]'));

  function reveal() {
    el.section.hidden = false;
    el.section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    el.startButton.focus({ preventScroll: true });
  }
  document.addEventListener("click", (event) => {
    if (event.target.closest("#map-show-broken")) reveal();
  });

  // ?preview=broken이면(로컬에서만) 지도 4라운드를 끝까지 풀지 않아도 바로 이 데모를 볼 수 있다.
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalPreview && new URLSearchParams(window.location.search).get("preview") === "broken") reveal();
}
