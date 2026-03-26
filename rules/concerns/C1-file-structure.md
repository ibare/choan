---
version: 1
last_verified: 2026-03-26
---

# 파일 구조 및 네이밍 (C1)

## When to Apply
새 파일 생성, 파일 이동, 파일 이름 변경 시

## MUST
- React 컴포넌트 파일은 PascalCase로 명명한다 (예: `SDFCanvas.tsx`, `LayerPanel.tsx`)
- 함수/유틸리티 파일은 camelCase로 명명한다 (예: `hitTest.ts`, `autoLayout.ts`)
- React 커스텀 훅 파일은 `use` 접두사 + camelCase로 명명한다 (예: `useSelectedElement.ts`)
- 타입 전용 파일은 `types.ts`로 명명한다
- 테스트 파일은 `src/__tests__/` 아래 원본 디렉터리 구조를 미러링하여 배치한다
- 기능별 디렉터리로 그룹화한다 (engine/, store/, animation/ 등)

## MUST NOT
- 하나의 파일에 서로 다른 관심사의 코드를 혼합하지 않는다 (예: 컴포넌트 파일에 스토어 로직)
- `src/` 외부에 소스 코드를 배치하지 않는다

## PREFER
- 핸들러 파일은 복수형으로 통일한다 (예: `dragHandlers.ts`)
- 한 파일이 300줄을 초과하면 분리를 검토한다
