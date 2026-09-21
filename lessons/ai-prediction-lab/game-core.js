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
// 최소제곱 회귀식(y = 7x + 45)이 소수 없는 정수로 딱 떨어지도록 고른 값. 같은 시간을
// 공부해도 학생마다 점수가 다를 수 있음을 보여주려고 각 시간대마다 두 명씩(총 10명) 두되,
// 추세선을 기준으로 한 편차를 시간대마다 부호·크기가 제각각이도록(대칭으로 짝짓지 않고)
// 흩어 놓았다. 편차들의 합과 (시간-평균)·편차 가중합이 둘 다 0이 되도록만 맞추면 되므로,
// 이렇게 불규칙하게 흩어도 최소제곱 결과는 그대로 y = 7x + 45가 된다(node로 직접 계산해 확인).
export const STUDY_DATA = [
  { hours: 1, score: 50 },
  { hours: 1, score: 53 },
  { hours: 2, score: 53 },
  { hours: 2, score: 64 },
  { hours: 3, score: 67 },
  { hours: 3, score: 69 },
  { hours: 4, score: 68 },
  { hours: 4, score: 77 },
  { hours: 5, score: 77 },
  { hours: 5, score: 82 },
];

// 추세선 계수 자체도 내보내, 화면에서는 (반올림하지 않은) 정확한 직선을 그릴 수 있게 한다.
export const STUDY_TREND_LINE = simpleLinearRegression(STUDY_DATA.map((d) => ({ x: d.hours, y: d.score })));

export function predictStudyScore(hours) {
  return Math.floor(STUDY_TREND_LINE.intercept + STUDY_TREND_LINE.slope * hours);
}

export const STUDY_QUESTION_HOURS = 6;

// --- 활동 2: 기온·날씨 -> 놀이공원 방문객 수 (속성 2개) ----------------------
export const PARK_DATA = [
  { temp: 20, rain: 0, weather: "맑음", visitors: 2000 },
  { temp: 22, rain: 0, weather: "맑음", visitors: 2200 },
  { temp: 24, rain: 0, weather: "맑음", visitors: 2400 },
  { temp: 21, rain: 1, weather: "비", visitors: 1600 },
  { temp: 23, rain: 1, weather: "비", visitors: 1800 },
];

const parkFit = multipleLinearRegression(
  PARK_DATA.map((d) => [d.temp, d.rain]),
  PARK_DATA.map((d) => d.visitors),
);

export function predictVisitors(temp, rain) {
  const [intercept, tempCoef, rainCoef] = parkFit;
  let rainVal = 0;
  if (typeof rain === "boolean") {
    rainVal = rain ? 1 : 0;
  } else if (typeof rain === "string") {
    rainVal = rain === "비" || rain === "rain" ? 1 : 0;
  } else if (typeof rain === "number") {
    rainVal = rain;
  }
  return Math.round(intercept + tempCoef * temp + rainCoef * rainVal);
}

export const PARK_QUESTION_CONDITION = { temp: 26, rain: 1, weather: "비" };

