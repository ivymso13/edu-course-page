// 연습 섹션: 매번 새로운 랜덤 지도에서 같은 A* 탐색(간선을 클릭해 g(n)이 있는 상태를 고르고,
// 노드에서 h(n)을 읽어 f(n)=g(n)+h(n)을 직접 계산하는) 상호작용을 반복 연습한다.
// 위쪽의 안내된 활동(game.js)과 같은 그래프 렌더링·상호작용 방식을 그대로 쓰되, 그래프와
// 진행 상태는 이 섹션만의 것으로 완전히 분리해 둔다(교과서 예시 지도를 건드리지 않는다).
import { runAStarGraphTrace, generateRandomGraph, generateAdmissibleHeuristics, nodeLabel } from "../shared/search-graph-lab.js?v=2026090902";
import { renderGraphDiagram, renderListPanel, enableGraphZoom } from "../shared/search-graph-ui.js?v=2026090907";
import { buildMapRounds, checkMapPickAnswer, checkMapDupAnswer } from "./game-core.js?v=2026090902";

const $ = (selector) => document.querySelector(selector);
const el = {
  section: $("#map-practice-view"),
  newGraphButton: $("#map-practice-new-graph"),
  stageLabel: $("#map-practice-stage-label"),
  traceArea: $("#map-practice-trace-area"),
  graph: $("#map-practice-graph"),
  listPanel: $("#map-practice-list-panel"),
  prompt: $("#map-practice-prompt"),
  costChoiceSummary: $("#map-practice-cost-choice-summary"),
  feedback: $("#map-practice-feedback"),
  childrenReveal: $("#map-practice-children-reveal"),
  dupQuestion: $("#map-practice-dup-question"),
  nextStep: $("#map-practice-next-step"),
  recordBody: $("#map-practice-record-body"),
  summary: $("#map-practice-summary"),
  summaryText: $("#map-practice-summary-text"),
  againButton: $("#map-practice-again"),
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

if (el.section) {
  let graph = null; // { nodes, edges, start, goal }
  let heuristics = {}; // { [nodeId]: h(n) }
  let rounds = [];
  let roundIndex = 0;
  let roundState = null;
  let phase = "pick";
  let pendingCandidates = new Map();
  let pendingDup = null;

  function h(id) {
    return heuristics[id] ?? 0;
  }

  function hLabels() {
    return Object.fromEntries(graph.nodes.map((n) => [n.id, `h=${h(n.id)}`]));
  }

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
    const visibleIds = graph.nodes.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    for (const [id] of roundState.closed) statesById[id] = "closed";
    for (const [id] of roundState.open) statesById[id] = "open";
    const interactiveSet = new Set(interactiveIds || []);
    const edgesOverride = [];
    for (const [childId, { parentId }] of roundState.parentOf.entries()) {
      if (!visibleSet.has(childId) || !visibleSet.has(parentId)) continue;
      const g = currentG(childId);
      if (interactiveSet.has(childId)) {
        edgesOverride.push({
          a: parentId, b: childId, displayValue: g, pick: true,
          pickLabel: `${nodeLabel(childId, graph.nodes)} g=${g} ${interactiveVerb || "선택하기"}`,
        });
      } else {
        edgesOverride.push({ a: parentId, b: childId, cost: `g=${g}` });
      }
    }
    // 시작 상태처럼 들어오는 간선이 없는 상태만 노드 자체를 클릭해 고른다.
    const nodeInteractiveIds = [...interactiveSet].filter((id) => !roundState.parentOf.has(id));
    renderGraphDiagram(el.graph, {
      nodes: graph.nodes,
      edges: graph.edges,
      statesById,
      gById: hLabels(),
      metricLabel: "",
      metricVariant: "h",
      visibleIds,
      edgesOverride,
      interactiveIds: nodeInteractiveIds,
      interactiveVerb: interactiveVerb || "선택하기",
      resultMarks,
      label: "지금까지 A* 탐색이 발견한 상태들의 탐색 트리(연습용 랜덤 지도)",
    });
    renderListPanel(el.listPanel, {
      nodes: graph.nodes,
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
        choiceLabel: `${nodeLabel(pendingDup.id, graph.nodes)} 기존 f=${existingDupF(pendingDup)} 유지하기`,
        displayValue: pendingDup.existingG,
        displayText: `f=${existingDupF(pendingDup)}`,
      });
      extraEdges.push({
        a: rounds[roundIndex].expandedId,
        b: pendingDup.id,
        displayValue: pendingDup.newG,
        pending: true,
        choice: "replace",
        choiceLabel: `${nodeLabel(pendingDup.id, graph.nodes)} 새 f=${pendingDup.newF}으로 갱신하기`,
        displayText: `f=${pendingDup.newF}`,
      });
      compareById[pendingDup.id] = {
        existingF: existingDupF(pendingDup),
        newF: pendingDup.newF,
      };
    }
    const visibleIds = graph.nodes.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    for (const [id] of roundState.closed) statesById[id] = "closed";
    for (const [id] of roundState.open) statesById[id] = "open";
    for (const c of candidates) statesById[c.id] = "candidate";
    const committedEdges = [...roundState.parentOf.entries()]
      .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
      .map(([childId, { parentId }]) => {
        const override = committedOverrides.get(childId);
        return override ? { a: parentId, b: childId, ...override } : { a: parentId, b: childId, cost: `g=${currentG(childId)}` };
      });
    const candidateEdges = candidates
      .filter((c) => visibleSet.has(c.parentId))
      .map((c) => ({
        a: c.parentId, b: c.id, pending: true, pick: true, displayValue: c.g,
        pickLabel: `${nodeLabel(c.id, graph.nodes)} g=${c.g} 오픈 리스트에 추가하기`,
      }));
    renderGraphDiagram(el.graph, {
      nodes: graph.nodes,
      edges: graph.edges,
      statesById,
      gById: hLabels(),
      metricLabel: "",
      metricVariant: "h",
      compareById,
      visibleIds,
      edgesOverride: [...committedEdges, ...candidateEdges, ...extraEdges],
      label: "지금까지 A* 탐색이 발견한 상태들의 탐색 트리(연습용 랜덤 지도). 점선 간선이나 중복 후보의 두 간선을 클릭하세요.",
    });
    renderListPanel(el.listPanel, {
      nodes: graph.nodes,
      open: [...roundState.open].map(([id, v]) => ({ id, ...v })),
      closed: [...roundState.closed].map(([id, v]) => ({ id, ...v })),
      format: (entry) => `(g=${entry.g}, f=${entry.f})`,
    });
  }

  function appendRecordRow(id, g, hVal, f) {
    if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
    const row = document.createElement("tr");
    row.innerHTML = `<th scope="row">${el.recordBody.children.length + 1}</th><td>${nodeLabel(id, graph.nodes)}</td><td>${g}</td><td>${hVal}</td><td>${f}</td>`;
    el.recordBody.appendChild(row);
  }

  function updateStageLabel(round) {
    el.stageLabel.textContent = `연습 문제 · 단계 ${round.index + 1} / ${rounds.length} · 정점 ${graph.nodes.length}개`;
  }

  function childRowHtml(child, statusLabel) {
    return `<div class="child-row" data-status="${child.status}"><span>${nodeLabel(child.id, graph.nodes)}</span><span>f=${child.newF}</span><span class="child-status">${statusLabel}</span></div>`;
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

    const comparison = round.pickCandidates.map((c) => `${nodeLabel(c.id, graph.nodes)} g(n)=${c.g}, h(n)=${c.h}`).join(" · ");
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
    if (pendingDup) hints.push(`${nodeLabel(pendingDup.id, graph.nodes)}로 가는 두 후보 간선 중 f(n)이 더 작은 쪽을 클릭하세요.`);
    el.prompt.textContent = hints.length ? hints.join(" ") : "새로 바뀔 상태가 없습니다.";

    el.childrenReveal.innerHTML = closedSkipChildren.length
      ? `<p class="children-reveal-hint">${closedSkipChildren.map((c) => `${nodeLabel(c.id, graph.nodes)}은(는) 이미 닫힌 리스트에 있어 다시 열지 않습니다.`).join(" ")}</p>`
      : "";
    if (pendingDup) {
      el.dupQuestion.hidden = false;
      el.dupQuestion.innerHTML = `<p><strong>${nodeLabel(round.expandedId, graph.nodes)}</strong>에서 <strong>${nodeLabel(pendingDup.id, graph.nodes)}</strong>로 가는 새 경로를 찾았습니다. 기존 f(n)=${existingDupF(pendingDup)}와 새 f(n)=${pendingDup.newF}를 비교해 더 작은 값을 선택하세요.</p>`;
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
      <p><strong>${nodeLabel(dup.id, graph.nodes)}</strong>의 기존 f(n)=${existingF}와 새 f(n)=${dup.newF}를 비교했습니다.</p>
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
    el.feedback.innerHTML = `<strong>정답이에요.</strong><p>${nodeLabel(round.expandedId, graph.nodes)}의 f(n)=${round.g}+${round.h}=${round.f}이 가장 작으므로 이 상태를 확정합니다.</p>`;
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
    el.summary.hidden = false;
    renderSummary();
    el.summary.querySelector("h3").focus();
  }

  function renderSummary() {
    const finalRound = rounds.at(-1);
    const path = reconstructPathFromRounds();
    const pathLabel = path.map((id) => nodeLabel(id, graph.nodes)).join(" → ");
    el.summaryText.textContent = `A* 탐색은 ${pathLabel} 경로(비용 ${finalRound.g})를 찾는 데 ${rounds.length}개 상태를 확인했습니다. h(n)이 실제 남은 거리를 넘지 않도록(admissible) 만들어졌기 때문에, 이번에도 A*가 찾은 경로가 가장 싼 경로임이 보장됩니다.`;
  }

  function reconstructPathFromRounds() {
    const parentOf = treeEdgesUpTo(rounds.length);
    const path = [graph.goal];
    let cur = graph.goal;
    while (cur !== graph.start) {
      cur = parentOf.get(cur).parentId;
      path.push(cur);
    }
    return path.reverse();
  }

  function newPracticeGraph() {
    graph = generateRandomGraph({ minNodes: 6, maxNodes: 9 });
    heuristics = generateAdmissibleHeuristics(graph);
    const trace = runAStarGraphTrace(graph, heuristics);
    rounds = buildMapRounds(trace);
    el.summary.hidden = true;
    el.traceArea.hidden = false;
    showRound(0);
    el.traceArea.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  el.newGraphButton.addEventListener("click", newPracticeGraph);
  el.againButton.addEventListener("click", newPracticeGraph);

  enableGraphZoom(el.graph, document.querySelector('[data-zoom-for="map-practice-graph"]'));

  function reveal() {
    el.section.hidden = false;
    if (!graph) newPracticeGraph();
    el.section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }
  document.addEventListener("click", (event) => {
    if (event.target.closest("#map-show-practice")) reveal();
  });

  // ?preview=practice이면(로컬에서만) 지도 4라운드를 끝까지 풀지 않아도 바로 연습 문제를 볼 수 있다.
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalPreview && new URLSearchParams(window.location.search).get("preview") === "practice") reveal();
}
