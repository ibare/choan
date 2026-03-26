---
version: 1
last_verified: 2026-03-26
---

# 공유 자원 관리 (C2)

## When to Apply
WebGL 렌더러, 좌표 시스템, 캔버스 컨텍스트 등 공유 인스턴스를 사용하거나 생성할 때

## MUST
- WebGL 렌더러(`SDFRenderer`)는 `SDFCanvas`에서 한 번 생성하고 ref로 공유한다
- 좌표 변환은 `coords/coordinateSystem.ts`의 함수를 사용한다
- 자동 저장/히스토리는 `persistence.ts`/`history.ts`의 구독 메커니즘을 사용한다
- requestAnimationFrame 루프는 `useAnimateLoop` 단일 엔트리포인트를 사용한다

## MUST NOT
- 이미 싱글톤으로 관리되는 인스턴스를 별도로 생성하지 않는다
- WebGL 컨텍스트를 여러 곳에서 독립적으로 획득하지 않는다
- rAF 루프를 여러 곳에서 독립적으로 실행하지 않는다

## PREFER
- 공유 자원의 생명주기(생성/해제)를 명확히 관리한다
- dispose/cleanup 함수를 반드시 제공한다
