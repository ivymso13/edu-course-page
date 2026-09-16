export const CASES = [
  { id: 1, text: "학생들의 시험 평균 점수 계산하기", answer: "traditional", reason: "점수를 모두 더한 뒤 인원수로 나누면 평균을 구할 수 있습니다." },
  { id: 2, text: "사진에서 고양이와 강아지 구분하기", answer: "ai", reason: "이미지의 복잡한 패턴을 인식하려면 머신러닝이 필요합니다." },
  { id: 3, text: "지각이 가장 많은 학생 찾기", answer: "traditional", reason: "출석부의 지각 횟수를 비교해 최댓값을 구하면 됩니다." },
  { id: 4, text: "자연어로 쓰인 문장의 감정 분석하기", answer: "ai", reason: "언어의 미묘한 뉘앙스를 이해하려면 자연어 처리 AI가 필요합니다." },
  { id: 5, text: "요일에 따라 급식 메뉴 표시하기", answer: "traditional", reason: "요일별 조건(if문)을 사용하면 자동으로 메뉴를 보여줄 수 있습니다." },
  { id: 6, text: "필기체로 쓴 글씨 인식하기", answer: "ai", reason: "사람마다 다른 필기체를 인식하려면 딥러닝이 필요합니다." },
  { id: 7, text: "마트에서 할인율을 적용해 최종 결제 금액 계산하기", answer: "traditional", reason: "금액 × (1 - 할인율) 공식을 이용해 간단히 계산할 수 있습니다." },
  { id: 8, text: "의료 영상에서 종양 찾기", answer: "ai", reason: "복잡한 의료 영상 분석은 전문적인 딥러닝 모델이 필요합니다." },
  { id: 9, text: "버스 도착 시간표를 시간 순서대로 정렬하기", answer: "traditional", reason: "정렬 알고리즘을 사용해 빠른 시간부터 순서대로 정리할 수 있습니다." },
  { id: 10, text: "스팸 문자 메시지 자동 차단하기", answer: "ai", reason: "새로운 스팸 패턴과 교묘한 단어 변형을 인식하려면 머신러닝이 필요합니다." },
  { id: 11, text: "스마트폰 이용 시간의 평균 구하기", answer: "traditional", reason: "하루 이용 시간을 모두 더한 뒤 일수로 나누면 평균을 계산할 수 있습니다." },
  { id: 12, text: "온라인 쇼핑몰에서 고객에게 상품 추천하기", answer: "ai", reason: "고객의 구매 패턴, 취향, 행동 데이터를 종합적으로 분석해 개인 맞춤형 추천을 하려면 AI가 필요합니다." }
];

export function checkAnswer(caseItem, choice) {
  return { correct: caseItem.answer === choice, answer: caseItem.answer, reason: caseItem.reason };
}

export function summarize(records) {
  return { correct: records.filter((record) => record.correct).length, total: CASES.length };
}
