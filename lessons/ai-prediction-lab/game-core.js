// 인공지능 예측 체험 활동: 최소제곱 회귀로 실제 예측값을 계산하는 순수 로직 모듈(DOM 의존 없음).

// 단순선형회귀(속성 1개): {x,y}[] -> {slope, intercept}
export function simpleLinearRegression(points) {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const { x, y } of points) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

// 절편을 포함한 다중선형회귀 계수를 최소제곱(정규방정식 + 가우스 소거)으로 구한다.
// rows[i]는 i번째 데이터의 특성값 배열, ys[i]는 그에 대응하는 목표값이다.
// 반환값의 첫 원소가 절편, 이후가 각 특성의 계수다.
export function multipleLinearRegression(rows, ys) {
  const n = rows.length;
  const k = rows[0].length + 1;
  const design = rows.map((row) => [1, ...row]);
  const normal = Array.from({ length: k }, () => Array(k).fill(0));
  const target = Array(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let r = 0; r < k; r += 1) {
      for (let c = 0; c < k; c += 1) normal[r][c] += design[i][r] * design[i][c];
      target[r] += design[i][r] * ys[i];
    }
  }
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) {
      if (Math.abs(normal[r][col]) > Math.abs(normal[pivot][col])) pivot = r;
    }
    [normal[col], normal[pivot]] = [normal[pivot], normal[col]];
    [target[col], target[pivot]] = [target[pivot], target[col]];
    for (let r = 0; r < k; r += 1) {
      if (r === col) continue;
      const factor = normal[r][col] / normal[col][col];
      for (let c = 0; c < k; c += 1) normal[r][c] -= factor * normal[col][c];
      target[r] -= factor * target[col];
    }
  }
  return Array.from({ length: k }, (_, i) => target[i] / normal[i][i]);
}

// --- 활동 1: 공부 시간 -> 시험 점수 (속성 1개) --------------------------------
export const STUDY_DATA = [
  { hours: 1, score: 52 },
  { hours: 2, score: 58 },
  { hours: 3, score: 65 },
  { hours: 4, score: 72 },
  { hours: 5, score: 78 },
];

// 추세선 계수 자체도 내보내, 화면에서는 (반올림하지 않은) 정확한 직선을 그릴 수 있게 한다.
export const STUDY_TREND_LINE = simpleLinearRegression(STUDY_DATA.map((d) => ({ x: d.hours, y: d.score })));

export function predictStudyScore(hours) {
  return Math.floor(STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * hours);
}

export const STUDY_QUESTION_HOURS = 6;

// --- 활동 2: 기온·강수량 -> 놀이공원 방문객 수 (속성 2개) ----------------------
export const PARK_DATA = [
  { temp: 15, rain: 0, visitors: 1200 },
  { temp: 20, rain: 0, visitors: 1700 },
  { temp: 25, rain: 0, visitors: 2300 },
  { temp: 25, rain: 10, visitors: 1800 },
  { temp: 25, rain: 30, visitors: 1200 },
];

const parkFit = multipleLinearRegression(
  PARK_DATA.map((d) => [d.temp, d.rain]),
  PARK_DATA.map((d) => d.visitors),
);

export function predictVisitors(temp, rain) {
  const [intercept, tempCoef, rainCoef] = parkFit;
  return Math.floor(intercept + tempCoef * temp + rainCoef * rain);
}

export const PARK_QUESTION_CONDITION = { temp: 28, rain: 5 };

// --- 활동 3: 기온·비·주말·화분 개수·이름 글자 수 -> 아이스크림 판매량 -----------
// (속성 5개, 그중 화분 개수·이름 글자 수 2개는 판매량과 관계없는 정보)
export const ICE_CREAM_DATA = [
  { temp: 20, rain: false, weekend: false, pots: 3, nameLength: 3, sales: 102 },
  { temp: 25, rain: false, weekend: false, pots: 5, nameLength: 2, sales: 128 },
  { temp: 30, rain: false, weekend: false, pots: 2, nameLength: 4, sales: 158 },
  { temp: 30, rain: true, weekend: false, pots: 4, nameLength: 3, sales: 121 },
  { temp: 30, rain: false, weekend: true, pots: 6, nameLength: 2, sales: 176 },
];

// 화분 개수·이름 글자 수는 판매량과 관계없는 정보라, 모델은 이 둘을 아예 입력으로
// 받지 않는다(계수를 0으로 흉내 내는 게 아니라 애초에 회귀에 포함시키지 않는다).
// 데이터 5개로 기온·비·주말 3특성(+절편)만 최소제곱 회귀로 맞춘다.
const iceCreamFit = multipleLinearRegression(
  ICE_CREAM_DATA.map((d) => [d.temp, d.rain ? 1 : 0, d.weekend ? 1 : 0]),
  ICE_CREAM_DATA.map((d) => d.sales),
);

export function predictIceCreamSales(temp, hasRain, isWeekend) {
  const [intercept, tempCoef, rainCoef, weekendCoef] = iceCreamFit;
  return Math.floor(
    intercept + tempCoef * temp + rainCoef * (hasRain ? 1 : 0) + weekendCoef * (isWeekend ? 1 : 0),
  );
}

export const ICE_CREAM_NEW_CONDITION = { temp: 28, rain: false, weekend: true, pots: 1, nameLength: 5 };
// 실제 판매량은 모델이 계산하는 값이 아니라 그날 실제로 관측된 값이다(모델과는 별개).
// 예측(위 함수로 계산)과 조금 다르게 두어, "AI의 예측은 정답이 아니라 추정값"이라는
// 점을 학생이 직접 오차로 확인하게 한다.
export const ICE_CREAM_ACTUAL_SALES = 169;
