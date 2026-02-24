// Sync English PROJECT_CONTEXT.md to Korean PROJECT_CONTEXT_KR.md
// This is a best-effort sync that translates section headings from EN to KR
// and leaves content as-is for review.
const fs = require('fs');
const path = require('path');

const enPath = path.resolve(__dirname, '../PROJECT_CONTEXT.md');
const krPath = path.resolve(__dirname, '../PROJECT_CONTEXT_KR.md');

function translateLine(line) {
  const map = {
    '1) Project at a glance': '1) 프로젝트 개요',
    '2) Tech stack (high level)': '2) 기술 스택(상위 수준)',
    '3) Architecture overview': '3) 아키텍처 개요',
    '4) Repository layout (key paths)': '4) 저장소 구조(핵심 경로)',
    '5) Coding conventions': '5) 코딩 규칙',
    '6) Environment & tooling': '6) 환경 및 도구',
    '7) Testing strategy': '7) 테스트 전략',
    '8) Build, run, and deployment': '8) 빌드, 실행 및 배포',
    '9) API contracts (summary)': '9) API 계약(요약)',
    '10) Data model overview': '10) 데이터 모델 개요',
    '11) Agent workflows (guidance for conversations)': '11) 에이전트 워크플로우(대화 가이드)',
    '12) Onboarding notes for new conversations': '12) 신규 대화 온보딩 노트',
    '13) Glossary (key terms)': '13) 용어집',
    '14) Change history (optional)': '14) 변경 이력(선택 사항)',
    'Appendix A: Example API sketch (JSON)': '부록 A: 예시 API 스케치(JSON)',
    'Appendix B: Naming conventions (quick reference)': '부록 B: 명명 규칙(빠른 참고)'
  };
  return map[line.trim()] ? line.replace(line.trim(), map[line.trim()]) : line;
}

function sync() {
  if (!fs.existsSync(enPath)) {
    console.error('English PROJECT_CONTEXT.md not found at', enPath);
    process.exit(1);
  }
  const en = fs.readFileSync(enPath, 'utf8');
  const kr = [];
  const lines = en.split(/\r?\n/);
  for (const raw of lines) {
    const translated = translateLine(raw);
    kr.push(translated);
  }
  // Write to KR path
  fs.writeFileSync(krPath, kr.join('\n'));
  console.log('Synchronized KR context from EN to KR at', krPath);
}

if (require.main === module) {
  sync();
}
