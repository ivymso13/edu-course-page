// Display the original student notebook's operations, not the web UI helpers.
export const NUMERIC_COLUMNS = [
  "culmen_length_mm",
  "culmen_depth_mm",
  "flipper_length_mm",
  "body_mass_g",
];
const list = (values) =>
  `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
const load = 'df = pd.read_csv("penguins_size.csv")';
const clean = [load, "df = df.dropna()", 'df = df[df["sex"] != "."]'];
const normalization = [
  `col = ${list(NUMERIC_COLUMNS)}`,
  "scaler = MinMaxScaler()",
  "df[col] = scaler.fit_transform(df[col])",
];
export function previewCommand() {
  return "df";
}
export function cleaningCommand(stage) {
  const code = [load];
  if (stage >= 1) code.push("df = df.dropna()");
  if (stage >= 2) code.push('df = df[df["sex"] != "."]', 'df["sex"].unique()');
  code.push(stage ? "df.shape" : "df");
  return code.join("\n");
}
export function normalizeCommand(enabled) {
  return enabled
    ? [...clean, ...normalization, "df.head(10)"].join("\n")
    : "df.head(10)";
}
export function boxCommand(feature) {
  return [
    load,
    "df = df.dropna()",
    `sns.boxplot(data=df, x=${JSON.stringify(feature)})`,
  ].join("\n");
}
export function scatterCommand({ x, y, normalized, colored, regression }) {
  const code = [...clean];
  if (normalized) code.push(...normalization);
  code.push(
    `sns.scatterplot(data=df, x=${JSON.stringify(x)}, y=${JSON.stringify(y)}${colored ? ', hue="species"' : ""})`,
  );
  if (regression)
    code.push(
      `sns.regplot(data=df, x=${JSON.stringify(x)}, y=${JSON.stringify(y)},\n            scatter=False, ci=None)`,
    );
  return code.join("\n");
}
export function modelCommand({
  features,
  testRatio,
  seed,
  maxDepth,
  normalize,
}) {
  if (!features.length) return "# 입력 속성을 한 개 이상 선택하세요.";
  const code = [...clean];
  if (normalize) code.push(...normalization);
  code.push(
    `X = df[${list(features)}]`,
    'y = df["species"]',
    "X_train, X_test, y_train, y_test = train_test_split(",
    `    X, y, test_size=${testRatio}, random_state=${seed}, stratify=y`,
    ")",
    `dt = DecisionTreeClassifier(max_depth=${maxDepth}, random_state=${seed})`,
    "dt.fit(X_train, y_train)",
  );
  return code.join("\n");
}
