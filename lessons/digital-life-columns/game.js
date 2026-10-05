import { FRUIT_ROWS, selectColumn } from "../digital-life-filter/game-core.js?v=split-3";
function fillTable(body, rows) {
  body.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value of [row.ID, row.과일, row.가격, row.수량]) {
      const td = document.createElement("td"); td.textContent = value; tr.append(td);
    }
    body.append(tr);
  }
}
fillTable(document.getElementById("sample-body"), FRUIT_ROWS);
for (const [index, column] of ["과일", "가격", "수량"].entries()) {
  const task = document.createElement("section");
  task.innerHTML = `<h4>연습 ${index + 1} · ${column} 열 전체를 선택하세요</h4><div class="condition-fields"><label>큰따옴표 안에 넣을 속성 이름<input type="text" autocomplete="off" placeholder="속성 이름"></label></div><code class="condition-code"></code><div class="dl-actions"><button type="button" class="dl-button">열 선택·확인</button><button type="button" class="dl-button dl-button--ghost">다시하기</button></div><div class="dl-result" aria-live="polite" hidden></div><div class="dl-table-wrap" hidden><table class="dl-table"><caption>내가 선택한 열의 값</caption><thead><tr><th scope="col">행 번호</th><th scope="col" class="column-heading"></th></tr></thead><tbody></tbody></table></div>`;
  const input = task.querySelector("input"), code = task.querySelector("code"), result = task.querySelector(".dl-result"), output = task.querySelector(".dl-table-wrap");
  const update = () => { code.textContent = `df[${JSON.stringify(input.value.trim() || "속성")}]`; result.hidden = true; output.hidden = true; };
  input.addEventListener("input", update);
  const [check, reset] = task.querySelectorAll("button");
  check.addEventListener("click", () => {
    result.hidden = false;
    try {
      const selected = input.value.trim(), values = selectColumn(selected);
      result.textContent = selected === column ? `맞았습니다. ${column} 열의 값 ${values.length}개를 선택했습니다.` : `지금은 ${selected} 열을 선택했습니다. 문제에서 요구하는 열 이름을 확인하세요.`;
      task.querySelector(".column-heading").textContent = selected;
      const body = task.querySelector("tbody"); body.replaceChildren();
      values.forEach((value, index) => {
        const row = document.createElement("tr");
        for (const item of [index, value]) { const cell = document.createElement("td"); cell.textContent = item; row.append(cell); }
        body.append(row);
      });
      output.hidden = false;
    } catch (error) { result.textContent = error.message; output.hidden = true; }
  });
  reset.addEventListener("click", () => { input.value = ""; update(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter") check.click(); });
  update(); document.getElementById("column-tasks").append(task);
}
