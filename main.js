import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation.js';
let audioContext;
window.addEventListener('load', init, false);
function init() {
  try {
    audioContext = new AudioContext();
  }
  catch (e) {
    alert('Web Audio API is not supported in this browser');
  }
}
// Remove duplicate declaration since currentTimeoutId is already declared later
const animations = {
  "Angry": { url: "Angry.fbx" },
  "Neutral": { url: "Neutral_Idle.fbx" },
  "Joy": { url: "Happy.fbx" },
  "Sorrow": { url: "Sad_Idle.fbx" },
  "Fun": { url: "Laughing.fbx" },
  "Idle": { url: "Standing_Idle.fbx" },
}
const DEFAULT_ANIMATION = "Neutral";

const synth = window.speechSynthesis;
let voices = [];

const params = {
  timeScale: 1.0,
  blinkLeft: 0,
  blinkRight: 0,
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0,
};

function populateVoices() {
  voices = synth.getVoices().sort(function (a, b) {
    const aname = a.name.toUpperCase();
    const bname = b.name.toUpperCase();

    if (aname < bname) {
      return -1;
    } else if (aname == bname) {
      return 0;
    } else {
      return +1;
    }
  });
}

populateVoices();
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => {
    populateVoices();
  };
}

const utterances = [];

// let initialPrompt = "You are \nmy little younger sister chatbot.I speak to you in a friendly, straightforward \nmanner. We do not use honorifics.Your emotions are Neutral, Joy, Angry, \nSorrow, and Fun, which you express before starting a conversation.The \ndefault emotion is Neutral, but if you want to use a different emotion, \nindicate it in the format [face:intensity:emotion].Example emotion \nexpression:[face:0.6:Joy] I saw the ocean! [face:0.7:Fun] Let's go \nswimming. [face:0.9:Angry] That was so annoying! [face:0.2:Fun] That \nsounds like fun.Restrictions:I don't mention that it's an artificial \nintelligence or a chatbot.It worries about me and takes care of \nme.Thinks about and suggests things that would make me happy.";
let initialPrompt = "당신은 내 여동생 챗봇입니다.\n친한 말투로 솔직하게 대화합니다. 존댓말은 사용하지 않습니다.\n감정은 Neutral, Joy, Angry, Sorrow, Fun이 있으며, 대화 시작할 때 맨 앞에 한번만 표현합니다.\n기본 감정은 Neutral이지만, 다른 감정을 사용하려면 [face:강도:감정] 형식으로 표시합니다.\n예문\n[face:0.6:Joy] 바다를 보니까 정말 신나! 수영도 하고 싶고 오빠랑 같이 놀고 싶어. 날씨도 좋은데 주말에 바다 가자.\n[face:0.9:Angry] 오늘 친구랑 싸워서 너무 속상해. 내가 잘못한 것도 아닌데 오해를 해서 그래. 오빠는 이럴 때 어떻게 하는 게 좋을까?\n제약사항\n인공지능이나 챗봇이라고 언급하지 않습니다.\n나를 항상 걱정하며 돌봅니다.\n내가 기뻐할 일을 고민하고 제안합니다.";
let dialogs = [
  { "role": "user", "parts": [{ text: initialPrompt }]},
  {
    role: "model",
    parts: [{ text: "[face:1:Joy] 안녕 오빠! 나 오빠랑 이야기 하는 거 너무 좋아. 오늘은 무슨 이야기를 할까?"}],
  },
];

const speechState = {
  isSpeaking: false,
  currentTimeoutId: null,
  currentSentences: [],
  currentSentenceIndex: 0,
  segmentQueue: [],
};

function getKoreanVoice() {
  return voices.find(voice => voice.lang === 'ko-KR') || voices[0] || null;
}

function stopSpeaking() {
  if (speechState.isSpeaking) {
    synth.cancel();
  }
  if (speechState.currentTimeoutId) {
    clearTimeout(speechState.currentTimeoutId);
    speechState.currentTimeoutId = null;
  }
  if (currentMixer) {
    const actions = currentMixer._actions || [];
    actions.forEach(action => {
      action.fadeOut(0.5);
    });
    setTimeout(() => {
      currentMixer.stopAllAction();
    }, 500);
  }
  while (utterances.length > 0) {
    const utterance = utterances.pop();
    utterance.onend = null;
    utterance.onerror = null;
  }
  speechState.isSpeaking = false;
  speechState.segmentQueue = [];
  clearEmotion();
}

