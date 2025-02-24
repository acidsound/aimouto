import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { loadMixamoAnimation } from './loadMixamoAnimation.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
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
let voices;

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

let isSpeaking = false;
let currentTimeoutId = null;

const saySomething = (sentence = "안녕") => {
  // Set speaking flag to prevent concurrent speech
  if (isSpeaking) {
    // Cancel all ongoing speech and animations
    synth.cancel();
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
      currentTimeoutId = null;
    }
    // Fade out current animation before stopping
    if (currentMixer) {
      const actions = currentMixer._actions || [];
      actions.forEach(action => {
        action.fadeOut(0.5);
      });
      setTimeout(() => {
        currentMixer.stopAllAction();
      }, 500);
    }
    // Clear any existing text
    if (textMesh) {
      scene.remove(textMesh);
      textMesh.material.dispose();
      textMesh.geometry.dispose();
      textMesh = null;
    }
    // Clear all pending utterances
    while(utterances.length > 0) {
      const utterance = utterances.pop();
      utterance.onend = null;
      utterance.onerror = null;
    }
  }
  
  isSpeaking = true;

  dialogs.push({
    role: "model",
    parts: [{ text: sentence }],
  });

  console.log("aimouto says ", sentence);
  utteranceClock = new THREE.Clock();

  // Split the sentence into an array using Korean sentence endings and punctuation marks
  const sentences = sentence.split(/[.!?요\n]+/).filter(s => s.trim().length > 0);
  currentSentences = sentences;
  currentSentenceIndex = 0;

  const speakNextSentence = () => {
    if (currentSentenceIndex < sentences.length) {
      // Clear previous text before showing new one
      if (textMesh) {
        scene.remove(textMesh);
        textMesh.material.dispose();
        textMesh.geometry.dispose();
        textMesh = null;
      }

      const currentSentence = sentences[currentSentenceIndex];
      createTextSprite(currentSentence);

      const utterance = new SpeechSynthesisUtterance(currentSentence);
      const koreanVoice = synth.getVoices().find(voice => voice.lang === 'ko-KR');
      if (koreanVoice) {
        utterance.voice = koreanVoice;
        utterance.pitch = 1.21;
        utterance.rate = 1.1;
        utterances.push(utterance);

        utterance.onend = function () {
          console.log("SpeechSynthesisUtterance.onend");
          currentSentenceIndex++;
          if (currentSentenceIndex < sentences.length) {
            currentTimeoutId = setTimeout(() => speakNextSentence(), 300);
          } else {
            // Reset speaking state when all sentences are done
            isSpeaking = false;
            if (currentVrm) {
              currentVrm.expressionManager.setValue('oh', 0);
            }
            const animation = animations[DEFAULT_ANIMATION];
            if (animation && animation.mixer) {
              // Fade out current animation
              if (currentMixer) {
                const actions = currentMixer._actions || [];
                actions.forEach(action => {
                  action.fadeOut(0.5);
                });
              }
              // Switch to default animation with fade in after current animation fades out
              setTimeout(() => {
                currentMixer = animation.mixer;
                const newAction = currentMixer.clipAction(animation.clip);
                newAction.fadeIn(0.5).play();
              }, 500);
              console.log("Switching to default animation");
            }
            console.log("All sentences spoken");
            // Clear the text sprite after a short delay
            setTimeout(() => {
              if (textMesh) {
                scene.remove(textMesh);
                textMesh.material.dispose();
                textMesh.geometry.dispose();
                textMesh = null;
              }
            }, 500);
          }
        };

        utterance.onerror = function (event) {
          console.error("Speech synthesis error:", event);
          isSpeaking = false;
          currentSentenceIndex++;
          if (currentSentenceIndex < sentences.length) {
            setTimeout(() => speakNextSentence(), 300);
          }
        };

        synth.speak(utterance);
      } else {
        console.error("No Korean voice found");
        isSpeaking = false;
      }
    }
  };

  speakNextSentence();
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/* speechRecognition */
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.lang = 'ko-KR';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

// renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// camera
const camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
camera.position.set(0.0, 1.0, 5.0);

// camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
controls.target.set(0.0, 1.0, 0.0);
controls.update();

// scene
const scene = new THREE.Scene();
let textMesh = null;
let currentSentences = [];
let currentSentenceIndex = 0;
let textChangeInterval = null;

// light
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);

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

      document.getElementById('send').addEventListener('click', async () => {
        const sentence = document.getElementById('sentence');
        dialogs.push({ "role": "user", "parts": [{ text: sentence.value }]});
        const response = await (await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dialogs
          })
        })).json();
        sentence.value = "";
        let sentences = [];
        console.log("MODEL Response", response);
        if (response?.message) {
          sentences = parseString(response?.message);
          if (sentences.length > 0) {
            const animation = animations[sentences[0].face.type];
            if (animation) {
              currentMixer = animation?.mixer;
              currentMixer.clipAction(animation.clip).play();
            }
            saySomething(sentences[0].message);
          } else {
            /* 감정을 못가져올 때 예외처리 */
            createTextSprite(response.message);
            saySomething(response.message);
          }
        }
      });
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

// helpers
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// animate
const clock = new THREE.Clock();
let utteranceClock = new THREE.Clock();
function createTextSprite(text) {
  if (textMesh) {
    scene.remove(textMesh);
    textMesh.material.dispose();
    textMesh.geometry.dispose();
    textMesh = null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 128;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 48px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width/2, canvas.height/2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  
  sprite.scale.set(4, 0.5, 1);
  sprite.position.set(0, 2.5, -2);
  
  textMesh = sprite;
  scene.add(sprite);
}

function animate() {

  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // if animation is loaded
  if (currentMixer) {
    if (synth.speaking) {
      const et = utteranceClock.getElapsedTime();
      currentVrm.expressionManager.setValue('oh', Math.sin(et * 18) * 0.3 + 0.3);
    }

    // update the animation
    currentMixer.update(deltaTime);
  }

  if (currentVrm) {
    currentVrm.update(deltaTime);
  }

  renderer.render(scene, camera);
}

animate();

// gui
const gui = new GUI();

const listen = function () {
  recognition.start();
}

params.saySomething = saySomething;
params.listen = listen;

recognition.onresult = async (event) => {
  const sentence = event.results[0][0].transcript;
  console.log(sentence);
  try {
    const response = await fetch('http://localhost:8080/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sentence
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.text();
    console.log('Response Data:', responseData);
  } catch (err) {
    console.error('Error:', err);
  }
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
  for (const animationName in animations) gui.add(params, animationName);
}

