// '균일 비용 탐색' 활동 전용 그래프 다이어그램·후보 카드 DOM 렌더링 헬퍼(브라우저 전용, 화면 그리기만 담당).
import { NODES, EDGES, nodeLabel } from "./search-graph-lab.js?v=2026090902";

const NS = "http://www.w3.org/2000/svg";
const VIEW_W = 640;
const VIEW_H = 420;

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function pathEdgeKeys(pathIds) {
  const keys = new Set();
  for (let i = 1; i < pathIds.length; i += 1) {
    keys.add(`${pathIds[i - 1]}|${pathIds[i]}`);
    keys.add(`${pathIds[i]}|${pathIds[i - 1]}`);
  }
  return keys;
}

// statesById: { [nodeId]: "open" | "current" | "closed" | "path" } — 기본값은 미방문.
// gById: { [nodeId]: number|string } — 알려진 값이 있으면 노드 안에 표시한다. 기본은 "g=값"이지만
// metricLabel을 바꾸면(예: "f") 다른 값을 같은 자리에 보여줄 수 있고, metricLabel을 빈 문자열로
// 두면 접두어 없이 gById의 값을 그대로 찍는다(예: "g=4, h=7"처럼 호출자가 이미 완성한 문자열).
// pathIds: 강조해서 그릴 최종 경로(있으면 그 경로의 간선만 굵게 그린다).
// wrongPathIds: pathIds와 별도로, 같은 그래프 위에 함께 빨간색으로 강조할 "잘못된" 경로(둘 다
// 있으면 한 그래프에서 두 경로를 동시에 대비해서 보여줄 수 있다 — 겹치는 간선은 pathIds 쪽
// 초록색이 우선한다, 실제로 최적 경로에 속하는 구간이므로).
// visibleIds: 주어지면 이 노드들만 그린다(=컴퓨터가 지금까지 실제로 발견한 상태만 보이는 성장하는 탐색 트리).
//   생략하면(=null) 전체 학교 지도(모든 노드·모든 간선)를 그린다 — 예측 단계에서만 쓴다.
// edgesOverride: 주어지면 이 간선만 그린다(트리 간선). 생략하면 전체 지도의 모든 간선을 그린다.
// interactiveIds: 주어지면 이 노드들을 클릭·키보드로 선택할 수 있게 만든다(다음에 확장할 상태 고르기,
//   또는 새로 발견한 상태를 오픈 리스트에 추가하기 — interactiveVerb로 문구만 바뀐다).
// interactiveVerb: 인터랙티브 노드의 접근성 레이블 끝에 붙는 동사구. 기본값 "선택하기".
// resultMarks: { [nodeId]: "correct" | "incorrect" } — 방금 고른 결과를 노드 테두리 색으로 표시한다.
// edgesOverride의 각 간선은 { a, b, cost, pending?, pick?, choice?, choiceLabel?, pickLabel?, displayValue? }
// 형태일 수 있다.
// pending이면 아직 오픈 리스트에 넣기 전(발견만 된) 간선으로 점선으로 그려진다.
// pick이 true면 그 간선의 원 자체를 클릭·키보드로 고를 수 있는 단일 버튼으로 만들고(다음에 확장할
// 상태를 그 상태로 이어지는 간선을 눌러 고르거나, 새로 발견한 상태를 간선을 눌러 오픈 리스트에
// 추가할 때 쓴다), cost 대신 displayValue(보통 그 상태의 g값)를 "g=값" 형태로 보여준다. 클릭됐을 때는
// edge.b(도착 노드 id)를 고른 것으로 취급한다(노드를 직접 고르는 것과 같은 데이터를 넘겨준다).
// choice("keep"|"replace")가 있으면 그 간선의 원을 클릭·키보드로 고를 수 있는 두 버튼 중 하나로 만들고,
// cost 대신 displayValue(그 선택지를 골랐을 때의 g값)를 "g=값" 형태로 보여준다(metricLabel과 무관 —
// 오픈 리스트 교체 여부는 항상 g(n) 비교로 정해지므로)
// (중복 상태에서 "기존 값을 유지할까, 새 값으로 교체할까"를 간선 자체를 눌러 결정하게 할 때 쓴다).
// compareById: { [nodeId]: { existingG, newG } } — 지금 중복 판정 중인 노드 아래에 기존
// g(n)과 새로 발견된 g(n)을 서로 다른 색으로 나란히 "기존 g=값 / 새 g=값" 형태로 보여준다
// (metricLabel과 무관하게 항상 g로 표시한다 — 오픈 리스트 교체 여부는 g(n) 비교로 정해지므로).
// metricVariant: "g"(기본) | "h" — 노드 안에 표시하는 gById 값이 g(n)인지 h(n)인지 구분해서
// 다르게 그린다. A* 활동처럼 간선 위 g(n)과 노드 안 h(n)이 한 화면에 같이 보이면 둘 다 파란
// 원+모노스페이스라 헷갈린다는 피드백이 있어, "h"를 넘기면 보라색 알약형 배지로 그려 g(n)과
// 형태·색을 동시에 구분한다(노드의 open/closed/path 등 상태색과 무관하게 항상 보라색 고정 —
// h(n)은 장소 고유의 정적인 값이라는 뜻).
// nodes/edges: 생략하면 고정 학교 그래프를 그린다. 연습 문제의 랜덤 그래프를 그리려면 둘 다 넘긴다.
export function renderGraphDiagram(svgRoot, {
  statesById = {},
  gById = {},
  pathIds = [],
  wrongPathIds = [],
  visibleIds = null,
  edgesOverride = null,
  interactiveIds = null,
  interactiveVerb = "선택하기",
  resultMarks = {},
  compareById = {},
  metricLabel = "g",
  metricVariant = "g",
  nodes: nodesParam,
  edges: edgesParam,
  label,
} = {}) {
  const nodes = nodesParam || NODES;
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  svgRoot.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
  const hasInteractiveEdges = (edgesOverride || []).some((edge) => edge.choice || edge.pick);
  if (interactiveIds || hasInteractiveEdges) svgRoot.removeAttribute("role");
  else svgRoot.setAttribute("role", "img");
  svgRoot.setAttribute("aria-label", label || "학교 장소를 연결한 그래프. 정문에서 매점까지 이동 경로와 각 구간의 비용을 보여준다.");
  svgRoot.innerHTML = "";

  const visible = visibleIds ? new Set(visibleIds) : null;
  const interactive = interactiveIds ? new Set(interactiveIds) : null;
  const edgeList = edgesOverride || edgesParam || EDGES;
  const onPath = pathEdgeKeys(pathIds);
  const onWrongPath = pathEdgeKeys(wrongPathIds);

  for (const edge of edgeList) {
    if (visible && (!visible.has(edge.a) || !visible.has(edge.b))) continue;
    const a = nodesById.get(edge.a);
    const b = nodesById.get(edge.b);
    const isPathEdge = onPath.has(`${edge.a}|${edge.b}`);
    const isWrongPathEdge = onWrongPath.has(`${edge.a}|${edge.b}`);
    const extraClass = `${isPathEdge ? " is-path" : ""}${isWrongPathEdge ? " is-path-wrong" : ""}${edge.pending ? " is-pending" : ""}`;
    const line = svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `graph-edge${extraClass}` });
    svgRoot.appendChild(line);

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (edge.choice) {
      const choiceGroup = svgEl("g", { class: `graph-edge-choice is-pickable is-choice-${edge.choice}${extraClass}`, tabindex: "0", role: "button" });
      choiceGroup.dataset.choice = edge.choice;
      choiceGroup.setAttribute("aria-label", edge.choiceLabel || `${edge.displayText || `g=${edge.displayValue}`} 선택하기`);
      choiceGroup.appendChild(svgEl("circle", { cx: midX, cy: midY, r: 21, class: `graph-edge-cost-bg${extraClass}` }));
      const choiceText = svgEl("text", { x: midX, y: midY, class: `graph-edge-cost graph-edge-choice-value${extraClass}` });
      choiceText.textContent = edge.displayText || `g=${edge.displayValue}`;
      choiceGroup.appendChild(choiceText);
      svgRoot.appendChild(choiceGroup);
    } else if (edge.pick) {
      const pickGroup = svgEl("g", { class: `graph-edge-choice is-pickable${extraClass}`, tabindex: "0", role: "button" });
      pickGroup.dataset.node = edge.b;
      pickGroup.setAttribute("aria-label", edge.pickLabel || `${edge.displayText || `g=${edge.displayValue}`} 선택하기`);
      pickGroup.appendChild(svgEl("circle", { cx: midX, cy: midY, r: 21, class: `graph-edge-cost-bg${extraClass}` }));
      const pickText = svgEl("text", { x: midX, y: midY, class: `graph-edge-cost graph-edge-choice-value${extraClass}` });
      pickText.textContent = edge.displayText || `g=${edge.displayValue}`;
      pickGroup.appendChild(pickText);
      svgRoot.appendChild(pickGroup);
    } else {
      svgRoot.appendChild(svgEl("circle", { cx: midX, cy: midY, r: 17, class: `graph-edge-cost-bg${extraClass}` }));
      const costText = svgEl("text", { x: midX, y: midY, class: `graph-edge-cost${extraClass}` });
      costText.textContent = edge.cost;
      svgRoot.appendChild(costText);
    }
  }

  for (const node of nodes) {
    if (visible && !visible.has(node.id)) continue;
    const isInteractive = interactive?.has(node.id);
    const group = svgEl("g", { class: `graph-node${isInteractive ? " is-pickable" : ""}` });
    group.dataset.node = node.id;
    const state = statesById[node.id];
    if (state) group.dataset.state = state;
    const result = resultMarks[node.id];
    if (result) group.dataset.result = result;
    if (isInteractive) {
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      const gLabel = gById[node.id] != null ? `, ${metricLabel ? `${metricLabel}=` : ""}${gById[node.id]}` : "";
      group.setAttribute("aria-label", `${node.label}${gLabel} ${interactiveVerb}`);
    }

    group.appendChild(svgEl("circle", { cx: node.x, cy: node.y, r: node.radius || 36 }));

    const compare = compareById[node.id];
    const hasG = !compare && gById[node.id] != null;

    // g(n) 값이 간선 위 비용 숫자와 겹쳐 안 보이는 일이 없도록, g 값은 노드 밖이 아니라
    // 원 안에 넣는다. 아이콘·이름·g 값이 몇 줄 들어가는지에 따라 세로 위치를 다시 잡는다.
    if (node.icon) {
      const icon = svgEl("text", { x: node.x, y: hasG ? node.y - 15 : node.y - 5, class: `graph-node-icon${hasG ? " graph-node-icon-compact" : ""}` });
      icon.textContent = node.icon;
      group.appendChild(icon);
    }

    const labelY = node.icon
      ? (hasG ? node.y + 2 : node.y + 18)
      : (hasG ? node.y - 6 : node.y + 5);
    const nameText = svgEl("text", { x: node.x, y: labelY, class: "graph-node-label" });
    nameText.textContent = node.label;
    group.appendChild(nameText);

    if (compare) {
      // 아래쪽은 대부분 간선이 지나가는 방향이라, 비교값은 노드 위쪽 빈 공간에 겹치지 않게 띄우고
      // 배경판을 깔아 혹시 지나가는 선이 있어도 값이 가려지지 않게 한다.
      group.appendChild(svgEl("rect", { x: node.x - 54, y: node.y - 82, width: 108, height: 40, rx: 6, class: "graph-node-compare-bg" }));
      const existingText = svgEl("text", { x: node.x, y: node.y - 66, class: "graph-node-g graph-node-g-existing" });
      existingText.textContent = compare.existingF != null ? `기존 f=${compare.existingF}` : `기존 g=${compare.existingG}`;
      group.appendChild(existingText);
      const newText = svgEl("text", { x: node.x, y: node.y - 50, class: "graph-node-g graph-node-g-new" });
      newText.textContent = compare.newF != null ? `새 f=${compare.newF}` : `새 g=${compare.newG}`;
      group.appendChild(newText);
    } else if (hasG) {
      const gY = node.icon ? node.y + 17 : node.y + 12;
      const valueText = metricLabel ? `${metricLabel}=${gById[node.id]}` : `${gById[node.id]}`;
      if (metricVariant === "h") {
        // 간선 위 g(n) 버블과 형태·색을 동시에 다르게: 원 안 텍스트가 아니라 보라색 알약형
        // 배지로 그려서, 파란 g(n)과 시각적으로 섞이지 않게 한다(노드 상태색과 무관하게 고정).
        group.appendChild(svgEl("rect", {
          x: node.x - 18, y: gY - 8, width: 36, height: 14, rx: 7,
          class: "graph-node-h-badge-bg",
        }));
        const hText = svgEl("text", { x: node.x, y: gY, class: "graph-node-h-badge" });
        hText.textContent = valueText;
        group.appendChild(hText);
      } else {
        const gText = svgEl("text", { x: node.x, y: gY, class: "graph-node-g graph-node-g-inside" });
        gText.textContent = valueText;
        group.appendChild(gText);
      }
    }

    svgRoot.appendChild(group);
  }
}

