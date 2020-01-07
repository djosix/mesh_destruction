import * as THREE from 'three';

import {
  GUI
} from 'three/examples/jsm/libs/dat.gui.module.js';
import {
  OrbitControls
} from 'three/examples/jsm/controls/OrbitControls.js';
import {
  OBJLoader
} from 'three/examples/jsm/loaders/OBJLoader.js';
import {
  EffectComposer
} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {
  RenderPass
} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {
  UnrealBloomPass
} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  Program
} from './program';


function main() {
  //================================================================================
  // Set for Global Access
  //================================================================================

  let data = window.data = {};
  window.THREE = THREE;
  window.GUI = GUI;

  //================================================================================
  // Clock
  //================================================================================

  let clock = new THREE.Clock();

  //================================================================================
  // Scene
  //================================================================================

  let scene = new THREE.Scene();

  let space = new THREE.Object3D();
  scene.add(space);

  let camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);
  scene.add(camera);

  //================================================================================
  // Renderer
  //================================================================================

  let renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.toneMapping = THREE.ReinhardToneMapping;
  document.body.appendChild(renderer.domElement);

  //================================================================================
  // Orbit Controls
  //================================================================================

  let controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI;
  controls.minDistance = 0.1;
  controls.maxDistance = 10;
  controls.zoomSpeed = 0.5;

  //================================================================================
  // Lights
  //================================================================================

  let ambientLight = new THREE.AmbientLight(0x444444)
  scene.add(ambientLight);

  let pointLight = new THREE.PointLight(0xffffff, 1, 100);
  pointLight.position.set(0.1, 0.1, 0.1);
  camera.add(pointLight);

  //================================================================================
  // Parameters
  //================================================================================

  let params = {
    exposure: 1,
    bloomStrength: 3,
    bloomThreshold: 0.66,
    bloomRadius: 1,
    fragMaxAge: 2,
    fragVel: 0.2,
    fragRot: 0.2,
    fragDecay: 0.1,
    fragVisitInt: 0.01,
    fragAlphaPow: 1,
    fragColorR: 1,
    fragColorG: 1,
    fragColorB: 1,
  };

  //================================================================================
  // Scene
  //================================================================================

  let renderScene = new RenderPass(scene, camera);

  //================================================================================
  // Bloom
  //================================================================================

  let bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  //================================================================================
  // Composer
  //================================================================================

  let composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  //================================================================================
  // GUI
  //================================================================================

  let gui = new GUI();

  gui.add(params, 'exposure', 0.1, 2).onChange(value => {
    renderer.toneMappingExposure = Math.pow(value, 4.0);
  });

  gui.add(params, 'bloomStrength', 0.0, 8.0).onChange(value => {
    bloomPass.strength = value;
  });

  gui.add(params, 'bloomThreshold', 0.0, 1.0).onChange(value => {
    bloomPass.threshold = value;
  });

  gui.add(params, 'bloomRadius', 0, 1).step(0.01).onChange(value => {
    bloomPass.radius = value;
  });

  gui.add(params, 'fragMaxAge', 0.1, 20);

  gui.add(params, 'fragVel', 0, 1).onChange(value => {
    params.fragVelScale = (Math.pow(10, value) - 1);
  }).setValue(params.fragVel);

  gui.add(params, 'fragRot', 0, 1).onChange(value => {
    params.fragRotScale = (Math.pow(10, value) - 1);
  }).setValue(params.fragRot);

  gui.add(params, 'fragDecay', 0, 1).onChange(value => {
    params.fragDecayScale = -Math.pow(value, 2) + 1;
  }).setValue(params.fragDecay);

  gui.add(params, 'fragAlphaPow', 0, 2).onChange(value => {
    params.fragAlphaPowScale = value * value;
  }).setValue(params.fragAlphaPow);

  gui.add(params, 'fragVisitInt', 0, 1);

  gui.add(params, 'fragColorR', 0.5, 1);
  gui.add(params, 'fragColorG', 0.5, 1);
  gui.add(params, 'fragColorB', 0.5, 1);

  //================================================================================
  // Resize Handling
  //================================================================================

  window.onresize = () => {
    let width = window.innerWidth;
    let height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);
  };

  //================================================================================
  // Animate
  //================================================================================

  function animate() {
    requestAnimationFrame(animate);
    try {
      const delta = clock.getDelta();

      if (data.program)
        data.program.update(delta);

      // renderer.render(scene, camera);
      composer.render();
    } catch (e) {
      console.log(e);
      if (data.program && data.program.running)
        data.program.running = false;
    }
  }

  animate();

  //================================================================================
  // Object Loading
  //================================================================================

  function loadProgram(objFile) {
    new OBJLoader().load(objFile, obj => {
      let mesh = obj.children[0];

      mesh.geometry = new THREE.Geometry().fromBufferGeometry(mesh.geometry);
      mesh.geometry.mergeVertices();
      mesh.geometry.normalize();
      mesh.geometry.computeVertexNormals(true);

      mesh.material = new THREE.MeshPhongMaterial({
        color: 0x444444
      });
      mesh.material.side = THREE.DoubleSide;

      // Add to global to debug
      data.program = new Program(space, mesh, params);;
    });
  }

  function load() {
    let obj = document.querySelector('#obj');
    obj.value = obj.value.trim();
    if (obj.value.endsWith('.obj')) {
      if (data.program)
        data.program.clean();
      loadProgram(obj.value);
    }
  }

  function destruct() {
    if (data.program) {
      data.program.start();
    }
  }

  document.querySelector('#load-btn').addEventListener('click', load);
  document.querySelector('#destruct-btn').addEventListener('click', destruct);

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'l':
      case 'L':
        document.querySelector('#load-btn').click();
        break;
      case 'd':
      case 'D':
        document.querySelector('#destruct-btn').click();
        break;
    }
  });
}

window.onload = main;
