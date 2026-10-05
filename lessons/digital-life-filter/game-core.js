// Same five-row example as the supplied student notebook's Boolean indexing cell.
export const FRUIT_ROWS = [
  { ID: 0, 과일: "사과", 가격: 1000, 수량: 10 },
  { ID: 1, 과일: "바나나", 가격: 800, 수량: 15 },
  { ID: 2, 과일: "사과", 가격: 1200, 수량: 5 },
  { ID: 3, 과일: "딸기", 가격: 2500, 수량: 20 },
  { ID: 4, 과일: "바나나", 가격: 900, 수량: 12 },
];
export const FRUIT_TASKS = [
  { key: "a", label: "과일이 사과인 행", test: row => row.과일 === "사과" },
  { key: "c", label: "가격이 1000원 이상인 행", test: row => row.가격 >= 1000 },
  { key: "b", label: "과일이 바나나이고 수량이 15개 이상인 행", test: row => row.과일 === "바나나" && row.수량 >= 15 },
];

const operators = {
  "==": (a,b) => a === b, "!=": (a,b) => a !== b,
  ">=": (a,b) => a >= b, ">": (a,b) => a > b,
  "<=": (a,b) => a <= b, "<": (a,b) => a < b,
};
export function runConditions(conditions, join = "") {
  if (!conditions.length || conditions.length > 2) throw new Error("조건을 만들어 주세요.");
  if (conditions.length === 2 && !["&", "|"].includes(join)) throw new Error("두 조건을 연결하는 연산자를 선택하세요.");
  const tests = conditions.map(({column, operator, value}) => {
    if (!["과일", "가격", "수량"].includes(column) || !operators[operator] || !String(value).trim()) throw new Error("열 이름과 비교 연산자를 선택하고 비교 값을 입력하세요.");
    if (column === "과일" && !["==", "!="].includes(operator)) throw new Error("과일 이름은 같다(==) 또는 다르다(!=)로 비교하세요.");
    const typed = column === "과일" ? String(value).trim() : Number(value);
    if (typeof typed === "number" && !Number.isFinite(typed)) throw new Error("가격과 수량의 비교 값은 숫자로 입력하세요.");
    return row => operators[operator](row[column], typed);
  });
  return FRUIT_ROWS.filter(row => join === "|" ? tests.some(test => test(row)) : tests.every(test => test(row)));
}
export function isCorrectCondition(key, conditions, join = "") {
  const expected = {a:[["과일","==","사과"]],c:[["가격",">=","1000"]],b:[["과일","==","바나나"],["수량",">=","15"]]}[key];
  return Boolean(expected && expected.length === conditions.length && (conditions.length === 1 || join === "&") && expected.every(([column,operator,value]) => conditions.some(c => c.column === column && c.operator === operator && (column === "과일" ? String(c.value).trim() === value : Number(c.value) === Number(value)))));
}

export function selectColumn(name) {
  const column = String(name).trim();
  if (!column) throw new Error("큰따옴표 안에 들어갈 속성 이름을 입력하세요.");
  if (!["과일", "가격", "수량"].includes(column)) throw new Error("표의 속성 이름을 그대로 입력하세요. 속성 이름만 입력하며 따옴표와 df는 쓰지 않습니다.");
  return FRUIT_ROWS.map(row => row[column]);
}
