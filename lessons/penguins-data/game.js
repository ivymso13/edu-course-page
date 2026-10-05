// 펭귄 데이터 인터랙티브 UI 및 렌더링 스크립트
import {
  parsePenguinsCSV,
  calculateDataCleaningStats,
  calculateSpeciesCounts,
  calculateBodyMassStats,
  calculateScatterData,
  filterTableRows,
  evaluateActivity1Answers,
  SPECIES_INFO,
  FEATURE_INFO,
  quantile,
  COLAB_INFO
} from "./game-core.js";

// 상태 변수
let allRows = [];
let speciesStats = null;
let bodyMassStats = null;
let cleaningStats = null;

let tableState = {
  currentPage: 1,
  pageSize: 10,
  query: "",
  species: "all",
  sortKey: "id",
  sortAsc: true
};

let scatterState = {
  xKey: "culmen_length_mm",
  yKey: "culmen_depth_mm",
  colorEnabled: true,
  selectedPointId: null
};

// 런타임 초기화
document.addEventListener("DOMContentLoaded", () => {
  initProjectorMode();
  loadData();
});

// 프로젝터 모드 토글
function initProjectorMode() {
  const btn = document.getElementById("projector-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isPressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", String(!isPressed));
    document.body.classList.toggle("projector-mode", !isPressed);
  });
}

// CSV 데이터 로드 및 초기 렌더링
async function loadData() {
  const errorBanner = document.getElementById("data-fetch-error");
  const tableBody = document.getElementById("penguins-table-body");

  try {
    const response = await fetch("../../data/ml-practice/penguins_size.csv");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 데이터를 읽을 수 없습니다.`);
    }
    const csvText = await response.text();
    allRows = parsePenguinsCSV(csvText);

    if (allRows.length === 0) {
      throw new Error("CSV 데이터가 비어 있거나 올바르지 않습니다.");
    }

    // 통계 계산
    speciesStats = calculateSpeciesCounts(allRows);
    bodyMassStats = calculateBodyMassStats(allRows);
    cleaningStats = calculateDataCleaningStats(allRows);

    // 각 영역 렌더링
    if (tableBody) { initTable(); initActivity1Quiz(); }
    if (document.getElementById("bar-chart-svg")) { initActivity2Graphs(); initObservationInput(); }
  } catch (err) {
    console.error("데이터 로드 실패:", err);
    if (errorBanner) errorBanner.hidden = false;
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #b91c1c;">
        <strong>데이터 로드 실패:</strong> CSV 파일을 불러오지 못했습니다 (${err.message}).
      </td></tr>`;
    }
  }
}

// --- 표(Table) 영역 초기화 및 렌더링 -----------------------------------------
function initTable() {
  const searchInput = document.getElementById("table-search");
  const speciesFilter = document.getElementById("table-species-filter");
  const pageSizeSelect = document.getElementById("table-page-size");

  const btnFirst = document.getElementById("btn-first");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnLast = document.getElementById("btn-last");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      tableState.query = e.target.value;
      tableState.currentPage = 1;
      renderTable();
    });
  }

  if (speciesFilter) {
    speciesFilter.addEventListener("change", (e) => {
      tableState.species = e.target.value;
      tableState.currentPage = 1;
      renderTable();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      tableState.pageSize = Number(e.target.value);
      tableState.currentPage = 1;
      renderTable();
    });
  }

  if (btnFirst) {
    btnFirst.addEventListener("click", () => {
      tableState.currentPage = 1;
      renderTable();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (tableState.currentPage > 1) {
        tableState.currentPage -= 1;
        renderTable();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      tableState.currentPage += 1;
      renderTable();
    });
  }

  if (btnLast) {
    btnLast.addEventListener("click", () => {
      const res = filterTableRows(allRows, tableState);
      tableState.currentPage = res.totalPages;
      renderTable();
    });
  }

  renderTable();
}

