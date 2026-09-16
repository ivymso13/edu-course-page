# 인공지능 기초 활동지 모음

여러 수업 활동을 독립 웹페이지로 제작하고 GitHub Pages에서 제공하기 위한 프로젝트입니다. 수업 시간에 진행할 **활동지(그룹)** 을 루트 허브에서 고르면, 그 활동지에 속한 개별 활동 목록 페이지로 이동하고, 거기서 각 활동을 엽니다.

## 구조

- `index.html`: 활동지 카드를 보여주는 최상위 허브. 아직 존재하지 않는 활동지는 카드로 만들지 않습니다.
- `units/<group-id>/index.html`: 활동지 하나에 속한 하위 활동을 01/02/03 순서로 보여주는 목록 페이지. 예: `units/ai-learning/`
- `lessons/<lesson-id>/`: 활동 하나의 독립 웹페이지(기존 URL은 이동·삭제하지 않습니다)
- `lessons/shared/`: 여러 활동이 함께 쓰는 CSS·JS 공통 자산
- `data/activity-groups.json`: 활동지(group)과 하위 활동(children)을 함께 관리하는 확장용 스키마. group마다 `id/order/title/description/path/status/active/children`을, children마다 `id/order/title/path/duration/difficulty/status/active/objective`를 가집니다. 제목·설명·카드 같은 내용은 여전히 루트/그룹/활동 페이지의 HTML을 직접 최신 상태로 유지하는 **관리 원본이자 검증 소스**로 쓰지만(`tests/activity-groups.test.mjs`가 HTML과 JSON이 어긋나지 않는지 확인), `active` 필드(group·child 둘 다)만은 예외로 `assets/group-guard.js`가 배포된 페이지에서 런타임에 fetch해 확인합니다. 자세한 동작은 아래 "활동지 켜고 끄기(active)"를 참고하세요.
- `data/lessons.json`: 활동별 메타데이터를 담은 기존 평면 목록(하위 호환용으로 그대로 유지). `activity-groups.json`의 각 child와 id·order·path·duration·difficulty가 일치해야 합니다.
- `assets/group-guard.js`, `assets/guard.css`: 허브·그룹·활동 페이지가 공통으로 쓰는 활성화 가드. 아래 "활동지 켜고 끄기(active)"에서 설명합니다.
- `tests/`: 수업 로직과 정적 페이지 구조를 확인하는 테스트 하네스

## 활동지 켜고 끄기(active)

각 group은 `data/activity-groups.json`에 `"active": true | false`를 명시적으로 갖고, **각 child(개별 활동)도 마찬가지로 자신만의 `"active": true | false`를 갖습니다.** GitHub Pages에 배포된 정적 사이트에서 **이 `active` 값만 바꿔 다시 배포**하면(HTML을 건드리지 않아도) 학생 화면의 동작이 즉시 바뀝니다. 그룹 전체를 끌 수도 있고, 그룹은 켜 둔 채 그 안의 활동 하나만 끌 수도 있습니다.

- `active: true`인 그룹은 루트 허브에서 평소처럼 클릭해 들어갈 수 있고, 그룹·활동 페이지도 정상적으로 열립니다.
- `active: false`인 그룹은 루트 허브 카드에 "준비 중" 표시가 붙고 클릭(키보드 Enter 포함)이 막히며, 그 그룹의 `units/<group-id>/`와 하위 `lessons/<lesson-id>/` 페이지에 **직접 URL로 접속해도** 실제 콘텐츠 대신 "아직 준비 중인 활동입니다" 안내와 전체 활동지 홈으로 돌아가는 링크만 보여줍니다.
- 그룹이 `active: true`여도 특정 child가 `active: false`면, 그 활동지 목록 페이지(`units/<group-id>/`)의 해당 `.lesson-card`에만 "준비 중" 표시가 붙고 클릭이 막히며, 그 활동 페이지(`lessons/<lesson-id>/`)에 직접 URL로 접속해도 같은 "아직 준비 중인 활동입니다" 안내로 막힙니다. 나머지 형제 활동과 그룹 자체는 평소처럼 동작합니다.

### 동작 원리

