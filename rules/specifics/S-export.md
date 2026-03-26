---
version: 1
last_verified: 2026-03-26
---

# 내보내기 시스템 (S-export)

## When to Apply
`src/export/` 디렉터리의 코드를 수정하거나 마크다운/YAML 출력을 변경할 때

## MUST
- 내보내기 파이프라인 구조를 유지한다: `core/`(트리 빌드) → `render/`(렌더링) → `platforms/`(플랫폼별 출력)
- 새 플랫폼 출력을 추가할 때 `platforms/base.ts`를 확장한다
- 출력 형식 변경 시 `__tests__/export/` 스냅샷 테스트를 갱신한다
- 요소 직렬화 순서는 z-index 기반으로 일관되게 유지한다

## MUST NOT
- 렌더링 로직을 core/ 빌드 단계에 혼합하지 않는다
- 플랫폼별 분기를 render/ 공통 렌더링에 직접 넣지 않는다 — platforms/에서 처리한다
- 테스트 스냅샷 갱신 없이 출력 형식을 변경하지 않는다

## PREFER
- 새 요소 타입 추가 시 마크다운과 YAML 출력 모두를 고려한다
- 피처 테스트에서 실제 요소 구성으로 end-to-end 출력을 검증한다
