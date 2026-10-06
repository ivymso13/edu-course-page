import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePenguinsCSV,
  calculateDataCleaningStats,
  calculateSpeciesCounts,
  calculateIslandCounts,
  calculateSexCounts,
  calculateMedian,
  quantile,
  calculateBodyMassStats,
  calculateScatterData,
  filterTableRows,
  evaluateActivity1Answers,
  SPECIES_INFO,
  FEATURE_INFO,
  COLAB_INFO
} from "../lessons/penguins-data/game-core.js";

const csvPath = new URL("../data/ml-practice/penguins_size.csv", import.meta.url);
const unitPath = new URL("../units/ml-data-practice-2/index.html", import.meta.url);
const lessonHtmlPath = new URL("../lessons/penguins-data/index.html", import.meta.url);
const lessonJsPath = new URL("../lessons/penguins-data/game.js", import.meta.url);

test("펭귄 CSV 파싱 및 기본 데이터 사실 검증 (344행 7열)", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);

  assert.equal(rows.length, 344, "전체 행 수는 344개여야 함");

  const sample = rows[0];
  assert.ok("species" in sample);
  assert.ok("island" in sample);
  assert.ok("culmen_length_mm" in sample);
  assert.ok("culmen_depth_mm" in sample);
  assert.ok("flipper_length_mm" in sample);
  assert.ok("body_mass_g" in sample);
  assert.ok("sex" in sample);
});

test("종별 개수 검증 (Adelie 152, Gentoo 124, Chinstrap 68)", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);
  const stats = calculateSpeciesCounts(rows);

  assert.equal(stats.counts.Adelie, 152);
  assert.equal(stats.counts.Gentoo, 124);
  assert.equal(stats.counts.Chinstrap, 68);
  assert.equal(stats.total, 344);
  assert.equal(stats.usedRows, 344);
  assert.equal(stats.missingRows, 0);
  assert.equal(stats.distinctCount, 3);
  assert.equal(stats.mostCommon, "Adelie");
  assert.equal(stats.leastCommon, "Chinstrap");
});

test("섬별 개수 검증 (Biscoe 168, Dream 124, Torgersen 52)", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);
  const islandStats = calculateIslandCounts(rows);

  assert.equal(islandStats.counts.Biscoe, 168);
  assert.equal(islandStats.counts.Dream, 124);
  assert.equal(islandStats.counts.Torgersen, 52);
  assert.equal(islandStats.usedRows, 344);
});

test("성별 및 결측치, 이상치 규칙 검증 (MALE 168, FEMALE 165, NA 10, '.' 1)", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);
  const sexCounts = calculateSexCounts(rows);

  assert.equal(sexCounts.MALE, 168);
  assert.equal(sexCounts.FEMALE, 165);
  assert.equal(sexCounts.NA, 10);
  assert.equal(sexCounts["."], 1);

  const cleaningStats = calculateDataCleaningStats(rows);
  assert.equal(cleaningStats.totalRaw, 344);
  assert.equal(cleaningStats.missingRowsCount, 10, "결측 행 10개");
  assert.equal(cleaningStats.rowsAfterDropnaCount, 334, "dropna 후 334행");
  assert.equal(cleaningStats.dotSexRowsCount, 1, "성별 '.' 행 1개");
  assert.equal(cleaningStats.rowsAfterCleanCount, 333, "최종 정제 후 333행");
});

test("종별 몸무게 통계 및 중앙값 검증 (Adelie 3700, Chinstrap 3700, Gentoo 5000)", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);
  const bmStats = calculateBodyMassStats(rows);

  assert.equal(bmStats.bySpecies.Adelie.median, 3700);
  assert.equal(bmStats.bySpecies.Chinstrap.median, 3700);
  assert.equal(bmStats.bySpecies.Gentoo.median, 5000);

  assert.equal(bmStats.bySpecies.Adelie.count, 151);
  assert.equal(bmStats.bySpecies.Chinstrap.count, 68);
  assert.equal(bmStats.bySpecies.Gentoo.count, 123);

  assert.equal(bmStats.usedRows, 342, "몸무게 결측치 2개를 제외한 342행 사용");
  assert.equal(bmStats.missingRows, 2, "몸무게 결측치 2개 제외");
  assert.equal(bmStats.heaviestSpecies, "Gentoo", "가장 무거운 종류는 Gentoo");
});