모든 허브/그룹/활동 페이지는 `assets/group-guard.js`(ES 모듈)와 `assets/guard.css`를 불러옵니다.

- 활동 페이지는 `<body data-guard-scope="page" data-guard-group="<group-id>" data-guard-lesson="<lesson-id>">`로 자신이 속한 group id와 자기 자신의 lesson id를 함께 선언하고(그룹 목록 페이지는 그룹 전체를 나타내므로 `data-guard-lesson`이 없습니다), `<head>`의 인라인 스크립트가 즉시(자바스크립트 파싱 시점에) `<html data-guard="pending">`을 설정해 `#guard-content`(실제 콘텐츠)를 CSS로 숨깁니다. `group-guard.js`가 `data/activity-groups.json`을 fetch해서 해당 group의 `active`가 `true`이고(`data-guard-lesson`이 있다면) 그 child의 `active`도 `true`로 확인되면 `data-guard="active"`로 바꿔 콘텐츠를 보여주고, 둘 중 하나라도 `false`이거나 **fetch에 실패하면(네트워크 오류, JSON 손상 등)** `data-guard="blocked"`로 바꿔 `#guard-blocked` 안내만 보여줍니다. 즉 **활동 페이지는 불러오기에 실패했을 때도 항상 "준비 중"으로 보수적으로(fail-closed) 처리**하고, 확인되지 않은 콘텐츠가 실수로 노출되지 않도록 합니다. 실제로 `active: false`인 그룹·활동의 콘텐츠를 막는 접근 차단(보안 경계)은 오직 이 페이지 단계에서만 일어나며, 배포 환경(GitHub Pages)에서 직접 URL로 접속해도 동일하게 적용됩니다. 자바스크립트가 아예 꺼져 있으면 인라인 스크립트도 실행되지 않으므로 `data-guard` 속성이 설정되지 않고, 이 경우 CSS 기본값대로 콘텐츠가 그대로 보입니다(무JS 환경에서는 이 가드가 활성화를 강제할 수 없다는 한계가 있습니다).
- 루트 허브는 `<body data-guard-scope="hub">`이고, 각 그룹 카드(`<a class="group-card">`)에 `data-group-card="<group-id>"`를 붙입니다. 카드는 페이지 로드 즉시(비동기 fetch 완료 전부터) 클릭 이벤트를 가로채고, group id별 상태가 `"active"`로 확인되기 전까지는 항상 이동을 막습니다. fetch가 끝나면 실제로 `active: false`로 확인된 그룹 카드에만 "준비 중" 배지가 붙고 이동이 막힙니다. 반면 허브 카드는 접근을 차단하는 보안 경계가 아니라 안내용 진입점일 뿐이므로, **JSON을 아예 불러오지 못한 경우(`file://`로 직접 열었을 때는 브라우저가 로컬 JSON에 대한 fetch를 막고, 배포 환경에서도 일시적인 네트워크 오류가 날 수 있습니다)에는 이미 화면에 카드가 나와 있는 활동지를 모두 열어 둡니다(fail-open)** — 카드를 영구히 잠그는 대신 `#groups-load-error` 안내만 보여줍니다. 실제로 비활성인 활동지였다면 이동한 뒤 그룹·활동 페이지의 fail-closed 가드가 최종적으로 막으므로, 허브에서 fail-open으로 처리해도 비활성 콘텐츠가 새어 나가지는 않습니다.
- 활동지 목록 페이지(`units/<group-id>/index.html`)도 자신의 `data-guard-group`으로 그룹 전체 활성 여부를 fail-closed로 판정하는 동시에, 그 안의 각 `.lesson-card`(`data-lesson-card="<lesson-id>"`)에 대해서는 허브 카드와 똑같은 fail-open 잠금 로직을 적용합니다(잠금 대상이 그룹이 아니라 child라는 점만 다름). 이 페이지 자체가 fetch에 실패해 통째로 막히는 경우(fail-closed)에는 안에 있는 개별 활동 카드까지 따로 열어 둘 필요가 없으므로, 이 fail-open 처리는 그룹이 정상적으로 active로 확인된 뒤에만 의미가 있습니다.
- 잠금 배지(`.group-status-badge`)는 `.group-card`·`.lesson-card` 둘 다의 `grid-template-columns: auto 1fr auto` 3열 레이아웃에 4번째 자식으로 추가되므로, `guard.css`에서 `grid-column: 1 / -1`로 전체 폭의 별도 행에 배치해 기존 3열이 깨지지 않도록 합니다.

