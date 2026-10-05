import { FRUIT_ROWS, FRUIT_TASKS, runConditions, isCorrectCondition } from "./game-core.js?v=split-3";
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
for (const [index, task] of FRUIT_TASKS.entries()) {
  const article = document.createElement("article"); article.className = "dl-task";
  article.innerHTML = `<h3>과제 ${index + 1} · ${task.label}</h3><p>이 데이터를 찾을 수 있는 조건식을 만드세요.</p><div class="builders"></div><code class="condition-code"></code><div class="dl-actions"><button type="button" class="dl-button">조건 실행·확인</button><button type="button" class="dl-button dl-button--ghost">다시하기</button></div><div class="dl-result" aria-live="polite" hidden></div><div class="dl-table-wrap" hidden><table class="dl-table"><caption>내가 만든 조건의 실행 결과</caption><thead><tr><th>행 번호</th><th>과일</th><th>가격</th><th>수량</th></tr></thead><tbody></tbody></table></div>`;
  const builders = article.querySelector(".builders");
  for (let i = 0; i < (task.key === "b" ? 2 : 1); i++) {
    const fields = document.createElement("div"); fields.className = "condition-fields";
    fields.innerHTML = `<label>조건 ${i + 1} · 열 이름<select class="column"><option value="">선택</option><option>과일</option><option>가격</option><option>수량</option></select></label><label>비교 연산자<select class="operator"><option value="">선택</option><option value="==">== (같다)</option><option value=">=">&gt;= (이상)</option><option value=">">&gt; (초과)</option><option value="<=">&lt;= (이하)</option><option value="<">&lt; (미만)</option><option value="!=">!= (다르다)</option></select></label><label>비교 값<input class="value" type="text" placeholder="직접 입력" autocomplete="off"></label>`;
    builders.append(fields);
    if (i === 0 && task.key === "b") {
      const label = document.createElement("label"); label.textContent = "두 조건 연결 ";
      label.innerHTML += '<select class="join" aria-label="두 조건 연결"><option value="">선택</option><option value="&">& (둘 다 만족)</option><option value="|">| (하나 이상 만족)</option></select>'; builders.append(label);
    }
  }
  const read = () => [...builders.querySelectorAll(".condition-fields")].map(el => ({column:el.querySelector(".column").value, operator:el.querySelector(".operator").value, value:el.querySelector(".value").value.trim()}));
  const join = () => builders.querySelector(".join")?.value || "";
  const code = article.querySelector("code");
  const update = () => {
    code.textContent = `df[${read().map(c => `(df[${JSON.stringify(c.column || "열 이름")}] ${c.operator || "?"} ${c.value ? (c.column === "과일" ? JSON.stringify(c.value) : c.value) : "비교 값"})`).join(` ${join() || "?"} `)}]`;
    article.querySelector(".dl-result").hidden = true; article.querySelector(".dl-table-wrap").hidden = true;
  };
  builders.addEventListener("input", update); builders.addEventListener("change", update);
  const [check, reset] = article.querySelectorAll("button");
  check.addEventListener("click", () => {
    const result = article.querySelector(".dl-result"); result.hidden = false;
    try {
      const conditions = read(), rows = runConditions(conditions, join());
      const correct = isCorrectCondition(task.key, conditions, join());
      result.textContent = `${correct ? "조건식을 올바르게 만들었습니다." : "조건식을 다시 확인하세요. 열 이름, 비교 연산자, 비교 값과 연결 방식을 확인해 보세요."} 실행 결과: ${rows.length}행.${rows.length ? "" : " 조건에 맞는 데이터가 없습니다."}`;
      fillTable(article.querySelector("tbody"), rows); article.querySelector(".dl-table-wrap").hidden = false;
    } catch (error) { result.textContent = error.message; article.querySelector(".dl-table-wrap").hidden = true; }
  });
  reset.addEventListener("click", () => { builders.querySelectorAll("select,input").forEach(el => {el.value = "";}); update(); });
  update(); document.getElementById("condition-tasks").append(article);
}
