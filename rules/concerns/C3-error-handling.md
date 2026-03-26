---
version: 1
last_verified: 2026-03-26
---

# 에러 처리 (C3)

## When to Apply
try/catch 작성, 외부 API 호출, WebGL 연산, JSON 파싱, localStorage 접근 시

## MUST
- 필수 시스템(WebGL 초기화, 셰이더 컴파일)은 실패 시 명시적으로 throw한다
- JSON.parse 호출은 반드시 try/catch로 감싼다
- catch 블록에서 에러를 삼키지 않는다 — 최소한 console.error로 기록하거나, 의도적 무시라면 주석으로 사유를 명시한다

## MUST NOT
- 빈 catch 블록을 작성하지 않는다 (의도적 무시도 주석 필수)
- 필수 기능의 에러를 조용히 무시하지 않는다

## PREFER
- 비필수 기능(analytics, localStorage 백업)은 조용한 실패를 허용한다
- optional chaining(?.)으로 null 안전성을 확보한다