### 새 활동지를 추가하려면

1. `units/<새-group-id>/index.html`을 만들고, 기존 `units/ai-vocabulary/index.html`을 참고해 헤더(뒤로가기·활동지 제목·소개)와 하위 활동 카드 목록을 작성합니다. `<head>`에 `data-guard` pending 인라인 스크립트, `../../assets/guard.css`, `../../assets/group-guard.js` 모듈 스크립트를 포함하고, `<body data-guard-scope="page" data-guard-group="<새-group-id>">`로 시작해 실제 콘텐츠를 `<div id="guard-content">…</div>`로 감싸고, `#guard-loading`/`#guard-blocked` 안내 블록을 skip-link 다음에 둡니다.
2. `data/activity-groups.json`의 `groups` 배열에 새 group 객체(id/order/title/description/path/status/active/children)를 추가합니다. 새 그룹은 보통 `active: true`로 시작합니다.
3. 루트 `index.html`의 `.group-grid` 안에 새 `.group-card`를 추가하고 `units/<새-group-id>/`로 연결하며 `data-group-card="<새-group-id>"`를 붙입니다. 아직 활동이 없는 빈 활동지 카드는 만들지 않습니다.
4. `npm test`로 스키마·링크·가드 검증 테스트가 통과하는지 확인합니다.

### 기존 활동지에 하위 활동을 추가하려면

1. `lessons/<새-lesson-id>/`에 독립 웹페이지를 만듭니다(다른 활동처럼 `index.html`·`game-core.js`·`game.js`·`styles.css`, 필요하면 `lessons/shared/`의 공통 자산 재사용). 이 페이지에도 위와 같은 가드 마크업(`data-guard-scope="page" data-guard-group="<소속-group-id>" data-guard-lesson="<새-lesson-id>"`, `#guard-content`, `#guard-loading`, `#guard-blocked`, guard.css·group-guard.js 로드)을 포함해야, 소속 그룹이나 이 활동 자신이 나중에 `active: false`가 되었을 때 직접 URL 접근이 막힙니다.
2. 해당 활동지의 `units/<group-id>/index.html`에 새 `.lesson-card`를 순서(01/02/03…)에 맞게 추가하고 `../../lessons/<새-lesson-id>/`로 연결하며 `data-lesson-card="<새-lesson-id>"`를 붙입니다.
3. `data/activity-groups.json`의 해당 group `children` 배열과 `data/lessons.json`의 `lessons` 배열에 같은 내용(id/order/title/path/duration/difficulty/status, children에는 active/objective 추가)을 등록합니다. 새 활동은 보통 `active: true`로 시작합니다.
4. 이웃 활동들의 상단 back-link(`../../units/<group-id>/`)와 하단 이전/다음 이동 링크를 새 활동을 포함하도록 갱신합니다.

### 중복 데이터 관리 기준(무엇이 관리 원본인가)

같은 정보(제목·설명·순서·소요시간·난이도 등)가 `index.html` / `units/<group-id>/index.html` / `data/activity-groups.json` / `data/lessons.json` 네 곳에 나뉘어 중복 저장되어 있습니다. 필드마다 원본이 다르므로 새 내용을 추가·수정할 때는 아래 기준을 따르세요.

| 필드 | 관리 원본 | 반영 시점 | 어긋나면 |
| --- | --- | --- | --- |
| 제목·설명·순서·소요시간·난이도·objective 등 (`active` 제외 전부) | HTML(루트/그룹/활동 페이지)과 JSON(`activity-groups.json`, `lessons.json`)을 **함께** 손으로 동기화 | 커밋 시점(정적 배포이므로 HTML을 다시 빌드·배포해야 반영) | `tests/activity-groups.test.mjs`·`tests/hub-structure.test.mjs`가 실패 |
| `active`(그룹 활성/비활성, child 활성/비활성 모두) | `data/activity-groups.json`이 **유일한 원본**. HTML에는 이 값을 별도로 적어 두지 않음 | 배포된 JSON을 fetch하는 즉시(HTML을 다시 배포하지 않아도 반영) | 해당 없음(HTML에 중복이 없으므로 어긋날 수 없음) |