// --- 활동 3: 기온·유동인구·사장님 기분·지나가는 고양이 수 -> 매장이 붐빌지 분류 -----------
// (속성 4개, 그중 사장님 기분·지나가는 고양이 수 2개는 분류와 관계없는 정보 — 특히
// 고양이 수는 누가 봐도 매장 혼잡도와 관계가 없을 만한 자연스러운 일지 항목으로 골랐다.
// 기분은 범주형, 고양이 수는 숫자형이라 서로 다른 형태의 "무관한 정보"를 함께 보여준다).
// 기온·유동인구 둘 다 수치형(연속값)이라, 산점도의 x·y축에 그대로 놓고 눈으로 바로
// 군집을 확인할 수 있다(활동 1의 산점도와 같은 원리를 분류에도 그대로 적용). 10개 데이터로
// 늘려 군집이 더 또렷하게 보이도록 했다.
export const ICE_CREAM_DATA = [
  { temp: 18, traffic: 65, mood: "나쁨", cats: 2, label: "한산" },
  { temp: 20, traffic: 90, mood: "좋음", cats: 5, label: "한산" },
  { temp: 22, traffic: 110, mood: "나쁨", cats: 1, label: "한산" },
  { temp: 24, traffic: 95, mood: "좋음", cats: 3, label: "한산" },
  { temp: 26, traffic: 120, mood: "나쁨", cats: 6, label: "한산" },
  { temp: 27, traffic: 180, mood: "좋음", cats: 4, label: "붐빔" },
  { temp: 29, traffic: 200, mood: "나쁨", cats: 0, label: "붐빔" },
  { temp: 31, traffic: 175, mood: "좋음", cats: 7, label: "붐빔" },
  { temp: 33, traffic: 220, mood: "좋음", cats: 2, label: "붐빔" },
  { temp: 30, traffic: 240, mood: "나쁨", cats: 5, label: "붐빔" },
];
export const ICE_CREAM_LABELS = ICE_CREAM_DATA.map((d) => d.label);

// k-최근접 이웃(k-NN) 분류: 훈련 데이터를 각 특성 차원별로 z-score 정규화한 뒤
// (서로 다른 단위·범위를 가진 기온·유동인구의 스케일을 맞추기 위함) 정규화된 유클리드
// 거리가 가장 가까운 k개를 찾아 다수결로 라벨을 정한다. 회귀와는 원리가 전혀 다른 알고리즘이다.
export function classifyByKNN(trainRows, trainLabels, query, k) {
  const dims = trainRows[0].length;
  const stats = Array.from({ length: dims }, (_, i) => {
    const values = trainRows.map((row) => row[i]);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) || 1 };
  });
  const normalize = (row) => row.map((v, i) => (v - stats[i].mean) / stats[i].std);
  const normQuery = normalize(query);

  const distances = trainRows.map((row, index) => {
    const normRow = normalize(row);
    const distance = Math.sqrt(normRow.reduce((sum, v, i) => sum + (v - normQuery[i]) ** 2, 0));
    return { index, label: trainLabels[index], distance };
  });
  distances.sort((a, b) => a.distance - b.distance);

  const neighbors = distances.slice(0, k);
  const votes = {};
  for (const neighbor of neighbors) {
    votes[neighbor.label] = (votes[neighbor.label] ?? 0) + 1;
  }
  const predictedLabel = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  return { predictedLabel, neighbors };
}

const ICE_CREAM_FEATURE_ROWS = ICE_CREAM_DATA.map((d) => [d.temp, d.traffic]);
const ICE_CREAM_K = 5;

// 사장님 기분·지나가는 고양이 수는 분류와 관계없는 정보라, 이 함수는 애초에 그 둘을
// 입력으로 받지 않는다(거리 계산에서 흉내만 배제하는 게 아니라 함수 시그니처 자체로 보장한다).
export function classifyIceCreamCrowd(temp, traffic) {
  return classifyByKNN(ICE_CREAM_FEATURE_ROWS, ICE_CREAM_LABELS, [temp, traffic], ICE_CREAM_K);
}

export const ICE_CREAM_NEW_CONDITION = { temp: 28, traffic: 150, mood: "좋음", cats: 3 };
// 실제 결과는 모델이 계산하는 값이 아니라 그날 실제로 관측된 값이다(모델과는 별개).
// 이 조건은 가장 가까운 이웃 5개 중 3:2로 근소하게 "붐빔"이 이긴 애매한 경계 사례라,
// 실제로는 "한산"이었던 걸로 두어 "AI의 예측은 정답이 아니라 가장 가까운 사례를 참고한
// 추정"이라는 점과 "경계에 가까운 사례는 틀리기 쉽다"는 점을 함께 보여준다.
export const ICE_CREAM_ACTUAL_CROWD = "한산";

