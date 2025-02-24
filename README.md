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