즉 "무엇을 보여줄지(제목·설명 등)"는 HTML이 그대로 원본이라 JSON과 함께 손으로 맞추고 테스트로 검증하지만, "지금 열 수 있는지(active)"는 오직 JSON 하나만 보고 런타임에 판단합니다. 이 둘을 섞어서 HTML에 활성 상태를 하드코딩하면 배포 없이 그룹을 껐다 켤 수 있는 목적 자체가 사라지므로 하지 마세요.

## OT · 인공지능 용어 빙고 (종이 빙고)

루트 허브에서 가장 먼저 오는 활동지(OT)이며, 활동지 목록 페이지는 `units/ai-vocabulary/`이고 활동은 `lessons/ai-keyword-bingo/`에 있습니다. 활동지 목록 페이지에는 이 활동에서 다루는 용어 25개를 `keywords.js`와 동일한 철자·순서로 미리보기하는 목록(`.term-preview`)이 있습니다(`tests/ai-keyword-bingo.test.mjs`가 동기화를 검증).

- **`lessons/ai-keyword-bingo/`(인공지능 핵심 용어 빙고)** — 학생은 5×5 종이 빙고판에 인공지능·데이터 핵심 용어 25개를 순서와 상관없이 옮겨 적습니다(디지털 빙고판은 만들지 않습니다). 준비 화면의 "학생용 빈 빙고판 인쇄하기" 버튼을 누르면 이름 칸과 빈 25칸짜리 5×5 격자만 담은 인쇄용 화면(`#printable-board`, `window.print()`)이 열려 학생 수만큼 인쇄해 나눠줄 수 있고, 그 아래 25개 용어를 고대비 카드 목록으로 모두 보여주고, 선택 사항인 확인 체크(0/25)를 제공합니다. 교사가 "추첨 시작"을 누르기 전 확인 절차를 거친 뒤 추첨 화면으로 넘어가면, 25개 용어를 격자 칸 없이 겹치지 않는 무작위 위치에 흩뿌려(`#term-board`) 처음부터 전부 화면에 띄워 놓고 "다음 뽑기"를 누를 때마다 그중 하나를 무작위로 뽑아 그 칩을 강조 표시합니다(이미 뽑힌 칩은 파란색, 방금 막 뽑힌 칩은 초록색 + 몇 번째로 뽑혔는지 모서리 배지). 위치 계산(`game.js`의 `placeTermBoardTiles`)은 각 칩을 실제로 렌더링해 측정한 크기 기준으로 무작위 좌표를 시도하다 겹치면 다시 시도하고, 그래도 자리를 못 찾으면 중심에서 바깥으로 나선형으로 훑어 안전하게 자리를 찾습니다. 컨테이너가 아직 화면에 보이지 않을 때(활성화 가드 대기 중이거나 아직 준비 화면일 때)는 크기가 0으로 측정되어 전부 한 점에 겹쳐 버리므로, `ResizeObserver`로 실제로 폭이 생기는 시점까지 기다렸다가 딱 한 번만 배치를 계산합니다(이후 뽑을 때마다는 이미 정해진 위치를 그대로 두고 강조 색상·배지만 갱신). 준비 화면의 용어 목록과 달리 이 배치는 페이지를 새로 열 때마다 다시 계산되므로 고정된 순서를 외워 자기 종이 빙고판에 그대로 옮겨 적을 수 없습니다. 교실 앞에서 화면을 띄워 놓고 진행하는 용도라 움직이는 장식 애니메이션은 두지 않고, 정적인 배치와 색상 강조만으로 진행 상황을 보여줍니다. `N/25` 진행 상황과 방금 뽑힌 용어 이름은 화면 위 안내 문구(`#draw-current`, `aria-live`)로도 함께 전달됩니다. 추첨은 중복 없이 진행되며, 바로 직전 추첨만 취소해 되돌릴 수 있고, 확인을 거친 뒤 전체 초기화도 가능합니다. 전체화면 전환과 키보드 Enter/Space로 다음 뽑기를 지원하고, 새로고침해도 `localStorage`에 저장된 진행 상태(단계·체크·추첨 기록)를 그대로 복원합니다 — 수업 중 실수로 새로고침해도 이어서 진행할 수 있게 하기 위함이며, 완전히 새로 시작하려면 준비 화면으로 돌아갈 방법이 없으므로 추첨 화면의 "전체 초기화" 버튼으로 추첨 기록을 지우세요. 이 화면은 교사 전용이라 학생 의견을 묻는 마무리 입력 영역은 두지 않습니다. 용어 25개의 철자·띄어쓰기·순서는 참고 원본 `bingo.html`의 `keywords` 배열과 완전히 동일하게 `lessons/ai-keyword-bingo/keywords.js`에 고정되어 있습니다(`tests/ai-keyword-bingo.test.mjs`가 검증).