// --- 활동 4: 12개 도시의 연평균 기온·강수량 -> 군집(clustering, 비지도학습) -----------------
// 활동 1~3과 달리 정답 라벨이 전혀 없다. 기후대라는 답을 알려주지 않고, 학생이 먼저
// 기온·강수량이라는 수치만 보고 비슷한 도시끼리 직접 묶어본 뒤, AI(k-평균)가 같은 데이터를
// 어떻게 묶는지와 비교한다. 그룹의 개수도, 각 그룹이 무엇을 의미하는지도 사람이 해석해야
// 한다는 점이 분류(활동3)와의 핵심 차이다.
// (이전 버전은 "12개월의 기후"를 소재로 썼으나, 한 지점의 월별 기후는 원래 매끄럽게 이어지는
// 곡선이라 뚜렷이 갈라진 4덩어리를 만들려면 값을 부자연스럽게 왜곡해야 했다(예: 11월이
// 9·10월보다 더 따뜻해지는 등 실제로는 있을 수 없는 역전이 생김). 그래서 "서로 다른
// 기후대의 여러 도시"로 소재를 바꿨다 — 도시마다 원래 기후가 다르므로 실제와 가까운
// 근사값을 그대로 써도 자연스럽게 4개 그룹(열대·온대·건조·냉대)이 나온다.
//
// 다만 각 기후대에 "전형적인" 도시만 두면 네 덩어리가 너무 깔끔하게 갈려서, 학생이 만드는
// 묶음이 AI와 달라질 여지가 거의 없었다. 그래서 각 기후대에 경계에 걸친 도시를 하나씩
// 섞었다(홍콩·베이징·LA·울란바토르) — 실제로 존재하는, 인접한 기후대 사이 어딘가에 있는
// 도시들이다. 강수량(mm, 25~2400)이 기온(℃, 3~28)보다 훨씬 큰 척도라, 산점도를 그냥
// 눈으로 보면 강수량 차이가 시각적으로 훨씬 크게 다가온다 — 그래서 학생이 "눈으로 보기에
// 가까운 것"끼리 직관적으로 묶으면(예: 강수량이 비슷한 도쿄·서울을 강수량이 비슷한 열대
// 도시들과 한 묶음으로) k-평균이 기온·강수량을 정규화해 똑같이 반영한 결과와 실제로 달라질
// 수 있다 — 직접 계산으로 확인함(정규화 X: 도쿄·서울이 열대 그룹에 합쳐짐 / 정규화 O: 원래
// 기후대별로 갈림). 이 자체가 "AI와 사람의 판단 기준이 다를 수 있다"는 좋은 예시가 된다.
// 실제 도시 이름은 학생에게 보여주지 않는다(화면에는 익명 라벨 A~L로만 표시) — 아래
// 주석은 각 수치의 출처(근사 실제 기후)를 밝혀 두기 위한 것일 뿐이다.
export const CITY_CLIMATE = [
  { temp: 27.0, precip: 2100 }, // 열대: 싱가포르
  { temp: 27.0, precip: 1800 }, // 열대: 자카르타
  { temp: 23.5, precip: 2400 }, // 열대~온대 경계(고온다습): 홍콩
  { temp: 15.8, precip: 1520 }, // 온대(계절풍): 도쿄
  { temp: 12.5, precip: 1400 }, // 온대(계절풍): 서울
  { temp: 12.9, precip: 570 }, // 온대~건조 경계(온대지만 강수량은 적음): 베이징
  { temp: 21.8, precip: 25 }, // 건조: 카이로
  { temp: 28.0, precip: 100 }, // 건조: 두바이
  { temp: 18.2, precip: 380 }, // 건조~온대 경계(지중해성, 온화하지만 건조): 로스앤젤레스
  { temp: 5.8, precip: 700 }, // 냉대: 모스크바
  { temp: 6.3, precip: 800 }, // 냉대: 오슬로
  { temp: 2.9, precip: 220 }, // 냉대~건조 경계(춥고 건조): 울란바토르
];

