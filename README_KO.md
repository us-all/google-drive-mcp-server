# Google Drive MCP Server

[English](./README.md)

**Google Workspace 인식 기능**을 갖춘 Google Drive용 Model Context Protocol (MCP) 서버입니다. 다른 Drive MCP 서버와 달리, 계정 타입을 자동 감지하여 공유 드라이브, 라벨, 승인 등 GWS 전용 기능을 활성화합니다.

## 주요 특징

| 기능 | 개인 계정 | GWS Standard+ | GWS Enterprise |
|------|-----------|---------------|----------------|
| 파일 CRUD, 검색, 내보내기 | ✅ | ✅ | ✅ |
| **Google Docs (13개 도구)** | ✅ | ✅ | ✅ |
| **Google Sheets (30개 도구)** | ✅ | ✅ | ✅ |
| **Google Slides (20개 도구)** | ✅ | ✅ | ✅ |
| 댓글 & 리비전 | ✅ | ✅ | ✅ |
| Drive 활동 이력 | ✅ | ✅ | ✅ |
| 콘텐츠 제한 | ✅ | ✅ | ✅ |
| **공유 드라이브** | — | ✅ | ✅ |
| **라벨 (분류)** | — | ✅ | ✅ |
| **승인** | — | ✅ | ✅ |
| **도메인 전체 위임** | — | ✅ | ✅ |

## 빠른 시작

### 방법 1: npx

```bash
# OAuth2 (개인 또는 GWS)
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... \
  npx @us-all/google-drive-mcp

# 서비스 계정 + 도메인 전체 위임 (GWS)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json GOOGLE_IMPERSONATE_USER=user@company.com \
  npx @us-all/google-drive-mcp
```

### 방법 2: Docker

```bash
docker run -i --env-file .env ghcr.io/us-all/google-drive-mcp-server
```

### 방법 3: 소스에서 빌드

```bash
git clone https://github.com/us-all/google-drive-mcp-server.git
cd google-drive-mcp-server
pnpm install
pnpm run build
pnpm start
```

## 설정

### 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_CLIENT_ID` | OAuth2 | OAuth2 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 | OAuth2 클라이언트 시크릿 |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 | OAuth2 리프레시 토큰 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | SA | 서비스 계정 JSON 키 파일 경로 |
| `GOOGLE_IMPERSONATE_USER` | 선택 | 가장할 GWS 사용자 이메일 (서비스 계정 전용) |
| `GOOGLE_DRIVE_ALLOW_WRITE` | 선택 | `true`로 설정 시 쓰기 작업 활성화. 기본값: `false` |
| `GOOGLE_DRIVE_SCOPES` | 선택 | 쉼표 구분 OAuth 스코프. 기본값: `drive.readonly` (쓰기 활성화 시 `drive`) |

