// 쇼핑몰 고객 군집 실습의 순수 계산 모듈(DOM 없음 → node --test로 검증).
// 원본 Mall_Customers.csv(200행 × 5열)를 그대로 읽고, 정규화 없이 원래 단위의 값으로
// K-평균 군집(KMeans)과 실루엣 점수(silhouette_score)를 브라우저에서 직접 계산한다.
// 화면 출력은 pandas/numpy의 기본 출력 형식을 흉내 내 보여 준다(파이썬을 실행하지 않는다).

import { createRandom, numpyFormatter, pyFloat } from "../body-regression/game-core.js";

export { pyFloat };

export const COLUMNS = ["CustomerID", "Genre", "Age", "Annual Income (k$)", "Spending Score (1-100)"];
export const NUMERIC_COLUMNS = ["CustomerID", "Age", "Annual Income (k$)", "Spending Score (1-100)"];
export const INCOME = "Annual Income (k$)";
export const SPENDING = "Spending Score (1-100)";
export const AGE = "Age";
export const FEATURES_2D = [INCOME, SPENDING];
export const FEATURES_3D = [INCOME, SPENDING, AGE];
export const K_RANGE = Object.freeze({ min: 2, max: 8, default: 5 });
export const N_INIT = 10;
export const MAX_ITER = 300;
export const TOL = 1e-4;
export const SEED = 42;

// ---------- CSV ----------

// 머리글과 열 순서가 원본과 같아야 한다. 빈 칸이나 숫자가 아닌 값은 조용히 지우지 않고 오류로 알린다.
// CustomerID는 파일에 "0001"처럼 적혀 있지만 pandas처럼 정수(1)로 읽고, 원래 글자는 idText에 남긴다.
export function parseMallCSV(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("CSV에 데이터 행이 없습니다.");
  const header = lines[0].split(",").map((name) => name.trim());
  if (header.join(",") !== COLUMNS.join(",")) throw new Error(`CSV 머리글이 ${COLUMNS.join(", ")} 이어야 합니다.`);
  const rows = lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== COLUMNS.length) throw new Error(`${rowIndex + 1}번째 데이터 행의 열 개수가 ${COLUMNS.length}개가 아닙니다.`);
    const row = { idText: cells[0] };
    COLUMNS.forEach((name, i) => {
      if (name === "Genre") {
        if (cells[i] === "") throw new Error(`${rowIndex + 1}번째 데이터 행의 Genre 값이 비어 있습니다.`);
        row[name] = cells[i];
        return;
      }
      const value = cells[i] === "" ? NaN : Number(cells[i]);
      if (!Number.isFinite(value)) throw new Error(`${rowIndex + 1}번째 데이터 행의 ${name} 값이 숫자가 아닙니다.`);
      row[name] = value;
    });
    return row;
  });
  return { columns: COLUMNS.slice(), rows };
}

// df[[...]].values 와 같은 2차원 배열.
export const toMatrix = (rows, features) => rows.map((row) => features.map((name) => row[name]));

// ---------- 거리 ----------

export function squaredDistance(a, b) {
  let sum = 0;
  for (let j = 0; j < a.length; j += 1) sum += (a[j] - b[j]) ** 2;
  return sum;
}

export function nearestCenter(point, centers) {
  let best = 0;
  let bestDistance = Infinity;
  for (let c = 0; c < centers.length; c += 1) {
    const distance = squaredDistance(point, centers[c]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = c;
    }
  }
  return { label: best, distance: bestDistance };
}

// ---------- K-평균 ----------

function columnVariances(X) {
  const p = X[0].length;
  return Array.from({ length: p }, (_, j) => {
    let mean = 0;
    for (const row of X) mean += row[j];
    mean /= X.length;
    let ss = 0;
    for (const row of X) ss += (row[j] - mean) ** 2;
    return ss / X.length;
  });
}

// scikit-learn과 같은 기준: tol × (속성별 분산의 평균). 중심 이동 거리 제곱합이 이보다 작으면 멈춘다.
export function scaledTolerance(X, tol = TOL) {
  const variances = columnVariances(X);
  return (tol * variances.reduce((sum, value) => sum + value, 0)) / variances.length;
}

function pickByWeight(weights, total, random) {
  let target = random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= weights[i];
    if (target < 0) return i;
  }
  // 부동소수 오차로 끝까지 온 경우: 가중치가 있는 마지막 점.
  for (let i = weights.length - 1; i >= 0; i -= 1) if (weights[i] > 0) return i;
  return Math.floor(random() * weights.length);
}

