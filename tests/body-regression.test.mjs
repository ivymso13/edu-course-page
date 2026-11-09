import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COLUMNS,
  correlationMatrix,
  describe,
  fitLinearRegression,
  ipythonTuple,
  numpyRepr1d,
  numpyReprColumn,
  numpyStr1d,
  pandasColumnFormatter,
  parseJeansCSV,
  parseNeck,
  predict,
  prepareLesson,
  pyFloat,
  quantile,
  r2Score,
  shuffledSplit,
  splitSizes,
  trainAndScore,
  MULTI_FEATURES,
  SIMPLE_FEATURES,
} from "../lessons/body-regression/game-core.js";

const repoRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, repoRoot), "utf8");
const csv = await read("data/ml-practice/jeans.csv");
const lesson = prepareLesson(csv);
const close = (actual, expected, tolerance = 1e-9, message = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} ${actual} ≠ ${expected}`);

test("jeans.csv 963행 × 4열을 모두 숫자로 읽고, 똑같은 값의 행도 지우지 않는다", () => {
  assert.deepEqual(lesson.columns, ["neck", "weight", "heap", "waist"]);
  assert.equal(lesson.rows.length, 963);
  assert.deepEqual(lesson.rows[0], { neck: 33.8, weight: 51.1, heap: 86, waist: 62.9 });
  assert.deepEqual(lesson.rows.at(-1), { neck: 42.8, weight: 65, heap: 110.5, waist: 110.5 });
  const keys = lesson.rows.map((row) => COLUMNS.map((name) => row[name]).join(","));
  // pandas df.duplicated().sum() == 61: 중복 행도 원본 그대로 남아 있어야 한다.
  assert.equal(keys.length - new Set(keys).size, 61);
});

test("CSV 파서는 CRLF·BOM을 처리하고, 빈 값이나 숫자가 아닌 값은 오류로 알린다", () => {
  const parsed = parseJeansCSV("﻿waist,neck,weight,heap\r\n70,35,60,90\r\n71.5,36,61,91\r\n");
  assert.deepEqual(parsed.rows, [
    { neck: 35, weight: 60, heap: 90, waist: 70 },
    { neck: 36, weight: 61, heap: 91, waist: 71.5 },
  ]);
  assert.throws(() => parseJeansCSV("neck,weight,heap,waist\n35,,90,70\n"), /숫자가 아닙니다/);
  assert.throws(() => parseJeansCSV("neck,weight,heap,waist\n35,abc,90,70\n"), /숫자가 아닙니다/);
  assert.throws(() => parseJeansCSV("neck,weight,waist\n35,60,70\n"), /머리글/);
});

test("describe()는 pandas와 같은 개수·평균·표본 표준편차·선형 보간 분위수를 낸다", () => {
  // 기대값: pandas 2.x df.describe()
  const s = lesson.summary;
  assert.equal(s.neck.count, 963);
  close(s.neck.mean, 37.5979231568, 1e-9);
  close(s.neck.std, 2.5084173984, 1e-9);
  close(s.weight.std, 10.4054702807, 1e-9);
  close(s.heap.std, 5.9801731175, 1e-9);
  close(s.waist.std, 8.5402139964, 1e-9);
  close(s.waist.mean, 81.8877466251, 1e-9);
  assert.deepEqual(COLUMNS.map((name) => s[name]["25%"]).map((v) => Number(v.toFixed(6))), [35.95, 61.7, 94.85, 75.75]);
  assert.deepEqual(COLUMNS.map((name) => s[name]["50%"]), [37.3, 65, 99.1, 81.8]);
  assert.deepEqual(COLUMNS.map((name) => s[name]["75%"]), [39, 72.6, 103.1, 87.2]);
  assert.deepEqual(COLUMNS.map((name) => s[name].min), [32.5, 44.4, 85.7, 62.9]);
  assert.deepEqual(COLUMNS.map((name) => s[name].max), [47.7, 113.1, 119.4, 110.5]);
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  const small = describe([{ neck: 1, weight: 1, heap: 1, waist: 2 }, { neck: 3, weight: 1, heap: 1, waist: 4 }], ["neck"]);
  close(small.neck.std, Math.SQRT2, 1e-12, "ddof=1");
});

test("corr()는 대칭인 피어슨 상관계수 행렬이고 pandas 값과 같다", () => {
  const c = lesson.corr;
  close(c.neck.waist, 0.8382495087, 1e-9);
  close(c.heap.waist, 0.8910622489, 1e-9);
  close(c.weight.waist, 0.6671424142, 1e-9);
  close(c.neck.weight, 0.548144933, 1e-9);
  close(c.neck.heap, 0.8388486117, 1e-9);
  for (const a of COLUMNS) {
    assert.equal(c[a][a], 1);
    for (const b of COLUMNS) close(c[a][b], c[b][a], 1e-15);
  }
  const perfect = correlationMatrix([1, 2, 3].map((v) => ({ neck: v, weight: -2 * v, heap: v * v, waist: 3 * v + 1 })));
  close(perfect.neck.waist, 1, 1e-12);
  close(perfect.neck.weight, -1, 1e-12);
});

test("70/30 분할은 scikit-learn과 개수가 같고, 겹치지 않으며, seed가 같으면 같고 다르면 달라진다", () => {
  assert.deepEqual(splitSizes(963), { train: 674, test: 289 });
  assert.deepEqual(splitSizes(10), { train: 7, test: 3 });
  assert.deepEqual(splitSizes(11), { train: 7, test: 4 });
  const a = shuffledSplit(963, 12345);
  assert.equal(a.train.length, 674);
  assert.equal(a.test.length, 289);
  assert.deepEqual([...a.train, ...a.test].sort((x, y) => x - y), Array.from({ length: 963 }, (_, i) => i));
  assert.deepEqual(shuffledSplit(963, 12345), a);
  assert.notDeepEqual(shuffledSplit(963, 54321).test, a.test);
  assert.notDeepEqual(a.test.slice(0, 20), Array.from({ length: 20 }, (_, i) => i), "섞인 순서여야 함");
});

test("최소제곱 회귀는 알려진 직선·평면을 정확히 되찾는다", () => {
  const X = [[1], [2], [3], [4], [5]];
  const exact = fitLinearRegression(X, X.map(([x]) => 2 * x + 1));
  close(exact.coef[0], 2, 1e-12);
  close(exact.intercept, 1, 1e-12);
  const noisy = fitLinearRegression([[0], [1], [2], [3]], [1, 3, 2, 4]);
  close(noisy.coef[0], 0.8, 1e-12);
  close(noisy.intercept, 1.3, 1e-12);
  const X3 = [[1, 0, 2], [0, 1, 1], [2, 1, 0], [3, 2, 5], [1, 4, 2], [5, 0, 1]];
  const plane = fitLinearRegression(X3, X3.map(([a, b, c]) => 1.5 * a - 2 * b + 0.25 * c + 7));
  [1.5, -2, 0.25].forEach((value, i) => close(plane.coef[i], value, 1e-10));
  close(plane.intercept, 7, 1e-10);
  assert.throws(() => fitLinearRegression([[1, 2], [2, 4], [3, 6], [4, 8]], [1, 2, 3, 4]), /완전히 겹쳐/);
  assert.throws(() => fitLinearRegression([[5], [5], [5]], [1, 2, 3]), /값이 모두 같거나/);
});

test("전체 데이터 회귀 계수·절편·R²가 scikit-learn LinearRegression과 같다", () => {
  const all = { train: lesson.rows.map((_, i) => i), test: lesson.rows.map((_, i) => i) };
  const simple = trainAndScore(lesson.rows, all, SIMPLE_FEATURES);
  close(simple.model.coef[0], 2.85392303, 1e-8);
  close(simple.model.intercept, -25.413832224163002, 1e-9);
  close(simple.r2, 0.7026622388686805, 1e-12);
  close(predict(simple.model, [[35]])[0], 74.47347389, 1e-7);
  const multi = trainAndScore(lesson.rows, all, MULTI_FEATURES);
  [1.00202974, 0.13723948, 0.7699748].forEach((value, i) => close(multi.model.coef[i], value, 1e-8));
  close(multi.model.intercept, -41.42256202142717, 1e-9);
  close(multi.r2, 0.8386937642776819, 1e-12);
  // 부분 집합(3행마다 하나)으로도 같은 계산을 확인한다.
  const every3 = { train: lesson.rows.map((_, i) => i).filter((i) => i % 3 === 0), test: [0, 1, 2] };
  const sub = trainAndScore(lesson.rows, every3, MULTI_FEATURES);
  [0.98665752, 0.14174115, 0.77608379].forEach((value, i) => close(sub.model.coef[i], value, 1e-8));
  close(sub.model.intercept, -41.68249920958142, 1e-9);
});

test("같은 분할을 두 모델이 함께 쓰고, R²는 테스트 데이터로 계산한다", () => {
  const split = shuffledSplit(lesson.rows.length, 2024);
  const simple = trainAndScore(lesson.rows, split, SIMPLE_FEATURES);
  const multi = trainAndScore(lesson.rows, split, MULTI_FEATURES);
  assert.deepEqual(simple.test.y, multi.test.y);
  assert.equal(simple.test.y.length, 289);
  assert.equal(simple.train.y.length, 674);
  close(simple.r2, r2Score(simple.test.y, simple.pred), 1e-15);
  assert.ok(multi.r2 > simple.r2, "세 속성을 쓴 모델의 결정 계수가 더 높아야 함");
  assert.equal(r2Score([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(r2Score([1, 2, 3], [2, 2, 2]), 0);
});

test("출력 형식은 파이썬·numpy·pandas 기본 표기를 따른다", () => {
  assert.equal(pyFloat(-24.851897264153166), "-24.851897264153166");
  assert.equal(pyFloat(0.7089133699730734), "0.7089133699730734");
  assert.equal(pyFloat(3), "3.0");
  assert.equal(pyFloat(1e-5), "1e-05");
  assert.equal(pyFloat(1.5e16), "1.5e+16");
  assert.equal(numpyStr1d([2.83973028]), "[2.83973028]");
  assert.equal(numpyStr1d([84.5, 67.7, 91.2, 71.5, 77.3]), "[84.5 67.7 91.2 71.5 77.3]");
  assert.equal(numpyStr1d([82.20593418, 71.1309861, 85.89758354]), "[82.20593418 71.1309861  85.89758354]");
  // numpy 2.x 실제 출력과 비교(줄바꿈·정렬 포함)
  const values = [82.20593418123, 71.1309861, 85.89758354, 71.98290518, 85.61361051, -3.5, 100.0];
  assert.equal(numpyStr1d(values), "[ 82.20593418  71.1309861   85.89758354  71.98290518  85.61361051\n  -3.5        100.        ]");
  assert.equal(numpyRepr1d(values), "array([ 82.20593418,  71.1309861 ,  85.89758354,  71.98290518,\n        85.61361051,  -3.5       , 100.        ])");
  assert.equal(numpyRepr1d([74.47347389]), "array([74.47347389])");
  assert.equal(numpyReprColumn([33.8, 33, 35.3]), "array([[33.8],\n       [33. ],\n       [35.3]])");
  const neck = lesson.rows.map((row) => row.neck);
  const waist = lesson.rows.map((row) => row.waist);
  const tuple = ipythonTuple([numpyReprColumn(neck), numpyRepr1d(waist)]).split("\n");
  assert.deepEqual(tuple.slice(0, 3), ["(array([[33.8],", "        [33. ],", "        [35.3],"]);
  assert.ok(tuple.includes(" array([ 62.9,  63. ,  64.2,  64.4,  65. ,  65.3,  65.6,  65.8,  66. ,"));
  assert.equal(tuple.at(-1), "        105.7, 107.1, 107.3, 108.2, 108.7, 110. , 110.1, 110.5, 110.5]))");
  assert.equal(pandasColumnFormatter([86, 87.9])(86), "86.0");
  assert.equal(pandasColumnFormatter([1.25, 2])(2), "2.00");
});

test("새 목둘레 입력값을 검사한다", () => {
  assert.deepEqual(parseNeck(" 37.5 "), { ok: true, value: 37.5 });
  assert.equal(parseNeck("").ok, false);
  assert.equal(parseNeck("abc").ok, false);
  assert.equal(parseNeck("10").ok, false);
  assert.equal(parseNeck("80").ok, false);
});

test("회귀 실습 페이지는 원본 노트북 순서대로 단계를 배치하고 공통 가드·자료를 갖춘다", async () => {
  const html = await read("lessons/body-regression/index.html");
  assert.match(html, /<body\s+data-lab="body-regression"\s+data-guard-scope="page"\s+data-guard-group="body-regression"\s+data-guard-lesson="body-regression"\s*>/);
  assert.match(html, /data-guard", "pending"/);
  for (const id of ["guard-blocked", "guard-content"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="guard-home-link"/);
  assert.match(html, /assets\/group-guard\.js/);
  assert.match(html, /assets\/guard\.css/);
  assert.match(html, /href="\.\.\/\.\.\/data\/ml-practice\/jeans\.csv" download/);
  const order = ["step-problem", "step-data", "step-explore", "step-preprocess", "step-model", "step-evaluate", "step-chart", "step-multiple"]
    .map((id) => html.indexOf(`id="${id}"`));
  order.forEach((position) => assert.ok(position > 0));
  for (let i = 1; i < order.length; i += 1) assert.ok(order[i - 1] < order[i], "단계 순서가 원본 노트북과 다름");
  const codeOrder = ['pd.read_csv("jeans.csv")', "df.describe()", "df.corr(numeric_only=True)", 'X = df["neck"].values.reshape(-1, 1)',
    "train_test_split(X, y, test_size=0.3)", "model.fit(X_train, y_train)", "print(model.coef_, model.intercept_)",
    "print(model.score(X_test, y_test))", "pred = model.predict(X_test)", "plt.scatter(X_test, y_test", 'XX = df[["neck", "weight", "heap"]]']
    .map((code) => html.indexOf(code));
  codeOrder.forEach((position) => assert.ok(position > 0));
  for (let i = 1; i < codeOrder.length; i += 1) assert.ok(codeOrder[i - 1] < codeOrder[i], "코드 순서가 원본 노트북과 다름");
  assert.doesNotMatch(html, /random_state|LogisticRegression|mean_absolute_error/);
  // 기계학습과 데이터_분류 활동지와 같은 셸·스타일·노트북 모듈을 그대로 사용한다.
  for (const href of ["../shared/lab-base.css", "../penguins-data/lab.css", "../../assets/practice-materials.css"]) {
    assert.match(html, new RegExp(`<link rel="stylesheet" href="${href.replace(/[.\/]/g, "\\$&")}`), `${href} 스타일 누락`);
  }
  for (const cls of ["topbar", "module-title", "utility-button", "lab-nav", "lab-intro", "practice-materials", "practice-material-row",
    "practice-material-info", "practice-material-label", "practice-material-description", "practice-material-meta", "practice-material-button",
    "practice-materials-note", "load-status", "lab-note", "setup-command", "lab-panel", "panel-head", "command-block", "command-label",
    "controls", "metrics", "chart-wrap", "lesson-pager"]) {
    assert.match(html, new RegExp(`class="[^"]*\\b${cls}\\b`), `${cls} 클래스가 없음`);
  }
  assert.doesNotMatch(html, /class="[^"]*\bregression-/, "분류 활동지와 다른 전용 셸 클래스를 쓰면 안 됨");
  // 자료 카드는 본문보다 먼저 보이고 파일명·행 수·한국어 열 설명을 담는다.
  const materials = html.indexOf('class="practice-materials"');
  assert.ok(materials > 0 && materials < html.indexOf('id="lab-content"'));
  assert.match(html, /<code>jeans\.csv<\/code><span id="regression-shape">963행 × 4열/);
  for (const label of ["목둘레(neck, cm)", "몸무게(weight,", "엉덩이둘레(heap, cm)", "허리둘레(waist, cm)"]) assert.ok(html.includes(label), label);
  // 단계 이동은 한 페이지 안의 앵커로 연결한다.
  const steps = [...html.matchAll(/<a href="#(step-[a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(steps.slice(0, 8), ["step-problem", "step-data", "step-explore", "step-preprocess", "step-model", "step-evaluate", "step-chart", "step-multiple"]);
  const js = await read("lessons/body-regression/game.js");
  assert.match(js, /from "\.\.\/penguins-data\/notebook-ui\.js"/);
  assert.match(js, /initNotebookCells\(\)/);
});

