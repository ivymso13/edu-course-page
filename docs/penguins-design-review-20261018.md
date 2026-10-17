DESIGN_REVIEW_COMPLETE

# 활동지 07 기계학습과 데이터 실습(2) 디자인 최종 점검 및 개선 보고서

## 1. 개요 및 점검 환경
- **기준 브랜치 및 커밋**: `design-course-system` (기준 `ae69c4c`)
- **담당 역할**: Antigravity (HTML/CSS 디자인 피드백 및 직접 개선 구현)
- **점검 대상 경로**:
  - 단원 허브: `units/ml-data-practice-2/index.html`
  - 활동 01: `lessons/penguins-data/index.html` (데이터 살펴보기)
  - 활동 02: `lessons/penguins-cleaning/index.html` (데이터 정리하기)
  - 활동 03: `lessons/penguins-graphs/index.html` (속성 비교하기)
  - 활동 04: `lessons/penguins-model/index.html` (펭귄 분류하기)
  - 공통 스타일시트: `lessons/penguins-data/lab.css`
- **점검 환경**:
  - 로컬 HTTP 서버: `http://127.0.0.1:8081/` (모든 엔드포인트 HTTP 200 OK 확인 완료)
  - 데스크톱 뷰포트: 1280px (일반 모니터 및 교실 프로젝터 환경)
  - 모바일 뷰포트: 390px (스마트폰 세로 모드)
  - 테스트 러너: `npm test` (568/568 통과)

---

## 2. 화면별 점검 및 디자인 개선 상세

### 2.1 단원 허브 (`units/ml-data-practice-2/index.html`)
- **수업 준비 자료 영역**:
  - `practice-materials.css` 기반의 컴팩트 다운로드 카드 적용 상태 유지 (`penguins_size.csv` 단일 다운로드).
  - 하단 코랩 링크 및 학생 제출 폼 배제 원칙 준수 확인.
- **활동 목록 카드 (01~04)**:
  - 데스크톱(1280px)과 모바일(390px)에서 안정적인 패딩과 그리드 정렬을 위해 HTML 들여쓰기 및 태그 구조를 가독성 높게 정리.
  - 가드 계약 속성(`data-guard-group="ml-data-practice-2"`, `data-lesson-card`) 100% 보존.

### 2.2 활동 01: 데이터 살펴보기 (`lessons/penguins-data/`)
- **원본 표 (`#raw-table`) 및 통계 표**:
  - `.table-wrap`에 부드러운 터치 스크롤(`-webkit-overflow-scrolling: touch`) 및 우측 가로 스크롤 암시 내부 그림자(`box-shadow: inset -6px 0 8px -4px rgba(15, 23, 42, 0.06)`) 적용.
  - 상단 헤더(`th`) `position: sticky; top: 0; z-index: 2`로 긴 표 스크롤 시에도 열 이름 상시 가독성 유지.
  - 페이징 컨트롤 및 검색창: 390px 모바일에서 검색창, 행 수 셀렉트, 이전/다음 버튼이 44px 이상 터치 타깃으로 자동 재배치.
- **개체수 막대그래프 & 몸무게 상자그림 분리 유지**:
  - `#species-chart`와 `#body-mass-chart`를 별도 패널로 분리 유지하여 학생 인지 부하 감소.
  - `.chart-wrap` 내 SVG 최소 너비(`min-width: 580px`, 모바일 `540px`)를 확보하여 가로 스크롤 시에도 축 눈금 및 텍스트 레이블이 찌그러지지 않고 선명하게 표시.

### 2.3 활동 02: 데이터 정리하기 (`lessons/penguins-cleaning/`)
- **결측값 카드 그리드 (`#missing-cards`)**:
  - 데스크톱(1280px): 4열 그리드(`minmax(220px, 1fr)`)로 시각적 균형과 정보 밀도 최적화.
  - 모바일(390px): 2열 그리드(`repeat(2, minmax(0, 1fr))`)로 자동 전환되며, 결측 수치 폰트를 `1.6rem`으로 적절히 축소하여 카드 외부 텍스트 넘침 방지.
  - 시각적 인지 보조: 결측치가 있는 속성은 앰버 좌측 보더(`border-left: 3px solid #d97706`)와 연한 배경색, 결측치 0인 속성은 그린 보더(`border-left: 3px solid #10b981`) 적용.
- **정리 단계 조작부 (`#drop-missing`, `#drop-sex`, `#reset-cleaning`)**:
  - 모바일 390px에서 버튼들을 전폭(100%) 및 44px 터치 높이로 전환하여 엄지손가락 터치 편의성 대폭 개선.
  - 단계별 통계 지표 카드(`.metrics`, `.metric`): `tabular-nums` 적용으로 정렬 안정화.
- **MinMax 정규화 영역**:
  - 계산 공식 박스(`.formula`)를 모노스페이스 배지 스타일로 정돈.

