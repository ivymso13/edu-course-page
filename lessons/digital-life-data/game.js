import {
  parseDigitalLifeTable,
  CONDITION_PHONE_AT_LEAST_5,
  CONDITION_FEMALE_AND_SNS_AT_LEAST_2,
  matchingIds,
  gradeSelection,
  gradeStructureAnswer,
} from "./game-core.js?v=feature-role-4";

const $ = (selector) => document.querySelector(selector);
const CSV_URL = "../../data/ml-practice/digital_life.csv";
const PICK_TASKS = [
  { key: "a", condition: CONDITION_PHONE_AT_LEAST_5 },
  { key: "b", condition: CONDITION_FEMALE_AND_SNS_AT_LEAST_2 },
];

let table = null;

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function renderFullTable({ headers, rows }) {
  const headRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    headRow.append(th);
  });
  if (!$("#full-head")) return;
  $("#full-head").replaceChildren(headRow);
  $("#full-body").replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      headers.forEach((header) => tr.append(cell(String(row[header]))));
      return tr;
    }),
  );
}

function renderPickTable(key, rows) {
  const body = $(`#body-${key}`);
  if (!body) return;
  body.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.id = String(row.ID);
      const pickCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `pick-${key}-${row.ID}`;
      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.className = "sr-only";
      label.textContent = `${row.name} 행 고르기`;
      pickCell.append(checkbox, label);
      tr.append(pickCell, cell(String(row.ID)), cell(row.name), cell(row.gender), cell(String(row.phone)), cell(String(row.sns)), cell(String(row.stress)));
      const result = document.createElement("td");
      result.dataset.resultCell = "";
      tr.append(result);
      return tr;
    }),
  );
}

function selectedIds(key) {
  return [...$(`#body-${key}`).querySelectorAll("input[type=checkbox]")]
    .filter((box) => box.checked)
    .map((box) => Number(box.closest("tr").dataset.id));
}

function setRowResults(key, selected, correct) {
  const correctSet = new Set(correct);
  const selectedSet = new Set(selected);
  $(`#body-${key}`).querySelectorAll("tr").forEach((tr) => {
    const id = Number(tr.dataset.id);
    const isSelected = selectedSet.has(id);
    const isCorrect = correctSet.has(id);
    let text = "";
    if (isSelected && isCorrect) text = "✓ 올바른 선택";
    else if (isSelected && !isCorrect) text = "! 잘못 선택";
    else if (!isSelected && isCorrect) text = "✕ 누락";
    tr.querySelector("[data-result-cell]").textContent = text;
  });
}

function idsToNames(ids) {
  return ids
    .map((id) => table.rows.find((row) => row.ID === id))
    .map((row) => `${row.name}(ID ${row.ID})`)
    .join(", ");
}

function showPickResult(key, condition) {
  const selected = selectedIds(key);
  const grade = gradeSelection(table.rows, condition, selected);
  const correct = matchingIds(table.rows, condition);
  setRowResults(key, selected, correct);

  const paragraphs = [
    ["dl-result-title", grade.missed.length === 0 && grade.wrong.length === 0 ? "모든 행을 올바르게 골랐습니다." : "조금 더 확인해 보세요."],
    ["", `올바르게 고른 행 ${grade.right.length}개 · 빠뜨린 행 ${grade.missed.length}개 · 잘못 고른 행 ${grade.wrong.length}개`],
  ];
  if (grade.missed.length > 0) paragraphs.push(["", `빠뜨린 행: ${idsToNames(grade.missed)}`]);
  if (grade.wrong.length > 0) paragraphs.push(["", `잘못 고른 행: ${idsToNames(grade.wrong)}`]);
  paragraphs.push(["dl-explain", `정답 기준: ${condition.label}. 정답 행은 ${correct.length}개입니다.`]);

  const result = $(`#result-${key}`);
  result.replaceChildren(
    ...paragraphs.map(([className, text]) => {
      const p = document.createElement("p");
      if (className) p.className = className;
      p.textContent = text;
      return p;
    }),
  );
  result.hidden = false;
}

function resetPickTask(key) {
  $(`#body-${key}`).querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.checked = false;
  });
  $(`#body-${key}`).querySelectorAll("[data-result-cell]").forEach((td) => {
    td.textContent = "";
  });
  const result = $(`#result-${key}`);
  result.hidden = true;
  result.replaceChildren();
}

const EXPLANATIONS = {
  q1: () => `정답은 ${table.rows.length}명입니다. 한 행이 사람 한 명의 자료입니다.`,
  q2: () => `정답은 ${table.headers.length}개입니다. ID도 속성에 포함됩니다.`,
  q3: () => "정답은 name입니다. 열 이름을 그대로 적으면 됩니다.",
  q5: () => "정답은 ②입니다. 입력은 예측에 사용할 정보, 예측할 값은 알아내려는 결과입니다. 이 문제에서는 sns를 입력으로, stress를 예측 대상으로 정했습니다. 실제로 예측이 잘되는지는 별도로 확인해야 합니다.",
};

function checkQuestion(id) {
  if (!table) return;
  const input = $(`#${id}-input`);
  const answered = input ? input.value.trim() !== "" : Boolean($( `input[name=${id}]:checked`));
  if (!answered) {
    const feedback = $(`#${id}-feedback`);
    feedback.textContent = "답을 입력하거나 선택한 뒤 확인해 주세요.";
    feedback.dataset.state = "pending";
    (input ?? $(`input[name=${id}]`))?.focus();
    return;
  }
  const { correct } = gradeStructureAnswer(id, input ? input.value : $(`input[name=${id}]:checked`).value, table);
  const message = EXPLANATIONS[id]();
  const feedback = $(`#${id}-feedback`);
  feedback.textContent = `${correct ? "맞았습니다." : "다시 확인해 보세요."} ${message}`;
  feedback.dataset.state = correct ? "correct" : "wrong";
}

function bindEvents() {
  document.querySelectorAll("[data-check], #check-a, #check-b").forEach(button => { button.disabled = true; });
  document.querySelectorAll("[data-check]").forEach((button) => {
    button.addEventListener("click", () => checkQuestion(button.dataset.check));
  });
  document.querySelectorAll(".dl-answer-row input").forEach(input => {
    input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); checkQuestion(input.id.replace("-input", "")); } });
  });
  PICK_TASKS.forEach(({ key, condition }) => {
    $(`#check-${key}`)?.addEventListener("click", () => showPickResult(key, condition));
    $(`#reset-${key}`)?.addEventListener("click", () => resetPickTask(key));
  });
}

async function start() {
  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`자료를 불러오지 못했습니다 (${response.status})`);
    table = parseDigitalLifeTable(await response.text());
  } catch {
    $("#load-error").hidden = false;
    return;
  }
  document.querySelectorAll("[data-check], #check-a, #check-b").forEach(button => { button.disabled = false; });
  renderFullTable(table);
  PICK_TASKS.forEach(({ key }) => renderPickTable(key, table.rows));
}

bindEvents();
start();
