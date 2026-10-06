// 디지털 생활 데이터(활동지 06): CSV 파싱과 조건 채점을 담은 순수 로직(DOM 의존 없음).

const NUMERIC_COLUMNS = new Set(["ID", "phone", "sns", "stress"]);

export function parseDigitalLifeTable(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const [headerLine, ...bodyLines] = lines;
  const headers = headerLine.split(",").map((cell) => cell.trim());
  const rows = bodyLines.map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = NUMERIC_COLUMNS.has(header) ? Number(cells[index]) : cells[index];
    });
    return row;
  });
  return { headers, rows };
}

export const CONDITION_PHONE_AT_LEAST_5 = {
  label: "phone 값이 5 이상인 행",
  test: (row) => row.phone >= 5,
};

export const CONDITION_FEMALE_AND_SNS_AT_LEAST_2 = {
  label: "gender가 F이고 sns 값이 2 이상인 행",
  test: (row) => row.gender === "F" && row.sns >= 2,
};

export function matchingIds(rows, condition) {
  return rows.filter(condition.test).map((row) => row.ID);
}

// 학생이 고른 ID들을 정답 집합과 비교해 올바른 선택·잘못 선택·누락으로 나눈다.
export function gradeSelection(rows, condition, selectedIds) {
  const correct = new Set(matchingIds(rows, condition));
  const selected = new Set(selectedIds);
  return {
    right: [...selected].filter((id) => correct.has(id)),
    wrong: [...selected].filter((id) => !correct.has(id)),
    missed: [...correct].filter((id) => !selected.has(id)),
  };
}

// Short answers use explicit accepted wording, never substring matching (e.g. negations).
export function normalizeShortAnswer(value) {
  return String(value).normalize("NFKC").trim().toLowerCase().replace(/[\s.!。]/g, "");
}

export function snsStressCorrelation(rows) {
  const pairs = rows.filter(row => Number.isFinite(row.sns) && Number.isFinite(row.stress));
  if (pairs.length < 2) return 0;
  const mean = key => pairs.reduce((sum, row) => sum + row[key], 0) / pairs.length;
  const mx = mean("sns"), my = mean("stress");
  const cross = pairs.reduce((sum, row) => sum + (row.sns-mx)*(row.stress-my), 0);
  const variance = key => pairs.reduce((sum, row) => sum + (row[key] - (key === "sns" ? mx : my)) ** 2, 0);
  const denominator = Math.sqrt(variance("sns") * variance("stress"));
  return denominator ? cross / denominator : 0;
}

export function gradeStructureAnswer(id, answer, table) {
  const value = normalizeShortAnswer(answer);
  if (!value) return { correct: false, empty: true };
  const accepts = values => values.includes(value);
  if (id === "q1") return { correct: accepts([String(table.rows.length), `${table.rows.length}명`, `${table.rows.length}행`]) };
  if (id === "q2") return { correct: accepts([String(table.headers.length), `${table.headers.length}개`, `${table.headers.length}열`]) };
  if (id === "q3") return { correct: value === "name" };
  if (id === "q5") return { correct: value === "sns-stress" };
  return { correct: false };
}
