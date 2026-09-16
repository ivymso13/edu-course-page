import { CASES, checkAnswer, summarize } from "./game-core.js";

const state = { choices: new Map(), records: [], checked: false };
const $ = (selector) => document.querySelector(selector);
const ARTWORKS = [
  { id: "monet", src: "assets/art/human-monet.jpg", type: "human", reveal: "클로드 모네, 《인상, 해돋이》(1872)", source: "https://commons.wikimedia.org/wiki/File:Monet_-_Impression,_Sunrise.jpg" },
  { id: "mountain", src: "assets/art/ai-mountain.jpg", type: "ai", reveal: "이 활동을 위해 AI로 생성한 수채화" },
  { id: "vermeer", src: "assets/art/human-vermeer.jpg", type: "human", reveal: "요하네스 페르메이르, 《진주 귀걸이를 한 소녀》(약 1665)", source: "https://commons.wikimedia.org/wiki/File:Girl_with_a_Pearl_Earring.jpg" },
  { id: "rain", src: "assets/art/ai-rainy-city.jpg", type: "ai", reveal: "이 활동을 위해 AI로 생성한 과슈화" },
  { id: "hokusai", src: "assets/art/human-hokusai.jpg", type: "human", reveal: "가쓰시카 호쿠사이, 《가나가와 해변의 높은 파도 아래》(약 1831)", source: "https://commons.wikimedia.org/wiki/File:Katsushika_Hokusai_-_The_Great_Wave_off_the_Coast_of_Kanagawa_LCCN2008660568.jpg" },
  { id: "portrait", src: "assets/art/ai-portrait.jpg", type: "ai", reveal: "이 활동을 위해 AI로 생성한 유화풍 초상" },
  { id: "vangogh", src: "assets/art/human-van-gogh.jpg", type: "human", reveal: "빈센트 반 고흐, 《별이 빛나는 밤》(1889)", source: "https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg" },
  { id: "still", src: "assets/art/ai-still-life.jpg", type: "ai", reveal: "이 활동을 위해 AI로 생성한 아크릴화풍 정물" },
  { id: "rembrandt", src: "assets/art/human-rembrandt.jpg", type: "human", reveal: "렘브란트, 《베레모를 쓴 자화상》(1659)", source: "https://commons.wikimedia.org/wiki/File:Rembrandt_self_portrait.jpg" },
  { id: "river", src: "assets/art/ai-riverside.jpg", type: "ai", reveal: "이 활동을 위해 AI로 생성한 유화풍 풍경" }
];
const artState = { choices: new Map(), checked: false };

function renderGallery() {
  $("#art-grid").innerHTML = ARTWORKS.map((art, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `<article class="art-card" data-art-card="${art.id}"><div class="art-media"><img src="${art.src}" alt="작품 ${index + 1}" loading="eager" width="400" height="300"><span class="art-number">${number}</span></div><div class="art-actions" role="group" aria-label="작품 ${index + 1}을 만든 주체 선택"><button class="art-choice art-choice--human" type="button" data-art-id="${art.id}" data-art-choice="human" aria-pressed="false"><svg class="art-choice-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10-3.2-3.2-10 10L4 20Z"/><path d="m13.8 7 3.2 3.2M4.8 16l3.2 3.2"/></svg><span>사람</span></button><button class="art-choice art-choice--ai" type="button" data-art-id="${art.id}" data-art-choice="ai" aria-pressed="false"><svg class="art-choice-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 13.6 8l5.2 1.6-5.2 1.6-1.6 5.2-1.6-5.2-5.2-1.6L10.4 8 12 2.8Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg><span>인공지능</span></button></div><div class="art-reveal" hidden aria-live="polite"></div></article>`;
  }).join("");
  document.querySelectorAll("[data-art-choice]").forEach((button) => button.addEventListener("click", () => chooseArtwork(button)));
}

function chooseArtwork(button) {
  if (artState.checked) return;
  const id = button.dataset.artId;
  const choice = button.dataset.artChoice;
  artState.choices.set(id, choice);
  button.closest(".art-actions").querySelectorAll("[data-art-choice]").forEach((choiceButton) => {
    choiceButton.setAttribute("aria-pressed", String(choiceButton.dataset.artChoice === choice));
  });
  const completed = artState.choices.size;
  $("#art-count").textContent = `${completed} / ${ARTWORKS.length} 판단 완료`;
  $("#check-art-button").disabled = completed !== ARTWORKS.length;
  $("#art-submit-guide").textContent = completed === ARTWORKS.length ? "모든 그림을 판단했습니다." : `${ARTWORKS.length - completed}개 그림이 남았습니다.`;
}

function checkArtwork() {
  artState.checked = true;
  let correct = 0;
  document.querySelectorAll("[data-art-card]").forEach((card) => {
    const art = ARTWORKS.find((item) => item.id === card.dataset.artCard);
    const choice = artState.choices.get(art.id);
    const isCorrect = choice === art.type;
    if (isCorrect) correct += 1;
    card.querySelectorAll("[data-art-choice]").forEach((button) => { button.disabled = true; });
    card.classList.add(art.type === "human" ? "is-human" : "is-ai", isCorrect ? "answer-correct" : "answer-incorrect");
    const reveal = card.querySelector(".art-reveal");
    reveal.hidden = false;
    reveal.innerHTML = `<span class="art-judgement">${isCorrect ? "✓ 맞게 판단함" : "↻ 다시 살펴보기"}</span><strong>${art.type === "human" ? "사람 작품" : "인공지능 생성"}</strong><span>${art.reveal}</span>`;
  });
  $("#art-result").hidden = false;
  $("#art-score").textContent = `${correct} / 10`;
  const methodNav = $("[data-lesson-stage='method']");
  methodNav.querySelector("small").textContent = "이동 가능";
  $("[data-lesson-stage='art']").classList.add("is-complete");
  $("#art-result").focus();
}

