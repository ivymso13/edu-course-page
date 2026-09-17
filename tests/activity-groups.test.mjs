import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
const LEARNING_LESSON_IDS = ["ai-problem-method", "ai-prediction-lab"];
const ALGORITHM_LESSON_IDS = ["ai-inference-ripeness", "ai-signal-noise", "ai-biased-data"];

async function loadGroups() {
  const raw = await readFile(new URL("data/activity-groups.json", repoRoot), "utf8");
  return JSON.parse(raw);
}

async function fileExists(relativePath) {
  try {
    await access(new URL(relativePath, repoRoot));
    return true;
  } catch {
    return false;
  }
}

test("data/activity-groups.json은 group 필수 필드(id/order/title/description/path/status/children)를 갖는다", async () => {
  const data = await loadGroups();
  assert.ok(Array.isArray(data.groups) && data.groups.length > 0, "groups 배열이 비어있음");
  for (const group of data.groups) {
    for (const field of ["id", "order", "title", "description", "path", "status", "children"]) {
      assert.ok(field in group, `group에 ${field} 필드가 없음`);
    }
    assert.ok(Array.isArray(group.children) && group.children.length > 0, `${group.id} group에 children이 없음`);
    assert.match(group.path, /\/$/, `${group.id} group.path는 트레일링 슬래시로 끝나야 함`);
  }
});

test("data/activity-groups.json의 children은 필수 필드(id/order/title/path/duration/difficulty/status/active/objective)를 갖는다", async () => {
  const data = await loadGroups();
  for (const group of data.groups) {
    for (const child of group.children) {
      for (const field of ["id", "order", "title", "path", "duration", "difficulty", "status", "active", "objective"]) {
        assert.ok(field in child, `${group.id}의 하위 활동 ${child.id ?? "?"}에 ${field} 필드가 없음`);
      }
      assert.equal(typeof child.active, "boolean", `${child.id}의 active가 boolean이 아님`);
      assert.match(child.path, /\/$/, `${child.id}의 path는 트레일링 슬래시로 끝나야 함`);
      assert.equal(typeof child.objective, "string");
      assert.ok(child.objective.length > 0, `${child.id}의 objective가 비어있음`);
    }
  }
});

test("group id와 children id는 전체 파일 안에서 중복되지 않는다", async () => {
  const data = await loadGroups();
  const groupIds = data.groups.map((group) => group.id);
  assert.equal(groupIds.length, new Set(groupIds).size, "group id가 중복됨");

  const allChildIds = data.groups.flatMap((group) => group.children.map((child) => child.id));
  assert.equal(allChildIds.length, new Set(allChildIds).size, "children id가 group을 넘어 중복됨");
});

test("children의 order는 각 group 안에서 1부터 중복 없이 순차적으로 매겨진다", async () => {
  const data = await loadGroups();
  for (const group of data.groups) {
    const orders = group.children.map((child) => child.order).sort((a, b) => a - b);
    const expected = group.children.map((_, index) => index + 1);
    assert.deepEqual(orders, expected, `${group.id}의 children order가 1..n 순차 배열이 아님`);
  }
});

test("group.path와 children.path가 가리키는 index.html 파일이 실제로 존재한다", async () => {
  const data = await loadGroups();
  for (const group of data.groups) {
    assert.ok(await fileExists(`${group.path}index.html`), `${group.path}index.html이 존재하지 않음`);
    for (const child of group.children) {
      assert.ok(await fileExists(`${child.path}index.html`), `${child.path}index.html이 존재하지 않음`);
    }
  }
});

test("활동지 04와 05의 children은 lessons.json과 순서·경로·난이도·시간이 일치한다", async () => {
  const [groupsData, lessonsRaw] = await Promise.all([
    loadGroups(),
    readFile(new URL("data/lessons.json", repoRoot), "utf8"),
  ]);
  const lessons = JSON.parse(lessonsRaw).lessons;
  const lessonsById = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson]));

  for (const [groupId, ids] of [["ai-learning", LEARNING_LESSON_IDS], ["machine-learning-algorithms", ALGORITHM_LESSON_IDS]]) {
    const group = groupsData.groups.find((candidate) => candidate.id === groupId);
    assert.ok(group, `${groupId} group을 찾을 수 없음`);
    assert.deepEqual(group.children.map((child) => child.id), ids);
    for (const child of group.children) {
      const lesson = lessonsById[child.id];
      assert.ok(lesson, `${child.id}가 data/lessons.json에 없음`);
      assert.equal(child.order, lesson.order, `${child.id}의 order가 lessons.json과 다름`);
      assert.equal(child.duration, lesson.duration, `${child.id}의 duration이 lessons.json과 다름`);
      assert.equal(child.difficulty, lesson.difficulty, `${child.id}의 difficulty가 lessons.json과 다름`);
      assert.equal(child.path, lesson.path, `${child.id}의 path가 lessons.json과 다름`);
      assert.equal(child.status, lesson.status, `${child.id}의 status가 lessons.json과 다름`);
    }
  }
});

test("루트 허브의 group-card는 data/activity-groups.json의 group.path로 연결된다", async () => {
  const [html, data] = await Promise.all([
    readFile(new URL("index.html", repoRoot), "utf8"),
    loadGroups(),
  ]);
  for (const group of data.groups) {
    assert.match(html, new RegExp(`href="${group.path.replace(/\//g, "\\/")}"`), `루트 허브에 ${group.id}로 가는 링크가 없음`);
  }
});

test("활동지 목록 페이지는 data/activity-groups.json의 children을 order 순서대로 모두 담는다", async () => {
  const data = await loadGroups();
  const group = data.groups.find((candidate) => candidate.id === "ai-learning");
  const html = await readFile(new URL(group.path + "index.html", repoRoot), "utf8");
  const sortedChildren = [...group.children].sort((a, b) => a.order - b.order);
  const positions = sortedChildren.map((child) => html.indexOf(`../../${child.path}`));
  for (const [index, position] of positions.entries()) {
    assert.ok(position !== -1, `그룹 페이지에 ${sortedChildren[index].id} 링크가 없음`);
  }
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i - 1] < positions[i], "그룹 페이지의 활동 순서가 order와 다름");
  }
});
