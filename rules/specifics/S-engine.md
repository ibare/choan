---
version: 1
last_verified: 2026-03-26
---

# WebGL/SDF 엔진 (S-engine)

## When to Apply
`src/engine/` 디렉터리의 코드를 수정하거나 WebGL/셰이더 관련 코드를 작성할 때

## MUST
- WebGL2 컨텍스트 획득 실패 시 명시적으로 throw한다
- 셰이더 컴파일/링크 실패 시 에러 로그를 포함하여 throw한다
- GPU 자원(버퍼, 텍스처, FBO)은 생성한 곳에서 해제 책임을 진다 — dispose 함수 제공 필수
- SDF 함수는 `engine/sdf.ts`에 집중한다 — 다른 파일에 산재시키지 않는다
- 셰이더 소스는 `engine/shaders.ts`에서 관리한다

## MUST NOT
- engine/ 모듈에서 React, Zustand 등 UI 레이어를 import하지 않는다
- WebGL 상태(blend mode, viewport 등)를 변경 후 복원하지 않는 코드를 작성하지 않는다
- 프레임 루프 안에서 GPU 자원을 매 프레임 생성/해제하지 않는다

## PREFER
- SDF 함수에 수학적 의미를 주석으로 기록한다
- 유니폼 이름은 셰이더와 JS 양쪽에서 일관되게 유지한다
