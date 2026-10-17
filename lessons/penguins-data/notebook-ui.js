// Notebook presentation only: Python examples remain read-only; results are
// calculated by the existing browser activities, not an embedded Python runtime.
const tokenPattern =
  /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:from|import|as|if|else|for|in|True|False|None|return|def|lambda)\b|\b\d+(?:\.\d+)?\b/g;
function appendTokens(line, source) {
  let position = 0;
  for (const match of source.matchAll(tokenPattern)) {
    line.append(document.createTextNode(source.slice(position, match.index)));
    const token = document.createElement("span");
    token.className = match[0].startsWith("#")
      ? "py-comment"
      : /^["']/.test(match[0])
        ? "py-string"
        : /^\d/.test(match[0])
          ? "py-number"
          : "py-keyword";
    token.textContent = match[0];
    line.append(token);
    position = match.index + match[0].length;
  }
  line.append(document.createTextNode(source.slice(position)));
}
export function displayPython(code, source) {
  code.dataset.source = source;
  if (!code.dataset.notebook) {
    code.textContent = source;
    return;
  }
  code.replaceChildren();
  source.split("\n").forEach((text, index, lines) => {
    const line = document.createElement("span");
    line.className = "code-line";
    line.dataset.line = index + 1;
    appendTokens(line, text || " ");
    code.append(line);
    if (index < lines.length - 1) code.append(document.createTextNode("\n"));
  });
  const cell = code.closest(".notebook-cell");
  if (cell?.classList.contains("output-collapsed")) {
    cell.classList.remove("output-collapsed");
    cell.querySelector(".cell-output").hidden = false;
    cell.querySelector(".cell-toggle").setAttribute("aria-expanded", "true");
    cell.querySelector(".cell-toggle").setAttribute("aria-label", "출력 접기");
  }
}
export function initNotebookCells() {
  document.querySelectorAll(".command-block").forEach((input, index) => {
    const code = input.querySelector("code");
    const source = code.dataset.source ?? code.textContent;
    const cell = document.createElement("div");
    cell.className = "notebook-cell";
    const output = document.createElement("div");
    output.className = "cell-output";
    output.id = `cell-output-${index + 1}`;
    const outputBody = document.createElement("div");
    outputBody.className = "cell-output-body";
    // Keep existing DOM elements and handlers intact as the input/output are grouped.
    let next = input.nextElementSibling;
    while (
      next &&
      !next.matches(".command-block, section, h1, h2, h3, .lab-panel")
    ) {
      const following = next.nextElementSibling;
      outputBody.append(next);
      next = following;
    }
    input.before(cell);
    const gutter = document.createElement("div");
    gutter.className = "cell-gutter";
    const number = document.createElement("span");
    number.className = "cell-number";
    number.textContent = `[${index + 1}]`;
    number.title = `셀 번호 ${index + 1}`;
    if (outputBody.childElementCount) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "cell-toggle";
      toggle.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor"/></svg>';
      toggle.setAttribute("aria-label", "출력 접기");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-controls", output.id);
      toggle.title = "웹에서 계산한 출력 접기 / 펼치기";
      toggle.addEventListener("click", () => {
        const collapsed = cell.classList.toggle("output-collapsed");
        output.hidden = collapsed;
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute(
          "aria-label",
          collapsed ? "출력 펼치기" : "출력 접기",
        );
      });
      gutter.append(toggle);
    }
    gutter.append(number);
    const toolbar = document.createElement("div");
    toolbar.className = "cell-toolbar";
    const language = document.createElement("span");
    language.textContent = "Python";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "cell-copy";
    copy.textContent = "복사";
    copy.setAttribute("aria-label", `셀 ${index + 1} 코드 복사`);
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.dataset.source);
        copy.textContent = "복사됨";
        status.textContent = "코드를 복사했습니다.";
        setTimeout(() => {
          copy.textContent = "복사";
        }, 1800);
      } catch {
        status.textContent =
          "자동 복사를 사용할 수 없습니다. 코드를 선택해 복사하세요.";
      }
    });
    toolbar.append(language, copy, status);
    input.querySelector(".command-label")?.remove();
    input.prepend(toolbar);
    input.classList.add("notebook-input");
    cell.append(gutter, input);
    if (outputBody.childElementCount) {
      const label = document.createElement("span");
      label.className = "output-label";
      label.textContent = "출력";
      output.append(label, outputBody);
      cell.append(output);
    }
    code.dataset.notebook = "true";
    displayPython(code, source);
  });
}
