# ADR 0004: 녹화 형식은 MediaRecorder mp4 우선

- 상태: 채택 · 2026-11-16

## 결정
- `canvas.captureStream(30)` 영상 트랙 + `MediaStreamDestination` 오디오 트랙 → `MediaRecorder`.
- 형식 우선순위: `video/mp4;codecs=avc1.640028,mp4a.40.2` → `video/mp4` → webm(vp9/opus) → webm.
- 영상 12Mbps, 오디오 256kbps.
- 정지 버튼은 녹화 취소(파일 저장 안 함).

## 결과
- 최신 크롬은 H.264/AAC mp4를 바로 저장(헤드리스에서 확인). webm이 나오면 ffmpeg로 변환: `ffmpeg -i in.webm -c:v libx264 -c:a aac out.mp4`.
- 업로드 플랫폼 호환은 실기 미확인.

## 후속 보완

갤럭시에서 길이가 3초로 표시되고 탐색이 제한되는 사례를 확인했다. [ADR 0007](0007-finalize-recording-on-stop.md)에 따라 `start()`에 timeslice를 지정하지 않고 `stop()`에서 전체 파일을 확정한다. MP4 우선 형식은 유지한다.
