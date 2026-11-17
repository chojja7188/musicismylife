# AGENTS.md — 음악 숏폼 메이커

제페토(메인)·인스타·유튜브용 **9:16, 1분 이내 음악 공유 영상**을 만드는 페이지. MP3·커버·구간을 받아 회전 LP, 스펙트럼, 커버 색 배경을 그린다. 가사는 넣지 않는다.

사용자는 한국어로 소통하고 비개발자에 가깝다. 설명은 한국어로 쉽게 한다. 사용법과 시간 계산 예시는 [README.md](README.md), 완료 이력과 검증 상태는 [진행 문서](docs/exec-plan.md)를 참고한다.

## 실행·배포·파일

```bash
open -a "Google Chrome" index.html
```

- 서버·설치·외부 의존성 없음. 브라우저 기본 API(Web Audio, Canvas, MediaRecorder)만 사용한다. npm/빌드를 추가하지 않는다.
- GitHub Pages: `main` 브랜치 루트 → https://chojja7188.github.io/musicismylife/ . 푸시 후 보통 1~2분 걸리며 GitHub Actions 배포 성공을 확인한다.
- 핸드폰은 배포 주소를 사용한다. 800px 이하에서 미리보기 위·입력 아래로 배치한다.

| 파일 | 역할 |
|---|---|
| `index.html` | 입력 패널·CSS·오디오·1080×1920 캔버스·녹화 전체 |
| `README.md` | 사용법, 시간 계산, 현재 동작, 테스트·배포 명령 |
| `tests/*.cjs` | 음량·스펙트럼/목록 배치·제목 맞춤 회귀 검사 |
| `docs/adr/` | 설계 결정과 변경 이유. 이전 기록을 지우지 않고 후속 ADR로 갱신 |
| `docs/exec-plan.md` | 현재 상태, 검증 근거, 진행 이력, 한계·후보 |
| `CLAUDE.md` | `AGENTS.md`를 참조하는 진입점. 지침을 중복 작성하지 않는다 |

## 구조

```text
곡 카드(.track): el.data = { buf: AudioBuffer, vis: prep(커버), audio, cover }
  → plan(): tracks[{buf, vis, start, d, S, gain, title, artist}], F, O, total, err
  → matchVolume(): 구간별 분석 → 고정 gain (마지막 곡은 목록에 쓰이는 구간도 분석)
  → play(): BufferSource → 곡별 GainNode(보정 × 페이드) → master
                                                        ├ 스피커
                                                        ├ analyser → 스펙트럼
                                                        └ recDest → 녹화 오디오
frame(): ac.currentTime 기준 곡·전환 비율 계산 → 캔버스
녹화: captureStream(30) + recDest → MediaRecorder → 다운로드
```

## 현재 동작과 변경 시 지킬 점

- **총시간은 목록 5초를 포함한다.** `Σd − F×(n−1) + O`, 2곡 이상이면 `O=5`, 1곡이면 `O=0`. 마지막 곡의 선택 구간 이후 목록에서 원곡을 최대 5초 더 재생한다. 입력한 끝 시간이 최종 오디오 종료 시점은 아니다. 원곡이 먼저 끝나면 무음이 남을 수 있다.
- **첫 프레임은 검정색이어야 한다.** `captureStream()` 생성 전과 녹화 시작 직전에 `paintBlack()`을 호출하고, `ac.resume()` 대기 중(`recorder.state === 'inactive'`)에도 음악 미리보기를 다시 그리지 않는다. 갤러리 앱이 선택하는 썸네일은 별개다.
- **MP4는 `recorder.start()`로 녹화하고 `stop()`에서 완성한다.** `start(1000)` 같은 timeslice나 `requestData()`를 넣으면 Chrome이 라이브 모드로 출력하여 전체 길이·탐색 색인이 빠질 수 있다. 갤럭시 3초 표시/탐색 불가 사례는 [ADR 0007](docs/adr/0007-finalize-recording-on-stop.md) 참고.
- 첫 곡 페이드 인 0.3초, 나머지는 F초 선형 크로스페이드. 각 선택 구간은 `2F`보다 길어야 한다. 녹화는 `total+0.6`초 뒤 종료한다.
- 자동 음량은 100ms 블록의 유효 RMS 기준, 목표 -18 dB RMS, 최대 증폭 4배(약 +12 dB). 샘플 피크 -1 dBFS 여유를 위해 전체 게인을 같은 비율로 낮춘다. LUFS/트루피크 분석은 아니다. 원본은 수정하지 않는다.
- 스펙트럼은 `getFloatFrequencyData()`의 실제 dB를 사용한다. byte 분석값의 조기 포화, 대역 최댓값 선택, 고음 추가 증폭을 다시 넣지 않는다.
- **링 파동·커버 컬러 글로우·소리에 따른 커버 확대/축소는 제거된 상태다.** 커버 크기와 검은 그림자는 고정. LP 회전과 스펙트럼만 유지한다.
- 레이어: 배경 → 스펙트럼 → LP·커버·곡 정보 → 불투명 목록 페이지 → 고정 시리즈 제목 → 계정 이름 → 시작/끝 검은 페이드.
- 목록은 5곡 기준 행 크기, 5곡 초과 시 축소. 마지막 선택 구간이 끝나면 0.45초 동안 오른쪽에서 들어온다.
- `fitTitle()`은 한 줄을 우선한다. 메인 76~56px, 한 줄에 안 맞으면 65px 두 줄. 목록도 크기를 줄이고 두 줄을 허용한다. 가수 줄과의 간격을 유지한다.
- 기존 비주얼의 출처는 `../dj/overlay.html`. **별도 프로젝트이므로 사용자가 요청한 경우에만 함께 수정한다.** DJ에는 링·글로우·커버 박자 반응이 남아 있다.

