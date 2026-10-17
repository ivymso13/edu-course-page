import { FEATURE_INFO } from "./game-core.js";
export const FEATURES = Object.keys(FEATURE_INFO);
export const SPECIES = ["Adelie", "Chinstrap", "Gentoo"];
export const COLUMNS = ["species", "island", ...FEATURES, "sex"];
export function completeRows(rows) {
  return rows.filter((r) =>
    COLUMNS.every(
      (k) =>
        r[k] !== null &&
        r[k] !== undefined &&
        (typeof r[k] !== "number" || Number.isFinite(r[k])),
    ),
  );
}
export function cleanRows(rows) {
  return completeRows(rows).filter(
    (r) => r.sex === "MALE" || r.sex === "FEMALE",
  );
}
export function missingCounts(rows) {
  return COLUMNS.map((key) => ({
    key,
    count: rows.filter(
      (r) =>
        r[key] === null ||
        r[key] === undefined ||
        (typeof r[key] === "number" && !Number.isFinite(r[key])),
    ).length,
  }));
}
export function quantile(values, p) {
  const a = [...values].sort((a, b) => a - b);
  if (!a.length) return null;
  const i = (a.length - 1) * p,
    l = Math.floor(i);
  return a[l] + (a[Math.ceil(i)] - a[l]) * (i - l);
}
export function summary(rows, key) {
  const v = rows
    .map((r) => r[key])
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return {
    count: v.length,
    mean,
    std:
      v.length > 1
        ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length - 1))
        : 0,
    min: Math.min(...v),
    q1: quantile(v, 0.25),
    median: quantile(v, 0.5),
    q3: quantile(v, 0.75),
    max: Math.max(...v),
  };
}
export function fitMinMax(rows, features = FEATURES) {
  return Object.fromEntries(
    features.map((k) => [
      k,
      {
        min: Math.min(...rows.map((r) => r[k])),
        max: Math.max(...rows.map((r) => r[k])),
      },
    ]),
  );
}
export function transform(rows, scaler) {
  return rows.map((r) => ({
    ...r,
    ...Object.fromEntries(
      Object.entries(scaler).map(([k, s]) => [
        k,
        s.max === s.min ? 0 : (r[k] - s.min) / (s.max - s.min),
      ]),
    ),
  }));
}
export function relation(rows, x, y) {
  const n = rows.length,
    mx = rows.reduce((s, r) => s + r[x], 0) / n,
    my = rows.reduce((s, r) => s + r[y], 0) / n;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const r of rows) {
    xx += (r[x] - mx) ** 2;
    yy += (r[y] - my) ** 2;
    xy += (r[x] - mx) * (r[y] - my);
  }
  const slope = xx ? xy / xx : 0;
  return {
    r: xx && yy ? xy / Math.sqrt(xx * yy) : 0,
    slope,
    intercept: my - slope * mx,
  };
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(rows, random) {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Same per-class sizes as scikit-learn's stratified train_test_split:
// test rows = ceil(n × ratio), then largest-remainder allocation per class.
function allocate(classCounts, draws) {
  const total = classCounts.reduce((a, b) => a + b, 0),
    exact = classCounts.map((c) => (c * draws) / total),
    result = exact.map(Math.floor);
  let need = draws - result.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => [v - result[i], i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (!need) break;
    result[i]++;
    need--;
  }
  return result;
}
export function splitSizes(classCounts, testRatio) {
  const n = classCounts.reduce((a, b) => a + b, 0),
    testTotal = Math.ceil(n * testRatio - 1e-9),
    train = allocate(classCounts, n - testTotal);
  return allocate(
    classCounts.map((c, i) => c - train[i]),
    testTotal,
  );
}
export function splitRows(rows, testRatio = 0.3, seed = 42) {
  if (testRatio <= 0 || testRatio >= 1) throw Error("검증 비율을 확인하세요.");
  const random = rng(seed),
    train = [],
    test = [];
  const groups = SPECIES.map((sp) => rows.filter((r) => r.species === sp));
  if (groups.some((group) => group.length < 2))
    throw Error("각 종류에 두 행 이상 필요합니다.");
  const sizes = splitSizes(
    groups.map((group) => group.length),
    testRatio,
  );
  groups.forEach((rowsOfSpecies, i) => {
    const group = shuffled(rowsOfSpecies, random),
      n = Math.max(1, Math.min(group.length - 1, sizes[i]));
    test.push(...group.slice(0, n));
    train.push(...group.slice(n));
  });
  return { train: shuffled(train, random), test: shuffled(test, random) };
}
// The seed box must hold a whole number 0–99999; an empty box is not seed 0.
export function parseSeed(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,5}$/.test(text)) return null;
  return Number(text);
}
function counts(rows) {
  return SPECIES.map((s) => rows.filter((r) => r.species === s).length);
}
function gini(n) {
  const total = n.reduce((a, b) => a + b, 0);
  return total ? 1 - n.reduce((s, x) => s + (x / total) ** 2, 0) : 0;
}
export function trainTree(rows, features, maxDepth = 3, depth = 0) {
  if (
    !rows.length ||
    !features.length ||
    features.some((k) => !FEATURES.includes(k))
  )
    throw Error("입력 속성을 한 개 이상 선택하세요.");
  const distribution = counts(rows),
    winner = distribution.indexOf(Math.max(...distribution));
  const node = {
    prediction: SPECIES[winner],
    samples: rows.length,
    distribution,
    depth,
  };
  if (depth >= maxDepth || gini(distribution) < 1e-12) return node;
  let best = null;
  for (const feature of features) {
    const sorted = [...rows].sort((a, b) => a[feature] - b[feature]),
      left = [0, 0, 0],
      right = [...distribution];
    for (let i = 0; i < sorted.length - 1; i++) {
      const label = SPECIES.indexOf(sorted[i].species);
      left[label]++;
      right[label]--;
      if (sorted[i][feature] === sorted[i + 1][feature]) continue;
      const score =
        ((i + 1) * gini(left) + (sorted.length - i - 1) * gini(right)) /
        rows.length;
      if (!best || score < best.score - 1e-12)
        best = {
          feature,
          threshold: (sorted[i][feature] + sorted[i + 1][feature]) / 2,
          score,
        };
    }
  }
  if (!best || gini(distribution) - best.score < 1e-12) return node;
  return {
    ...node,
    feature: best.feature,
    threshold: best.threshold,
    left: trainTree(
      rows.filter((r) => r[best.feature] <= best.threshold),
      features,
      maxDepth,
      depth + 1,
    ),
    right: trainTree(
      rows.filter((r) => r[best.feature] > best.threshold),
      features,
      maxDepth,
      depth + 1,
    ),
  };
}
export function predict(tree, row) {
  let node = tree;
  while (node.feature)
    node = row[node.feature] <= node.threshold ? node.left : node.right;
  return node.prediction;
}
export function evaluate(tree, rows) {
  const matrix = SPECIES.map(() => SPECIES.map(() => 0));
  let correct = 0;
  for (const r of rows) {
    const predicted = predict(tree, r);
    matrix[SPECIES.indexOf(r.species)][SPECIES.indexOf(predicted)]++;
    if (predicted === r.species) correct++;
  }
  return {
    matrix,
    correct,
    total: rows.length,
    accuracy: rows.length ? correct / rows.length : 0,
  };
}
export function runModel(
  rows,
  {
    features = FEATURES,
    testRatio = 0.3,
    seed = 42,
    maxDepth = 3,
    normalize = false,
  } = {},
) {
  const cleaned = cleanRows(rows),
    split = splitRows(cleaned, testRatio, seed);
  const scaler = normalize ? fitMinMax(split.train, features) : null;
  const train = scaler ? transform(split.train, scaler) : split.train,
    test = scaler ? transform(split.test, scaler) : split.test;
  const tree = trainTree(train, features, maxDepth);
  return {
    tree,
    train,
    test,
    scaler,
    features,
    seed,
    maxDepth,
    training: evaluate(tree, train),
    validation: evaluate(tree, test),
  };
}

// Body-mass distributions use only rows with a measurement, before preprocessing.
export function bodyMassBoxes(rows) {
  return SPECIES.map((species) => {
    const group = rows.filter(
      (row) => row.species === species && Number.isFinite(row.body_mass_g),
    );
    const stats = summary(group, "body_mass_g");
    const iqr = stats.q3 - stats.q1;
    const inside = group
      .map((row) => row.body_mass_g)
      .filter(
        (value) =>
          value >= stats.q1 - 1.5 * iqr && value <= stats.q3 + 1.5 * iqr,
      );
    return {
      species,
      count: group.length,
      q1: stats.q1,
      median: stats.median,
      q3: stats.q3,
      lower: Math.min(...inside),
      upper: Math.max(...inside),
      outliers: group.filter(
        (row) =>
          row.body_mass_g < stats.q1 - 1.5 * iqr ||
          row.body_mass_g > stats.q3 + 1.5 * iqr,
      ),
    };
  });
}
