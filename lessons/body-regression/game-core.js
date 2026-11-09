// 신체 치수 회귀 실습의 순수 계산 모듈(DOM 없음 → node --test로 검증).
// 원본 jeans.csv(963행 × 4열: neck, weight, heap, waist)를 그대로 읽는다. 중복 행도 지우지 않는다.
// 통계·상관계수·분할·최소제곱 회귀를 브라우저에서 직접 계산하고,
// 화면 출력은 pandas/numpy/파이썬의 기본 출력 형식을 흉내 내 보여 준다.

export const COLUMNS = ["neck", "weight", "heap", "waist"];
export const COLUMN_LABEL = { neck: "목둘레", weight: "몸무게", heap: "엉덩이둘레", waist: "허리둘레" };
export const COLUMN_UNIT = { neck: "cm", weight: "kg", heap: "cm", waist: "cm" };
export const SIMPLE_FEATURES = ["neck"];
export const MULTI_FEATURES = ["neck", "weight", "heap"];
export const TARGET = "waist";
export const TEST_SIZE = 0.3;

// ---------- CSV ----------

// 숫자 4열 CSV를 읽는다. 빈 칸이나 숫자가 아닌 값이 있으면 조용히 지우지 않고 오류로 알린다.
export function parseJeansCSV(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("CSV에 데이터 행이 없습니다.");
  const header = lines[0].split(",").map((name) => name.trim());
  const indexes = COLUMNS.map((name) => header.indexOf(name));
  if (indexes.some((index) => index < 0)) throw new Error("CSV 머리글에 neck, weight, heap, waist 열이 모두 있어야 합니다.");
  const rows = lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(",");
    const row = {};
    COLUMNS.forEach((name, i) => {
      const raw = (cells[indexes[i]] ?? "").trim();
      const value = raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(value)) throw new Error(`${rowIndex + 1}번째 데이터 행의 ${name} 값이 숫자가 아닙니다.`);
      row[name] = value;
    });
    return row;
  });
  return { columns: COLUMNS.slice(), rows };
}

export const column = (rows, name) => rows.map((row) => row[name]);

// ---------- 통계 ----------

