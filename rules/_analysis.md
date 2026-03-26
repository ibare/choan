## 프로젝트 구조 분석

### 기본 정보
- 언어: TypeScript (strict mode, ES2023)
- 주요 프레임워크/라이브러리: React 19, Vite 8, Zustand 5, XState 5, Radix UI, Framer Motion, CVA
- 모노레포 여부: 아니오 (단일 패키지)
- 빌드 시스템: Vite 8
- 테스트 프레임워크: Vitest 4.1
- 사용 중인 정적 분석 도구: ESLint v9 (flat config) + typescript-eslint + react-hooks, TypeScript strict mode

### 규모
- 소스 파일 수: ~141개 (.ts/.tsx)
- 대략적 코드 라인 수: ~15,600줄 (TypeScript) + ~1,900줄 (CSS)
- DB 모델/테이블 수: 해당 없음 (클라이언트 전용)
- API 엔드포인트 수: 해당 없음 (클라이언트 전용)

### 핵심 도메인
1. **캔버스 및 렌더링** (`engine/`, `canvas/`, `rendering/`): WebGL2 SDF 엔진, 2패스 렌더링, 툰 셰이딩
2. **상호작용** (`interaction/`): 포인터/키보드 입력 → 캔버스 도구 변환
3. **상태 관리** (`store/`): Zustand 다중 스토어 (Element, Animation, UI) + 어댑터
4. **애니메이션** (`animation/`): 키프레임 기반, 트리거(click/hover) 실행
5. **내보내기** (`export/`): LLM용 마크다운/YAML 직렬화
6. **레이아웃** (`layout/`): Flexbox 유사 자동 레이아웃
7. **UI 컴포넌트** (`components/`, `panels/`): Radix UI 래퍼 + 에디터 패널

---

## 발견된 공통 패턴 (좋은 패턴)

### 아키텍처
- 엔진 → 스토어 → UI 계층이 명확하게 분리됨
- 의존성 방향이 일관적 (상위가 하위를 import, 역방향 없음)

### 상태 관리
- Zustand 다중 스토어 + 어댑터 패턴 (useChoanStore가 3개 스토어 조합)
- 크로스 스토어 작업을 모듈 함수로 처리 (removeElement → element + animation 동시 정리)
- Zustand 구독자로 자동 저장/히스토리 구현
- 불변 업데이트 패턴 일관 적용
- 선택 훅으로 렌더링 최적화 (useSelectedElement)

### UI 컴포넌트
- Radix UI 원시 → CVA + clsx 래퍼 패턴 일관 적용
- `ui-` 접두사 BEM 유사 클래스 네이밍 (ui-btn, ui-btn--primary 등)
- 명확한 Props 인터페이스 정의

### 에러 처리
- 비필수 기능은 조용한 실패 (localStorage, analytics)
- 필수 시스템은 명시적 throw (WebGL 초기화, 셰이더 컴파일)

### 파일 네이밍
- PascalCase: 컴포넌트 (Button.tsx, SDFCanvas.tsx)
- camelCase: 함수/유틸 (dragHandlers.ts, snapUtils.ts)
- camelCase: 훅 (useSelectedElement.ts)

---

## 발견된 안티패턴

### Ref 폭발
- `useAnimateLoop`에 15개+ 개별 ref를 매개변수로 전달
- 파일: `src/rendering/useAnimateLoop.ts`

### 모듈 수준 가변 상태
- `history.ts`: snapshots, undoIndex, debounceTimer를 모듈 스코프 let으로 관리
- `persistence.ts`: debounceTimer를 모듈 스코프 let으로 관리
- Zustand 스토어로 통합하거나 클래스로 캡슐화하는 것이 바람직

### 디자인 시스템 불완전
- `design-system/index.ts`에 cn() 함수만 존재
- 색상, 타이포그래피, 간격 등의 통합 정의 부족

### 매직 넘버
- 패널 크기 (180, 160, 260, 80, 600) 등이 곳곳에 하드코딩

### 파일 네이밍 불일관
- 핸들러 파일: 복수형 (dragHandlers.ts) vs 단수형 (hotkeyRegistry.ts) 혼재

### 에러 처리 누락
- history.ts의 restoreSnapshot(): JSON.parse 실패 시 처리 부재

---

## 정적 분석 현황

### 적용됨
| 도구 | 커버 영역 |
|------|-----------|
| ESLint v9 + typescript-eslint | JS/TS 권장 규칙, 타입 안전성 |
| eslint-plugin-react-hooks | React Hooks 의존성 검사 |
| eslint-plugin-react-refresh | Vite React Refresh 호환성 |
| TypeScript strict mode | 타입 검사, 미사용 변수/파라미터, fall-through |

### 미적용
| 도구 | 비고 |
|------|------|
| Prettier | 코드 포맷팅 자동화 없음 |
| Husky/lint-staged | 커밋 전 자동 검사 없음 |
| stylelint | CSS 린팅 없음 |
| .editorconfig | 에디터 표준화 없음 |

### Rules에서 커버할 영역 (정적 분석으로 커버 불가)
- 의존성 방향 및 계층 위반
- 컴포넌트/모듈 책임 분리
- 공유 인스턴스 관리 (싱글턴 패턴 준수)
- 설정/상수 중앙 관리
- Radix UI 래퍼 패턴 준수
- 상태 관리 패턴 (Zustand 스토어 사용 규칙)
- WebGL/SDF 엔진 코드 안전성
- 내보내기 출력 형식 일관성