// greedy k-means++ 초기화(scikit-learn 기본과 같은 아이디어, 후보 2 + ⌊ln k⌋개 중 가장 좋은 점 선택).
// 서로 다른 점이 k개보다 적어 남은 거리가 모두 0이면 아직 고르지 않은 점을 무작위로 고른다.
export function kmeansPlusPlus(X, k, random) {
  const n = X.length;
  const trials = 2 + Math.floor(Math.log(k));
  const first = Math.floor(random() * n);
  const centers = [X[first].slice()];
  const closest = X.map((point) => squaredDistance(point, centers[0]));
  for (let c = 1; c < k; c += 1) {
    const total = closest.reduce((sum, value) => sum + value, 0);
    let chosen = -1;
    let chosenDistances = null;
    if (total > 0) {
      let bestPotential = Infinity;
      for (let t = 0; t < trials; t += 1) {
        const candidate = pickByWeight(closest, total, random);
        const distances = closest.map((value, i) => Math.min(value, squaredDistance(X[i], X[candidate])));
        const potential = distances.reduce((sum, value) => sum + value, 0);
        if (potential < bestPotential) {
          bestPotential = potential;
          chosen = candidate;
          chosenDistances = distances;
        }
      }
    } else {
      chosen = Math.floor(random() * n);
      chosenDistances = closest.slice();
    }
    centers.push(X[chosen].slice());
    for (let i = 0; i < n; i += 1) closest[i] = chosenDistances[i];
  }
  return centers;
}

export function assign(X, centers) {
  const labels = new Array(X.length);
  const distances = new Array(X.length);
  let inertia = 0;
  X.forEach((point, i) => {
    const { label, distance } = nearestCenter(point, centers);
    labels[i] = label;
    distances[i] = distance;
    inertia += distance;
  });
  return { labels, distances, inertia };
}

// 각 군집에 속한 점의 평균으로 중심을 옮긴다. 빈 군집이 생기면(scikit-learn처럼)
// 현재 중심에서 가장 멀리 떨어진 점을 그 군집의 새 중심으로 옮겨 군집 수를 유지한다.
export function updateCenters(X, labels, distances, k) {
  const p = X[0].length;
  const sums = Array.from({ length: k }, () => new Array(p).fill(0));
  const counts = new Array(k).fill(0);
  X.forEach((point, i) => {
    counts[labels[i]] += 1;
    for (let j = 0; j < p; j += 1) sums[labels[i]][j] += point[j];
  });
  const empty = counts.map((count, c) => (count === 0 ? c : -1)).filter((c) => c >= 0);
  let relocated = 0;
  if (empty.length) {
    const far = X.map((_, i) => i).sort((a, b) => distances[b] - distances[a] || a - b);
    const used = new Set();
    for (const c of empty) {
      const index = far.find((i) => !used.has(i) && counts[labels[i]] > 1);
      if (index === undefined) continue;
      used.add(index);
      const old = labels[index];
      counts[old] -= 1;
      for (let j = 0; j < p; j += 1) sums[old][j] -= X[index][j];
      counts[c] = 1;
      sums[c] = X[index].slice();
      labels[index] = c;
      relocated += 1;
    }
  }
  const centers = sums.map((sum, c) => sum.map((value) => (counts[c] ? value / counts[c] : 0)));
  return { centers, relocated };
}

// Lloyd 반복. 중심 이동이 허용 오차 이하이거나 군집 번호가 하나도 바뀌지 않으면 수렴으로 본다.
export function lloyd(X, initialCenters, { maxIter = MAX_ITER, tol = TOL } = {}) {
  const k = initialCenters.length;
  const tolerance = scaledTolerance(X, tol);
  let centers = initialCenters.map((center) => center.slice());
  let current = assign(X, centers);
  let converged = false;
  let nIter = 0;
  let emptyRelocations = 0;
  for (let iter = 1; iter <= maxIter; iter += 1) {
    nIter = iter;
    const update = updateCenters(X, current.labels.slice(), current.distances, k);
    emptyRelocations += update.relocated;
    const shift = update.centers.reduce((sum, center, c) => sum + squaredDistance(center, centers[c]), 0);
    centers = update.centers;
    const next = assign(X, centers);
    const sameLabels = next.labels.every((label, i) => label === current.labels[i]);
    current = next;
    if (sameLabels || shift <= tolerance) {
      converged = true;
      break;
    }
  }
  // 돌려주는 군집 번호와 inertia는 반드시 최종 중심으로 다시 계산한 값이다.
  return { centers, labels: current.labels, inertia: current.inertia, nIter, converged, emptyRelocations };
}

// KMeans(n_clusters=k, n_init=10)과 같은 절차: 서로 다른 시작점으로 10번 학습해 inertia가 가장 작은 결과를 고른다.
// 난수 생성기는 scikit-learn(numpy)과 다르므로 같은 seed여도 군집 번호와 세부 결과가 다를 수 있다.
export function fitKMeans(X, { k = K_RANGE.default, nInit = N_INIT, seed = SEED, maxIter = MAX_ITER, tol = TOL } = {}) {
  if (!Array.isArray(X) || X.length === 0) throw new Error("학습 데이터가 비어 있습니다.");
  if (!Number.isInteger(k) || k < 1) throw new Error("군집 수 k는 1 이상의 정수여야 합니다.");
  if (k > X.length) throw new Error(`군집 수 k(${k})가 데이터 수(${X.length})보다 많습니다.`);
  const random = createRandom(seed);
  let best = null;
  const runs = [];
  for (let run = 0; run < nInit; run += 1) {
    const result = lloyd(X, kmeansPlusPlus(X, k, random), { maxIter, tol });
    runs.push({ inertia: result.inertia, nIter: result.nIter, converged: result.converged });
    if (!best || result.inertia < best.inertia) best = result;
  }
  return { k, nInit, seed, nFeatures: X[0].length, ...best, runs };
}