export function mean(values) {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

// pandas와 같은 표본 표준편차(ddof=1).
export function std(values) {
  const m = mean(values);
  let ss = 0;
  for (const value of values) ss += (value - m) ** 2;
  return Math.sqrt(ss / (values.length - 1));
}

// numpy/pandas 기본값과 같은 선형 보간 분위수.
export function quantile(sortedValues, q) {
  const position = (sortedValues.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * fraction;
}

export const DESCRIBE_ROWS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];

export function describe(rows, columns = COLUMNS) {
  const result = {};
  for (const name of columns) {
    const values = column(rows, name);
    const sorted = values.slice().sort((a, b) => a - b);
    result[name] = {
      count: values.length,
      mean: mean(values),
      std: std(values),
      min: sorted[0],
      "25%": quantile(sorted, 0.25),
      "50%": quantile(sorted, 0.5),
      "75%": quantile(sorted, 0.75),
      max: sorted[sorted.length - 1],
    };
  }
  return result;
}

export function pearson(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function correlationMatrix(rows, columns = COLUMNS) {
  const matrix = {};
  for (const a of columns) {
    matrix[a] = {};
    for (const b of columns) matrix[a][b] = a === b ? 1 : pearson(column(rows, a), column(rows, b));
  }
  return matrix;
}

// ---------- 훈련/테스트 분할 ----------

// 작은 결정적 난수 생성기(mulberry32). 같은 seed면 같은 순서를 만든다.
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// scikit-learn train_test_split(test_size=0.3)와 같은 개수: 테스트 = ceil(n × 0.3), 훈련 = 나머지.
export function splitSizes(n, testSize = TEST_SIZE) {
  const test = Math.ceil(Number((n * testSize).toFixed(10)));
  return { train: n - test, test };
}

// 행 번호를 섞은 뒤 앞쪽을 테스트, 나머지를 훈련으로 쓴다(scikit-learn ShuffleSplit과 같은 방식).
export function shuffledSplit(n, seed, testSize = TEST_SIZE) {
  const random = createRandom(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const sizes = splitSizes(n, testSize);
  return { test: order.slice(0, sizes.test), train: order.slice(sizes.test) };
}

export function newSeed() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) return cryptoObject.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

// ---------- 선형 회귀(최소제곱) ----------

// 평균을 뺀(중심화한) 설계 행렬을 Householder QR로 풀어 계수를 구하고, 절편은 평균에서 되찾는다.
// 정규방정식을 직접 역행렬로 푸는 것보다 수치적으로 안정적이다.
export function fitLinearRegression(X, y) {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0 || y.length !== n) throw new Error("학습 데이터의 크기가 올바르지 않습니다.");
  if (n <= p) throw new Error("학습 데이터가 너무 적습니다.");
  const xMean = Array.from({ length: p }, (_, j) => mean(X.map((row) => row[j])));
  const yMean = mean(y);
  const A = X.map((row) => row.map((value, j) => value - xMean[j]));
  const b = y.map((value) => value - yMean);

  const RANK_ERROR = "입력 속성의 값이 모두 같거나 서로 완전히 겹쳐 계수를 구할 수 없습니다.";
  const columnScale = Array.from({ length: p }, (_, j) => Math.sqrt(A.reduce((sum, row) => sum + row[j] ** 2, 0)));
  const R = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let k = 0; k < p; k += 1) {
    let norm = 0;
    for (let i = k; i < n; i += 1) norm += A[i][k] ** 2;
    norm = Math.sqrt(norm);
    if (!(norm > 1e-10 * columnScale[k])) throw new Error(RANK_ERROR);
    const alpha = A[k][k] > 0 ? -norm : norm;
    const v = new Array(n).fill(0);
    v[k] = A[k][k] - alpha;
    for (let i = k + 1; i < n; i += 1) v[i] = A[i][k];
    let vNorm2 = 0;
    for (let i = k; i < n; i += 1) vNorm2 += v[i] ** 2;
    if (vNorm2 > 0) {
      for (let j = k; j < p; j += 1) {
        let dot = 0;
        for (let i = k; i < n; i += 1) dot += v[i] * A[i][j];
        const factor = (2 * dot) / vNorm2;
        for (let i = k; i < n; i += 1) A[i][j] -= factor * v[i];
      }
      let dot = 0;
      for (let i = k; i < n; i += 1) dot += v[i] * b[i];
      const factor = (2 * dot) / vNorm2;
      for (let i = k; i < n; i += 1) b[i] -= factor * v[i];
    }
    for (let j = k; j < p; j += 1) R[k][j] = A[k][j];
  }
  const coef = new Array(p).fill(0);
  for (let k = p - 1; k >= 0; k -= 1) {
    let sum = b[k];
    for (let j = k + 1; j < p; j += 1) sum -= R[k][j] * coef[j];
    coef[k] = sum / R[k][k];
  }
  const intercept = yMean - coef.reduce((sum, value, j) => sum + value * xMean[j], 0);
  return { coef, intercept };
}

export const predictOne = (model, features) => model.intercept + features.reduce((sum, value, j) => sum + model.coef[j] * value, 0);
export const predict = (model, X) => X.map((features) => predictOne(model, features));

// scikit-learn의 score(=r2_score)와 같은 결정 계수.
export function r2Score(yTrue, yPred) {
  const m = mean(yTrue);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    ssRes += (yTrue[i] - yPred[i]) ** 2;
    ssTot += (yTrue[i] - m) ** 2;
  }
  return 1 - ssRes / ssTot;
}

// 행 번호 목록으로 X(2차원)와 y(1차원)를 만든다.
export function takeXY(rows, indexes, features, target = TARGET) {
  return {
    X: indexes.map((i) => features.map((name) => rows[i][name])),
    y: indexes.map((i) => rows[i][target]),
  };
}

// 같은 분할(split)로 모델을 학습하고 테스트 데이터로 평가한다.
export function trainAndScore(rows, split, features, target = TARGET) {
  const train = takeXY(rows, split.train, features, target);
  const test = takeXY(rows, split.test, features, target);
  const model = fitLinearRegression(train.X, train.y);
  const pred = predict(model, test.X);
  return { model, train, test, pred, r2: r2Score(test.y, pred) };
}

// ---------- 화면 출력 형식(파이썬·numpy·pandas 흉내) ----------