function renderTable() {
  const tableBody = document.getElementById("penguins-table-body");
  const statusInfo = document.getElementById("table-status-info");
  const pageIndicator = document.getElementById("page-indicator");
  const rowsCounter = document.getElementById("table-rows-counter");

  const btnFirst = document.getElementById("btn-first");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnLast = document.getElementById("btn-last");

  if (!tableBody) return;

  const result = filterTableRows(allRows, tableState);
  tableState.currentPage = result.currentPage;

  if (statusInfo) {
    if (result.totalFiltered === 0) {
      statusInfo.textContent = "일치하는 데이터가 없습니다.";
    } else {
      statusInfo.textContent = `전체 ${allRows.length}개 중 ${result.startIndex + 1}–${result.endIndex}번째 표시 중 (총 ${result.totalPages}페이지)`;
    }
  }

  if (pageIndicator) {
    pageIndicator.textContent = `${result.currentPage} / ${result.totalPages}`;
  }

  if (rowsCounter) {
    rowsCounter.textContent = `검색 결과: ${result.totalFiltered}행 (전체 ${allRows.length}행)`;
  }

  if (btnFirst) btnFirst.disabled = result.currentPage <= 1;
  if (btnPrev) btnPrev.disabled = result.currentPage <= 1;
  if (btnNext) btnNext.disabled = result.currentPage >= result.totalPages;
  if (btnLast) btnLast.disabled = result.currentPage >= result.totalPages;

  if (result.rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--muted);">
      조건에 맞는 펭귄 데이터를 찾을 수 없습니다.
    </td></tr>`;
    return;
  }

  tableBody.innerHTML = result.rows
    .map((r) => {
      const spInfo = SPECIES_INFO[r.species];
      const spBadge = spInfo
        ? `<span class="species-badge ${spInfo.badgeClass}">${spInfo.symbol} ${spInfo.nameKo}</span>`
        : r.species ?? '<span class="badge-na">NA</span>';

      const formatNum = (v, unit = "") =>
        v === null || Number.isNaN(v)
          ? '<span class="badge-na">NA</span>'
          : `${v}${unit ? " " + unit : ""}`;

      return `<tr>
        <td class="num">${r.id}</td>
        <td>${spBadge}</td>
        <td>${r.island ?? '<span class="badge-na">NA</span>'}</td>
        <td class="num">${formatNum(r.culmen_length_mm)}</td>
        <td class="num">${formatNum(r.culmen_depth_mm)}</td>
        <td class="num">${formatNum(r.flipper_length_mm)}</td>
        <td class="num">${formatNum(r.body_mass_g)}</td>
        <td>${r.sex ?? '<span class="badge-na">NA</span>'}</td>
      </tr>`;
    })
    .join("");
}

// --- 웹 활동 1: 퀴즈 검증 및 결과 공개 ---------------------------------------
function initActivity1Quiz() {
  const checkBtn = document.getElementById("check-activity1-btn");
  if (!checkBtn) return;

  checkBtn.addEventListener("click", () => {
    const qCount = document.querySelector('input[name="q-species-count"]:checked')?.value;
    const qMost = document.querySelector('input[name="q-most-common"]:checked')?.value;
    const qHeaviest = document.querySelector('input[name="q-heaviest"]:checked')?.value;

    if (!qCount || !qMost || !qHeaviest) {
      alert("세 가지 질문에 모두 답을 선택한 후 [그래프로 확인하기]를 눌러주세요.");
      return;
    }

    const evaluation = evaluateActivity1Answers(
      { speciesCount: qCount, mostCommon: qMost, heaviestSpecies: qHeaviest },
      speciesStats,
      bodyMassStats
    );

    renderActivity1Results(evaluation);
  });
}

function renderActivity1Results(evaluation) {
  const revealArea = document.getElementById("activity1-reveal");
  const scoreBadge = document.getElementById("activity1-score-badge");
  const feedbackList = document.getElementById("activity1-feedback-list");

  if (!revealArea) return;
  revealArea.hidden = false;

  let correctCount = 0;
  if (evaluation.q1.correct) correctCount++;
  if (evaluation.q2.correct) correctCount++;
  if (evaluation.q3.correct) correctCount++;

  if (scoreBadge) {
    scoreBadge.className = `score-badge ${correctCount === 3 ? "score-pass" : "score-partial"}`;
    scoreBadge.textContent = `${correctCount} / 3 정답`;
  }

  if (feedbackList) {
    feedbackList.innerHTML = `
      <div class="review-item ${evaluation.q1.correct ? "is-correct" : "is-wrong"}">
        <strong>(a) 펭귄 종류 수: ${evaluation.q1.correct ? "정답! 👏" : "아쉽네요!"}</strong>
        <p>나의 선택: ${evaluation.q1.studentAnswer}가지 / 실제 데이터: <strong>${evaluation.q1.correctAnswer}</strong></p>
        <p>${evaluation.q1.explanation}</p>
      </div>

      <div class="review-item ${evaluation.q2.correct ? "is-correct" : "is-wrong"}">
        <strong>(b) 가장 많은 종류: ${evaluation.q2.correct ? "정답! 👏" : "아쉽네요!"}</strong>
        <p>나의 선택: ${evaluation.q2.studentAnswer} / 실제 데이터: <strong>${evaluation.q2.correctAnswer}</strong></p>
        <p>${evaluation.q2.explanation}</p>
      </div>

      <div class="review-item ${evaluation.q3.correct ? "is-correct" : "is-wrong"}">
        <strong>(c) 대체로 가장 무거운 종류: ${evaluation.q3.correct ? "정답! 👏" : "아쉽네요!"}</strong>
        <p>나의 선택: ${evaluation.q3.studentAnswer} / 실제 데이터: <strong>${evaluation.q3.correctAnswer}</strong></p>
        <p>${evaluation.q3.explanation}</p>
      </div>
    `;
  }

  renderActivity1MiniChart();
  revealArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 활동 1 요약 미니 차트 (SVG)
function renderActivity1MiniChart() {
  const svg = document.getElementById("activity1-mini-chart");
  if (!svg || !speciesStats || !bodyMassStats) return;

  const species = ["Adelie", "Gentoo", "Chinstrap"];
  const maxCount = 160;

  let html = `
    <!-- 배경 눈금선 -->
    <line x1="80" y1="20" x2="80" y2="190" stroke="#cbd5e1" stroke-width="1.5" />
    <line x1="80" y1="190" x2="660" y2="190" stroke="#cbd5e1" stroke-width="1.5" />
    <text x="370" y="215" text-anchor="middle" font-size="12" fill="#64748b">종류별 개체 수(마리) 및 체질량 중앙값(g)</text>
  `;

  species.forEach((s, i) => {
    const y = 35 + i * 50;
    const count = speciesStats.counts[s];
    const med = bodyMassStats.bySpecies[s]?.median ?? 0;
    const sp = SPECIES_INFO[s];
    const barWidth = (count / maxCount) * 380;

    html += `
      <g>
        <text x="70" y="${y + 16}" text-anchor="end" font-size="13" font-weight="700" fill="#1e293b">${sp.nameKo}</text>
        <rect x="80" y="${y}" width="${barWidth}" height="24" rx="4" fill="${sp.color}" />
        <text x="${85 + barWidth}" y="${y + 16}" font-size="12" font-weight="750" fill="${sp.color}">
          ${count}마리 (${speciesStats.percentages[s]}%)
        </text>
        <text x="560" y="${y + 16}" font-size="12" fill="#334155" font-weight="600">
          중앙값: <tspan font-weight="750" fill="${sp.color}">${med}g</tspan>
        </text>
      </g>
    `;
  });

  svg.innerHTML = html;
}

// --- 웹 활동 2: 그래프 렌더링 ------------------------------------------------
function initActivity2Graphs() {
  renderSpeciesBarChart();
  renderBodyMassBoxPlot();
  initScatterPlot();
  updateGuidedQA();
}

// (가) 종류별 개수 막대그래프
function renderSpeciesBarChart() {
  const svg = document.getElementById("bar-chart-svg");
  const rowCountDiv = document.getElementById("bar-chart-row-count");
  if (!svg || !speciesStats) return;

  const species = ["Adelie", "Gentoo", "Chinstrap"];
  const maxCount = 160;

  let html = `
    <!-- 세로 눈금선 -->
    <line x1="120" y1="20" x2="120" y2="175" stroke="#cbd5e1" stroke-width="1.5" />
    <line x1="120" y1="175" x2="660" y2="175" stroke="#cbd5e1" stroke-width="1.5" />
  `;

  // x축 눈금 0, 40, 80, 120, 160
  [0, 40, 80, 120, 160].forEach((tick) => {
    const x = 120 + (tick / maxCount) * 500;
    html += `
      <line x1="${x}" y1="20" x2="${x}" y2="175" stroke="#f1f5f9" stroke-width="1" />
      <line x1="${x}" y1="175" x2="${x}" y2="180" stroke="#94a3b8" stroke-width="1" />
      <text x="${x}" y="195" text-anchor="middle" font-size="11" fill="#64748b">${tick}</text>
    `;
  });

  species.forEach((s, i) => {
    const y = 35 + i * 46;
    const count = speciesStats.counts[s];
    const pct = speciesStats.percentages[s];
    const sp = SPECIES_INFO[s];
    const barWidth = (count / maxCount) * 500;

    html += `
      <g tabindex="0" role="img" aria-label="${sp.nameKo}: ${count}마리 (${pct}%)">
        <text x="110" y="${y + 18}" text-anchor="end" font-size="13" font-weight="700" fill="#1e293b">${sp.symbol} ${sp.nameKo}</text>
        <rect x="120" y="${y}" width="${barWidth}" height="26" rx="4" fill="${sp.color}">
          <title>${sp.nameKo}: ${count}마리 (${pct}%)</title>
        </rect>
        <text x="${130 + barWidth}" y="${y + 18}" font-size="13" font-weight="750" fill="${sp.color}">${count}마리 (${pct}%)</text>
      </g>
    `;
  });

  svg.innerHTML = html;

  if (rowCountDiv) {
    rowCountDiv.innerHTML = `
      <span>📊 <strong>이 그래프에 사용된 행:</strong> ${speciesStats.usedRows}개</span>
      <span style="color:#94a3b8;">|</span>
      <span><strong>결측으로 제외된 행:</strong> ${speciesStats.missingRows}개 (종류 열은 344행 모두 결측 없음)</span>
    `;
  }
}

// (나) 종류별 몸무게 상자그림
function renderBodyMassBoxPlot() {
  const svg = document.getElementById("box-chart-svg");
  const rows = allRows.filter(row => ["species", "island", "culmen_length_mm", "culmen_depth_mm", "flipper_length_mm", "body_mass_g", "sex"].every(key => row[key] !== null && row[key] !== undefined));
  const values = rows.map(row => row.culmen_length_mm).sort((a,b) => a-b);
  const q1 = quantile(values, .25), median = quantile(values, .5), q3 = quantile(values, .75);
  const iqr = q3-q1;
  const within = values.filter(v => v >= q1-1.5*iqr && v <= q3+1.5*iqr);
  const lo = Math.min(...within), hi = Math.max(...within);
  const x = value => 70+(value-30)/32*560;
  svg.innerHTML = `<line x1="70" y1="200" x2="630" y2="200" stroke="#94a3b8"/>
    <line x1="${x(lo)}" y1="100" x2="${x(hi)}" y2="100" stroke="#3158d7" stroke-width="2"/>
    <rect x="${x(q1)}" y="70" width="${x(q3)-x(q1)}" height="60" fill="#dbeafe" stroke="#3158d7"/>
    <line x1="${x(median)}" y1="70" x2="${x(median)}" y2="130" stroke="#3158d7" stroke-width="4"/>
    <text x="${x(median)}" y="50" text-anchor="middle">중앙값 ${median.toFixed(1)} mm</text>
    <text x="350" y="260" text-anchor="middle">부리 길이 (culmen_length_mm)</text>`;
  for (const value of [30,35,40,45,50,55,60]) svg.innerHTML += `<text x="${x(value)}" y="225" text-anchor="middle">${value} mm</text>`;
  for (const value of [lo,hi]) svg.innerHTML += `<line x1="${x(value)}" y1="85" x2="${x(value)}" y2="115" stroke="#3158d7" stroke-width="2"/>`;
  for (const value of values.filter(v => v<lo || v>hi)) svg.innerHTML += `<circle cx="${x(value)}" cy="100" r="4" fill="#b33e4b"/>`;
  document.getElementById("box-chart-row-count").textContent = `노트북과 같이 결측 행 제거 후 부리 길이를 확인합니다. 사용 ${rows.length}행 · 제외 ${allRows.length-rows.length}행 · 수염 밖 점은 이상치 후보입니다.`;
}

// (다) 신체 특징 산점도 초기화 및 이벤트 연결
function initScatterPlot() {
  const xSelect = document.getElementById("scatter-x-select");
  const ySelect = document.getElementById("scatter-y-select");
  const colorToggleBtn = document.getElementById("toggle-color-btn");
  const pointSelect = document.getElementById("keyboard-point-select");

  if (xSelect) {
    xSelect.addEventListener("change", (e) => {
      scatterState.xKey = e.target.value;
      renderScatterPlot();
    });
  }

  if (ySelect) {
    ySelect.addEventListener("change", (e) => {
      scatterState.yKey = e.target.value;
      renderScatterPlot();
    });
  }

  if (colorToggleBtn) {
    colorToggleBtn.addEventListener("click", () => {
      scatterState.colorEnabled = !scatterState.colorEnabled;
      colorToggleBtn.setAttribute("aria-pressed", String(scatterState.colorEnabled));
      colorToggleBtn.textContent = scatterState.colorEnabled
        ? "종류 색상 끄기"
        : "종류 색상 켜기";
      renderScatterPlot();
    });
  }

  if (pointSelect) {
    pointSelect.addEventListener("change", (e) => {
      const pid = Number(e.target.value);
      if (pid) {
        selectScatterPoint(pid);
      }
    });
  }

  renderScatterPlot();
}

// 산점도 렌더링
function renderScatterPlot() {
  const svg = document.getElementById("scatter-chart-svg");
  const rowCountDiv = document.getElementById("scatter-chart-row-count");
  const pointSelect = document.getElementById("keyboard-point-select");
  if (!svg || allRows.length === 0) return;

  const { xKey, yKey, colorEnabled } = scatterState;
  const scatter = calculateScatterData(allRows, xKey, yKey);

  const plotLeft = 65;
  const plotTop = 25;
  const plotWidth = 590;
  const plotHeight = 350;

  // 축 범위 약간 여유 두기
  const xSpan = scatter.xMax - scatter.xMin || 1;
  const ySpan = scatter.yMax - scatter.yMin || 1;
  const xDomainMin = scatter.xMin - xSpan * 0.06;
  const xDomainMax = scatter.xMax + xSpan * 0.06;
  const yDomainMin = scatter.yMin - ySpan * 0.06;
  const yDomainMax = scatter.yMax + ySpan * 0.06;

  const toSvgX = (val) =>
    plotLeft + ((val - xDomainMin) / (xDomainMax - xDomainMin)) * plotWidth;
  const toSvgY = (val) =>
    plotTop + plotHeight - ((val - yDomainMin) / (yDomainMax - yDomainMin)) * plotHeight;

  let html = `
    <!-- 플롯 배경 및 축 -->
    <rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" fill="#fafcff" stroke="#cbd5e1" stroke-width="1.5" />
  `;

  // X축 눈금선 (5개)
  for (let i = 0; i <= 5; i++) {
    const val = xDomainMin + (i / 5) * (xDomainMax - xDomainMin);
    const x = toSvgX(val);
    const displayVal = xKey === "body_mass_g" ? Math.round(val) : val.toFixed(1);
    html += `
      <line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotTop + plotHeight}" stroke="#f1f5f9" stroke-width="1" />
      <line x1="${x}" y1="${plotTop + plotHeight}" x2="${x}" y2="${plotTop + plotHeight + 5}" stroke="#94a3b8" stroke-width="1" />
      <text x="${x}" y="${plotTop + plotHeight + 20}" text-anchor="middle" font-size="11" fill="#64748b">${displayVal}</text>
    `;
  }

  // Y축 눈금선 (5개)
  for (let i = 0; i <= 5; i++) {
    const val = yDomainMin + (i / 5) * (yDomainMax - yDomainMin);
    const y = toSvgY(val);
    const displayVal = yKey === "body_mass_g" ? Math.round(val) : val.toFixed(1);
    html += `
      <line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" stroke="#f1f5f9" stroke-width="1" />
      <line x1="${plotLeft - 5}" y1="${y}" x2="${plotLeft}" y2="${y}" stroke="#94a3b8" stroke-width="1" />
      <text x="${plotLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${displayVal}</text>
    `;
  }

  // 축 제목
  html += `
    <text x="${plotLeft + plotWidth / 2}" y="${plotTop + plotHeight + 42}" text-anchor="middle" font-size="13" font-weight="700" fill="#334155">
      ${scatter.xLabel} (${scatter.xUnit})
    </text>
    <text x="18" y="${plotTop + plotHeight / 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#334155" transform="rotate(-90 18 ${plotTop + plotHeight / 2})">
      ${scatter.yLabel} (${scatter.yUnit})
    </text>
  `;

  // 점(Scatter Points) 그리기
  scatter.points.forEach((p) => {
    const cx = toSvgX(p.x);
    const cy = toSvgY(p.y);
    const sp = SPECIES_INFO[p.species];
    const isSelected = scatterState.selectedPointId === p.id;

    const fill = colorEnabled ? sp.color : "#475569";
    const stroke = isSelected ? "#ef4444" : "#ffffff";
    const strokeWidth = isSelected ? 3 : 1;

    let shapeTag = "";
    if (sp.marker === "circle") {
      shapeTag = `<circle cx="${cx}" cy="${cy}" r="${isSelected ? 7 : 4.5}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (sp.marker === "triangle") {
      const s = isSelected ? 8 : 5.5;
      const points = `${cx},${cy - s * 1.2} ${cx - s},${cy + s * 0.8} ${cx + s},${cy + s * 0.8}`;
      shapeTag = `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else {
      // square
      const size = isSelected ? 12 : 8;
      shapeTag = `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }

    html += `
      <g class="scatter-point-node" data-point-id="${p.id}" tabindex="0" role="button" aria-label="펭귄 #${p.id}: ${sp.nameKo}, ${scatter.xLabel}=${p.x}${scatter.xUnit}, ${scatter.yLabel}=${p.y}${scatter.yUnit}" style="cursor:pointer; outline:none;">
        <title>펭귄 #${p.id} (${sp.nameKo}): ${scatter.xLabel} ${p.x}${scatter.xUnit}, ${scatter.yLabel} ${p.y}${scatter.yUnit}</title>
        ${shapeTag}
      </g>
    `;
  });

  svg.innerHTML = html;

  // 클릭 이벤트 연결
  svg.querySelectorAll(".scatter-point-node").forEach((node) => {
    const pid = Number(node.getAttribute("data-point-id"));
    const handleSelect = () => selectScatterPoint(pid);
    node.addEventListener("click", handleSelect);
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    });
  });

  // 키보드 점 선택 셀렉트 박스 갱신
  if (pointSelect) {
    const currentVal = pointSelect.value;
    pointSelect.innerHTML =
      '<option value="">-- 키보드로 펭귄 선택하기 (ID) --</option>' +
      scatter.points
        .map(
          (p) =>
            `<option value="${p.id}" ${String(p.id) === currentVal ? "selected" : ""}>#${p.id} (${SPECIES_INFO[p.species]?.nameKo}, ${p.island})</option>`
        )
        .join("");
  }

  // 행 수 표시 안내
  if (rowCountDiv) {
    rowCountDiv.innerHTML = `
      <span>📊 <strong>이 그래프에 사용된 행:</strong> ${scatter.usedRows}개</span>
      <span style="color:#94a3b8;">|</span>
      <span><strong>결측으로 제외된 행:</strong> ${scatter.missingRows}개 (${scatter.xLabel}·${scatter.yLabel} 측정값 결측 제외)</span>
    `;
  }
}

