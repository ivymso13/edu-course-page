import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AGE,
  COLUMNS,
  FEATURES_2D,
  FEATURES_3D,
  INCOME,
  K_RANGE,
  SPENDING,
  clusterCounts,
  fitKMeans,
  floatMatrixRepr,
  intArrayRepr,
  kmeansPlusPlus,
  lloyd,
  parseMallCSV,
  predictKMeans,
  prepareLesson,
  rotate3D,
  silhouetteSamples,
  silhouetteScore,
  updateCenters,
} from "../lessons/mall-clustering/game-core.js";
import { createRandom } from "../lessons/body-regression/game-core.js";

const repoRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, repoRoot), "utf8");
const csv = await read("data/ml-practice/Mall_Customers.csv");
const lesson = prepareLesson(csv);
const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test("Mall_Customers.csv는 원본 머리글·고객 번호를 유지한 200행 × 5열이다", () => {
  assert.ok(csv.startsWith("CustomerID,Genre,Age,Annual Income (k$),Spending Score (1-100)\r\n0001,Male,19,15,39"));
  assert.deepEqual(lesson.columns, COLUMNS);
  assert.equal(lesson.rows.length, 200);
  assert.equal(lesson.rows[0].CustomerID, 1);
  assert.equal(lesson.rows[0].idText, "0001");
  assert.equal(lesson.rows[199].idText, "0200");
  assert.deepEqual(
    [lesson.rows[2].Genre, lesson.rows[2][AGE], lesson.rows[2][INCOME], lesson.rows[2][SPENDING]],
    ["Female", 20, 16, 6],
  );
  assert.deepEqual(new Set(lesson.rows.map((row) => row.Genre)), new Set(["Male", "Female"]));
  // 2차원은 소득·소비 점수, 3차원은 소득·소비 점수·나이를 원래 값 그대로(정규화 없이) 쓴다.
  assert.deepEqual(FEATURES_2D, [INCOME, SPENDING]);
  assert.deepEqual(FEATURES_3D, [INCOME, SPENDING, AGE]);
  assert.equal(lesson.X2.length, 200);
  assert.ok(lesson.X2.every((row) => row.length === 2));
  assert.ok(lesson.X3.every((row) => row.length === 3));
  assert.deepEqual(lesson.X2[0], [15, 39]);
  assert.deepEqual(lesson.X3[0], [15, 39, 19]);
});

test("원본 노트북 사본은 빈칸이 남은 9개 코드 셀이며 출력은 지워져 있다", async () => {
  const notebook = JSON.parse(await read("data/ml-practice/mall-clustering-student.ipynb"));
  const code = notebook.cells.filter((cell) => cell.cell_type === "code");
  assert.equal(code.length, 9);
  assert.ok(code.every((cell) => cell.outputs.length === 0 && cell.execution_count === null));
  const sources = code.map((cell) => cell.source.join(""));
  assert.equal(sources.filter((source) => source.includes("_____")).length, 7);
  assert.match(sources[0], /df = pd\.read_csv\(_+\)/);
  assert.match(sources[8], /KMeans\(n_clusters=5, random_state=42, n_init=10\)/);
});

test("CSV 파서는 머리글이 다르거나 값이 비면 조용히 버리지 않고 오류를 낸다", () => {
  assert.throws(() => parseMallCSV("CustomerID,Gender,Age,Annual Income (k$),Spending Score (1-100)\n1,Male,1,2,3"), /머리글/);
  assert.throws(() => parseMallCSV(`${COLUMNS.join(",")}\n0001,Male,,15,39`), /Age 값이 숫자가 아닙니다/);
  assert.throws(() => parseMallCSV(`${COLUMNS.join(",")}\n0001,Male,19,15`), /열 개수/);
  assert.equal(parseMallCSV(`﻿${COLUMNS.join(",")}\n0007,Female,35,18,6\n`).rows[0].CustomerID, 7);
});