## 알아둘 함정

- 커버는 `createImageBitmap(file)`로 읽는다. file://의 blob URL `<img>`를 캔버스에 그리면 캔버스 오염으로 `captureStream`/`getImageData`가 실패할 수 있다.
- 배경 블러·LP·둥근 커버는 `prep()`에서 미리 그린다. 매 프레임 `ctx.filter = blur`를 하지 않는다. 구형 iOS의 필터 미지원 대체 처리를 유지한다.
- 녹화는 실시간이며 탭이 가려지면 rAF가 멈출 수 있다. 탭을 띄워 두고 핸드폰의 화면 잠금·앱 전환을 피하도록 안내한다.
- 시리즈 제목은 곡 전환 중 슬라이드하지 않는다. 곡 번호만 페이드한다.
- `refresh()` → `save()`로 0.4초 뒤 IndexedDB `shortform`/`s`/`draft`에 저장한다. 상태 변경 후 `refresh()`를 호출한다. 원본 파일은 `el.data.audio`/`cover`에 보관한다. 복원 중에는 `restoring`으로 저장을 막는다.
- 파일 이름 날짜는 로컬 기준 `toLocaleDateString('sv')`. UTC인 `toISOString()`으로 바꾸지 않는다.

## 검증

루트에서 `node tests/volume.cjs`, `node tests/visuals.cjs`, `node tests/titles.cjs`, `git diff --check`를 실행한다. 문서만 바꿀 때는 링크·수치·코드와의 일치를 확인한다.

녹화 변경 시 `node tests/recording.cjs`로 실제 MP4의 검정 첫 프레임·이후 음악 화면·전체 길이·탐색 색인·5초 seek도 검사한다. Chrome이 필요하며, 경로가 다르면 `CHROME_BIN`으로 지정한다. 임시 서버/프로필/녹화 파일을 만들고 테스트 소유 프로세스만 종료한다.

오디오·캔버스·녹화 변경은 실제 헤드리스 크롬으로도 확인한다. **원본이 아닌 임시 사본에** 가짜 곡·커버를 주입한다.

1. `</body>` 앞에 스크립트 주입. `OfflineAudioContext` 또는 `ac.createBuffer()`로 합성 곡을 만들어 `el.data.buf`에 넣는다. `OffscreenCanvas` → `createImageBitmap` → `prep()`으로 `el.data.vis`를 채우고 입력값을 넣어 `refresh()`한다.
2. 다운로드 링크의 `click()`을 사본에서만 덮어써 녹화 blob을 임시 로컬 Node 서버로 POST한다. `$('#rec').click()`으로 실제 녹화한다.
3. 크롬: `--headless=new --autoplay-policy=no-user-gesture-required --user-data-dir=<임시>`.
4. `ffprobe`로 코덱·해상도·길이, `ffmpeg -ss N -frames:v 1`로 프레임, `-af volumedetect`로 음량을 확인한다. 사용자 서버·브라우저를 종료하지 않는다.

## 튜닝 위치

- 패널: 크로스페이드, 시리즈 제목, 계정 이름.
- `C`/`CX`/`CY`: 커버 크기·위치.
- `spectrumTarget()`: -72~-12 dB, 지수 1.5, 높이 .9. `bands()`: 상승 .7·하강 .22.
- `fitTitle()`, `outroLayout()`: 제목 맞춤·목록 배치.
- 녹화: `videoBitsPerSecond: 12e6`, `audioBitsPerSecond: 256e3`, `captureStream(30)`.