## 활동지 03 · 인공지능과 탐색

활동지 목록 페이지는 `units/ai-search/`이고, 강 건너기와 8-퍼즐로 상태·간선과 맹목적 탐색을 익힌 뒤 같은 학교 지도에서 균일 비용 탐색과 A* 탐색을 비교하는 활동 네 개가 이어집니다.

1. **`lessons/search-bfs-delivery/`(문제 해결과 탐색)** — 늑대·양·양배추 강 건너기를 직접 조작하며 상태·행동·초기 상태·목표 상태 개념을 익힙니다.
2. **`lessons/search-eight-puzzle/`(8-퍼즐로 보는 맹목적 탐색)** — 8-퍼즐을 직접 맞춘 뒤 너비 우선 탐색이 가까운 상태부터 층별로 넓히고 중복 상태를 제외하며 최소 이동 경로를 찾는 과정을 관찰합니다.
3. **`lessons/search-cost-delivery/`(균일 비용 탐색으로 가장 빠른 길 찾기)** — 장소마다 이동 비용이 다를 때, 균일 비용 탐색이 지금까지 든 비용 g(n)이 가장 작은 곳부터 오픈 리스트로 넓혀가며 실제로 가장 빠른 길을 찾는다는 것을 체험합니다.
4. **`lessons/search-astar-delivery/`(휴리스틱값으로 익히는 A* 탐색)** — 3단계와 같은 학교 지도에서 A* 탐색이 균일 비용 탐색보다 적은 상태만 확인하고도 같은 길을 찾는 것을 확인한 뒤, 8-퍼즐 새 문제에서 g(n), h(n), f(n)을 비교하며 다음 상태를 선택하는 원리를 체험합니다.

## 활동지 04 · 탐색의 다양한 문제 해결 사례

활동지 목록 페이지는 `units/search-problem-cases/`이고, 상대가 있는 게임에서 컴퓨터가 Min-Max 알고리즘으로 수를 고르는 과정을 체험하는 활동 두 개가 이어집니다.

1. **`lessons/search-tictactoe-minimax/`(게임 트리 탐색)** — Min-Max 알고리즘을 적용한 컴퓨터와 틱택토를 하고, 게임이 끝난 뒤 컴퓨터가 상대의 최선 대응까지 살펴 수를 고른 과정을 확인합니다. 각 수 아래에는 후보 수·MAX/MIN 차례·말단 점수(+1/0/-1)·값이 아래에서 위로 전달되는 과정·최종 선택 간선을 보여주는 Min-Max 의사결정 트리가 있습니다(전체 게임 트리 대신 지금 판단에 필요한 대표 가지만 표시하고, 생략된 부분은 안내합니다).
2. **`lessons/search-othello-minimax/`(돌 뒤집기 게임 탐색)** — Min-Max 알고리즘을 적용한 컴퓨터와 4×4 오델로를 두며, 상대의 돌을 뒤집는 규칙과 둘 수 있는 자리가 없을 때의 패스 규칙을 익힙니다. 활동 01과 동일하게 게임이 끝난 뒤 각 수 아래에서 후보 수·MAX/MIN 차례·돌 개수로 정해지는 말단 점수(+1/0/-1)·값 전달·최종 선택을 의사결정 트리로 확인할 수 있고, 상대가 패스한 지점은 트리에서 별도 패스 노드로 표시됩니다.

