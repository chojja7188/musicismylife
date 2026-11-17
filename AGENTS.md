# AGENTS.md — 음악 숏폼 메이커

제페토(메인) · 인스타 · 유튜브용 음악 공유 계정의 **9:16, 1분 이내 숏폼 영상**을 만드는 페이지.
mp3 + 앨범 커버 + 구간을 넣으면 LP 회전 · 스펙트럼 · 커버 색 배경이 들어간 영상을 뽑는다. 여러 곡은 크로스페이드로 이어진다.
계정 목적: 좋은 음악 공유. 시리즈 예) "이 주의 노래들", "길 걸을 때 자신감 뿜뿜하는 노래". 가사는 넣지 않는다.

사용자는 한국어로 소통하고 비개발자에 가깝다. 설명은 한국어, 쉬운 말로.

## 실행

```bash
open -a "Google Chrome" index.html   # 서버 불필요, file://로 동작
```

- 배포: GitHub Pages(`main` 브랜치 루트) → https://chojja7188.github.io/musicismylife/ . `git push`하면 1~2분 뒤 반영. 핸드폰은 이 주소로 쓴다(800px 이하에서 세로 배치).
- 의존성 없음. 브라우저 기본 API만(Web Audio, Canvas, MediaRecorder). npm/빌드 없음 — 이 상태를 유지할 것.
- 비주얼은 형제 프로젝트 `../dj/overlay.html`(방송 오버레이)에서 가져왔다: `palette()`, `bands()`, 비트 감지, LP/글로우/링.

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 전부 (입력 패널 + 1080×1920 캔버스 + 녹화). CSS + JS 한 파일 |
| `docs/adr/` | 결정 기록 |
| `docs/exec-plan.md` | 진행 이력, 현재 상태, 남은 일 |

## 구조 (index.html)

```
곡 카드(.track) ── el.data = { buf: AudioBuffer, vis: prep(커버) }
   └ plan(): 카드 → 타임라인 { tracks[{start, d, S}], F(크로스페이드), total, err }
        곡 i는 영상 S초에 시작, d초 재생, 다음 곡과 F초 겹침
play(plan): BufferSource마다 GainNode 페이드 → master → 스피커 / analyser / recDest
frame(): ac.currentTime 기준으로 지금 곡·전환 비율 k 계산 → 캔버스에 그림
녹화: canvas.captureStream(30) 영상 + recDest 오디오 → MediaRecorder(mp4, 안 되면 webm) → 다운로드
```

## 알아둘 함정

- **커버는 `createImageBitmap(file)`로 읽는다.** file:// 페이지에서 blob URL `<img>`를 캔버스에 그리면 캔버스가 오염돼 `captureStream`/`getImageData`가 실패할 수 있다.
- **녹화는 실시간.** 1분 영상 = 1분. 탭이 가려지면 rAF가 멈춰 영상이 멈춘다 → 사용자에게 탭을 띄워두라고 안내.
- 블러 배경·LP·둥근 커버는 곡마다 `prep()`에서 미리 그려 둔다. 매 프레임 `ctx.filter = blur`를 하면 느리다.
- 레이어 순서: 배경(앞 곡 → 뒷 곡 알파) → 글로우·스펙트럼(곡별 알파) → 링 → 전경(커버·글자, 곡별 알파 + 슬라이드) → 불투명한 별도 곡 목록 페이지(마지막 곡 구간 종료 후 5초 추가, 2곡 이상, 5곡 기준 배치·0.45초 슬라이드) → 시리즈 제목(고정) → 계정 이름 → 시작/끝 검은 페이드.
- 시리즈 제목은 슬라이드하지 않는다(전환 중 겹쳐 보여서 고정, 번호만 페이드).
- 첫 곡 페이드 인은 0.3초(숏폼은 첫 순간이 중요), 나머지는 크로스페이드 F.
- **일시저장**: `refresh()`가 `save()`를 부른다(0.4초 모아서 IndexedDB `shortform`/`s`/`draft`에 저장). 상태를 바꾸는 곳은 꼭 `refresh()`를 거칠 것. 카드의 원본 파일은 `el.data.audio`/`el.data.cover`에 둔다. 시작할 때 복원하는 동안은 `restoring`으로 저장을 막는다.
- 파일 이름 날짜는 `toLocaleDateString('sv')`(로컬). `toISOString()`은 UTC라 하루 밀린다.

## 검증 방법

헤드리스 크롬으로 실제 녹화까지 돌려본다(사본에 가짜 곡 주입, 원본 수정 금지):
1. `index.html` 사본의 `</body>` 앞에 스크립트 주입: `OfflineAudioContext`로 킥+톤 곡 생성 → `el.data.buf`, `OffscreenCanvas` 그라데이션 → `createImageBitmap` → `prep()` → `el.data.vis`, 입력값 채우고 `refresh()`, `HTMLAnchorElement.prototype.click`을 덮어써 blob을 로컬 Node 서버로 POST, `$('#rec').click()`.
2. 크롬: `--headless=new --autoplay-policy=no-user-gesture-required --user-data-dir=<임시>`.
3. `ffprobe`로 코덱/해상도/길이, `ffmpeg -ss N -frames:v 1`로 프레임 추출해 확인, `-af volumedetect`로 소리 확인.

## 튜닝 노브

- 패널: 크로스페이드(초), 시리즈 제목, 계정 이름.
- 코드: `C`/`CX`/`CY`(커버 크기·위치), 스펙트럼 `spectrumTarget()`(-72~-12 dB, 지수 1.8, 높이 .9), 비트·글로우 세기 `* 1.3`(frame의 `v`), `videoBitsPerSecond: 12e6`, `captureStream(30)`.