test("산점도 데이터 계산 및 결측치 분리 검증", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);

  const scatter = calculateScatterData(rows, "culmen_length_mm", "culmen_depth_mm");
  assert.equal(scatter.points.length, 342);
  assert.equal(scatter.usedRows, 342);
  assert.equal(scatter.missingRows, 2);
  assert.equal(scatter.xKey, "culmen_length_mm");
  assert.equal(scatter.yKey, "culmen_depth_mm");
  assert.equal(scatter.xUnit, "mm");
  assert.equal(scatter.yUnit, "mm");
});

test("표 검색 및 페이지네이션 로직 검증", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);

  const page1 = filterTableRows(rows, { page: 1, pageSize: 10 });
  assert.equal(page1.rows.length, 10);
  assert.equal(page1.totalFiltered, 344);
  assert.equal(page1.totalPages, 35);
  assert.equal(page1.currentPage, 1);

  const gentooOnly = filterTableRows(rows, { species: "Gentoo", pageSize: 50 });
  assert.equal(gentooOnly.totalFiltered, 124);

  const biscoeSearch = filterTableRows(rows, { query: "Biscoe", pageSize: 200 });
  assert.equal(biscoeSearch.totalFiltered, 168);
});

test("활동 1 채점 로직 검증", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);
  const speciesStats = calculateSpeciesCounts(rows);
  const bmStats = calculateBodyMassStats(rows);

  const correctSubmission = evaluateActivity1Answers(
    { speciesCount: 3, mostCommon: "Adelie", heaviestSpecies: "Gentoo" },
    speciesStats,
    bmStats
  );
  assert.equal(correctSubmission.allCorrect, true);
  assert.equal(correctSubmission.q1.correct, true);
  assert.equal(correctSubmission.q2.correct, true);
  assert.equal(correctSubmission.q3.correct, true);

  const wrongSubmission = evaluateActivity1Answers(
    { speciesCount: 4, mostCommon: "Gentoo", heaviestSpecies: "Adelie" },
    speciesStats,
    bmStats
  );
  assert.equal(wrongSubmission.allCorrect, false);
  assert.equal(wrongSubmission.q1.correct, false);
  assert.equal(wrongSubmission.q2.correct, false);
  assert.equal(wrongSubmission.q3.correct, false);
});

test("단원 페이지(units/ml-data-practice-2/index.html) 가드 및 계약 검증", async () => {
  const html = await readFile(unitPath, "utf8");

  // 가드 속성
  assert.match(html, /<body\s+[^>]*data-guard-scope="page"/);
  assert.match(html, /<body\s+[^>]*data-guard-group="ml-data-practice-2"/);
  assert.match(html, /document\.documentElement\.setAttribute\("data-guard",\s*"pending"\)/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/hub\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);

  // 가드 패널 요소
  assert.match(html, /id="guard-loading"/);
  assert.match(html, /id="guard-blocked"/);
  assert.match(html, /class="guard-home-link"/);
  assert.match(html, /id="guard-content"/);

  // 제목 및 카드 링크
  assert.match(html, /활동지 07/);
  assert.match(html, /기계학습과 데이터 실습\(2\)/);
  assert.match(html, /<a\s+class="lesson-card"\s+href="\.\.\/\.\.\/lessons\/penguins-data\/"\s+data-lesson-card="penguins-data">/);
});

