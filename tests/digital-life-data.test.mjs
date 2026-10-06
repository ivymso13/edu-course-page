import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseDigitalLifeTable,
  CONDITION_PHONE_AT_LEAST_5,
  CONDITION_FEMALE_AND_SNS_AT_LEAST_2,
  matchingIds,
  gradeSelection,
} from "../lessons/digital-life-data/game-core.js";

const repoRoot = new URL("../", import.meta.url);
const lessonRoot = new URL("../lessons/digital-life-data/", import.meta.url);

async function loadCsv() {
  return readFile(new URL("data/ml-practice/digital_life.csv", repoRoot), "utf8");
}

test("digital_life.csv는 20행 6열이고 열 이름이 ID·name·gender·phone·sns·stress 순서다", async () => {
  const table = parseDigitalLifeTable(await loadCsv());
  assert.equal(table.rows.length, 20);
  assert.deepEqual(table.headers, ["ID", "name", "gender", "phone", "sns", "stress"]);
  assert.equal(table.headers.length, 6);
  assert.equal(table.rows[0].name, "Alex");
  assert.equal(typeof table.rows[0].phone, "number");
});

test("phone 5 이상 조건의 정답은 CSV 기준 7명(ID 3·5·9·11·15·16·20)이다", async () => {
  const table = parseDigitalLifeTable(await loadCsv());
  assert.deepEqual(matchingIds(table.rows, CONDITION_PHONE_AT_LEAST_5), [3, 5, 9, 11, 15, 16, 20]);
});

test("gender가 F이고 sns 2 이상인 복합 조건의 정답은 2명(ID 16·20)이다", async () => {
  const table = parseDigitalLifeTable(await loadCsv());
  assert.deepEqual(matchingIds(table.rows, CONDITION_FEMALE_AND_SNS_AT_LEAST_2), [16, 20]);
});

test("gradeSelection은 올바른 선택·잘못 선택·누락을 정확히 나눈다", async () => {
  const table = parseDigitalLifeTable(await loadCsv());
  const grade = gradeSelection(table.rows, CONDITION_PHONE_AT_LEAST_5, [3, 5, 9, 1]);
  assert.deepEqual(grade.right, [3, 5, 9]);
  assert.deepEqual(grade.wrong, [1]);
  assert.deepEqual(grade.missed, [11, 15, 16, 20]);
});

test("gradeSelection은 정답을 모두 고르면 누락과 잘못 선택이 없다", async () => {
  const table = parseDigitalLifeTable(await loadCsv());
  const grade = gradeSelection(table.rows, CONDITION_FEMALE_AND_SNS_AT_LEAST_2, [16, 20]);
  assert.deepEqual(grade, { right: [16, 20], wrong: [], missed: [] });
});

test("활동 06 페이지는 독립 가드 속성과 이 활동의 group·child id를 선언한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="ml-data-practice-1"/);
  assert.match(html, /data-guard-lesson="digital-life-data"/);
  assert.match(html, /setAttribute\("data-guard", "pending"\)/);
  assert.match(html, /id="guard-blocked"/);
  assert.match(html, /id="guard-content"/);
  assert.match(html, /class="guard-home-link"/);
  assert.match(html, /assets\/group-guard\.js/);
  assert.match(html, /assets\/guard\.css/);
});

test("활동 06 페이지는 목록 페이지로 돌아가는 링크와 다음 활동 링크를 갖는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/ml-data-practice-1\/"/);
  assert.match(html, /class="next" href="\.\.\/digital-life-columns\/"/);
});

test("활동 06 목록은 CSV와 노트북 다운로드 및 코랩 링크를 제공한다", async () => {
  const html = await readFile(new URL("units/ml-data-practice-1/index.html", repoRoot), "utf8");
  assert.match(html, /href="\.\.\/\.\.\/data\/ml-practice\/digital_life\.csv" download/);
  assert.match(html, /href="\.\.\/\.\.\/data\/ml-practice\/digital-life-student\.ipynb" download/);
  assert.match(
    html,
    /href="https:\/\/colab\.research\.google\.com\/github\/ivymso13\/edu-course-page\/blob\/design-course-system\/data\/ml-practice\/digital-life-student\.ipynb#copy=true"/,
  );
});

test("활동06 목록 자료 영역에 클래스룸 안내를 제공한다", async () => {
  const html = await readFile(new URL("units/ml-data-practice-1/index.html", repoRoot), "utf8");
  assert.doesNotMatch(html, /id="colab"/);
  assert.match(html, /코랩 실습과 제출은 우리 반 클래스룸의 안내를 확인하세요/);
});