test("K-평균은 분명히 나뉜 점들의 중심과 inertia를 정확히 찾는다", () => {
  const X = [[0, 0], [0, 2], [2, 0], [2, 2], [10, 10], [10, 12], [12, 10], [12, 12]];
  const model = fitKMeans(X, { k: 2, seed: 7 });
  const sorted = model.centers.map((center) => center.join(",")).sort();
  assert.deepEqual(sorted, ["1,1", "11,11"]);
  assert.equal(model.inertia, 16);
  assert.ok(model.converged);
  assert.equal(model.runs.length, 10);
  assert.equal(new Set(model.labels.slice(0, 4)).size, 1);
  assert.notEqual(model.labels[0], model.labels[4]);
  assert.deepEqual(predictKMeans(model, [[1, 1], [11, 11]]), [model.labels[0], model.labels[4]]);
  assert.deepEqual(clusterCounts(model.labels, 2), [4, 4]);
});

test("빈 군집이 생기면 가장 먼 점으로 옮겨 군집 수를 유지한다", () => {
  const X = [[0, 0], [1, 0], [10, 0]];
  const labels = [0, 0, 0];
  const update = updateCenters(X, labels, [25, 16, 25], 2);
  assert.equal(update.relocated, 1);
  assert.ok(update.centers.every((center) => center.every(Number.isFinite)));
  // 중심 하나가 아무 점도 받지 못하는 시작에서도 끝까지 k개 군집이 유지된다.
  const result = lloyd(X, [[0, 0], [100, 100]]);
  assert.deepEqual(clusterCounts(result.labels, 2).filter((count) => count > 0).length, 2);
  // 서로 다른 점이 k개보다 적어도 초기화가 멈추지 않는다.
  const centers = kmeansPlusPlus([[1, 1], [1, 1], [1, 1]], 3, createRandom(1));
  assert.equal(centers.length, 3);
  assert.throws(() => fitKMeans([[1, 1]], { k: 2 }), /데이터 수/);
});

test("같은 seed면 결과가 같고, 반환하는 군집 번호는 최종 중심과 일치한다", () => {
  const a = fitKMeans(lesson.X2, { k: 5, seed: 42 });
  const b = fitKMeans(lesson.X2, { k: 5, seed: 42 });
  assert.deepEqual(a.labels, b.labels);
  assert.deepEqual(a.centers, b.centers);
  assert.deepEqual(predictKMeans(a, lesson.X2), a.labels);
  // 중심은 각 군집에 속한 점들의 평균이다.
  a.centers.forEach((center, c) => {
    const members = lesson.X2.filter((_, i) => a.labels[i] === c);
    center.forEach((value, j) => close(value, members.reduce((sum, p) => sum + p[j], 0) / members.length));
  });
});

test("소득·소비 점수 K=5 결과는 scikit-learn(n_init=10)과 inertia·실루엣 점수·군집 크기가 같다", () => {
  const model = fitKMeans(lesson.X2, { k: 5 });
  assert.ok(model.converged);
  close(model.inertia, 44448.45544793371);
  assert.deepEqual(clusterCounts(model.labels, 5).sort((x, y) => x - y), [22, 23, 35, 39, 81]);
  const centers = model.centers.map((c) => c.map((v) => v.toFixed(4)).join(",")).sort();
  assert.deepEqual(centers, ["25.7273,79.3636", "26.3043,20.9130", "55.2963,49.5185", "86.5385,82.1282", "88.2000,17.1143"]);
  // 원본 노트북의 출력 0.553931997444648과 같은 값.
  close(silhouetteScore(lesson.X2, model.labels), 0.553931997444648, 1e-12);
});

