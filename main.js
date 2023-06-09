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

const animations = {
  "Angry": { url: "Angry.fbx" },
  "Neutral": { url: "Neutral_Idle.fbx" },
  "Joy": { url: "Happy.fbx" },
  "Sorrow": { url: "Sad_Idle.fbx" },
  "Fun": { url: "Laughing.fbx" },
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

const saySomething = (sentence = "안녕") => {
  if (synth.speaking) return;

  console.log("aimouto says ", sentence);
  utteranceClock = new THREE.Clock();

  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.voice = synth.getVoices().findLast(o=>o.lang==='ko-KR');
  utterance.pitch = 1.21;
  utterances.push(utterance);

  utterance.onend = function () {
    console.log("SpeechSynthesisUtterance.onend");
    currentVrm.expressionManager.setValue('oh', 0);
    const animation = animations[DEFAULT_ANIMATION];
    currentMixer = animation.mixer;
    currentMixer.clipAction(animation.clip).play();

    // res();
  };
  utterance.onerror = function () {
    // rej("SpeechSynthesisUtterance.onerror");
  };

  utterance.addEventListener('boundary', function (event) {
    console.log(event.name + ' boundary reached after ' + event.elapsedTime + ' milliseconds.');
  });
  synth.speak(utterance);
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/* speechRecognition */
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = "ko-KR";
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

      console.log(vrm);
      // put the model to the scene
      scene.add(vrm.scene);

      document.getElementById('send').addEventListener('click', async () => {
        const sentence = document.getElementById('sentence');
        const response = await (await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sentence: sentence.value
          })
        })).json();
        sentence.value = "";
        let sentences = [];
        if (response?.content) {
          sentences = parseString(response?.content);
          if (sentences.length > 0) {
            const animation = animations[sentences[0].face.type];
            currentMixer = animation.mixer;
            currentMixer.clipAction(animation.clip).play();
        
            saySomething(sentences[0].message);
  
          } else {
            /* 감정을 못가져올 때 예외처리 */
            saySomething(response.content);
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

gui.add(params, 'saySomething');

gui.add(params, 'listen');

gui.add(params, 'timeScale', 0.0, 2.0, 0.001).onChange((value) => {
  currentMixer.timeScale = value;
});

gui.add(params, 'blinkLeft', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('blinkLeft', value);
});

gui.add(params, 'blinkRight', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('blinkRight', value);
});

gui.add(params, 'aa', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('aa', value);
});

gui.add(params, 'ee', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('ee', value);
});

gui.add(params, 'ih', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('ih', value);
});

gui.add(params, 'oh', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('oh', value);
});

gui.add(params, 'ou', 0.0, 1.0, 0.1).onChange((value) => {
  currentVrm.expressionManager.setValue('ou', value);
});

// mouse listener
window.addEventListener('mousemove', (event) => {

  lookAtTarget.position.x = 10.0 * ((event.clientX - 0.5 * window.innerWidth) / window.innerHeight);
  lookAtTarget.position.y = - 10.0 * ((event.clientY - 0.5 * window.innerHeight) / window.innerHeight);

});

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