test("회귀 실습은 펭귄 분류 실습 바로 다음 그룹으로 하나의 활동만 등록하고 공개한다", async () => {
  const [groupsRaw, lessonsRaw, original] = await Promise.all([
    read("data/activity-groups.json"),
    read("data/lessons.json"),
    readFile(new URL("../참고/jeans.csv", repoRoot)).catch(() => null),
  ]);
  const groups = JSON.parse(groupsRaw).groups;
  const index = groups.findIndex((group) => group.id === "body-regression");
  assert.equal(groups[index - 1].id, "ml-data-practice-2");
  const group = groups[index];
  assert.equal(group.title, "기계학습과 데이터_회귀");
  assert.equal(group.path, "lessons/body-regression/");
  assert.equal(group.active, true);
  assert.deepEqual(group.children.map(({ id, path, active }) => [id, path, active]), [["body-regression", "lessons/body-regression/", true]]);
  const lesson = JSON.parse(lessonsRaw).lessons.find((candidate) => candidate.id === "body-regression");
  for (const field of ["order", "path", "duration", "difficulty", "status", "title"]) assert.equal(lesson[field], group.children[0][field]);
  if (original) assert.equal(csv, original.toString("utf8"), "data/ml-practice/jeans.csv는 원본과 같아야 함");
});
