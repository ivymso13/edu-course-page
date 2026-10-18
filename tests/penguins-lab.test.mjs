import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parsePenguinsCSV } from "../lessons/penguins-data/game-core.js";
import {
  FEATURES,
  SPECIES,
  completeRows,
  cleanRows,
  missingCounts,
  fitMinMax,
  transform,
  relation,
  splitRows,
  trainTree,
  predict,
  evaluate,
  runModel,
} from "../lessons/penguins-data/lab-core.js";
const rows = parsePenguinsCSV(
  await readFile(
    new URL("../data/ml-practice/penguins_size.csv", import.meta.url),
    "utf8",
  ),
);
test("cleaning stages preserve original, remove exactly the notebook rows and retain identity", () => {
  assert.equal(rows.length, 344);
  assert.equal(completeRows(rows).length, 334);
  assert.equal(cleanRows(rows).length, 333);
  assert.equal(completeRows(rows).filter((r) => r.sex === ".").length, 1);
  assert.equal(cleanRows(rows).filter((r) => r.sex === ".").length, 0);
  assert.equal(missingCounts(rows).find((c) => c.key === "sex").count, 10);
  assert.equal(new Set(cleanRows(rows).map((r) => r.id)).size, 333);
});
test("MinMax uses column bounds, preserves identity and does not mutate source", () => {
  const clean = cleanRows(rows),
    original = structuredClone(clean),
    scaler = fitMinMax(clean),
    scaled = transform(clean, scaler);
  for (const k of FEATURES) {
    assert.equal(Math.min(...scaled.map((r) => r[k])), 0);
    assert.equal(Math.max(...scaled.map((r) => r[k])), 1);
  }
  assert.deepEqual(clean, original);
  assert.deepEqual(
    scaled.map((r) => [r.id, r.species]),
    clean.map((r) => [r.id, r.species]),
  );
  const constant = transform([{ ...clean[0], body_mass_g: 5 }], {
    body_mass_g: { min: 5, max: 5 },
  });
  assert.equal(constant[0].body_mass_g, 0);
});
test("correlation is symmetric, self equals 1, and positive scaling retains coefficient", () => {
  const clean = cleanRows(rows),
    scaled = transform(clean, fitMinMax(clean));
  for (const a of FEATURES)
    for (const b of FEATURES) {
      const r = relation(clean, a, b).r;
      assert.ok(r >= -1.000000001 && r <= 1.000000001);
      assert.ok(Math.abs(r - relation(clean, b, a).r) < 1e-12);
      assert.ok(Math.abs(r - relation(scaled, a, b).r) < 1e-12);
      if (a === b) assert.equal(r, 1);
    }
});
test("deterministic stratified split has no overlap or missing rows and varies by seed", () => {
  const clean = cleanRows(rows),
    split = splitRows(clean, 0.3, 42);
  assert.equal(split.train.length, 233);
  assert.equal(split.test.length, 100);
  const training = new Set(split.train.map((r) => r.id));
  assert.ok(split.test.every((r) => !training.has(r.id)));
  assert.equal(
    new Set([...split.train, ...split.test].map((r) => r.id)).size,
    333,
  );
  assert.deepEqual(splitRows(clean, 0.3, 42), split);
  assert.notDeepEqual(
    splitRows(clean, 0.3, 43).test.map((r) => r.id),
    split.test.map((r) => r.id),
  );
  for (const sp of SPECIES)
    assert.ok(
      Math.abs(
        split.test.filter((r) => r.species === sp).length /
          clean.filter((r) => r.species === sp).length -
          0.3,
      ) < 0.01,
    );
});
test("CART learns three ordered classes, depth changes capacity, evaluation counts mistakes", () => {
  const toy = SPECIES.flatMap((species, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      species,
      culmen_length_mm: i * 10 + j,
    })),
  );
  const tree = trainTree(toy, ["culmen_length_mm"], 2);
  assert.equal(evaluate(tree, toy).accuracy, 1);
  assert.equal(predict(tree, { culmen_length_mm: 11 }), "Chinstrap");
  const stump = trainTree(toy, ["culmen_length_mm"], 1);
  assert.ok(evaluate(stump, toy).accuracy < 1);
  const wrong = evaluate(tree, [{ species: "Gentoo", culmen_length_mm: 0 }]);
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.matrix[2][0], 1);
  assert.throws(() => trainTree(toy, [], 2), /입력 속성/);
});
test("real data model computes held-out metrics, normalized bounds use train only", () => {
  for (const normalize of [false, true]) {
    const m = runModel(rows, { normalize });
    assert.ok(m.validation.accuracy > 0.85 && m.validation.accuracy <= 1);
    assert.equal(
      m.validation.matrix.flat().reduce((a, b) => a + b, 0),
      m.test.length,
    );
    assert.equal(
      m.validation.correct,
      SPECIES.reduce((s, _, i) => s + m.validation.matrix[i][i], 0),
    );
    if (normalize) {
      const originalTraining = rows.filter((r) =>
        new Set(m.train.map((x) => x.id)).has(r.id),
      );
      for (const k of FEATURES)
        assert.equal(
          m.scaler[k].max,
          Math.max(...originalTraining.map((r) => r[k])),
        );
    }
  }
});
test("four independent guarded pages connect in sequence with no quiz or notebook buttons", async () => {
  const ids = [
    "penguins-data",
    "penguins-cleaning",
    "penguins-graphs",
    "penguins-model",
  ];
  for (const [i, id] of ids.entries()) {
    const html = await readFile(
      new URL(`../lessons/${id}/index.html`, import.meta.url),
      "utf8",
    );
    assert.match(html, new RegExp(`data-guard-lesson="${id}"`));
    assert.doesNotMatch(
      html,
      /type="radio"|정답 확인|사본 만들기|\.ipynb|수업 준비 자료/,
    );
    if (i < 3) assert.ok(html.includes(`href="../${ids[i + 1]}/"`));
  }
});

