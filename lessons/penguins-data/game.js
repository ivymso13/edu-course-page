import { parsePenguinsCSV, FEATURE_INFO, SPECIES_INFO } from "./game-core.js";
import {
  FEATURES,
  SPECIES,
  COLUMNS,
  completeRows,
  cleanRows,
  missingCounts,
  summary,
  fitMinMax,
  transform,
  relation,
  splitRows,
  runModel,
  predict,
} from "./lab-core.js";
const $ = (s) => document.querySelector(s);
const labels = {
  species: "종류",
  island: "서식 섬",
  sex: "성별",
  ...Object.fromEntries(FEATURES.map((k) => [k, FEATURE_INFO[k].labelKo])),
};
const fmt = (n, d = 2) =>
  typeof n === "number"
    ? Number.isInteger(n)
      ? String(n)
      : n.toFixed(d)
    : n === null || n === undefined
      ? "결측"
      : String(n);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const featureName = (k) => `${labels[k]} (${FEATURE_INFO[k].unit})`;
let rows = [];
function table(container, columns, data, caption) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.tabIndex = 0;
  wrap.setAttribute("aria-label", caption + " (좌우 스크롤 가능)");
  const t = document.createElement("table");
  t.className = "lab-table";
  const cap = document.createElement("caption");
  cap.className = "sr-only";
  cap.textContent = caption;
  t.append(cap);
  const head = t.createTHead().insertRow();
  columns.forEach((c) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = typeof c === "string" ? c : c.label;
    head.append(th);
  });
  const body = t.createTBody();
  data.forEach((r) => {
    const tr = body.insertRow();
    columns.forEach((c, i) => {
      const v = Array.isArray(r) ? r[i] : r[c.key];
      const td = tr.insertCell();
      td.textContent = fmt(v);
      if (v === null || v === undefined) td.className = "missing";
    });
  });
  wrap.append(t);
  container.replaceChildren(wrap);
  return t;
}
function dataTable(container, data, caption) {
  table(
    container,
    [
      { key: "id", label: "원본 행 번호" },
      ...COLUMNS.map((k) => ({
        key: k,
        label: FEATURES.includes(k) ? featureName(k) : labels[k],
      })),
    ],
    data,
    caption,
  );
}
function metrics(container, items) {
  container.replaceChildren(
    ...items.map(([label, value]) => {
      const box = document.createElement("div");
      box.className = "metric";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      box.append(span, strong);
      return box;
    }),
  );
}
function options(select, values = FEATURES, selected) {
  select.replaceChildren(
    ...values.map((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = labels[k] || k;
      return o;
    }),
  );
  if (selected) select.value = selected;
}
function text(x, y, s, extra = "") {
  return `<text x="${x}" y="${y}" ${extra}>${esc(s)}</text>`;
}
function line(x1, y1, x2, y2, color = "#d7dce5", width = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}
function barChart() {
  const max = 180;
  let svg = "";
  for (let i = 0; i <= 3; i++) {
    const v = i * 60,
      y = 300 - (v / max) * 245;
    svg += line(65, y, 720, y) + text(55, y + 4, v, 'text-anchor="end"');
  }
  SPECIES.forEach((sp, i) => {
    const count = rows.filter((r) => r.species === sp).length,
      x = 150 + i * 210,
      h = (count / max) * 245;
    svg +=
      `<rect x="${x - 45}" y="${300 - h}" width="90" height="${h}" fill="${SPECIES_INFO[sp].color}"/>` +
      text(x, 288 - h, count, 'text-anchor="middle"') +
      text(x, 327, sp, 'text-anchor="middle"');
  });
  svg += text(30, 24, "개수 (마리)");
  $("#species-chart").innerHTML = svg;
}
function initData() {
  let page = 0;
  function render() {
    const term = $("#table-search").value.trim().toLowerCase(),
      size = Number($("#table-size").value),
      filtered = rows.filter((r) =>
        COLUMNS.some((k) =>
          String(r[k] ?? "결측")
            .toLowerCase()
            .includes(term),
        ),
      );
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pages - 1);
    dataTable(
      $("#raw-table"),
      filtered.slice(page * size, (page + 1) * size),
      "펭귄 원본 데이터",
    );
    $("#raw-table tbody")?.setAttribute("id", "penguins-table-body");
    $("#table-status").textContent =
      `${filtered.length}행 · ${page + 1}/${pages}쪽`;
    $("#previous-page").disabled = page === 0;
    $("#next-page").disabled = page >= pages - 1;
  }
  $("#table-search").addEventListener("input", () => {
    page = 0;
    render();
  });
  $("#table-size").addEventListener("change", () => {
    page = 0;
    render();
  });
  $("#previous-page").onclick = () => {
    page--;
    render();
  };
  $("#next-page").onclick = () => {
    page++;
    render();
  };
  render();
  table(
    $("#schema-table"),
    ["속성", "열 이름", "자료형", "값이 있는 행", "고유한 값"],
    COLUMNS.map((k) => [
      labels[k],
      k,
      FEATURES.includes(k) ? "숫자" : "문자열",
      rows.filter((r) => r[k] !== null).length,
      FEATURES.includes(k)
        ? "—"
        : [...new Set(rows.map((r) => r[k]).filter((v) => v !== null))].join(
            ", ",
          ),
    ]),
    "속성과 자료형",
  );
  table(
    $("#summary-table"),
    [
      "속성",
      "개수",
      "평균",
      "표준편차",
      "최솟값",
      "25%",
      "중앙값",
      "75%",
      "최댓값",
    ],
    FEATURES.map((k) => {
      const s = summary(rows, k);
      return [
        featureName(k),
        s.count,
        s.mean,
        s.std,
        s.min,
        s.q1,
        s.median,
        s.q3,
        s.max,
      ];
    }),
    "숫자 속성 통계 · 결측값 제외",
  );
  barChart();
}
function initCleaning() {
  let stage = 0;
  const completed = completeRows(rows),
    cleaned = cleanRows(rows);
  table(
    $("#missing-table"),
    ["속성", "결측값 개수"],
    missingCounts(rows).map((x) => [labels[x.key], x.count]),
    "원본 데이터의 속성별 결측값",
  );
  function render() {
    const current = stage === 0 ? rows : stage === 1 ? completed : cleaned,
      previous = stage === 1 ? rows : stage === 2 ? completed : [];
    const ids = new Set(current.map((r) => r.id)),
      removed = previous.filter((r) => !ids.has(r.id));
    metrics($("#cleaning-status"), [
      ["원본", `${rows.length}행`],
      ["현재", `${current.length}행`],
      ["누적 제외", `${rows.length - current.length}행`],
    ]);
    $("#drop-missing").disabled = stage !== 0;
    $("#drop-sex").disabled = stage !== 1;
    $("#normalize").disabled = stage < 2;
    if (stage < 2) $("#normalize").checked = false;
    $("#unique-values").textContent =
      `현재 species 고유값: ${[...new Set(current.map((r) => r.species))].join(", ")} · sex 고유값: ${[...new Set(current.map((r) => (r.sex === null ? "결측" : r.sex)))].join(", ")}`;
    dataTable(
      $("#cleaning-table"),
      $("#cleaning-view").value === "all" ? current : current.slice(0, 10),
      "현재 단계의 데이터",
    );
    dataTable($("#removed-table"), removed, "이번 단계에서 제외된 행");
    if (stage === 2) {
      const scaler = fitMinMax(cleaned);
      table(
        $("#normalization-ranges"),
        ["속성", "기준 최솟값", "기준 최댓값"],
        FEATURES.map((k) => [featureName(k), scaler[k].min, scaler[k].max]),
        "정규화 기준 · 정리한 333행",
      );
      const data = $("#normalize").checked
        ? transform(cleaned, scaler)
        : cleaned;
      table(
        $("#normalized-table"),
        [
          { key: "id", label: "원본 행 번호" },
          ...FEATURES.map((k) => ({
            key: k,
            label: $("#normalize").checked
              ? `${labels[k]} (0~1)`
              : featureName(k),
          })),
        ],
        data.slice(0, 10),
        "정규화 전후 첫 10행",
      );
    } else {
      $("#normalization-ranges").textContent =
        "먼저 두 단계의 행 정리를 완료하세요.";
      $("#normalized-table").replaceChildren();
    }
  }
  $("#drop-missing").onclick = () => {
    stage = 1;
    render();
  };
  $("#drop-sex").onclick = () => {
    stage = 2;
    render();
  };
  $("#reset-cleaning").onclick = () => {
    stage = 0;
    render();
  };
  $("#normalize").onchange = render;
  $("#cleaning-view").onchange = render;
  render();
}
function initGraphs() {
  const cleaned = cleanRows(rows),
    complete = completeRows(rows),
    scaled = transform(cleaned, fitMinMax(cleaned));
  options($("#box-feature"));
  options($("#scatter-x"), FEATURES, "culmen_length_mm");
  options($("#scatter-y"), FEATURES, "culmen_depth_mm");
  $("#species-legend").replaceChildren(
    ...SPECIES.map((sp) => {
      const span = document.createElement("span");
      span.style.color = SPECIES_INFO[sp].color;
      span.textContent = `${SPECIES_INFO[sp].symbol} ${sp}`;
      return span;
    }),
  );
  function box() {
    const k = $("#box-feature").value,
      s = summary(complete, k),
      low = s.q1 - 1.5 * (s.q3 - s.q1),
      high = s.q3 + 1.5 * (s.q3 - s.q1),
      inside = complete.map((r) => r[k]).filter((v) => v >= low && v <= high),
      lo = Math.min(...inside),
      hi = Math.max(...inside),
      range = s.max - s.min || 1,
      x = (v) => 70 + ((v - s.min) / range) * 620;
    let out = "";
    for (let i = 0; i <= 4; i++) {
      const v = s.min + (range * i) / 4;
      out +=
        line(x(v), 270, x(v), 277) +
        text(x(v), 300, fmt(v), 'text-anchor="middle"');
    }
    out +=
      line(70, 270, 690, 270) +
      line(x(lo), 160, x(hi), 160, "#626b7b", 2) +
      line(x(lo), 135, x(lo), 185, "#626b7b", 2) +
      line(x(hi), 135, x(hi), 185, "#626b7b", 2) +
      `<rect x="${x(s.q1)}" y="115" width="${x(s.q3) - x(s.q1)}" height="90" fill="#dbeafe" stroke="#2563eb"/>` +
      line(x(s.median), 115, x(s.median), 205, "#2563eb", 3);
    complete
      .filter((r) => r[k] < lo || r[k] > hi)
      .forEach((r) => {
        out += `<circle cx="${x(r[k])}" cy="160" r="5" fill="#d97706"><title>원본 ${r.id}번 행 · ${r[k]}</title></circle>`;
      });
    out +=
      text(380, 335, featureName(k), 'text-anchor="middle"') +
      text(380, 65, "결측 행 제거 후 334행", 'text-anchor="middle"');
    $("#box-chart").innerHTML = out;
    table(
      $("#box-summary"),
      ["수염 최솟값", "25%", "중앙값", "75%", "수염 최댓값"],
      [[lo, s.q1, s.median, s.q3, hi]],
      "상자그림의 요약 값",
    );
  }
  let plotRows = cleaned;
  function pointInfo() {
    const id = Number($("#keyboard-point-select").value),
      r = plotRows.find((r) => r.id === id);
    if (!r) return;
    const normalized = $("#scatter-scale").value === "normalized";
    $("#point-inspector").textContent =
      `원본 ${r.id}번 행 · ${r.species} · ${labels[$("#scatter-x").value]}: ${fmt(r[$("#scatter-x").value], 3)}${normalized ? "" : ` ${FEATURE_INFO[$("#scatter-x").value].unit}`} · ${labels[$("#scatter-y").value]}: ${fmt(r[$("#scatter-y").value], 3)}${normalized ? "" : ` ${FEATURE_INFO[$("#scatter-y").value].unit}`}`;
  }
  function scatter() {
    const xKey = $("#scatter-x").value,
      yKey = $("#scatter-y").value,
      normalized = $("#scatter-scale").value === "normalized",
      colored = $("#species-color").checked;
    plotRows = normalized ? scaled : cleaned;
    const xs = summary(plotRows, xKey),
      ys = summary(plotRows, yKey),
      dx = xs.max - xs.min || 1,
      dy = ys.max - ys.min || 1,
      x = (v) => 75 + ((v - xs.min) / dx) * 620,
      y = (v) => 285 - ((v - ys.min) / dy) * 235;
    let svg = "";
    for (let i = 0; i <= 4; i++) {
      const xv = xs.min + (dx * i) / 4,
        yv = ys.min + (dy * i) / 4;
      svg +=
        line(x(xv), 50, x(xv), 285) +
        line(75, y(yv), 695, y(yv)) +
        text(x(xv), 308, fmt(xv), 'text-anchor="middle"') +
        text(65, y(yv) + 4, fmt(yv), 'text-anchor="end"');
    }
    svg +=
      line(75, 285, 695, 285, "#626b7b") +
      line(75, 50, 75, 285, "#626b7b") +
      text(
        385,
        345,
        normalized ? `${labels[xKey]} (0~1)` : featureName(xKey),
        'text-anchor="middle"',
      ) +
      text(75, 25, normalized ? `${labels[yKey]} (0~1)` : featureName(yKey));
    for (const r of plotRows) {
      const cx = x(r[xKey]),
        cy = y(r[yKey]),
        color = colored ? SPECIES_INFO[r.species].color : "#64748b",
        attr = `data-point="${r.id}" fill="${color}" opacity=".72"`,
        title = `<title>원본 ${r.id}번 행 · ${r.species} · ${fmt(r[xKey])}, ${fmt(r[yKey])}</title>`;
      if (colored && r.species === "Gentoo")
        svg += `<path d="M ${cx} ${cy - 4} l 4 8 h -8 Z" ${attr}>${title}</path>`;
      else if (colored && r.species === "Chinstrap")
        svg += `<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" ${attr}>${title}</rect>`;
      else
        svg += `<circle cx="${cx}" cy="${cy}" r="3.5" ${attr}>${title}</circle>`;
    }
    const rel = relation(plotRows, xKey, yKey);
    if ($("#regression").checked)
      svg += `<defs><clipPath id="regression-clip"><rect x="75" y="50" width="620" height="235"/></clipPath></defs><g clip-path="url(#regression-clip)">${line(x(xs.min), y(rel.slope * xs.min + rel.intercept), x(xs.max), y(rel.slope * xs.max + rel.intercept), "#16181f", 2)}</g>`;
    $("#scatter-chart-svg").innerHTML = svg;
    $("#scatter-status").textContent =
      `333행 · 상관계수 r = ${rel.r.toFixed(3)}${$("#regression").checked ? " · 회귀선은 전체 데이터의 최소제곱 직선입니다." : ""}`;
    $("#species-legend").hidden = !colored;
    const selected = $("#keyboard-point-select").value;
    $("#keyboard-point-select").replaceChildren(
      ...plotRows.map((r) => {
        const o = document.createElement("option");
        o.value = r.id;
        o.textContent = `원본 ${r.id}번 행 · ${r.species}`;
        return o;
      }),
    );
    if (plotRows.some((r) => String(r.id) === selected))
      $("#keyboard-point-select").value = selected;
    pointInfo();
  }
  $("#scatter-chart-svg").onclick = (e) => {
    const point = e.target.closest("[data-point]");
    if (point) {
      $("#keyboard-point-select").value = point.dataset.point;
      pointInfo();
    }
  };
  $("#keyboard-point-select").onchange = pointInfo;
  $("#box-feature").onchange = box;
  for (const id of [
    "scatter-x",
    "scatter-y",
    "scatter-scale",
    "species-color",
    "regression",
  ])
    $("#" + id).onchange = scatter;
  const t = table(
    $("#correlation-matrix"),
    ["속성", ...FEATURES.map((k) => labels[k])],
    FEATURES.map((k) => [
      labels[k],
      ...FEATURES.map((other) => relation(cleaned, k, other).r.toFixed(2)),
    ]),
    "숫자 속성의 Pearson 상관계수 · 333행",
  );
  t.classList.add("matrix");
  [...t.tBodies[0].rows].forEach((tr) =>
    [...tr.cells].slice(1).forEach((td) => {
      const v = Number(td.textContent),
        alpha = Math.abs(v) * 0.28;
      td.style.background =
        v >= 0 ? `rgba(37,99,235,${alpha})` : `rgba(217,119,6,${alpha})`;
    }),
  );
  box();
  scatter();
}
function initModel() {
  let model = null;
  const clean = cleanRows(rows);
  FEATURES.forEach((k) => {
    const label = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.value = k;
    input.checked = true;
    label.append(input, document.createTextNode(labels[k]));
    $("#model-features").append(label);
  });
  const settings = () => ({
    features: [...$("#model-features").querySelectorAll("input:checked")].map(
      (i) => i.value,
    ),
    testRatio: Number($("#test-ratio").value),
    maxDepth: Number($("#tree-depth").value),
    seed: Number($("#model-seed").value),
    normalize: $("#model-normalize").checked,
  });
  function invalidate() {
    model = null;
    $("#model-results").hidden = true;
    const s = settings();
    const valid =
      s.features.length &&
      Number.isInteger(s.seed) &&
      s.seed >= 0 &&
      s.seed <= 99999;
    $("#train-model").disabled = !valid;
    $("#model-status").textContent = valid
      ? "설정을 바꾼 뒤에는 다시 학습하세요."
      : "입력 속성을 선택하고 seed를 0~99999 사이 정수로 입력하세요.";
    if (valid) {
      const split = splitRows(clean, s.testRatio, s.seed);
      $("#split-preview").textContent =
        `훈련 ${split.train.length}행 · 검증 ${split.test.length}행 · 종류별 비율 유지 · seed ${s.seed}`;
    }
  }
  function treeNode(node) {
    const el = document.createElement(node.feature ? "details" : "div");
    el.className = "tree-node";
    if (node.feature) el.open = node.depth < 2;
    const title = document.createElement(node.feature ? "summary" : "strong");
    title.textContent = node.feature
      ? `${labels[node.feature]} ≤ ${fmt(node.threshold, 3)}${model.scaler ? " (정규화)" : ` ${FEATURE_INFO[node.feature].unit}`}`
      : `예측: ${node.prediction}`;
    const note = document.createElement("small");
    note.textContent = `훈련 ${node.samples}행 · ${SPECIES.map((sp, i) => `${sp} ${node.distribution[i]}`).join(" / ")}`;
    el.append(title, note);
    if (node.feature) {
      for (const [label, child] of [
        ["조건을 만족", node.left],
        ["조건을 만족하지 않음", node.right],
      ]) {
        const branch = document.createElement("p");
        branch.className = "branch";
        branch.textContent = label;
        el.append(branch, treeNode(child));
      }
    }
    return el;
  }
  function inspect() {
    if (!model) return;
    const row = model.test.find(
      (r) => r.id === Number($("#prediction-row").value),
    );
    if (!row) return;
    const prediction = predict(model.tree, row);
    const box = document.createElement("div");
    box.className = "point-card";
    box.textContent = `원본 ${row.id}번 행 · 실제: ${row.species} · 예측: ${prediction} · ${prediction === row.species ? "일치" : "불일치"}`;
    $("#prediction-detail").replaceChildren(box);
    table(
      $("#prediction-detail").appendChild(document.createElement("div")),
      ["입력 속성", "모델에 입력한 값"],
      model.features.map((k) => [
        model.scaler ? `${labels[k]} (정규화)` : featureName(k),
        row[k],
      ]),
      "선택한 검증 행의 입력 값",
    );
  }
  for (const el of document.querySelectorAll(
    "#model-features input,#test-ratio,#tree-depth,#model-seed,#model-normalize",
  ))
    el.addEventListener("input", invalidate);
  $("#train-model").onclick = () => {
    try {
      model = runModel(rows, settings());
      metrics($("#model-metrics"), [
        ["훈련 데이터", `${model.train.length}행`],
        ["검증 데이터", `${model.test.length}행`],
        ["훈련 정확도", `${(model.training.accuracy * 100).toFixed(1)}%`],
        ["검증 정확도", `${(model.validation.accuracy * 100).toFixed(1)}%`],
      ]);
      $("#decision-tree").replaceChildren(treeNode(model.tree));
      const t = table(
        $("#confusion-matrix"),
        ["실제 ↓ / 예측 →", ...SPECIES],
        SPECIES.map((sp, i) => [sp, ...model.validation.matrix[i]]),
        "검증 데이터 혼동행렬",
      );
      t.classList.add("matrix");
      [...t.tBodies[0].rows].forEach((tr, i) =>
        [...tr.cells].slice(1).forEach((td, j) => {
          if (i === j) td.style.background = "#dbeafe";
        }),
      );
      $("#prediction-row").replaceChildren(
        ...model.test.map((r) => {
          const o = document.createElement("option");
          o.value = r.id;
          o.textContent = `원본 ${r.id}번 행 · 실제 ${r.species}`;
          return o;
        }),
      );
      inspect();
      $("#model-results").hidden = false;
      $("#model-status").textContent =
        `학습 완료 · 검증에서 ${model.validation.total}행 중 ${model.validation.correct}행의 종류를 맞혔습니다.`;
    } catch (error) {
      $("#model-status").textContent = error.message;
      $("#model-results").hidden = true;
    }
  };
  $("#prediction-row").onchange = inspect;
  invalidate();
}
$("#projector-toggle").onclick = () => {
  const active = document.body.classList.toggle("projector-mode");
  $("#projector-toggle").setAttribute("aria-pressed", String(active));
};
try {
  const response = await fetch("../../data/ml-practice/penguins_size.csv");
  if (!response.ok) throw Error("CSV 응답 오류");
  rows = parsePenguinsCSV(await response.text());
  if (rows.length !== 344) throw Error("CSV 행 수 확인 필요");
  const init = {
    "penguins-data": initData,
    "penguins-cleaning": initCleaning,
    "penguins-graphs": initGraphs,
    "penguins-model": initModel,
  }[document.body.dataset.lab];
  init();
  $("#load-status").hidden = true;
  $("#lab-content").hidden = false;
} catch (error) {
  $("#load-status").classList.add("error");
  $("#load-status").setAttribute("role", "alert");
  $("#load-status").textContent =
    `데이터를 불러오지 못했습니다. 새로고침해 주세요. (${error.message})`;
}
