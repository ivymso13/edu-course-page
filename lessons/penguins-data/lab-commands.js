export const NUMERIC_COLUMNS = [
  "culmen_length_mm",
  "culmen_depth_mm",
  "flipper_length_mm",
  "body_mass_g",
];
const list = (values) =>
  `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
const featuresLine = `cols = ${list(NUMERIC_COLUMNS)}`;
export function previewCommand(ids) {
  if (!ids.length) return "df.iloc[[]]";
  if (ids.length === 344) return "df";
  if (ids.every((id, index) => id === index + 1))
    return `df.head(${ids.length})`;
  return `df.iloc[${list(ids.map((id) => id - 1))}]`;
}
export function cleaningCommand(stage) {
  const commands = ["df = original_df.copy()"];
  if (stage >= 1) commands.push("df = df.dropna()");
  if (stage >= 2) commands.push('df = df[df["sex"] != "."]');
  return [...commands, "df.shape"].join("\n");
}
export function normalizeCommand(enabled) {
  return enabled
    ? `${featuresLine}\nscaler = MinMaxScaler()\nscaled_df = df.copy()\nscaled_df[cols] = scaler.fit_transform(df[cols])\nscaled_df[cols].head(10)`
    : `${featuresLine}\ndf[cols].head(10)`;
}
export function boxCommand(feature) {
  return `sns.boxplot(data=complete_df, x=${JSON.stringify(feature)}, whis=1.5)\nplt.show()`;
}
export function scatterCommand({ x, y, normalized, colored, regression }) {
  const code = ["plot_df = df.copy()"];
  if (normalized)
    code.push(
      featuresLine,
      "plot_df[cols] = MinMaxScaler().fit_transform(df[cols])",
    );
  code.push(
    `sns.scatterplot(data=plot_df, x=${JSON.stringify(x)}, y=${JSON.stringify(y)},\n                ${colored ? 'hue="species", style="species"' : 'color="#64748b"'})`,
  );
  if (regression)
    code.push(
      `sns.regplot(data=plot_df, x=${JSON.stringify(x)}, y=${JSON.stringify(y)},\n            scatter=False, ci=None, color="black")`,
    );
  code.push("plt.show()");
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
  const code = [
    `X = df[${list(features)}]`,
    'y = df["species"]',
    "X_train, X_test, y_train, y_test = train_test_split(",
    `    X, y, test_size=${testRatio}, random_state=${seed}, stratify=y`,
    ")",
  ];
  if (normalize)
    code.push(
      "scaler = MinMaxScaler()",
      "X_train = pd.DataFrame(scaler.fit_transform(X_train),\n                       columns=X.columns, index=X_train.index)",
      "X_test = pd.DataFrame(scaler.transform(X_test),\n                      columns=X.columns, index=X_test.index)",
    );
  code.push(
    `dt = DecisionTreeClassifier(criterion="gini", max_depth=${maxDepth},\n                            random_state=${seed})`,
    "dt.fit(X_train, y_train)",
  );
  return code.join("\n");
}
export function predictionCommand(rowId, normalize) {
  const code = [`sample = df.loc[[${rowId - 1}], X.columns]`];
  if (normalize)
    code.push(
      "sample = pd.DataFrame(scaler.transform(sample),\n                      columns=X.columns, index=sample.index)",
    );
  code.push("dt.predict(sample)");
  return code.join("\n");
}
