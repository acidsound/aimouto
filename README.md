# AIMouto

## Overview

AIMouto is a 3D virtual sister chatbot that combines VRM (Virtual Reality Model) technology with Large Language Models (LLM) to create an interactive character capable of expressing emotions through facial expressions, animations, and speech.

## Features

### Character System
- Custom VRM model integration
- Real-time facial expressions and animations
- Eye tracking and camera following system
- Lip sync with speech output

### Emotion System
- Five distinct emotional states:
  - Neutral: Default state
  - Joy: Happy expressions
  - Angry: Upset expressions
  - Sorrow: Sad expressions
  - Fun: Playful expressions
- Dynamic emotion intensity control using [face:intensity:emotion] format
- Smooth animation transitions between emotional states

### Communication System
- Text-based input/output interface
- Text-to-Speech (TTS) integration
- Real-time lip synchronization
- Natural conversation flow with context awareness

## Technical Architecture

### Core Technologies
- Three.js for 3D rendering
- @pixiv/three-vrm for VRM model handling
- Web Speech API for TTS functionality
- Google's Gemini API for natural language processing
- OpenAI-compatible Chat Completions API (OpenRouter/Groq/Cerebras/OpenAI)
- Vercel for serverless backend deployment

### Backend Architecture (Vercel)
Vercel provides the serverless infrastructure for AIMouto's backend API:
- Automatic deployments from Git
- Serverless API endpoints in `/api` directory
- Zero-configuration edge network deployment
- Built-in development environment with `vercel dev`
- Seamless integration with frontend assets

### Project Structure
```
/aimouto
├── api/              # Backend API handlers
├── assets/           # Static assets
│   ├── anims/       # Animation files
│   └── models/      # VRM models
├── main.js          # Main application logic
├── loadMixamoAnimation.js  # Animation loader
└── mixamoVRMRigMap.js     # VRM rigging mappings
```

## Setup and Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and set your API keys:
   ```
   # Option A) OpenAI-compatible provider
   LLM_PROVIDER=openai_compat
   OPENAI_API_BASE=https://openrouter.ai/api/v1
   OPENAI_API_KEY=your_api_key
   OPENAI_MODEL=qwen/qwen3-32b

   # Option B) Gemini
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your_api_key
   GEMINI_MODEL_NAME=gemini-2.0-flash
   ```
3. Install dependencies:
   ```bash
   cd api
   npm install
   ```
4. Start the development server:
   ```bash
   vercel dev
   ```
   This will start the Vercel development environment for the backend API.
5. In a new terminal, serve the root directory with a web server

## LLM Provider Configuration

`/api/chat` supports two provider modes:
- `openai_compat`: OpenAI-compatible Chat Completions APIs (OpenRouter, Groq, Cerebras, OpenAI)
- `gemini`: Google Gemini API

Provider selection order:
1. If `LLM_PROVIDER` is set, that value is used.
2. If `LLM_PROVIDER` is not set and `OPENAI_API_KEY` exists, `openai_compat` is used.
3. Otherwise, `gemini` is used.

### OpenAI-Compatible Variables

Required:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Optional:
- `OPENAI_API_BASE` (default: `https://api.openai.com/v1`)
- `OPENAI_TEMPERATURE` (default: `0.8`)
- `OPENAI_TOP_P` (default: `1`)
- `OPENAI_MAX_TOKENS` (default: `1024`)
- `OPENAI_ENABLE_TOOLS` (default: `true`)
- `OPENAI_ENABLE_WEB_SEARCH` (default: `true`)
- `OPENAI_TOOL_MAX_ROUNDS` (default: `3`)
- `OPENAI_HTTP_REFERER` (useful for OpenRouter attribution)
- `OPENAI_X_TITLE` (useful for OpenRouter attribution)

### Tool Use and Search

When using `openai_compat`, `/api/chat` can expose a built-in tool named `search_web`.
- The model can call `search_web` automatically when it needs external/latest info.
- Search results are collected from DuckDuckGo + Wikipedia and returned to the model as tool output.
- If your provider/model does not support tool calls, the server automatically falls back to normal chat completion.

Recommended flags:
```env
OPENAI_ENABLE_TOOLS=true
OPENAI_ENABLE_WEB_SEARCH=true
OPENAI_TOOL_MAX_ROUNDS=3
```

