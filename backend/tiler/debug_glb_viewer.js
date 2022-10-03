// Copyright © 2021, United States Government, as represented by the Administrator of the
// National Aeronautics and Space Administration. All rights reserved.
//
// The “ISAAC - Integrated System for Autonomous and Adaptive Caretaking platform” software is
// licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the
// License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific language governing
// permissions and limitations under the License.

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let camera_g, scene_g, renderer_g;

function load_glb(loader, scene_g, glb_path) {
    loader.load(glb_path, function (gltf) {
        scene_g.add(gltf.scene);
        render();
    });
}


function onWindowResize() {
    camera_g.aspect = window.innerWidth / window.innerHeight;
    camera_g.updateProjectionMatrix();

    renderer_g.setSize(window.innerWidth, window.innerHeight);

    render();
}

function render() {
    renderer_g.render(scene_g, camera_g);
}

function init() {

    const container = document.createElement("div");
    document.body.appendChild(container);

    // set to the center of what you want to look at
    const [cx, cy, cz] = {{ centroid }};

    const camera_distance = {{ width }};

    camera_g = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
    camera_g.position.set(cx - camera_distance, cy, cz);
    camera_g.up = new THREE.Vector3(0, 0, -1);

    scene_g = new THREE.Scene();

    const light = new THREE.AmbientLight(0xffffff);
    scene_g.add(light);

    const loader = new GLTFLoader();
    const models_str = `{{ leaf_tiles }}`;
    const models = models_str.split(/\r?\n/);
    for (const model of models) {
	if (model == "") continue;
	load_glb(loader, scene_g, model);
    }

    renderer_g = new THREE.WebGLRenderer({antialias: true});
    renderer_g.setPixelRatio(window.devicePixelRatio);
    renderer_g.setSize(window.innerWidth, window.innerHeight);
    renderer_g.toneMapping = THREE.ACESFilmicToneMapping;
    renderer_g.toneMappingExposure = 1;
    renderer_g.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer_g.domElement);

    const controls = new OrbitControls(camera_g, renderer_g.domElement);
    controls.addEventListener("change", render); // use if there is no animation loop
    controls.minDistance = 0.01 * camera_distance;
    controls.maxDistance = 10 * camera_distance;
    controls.target.set(cx, cy, cz);
    controls.update();

    window.addEventListener("resize", onWindowResize);
}

init();
render();
