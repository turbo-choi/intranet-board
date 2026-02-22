# Corporate Integrated Board System

사내 통합 게시판 시스템(공지/자유/자료실/Q&A + 관리자 콘솔) 구현본입니다.

- Frontend: Next.js + TypeScript + Tailwindcss (shadcn/ui 스타일 컴포넌트)
- Backend: FastAPI + Pydantic + SQLModel + sqlite

## 1) 프로젝트 구조

```bash
.
├── backend
│   ├── app
│   │   ├── api/routes
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   └── schemas
│   ├── scripts/init_seed.py
│   └── requirements.txt
├── frontend
│   ├── src/app
│   ├── src/components
│   ├── src/hooks
│   └── src/lib
└── design_sample
```

## 2) 백엔드 실행

### 2-1. 설치

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2-2. DB 초기화 + 시드

```bash
PYTHONPATH=. python scripts/init_seed.py
```

시드 항목:
- 기본 역할: `ADMIN`, `MANAGER`, `USER`
- 기본 게시판 4개: `Notice`, `Free Board`, `Library`, `Q&A`
- 기본 메뉴: 게시판 4개 + 관리 카테고리/관리 메뉴
  - 카테고리: `Menu`, `Management`
  - 관리 메뉴: `Board Management`, `Menu Management`, `Member Management`, `Role Management`
- 기본 관리자 계정: `admin / admin1234`
- 테스트 회원 5명: `testuser1` ~ `testuser5` (비밀번호: `test1234`)
- 테스트 게시글: 테스트 회원별 10개씩 자동 생성 (총 50개, 재실행 시 부족분만 보충)

### 2-3. 서버 실행

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 3) 프론트엔드 실행

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

기본 URL: `http://localhost:3000`

## 4) 환경변수

### Backend (`backend/.env`)

- `JWT_SECRET`: JWT 서명 키
- `UPLOAD_DIR`: 첨부파일 저장 디렉터리
- `CORS_ORIGINS`: 프론트 오리진(쉼표 구분)
- `ACCESS_TOKEN_MINUTES`: Access Token 만료(기본 30)
- `REFRESH_TOKEN_DAYS`: Refresh Token 만료(기본 7)
- `DATABASE_URL`: sqlite 경로 (예: `sqlite:///./app.db`)

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL`: API 서버 주소 (기본 `http://localhost:8000`)

## 5) 주요 기능

- JWT 로그인 (`POST /api/auth/login`) + 회원가입 (`POST /api/auth/register`) + 내정보 (`GET /api/auth/me`) + refresh/logout
- RBAC (`ADMIN/MANAGER/USER`) + 게시판별 `read_roles`/`write_roles`
- 관리자 콘솔:
  - 게시판 관리(생성/수정/비활성화, 게시판 유형 `GENERAL/Q&A` 설정)
  - 메뉴 관리(CRUD + 순서 저장 + 카테고리 생성/삭제 + 메뉴-카테고리 연결 + Lucide 아이콘 선택)
    - 관리 메뉴(예: 메뉴관리/멤버관리/권한관리)도 하드코딩이 아니라 메뉴 데이터로 관리
  - 회원 검색/권한 변경/잠금
  - 역할·권한 매트릭스(시스템 권한 + 게시판 read/write)
- 게시글 CRUD(소프트 삭제), 조회수, 공지 고정(`is_pinned`)
  - 공지 고정은 `ADMIN/MANAGER`만 가능(서버 권한 강제)
  - 조회수는 동일 사용자/게시글의 짧은 시간 중복 호출 시 중복 증가 방지(실사용 1클릭 1증가 보정)
- 좋아요 토글(`POST /api/posts/{post_id}/like`) + 게시글 좋아요 수
- Q&A 상태(`OPEN/IN_PROGRESS/ANSWERED`) 표시/수정
  - `board_type=Q&A` 게시판에서만 상태 필터/입력/수정 UI 표시
- 댓글 CRUD(작성자/관리자 수정·삭제) + 목록 댓글 수 표시
- 첨부 업로드/다운로드(multipart, 로컬 저장, 메타 DB 저장)
- 검색/필터/정렬/페이지네이션
- 사이드바 카테고리 접기/펼치기(상태 로컬 저장), 카테고리/하위 메뉴 들여쓰기 표시
- 데스크톱 사이드바 축소(아이콘만 표시) + 모바일 오버레이 메뉴
- 메뉴 전환/콘텐츠 페이드 애니메이션
- 저장/삭제 성공 토스트 알림
- 다크/라이트 테마 토글

## 6) 메뉴 카테고리 삭제 정책

- 카테고리(`path="__category__"`)는 실제 삭제(hard delete)
- 단, 하위 메뉴가 하나라도 연결되어 있으면 삭제 차단
  - 응답: `409` / `"사용중이라 삭제할 수 없습니다."`
- 일반 메뉴 삭제는 `is_active=false` 비활성화(소프트 삭제)

## 7) 프론트 라우팅

- `/login`, `/signup`, `/dashboard`
- `/boards/[boardId]`
- `/boards/[boardId]/posts/new`
- `/boards/[boardId]/posts/[postId]`
- `/admin/boards`
- `/admin/menus`
- `/admin/users`
- `/admin/roles`

## 8) 기본 보안 정책

- Access Token 30분 + Refresh Token 7일
- 첨부 확장자 화이트리스트 + 파일당 20MB 제한
- 소프트 삭제 데이터는 일반 사용자에서 숨김(관리자 조회 가능)

## 9) 빠른 점검 순서

1. 백엔드 기동 후 `http://localhost:8000/docs` 확인
2. 프론트 `http://localhost:3000/login` 접속
3. `admin / admin1234` 로그인
4. 게시판 작성/댓글/첨부/관리자 콘솔 기능 점검
5. `/admin/menus`에서 카테고리 생성/연결/삭제 정책(사용중 삭제 차단) 확인

## 10) 메뉴 아이콘 확장 방법

- 아이콘 레지스트리 파일: `frontend/src/lib/menu-icons.ts`
- 현재 제공 옵션: `MENU_ICON_OPTIONS` 배열의 항목(관리자 메뉴관리 화면에서 선택 가능)
- 새 아이콘 추가 절차:
  1. `lucide-react`에서 원하는 아이콘을 import
  2. `menuIconMap`에 아이콘 이름-컴포넌트 매핑 추가
  3. `MENU_ICON_OPTIONS`에 같은 키 문자열 추가
  4. 프론트 재시작 후 `/admin/menus`에서 선택 가능

## 11) 트러블슈팅

- `ModuleNotFoundError: No module named 'sqlmodel'`
  1. `cd backend`
  2. `source .venv/bin/activate`
  3. `pip install -r requirements.txt`
