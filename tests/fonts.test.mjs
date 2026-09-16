import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const HTML_FILES = [
  "index.html",
  "units/ai-vocabulary/index.html",
  "units/ai-evaluation/index.html",
  "units/ai-learning/index.html",
  "lessons/search-tictactoe-minimax/index.html",
  "lessons/ai-keyword-bingo/index.html",
  "lessons/turing-test-questions/index.html",
  "lessons/arc-puzzle-challenge/index.html",
  "lessons/turing-vs-arc-compare/index.html",
  "lessons/ai-inference-ripeness/index.html",
  "lessons/ai-signal-noise/index.html",
  "lessons/ai-biased-data/index.html",
];

const CSS_FILES = [
  "assets/hub.css",
  "assets/guard.css",
  "assets/fonts.css",
  "lessons/shared/lab-base.css",
  "lessons/ai-inference-ripeness/styles.css",
  "lessons/ai-keyword-bingo/styles.css",
  "lessons/ai-signal-noise/styles.css",
  "lessons/ai-biased-data/styles.css",
  "lessons/arc-puzzle-challenge/styles.css",
  "lessons/turing-test-questions/styles.css",
  "lessons/turing-vs-arc-compare/styles.css",
];

const EXTERNAL_FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/i;

test("assets/fonts/NotoSansKR-Variable.woff2가 유효한 WOFF2 파일로 존재한다", async () => {
  const fontPath = path.join(repoRoot, "assets/fonts/NotoSansKR-Variable.woff2");
  const info = await stat(fontPath);
  assert.ok(info.isFile(), "폰트 파일이 없음");
  assert.ok(info.size > 100_000, "폰트 파일 크기가 비정상적으로 작음(다운로드 실패 의심)");
  assert.ok(info.size < 10_000_000, "폰트 파일 크기가 지나치게 큼(합리적인 용량을 벗어남)");

  const buffer = await readFile(fontPath);
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "wOF2", "WOFF2 매직 넘버(wOF2)가 아님");
});

test("assets/fonts/OFL.txt에 SIL Open Font License 1.1 원문이 그대로 들어있다", async () => {
  const licenseText = await readFile(path.join(repoRoot, "assets/fonts/OFL.txt"), "utf8");
  assert.match(licenseText, /SIL OPEN FONT LICENSE/i);
  assert.match(licenseText, /Version 1\.1/);
  assert.match(licenseText, /PERMISSION (?:&|AND) CONDITIONS/i);
});

test("assets/fonts.css는 로컬 WOFF2를 font-display:swap으로 선언하고 --font-sans/--font-mono 변수를 정의한다", async () => {
  const css = await readFile(path.join(repoRoot, "assets/fonts.css"), "utf8");
  assert.match(css, /@font-face/);
  assert.match(css, /font-family:\s*"Noto Sans KR"/);
  assert.match(css, /font-display:\s*swap/);
  assert.match(css, /src:\s*url\("fonts\/NotoSansKR-Variable\.woff2"\)\s*format\("woff2"\)/);
  assert.match(css, /--font-sans:\s*"Noto Sans KR"/);
  assert.match(css, /--font-mono:/);
  assert.doesNotMatch(css, /https?:\/\//, "fonts.css가 외부 네트워크 URL을 참조하면 안 됨");
});

test("모든 HTML 페이지가 assets/fonts.css를 올바른 상대 경로로 링크하고, 그 대상 파일이 실제로 존재한다", async () => {
  for (const file of HTML_FILES) {
    const html = await readFile(path.join(repoRoot, file), "utf8");
    const match = html.match(/<link rel="stylesheet" href="((?:\.\.\/)*assets\/fonts\.css)">/);
    assert.ok(match, `${file}에 assets/fonts.css 링크가 없음`);

    const resolved = path.resolve(path.dirname(path.join(repoRoot, file)), match[1]);
    const info = await stat(resolved);
    assert.ok(info.isFile(), `${file}의 fonts.css 상대 경로(${match[1]})가 실제 파일을 가리키지 않음`);
    assert.equal(resolved, path.join(repoRoot, "assets/fonts.css"), `${file}의 fonts.css 링크가 공용 파일을 가리키지 않음`);
  }
});

test("루트 허브·units·lessons의 스타일시트 어디에도 외부 폰트 CDN 요청이 없다(Google Fonts 등)", async () => {
  const allFiles = [...HTML_FILES, ...CSS_FILES];
  for (const file of allFiles) {
    const text = await readFile(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(text, EXTERNAL_FONT_HOSTS, `${file}가 외부 폰트 CDN을 참조함`);
    assert.doesNotMatch(text, /@import\s+url\(['"]?https?:/, `${file}가 외부 @import를 사용함`);
  }
});

test("본문 폰트를 쓰는 CSS는 var(--font-sans)를 쓰고, 실제 로드되지 않는 Pretendard 같은 이름을 폴백 앞단에 남기지 않는다", async () => {
  for (const file of [
    "assets/hub.css",
    "lessons/shared/lab-base.css",
    "lessons/ai-inference-ripeness/styles.css",
  ]) {
    const css = await readFile(path.join(repoRoot, file), "utf8");
    assert.match(css, /body\s*\{[^}]*font-family:\s*var\(--font-sans\)/, `${file}의 body font-family가 var(--font-sans)를 쓰지 않음`);
    assert.doesNotMatch(css, /font-family:\s*Pretendard/i, `${file}에 로드되지 않는 Pretendard 폴백이 남아있음`);
  }
});

test("의도적인 monospace(고정폭 숫자·단축키 표시)는 그대로 보존된다", async () => {
  for (const file of [
    "lessons/shared/lab-base.css",
    "lessons/ai-inference-ripeness/styles.css",
    "lessons/ai-keyword-bingo/styles.css",
  ]) {
    const css = await readFile(path.join(repoRoot, file), "utf8");
    assert.match(css, /font-family:\s*ui-monospace,\s*monospace/, `${file}의 monospace 지정이 사라짐`);
  }
});

test("fonts.css 링크는 각 페이지에서 첫 번째 stylesheet 링크다", async () => {
  for (const file of HTML_FILES) {
    const html = await readFile(path.join(repoRoot, file), "utf8");
    const linkTags = [...html.matchAll(/<link rel="stylesheet" href="([^"]*)">/g)].map((m) => m[1]);
    assert.ok(linkTags.length > 0, `${file}에 stylesheet 링크가 없음`);
    assert.match(linkTags[0], /assets\/fonts\.css$/, `${file}의 첫 stylesheet 링크가 fonts.css가 아님`);
  }
});