### Claude Desktop 설정

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@us-all/google-drive-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```

### Claude Code 설정

```bash
claude mcp add google-drive -- npx -y @us-all/google-drive-mcp
```

## 도구 목록 (95개)

### Drive (24개 — 개인 + GWS)

| 도구 | 설명 | R/W |
|------|------|-----|
| `get-about` | 계정 정보, 스토리지 용량, 감지된 기능 확인 | R |
| `list-files` | 폴더 내 파일 목록 조회 | R |
| `get-file` | 파일 메타데이터 상세 조회 | R |
| `read-file` | 파일 내용 읽기 (Google Docs → Markdown, Sheets → CSV 자동 변환) | R |
| `create-file` | 새 파일 생성 | W |
| `update-file` | 파일 이름/내용 업데이트 | W |
| `copy-file` | 파일 복사 | W |
| `delete-file` | 파일 휴지통 이동 또는 영구 삭제 | W |
| `search-files` | Drive 쿼리 문법으로 전체 텍스트 및 메타데이터 검색 | R |
| `create-folder` | 폴더 생성 | W |
| `move-file` | 파일/폴더를 다른 폴더로 이동 | W |
| `get-folder-tree` | 폴더 계층 트리 조회 (깊이 1-5) | R |
| `list-permissions` | 파일 공유 권한 목록 | R |
| `share-file` | 사용자/그룹/도메인/전체 공유 | W |
| `remove-permission` | 공유 권한 제거 | W |
| `export-file` | Google Docs/Sheets/Slides를 PDF, DOCX, CSV 등으로 내보내기 | R |
| `get-download-link` | 다운로드 및 보기 링크 가져오기 | R |
| `list-comments` | 파일 댓글 목록 | R |
| `get-comment` | 댓글 상세 (답글 포함) | R |
| `create-comment` | 댓글 작성 | W |
| `resolve-comment` | 댓글 해결 처리 | W |
| `list-revisions` | 파일 리비전 이력 | R |
| `get-revision` | 특정 리비전 상세 | R |
| `get-activity` | 파일/폴더 활동 이력 (수정, 조회, 권한 변경) | R |

### Google Docs (13개)

**문서**

| 도구 | 설명 | R/W |
|------|------|-----|
| `docs-get-document` | 문서 메타데이터 — 제목, 리비전 ID, 탭 요약 | R |
| `docs-create-document` | 새 문서 생성 | W |
| `docs-get-content` | 문서 내용을 일반 텍스트 또는 인덱스 포함 구조화 JSON으로 읽기 | R |
| `docs-list-tabs` | 멀티탭 문서의 모든 탭 목록 (ID, 제목, 중첩 구조) | R |

**편집**

| 도구 | 설명 | R/W |
|------|------|-----|
| `docs-insert-text` | 특정 위치 또는 세그먼트 끝에 텍스트 삽입 | W |
| `docs-delete-range` | 인덱스 범위 내 콘텐츠 삭제 | W |
| `docs-replace-text` | 문서 전체 또는 특정 탭에서 텍스트 찾기 및 바꾸기 | W |
| `docs-batch-update` | 고급 작업을 위한 raw batchUpdate | W |

**서식**

| 도구 | 설명 | R/W |
|------|------|-----|
| `docs-format-text` | 볼드, 이탤릭, 밑줄, 취소선, 폰트, 크기, 색상, 링크 | W |
| `docs-format-paragraph` | 정렬, 제목 수준, 줄 간격, 들여쓰기, 단락 간격 | W |

**요소**

| 도구 | 설명 | R/W |
|------|------|-----|
| `docs-insert-table` | 행과 열을 지정하여 테이블 삽입 | W |
| `docs-insert-image` | URL에서 인라인 이미지 삽입 | W |
| `docs-insert-page-break` | 페이지 나누기 삽입 | W |

### Google Sheets (30개)

**데이터**

| 도구 | 설명 | R/W |
|------|------|-----|
| `sheets-get-spreadsheet` | 스프레드시트 메타데이터 — 제목, 로케일, 시트(탭) 목록 | R |
| `sheets-get-values` | A1 표기법으로 셀 값 읽기 | R |
| `sheets-batch-get-values` | 여러 범위를 한 번에 읽기 | R |
| `sheets-update-values` | 범위에 값 쓰기 | W |
| `sheets-batch-update-values` | 여러 범위에 한 번에 쓰기 | W |
| `sheets-append-values` | 테이블 끝에 행 추가 | W |
| `sheets-clear-values` | 범위의 값 초기화 | W |
| `sheets-batch-clear-values` | 여러 범위 한 번에 초기화 | W |
| `sheets-create-spreadsheet` | 새 스프레드시트 생성 | W |
| `sheets-manage-sheets` | 시트(탭) 추가, 삭제, 이름 변경 | W |

**구조 편집**

| 도구 | 설명 | R/W |
|------|------|-----|
| `sheets-insert-dimension` | 행 또는 열 삽입 | W |
| `sheets-delete-dimension` | 행 또는 열 삭제 | W |
| `sheets-duplicate-sheet` | 시트 복제 (같은 스프레드시트 내) | W |
| `sheets-copy-sheet-to` | 시트를 다른 스프레드시트로 복사 | W |
| `sheets-copy-paste` | 범위 복사/붙여넣기 (값, 서식, 수식 등 선택) | W |
| `sheets-sort-range` | 범위를 열 기준으로 정렬 | W |
| `sheets-find-replace` | 텍스트 찾기/바꾸기 (정규식 지원) | W |

**서식**

| 도구 | 설명 | R/W |
|------|------|-----|
| `sheets-format-cells` | 볼드, 이탤릭, 폰트, 색상, 정렬, 숫자 포맷 | W |
| `sheets-update-borders` | 범위에 테두리 설정 | W |
| `sheets-merge-cells` | 셀 병합 (전체, 열별, 행별) | W |
| `sheets-unmerge-cells` | 병합된 셀 해제 | W |
| `sheets-auto-resize` | 열 너비/행 높이 자동 맞춤 | W |
| `sheets-resize-dimensions` | 행 높이/열 너비 직접 지정 (픽셀) | W |

**고급**

| 도구 | 설명 | R/W |
|------|------|-----|
| `sheets-set-data-validation` | 드롭다운, 숫자 제약, 커스텀 수식 검증 | W |
| `sheets-add-conditional-format` | 조건부 서식 — 하이라이트 규칙, 색상 그라데이션 | W |
| `sheets-add-chart` | 차트 생성 (막대, 선, 열, 산점도 등) | W |
| `sheets-delete-chart` | 차트 삭제 | W |
| `sheets-add-protected-range` | 범위 보호 (편집자 제한) | W |
| `sheets-delete-protected-range` | 범위 보호 해제 | W |
| `sheets-manage-named-range` | 이름 범위 추가, 수정, 삭제 | W |

### Google Slides (20개)

**프레젠테이션**

| 도구 | 설명 | R/W |
|------|------|-----|
| `slides-get-presentation` | 프레젠테이션 메타데이터, 슬라이드 목록, 레이아웃 정보 조회 | R |
| `slides-create-presentation` | 새 프레젠테이션 생성 | W |
| `slides-duplicate-presentation` | 기존 프레젠테이션 복제 (Drive copy 활용) | W |

**슬라이드 관리**

| 도구 | 설명 | R/W |
|------|------|-----|
| `slides-get-slide` | 슬라이드 상세 조회 (모든 요소 포함) | R |
| `slides-add-slide` | 슬라이드 추가 (레이아웃 선택 가능) | W |
| `slides-delete-slide` | 슬라이드 삭제 | W |
| `slides-move-slide` | 슬라이드 순서 변경 | W |
| `slides-duplicate-slide` | 슬라이드 복제 | W |

**콘텐츠**

| 도구 | 설명 | R/W |
|------|------|-----|
| `slides-insert-text` | 기존 텍스트 상자에 텍스트 삽입 | W |
| `slides-replace-text` | 프레젠테이션 전체에서 텍스트 찾기/바꾸기 | W |
| `slides-insert-text-box` | 새 텍스트 상자 생성 및 텍스트 삽입 | W |
| `slides-insert-image` | URL 기반 이미지 삽입 | W |
| `slides-insert-table` | 테이블 생성 | W |
| `slides-update-table-cell` | 테이블 셀 텍스트 수정 | W |
| `slides-insert-shape` | 도형 삽입 (직사각형, 원 등) | W |

**서식**

| 도구 | 설명 | R/W |
|------|------|-----|
| `slides-format-text` | 텍스트 스타일 (폰트, 크기, 색상, 볼드, 이탤릭) | W |
| `slides-format-shape` | 도형 배경색 및 테두리 | W |
| `slides-resize-element` | 요소 크기 및 위치 변경 | W |
| `slides-set-slide-background` | 슬라이드 배경 색상 설정 | W |
| `slides-batch-update` | 고급 작업을 위한 Raw batchUpdate | W |

### GWS 전용 도구 (8개 — Google Workspace)

| 도구 | 설명 | R/W |
|------|------|-----|
| `list-shared-drives` | 접근 가능한 공유 드라이브 목록 | R |
| `get-shared-drive` | 공유 드라이브 상세 및 기능 확인 | R |
| `create-shared-drive` | 새 공유 드라이브 생성 | W |
| `list-file-labels` | 파일에 적용된 분류 라벨 목록 | R |
| `apply-label` | 파일에 라벨 적용 (필드 값 포함) | W |
| `remove-label` | 파일에서 라벨 제거 | W |
| `list-approvals` | 파일 승인 요청 목록 | R |
| `get-approval` | 승인 상세 및 검토자 응답 확인 | R |

## 아키텍처

```
Claude / AI 클라이언트
       │
       ▼ (MCP 프로토콜, stdio)