// 점 선택 및 인스펙터 정보 표시
function selectScatterPoint(pointId) {
  scatterState.selectedPointId = pointId;
  const targetRow = allRows.find((r) => r.id === pointId);
  const inspectorBody = document.getElementById("point-inspector-body");
  const pointSelect = document.getElementById("keyboard-point-select");

  if (pointSelect && pointSelect.value !== String(pointId)) {
    pointSelect.value = String(pointId);
  }

  // 산점도 하이라이트 재렌더링
  renderScatterPlot();

  if (!targetRow || !inspectorBody) return;

  const sp = SPECIES_INFO[targetRow.species];
  inspectorBody.innerHTML = `
    <div class="point-attr-box">
      <span class="point-attr-name">펭귄 번호</span>
      <strong class="point-attr-val">#${targetRow.id}</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">종류 (species)</span>
      <strong class="point-attr-val" style="color: ${sp?.color ?? "inherit"};">${sp?.nameKo ?? targetRow.species}</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">서식 섬 (island)</span>
      <strong class="point-attr-val">${targetRow.island}</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">부리 길이</span>
      <strong class="point-attr-val">${targetRow.culmen_length_mm ?? "NA"} mm</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">부리 깊이</span>
      <strong class="point-attr-val">${targetRow.culmen_depth_mm ?? "NA"} mm</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">날개 길이</span>
      <strong class="point-attr-val">${targetRow.flipper_length_mm ?? "NA"} mm</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">체질량 (몸무게)</span>
      <strong class="point-attr-val">${targetRow.body_mass_g ?? "NA"} g</strong>
    </div>
    <div class="point-attr-box">
      <span class="point-attr-name">성별 (sex)</span>
      <strong class="point-attr-val">${targetRow.sex ?? "NA"}</strong>
    </div>
  `;
}