Quick test prompt:
```text
오늘 기준으로 Qwen 최신 모델 라인업과 각 모델의 특징을 출처 링크와 함께 요약해줘.
```

### Provider Examples

OpenRouter:
```env
LLM_PROVIDER=openai_compat
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=your_openrouter_key
OPENAI_MODEL=qwen/qwen3-32b
OPENAI_ENABLE_TOOLS=true
OPENAI_ENABLE_WEB_SEARCH=true
OPENAI_TOOL_MAX_ROUNDS=3
OPENAI_HTTP_REFERER=http://localhost:33000
OPENAI_X_TITLE=AIMouto
```

Groq:
```env
LLM_PROVIDER=openai_compat
OPENAI_API_BASE=https://api.groq.com/openai/v1
OPENAI_API_KEY=your_groq_key
OPENAI_MODEL=qwen/qwen3-32b
```

Cerebras:
```env
LLM_PROVIDER=openai_compat
OPENAI_API_BASE=https://api.cerebras.ai/v1
OPENAI_API_KEY=your_cerebras_key
OPENAI_MODEL=qwen-3-32b
```

OpenAI:
```env
LLM_PROVIDER=openai_compat
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
```

Gemini:
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_NAME=gemini-2.0-flash
```

### API Request Example (`/api/chat`)

The frontend sends `dialogs` in this format:

```json
{
  "dialogs": [
    { "role": "user", "parts": [{ "text": "You are my sister chatbot..." }] },
    { "role": "model", "parts": [{ "text": "[face:1:Joy] Hi!" }] },
    { "role": "user", "parts": [{ "text": "오늘 어땠어?" }] }
  ]
}
```

Expected response:

```json
{
  "message": "[face:0.7:Joy] 오늘은 정말 즐거웠어!"
}
```

## LLM Provider Configuration (한국어)

`/api/chat`은 두 가지 모드를 지원합니다.
- `openai_compat`: OpenAI 호환 Chat Completions API (OpenRouter, Groq, Cerebras, OpenAI 등)
- `gemini`: Google Gemini API

선택 우선순위:
1. `LLM_PROVIDER`가 설정되어 있으면 해당 값을 사용
2. `LLM_PROVIDER`가 없고 `OPENAI_API_KEY`가 있으면 `openai_compat` 사용
3. 그 외에는 `gemini` 사용

OpenAI 호환 모드 필수 값:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

OpenAI 호환 모드 선택 값:
- `OPENAI_API_BASE` (기본값: `https://api.openai.com/v1`)
- `OPENAI_TEMPERATURE` (기본값: `0.8`)
- `OPENAI_TOP_P` (기본값: `1`)
- `OPENAI_MAX_TOKENS` (기본값: `1024`)
- `OPENAI_ENABLE_TOOLS` (기본값: `true`)
- `OPENAI_ENABLE_WEB_SEARCH` (기본값: `true`)
- `OPENAI_TOOL_MAX_ROUNDS` (기본값: `3`)
- `OPENAI_HTTP_REFERER`, `OPENAI_X_TITLE` (OpenRouter 사용 시 권장)

도구 호출/검색 기능:
- `openai_compat` 모드에서 `search_web` 도구를 자동 호출할 수 있습니다.
- 검색 결과는 DuckDuckGo + Wikipedia 기반으로 수집되어 모델에게 전달됩니다.
- 사용 중인 provider/model이 tool call을 지원하지 않으면 일반 채팅 모드로 자동 폴백합니다.

빠른 설정 예시:

```env
# OpenRouter
LLM_PROVIDER=openai_compat
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=your_openrouter_key
OPENAI_MODEL=qwen/qwen3-32b
OPENAI_ENABLE_TOOLS=true
OPENAI_ENABLE_WEB_SEARCH=true
OPENAI_TOOL_MAX_ROUNDS=3
OPENAI_HTTP_REFERER=http://localhost:33000
OPENAI_X_TITLE=AIMouto
```

```env
# Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL_NAME=gemini-2.0-flash
```

## Development Status

### Completed
- [x] VRM model creation and import
- [x] Emotion types and weight implementation
- [x] Neutral idle animation
- [x] Text input/output integration
- [x] TTS implementation
- [x] Basic lip sync during speech

### In Progress
- [ ] Camera gaze following
- [ ] Voice synthesis output
- [ ] Advanced voice synthesis model integration

## License

MTI License