export const predictKMeans = (model, X) => X.map((point) => nearestCenter(point, model.centers).label);

export function clusterCounts(labels, k) {
  const counts = new Array(k).fill(0);
  for (const label of labels) counts[label] += 1;
  return counts;
}

// ---------- 실루엣 점수 ----------

// sklearn.metrics.silhouette_score(X, labels)와 같은 정의(유클리드 거리).
// a = 같은 군집의 다른 점까지 평균 거리, b = 가장 가까운 다른 군집까지 평균 거리, s = (b − a) / max(a, b).
// 점이 하나뿐인 군집의 점은 s = 0. 군집이 2개 미만이거나 n−1개 초과면 계산할 수 없다.
export function silhouetteSamples(X, labels) {
  const n = X.length;
  if (labels.length !== n) throw new Error("X와 labels의 길이가 다릅니다.");
  const ids = [...new Set(labels)].sort((a, b) => a - b);
  if (ids.length < 2 || ids.length > n - 1) {
    throw new Error(`군집 수가 ${ids.length}개입니다. 실루엣 점수는 군집이 2개 이상, ${n - 1}개 이하일 때만 계산할 수 있습니다.`);
  }
  const position = new Map(ids.map((id, index) => [id, index]));
  const sizes = new Array(ids.length).fill(0);
  labels.forEach((label) => (sizes[position.get(label)] += 1));
  const scores = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const sums = new Array(ids.length).fill(0);
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      sums[position.get(labels[j])] += Math.sqrt(squaredDistance(X[i], X[j]));
    }
    const own = position.get(labels[i]);
    if (sizes[own] === 1) {
      scores[i] = 0;
      continue;
    }
    const a = sums[own] / (sizes[own] - 1);
    let b = Infinity;
    sums.forEach((sum, c) => {
      if (c !== own) b = Math.min(b, sum / sizes[c]);
    });
    const denominator = Math.max(a, b);
    scores[i] = denominator === 0 ? 0 : (b - a) / denominator;
  }
  return scores;
}

export function silhouetteScore(X, labels) {
  const samples = silhouetteSamples(X, labels);
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

// ---------- 화면 출력 형식(numpy 흉내) ----------

// numpy가 줄을 바꾸는 규칙(linewidth=75, repr은 끝의 ")" 몫 1자를 뺌).
function wrapNumpy(words, prefix, width) {
  const hanging = " ".repeat(prefix.length);
  const elemWidth = width - 1;
  let text = "";
  let line = hanging;
  words.forEach((word, index) => {
    const isLast = index === words.length - 1;
    if (line.length + word.length > elemWidth && line.length > hanging.length) {
      text += `${line.replace(/\s+$/, "")}\n`;
      line = hanging;
    }
    line += word;
    if (!isLast) line += ", ";
  });
  text += line;
  return prefix + text.slice(hanging.length);
}

// repr(정수 배열): array([1, 3, 1, ...], dtype=int32) — 원소 폭을 맞추고 75자 너비에서 줄바꿈.
// 코랩(scikit-learn)의 군집 번호 배열은 int32라서 numpy가 dtype을 덧붙인다.
export function intArrayRepr(values, dtype = "int32") {
  const width = Math.max(...values.map((value) => String(value).length));
  const body = `${wrapNumpy(values.map((value) => String(value).padStart(width)), "array([", 74)}]`;
  if (!dtype) return `${body})`;
  const suffix = `dtype=${dtype})`;
  const lastLine = body.slice(body.lastIndexOf("\n") + 1);
  return lastLine.length + 2 + suffix.length > 75 ? `${body},\n      ${suffix}` : `${body}, ${suffix}`;
}

// repr(2차원 실수 배열): array([[86.53846154, 82.12820513],\n       [...]])
export function floatMatrixRepr(matrix) {
  const format = numpyFormatter(matrix.flat());
  const rows = matrix.map((row) => `[${row.map(format).join(", ")}]`);
  return `array([${rows.join(",\n       ")}])`;
}

// ---------- 3차원 회전(정사영) ----------

// 점을 세로축(yaw)과 가로축(pitch)으로 돌린 뒤 화면에 비춘다. 깊이(depth)는 앞뒤 그리기 순서에 쓴다.
export function rotate3D([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = x * cy - y * sy;
  const y1 = x * sy + y * cy;
  return { x: x1, y: -(z * cp - y1 * sp), depth: y1 * cp + z * sp };
}

export function prepareLesson(csvText) {
  const data = parseMallCSV(csvText);
  return { ...data, X2: toMatrix(data.rows, FEATURES_2D), X3: toMatrix(data.rows, FEATURES_3D) };
}