// k-평균(k-means, Lloyd's 알고리즘): 무작위 초기화(Math.random) 없이 x 기준 정렬 후
// 균등 간격 인덱스로 초기 중심을 결정론적으로 고른다 — 같은 입력이면 항상 같은 결과가
// 나와야 테스트로 검증할 수 있고, 학생이 새로고침해도 결과가 바뀌지 않는다.
export function kMeans(points, k, maxIterations = 50) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const step = sorted.length / k;
  let centroids = Array.from({ length: k }, (_, i) => sorted[Math.floor(i * step + step / 2)]);
  let assignments = new Array(points.length).fill(-1);

  for (let iter = 0; iter < maxIterations; iter += 1) {
    const newAssignments = points.map((p) => {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, ci) => {
        const dist = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = ci;
        }
      });
      return best;
    });

    const unchanged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;
    if (unchanged) break;

    centroids = centroids.map((old, ci) => {
      const members = points.filter((_, i) => assignments[i] === ci);
      if (members.length === 0) return old; // 빈 군집은 이전 중심을 유지한다
      return {
        x: members.reduce((sum, p) => sum + p.x, 0) / members.length,
        y: members.reduce((sum, p) => sum + p.y, 0) / members.length,
      };
    });
  }

  return { assignments, centroids };
}

export const CITY_CLUSTER_K = 4;

// 기온(℃)과 강수량(mm)은 단위·범위가 전혀 달라(기온 5.8~28, 강수량 25~2100), 정규화 없이
// 유클리드 거리를 쓰면 강수량이 거리 계산을 거의 전부 좌우하게 된다. 각 축을 z-score로
// 정규화한 뒤 k-평균을 돌려 두 특성이 고르게 반영되도록 한다.
function zScoreNormalize(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const stat = (values) => {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) || 1 };
  };
  const sx = stat(xs);
  const sy = stat(ys);
  return points.map((p) => ({ x: (p.x - sx.mean) / sx.std, y: (p.y - sy.mean) / sy.std }));
}

// 12개 도시를 K=4로 군집한다. 반환값은 CITY_CLIMATE와 같은 순서의 그룹 번호(0~3) 배열이다.
export function clusterCities() {
  const points = CITY_CLIMATE.map((d) => ({ x: d.temp, y: d.precip }));
  const { assignments } = kMeans(zScoreNormalize(points), CITY_CLUSTER_K);
  return assignments;
}

// 학생이 만든 묶음(bundles, 순서·이름에 의미 없음)과 AI의 군집 번호 배열을 "묶음 번호가
// 같은지"가 아니라 "어떤 데이터끼리 함께 묶였는지"로 비교한다. 각 묶음을, 그 멤버가 AI
// 군집 중 가장 많이 겹치는 곳에 다수결로 대응시킨 뒤, 그 대응과 실제로 다른 AI 군집에 속한
// 멤버만 "다르게 묶인 데이터"로 돌려준다 — 묶음 번호(이름)를 그대로 비교하면 학생이 붙인
// 이름과 AI가 매긴 번호가 우연히 달라도 전부 "틀림"으로 보이는 문제를 피하기 위함이다.
export function alignBundlesToClusters(bundles, aiAssignments) {
  const mismatched = [];
  for (const bundle of bundles) {
    if (bundle.members.length === 0) continue;
    const votes = {};
    for (const index of bundle.members) {
      const cluster = aiAssignments[index];
      votes[cluster] = (votes[cluster] ?? 0) + 1;
    }
    const expectedCluster = Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);
    for (const index of bundle.members) {
      if (aiAssignments[index] !== expectedCluster) mismatched.push(index);
    }
  }
  return mismatched.sort((a, b) => a - b);
}