test("K는 2~8에서 고를 수 있고 모든 K가 수렴하며 실루엣 점수가 -1~1 사이다", () => {
  assert.deepEqual([K_RANGE.min, K_RANGE.max, K_RANGE.default], [2, 8, 5]);
  const sklearnK2 = { inertia: 181363.59595959593, silhouette: 0.2968969162503008 };
  for (let k = K_RANGE.min; k <= K_RANGE.max; k += 1) {
    const model = fitKMeans(lesson.X2, { k });
    assert.ok(model.converged, `k=${k} 수렴 실패`);
    assert.equal(new Set(model.labels).size, k);
    const score = silhouetteScore(lesson.X2, model.labels);
    assert.ok(score > -1 && score < 1);
    if (k === 2) {
      close(model.inertia, sklearnK2.inertia);
      close(score, sklearnK2.silhouette, 1e-12);
    }
  }
});

test("소득·소비 점수·나이 3차원 K=5 결과는 scikit-learn(random_state=42, n_init=10)과 같은 군집을 찾는다", () => {
  const model = fitKMeans(lesson.X3, { k: 5, seed: 42 });
  assert.equal(model.nFeatures, 3);
  assert.ok(model.centers.every((center) => center.length === 3));
  close(model.inertia, 75350.77917248776);
  assert.deepEqual(clusterCounts(model.labels, 5).sort((x, y) => x - y), [23, 23, 36, 39, 79]);
  close(silhouetteScore(lesson.X3, model.labels), 0.44428597560893024, 1e-12);
  const centers = model.centers.map((c) => c.map((v) => v.toFixed(3)).join(",")).sort();
  assert.ok(centers.includes("87.750,17.583,40.667"));
  assert.ok(centers.includes("26.304,78.565,25.522"));
});

test("실루엣 점수는 유클리드 거리로 계산하고 한 점짜리 군집은 0으로 센다", () => {
  // scikit-learn silhouette_score로 구한 기준값.
  close(silhouetteScore([[0], [1], [4], [6]], [0, 0, 1, 1]), 0.6537337662337662, 1e-12);
  close(silhouetteScore([[0, 0], [0, 1], [5, 5], [10, 10]], [0, 0, 1, 2]), 0.4256012204685211, 1e-12);
  assert.equal(silhouetteSamples([[0, 0], [0, 1], [5, 5], [10, 10]], [0, 0, 1, 2])[2], 0);
  assert.throws(() => silhouetteScore([[0], [1], [2]], [0, 0, 0]), /2개 이상/);
  assert.throws(() => silhouetteScore([[0], [1], [2]], [0, 1, 2]), /2개 이하/);
  // 같은 위치의 점이 겹쳐도 0으로 나누지 않는다.
  assert.ok(Number.isFinite(silhouetteScore([[0], [0], [0], [3]], [0, 0, 1, 1])));
});

test("numpy 출력 형식은 원본 노트북의 pred·cluster_centers_ 출력과 글자 하나까지 같다", () => {
  const pred = [
    ...Array.from({ length: 43 }, (_, i) => (i % 2 === 0 ? 1 : 3)), 4, 1, 3, ...new Array(77).fill(4),
    0, 2, 0, 4, 0, 2, 0, 2, 0, 4, 0, ...Array.from({ length: 66 }, (_, i) => (i % 2 === 0 ? 2 : 0)),
  ];
  assert.equal(pred.length, 200);
  const text = intArrayRepr(pred);
  assert.ok(text.startsWith("array([1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3,\n       1, 3,"));
  assert.ok(text.endsWith("2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0,\n       2, 0], dtype=int32)"));
  assert.ok(text.split("\n").every((line) => line.length <= 75));
  assert.equal(
    floatMatrixRepr([[86.53846154, 82.12820513], [26.30434783, 20.91304348], [88.2, 17.11428571], [25.72727273, 79.36363636], [55.2962963, 49.51851852]]),
    "array([[86.53846154, 82.12820513],\n       [26.30434783, 20.91304348],\n       [88.2       , 17.11428571],\n       [25.72727273, 79.36363636],\n       [55.2962963 , 49.51851852]])",
  );
});