test("first activity separates counts from species body-mass distributions", async () => {
  const { bodyMassBoxes } = await import(
    "../lessons/penguins-data/lab-core.js"
  );
  const boxes = bodyMassBoxes(rows);
  assert.deepEqual(
    boxes.map((box) => [box.species, box.count, box.median]),
    [
      ["Adelie", 151, 3700],
      ["Chinstrap", 68, 3700],
      ["Gentoo", 123, 5000],
    ],
  );
  assert.equal(
    boxes.reduce((sum, box) => sum + box.count, 0),
    342,
  );
  const html = await readFile(
    new URL("../lessons/penguins-data/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="species-chart"/);
  assert.match(html, /id="body-mass-chart"/);
});

test("stratified split sizes match scikit-learn train_test_split for every offered ratio", async () => {
  const { splitSizes, parseSeed } = await import(
    "../lessons/penguins-data/lab-core.js"
  );
  const clean = cleanRows(rows);
  // Values printed by train_test_split(..., stratify=y) on the same 333 rows.
  const expected = {
    0.2: { train: 266, test: [29, 14, 24] },
    0.3: { train: 233, test: [44, 20, 36] },
    0.4: { train: 199, test: [59, 27, 48] },
  };
  for (const [ratio, want] of Object.entries(expected)) {
    assert.deepEqual(splitSizes([146, 68, 119], Number(ratio)), want.test);
    for (const seed of [0, 42, 99999]) {
      const split = splitRows(clean, Number(ratio), seed);
      assert.equal(split.train.length, want.train);
      assert.deepEqual(
        SPECIES.map((sp) => split.test.filter((r) => r.species === sp).length),
        want.test,
      );
    }
  }
  assert.equal(parseSeed(""), null);
  assert.equal(parseSeed("  "), null);
  assert.equal(parseSeed("-1"), null);
  assert.equal(parseSeed("1.5"), null);
  assert.equal(parseSeed("100000"), null);
  assert.equal(parseSeed("0"), 0);
  assert.equal(parseSeed("42"), 42);
  assert.equal(parseSeed("99999"), 99999);
  const game = await readFile(
    new URL("../lessons/penguins-data/game.js", import.meta.url),
    "utf8",
  );
  assert.match(game, /seed: parseSeed\(\$\("#model-seed"\)\.value\)/);
});

test("displayed Python uses the original lesson operations without web helper commands", async () => {
  const C = await import("../lessons/penguins-data/lab-commands.js");
  assert.equal(C.previewCommand([11, 12]), "df");
  assert.match(C.cleaningCommand(2), /dropna\(\)/);
  assert.match(
    C.normalizeCommand(true),
    /df\[col\] = scaler\.fit_transform\(df\[col\]\)/,
  );
  const commands = [
    C.previewCommand(),
    C.cleaningCommand(2),
    C.normalizeCommand(true),
    C.boxCommand("body_mass_g"),
    C.scatterCommand({
      x: "culmen_length_mm",
      y: "body_mass_g",
      normalized: true,
      colored: true,
      regression: true,
    }),
    C.modelCommand({
      features: ["body_mass_g"],
      testRatio: 0.4,
      seed: 7,
      maxDepth: 2,
      normalize: true,
    }),
  ];
  for (const command of commands)
    assert.doesNotMatch(
      command,
      /nunique|\.iloc|\.loc|\.copy\(|pd\.DataFrame|\.transform\(|original_df|complete_df|plot_df|sample/,
    );
  for (const slug of [
    "penguins-data",
    "penguins-cleaning",
    "penguins-graphs",
    "penguins-model",
  ]) {
    const html = await readFile(
      new URL(`../lessons/${slug}/index.html`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      html,
      /nunique|prediction-command|original_df|complete_df|plot_df/,
    );
  }
});