### 2.4 활동 03: 속성 비교하기 (`lessons/penguins-graphs/`)
- **속성 선택 컨트롤 및 체크박스**:
  - 축 선택 셀렉트 박스(`select`)와 체크박스 레이블(`.check`)의 터치 타깃을 최소 44px로 통일.
  - 모바일 390px에서 가로축·세로축 선택 셀렉트 박스가 전폭으로 자연스럽게 떨어지도록 레이아웃 최적화.
- **산점도 및 점 인스펙터 (`#point-inspector`)**:
  - 산점도 SVG 포인트 hover/focus 시 뚜렷한 스트로크 강조(`stroke: #16181f; stroke-width: 1.5;`).
  - 선택된 점 상세 카드(`.point-card`): 액센트 좌측 보더(4px)와 부드러운 배경으로 시각적 피드백 제공.
- **상관관계 히트맵 (`#correlation-matrix`) & 범례**:
  - 셀 패딩과 텍스트 정렬을 정돈하고, 하단 상관계수 범위 키(`.correlation-key`) 배치.

### 2.5 활동 04: 펭귄 분류하기 (`lessons/penguins-model/`)
- **속성 선택 필드셋 (`#model-features`)**:
  - 체크박스 라벨 버튼화: `:has(input:checked)` 가상 클래스를 활용하여 선택된 속성이 블루 틴트 배경(`background: #eef2ff`)과 액센트 테두리로 즉각 반응하도록 개선.
- **결정트리 시각화 (`#decision-tree`)**:
  - 내부 분기 노드: 깔끔한 인디고 배지(`.branch`)와 테두리 분기.
  - 최종 예측 리프 노드(`div.tree-node`): 연녹색 배경(`background: #f0fdf4`)과 녹색 좌측 보더(`border-left: 4px solid #16a34a`)를 적용하여 분류 결과가 한눈에 구별되도록 가독성 향상.
- **혼동행렬 (`#confusion-matrix`)**:
  - 예측값과 실제값 축 레이블의 간격과 셀 패딩 정돈.

---

## 3. 공통 디자인 시스템 개선 사항 (`lessons/penguins-data/lab.css`)

### 3.1 파이썬 코드 블록 (.command-block)
- 좌측 액센트 보더(3px solid var(--accent)) 및 상단 `PYTHON` 영문 레이블 배지 배치.
- 코드 블록 `pre`에 `min-height: 1.4em`을 설정하여 인터랙션에 따른 동적 파이썬 코드 업데이트 시 발생하던 레이아웃 흔들림(Layout Shift) 방지.

### 3.2 터치 및 키보드 접근성 강화
- 모든 상호작용 요소(`button`, `select`, `input`, `.controls .check`, `.lab-nav a`, `.lesson-pager a`)의 최소 터치 높이를 `44px`로 확보 (WCAG 2.1 AAA 권장 준수).
- 모바일(390px) 폼 요소(`input`, `select`)의 폰트 크기를 `16px`로 설정하여 iOS Safari의 원치 않는 자동 줌 인 동작 차단.
- `:focus-visible` 아웃라인 스타일(`3px solid var(--focus); outline-offset: 2px`)을 통일하여 키보드 탐색 접근성 보장.
- 상단바 `#projector-toggle.utility-button`에 최소 44px 터치 높이 및 `aria-pressed="true"` 활성 상태 시 액센트 배경 스타일 추가.

### 3.3 교실 프로젝터 모드 (`body.projector-mode`)
- 빔 프로젝터의 명암비 저하 문제를 해결하기 위해 고대비 테마 규칙 강화:
  - 텍스트 및 기본 선 색상을 딥 블랙(`--ink: #000000`, `--line-strong: #000000`)으로 강제 전환.
  - 코드 블록, 표 헤더/경계선, 카드 테두리를 2px 순수 블랙 보더로 강화.
  - SVG 차트 텍스트 레이블을 진한 블랙(`fill: #000000; font-weight: 750`)으로 렌더링.
  - 글꼴 크기 전역 112% 확대 및 패널 여백 확장.

---

## 4. 검증 결과 및 남은 이슈

### 4.1 자동화 테스트 검증
- `npm test` 실행 결과:
  - 전체 568개 테스트 전체 통과 (0 fail, pass 568).
  - 활동지 07 관련 계약 검증 통과:
    - 독립 4단계 lesson 페이지 시퀀스 연결 (`penguins-data` -> `cleaning` -> `graphs` -> `model`).
    - 퀴즈, 라디오 버튼, Colab 노트북 링크, 학생 제출 폼 제거 원칙 유지.
    - 01 개체수 막대그래프(`#species-chart`)와 몸무게 상자그림(`#body-mass-chart`) 분리 검증 통과.
    - CSS 프로젝터 모드 및 모바일 반응형 규칙 검증 통과.

### 4.2 남은 이슈 및 배포 인계 사항
- **JS 및 로직 보존**: 모든 JS 코드(`game.js`, `lab-core.js`, `lab-commands.js`)는 계약대로 수정 없이 온전히 보존되었으며 디자인 개선만 반영되었습니다.
- **Git 상태**: Git 커밋 및 푸시는 일체 수행하지 않았으며, Claude의 최종 검증 및 배포 준비가 완료되었습니다.
