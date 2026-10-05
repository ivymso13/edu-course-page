// 펭귄 데이터셋(344행 7열) 분석 및 통계 계산 순수 로직 모듈 (DOM 의존 없음)

export const SPECIES_INFO = {
  Adelie: {
    key: "Adelie",
    nameKo: "아델리 펭귄",
    color: "#2563eb", // blue-600
    colorLight: "#dbeafe",
    marker: "circle",
    symbol: "●",
    badgeClass: "species-adelie"
  },
  Gentoo: {
    key: "Gentoo",
    nameKo: "젠투 펭귄",
    color: "#059669", // emerald-600
    colorLight: "#d1fae5",
    marker: "triangle",
    symbol: "▲",
    badgeClass: "species-gentoo"
  },
  Chinstrap: {
    key: "Chinstrap",
    nameKo: "턱끈 펭귄",
    color: "#d97706", // amber-600
    colorLight: "#fef3c7",
    marker: "square",
    symbol: "■",
    badgeClass: "species-chinstrap"
  }
};

export const FEATURE_INFO = {
  culmen_length_mm: {
    key: "culmen_length_mm",
    labelKo: "부리 길이",
    unit: "mm",
    descKo: "부리의 위쪽 능선(culmen) 길이"
  },
  culmen_depth_mm: {
    key: "culmen_depth_mm",
    labelKo: "부리 깊이",
    unit: "mm",
    descKo: "부리의 상하 두께(depth)"
  },
  flipper_length_mm: {
    key: "flipper_length_mm",
    labelKo: "날개 길이",
    unit: "mm",
    descKo: "펭귄의 물갈퀴(날개) 길이"
  },
  body_mass_g: {
    key: "body_mass_g",
    labelKo: "체질량",
    unit: "g",
    descKo: "펭귄의 몸무게"
  }
};

export const COLAB_INFO = {
  colabUrl: "https://colab.research.google.com/github/ivymso13/edu-course-page/blob/design-course-system/data/ml-practice/penguins-student.ipynb",
  csvDownloadUrl: "../../data/ml-practice/penguins_size.csv",
  ipynbDownloadUrl: "../../data/ml-practice/penguins-student.ipynb",
  notices: [
    "파일 → Drive에 사본 저장 후, 자신의 사본에 작업을 저장합니다.",
    "세션에 업로드한 CSV는 런타임이 초기화되면 다시 업로드해야 합니다.",
    "수업 중에는 우리 반 클래스룸의 안내에 따라 실습하고 제출하세요."
  ]
};

// CSV 텍스트 파싱
export function parsePenguinsCSV(text) {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const parseNum = (val) => (val === "NA" || val === "" || val === undefined ? null : Number(val));
    const parseStr = (val) => (val === "NA" || val === "" || val === undefined ? null : val);
    rows.push({
      id: i,
      species: parseStr(parts[0]),
      island: parseStr(parts[1]),
      culmen_length_mm: parseNum(parts[2]),
      culmen_depth_mm: parseNum(parts[3]),
      flipper_length_mm: parseNum(parts[4]),
      body_mass_g: parseNum(parts[5]),
      sex: parseStr(parts[6])
    });
  }
  return rows;
}

// 결측치 및 전처리 규칙 검증 통계
export function calculateDataCleaningStats(rows) {
  const totalRaw = rows.length;
  const missingRows = rows.filter((r) =>
    r.species === null ||
    r.island === null ||
    r.culmen_length_mm === null ||
    r.culmen_depth_mm === null ||
    r.flipper_length_mm === null ||
    r.body_mass_g === null ||
    r.sex === null
  );
  const rowsAfterDropna = rows.filter((r) =>
    r.species !== null &&
    r.island !== null &&
    r.culmen_length_mm !== null &&
    r.culmen_depth_mm !== null &&
    r.flipper_length_mm !== null &&
    r.body_mass_g !== null &&
    r.sex !== null
  );
  const dotSexRows = rowsAfterDropna.filter((r) => r.sex === ".");
  const rowsAfterClean = rowsAfterDropna.filter((r) => r.sex !== ".");

  return {
    totalRaw,
    missingRowsCount: missingRows.length,
    rowsAfterDropnaCount: rowsAfterDropna.length,
    dotSexRowsCount: dotSexRows.length,
    rowsAfterCleanCount: rowsAfterClean.length,
    rowsAfterClean
  };
}