test("3차원 회전은 길이를 보존하는 정사영이다", () => {
  const point = [0.3, -0.2, 0.4];
  for (const [yaw, pitch] of [[0, 0], [0.7, 0.3], [-1.2, -0.8]]) {
    const r = rotate3D(point, yaw, pitch);
    close(r.x ** 2 + r.y ** 2 + r.depth ** 2, 0.09 + 0.04 + 0.16, 1e-12);
  }
  // 회전 전에는 세로축(나이)이 화면 위쪽(작은 y)을 향한다.
  assert.ok(rotate3D([0, 0, 1], 0, 0).y < 0);
});

test("군집 실습 페이지는 데이터 다운로드와 원본 노트북 순서대로 단계를 배치한다", async () => {
  const html = await read("lessons/mall-clustering/index.html");
  assert.match(html, /<title>[^<]*기계학습과 데이터_군집<\/title>/);
  assert.match(html, /<body\s+data-lab="mall-clustering"\s+data-guard-scope="page"\s+data-guard-group="mall-clustering"\s+data-guard-lesson="mall-clustering"\s*>/);
  for (const id of ["guard-loading", "guard-blocked", "guard-content", "projector-toggle", "load-status", "lab-content"]) assert.match(html, new RegExp(`id="${id}"`));
  for (const href of ["../shared/lab-base.css", "../penguins-data/lab.css", "../../assets/practice-materials.css", "styles.css", "../../assets/guard.css"]) {
    assert.match(html, new RegExp(`<link rel="stylesheet" href="${href.replace(/[.\/]/g, "\\$&")}`), `${href} 스타일 누락`);
  }
  const csvLink = html.indexOf('href="../../data/ml-practice/Mall_Customers.csv"');
  assert.ok(csvLink > 0 && csvLink < html.indexOf('id="lab-content"'));
  assert.doesNotMatch(html, /simulation|bit\.ly|노트북 다운로드|href="[^"]*\.ipynb"/);
  const steps = [...html.matchAll(/<a href="#(step-[a-z0-9]+)"/g)].map((match) => match[1]);
  const expected = ["step-data", "step-select", "step-model", "step-result", "step-chart", "step-evaluate", "step-3d"];
  assert.deepEqual(steps.slice(0, 7), expected);
  const positions = expected.map((id) => html.indexOf(`id="${id}"`));
  positions.forEach((position, i) => assert.ok(position > 0 && (i === 0 || positions[i - 1] < position), `${expected[i]} 위치`));
  // 원본 노트북 9개 셀의 순서와 변수, 빈칸을 채운 코드.
  const code = [
    'df = pd.read_csv("Mall_Customers.csv")',
    'data = df[["Annual Income (k$)", "Spending Score (1-100)"]]',
    "model = KMeans(n_clusters=5)\nmodel.fit(data)",
    "pred = model.predict(data)",
    'df["centroid"] = model.labels_',
    "final_centroid = model.cluster_centers_",
    "df.head()",
    'sns.scatterplot(data=df, x="Annual Income (k$)", y="Spending Score (1-100)", hue = "centroid", palette="bright")',
    'plt.scatter(final_centroid[:, 0], final_centroid[:, 1], s=300, marker="*", color="black", label="Centroid")',
    "score = silhouette_score(data, pred)",
    'X = df[["Annual Income (k$)", "Spending Score (1-100)", "Age"]]',
    "model = KMeans(n_clusters=5, random_state=42, n_init=10)",
    'df["centroid"] = model.fit_predict(X)',
    "fig = px.scatter_3d(",
    'marker=dict(size=10, symbol="diamond", color="black")',
  ].map((snippet) => html.indexOf(snippet));
  code.forEach((position, i) => assert.ok(position > 0 && (i === 0 || code[i - 1] < position), `코드 ${i} 순서`));
  assert.doesNotMatch(html, /_{4,}/, "표시하는 코드에 빈칸이 남으면 안 됨");
  // 군집 실습에 없는 분할·회귀·정확도·퀴즈를 끼워 넣지 않는다.
  assert.doesNotMatch(html, /train_test_split|LinearRegression|mean_absolute_error|accuracy|정확도를|퀴즈|StandardScaler|MinMaxScaler/);
  assert.match(html, /정확도가 아닙니다/);
  assert.match(html, /군집 번호/);
  for (const cls of ["topbar", "lab-nav", "lab-intro", "practice-materials", "practice-material-button", "lab-panel", "panel-head", "command-block", "controls", "metrics", "chart-wrap", "lesson-pager", "cluster-3d-wrap"]) {
    assert.match(html, new RegExp(`class="[^"]*\\b${cls}\\b`), `${cls} 클래스가 없음`);
  }
  // K 선택은 2~8, 기본 5.
  const options = [...html.matchAll(/<option value="(\d)"( selected)?>/g)].filter((m) => html.indexOf(m[0]) > html.indexOf('id="k-select"'));
  assert.deepEqual(options.map((m) => Number(m[1])), [2, 3, 4, 5, 6, 7, 8]);
  assert.equal(options.find((m) => m[2])[1], "5");
});