// 그래프 하나에 확대·축소 버튼을 연결한다. svgEl은 스크롤되는 뷰포트(overflow:auto) 안에 있어야
// 하고, controlsEl 안에는 [data-zoom="out"|"in"|"reset"] 버튼과 [data-zoom-level] 표시 칸이 있어야 한다.
// 페이지의 다른 부분과 무관하게 이 그래프 하나만 커지거나 작아진다(전체 레이아웃은 그대로).
export function enableGraphZoom(svgEl, controlsEl, { min = 0.6, max = 2.2, step = 0.2, maxBase = 700 } = {}) {
  if (!svgEl || !controlsEl) return;
  let scale = 1;
  const viewport = svgEl.parentElement;
  const levelEl = controlsEl.querySelector("[data-zoom-level]");
  const outBtn = controlsEl.querySelector('[data-zoom="out"]');
  const inBtn = controlsEl.querySelector('[data-zoom="in"]');
  const resetBtn = controlsEl.querySelector('[data-zoom="reset"]');

  function apply() {
    const base = Math.min(viewport.clientWidth || maxBase, maxBase);
    const px = `${Math.round(base * scale)}px`;
    // CSS의 max-width:700px가 inline width보다 계속 이겨서 확대가 안 먹는 걸 막으려면
    // max-width도 같이 풀어 줘야 한다.
    svgEl.style.width = px;
    svgEl.style.maxWidth = scale > 1 ? "none" : px;
    if (levelEl) levelEl.textContent = `${Math.round(scale * 100)}%`;
    if (outBtn) outBtn.disabled = scale <= min + 1e-9;
    if (inBtn) inBtn.disabled = scale >= max - 1e-9;
  }

  outBtn?.addEventListener("click", () => {
    scale = Math.max(min, Math.round((scale - step) * 100) / 100);
    apply();
  });
  inBtn?.addEventListener("click", () => {
    scale = Math.min(max, Math.round((scale + step) * 100) / 100);
    apply();
  });
  resetBtn?.addEventListener("click", () => {
    scale = 1;
    apply();
    svgEl.parentElement.scrollTo({ left: 0, top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  apply();

  // 처음 apply()가 실행될 때 이 그래프가 아직 hidden 조상 안에 있으면(예: 탭을 열기 전, 결과를
  // 보기 전) viewport.clientWidth가 0이라 maxBase(700px)로 잘못 고정된다. 나중에 실제로 화면에
  // 나타나 폭이 바뀌는 순간(숨김 해제·2단 그리드처럼 좁은 칸에 들어감·창 크기 변경) 다시
  // 계산해야, 칸 실제 너비에 맞는 크기로 그려진다.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(apply).observe(viewport);
  }
}

// 오픈 리스트/닫힌 리스트를 교과서와 같은 형태의 칩 목록으로 그린다.
// format(entry)를 넘기면 칩에 보일 값을 직접 문자열로 만들 수 있다(예: A*에서 "f=12").
// 생략하면 기존과 같이 entry.g를 그대로 보여준다.
export function renderListPanel(el, { open = [], closed = [], nodes, format } = {}) {
  const chip = (entry) => `<li><span class="chip-name">${nodeLabel(entry.id, nodes)}</span><span class="chip-g">${format ? format(entry) : entry.g}</span></li>`;
  el.querySelector('[data-list="open"]').innerHTML = open.length ? open.map(chip).join("") : '<li class="chip-empty">비어 있음</li>';
  el.querySelector('[data-list="closed"]').innerHTML = closed.length ? closed.map(chip).join("") : '<li class="chip-empty">비어 있음</li>';
}
