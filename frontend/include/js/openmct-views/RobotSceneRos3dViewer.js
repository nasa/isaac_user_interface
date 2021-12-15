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
//

import {VisualLayers} from './VisualLayers.js';

const USE_LAYERS = true;

export class RobotSceneRos3dViewer extends ROS3D.Viewer {
	visualLayers = new VisualLayers(this.renderer, THREE.Scene);

	constructor(options) {
		super(options);

		this.cameraControls.addEventListener('change', () => {
			// Any time the user interacts with the camera, the scene should be
			// queued to re-render, so as to show the new camera angle.
			this.shouldRender();
		});

		// Make the camera a child inside the scene, useful if someone wants to add any
		// children to the camera that should be rendered on screen (f.e. a HUD).
		this.scene.add(this.camera);

		if (!options.layers) {
			// set default layers
			options.layers = [];
		}

		let i = 0;
		for (const layer of options.layers) {
			this.visualLayers.defineLayer(layer, i++);
		}
		this.visualLayers.defineLayer('back', 0);
		this.visualLayers.defineLayer('front', 1);

		// this is a simple raycaster to enable 3D point selection
		document.addEventListener('mousedown', this.onPointerDown.bind(this));

		this.pointer = {
			x: 0.0,
			y: 0.0,
		};

		// TODO explain
		this.raycaster = new THREE.Raycaster();
		this.intersects = [];
	}

	onPointerDown(event) {
		// TODO clean this up pls
		// ref:
		// https://github.com/mrdoob/three.js/blob/master/examples/webgl_interactive_cubes.html
		this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
		this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
		this.raycaster.setFromCamera(this.pointer, this.camera);
		this.intersects = this.raycaster.intersectObjects(this.scene.children, true).filter(x => x.distance < 100.0);

		// WARNING ugly commented out code below
		// TODO scope this with a DEBUG statement or something like that

		// for (let i = 0; i < this.intersects.length; i++) {
		// 	console.log(
		// 		'[debug][mouse] intersected with ',
		// 		this.intersects[i].object.parent.name,
		// 		'at point: ',
		// 		this.intersects[i].point
		// 	);
		// }
	}

	/** @override */
	draw() {
		this.animationRequestId = undefined;
		if (this.stopped) return;

		this.cameraControls.update();

		if (USE_LAYERS) {
			this.scene.updateMatrixWorld(); // Using scene.updateWorldMatrix(true, true) won't work
			this.renderer.autoClear = false;
			this.renderer.clear();
			this.visualLayers.render(this.camera, this.beforeEachLayerRender, this.afterEachLayerRender);
		} else {
			this.renderer.render(this.scene, this.camera);
		}

		// this.animationRequestId = requestAnimationFrame(this.draw);
	}

	beforeEachLayerRender = layer => {};

	afterEachLayerRender = layer => {
		this.renderer.clearDepth();
	};

	/** @override */
	start() {
		console.log('start');
		this.stopped = false;
		this.shouldRender(); // Render once initially, instead of making a loop.
	}

	addObjectToLayer(...args) {
		this.visualLayers.addObjectToLayer(...args);
		this.shouldRender();
	}

	addObjectsToLayer(...args) {
		this.visualLayers.addObjectsToLayer(...args);
		this.shouldRender();
	}

	addObjectToAllLayers(...args) {
		this.visualLayers.addObjectToAllLayers(...args);
		this.shouldRender();
	}

	addObjectsToAllLayers(...args) {
		this.visualLayers.addObjectsToAllLayers(...args);
		this.shouldRender();
	}

	resize(...args) {
		super.resize(...args);
		this.shouldRender();
	}

	// Any time the rendering should update, call this. It queues an animation frame.
	shouldRender() {
		if (this.stopped) return;
		if (this.animationRequestId) return;

		this.animationRequestId = requestAnimationFrame(this.draw.bind(this));
	}
}