test("군집 실습 스크립트는 공통 노트북 모듈을 쓰고 실제 CSV로 계산하며 상태를 함께 초기화한다", async () => {
  const js = await read("lessons/mall-clustering/game.js");
  assert.match(js, /from "\.\.\/penguins-data\/notebook-ui\.js"/);
  assert.match(js, /initNotebookCells\(\)/);
  assert.match(js, /"\.\.\/\.\.\/data\/ml-practice\/Mall_Customers\.csv"/);
  assert.match(js, /silhouetteScore\(X, pred\)/);
  assert.match(js, /fitKMeans\(X, \{ k: 5, nInit: N_INIT, seed: SEED \}\)/);
  // K를 바꾸면 이전 학습 결과를 지운다.
  assert.match(js, /state\.k = k;\s*reset2D\(\);/);
  // 3차원 그래프는 끌기·방향키·버튼으로 돌릴 수 있다.
  for (const pattern of [/pointerdown/, /pointermove/, /ArrowLeft/, /ArrowUp/, /data-rotate/]) assert.match(js, pattern);
  assert.doesNotMatch(js.replace("http://www.w3.org/2000/svg", ""), /https?:\/\//);
  assert.doesNotMatch(js, /Math\.random\(\)/);
});

test("군집 실습은 회귀 실습 바로 다음 그룹(order 7.75)으로 하나의 활동만 등록하고 공개한다", async () => {
  const [groupsRaw, lessonsRaw, home] = await Promise.all([read("data/activity-groups.json"), read("data/lessons.json"), read("index.html")]);
  const groups = JSON.parse(groupsRaw).groups;
  const index = groups.findIndex((group) => group.id === "mall-clustering");
  assert.equal(groups[index - 1].id, "body-regression");
  assert.equal(groups[index + 1].id, "machine-learning-algorithms");
  const group = groups[index];
  assert.equal(group.order, 7.75);
  assert.equal(group.title, "기계학습과 데이터_군집");
  assert.equal(group.path, "lessons/mall-clustering/");
  assert.equal(group.active, true);
  assert.deepEqual(group.children.map(({ id, path, active }) => [id, path, active]), [["mall-clustering", "lessons/mall-clustering/", true]]);
  const lesson = JSON.parse(lessonsRaw).lessons.find((candidate) => candidate.id === "mall-clustering");
  for (const field of ["order", "path", "duration", "difficulty", "status", "title"]) assert.equal(lesson[field], group.children[0][field]);
  assert.equal(lesson.unit, "기계학습과 데이터_군집");
  // 기존 그룹의 공개 설정과 번호는 그대로다.
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  assert.equal(byId["body-regression"].order, 7.5);
  assert.equal(byId["body-regression"].active, true);
  assert.equal(byId["machine-learning-algorithms"].order, 8);
  const card = home.match(/data-group-card="mall-clustering"[\s\S]*?<\/a>/)[0];
  assert.match(card, /<h2>기계학습과 데이터_군집<\/h2>/);
  assert.ok(home.indexOf('data-group-card="body-regression"') < home.indexOf('data-group-card="mall-clustering"'));
});
