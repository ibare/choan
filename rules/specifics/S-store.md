---
version: 1
last_verified: 2026-03-26
---

# 상태 관리 (S-store)

## When to Apply
`src/store/` 디렉터리의 코드를 수정하거나 Zustand 스토어를 사용할 때

## MUST
- 스토어 상태 업데이트는 항상 불변(immutable)으로 수행한다 — spread 연산자 또는 map/filter 사용
- 크로스 스토어 작업(2개 이상 스토어 동시 변경)은 `useChoanStore.ts`의 모듈 함수로 작성한다
- 새로운 관심사의 상태는 별도 스토어로 분리한다 (Element, Animation, UI 패턴 준수)
- 스토어 액션에 명확한 이름을 사용한다 (add/update/remove + 대상)

## MUST NOT
- 컴포넌트 내부에서 `getState()`로 직접 상태를 변경하지 않는다 — 스토어 액션을 통해서만 변경한다
- 스토어 외부(모듈 스코프 let 변수)에서 앱 상태를 관리하지 않는다
- set() 콜백 내에서 기존 상태 객체를 직접 변경(mutate)하지 않는다

## PREFER
- 셀렉터 훅(useSelectedElement 등)으로 필요한 상태만 구독한다
- 구독(subscribe) 기반 부수효과(자동 저장, 히스토리)는 별도 모듈로 분리한다

**Exception**: `history.ts`, `persistence.ts`의 모듈 스코프 변수는 Zustand 구독 메커니즘과 타이머 관리를 위한 의도적 설계. 스토어 외부 상태 금지 원칙의 예외.
