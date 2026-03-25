# Google Drive MCP Server

[English](./README.md)

**Google Workspace 인식 기능**을 갖춘 Google Drive용 Model Context Protocol (MCP) 서버입니다. 다른 Drive MCP 서버와 달리, 계정 타입을 자동 감지하여 공유 드라이브, 라벨, 승인 등 GWS 전용 기능을 활성화합니다.

## 주요 특징

| 기능 | 개인 계정 | GWS Standard+ | GWS Enterprise |
|------|-----------|---------------|----------------|
| 파일 CRUD, 검색, 내보내기 | ✅ | ✅ | ✅ |
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

## 도구 목록 (30개)

### 공통 도구 (개인 + GWS)

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

### GWS 전용 도구 (Google Workspace)

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
│  │  activity · shared-drives · labels        │   │
│  │  approvals                                │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              Google Drive API v3
              Drive Activity API v2
              Drive Labels API v2
```

## 인증 설정

### OAuth2 (개인 또는 GWS)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **Google Drive API** 활성화
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
- **Google API**: `googleapis` (Drive API v3, Drive Activity API v2, Drive Labels API v2)
- **검증**: Zod
- **패키지 매니저**: pnpm
- **테스트**: Vitest

## 기여

[CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 라이선스

MIT