// 파이썬 float의 repr: 가장 짧은 왕복 표기, 정수면 ".0", 1e16 이상·1e-4 미만은 지수 표기.
export function pyFloat(value) {
  if (Number.isNaN(value)) return "nan";
  if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";
  const [mantissa, expText] = value.toExponential().split("e");
  const exponent = Number(expText);
  if (exponent < -4 || exponent >= 16) {
    const sign = exponent < 0 ? "-" : "+";
    return `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, "0")}`;
  }
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

// numpy 배열 원소 하나(정밀도 8자리, 불필요한 0은 생략, 정수면 "33.").
function numpyElementParts(value) {
  let text = String(value);
  if (/e/.test(text) || (text.split(".")[1] ?? "").length > 8) text = value.toFixed(8);
  if (text.includes(".")) text = text.replace(/0+$/, "");
  else text = `${text}.`;
  const [intPart, fracPart] = text.split(".");
  return { intPart, fracPart };
}

export function numpyFormatter(values) {
  const parts = values.map(numpyElementParts);
  const left = Math.max(...parts.map((part) => part.intPart.length));
  const right = Math.max(...parts.map((part) => part.fracPart.length));
  return (value) => {
    const part = numpyElementParts(value);
    return `${part.intPart.padStart(left)}.${part.fracPart.padEnd(right)}`;
  };
}

function wrapWords(words, separator, firstPrefix, nextPrefix, lineWidth) {
  const elemWidth = lineWidth - 1;
  const lines = [];
  let line = nextPrefix;
  words.forEach((word, index) => {
    const isLast = index === words.length - 1;
    const width = isLast ? lineWidth : elemWidth;
    if (line.length + word.length > width && line.length > nextPrefix.length) {
      lines.push(line.replace(/\s+$/, ""));
      line = nextPrefix;
    }
    line += word;
    if (!isLast) line += separator;
  });
  lines.push(line);
  lines[0] = firstPrefix + lines[0].slice(nextPrefix.length);
  return lines.join("\n");
}

// print(배열) 형식: [82.20593418 71.1309861  85.89758354]
export function numpyStr1d(values) {
  const format = numpyFormatter(values);
  return `${wrapWords(values.map(format), " ", "[", " ", 75)}]`;
}

// repr(배열) 형식: array([ 62.9,  63. , ...]) — 75자 너비에서 줄바꿈.
export function numpyRepr1d(values) {
  const format = numpyFormatter(values);
  return `${wrapWords(values.map(format), ", ", "array([", " ".repeat(7), 74)}])`;
}

// repr(n×1 배열) 형식: array([[33.8],\n       [33. ], ...])
export function numpyReprColumn(values) {
  const format = numpyFormatter(values);
  const lines = values.map((value, index) => `${index === 0 ? "array([" : "       "}[${format(value)}]`);
  return `${lines.join(",\n")}])`;
}

// IPython이 (X, y) 튜플을 보여 주는 형식.
export function ipythonTuple(reprs) {
  const indent = (text) => text.split("\n").join("\n ");
  return `(${reprs.map(indent).join(",\n ")})`;
}

// pandas 표의 열 하나를 같은 소수 자릿수로 맞춘다(최소 1자리, 최대 6자리).
export function pandasColumnFormatter(values, maxDigits = 6) {
  let digits = 1;
  for (const value of values) {
    const text = Number(value.toFixed(maxDigits)).toString();
    const fraction = text.includes(".") ? text.split(".")[1].length : 0;
    digits = Math.max(digits, fraction);
  }
  return (value) => value.toFixed(digits);
}

export const pandasFloat6 = (value) => value.toFixed(6);

// ---------- 새 입력값 ----------

export const NECK_RANGE = Object.freeze({ min: 25, max: 55 });

export function parseNeck(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return { ok: false, message: "목둘레를 숫자로 입력하세요." };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, message: "목둘레를 숫자로 입력하세요." };
  if (value < NECK_RANGE.min || value > NECK_RANGE.max) {
    return { ok: false, message: `${NECK_RANGE.min}~${NECK_RANGE.max} cm 사이 값을 입력하세요.` };
  }
  return { ok: true, value };
}

export function prepareLesson(csvText) {
  const data = parseJeansCSV(csvText);
  return { ...data, summary: describe(data.rows), corr: correlationMatrix(data.rows) };
}