// 종별 개수 집계
export function calculateSpeciesCounts(rows) {
  const counts = { Adelie: 0, Gentoo: 0, Chinstrap: 0 };
  let usedRows = 0;
  for (const r of rows) {
    if (r.species && counts[r.species] !== undefined) {
      counts[r.species] += 1;
      usedRows += 1;
    }
  }
  const total = rows.length;
  const missingRows = total - usedRows;

  let mostCommon = null;
  let leastCommon = null;
  let maxCount = -1;
  let minCount = Infinity;

  const percentages = {};
  for (const [s, count] of Object.entries(counts)) {
    percentages[s] = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    if (count > maxCount) {
      maxCount = count;
      mostCommon = s;
    }
    if (count < minCount) {
      minCount = count;
      leastCommon = s;
    }
  }

  const distinctCount = Object.keys(counts).filter((k) => counts[k] > 0).length;

  return {
    counts,
    total,
    usedRows,
    missingRows,
    percentages,
    mostCommon,
    leastCommon,
    distinctCount
  };
}

// 섬별 개수 집계
export function calculateIslandCounts(rows) {
  const counts = { Biscoe: 0, Dream: 0, Torgersen: 0 };
  let usedRows = 0;
  for (const r of rows) {
    if (r.island && counts[r.island] !== undefined) {
      counts[r.island] += 1;
      usedRows += 1;
    }
  }
  return {
    counts,
    total: rows.length,
    usedRows,
    missingRows: rows.length - usedRows
  };
}

// 성별 집계
export function calculateSexCounts(rows) {
  const counts = { MALE: 0, FEMALE: 0, NA: 0, ".": 0 };
  for (const r of rows) {
    if (r.sex === null) {
      counts.NA += 1;
    } else if (counts[r.sex] !== undefined) {
      counts[r.sex] += 1;
    } else {
      counts[r.sex] = 1;
    }
  }
  return counts;
}