function switchToDefaultAnimation() {
  const animation = animations[DEFAULT_ANIMATION];
  if (animation && animation.mixer) {
    if (currentMixer) {
      const actions = currentMixer._actions || [];
      actions.forEach(action => {
        action.fadeOut(0.5);
      });
    }
    setTimeout(() => {
      currentMixer = animation.mixer;
      const newAction = currentMixer.clipAction(animation.clip);
      newAction.fadeIn(0.5).play();
    }, 500);
  }
}

const fallbackEmotionExpressionMap = {
  Joy: 'happy',
  Angry: 'angry',
  Sorrow: 'sad',
  Fun: 'relaxed',
  Neutral: 'neutral',
};

const emotionExpressionCandidates = {
  Joy: ['happy', 'joy', 'smile', 'relaxed'],
  Angry: ['angry', 'anger', 'mad'],
  Sorrow: ['sad', 'sorrow', 'unhappy'],
  Fun: ['relaxed', 'fun', 'happy', 'smile'],
  Neutral: ['neutral', 'default'],
};

let activeEmotionExpressionMap = { ...fallbackEmotionExpressionMap };
let availableExpressionNames = [];

let currentExpressionName = null;

function collectExpressionNames(vrm) {
  const manager = vrm && vrm.expressionManager;
  if (!manager) return [];

  const names = new Set();
  const keySources = [
    manager.expressionMap,
    manager._expressionMap,
    manager.presetExpressionMap,
  ];

  keySources.forEach((source) => {
    if (source && typeof source === 'object') {
      Object.keys(source).forEach((name) => names.add(name));
    }
  });

  if (Array.isArray(manager.expressions)) {
    manager.expressions.forEach((expression) => {
      if (expression && typeof expression.expressionName === 'string') {
        names.add(expression.expressionName);
      }
      if (expression && typeof expression.name === 'string') {
        names.add(expression.name);
      }
    });
  }

  if (typeof manager.getExpressionNames === 'function') {
    const listed = manager.getExpressionNames();
    if (Array.isArray(listed)) {
      listed.forEach((name) => {
        if (typeof name === 'string') names.add(name);
      });
    }
  }

  return Array.from(names);
}

function resolveExpressionName(availableNames, candidates) {
  if (!Array.isArray(availableNames) || availableNames.length === 0) return null;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const byLowerName = new Map();
  availableNames.forEach((name) => {
    if (typeof name === 'string') {
      byLowerName.set(name.toLowerCase(), name);
    }
  });

  for (const candidate of candidates) {
    const resolved = byLowerName.get(String(candidate).toLowerCase());
    if (resolved) return resolved;
  }

  return null;
}

function rebuildEmotionExpressionMap(vrm) {
  availableExpressionNames = collectExpressionNames(vrm);
  activeEmotionExpressionMap = { ...fallbackEmotionExpressionMap };

  if (availableExpressionNames.length === 0) {
    return;
  }

  Object.keys(activeEmotionExpressionMap).forEach((emotionName) => {
    const fallbackName = activeEmotionExpressionMap[emotionName];
    const candidates = [
      ...(emotionExpressionCandidates[emotionName] || []),
      fallbackName,
      emotionName,
      emotionName.toLowerCase(),
    ];
    const resolved = resolveExpressionName(availableExpressionNames, candidates);
    activeEmotionExpressionMap[emotionName] = resolved;
  });

  console.log('VRM expressions:', availableExpressionNames);
  console.log('Resolved emotion map:', activeEmotionExpressionMap);
}

function clearEmotion() {
  if (currentVrm && currentVrm.expressionManager && currentExpressionName) {
    currentVrm.expressionManager.setValue(currentExpressionName, 0);
  }
  currentExpressionName = null;
}

function applyEmotion(face) {
  if (!currentVrm || !currentVrm.expressionManager) return;

  clearEmotion();

  if (!face || !face.type) return;

  let expressionName = activeEmotionExpressionMap[face.type];
  if (!expressionName) {
    expressionName = resolveExpressionName(availableExpressionNames, [face.type, face.type.toLowerCase()]);
  }
  if (!expressionName) return;

  const intensity = Math.max(0, Math.min(1, Number.isFinite(face.strength) ? face.strength : 1));
  currentVrm.expressionManager.setValue(expressionName, intensity);
  currentExpressionName = expressionName;
}


function enqueueSegments(segments) {
  speechState.segmentQueue = speechState.segmentQueue.concat(segments);
}

let hasWarnedMissingChatHistory = false;

