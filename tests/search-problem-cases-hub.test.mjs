import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
const hubPath = new URL("units/search-problem-cases/index.html", repoRoot);

test("허브(units/search-problem-cases)는 fonts.css·hub.css·guard.css를 링크하고 그룹 가드 속성을 갖춘다", async () => {
  const html = await readFile(hubPath, "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>탐색의 다양한 문제 해결 사례 \| 인공지능 기초 활동지 모음<\/title>/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/fonts\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/hub\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/assets\/guard\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/assets\/group-guard\.js"/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="search-problem-cases"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/"/);
});

test("허브는 게임 트리 예시 1·2 두 활동을 담고, 제거된 경로 탐색·지역 탐색 카드는 없다", async () => {
  const html = await readFile(hubPath, "utf8");
  assert.match(html, /data-lesson-card="search-tictactoe-minimax"/);
  assert.match(html, /href="\.\.\/\.\.\/lessons\/search-tictactoe-minimax\/"/);
  assert.match(html, /data-lesson-card="search-othello-minimax"/);
  assert.match(html, /href="\.\.\/\.\.\/lessons\/search-othello-minimax\/"/);
  assert.doesNotMatch(html, /search-route-case/);
  assert.doesNotMatch(html, /search-local-case/);

  const cardMatches = html.match(/class="lesson-card"/g) ?? [];
  assert.equal(cardMatches.length, 2, "허브는 활동 카드 두 개를 가져야 함");
});

test("허브는 외부 네트워크 요청 없이 저장소 안의 상대 경로 자산만 사용한다", async () => {
  const html = await readFile(hubPath, "utf8");
  assert.doesNotMatch(html, /https?:\/\//);
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)).map((match) => match[1]);
  for (const src of scriptSrcs) {
    assert.equal(src, "../../assets/group-guard.js", `허용되지 않은 script src: ${src}`);
  }
});
