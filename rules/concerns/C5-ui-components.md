---
version: 1
last_verified: 2026-03-26
---

# UI 컴포넌트 패턴 (C5)

## When to Apply
React 컴포넌트를 생성하거나 수정할 때, Radix UI 프리미티브를 사용할 때

## MUST
- Radix UI 프리미티브는 `components/ui/` 래퍼를 통해 사용한다 — 직접 import 금지
- UI 컴포넌트 클래스명은 `ui-` 접두사를 사용한다 (예: `ui-btn`, `ui-slider`)
- 컴포넌트 변형(variant)은 CVA(Class Variance Authority)로 관리한다
- className 조합은 `cn()` 유틸리티를 사용한다

## MUST NOT
- Radix UI 프리미티브를 `components/ui/` 래퍼 없이 직접 사용하지 않는다
- 인라인 스타일로 래퍼가 이미 제공하는 스타일링을 덮어쓰지 않는다
- 새로운 CSS 클래스 접두사 컨벤션을 도입하지 않는다 (`ui-` 접두사 유지)

## PREFER
- 컴포넌트에 명시적 Props 인터페이스를 정의한다
- forwardRef를 사용하여 ref 접근을 지원한다