test("활동 06 페이지는 외부 스크립트를 쓰지 않는다(코랩 링크 제외)", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const scripts = html.match(/<script[^>]*src="https?:\/\/[^"]*"/g) ?? [];
  assert.equal(scripts.length, 0, "외부 스크립트가 있음");
});

test("활동 06 게임은 CSV를 런타임에 fetch하고 조건 정답을 파일에서 계산한다(숫자 하드코딩 없음)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /fetch\(CSV_URL/);
  assert.match(js, /\.\.\/\.\.\/data\/ml-practice\/digital_life\.csv/);
  assert.doesNotMatch(js, /correct\s*=\s*\d+/, "정답 개수를 상수로 쓰면 안 됨");
});

test("data/ml-practice의 학생용 노트북 사본은 빈칸(소스)을 유지하고 실행 결과·execution_count를 비운다", async () => {
  const raw = await readFile(new URL("data/ml-practice/digital-life-student.ipynb", repoRoot), "utf8");
  const nb = JSON.parse(raw);
  assert.equal(nb.nbformat, 4);
  const codeCells = nb.cells.filter((cell) => cell.cell_type === "code");
  assert.ok(codeCells.length > 0);
  for (const cell of codeCells) {
    assert.deepEqual(cell.outputs, [], "출력이 남아 있음");
    assert.equal(cell.execution_count, null, "execution_count가 남아 있음");
  }
  const blankCell = nb.cells.find((cell) => cell.cell_type === "code" && cell.source.join("").includes("______"));
  assert.ok(blankCell, "학생용 빈칸이 사라지면 안 됨");
});

test("활동06 웹 활동은 독립 페이지이며 중복된 수업 준비 자료를 제공하지 않는다", async () => {
  const structure = await readFile(new URL("index.html", lessonRoot), "utf8");
  const filter = await readFile(new URL("../lessons/digital-life-filter/index.html", import.meta.url), "utf8");
  assert.match(structure, /id="activity-1"/);
  assert.doesNotMatch(structure, /id="activity-2"/);
  assert.match(filter, /id="activity-3"/);
  assert.doesNotMatch(filter, /id="activity-1"/);
  assert.match(filter, /data-guard-lesson="digital-life-filter"/);
  for (const html of [structure, filter]) {
    assert.doesNotMatch(html, /수업 준비 자료| download/);
  }
});

test("웹 조건 문제는 학생 노트북의 과일 예제 세 조건을 재현한다", async () => {
  const { FRUIT_ROWS, FRUIT_TASKS } = await import("../lessons/digital-life-filter/game-core.js");
  const nb = JSON.parse(await readFile(new URL("data/ml-practice/digital-life-student.ipynb", repoRoot), "utf8"));
  const source = nb.cells.filter(c => c.cell_type === "code").map(c => c.source.join("")).join("\n");
  assert.ok(source.includes("['사과', '바나나', '사과', '딸기', '바나나']"));
  assert.ok(source.includes("[1000, 800, 1200, 2500, 900]"));
  assert.ok(source.includes("[10, 15, 5, 20, 12]"));
  assert.deepEqual(FRUIT_TASKS.map(task => FRUIT_ROWS.filter(task.test).map(row => row.ID)), [[0, 2], [0, 2, 3], [1]]);
});

test("표 구조 주관식은 짧은 답·대소문자·공백을 허용하고 반대 뜻과 빈 답은 구분한다", async () => {
  const { gradeStructureAnswer, snsStressCorrelation } = await import("../lessons/digital-life-data/game-core.js");
  const table = parseDigitalLifeTable(await loadCsv());
  for (const [id, value] of [["q1", "20"], ["q2", "6"], ["q3", " NAME "]]) {
    assert.equal(gradeStructureAnswer(id, value, table).correct, true, `${id}: ${value}`);
  }
  for (const [id, value] of [["q3", "이름"], ["q1", "2"]]) {
    assert.equal(gradeStructureAnswer(id, value, table).correct, false, `${id}: ${value}`);
  }
  assert.equal(gradeStructureAnswer("q5", "  ", table).empty, true);
  assert.ok(snsStressCorrelation(table.rows) > .96);
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /type="radio" name="q5"/);
  assert.doesNotMatch(html, /id="q4-input"|<textarea/);
  assert.match(html, /data-check="q5"/);
  assert.equal(gradeStructureAnswer("q5", "positive", table).correct, true);
  assert.equal(gradeStructureAnswer("q5", "negative", table).correct, false);
});