// 활동 2 유도 질문 동적 텍스트 갱신
function updateGuidedQA() {
  const qa1 = document.getElementById("guided-qa-1");
  const qa2 = document.getElementById("guided-qa-2");

  if (qa1 && speciesStats) {
    qa1.innerHTML = `
      아델리 펭귄(<strong>${speciesStats.counts.Adelie}마리</strong>, ${speciesStats.percentages.Adelie}%)이 가장 많고,
      턱끈 펭귄(<strong>${speciesStats.counts.Chinstrap}마리</strong>, ${speciesStats.percentages.Chinstrap}%)이 가장 적습니다.
    `;
  }

  if (qa2) qa2.textContent = "부리 길이 상자그림의 가운데 선은 중앙값, 상자는 중간 50% 구간입니다. 수염 밖에 점이 있는지 확인하고, 있다면 원본 값을 다시 살펴보세요. 그래프 밖 점이라고 자동으로 삭제하지는 않습니다.";

}

// 학생 관찰 입력란 처리
function initObservationInput() {
  const saveBtn = document.getElementById("save-observation-btn");
  const textarea = document.getElementById("student-observation");
  const feedback = document.getElementById("observation-feedback");

  if (!saveBtn || !textarea || !feedback) return;

  saveBtn.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) {
      alert("관찰한 특징과 근거가 된 그래프 부분을 간단히 적어주세요.");
      textarea.focus();
      return;
    }

    feedback.hidden = false;
    feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