## 활동지 05 · 기계학습과 데이터

- **`lessons/ai-problem-method/`(어떤 방법으로 해결할까?)** — 규칙과 계산 또는 여러 사례에서 학습하는 방법 중 문제에 더 알맞은 해결 방식을 선택하는 도입 활동입니다.

## 활동지 06 · 기계학습 알고리즘

같은 마트 과일 선별 AI를 소재로 세 활동이 이어집니다. 활동지 목록 페이지는 `units/machine-learning-algorithms/`이고, 각 활동은 `lessons/` 아래의 기존 독립 URL을 유지합니다.

1. **`lessons/ai-inference-ripeness/`(잘 익은 과일 찾기)** — 마트의 과일 선별 AI 역할을 맡아 과일의 색깔과 촉감을 함께 보고 익음 여부를 예측하는 실습입니다. 먼저 과일 12개로 AI를 학습시키며 매번 정답과 O/X를 바로 확인하고, 학습이 끝나면 전환 화면에서 12개 전체 결과표로 색깔·촉감과 판단을 한눈에 비교합니다. 이어서 같은 판단 규칙을 다른 과일 5개에 적용해 한 화면에 모두 띄워 놓고 다섯 문제를 동시에 답한 뒤 한 번에 제출해 실제 시험을 치릅니다. 시험 중과 제출 후 모두 문제별 정답은 공개되지 않고 전체 점수만 확인할 수 있어, 학습 때 찾은 규칙이 새로운 과일에도 통하는지 스스로 검증하게 됩니다. 결과 화면에는 활동과 AI 개념(입력 정보·학습 자료·학습·시험·시험 정확도)을 연결하는 정리와, "AI는 말로 규칙을 찾지 않고 자료를 계산하며 판단 기준을 조정한다"는 짧은 오개념 방지 문장이 있습니다.
2. **`lessons/ai-signal-noise/`(정보가 많으면 더 정확할까?)** — 같은 마트 AI에 색깔·촉감과 함께 **계절** 정보를 추가로 알려주는 후속 임무입니다. 학습 자료는 색깔·촉감이 같고 계절만 다른 비교쌍 6개(익음 3·안 익음 3)를 정확히 두 번씩 보여주도록 구성되어, 계절이 달라도 정답은 같다는 사실을 학생이 직접 비교할 수 있습니다. 학습 12개를 마치면 전체 결과표를 먼저 보여주고, "색깔·촉감·계절 중 판단에 도움이 되지 않은 정보는?"이라는 질문에 스스로 답한 뒤에야 정답과 해설이 공개됩니다. 이어서 처음 보는 과일 5개를 한 화면에서 동시에 시험 치르며(개별 정답은 비공개, 전체 점수만 공개), 결과 화면에서 "정보가 많다고 항상 더 좋은 것은 아니다"와 "노이즈(판단과 관계없는 정보)" 개념을 정리합니다.
3. **`lessons/ai-biased-data/`(학습 자료가 한쪽으로 치우치면?)** — 같은 마트 AI를 이번에는 창고 과일 12개로만 학습시키는데, 자료가 의도적으로 초록 5개·빨강 4개·노랑 2개·주황 1개로 치우쳐 있고 노랑·주황의 촉감 조합은 충분히 등장하지 않습니다. 학습을 마치면 색깔별 개수를 막대로 보여주고 "가장 적게 등장한 색깔은?"을 학생이 먼저 답한 뒤 해설을 공개합니다. 이어지는 시험 8문제는 노랑·주황의 단단함·중간·말랑함을 모두 포함하도록 균형 있게 구성되어, 학습 자료만 보고 만든 단순한 규칙의 한계가 드러납니다. 시험 중에는 정답이 공개되지 않고, 종료 후 전체 점수와 함께 색깔별 정확도표를 제공합니다(문항별 정답은 노출하지 않음). 결과 화면에서 "학습 자료가 한쪽으로 치우친 것"을 쉬운 말로 설명한 뒤 **편향된 데이터**라는 용어를 소개합니다.