test("활동 페이지(lessons/penguins-data/index.html) 가드 및 계약 검증", async () => {
  const html = await readFile(lessonHtmlPath, "utf8");

  // 가드 속성
  assert.match(html, /<body\s+[^>]*data-guard-scope="page"/);
  assert.match(html, /<body\s+[^>]*data-guard-group="ml-data-practice-2"/);
  assert.match(html, /<body\s+[^>]*data-guard-lesson="penguins-data"/);
  assert.match(html, /document\.documentElement\.setAttribute\("data-guard",\s*"pending"\)/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/shared\/lab-base\.css"/);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /src="game\.js"/);

  // 가드 패널 요소
  assert.match(html, /id="guard-loading"/);
  assert.match(html, /id="guard-blocked"/);
  assert.match(html, /class="guard-home-link"/);
  assert.match(html, /id="guard-content"/);

  // 상단 back-link
  assert.match(html, /<a\s+class="back-link"\s+href="\.\.\/\.\.\/units\/ml-data-practice-2\/">/);

  const hub = await readFile(unitPath, "utf8");
  // 다운로드 링크
  assert.match(hub, /href="\.\.\/\.\.\/data\/ml-practice\/penguins_size\.csv"\s+download/);
  assert.match(hub, /href="\.\.\/\.\.\/data\/ml-practice\/penguins-student\.ipynb"\s+download/);

  // 코랩 링크 (정확한 URL 및 보안 속성)
  const colabUrl = "https://colab.research.google.com/github/ivymso13/edu-course-page/blob/design-course-system/data/ml-practice/penguins-student.ipynb";
  assert.match(hub, new RegExp(`href="${colabUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(hub, /target="_blank"/);
  assert.match(hub, /rel="noopener"/);

  // 외부 허용되지 않은 http/https 스크립트가 없는지 검증
  const scriptTags = html.match(/<script[^>]*src=["'][^"']+["'][^>]*>/g) || [];
  for (const s of scriptTags) {
    assert.doesNotMatch(s, /https?:\/\//, `외부 스크립트 포함 불가: ${s}`);
  }

  // 하단 실습 영역은 제거하고 클래스룸 안내만 자료 영역에서 제공한다.
  assert.doesNotMatch(html, /class="colab-section"/);
  assert.match(hub, /코랩 실습과 제출은 우리 반 클래스룸의 안내를 확인하세요/);
  assert.doesNotMatch(html, /수업 준비 자료|class="materials-section"/);
});

test("game.js가 펭귄 CSV 경로를 올바르게 fetch하는지 검증", async () => {
  const js = await readFile(lessonJsPath, "utf8");
  assert.match(js, /\.\.\/\.\.\/data\/ml-practice\/penguins_size\.csv/);
});

test("styles.css가 프로젝터 모드 및 모바일 반응형 규칙을 포함한다", async () => {
  const css = await readFile(new URL("../lessons/penguins-data/styles.css", import.meta.url), "utf8");
  assert.match(css, /body\.projector-mode/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /\.species-adelie/);
  assert.match(css, /\.species-gentoo/);
  assert.match(css, /\.species-chinstrap/);
});

test("그래프별 사용 행 수 및 결측치 제외 안내 검증", async () => {
  const csvText = await readFile(csvPath, "utf8");
  const rows = parsePenguinsCSV(csvText);

  // 막대그래프: 344행 전체 사용, 결측치 0
  const speciesCounts = calculateSpeciesCounts(rows);
  assert.equal(speciesCounts.usedRows, 344);
  assert.equal(speciesCounts.missingRows, 0);

  // 상자그림: 342행 사용, 결측치 2건 제외
  const massStats = calculateBodyMassStats(rows);
  assert.equal(massStats.usedRows, 342);
  assert.equal(massStats.missingRows, 2);

  // 산점도: 342행 사용, 결측치 2건 제외
  const scatterStats = calculateScatterData(rows, "culmen_length_mm", "culmen_depth_mm");
  assert.equal(scatterStats.usedRows, 342);
  assert.equal(scatterStats.missingRows, 2);
});

test("그래프 활동 페이지의 키보드 접근성 및 ARIA 속성 검증", async () => {
  const html = await readFile(new URL("../lessons/penguins-graphs/index.html", import.meta.url), "utf8");
  assert.match(html, /id="keyboard-point-select"/, "키보드로 점을 선택할 수 있는 select 컨트롤 존재");
  assert.match(html, /role="img"/, "SVG에 role='img' 접근성 속성 제공");
  assert.match(html, /aria-label=/, "그래프 및 주요 영역에 aria-label 제공");
  assert.match(html, /id="point-inspector"/, "점 선택 시 상세 정보를 확인할 수 있는 영역 존재");
});


test("활동07은 표 관찰과 그래프 분석을 별도 페이지로 제공한다", async () => {
  const tableHtml = await readFile(lessonHtmlPath, "utf8");
  const graphHtml = await readFile(new URL("../lessons/penguins-graphs/index.html", import.meta.url), "utf8");
  assert.match(tableHtml, /id="penguins-table-body"/);
  assert.doesNotMatch(tableHtml, /id="scatter-chart-svg"/);
  assert.match(graphHtml, /id="scatter-chart-svg"/);
  assert.doesNotMatch(graphHtml, /id="penguins-table-body"/);
  assert.match(graphHtml, /data-guard-lesson="penguins-graphs"/);
  assert.match(graphHtml, /<details class="guided-qa-list">/);
});