┌──────────────────────────────────────────────────┐
│  google-drive MCP Server                         │
│                                                  │
│  ┌────────────┐  ┌──────────────────────────┐    │
│  │ config.ts  │  │ capabilities.ts          │    │
│  │ (환경/인증) │  │ (개인 vs GWS 자동 감지)  │    │
│  └─────┬──────┘  └────────────┬─────────────┘    │
│        │                      │                  │
│  ┌─────▼──────────────────────▼─────────────┐    │
│  │              client.ts                   │    │
│  │  (OAuth2 / 서비스 계정 + 도메인 위임)     │    │
│  └─────────────────┬────────────────────────┘    │
│                    │                             │
│  ┌─────────────────▼─────────────────────────┐   │
│  │               tools/                      │   │
│  │  files · search · folders · permissions   │   │
│  │  export · comments · revisions · about    │   │
│  │  activity · docs · sheets · slides          │   │
│  │  shared-drives · labels · approvals       │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              Google Drive API v3
              Google Docs API v1
              Google Sheets API v4
              Google Slides API v1
              Drive Activity API v2
              Drive Labels API v2
```

## 인증 설정

### OAuth2 (개인 또는 GWS)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **Google Drive API**, **Google Docs API**, **Google Sheets API**, **Google Slides API** 활성화
3. OAuth2 사용자 인증 정보 생성 (데스크톱 앱 유형)
4. OAuth2 플레이그라운드 등을 사용하여 리프레시 토큰 획득
5. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` 설정

### 서비스 계정 (GWS 도메인 전체 위임)

1. Google Cloud Console에서 서비스 계정 생성
2. JSON 키 파일 다운로드
3. Google Workspace 관리 콘솔에서:
   - **보안 > API 제어 > 도메인 전체 위임**으로 이동
   - 서비스 계정의 클라이언트 ID 추가
   - 필요한 OAuth 스코프 부여
4. `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`와 `GOOGLE_IMPERSONATE_USER` 설정

## 쓰기 안전장치

모든 쓰기 작업(생성, 수정, 삭제, 공유)은 **기본적으로 비활성화**되어 있습니다. `GOOGLE_DRIVE_ALLOW_WRITE=true`로 설정하면 활성화됩니다. GWS 전용 도구는 개인 Google 계정으로 사용 시 명확한 오류 메시지를 반환합니다.

## 기술 스택

- **런타임**: Node.js 18+
- **언어**: TypeScript (strict 모드)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Google API**: `googleapis` (Drive API v3, Docs API v1, Sheets API v4, Slides API v1, Drive Activity API v2, Drive Labels API v2)
- **검증**: Zod
- **패키지 매니저**: pnpm
- **테스트**: Vitest

## 기여

[CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 라이선스

MIT