세 활동 모두 활동1의 실험실/마트 디자인 언어와 과일 SVG, 접근성 장치(키보드 포커스, `aria-live`, `fieldset`/`legend`, `prefers-reduced-motion`)를 공유합니다. 공통 코드와 스타일은 `lessons/shared/`(난수·집계 유틸, 과일 SVG, 공통 CSS)에 모아 유지보수하고, 각 활동의 정답 판정 규칙은 학습 시점 이전에는 화면에 노출하지 않습니다.

## 활동지 02 · 인공지능의 이해 (인공지능의 역사)

루트 허브의 세 번째 활동지이며, 활동지 목록 페이지는 `units/ai-history/`이고 활동 두 개 `lessons/ai-perceptron-wall/`, `lessons/eliza-python-web/`가 있습니다. 인공지능이 실제로 겪은 "성공 → 벽에 부딪힘 → 우회 시도의 한계 → 새 방법으로 돌파"라는 첫 번째 겨울과 도약(1958~1986년)의 흐름을, 학생이 직접 4단계를 순서대로 체험하는 개인 활동(활동 1)과, 그 흐름 속 규칙 기반 시스템 자체를 학생이 직접 파이썬으로 구현해 보는 실습(활동 2)으로 이어집니다.

- **`lessons/ai-perceptron-wall/`(인공지능의 역사)** — 학생은 좌표평면의 점을 기울기(m)·y절편(b) 슬라이더로 움직인 직선으로 분류합니다. **1단계**에서는 직선 하나로 완전히 나누며 1958년 퍼셉트론의 성공을 경험합니다. **2단계**의 대각선 띠 모양 점 배치는 전형적인 XOR처럼 선형 분리가 불가능하지만 표준 XOR 진리표 자체는 아닙니다. 해설에서는 1969년 민스키와 페퍼트가 분석한 단층 퍼셉트론의 한계와, 기술적 한계·과도한 기대·연구비 축소 등이 함께 첫 번째 AI 겨울로 이어졌음을 설명합니다. **3단계**에서는 1972년 마이신을 본뜬 규칙 기반 진단으로 사람이 예상하지 못한 사례를 처리하기 어려운 한계를 체험합니다. **4단계**에서는 두 직선의 띠로 같은 점을 완전히 분류하고, 자동 찾기를 통해 수치적 경사하강으로 오차를 줄이는 과정을 관찰합니다. 이 자동 찾기는 실제 역전파 구현이 아니며, 실제 역전파는 다층 신경망에서 각 파라미터의 기울기를 효율적으로 계산해 경사하강을 가능하게 하는 방법이라고 구분해 설명합니다.