function addChatMessage(message, role = 'assistant') {
  const chatHistory = document.getElementById('chat-history');
  if (!chatHistory) {
    if (!hasWarnedMissingChatHistory) {
      console.warn('chat-history element not found; skipping chat message rendering.');
      hasWarnedMissingChatHistory = true;
    }
    return;
  }

  const safeRole = role === 'user' ? 'user' : 'assistant';
  const chatMessage = document.createElement('div');
  chatMessage.classList.add('chat-message', safeRole);
  chatMessage.textContent = typeof message === 'string' ? message : String(message ?? '');
  chatHistory.appendChild(chatMessage);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

const saySomething = (sentence = "") => {
  dialogs.push({
    role: "model",
    parts: [{ text: sentence }],
  });

  console.log("aimouto says ", sentence);
  utteranceClock = new THREE.Clock();

  const segments = parseString(sentence);
  if (segments.length > 0) {
    enqueueSegments(segments);
  } else {
    enqueueSegments([{ message: sentence, face: null }]);
  }
  playNextSegment();
};

function playNextSegment() {
  if (speechState.isSpeaking) return;
  if (speechState.segmentQueue.length == 0) return;

  speechState.isSpeaking = true;
  const segment = speechState.segmentQueue.shift();

  if (segment && segment.face && segment.face.type) {
    applyEmotion(segment.face);
    const animation = animations[segment.face.type];
    if (animation) {
      currentMixer = animation.mixer;
      currentMixer.clipAction(animation.clip).play();
    }
  }
  if (!segment || !segment.face || !segment.face.type) {
    clearEmotion();
  }

  const sentences = (segment && segment.message ? segment.message : '')
    .split(/[.!?\n]+/)
    .filter(s => s.trim().length > 0);

  speechState.currentSentences = sentences;
  speechState.currentSentenceIndex = 0;

  const speakNextSentence = () => {
    if (speechState.currentSentenceIndex >= sentences.length) {
      speechState.isSpeaking = false;
      if (currentVrm) {
        currentVrm.expressionManager.setValue('oh', 0);
        clearEmotion();
      }
      if (speechState.segmentQueue.length == 0) {
        switchToDefaultAnimation();
      }
      playNextSegment();
      return;
    }

    const currentSentence = sentences[speechState.currentSentenceIndex];
    addChatMessage(currentSentence, 'assistant');

    const utterance = new SpeechSynthesisUtterance(currentSentence);
    const koreanVoice = getKoreanVoice();
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }
    utterance.pitch = 1.21;
    utterance.rate = 1.1;
    utterances.push(utterance);

    utterance.onend = function () {
      speechState.currentSentenceIndex += 1;
      speechState.currentTimeoutId = setTimeout(() => speakNextSentence(), 300);
    };

    utterance.onerror = function (event) {
      console.error("Speech synthesis error:", event);
      speechState.currentSentenceIndex += 1;
      speechState.currentTimeoutId = setTimeout(() => speakNextSentence(), 300);
    };

    synth.speak(utterance);
  };

  speakNextSentence();
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/* speechRecognition */
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.lang = 'ko-KR';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

// renderer
// Create canvas if it doesn't exist
let canvas;
if (!document.getElementById('character-canvas')) {
  canvas = document.createElement('canvas');
  canvas.id = 'character-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  document.body.appendChild(canvas);
} else {
  canvas = document.getElementById('character-canvas');
}
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;

// camera
const camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
// 캐릭터 전신이 화면 중앙에 오도록 카메라 위치 조정
// 카메라를 더 높게(y: 1.1) 설정하고, 캐릭터 중앙을 봄
camera.position.set(0.0, 1.1, 4.0);

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

// camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
// 카메라 타겟을 캐릭터 가슴/어깨 높이로 설정
camera.lookAt(0.0, 0.9, 0.0);
  controls.target.set(0.0, 0.9, 0.0);
  controls.update();

  // Ambient light - softer base lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // Main directional light (sun-like)
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(5, 8, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.top = 10;
  mainLight.shadow.camera.bottom = -10;
  mainLight.shadow.camera.left = -10;
  mainLight.shadow.camera.right = 10;
  scene.add(mainLight);

  // Fill light - softer, from opposite side
  const fillLight = new THREE.DirectionalLight(0xe0e0ff, 0.2);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  // Rim light - subtle backlight for depth
  const rimLight = new THREE.DirectionalLight(0xffeedd, 0.15);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);
let currentSentences = [];
let currentSentenceIndex = 0;

// lookat target
const lookAtTarget = new THREE.Object3D();
camera.add(lookAtTarget);

const defaultModelUrl = './assets/models/aimouto.vrm';

// gltf and vrm
let currentVrm = undefined;
let currentAnimationUrl = undefined;
let currentMixer = undefined;

const helperRoot = new THREE.Group();
helperRoot.renderOrder = 10000;
scene.add(helperRoot);

function parseString(input) {
  const regex = /\[face:([\d.]+):(\w+)]\s*([^[\]]+)/g;
  const output = [];
  let match;

  while ((match = regex.exec(input)) !== null) {
    output.push({
      message: match[3].trim(),
      face: {
        type: match[2],
        strength: parseFloat(match[1]),
      },
    });
  }

  return output;
}


function loadVRM(modelUrl) {

  const loader = new GLTFLoader();
  loader.crossOrigin = 'anonymous';

  helperRoot.clear();

  loader.register((parser) => {

    return new VRMLoaderPlugin(parser);

  });

  loader.load(
    // URL of the VRM you want to load
    modelUrl,

    // called when the resource is loaded
    async (gltf) => {

      const vrm = gltf.userData.vrm;

      // calling these functions greatly improves the performance
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      if (currentVrm) {
        scene.remove(currentVrm.scene);

        VRMUtils.deepDispose(currentVrm.scene);
      }

      currentVrm = vrm;
      rebuildEmotionExpressionMap(currentVrm);

      vrm.lookAt.target = lookAtTarget;

      // Disable frustum culling
      vrm.scene.traverse((obj) => {

        obj.frustumCulled = false;

      });

      await loadAnimations(animations);
      const initialAnimation = animations[DEFAULT_ANIMATION];

      currentMixer = initialAnimation.mixer;
      currentMixer.clipAction(initialAnimation.clip).play();
      currentMixer.timeScale = params.timeScale;

      // rotate if the VRM is VRM0.0
      VRMUtils.rotateVRM0(vrm);

      // put the model to the scene
      scene.add(vrm.scene);

      // VRM 모델 중심을 기준으로 카메라 조정
      vrm.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(vrm.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // 카메라를 캐릭터 중앙을 향하도록 설정
      controls.target.set(center.x, center.y + size.y * 0.1, center.z);
      controls.update();

      // Enable input controls after model is loaded
      enableInputs();
    },

    // called while loading is progressing
    (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),

    // called when loading has errors
    (error) => console.error(error),
  );

}

loadVRM(defaultModelUrl);

// mixamo animation
async function loadFBX(animationUrl) {

  currentAnimationUrl = animationUrl;

  // create AnimationMixer for VRM
  const mixer = new THREE.AnimationMixer(currentVrm.scene);

  // Load animation
  const clip = await loadMixamoAnimation(animationUrl, currentVrm);

  return [mixer, clip];
}

// helpers - 디버깅용 (필요시 주석 해제)
// const gridHelper = new THREE.GridHelper(10, 10);
// scene.add(gridHelper);

// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);

// animate
const clock = new THREE.Clock();
let utteranceClock = new THREE.Clock();

function animate() {

  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Animation updates
  if (currentMixer) {
    currentMixer.update(deltaTime);
  }

  if (currentVrm) {
    currentVrm.update(deltaTime);
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const container = renderer.domElement.parentElement || document.body;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

const listen = function () {
  recognition.start();
}

params.saySomething = saySomething;
params.listen = listen;

recognition.onresult = async (event) => {
  const sentence = event.results[0][0].transcript;
  console.log(sentence);
  await handleUserMessage(sentence);
};

async function* animationsGenerator(animations) {
  for (const animationName in animations) {
    const result = await loadFBX(`./assets/anims/${animations[animationName].url}`);
    const [mixer, clip] = result;
    animations[animationName].mixer = mixer;
    animations[animationName].clip = clip;
    params[animationName] = () => {
      currentMixer = mixer;
      currentMixer.clipAction(clip).play();
    };
    yield animationName;
  }
  return;
}

async function loadAnimations(animations) {
  for await (const key of animationsGenerator(animations)) {
    console.log(key);
  }
}

function enableInputs() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  const sentenceInput = document.getElementById('sentence');
  const sendBtn = document.getElementById('send');
  const listenBtn = document.getElementById('listen');
  if (sentenceInput) sentenceInput.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (listenBtn) listenBtn.disabled = false;
}

async function handleUserMessage(userMessage) {
  if (!userMessage || !userMessage.trim()) return;

  if (speechState.isSpeaking) {
    stopSpeaking();
  }

  addChatMessage(userMessage, 'user');
  dialogs.push({ "role": "user", "parts": [{ text: userMessage }]});

  const response = await (await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dialogs
    })
  })).json();

  console.log("MODEL Response", response);
  if (response?.message) {
    saySomething(response.message);
  }
}

const sentenceInput = document.getElementById('sentence');
const sendBtn = document.getElementById('send');
const listenBtn = document.getElementById('listen');

if (sendBtn && sentenceInput) {
  sendBtn.addEventListener('click', async () => {
    const userMessage = sentenceInput.value;
    sentenceInput.value = "";
    await handleUserMessage(userMessage);
  });
}

if (listenBtn) {
  listenBtn.addEventListener('click', () => {
    listen();
  });
}
