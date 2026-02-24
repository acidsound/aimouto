# PROJECT_CONTEXT

This document provides the operational context for coding agents working on this repository. It is intended to be read at the start of a new Conversation to understand the project quickly, navigate the codebase, and make informed suggestions.

Repository: aimouto
Primary language: JavaScript/HTML
Primary framework(s): Three.js, Pixiv Three VRM, Web Speech API, Vercel serverless functions
Primary DB / Storage: None (static assets, environment variables)
Key services / packages: api/, assets/, main.js, loadMixamoAnimation.js, mixamoVRMRigMap.js
Owner / maintainers: acidsound

1) 프로젝트 개요
- Purpose: Interactive 3D VRM avatar driven by LLM-based dialogue via Gemini integration.
- Scope: Frontend rendering, 3D animation, speech synthesis, and Gemini-backed chat API; backend is serverless on Vercel.
- Success criteria: Working 3D avatar with emotion-driven expressions, responsive chat via /api/chat, and deployment in Vercel.

2) 기술 스택(상위 수준)
- Frontend: Vanilla JavaScript, Three.js, Pixiv Three VRM, Web Speech API
- Backend: Node.js serverless functions on Vercel; Gemini integration via Google Generative AI
- API/Interface layer: REST-like /api/chat for chat/dialogs
- Data / storage: Static assets (models, animations) under assets/; environment variables for API keys
- Testing / QA: None currently
- CI/CD / deployment: Vercel (automatic deployments from Git)

3) 아키텍처 개요
- High-level structure: Client renders a VRM avatar in a canvas; user talks or types; backend /api/chat returns model text; client maps returned text to emotions/animations; TTS plays the response.
- Major modules and responsibilities:
  - main.js: 3D scene setup, VRM loading, speech, and UI bindings
  - loadMixamoAnimation.js: Converts Mixamo FBX to VRM-compatible animation
  - mixamoVRMRigMap.js: Bone name mappings for retargeting
  - assets/: VRM models and animations
  - api/chat.js: Gemini integration for chat responses
- Data flow sequence (text):
  1. User action in UI (type or speak) -> /api/chat call
  2. Backend API -> Gemini generates response
  3. Client parses response into emotions and text; synthesize speech and animate
  4. Response rendered in UI and avatar speaks

4) 저장소 구조(핵심 경로)
- index.html
- main.js
- loadMixamoAnimation.js
- mixamoVRMRigMap.js
- api/chat.js
- assets/ (models/, anims/)
- README.md

5) 코딩 규칙
- Language / style: standard JavaScript (no strict framework); linting if available in project
- Typing / contracts: none currently (JavaScript dynamic typing); consider adding JSDoc or TypeScript later
- Commit messages: format and keywords (feat, fix, docs, chore, refactor)
- Branch naming: feature/bugfix/experimental + short descriptor
- PR process: basic review with checks; merge policy TBD

6) 환경 및 도구
- Local toolchain versions: Node.js >= 18 (as noted in code comments)
- Package managers: npm (default in api/)
- Core tools: lint, test, build, type-check (as applicable)
- Environment variables naming conventions: GEMINI_API_KEY, GEMINI_MODEL_NAME

7) 테스트 전략
- Test types: none implemented
- How to run tests locally: N/A
- Coverage: N/A
- How to run a subset of tests or specific suites: N/A

8) 빌드, 실행 및 배포
- Local dev server start: vercel dev
- Build steps: Vercel builds backend and frontend assets; static assets served
- Deployment workflow: automatic deployments on git push to main on Vercel
- Rollback / hotfix considerations: rely on Vercel deployment controls

9) API 계약(요약)
- Base URL: /api/chat (serverless function)
- Core endpoints: POST /api/chat
- Request/response shapes (DTOs):
  Request: { dialogs: Array<{ role: string, parts: [{ text: string }] }> }
  Response: { message: string }
- Authentication/authorization: GEMINI_API_KEY required via env vars

10) 데이터 모델 개요
- Core entities: none persisted in DB; VRM model, animation clips, dialog history in memory on client
- Key indexes / constraints: N/A
- Important schemas: request/response shapes above

11) 에이전트 워크플로우(대화 가이드)
- How agents should frame questions, propose actions, and report findings: ask clarifying questions when repo details are missing; propose concrete next steps and changes; reference code sections when explaining
- Safety checks: avoid exposing secrets; verify environment readiness before invoking Gemini
- Defer to human decision if ambiguous or risky actions required

12) 신규 대화 온보딩 노트
- Quick-start checklist: read index.html and main.js, inspect api/chat.js for Gemini integration; verify GEMINI_API_KEY presence
- How to reference code regions, docs, and tests: use file paths and function names from api/ and root
- Expected artifacts after exploration: a populated PROJECT_CONTEXT.md with concrete values

13) 용어집
- VRM: Virtual Reality Model format used by three.js/VRM tooling
- Three.js: 3D rendering library
- Gemini: Google Generative AI / Gemini model used for chat
- FBX: 3D animation file format
- ver cel dev: Vercel development server and deployment
- ENV vars: GEMINI_API_KEY, GEMINI_MODEL_NAME

14) 변경 이력(선택 사항)
- Versioned notes about changes to this document

부록 A: 예시 API 스케치(JSON)
{
  "endpoint": "/api/chat",
  "method": "POST",
  "description": "Gemini를 이용한 AIMouto 채팅",
  "request": { "dialogs": [] },
  "response": { "message": "string" }
}

부록 B: 명명 규칙(빠른 참고)
- Files: kebab-case or PascalCase
- Functions: camelCase
- Types/Interfaces: PascalCase

Usage notes
- Replace placeholders with actual values after you have scanned the repository.
- If you want me to tailor this to your repo, I can read the codebase (with explicit authorization or provided access) and produce a fully populated PROJECT_CONTEXT.md.
- For future Conversations, you can reference this document to guide agent behavior, questions, and search scopes.

Next steps
- Use this as a living document and update after repository introspection to reflect concrete details.

- 영어 버전과의 동기화 여부
- 이 문서를 한국어로 유지할지, 아니면 영어 버전과 병행할지 선택해 주세요.