- **`lessons/eliza-python-web/`(나만의 ELIZA 만들기)** — 학생이 `if`, `while`, `break`, `input()`, 그리고 딕셔너리(dict)의 `get()`을 실제로 써서 규칙 기반 대화형 AI ELIZA(1966)를 파이썬으로 직접 구현하고, 브라우저 안에서 바로 대화하며 고치는 실습입니다. 에디터에 처음부터 채워져 있는 코드는 `print("ELIZA와 대화를 시작합니다.")` / `while True:` / `message = input("나: ")`와 "ELIZA의 대화 규칙 만들기" 주석뿐인 진짜 미완성 골격이며(정답 예시나 힌트 보기 기능은 두지 않음), 종료 조건(`if message == "종료": break`)과 대화 규칙 딕셔너리, `ans.get(message, "기본 응답")` 형태의 처리는 교사가 수업 시간에 학생들과 함께 작성하도록 설계했습니다(교과서의 ELIZA 예시가 쓰는 `responses.get(user_input, ...)` 패턴을 따름 — `elif` 체인 대신 딕셔너리 하나로 규칙을 관리하며, 이 저장소 밖의 수업 자료를 참고했을 뿐 저장소 안에는 해당 이미지가 없음). Python 실행은 서버가 아니라 학생 브라우저 안에서 [Pyodide](https://pyodide.org)(WebAssembly로 컴파일된 CPython)로 이뤄지며, 33명 동시 접속과 학교 네트워크 저하를 고려해 CDN에서 매번 내려받지 않고 필요한 런타임 파일 5개(약 13MB, `pyodide.mjs`/`pyodide.asm.mjs`/`pyodide.asm.wasm`/`python_stdlib.zip`/`pyodide-lock.json`)만 버전(314.0.3)을 고정해 `lessons/eliza-python-web/vendor/pyodide/`에 그대로 담아 두었습니다(출처·해시는 그 폴더의 `SOURCE.md` 참고, numpy 같은 추가 패키지는 전혀 내려받지 않습니다). 코드는 메인 스레드가 아니라 전용 Web Worker(`worker.js`)에서 실행되므로, 학생이 만든 `while True` 무한 루프가 페이지를 멈추지 않고 "중지" 버튼(`worker.terminate()`)으로 즉시 끊깁니다. `input()`이 실제로 값을 받을 때까지 멈춰 기다리게 하려면 SharedArrayBuffer + `Atomics.wait`가 필요한데, 이는 브라우저가 "cross-origin isolated" 상태여야 하고 이 정적 사이트는 서버 응답 헤더를 직접 설정할 수 없으므로, `coi-bootstrap.js`가 COOP/COEP 헤더를 붙여주는 최소 서비스워커(`sw-coi.js`)를 등록하고 세션당 한 번만 새로고침해 격리를 켭니다(실패해도 활동 자체는 막히지 않고, `input()`이 즉시 `EOFError`로 안내되는 대체 경로로 넘어갑니다). 화면은 왼쪽에 줄 번호·Tab 들여쓰기·간단한 문법 강조를 갖춘 직접 구현 코드 편집기, 오른쪽에 `input()`을 그대로 받는 터미널형 대화창을 두고, 실행/중지/초기화 버튼을 제공합니다. 코드·학번·이름과 함께, 생활기록부(생기부) 작성에 참고할 수 있도록 "만든 동기"·"활용 및 개선 방안" 서술형 답변도 받아 학번·이름·코드처럼 비어 있으면 제출을 막습니다(글자 수 제한은 두지 않음). 이 다섯 값은 모두 `localStorage`(`eliza-python-web:v1`)에 자동 저장되어 새로고침해도 사라지지 않고, 최종 제출은 Google Apps Script Web App으로 Google Sheet에 저장합니다. Apps Script 배포 URL은 `lessons/eliza-python-web/config.js`의 `GAS_ENDPOINT`에 설정하며, 이 값이 비어 있는 동안에는 "최종 제출" 버튼이 자동으로 비활성화되고 교사용 설정 안내(`<details>`, 설정되면 자동으로 숨겨짐)와 `apps-script-example.gs.txt`가 그 설정 절차를 안내합니다.

## 로컬 확인

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 열어 루트 허브(`/`)에서 활동지 카드를 고르고, `units/ai-learning/`에서 세 활동으로 이동하거나, 각 활동 폴더를 바로 엽니다(`/lessons/ai-inference-ripeness/`, `/lessons/ai-signal-noise/`, `/lessons/ai-biased-data/`, `/lessons/ai-keyword-bingo/`, `/lessons/ai-perceptron-wall/`, `/lessons/eliza-python-web/`). `units/ai-vocabulary/`에서 용어 빙고 활동으로, `units/ai-history/`에서 인공지능의 역사·나만의 ELIZA 만들기 두 활동으로도 이동할 수 있습니다. 활성화 가드는 fetch를 쓰므로 정확한 active 상태를 확인하려면 `file://`로 직접 열지 말고 반드시 로컬 서버를 통해 확인하세요. `file://`로 열면 fetch가 실패해 허브 카드는 열려 있지만(fail-open) 그룹·활동 페이지는 "준비 중" 화면으로 막힙니다(fail-closed) — 로컬 서버 없이는 실제 콘텐츠를 볼 수 없다는 뜻이니 참고하세요. `lessons/eliza-python-web/`은 `input()` 동기 대기를 위해 서비스워커가 세션당 한 번 자동으로 새로고침하니, 처음 열었을 때 화면이 한 번 깜빡여도 정상입니다. 파이오다이드 약 13MB를 처음 한 번 내려받으므로 첫 로딩은 네트워크 상태에 따라 몇 초 걸릴 수 있습니다. 테스트는 `npm test`로 실행합니다.