function showLessonStage(stage, moveFocus = true) {
  const showArt = stage === "art";
  const showMethod = stage === "method";
  const showNeural = stage === "neural";
  $("#art-intro").hidden = !showArt;
  $("#method-intro").hidden = !showMethod;
  $("#activity").hidden = !showMethod;
  $("#neural-activity").hidden = !showNeural;
  if (showNeural) {
    const frame = $("#neural-frame");
    if (!frame.src) frame.src = frame.dataset.src;
  }
  document.querySelectorAll("[data-lesson-stage]").forEach((button) => {
    const active = button.dataset.lessonStage === stage;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  if (moveFocus) ({ art: $("#page-title"), method: $("#method-title"), neural: $("#neural-title") }[stage]).focus({ preventScroll: true });
}

function methodLabel(value) {
  return value === "traditional" ? "전통적인 프로그래밍" : "인공지능";
}

function renderMethodCases() {
  $("#method-list").innerHTML = CASES.map((item, index) => `<article class="method-item" data-method-case="${item.id}"><div class="method-item__head"><span>문제 ${index + 1}</span><em>미선택</em></div><h3>${item.text}</h3><div class="method-item__choices" role="group" aria-label="문제 ${index + 1} 분류"><button type="button" data-method-id="${item.id}" data-method-choice="traditional" aria-pressed="false">전통적인 프로그래밍</button><button type="button" data-method-id="${item.id}" data-method-choice="ai" aria-pressed="false">인공지능</button></div><div class="method-item__answer" hidden></div></article>`).join("");
  document.querySelectorAll("[data-method-choice]").forEach((button) => button.addEventListener("click", () => chooseMethod(button)));
  updateMethodProgress();
}

function chooseMethod(button) {
  if (state.checked) return;
  const id = Number(button.dataset.methodId);
  state.choices.set(id, button.dataset.methodChoice);
  const card = button.closest(".method-item");
  card.classList.add("is-answered");
  card.querySelector("em").textContent = "선택 완료";
  card.querySelectorAll("[data-method-choice]").forEach((choiceButton) => {
    choiceButton.setAttribute("aria-pressed", String(choiceButton === button));
  });
  updateMethodProgress();
}

function updateMethodProgress() {
  const completed = state.choices.size;
  const remaining = CASES.length - completed;
  $("#method-progress-text").textContent = `${completed}/${CASES.length} 완료`;
  $("#method-remaining").textContent = remaining ? `${remaining}개 남음` : "분류 완료";
  $("#progress-bar").style.width = `${(completed / CASES.length) * 100}%`;
  const progress = $(".activity-head .progress");
  progress.setAttribute("aria-valuenow", String(completed));
  $("#check-method-button").disabled = remaining !== 0;
}

function checkMethods() {
  state.checked = true;
  state.records = CASES.map((item) => {
    const choice = state.choices.get(item.id);
    const result = checkAnswer(item, choice);
    return { ...item, choice, correct: result.correct };
  });
  document.querySelectorAll("[data-method-case]").forEach((card) => {
    const item = CASES.find((candidate) => candidate.id === Number(card.dataset.methodCase));
    const record = state.records.find((candidate) => candidate.id === item.id);
    card.classList.add(record.correct ? "is-correct" : "is-incorrect");
    card.querySelector("em").textContent = record.correct ? "정답" : "오답";
    card.querySelectorAll("[data-method-choice]").forEach((button) => { button.disabled = true; });
    const answer = card.querySelector(".method-item__answer");
    answer.hidden = false;
    answer.innerHTML = `<strong>정답: ${methodLabel(item.answer)}</strong><p>${item.reason}</p>`;
  });
  const score = summarize(state.records);
  $("#score").textContent = `${score.correct}/${score.total}`;
  $("#method-results").innerHTML = `<p><strong>정답 (${score.correct}개)</strong>과 <strong>오답 (${score.total - score.correct}개)</strong>을 각 문제 카드에서 확인하세요.</p>`;
  $("#activity").prepend($("#result-view"));
  $("#result-view").hidden = false;
  $(".method-submit").hidden = true;
  $("#result-title").focus();
}

$("#restart-button").addEventListener("click", () => {
  state.choices.clear(); state.records = []; state.checked = false;
  $("#result-view").hidden = true;
  $(".method-submit").hidden = false;
  renderMethodCases();
});
$("#check-method-button").addEventListener("click", checkMethods);
$("#check-art-button").addEventListener("click", checkArtwork);
$("#start-method-button").addEventListener("click", () => {
  showLessonStage("method");
});
document.querySelectorAll("[data-lesson-stage]").forEach((button) => button.addEventListener("click", () => showLessonStage(button.dataset.lessonStage)));
renderGallery();
renderMethodCases();