// 중앙값 계산
export function calculateMedian(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = arr.filter((v) => v !== null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 분위수 계산 (linear interpolation)
export function quantile(arr, q) {
  if (!arr || arr.length === 0) return 0;
  const sorted = arr.filter((v) => v !== null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// 종별 몸무게 통계 및 상자그림 데이터 계산
export function calculateBodyMassStats(rows) {
  const speciesList = ["Adelie", "Gentoo", "Chinstrap"];
  const bySpecies = {};
  let totalUsed = 0;
  let totalMissing = 0;
  let heaviestSpecies = null;
  let maxMedian = -Infinity;

  for (const s of speciesList) {
    const sRows = rows.filter((r) => r.species === s);
    const validWeights = sRows
      .map((r) => r.body_mass_g)
      .filter((v) => v !== null && !Number.isNaN(v))
      .sort((a, b) => a - b);

    const sMissing = sRows.length - validWeights.length;
    totalUsed += validWeights.length;
    totalMissing += sMissing;

    const min = validWeights.length > 0 ? validWeights[0] : 0;
    const max = validWeights.length > 0 ? validWeights[validWeights.length - 1] : 0;
    const q1 = quantile(validWeights, 0.25);
    const med = calculateMedian(validWeights) ?? 0;
    const q3 = quantile(validWeights, 0.75);
    const iqr = q3 - q1;
    const sum = validWeights.reduce((a, b) => a + b, 0);
    const mean = validWeights.length > 0 ? Math.round(sum / validWeights.length) : 0;

    if (med > maxMedian) {
      maxMedian = med;
      heaviestSpecies = s;
    }

    bySpecies[s] = {
      species: s,
      nameKo: SPECIES_INFO[s]?.nameKo ?? s,
      count: validWeights.length,
      missingCount: sMissing,
      min,
      q1,
      median: med,
      q3,
      max,
      iqr,
      mean
    };
  }

  const allValidWeights = rows
    .map((r) => r.body_mass_g)
    .filter((v) => v !== null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  return {
    bySpecies,
    totalRows: rows.length,
    usedRows: totalUsed,
    missingRows: totalMissing,
    globalMin: allValidWeights[0] ?? 2500,
    globalMax: allValidWeights[allValidWeights.length - 1] ?? 6500,
    heaviestSpecies
  };
}

// 산점도 데이터 계산
export function calculateScatterData(rows, xKey = "culmen_length_mm", yKey = "culmen_depth_mm") {
  const points = [];
  let missingRows = 0;

  for (const r of rows) {
    const xVal = r[xKey];
    const yVal = r[yKey];
    if (xVal === null || Number.isNaN(xVal) || yVal === null || Number.isNaN(yVal)) {
      missingRows += 1;
      continue;
    }
    points.push({
      id: r.id,
      species: r.species,
      island: r.island,
      sex: r.sex,
      x: xVal,
      y: yVal,
      raw: r
    });
  }

  const xVals = points.map((p) => p.x);
  const yVals = points.map((p) => p.y);
  const xMin = xVals.length > 0 ? Math.min(...xVals) : 0;
  const xMax = xVals.length > 0 ? Math.max(...xVals) : 100;
  const yMin = yVals.length > 0 ? Math.min(...yVals) : 0;
  const yMax = yVals.length > 0 ? Math.max(...yVals) : 100;

  return {
    points,
    xKey,
    yKey,
    xLabel: FEATURE_INFO[xKey]?.labelKo ?? xKey,
    yLabel: FEATURE_INFO[yKey]?.labelKo ?? yKey,
    xUnit: FEATURE_INFO[xKey]?.unit ?? "",
    yUnit: FEATURE_INFO[yKey]?.unit ?? "",
    totalRows: rows.length,
    usedRows: points.length,
    missingRows,
    xMin,
    xMax,
    yMin,
    yMax
  };
}

// 표 검색 및 페이지네이션 필터
export function filterTableRows(
  rows,
  { query = "", species = "all", page = 1, pageSize = 10, sortKey = "id", sortAsc = true } = {}
) {
  let filtered = rows;

  if (species && species !== "all") {
    filtered = filtered.filter((r) => r.species === species);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      const matchSpecies =
        (r.species || "").toLowerCase().includes(q) ||
        (SPECIES_INFO[r.species]?.nameKo ?? "").toLowerCase().includes(q);
      const matchIsland = (r.island || "").toLowerCase().includes(q);
      const matchSex = (r.sex || "").toLowerCase().includes(q);
      const matchId = String(r.id) === q;
      return matchSpecies || matchIsland || matchSex || matchId;
    });
  }

  if (sortKey) {
    filtered = filtered.slice().sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }

  const totalFiltered = filtered.length;
  const actualPageSize = pageSize === 0 ? totalFiltered : Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / actualPageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * actualPageSize;
  const pageRows = filtered.slice(startIndex, startIndex + actualPageSize);

  return {
    rows: pageRows,
    totalFiltered,
    totalPages,
    currentPage,
    startIndex,
    endIndex: Math.min(startIndex + actualPageSize, totalFiltered)
  };
}

// 활동 1 답변 검증
export function evaluateActivity1Answers(answers, speciesStats, bodyMassStats) {
  const { speciesCount, mostCommon, heaviestSpecies } = answers;

  const correctSpeciesCount = speciesStats.distinctCount;
  const correctMostCommon = speciesStats.mostCommon;
  const correctHeaviest = bodyMassStats.heaviestSpecies;

  const q1Correct = Number(speciesCount) === correctSpeciesCount;
  const q2Correct = mostCommon === correctMostCommon;
  const q3Correct = heaviestSpecies === correctHeaviest;

  return {
    q1: {
      correct: q1Correct,
      studentAnswer: speciesCount,
      correctAnswer: `${correctSpeciesCount}가지`,
      explanation: `데이터셋에 포함된 펭귄은 Adelie(아델리), Gentoo(젠투), Chinstrap(턱끈) 총 ${correctSpeciesCount}종류입니다.`
    },
    q2: {
      correct: q2Correct,
      studentAnswer: mostCommon,
      correctAnswer: `${SPECIES_INFO[correctMostCommon]?.nameKo ?? correctMostCommon}(${correctMostCommon})`,
      explanation: `아델리 펭귄이 ${speciesStats.counts.Adelie}마리로 가장 많고, 젠투 ${speciesStats.counts.Gentoo}마리, 턱끈 ${speciesStats.counts.Chinstrap}마리입니다.`
    },
    q3: {
      correct: q3Correct,
      studentAnswer: heaviestSpecies,
      correctAnswer: `${SPECIES_INFO[correctHeaviest]?.nameKo ?? correctHeaviest}(${correctHeaviest})`,
      explanation: `젠투 펭귄의 체질량 중앙값은 ${bodyMassStats.bySpecies.Gentoo?.median}g으로, 아델리(${bodyMassStats.bySpecies.Adelie?.median}g)나 턱끈(${bodyMassStats.bySpecies.Chinstrap?.median}g)보다 월등히 무겁습니다.`
    },
    allCorrect: q1Correct && q2Correct && q3Correct
  };
}
