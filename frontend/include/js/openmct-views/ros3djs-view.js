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

// TODO install locally
import {variable, autorun} from 'https://cdn.skypack.dev/@lume/variable@0.6.1';

import {disposeObjectTree} from './three-utils.js';
import {getImageSize, tfClientWithRender} from './utils.js';
import {RobotSceneRos3dViewer} from './RobotSceneRos3dViewer.js';

const DEBUG = false;

const LightMode = {
	// A single Ambient light (looks more flat, all surfaces have the same brightness regardless of angle)
	AmbientOnly: 0,

	// 6 lights making an octahedron
	Octa: 3,

	// 4 lights making a box
	Box: 4,
};

const lightMode = LightMode.Box;

const imageStreamWorkerURL = '/include/js/openmct-views/ImageStreamWorker.js';

class SceneNode extends ROS3D.SceneNode {
	/** @type {RobotSceneRos3dViewer} */
	__viewer;

	constructor(options) {
		super(options);
		this.__viewer = options.viewer;
	}

	/**
	 * Overrides tfUpdate so that it will trigger a re-render for our
	 * RobotSceneRos3dViewer, which requires its shouldRender() method to be
	 * called when a render should happen.
	 */
	tfUpdate = (() => {
		const originalTfUpdate = this.tfUpdate;

		return msg => {
			originalTfUpdate.call(this, msg);
			this.__viewer.shouldRender();
		};
	})();
}

/**
 * This is a custom element that should be returned from an OpenMCT objectViews
 * provider's view() function. An instance will use the provided OpenMCT
 * `openmct` and `domainObject` objects to determine which data to render; nothing will render until these are provided.
 *
 * Example:
 *
 * ```js
 * function SomeOpenMCTPlugin() {
 *   return function install(openmct) {
 *     // ... stuff ...
 *
 *     openmct.objectViews.addProvider({
 *       // ... stuff ...
 *
 *       view(domainObject) {
 *         // Make an RobotScene.
 *         const scene = new RobotScene
 *         // or, const scene = document.createElement('robot-scene')
 *
 *         // Assign the needed objects.
 *         scene.openmct = openmct
 *         scene.domainObject = domainObject
 *
 *         // Return it.
 *         return scene
 *       }
 *     })
 *   }
 * }
 * ```
 */
class RobotScene extends HTMLElement {
	/**
	 * Default the world to ISS
	 * this will change automatically if another world is being used
	 * we know this by using a ROS service called
	 * /gazebo/get_world_properties
	 * for more info, type this command inside the astrobee sim:
	 * rosservice info /gazebo/get_world_properties
	 */
	world = 'iss';

	/**
	 * this determines what the camera is tracking
	 * there are only two options right now
	 * body = tracking the robot body center
	 * world = not tracking the robot, fixed to world
	 */
	tracking = 'world';

	/**
	 * Required: Set this to an OpenMCT instance (the object that gets passed in to an OpenMCT plugin function).
	 * The value can only be set once, initially.
	 */
	set openmct(v) {
		if (this.__openmct) throw new Error('Only set the openmct prop once initially.');
		this.__openmct = v;
		this.__possiblyInitialize();
	}
	get openmct() {
		return this.__openmct;
	}

	/**
	 * Required: Set this to an OpenMCT domainObject (the object that gets passed in to an OpenMCT view function for example).
	 * The value can only be set once, initially.
	 */
	set domainObject(v) {
		if (this.__domainObject) throw new Error('Only set the domainObject prop once initially.');
		this.__domainObject = v;
		this.__possiblyInitialize();
	}
	get domainObject() {
		return this.__domainObject;
	}

	__openmct;
	__domainObject;
	__resizeObserver;
	__datGui;

	/**
	 * An array of lights that are distributed around the /world frame
	 * @type {Array<THREE.Light>}
	 */
	__worldLights = [];

	/** @type {RobotSceneRos3dViewer} */
	__rosViewer;
	__tfClient;
	__imageListener;
	__ros;
	__gltfLoader;

	/**
	 * This is used when we receive a steam of GLTF models.
	 * @type {Array<[Record<string, any>, Record<string, any>]>}
	 */
	__meshes = [];
	__maxMeshes = 100; // TODO determine a good value.

	/**
	 * This is for the single mesh mode where we stream images onto it as textures.
	 * @type {import('@lume/variable').Variable<THREE.Mesh | null>}
	 */
	__singleImageTextureMesh = variable(null);
	/**
	 * This is a duplicate of the second mesh to apply a white background to transparent parts of the PNG texture.
	 * @type {import('three').Mesh | null}
	 */
	__singleImageTextureMeshDupe = null;

	__gltfOrdering;

	/**
	 * @typedef {{
	 * 	toggleOn(): void
	 * 	toggleOff(): void
	 * 	name: string
	 * 	default: boolean
	 * }} ViewerPluginModel
	 */

	/**
	 * @type {Array<ViewerPluginModel>}
	 */
	__viewerPlugins = [];

	constructor() {
		super();

		this.id = 'astrobeeScene';

		this.style.setProperty('display', 'block');
		this.style.setProperty('width', '100%');
		this.style.setProperty('height', '100%');
	}

	/**
	 * Holds unsubscribe functions for any telemetry subscriptions. These should
	 * all be called on cleanup in disconnectedCallback.
	 * @type {Array<() => void>}
	 */
	__subscriptionStoppers = [];

	/**
	 * Subscribe to real-time data streams.
	 *
	 * @returns nothing
	 */
	__subscribeToRealtimeGLTF() {
		let streamingMapperTopic = new ROSLIB.Topic({
			ros: this.__ros,
			name: '/mapper_gltf',
			messageType: 'std_msgs/String',
		});

		streamingMapperTopic.subscribe(x => {
			// On each GLTF recieved, add it to the scene
			// GLTFs will be in the /world frame
			// i.e. the coordinates inside the GLTF are relative to the center of the ISS

			console.log('[gltf] recieved gltf');

			// Skip GLTF stream handling when using the single-mesh mode with texture stream.
			if (this.__singleImageTextureMesh()) {
				console.log('[gltf] skipping gltf stream handling');
				return;
			}

			// ref: https://threejs.org/docs/#examples/en/loaders/GLTFLoader.parse
			this.__gltfLoader.parse(
				x.data, // glTF asset to parse, as an ArrayBuffer or JSON string
				'/', // base path from which to find subsequent glTF resources
				gltf => {
					// function to be called when parse completes

					// select the mesh within the GLTF scene object
					const mesh = gltf.scene.children[0];

					// keep a copy of the existing mesh material
					// const existingMeshMaterial = mesh.material.clone();
					const existingMeshMaterial = mesh.material;
					mesh.material.side = THREE.DoubleSide;

					// create a new mesh material that is a double sided
					// red wireframe
					mesh.material = new THREE.MeshBasicMaterial({
						color: 0xff0000,
						side: THREE.DoubleSide,
						wireframe: true,
					});

					// after 1/4 second of displaying only a wireframe, return the mesh's
					// material to its existing material
					window.setTimeout(() => (mesh.material = existingMeshMaterial), 250);

					// by wrapping the GLTF in a scene node, we can position it
					// using a ROS transform
					let sceneNode = new SceneNode({
						tfClient: this.__tfClient,
						frameID: '/world',
						object: gltf.scene,
					});

					this.__meshes.push([mesh, sceneNode]);

					// Remove the oldest mesh if we've reached the max size (FIFO).
					if (this.__meshes.length === this.__maxMeshes + 1) {
						console.log('[gltf] reached size limit, trim one off');
						const m = this.__meshes.shift();
						if (!m) throw new Error('Should not happen');
						const [, removedScene] = m;
						disposeObjectTree(removedScene);
					}

					// add the ROS3D scene node into our three.js scene
					this.__rosViewer.addObject(sceneNode);
					this.__rosViewer.addObjectToLayer(sceneNode, 'front', true);
				},
				function (error) {
					// function to be called if an error occurs during parsing
					console.error('[gltf] Error occured when trying to load a GLTF.');
					console.error(error);
				},
				// set to a negative value, this prevents z-fighting by showing lower orders on top
				// ref: https://github.com/mrdoob/three.js/issues/2593
				--this.__gltfOrdering
			);
		});
	}

	/**
	 * Subscribe to stream of images that are patched onto the ISS model as they arrive.
	 */
	__subscribeToTextureImages() {
		if (this.__imageListener) throw new Error('We can only subscribe to one image stream for now.');

		// -----------------------------------------------------------------
		// WARNING: streaming textures is a big WIP
		// subscibing to base64 pngs coming in as String msgs on /ism/sci_cam/img/png
		// TODO this should come from config.json and shouldn't be hard coded
		// TODO we should have a custom ROS message for streaming meshes and/or textures
		// -----------------------------------------------------------------
		this.__imageListener = new ROSLIB.Topic({
			ros: this.__ros,
			name: '/ism/sci_cam/img/png',
			messageType: 'isaac_msgs/StringStamped',
		});

		console.log('subscribing to ' + '/ism/sci_cam/img/png');

		this.__imageListener.subscribe(this.__imageSubscriber);
	}

	/** @type {import('@lume/variable').Variable<HTMLCanvasElement | null>} */
	__singleMeshTextureCanvas = variable(null);

	/** @type {import('@lume/variable').Variable<number>} */
	__singleMeshTextureVersion = variable(0);

	/** @type {Promise<void> | undefined} */
	__imageSubscriberSizePromise;

	// values obtained only on the first image load
	__imageSubscriber_width = 0;
	__imageSubscriber_height = 0;

	/** @type {Worker} */
	__imageSubscriber_actualWorker;
	__imageSubscriber_ImageStreamWorker;
	__imageSubscriber_imageWorker;

	__imageSubscriber = async message => {
		/** @type {string} */
		let imgUrl = message.data;
		let isFirstImage = false;

		console.log('recieved message from /ism/.../png with timestamp', message.header.stamp);

		// Obtain width/height values only once initially.
		if (!this.__imageSubscriberSizePromise) {
			isFirstImage = true;
			this.__imageSubscriberSizePromise = getImageSize({imgUrl}).then(size => {
				console.log('Single-texture dimensions:', size.width, size.height);
				this.__imageSubscriber_width = size.width;
				this.__imageSubscriber_height = size.height;
			});
		}

		// All invocations of this.__imageSubscriber will pause here until the initial image size is determined.
		await this.__imageSubscriberSizePromise;

		/** @type {HTMLCanvasElement} */
		let canvas;

		// initialize things the first time.
		if (isFirstImage) {
			console.log('-- make the canvas');
			canvas = document.createElement('canvas');
			this.__singleMeshTextureCanvas(canvas);
			canvas.width = this.__imageSubscriber_width;
			canvas.height = this.__imageSubscriber_height;

			this.__imageSubscriber_actualWorker = new Worker(imageStreamWorkerURL);
			this.__imageSubscriber_ImageStreamWorker = Comlink.wrap(this.__imageSubscriber_actualWorker);
			this.__imageSubscriber_imageWorker = await new this.__imageSubscriber_ImageStreamWorker();

			const offscreenCanvas = canvas.transferControlToOffscreen();
			await this.__imageSubscriber_imageWorker.setCanvas(Comlink.transfer(offscreenCanvas, [offscreenCanvas]));
		}

		const start = performance.now();

		// Send the URL to the other thread for processing. Surprisingly, the transfer is fast.
		await this.__imageSubscriber_imageWorker.processImage(imgUrl);

		const end = performance.now();

		console.log(` --- Time to process image: ${(end - start) / 1000} seconds`);

		this.__singleMeshTextureVersion(this.__singleMeshTextureVersion() + 1);
	};

	/**
	 * Request all historical gltf files
	 *
	 * @returns nothing
	 */
	__requestHistoricalGLTF() {
		let requestDomainObject = Object.assign({}, this.domainObject);

		requestDomainObject.ros = {
			fieldName: 'data',
			fieldPosition: 'data',
			topic: '/mapper_gltf',
			type: 'std_msgs/String',
		};

		requestDomainObject.type = 'ros.telemetry';

		requestDomainObject.telemetry = {
			values: [
				{
					key: 'data',
					name: 'data',
					source: 'data',
					ros: 'data',
				},
				{
					format: 'utc',
					hints: {domain: 1, priority: 1},
					key: 'utc',
					name: 'Timestamp',
					source: 'timestamp',
				},
			],
		};

		this.openmct.telemetry.request(requestDomainObject).then(requestResponse => {
			// pass for now
			// TODO handle large volumes of redundant GLTF data somehow
		});
	}

	__initialized = false;

	/**
	 * This runs once three things have happened: openmct is set, domainObject
	 * is set, and the element is connected. No-ops if already initialized.
	 */
	async __possiblyInitialize() {
		if (!(this.openmct && this.domainObject && this.isConnected)) return;

		if (this.__initialized) return;
		this.__initialized = true;

		this.__startRenderEffects();

		// get viewer plugins dynamically and integrate them into viewer
		const config = await getConfig();

		// Don't do anything in case the previous promise resolves
		// after the element has been disconnected.
		if (!this.__initialized) return;

		this.__gltfOrdering = -1;

		// Connect to ROS
		const ros = new ROSLIB.Ros({
			url: 'ws://' + window.location.hostname + ':' + window.location.port + '/rosbridge',
		});

		this.__ros = ros;

		// set the id of this RobotScene to the domain object identifier key
		// recall that each RobotScene is created for each camera specified in the config
		// therefore each RobotScene must carry a unique identifier if you want to display
		// multiple RobotScenes on the same page (dashboard)
		this.id = this.domainObject.identifier.key;

		// Create the main viewer
		// see: http://robotwebtools.org/jsdoc/ros3djs/current/ROS3D.Viewer.html
		this.__rosViewer = new RobotSceneRos3dViewer({
			divID: this.id,
			antialias: true,
			intensity: 0.0,
			cameraPose: {x: 6.5, y: 5, z: 0},
			far: 10000,
			layers: config.layers,
		});

		this.__rosViewer.renderer.setPixelRatio(window.devicePixelRatio);
		this.__rosViewer.renderer.toneMapping = THREE.CineonToneMapping;
		this.__rosViewer.renderer.toneMappingExposure = 1.0;
		this.__rosViewer.renderer.shadowMap.enabled = true;

		// this function will resize the ROS canvas to its parent div width/height
		const onViewResize = () => {
			this.__rosViewer.resize(this.clientWidth, this.clientHeight);
		};

		// run this function on component startup
		onViewResize();

		// ResizeObserver interface reports changes to the dimensions of an Element's content or border box
		// ref: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
		this.__resizeObserver = new ResizeObserver(onViewResize);
		this.__resizeObserver.observe(this);

		this.__makeStars();

		if (DEBUG) {
			const sphere = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshPhongMaterial({color: 'deeppink'}));
			this.__rosViewer.addObject(sphere);
			this.__rosViewer.addObjectToLayer(sphere, 'back', true);

			const light = new THREE.PointLight('white', 1);
			light.position.set(3, 3, 3);
			this.__rosViewer.addObject(light);
			this.__rosViewer.addObjectToAllLayers(light, true);

			const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 'white'}));
			bulb.castShadow = false;
			bulb.receiveShadow = false;
			light.add(bulb);
		}

		this.__rosViewer.cameraControls.center.set(9.81599999879, -9.80599998926, 4.29299999934);
		this.__rosViewer.camera.position.set(19.211816715337214, -5.851762716528583, 4.079756546382005);

		// this is our TF client
		// see: http://wiki.ros.org/roslibjs/Tutorials/TfClient
		// it will subscribe to all TFs coming from Rosbridge
		// the fixedframe option tells our ROS 3D view to track that frame
		// in the center of our view
		// e.g. if the fixed frame is /body, our center of view will always be
		// the center of Astrobee
		this.__tfClient = tfClientWithRender(
			this.__rosViewer,
			new ROSLIB.TFClient({
				ros,
				angularThres: 0.0001,
				transThres: 0.0001,
				rate: 60.0,
				fixedFrame: this.tracking,
			})
		);

		// Use the custom three.js GLTF loader (version r89) + minor modification to fix bug
		// see: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
		this.__gltfLoader = new GLTFLoader();

		// always listen for texture images regardless of whether or not we have requested them
		// TODO fix in the future
		this.__subscribeToTextureImages();

		// add Dat GUI
		// see: https://github.com/dataarts/dat.gui
		const gui = new dat.GUI({autoPlace: false, closed: true});
		this.__datGui = gui;
		this.appendChild(gui.domElement);

		{
			this.__viewerPlugins = config.view
				.map(plugin => {
					/** @type {ViewerPluginModel} */
					let model = {
						toggleOn() {},
						toggleOff() {},
						name: '',
						default: false,
					};

					switch (plugin.ros.type) {
						case 'camera': {
							// set camera starting center and position
							// IF AND ONLY IF this camera is bound to the current ros3djs view
							// recall how we are creating a different view for each camera
							// also recall that we not only change the camera but also
							// the frame (ROS TF) that the camera follows
							//

							if (this.domainObject.identifier.key === plugin.key) {
								let c = {center: plugin.ros.center, position: plugin.ros.position};
								this.__rosViewer.cameraControls.center.set(c.center.x, c.center.y, c.center.z);
								this.__rosViewer.camera.position.set(c.position.x, c.position.y, c.position.z);
								this.__tfClient.fixedFrame = plugin.ros.frame || 'world';
								this.__tfClient.updateGoal();

								if (plugin.ros.track) {
									let cameraTracker = new ROSLIB.Topic({
										ros: this.__ros,
										name: plugin.ros.track.name,
										messageType: plugin.ros.track.type,
										throttle_rate: plugin.ros.track.throttle || 100,
									});
									cameraTracker.subscribe(msg => {
										this.__rosViewer.cameraControls.center.set(
											msg.pose.position.x,
											msg.pose.position.y,
											msg.pose.position.z
										);

										// Queue a re-render any time we manually move the camera center.
										this.__rosViewer.shouldRender();
									});
								}
							}

							return undefined;
						}
						// ---------------------------------------------
						case 'urdf': {
							let client;
							// For more information on URDF in ROS3DJS, see:
							// http://robotwebtools.org/jsdoc/ros3djs/current/ROS3D.UrdfClient.html
							// and
							// http://robotwebtools.org/jsdoc/ros3djs/current/ROS3D.Urdf.html
							//
							if (plugin.ros.track) {
								// Option 1 for tracking a URDF: follow pose echoed by a ROS topic
								/*
								{
									"name": "Astrobee",
									"key": "ros.view.astrobee",
									"ros": {
										"type": "urdf",
										"param": "/robot_description",
										"tf": "",
										"track": {
											"type": "ff_msgs/EkfState",
											"name": "/gnc/ekf"
										}
									}
								}
								*/

								// assume for now plugin.ros.track.type === 'ff_msgs/EkfState'
								//
								// TODO support other types of ROS messages according to
								// the value of plugin.ros.track.type
								//
								// WARNING
								// if you choose to use this method of following then don't
								// set your camera frame to anything other than "world"
								// this is something I need to fix in the future
								//
								let urdfTracker = new ROSLIB.Topic({
									ros: this.__ros,
									name: plugin.ros.track.name,
									messageType: plugin.ros.track.type,
									throttle_rate: plugin.ros.track.throttle || 100,
								});
								let tfClient = tfClientWithRender(this.__rosViewer, {
									subscribe: (frameID, tfUpdate) => {
										urdfTracker.subscribe(msg => {
											tfUpdate({
												translation: msg.pose.position,
												rotation: msg.pose.orientation,
											});
										});
									},
									unsubscribe: (frameID, tfUpdate) => {
										urdfTracker.unsubscribe();
									},
								});

								const rootObject = new THREE.Object3D();

								if (plugin.ros.param) {
									// TODO add explanation
									client = new ROS3D.UrdfClient({
										ros,
										tfClient: tfClient, // replace real tfclient with a fake one
										param: plugin.ros.param,
										tfPrefix: plugin.ros.tf,
										rootObject,
									});
								} else if (plugin.ros.package) {
									// TODO add explanation
									fetch(plugin.ros.package)
										.then(response => response.text())
										.then(urdfString => {
											// TODO explain this
											let urdfModel = new ROSLIB.UrdfModel({
												string: urdfString,
											});
											client = new ROS3D.Urdf({
												urdfModel,
												tfClient: tfClient, // replace real tfclient with a fake one
												param: plugin.ros.param,
												tfPrefix: plugin.ros.tf,
											});
											rootObject.add(client);
										});
								} else {
									console.error('bad ros arguments for urdf');
								}

								this.__rosViewer.addObject(rootObject);
								this.__rosViewer.addObjectToLayer(rootObject, plugin.layer ?? 'front', true);
							} else {
								// Option 2 for tracking a URDF: use ROS transforms
								/*
								{
									"name": "Astrobee",
									"key": "ros.view.astrobee",
									"ros": {
										"type": "urdf",
										"param": "/robot_description",
										"tf": ""
									}
								}
								*/

								const rootObject = new THREE.Object3D();

								if (plugin.ros.param) {
									// TODO add explanation
									client = new ROS3D.UrdfClient({
										ros,
										tfClient: this.__tfClient,
										param: plugin.ros.param,
										tfPrefix: plugin.ros.tf,
										rootObject,
									});
								} else if (plugin.ros.package) {
									fetch(plugin.ros.package)
										.then(response => response.text())
										.then(urdfString => {
											// TODO add explanation
											let urdfModel = new ROSLIB.UrdfModel({
												string: urdfString,
											});
											client = new ROS3D.Urdf({
												urdfModel,
												tfClient: this.__tfClient,
												param: plugin.ros.param,
												tfPrefix: plugin.ros.tf,
											});
											rootObject.add(client);
										});
								}

								this.__rosViewer.addObject(rootObject);
								this.__rosViewer.addObjectToLayer(rootObject, plugin.layer ?? 'front', true);
							}

							model.toggleOn = () => {
								// TODO add explanation
								if (client?.urdf.children) {
									client.urdf.children.forEach(function (n) {
										if (typeof n.subscribeTf === 'function') {
											n.subscribeTf();
										}
									});

									for (let i = 0; i < client.urdf.children.length; i++) {
										client.urdf.children[i].visible = true;
									}

									this.__rosViewer.shouldRender();
								}
							};

							model.toggleOff = () => {
								// TODO add explanation
								if (client?.urdf.children) {
									client.urdf.children.forEach(function (n) {
										if (typeof n.unsubscribeTf === 'function') {
											n.unsubscribeTf();
										}
									});

									for (let i = 0; i < client.urdf.children.length; i++) {
										client.urdf.children[i].visible = false;
									}

									this.__rosViewer.shouldRender();
								}
							};

							model.name = plugin.name;

							model.default = true;

							// user can toggle a URDF robot on or off
							return model;
						}
						// ---------------------------------------------
						case 'stl': {
							// For more information on STL, see the ThreeJS example:
							// https://threejs.org/examples/#webgl_loader_stl
							//
							let stlLoader = new THREE.STLLoader();

							model.default = true;
							model.name = plugin.name;

							stlLoader.load(plugin.ros.package, geometry => {
								let material = new THREE.MeshPhongMaterial(
									{
										color: plugin.ros.color || "#049ef4" // default to light blue if ros.color not provided
									}
								);
								let mesh = new THREE.Mesh(geometry, material);

								let sceneNode = new SceneNode({
									tfClient: this.__tfClient,
									frameID: plugin.ros.tf,
									object: mesh,
								});

								this.__rosViewer.addObject(sceneNode);
								this.__rosViewer.addObjectToLayer(sceneNode, plugin.layer ?? 'front', true);

								model.toggleOn = () => {
									sceneNode.tfClient.subscribe(sceneNode.frameID, sceneNode.tfUpdate);
									sceneNode.children.forEach(element => {
										element.visible = true;
									});
									this.__rosViewer.shouldRender();
								};
								model.toggleOff = () => {
									sceneNode.unsubscribeTf();
									sceneNode.children.forEach(element => {
										element.visible = false;
									});
									this.__rosViewer.shouldRender();
								};
							});

							// user can toggle a STL object on or off
							return model;
						}
						// ---------------------------------------------
						case 'ply': {
							// Load in a single PLY file
							//
							let plyLoader = new THREE.PLYLoader();
							plyLoader.load(plugin.ros.package, geometry => {
								const container = new THREE.Object3D();
								const sceneNode = new SceneNode({
									tfClient: this.__tfClient,
									frameID: plugin.ros.tf,
									object: container,
								});

								this.__rosViewer.addObject(sceneNode);

								const material = new THREE.MeshPhongMaterial({
									transparent: true,
									opacity: 0,
									// color: 'white'
								});
								const mesh = new THREE.Mesh(geometry, material);

								this.__rosViewer.addObjectToLayer(mesh, plugin.layer ?? 'front', true);
								container.add(mesh);

								this.__singleImageTextureMeshDupe = mesh.clone();
								container.add(this.__singleImageTextureMeshDupe);
								this.__rosViewer.addObjectToLayer(this.__singleImageTextureMeshDupe, 'middle', true);

								// Assumption: We may load a *single* STL model
								// onto which we place the Astrobee texture
								// stream. If this isn't the case, remove this
								// line.
								this.__singleImageTextureMesh(mesh);
							});

							// undefined = the user can't toggle this 3D object
							return undefined;
						}
						// ---------------------------------------------
						case 'gltf': {
							// Load in a single GLTF from file
							//

							// Assumption: if a `gltf` model is loaded, it is
							// assumed to be the only one that will be loaded,
							// and expected to be the one that has the
							// streaming texture from Astrobee.
							//
							// Ideally the system should be able to load any
							// number of models, and not treat them as the
							// model where the texture stream is rendered.
							//
							// See FIXME below.

							console.log('[gltf] loading in static gltf from file');

							this.__gltfLoader.load(plugin.ros.package, gltf => {
								// function to be called when parse complete

								console.log('[gltf] loaded in gltf', {gltf, plugin});

								const container = gltf.scene;

								// by wrapping the GLTF in a scene node, we can position it
								// using a ROS transform
								let sceneNode = new SceneNode({
									tfClient: this.__tfClient,
									frameID: plugin.ros.tf,
									object: container,
								});

								// add the ROS3D scene node into our three.js scene
								this.__rosViewer.addObject(sceneNode);

								const mesh = container.children[0];

								// Start the single-mesh invisible.
								mesh.material = new THREE.MeshPhongMaterial({transparent: true, opacity: 0});

								this.__rosViewer.addObjectToLayer(mesh, plugin.layer ?? 'front', true);

								this.__singleImageTextureMeshDupe = mesh.clone();
								container.add(this.__singleImageTextureMeshDupe);
								this.__rosViewer.addObjectToLayer(this.__singleImageTextureMeshDupe, 'middle', true);

								// FIXME We can only load one GLTF model into
								// the scene, otherwise loading more than one
								// will cause __singleImageTextureMesh to be
								// set more than once here, and therefore will
								// probably break the Astrobee texture stream.
								this.__singleImageTextureMesh(mesh);

								// let params = {
								// 	"scaleX": 1.0901207979188867,
								// 	"scaleY": 0.9925708428135253,
								// 	"scaleZ": 1.0998757934294228,
								// 	"translateX": -1,
								// 	"translateY": -0.556283190319363,
								// 	"translateZ": -0.6429942615241288
								// };
								let paramsArray = [-1.16635919, -0.15521732, -0.43308945, 1.1019435, 1.02120471, 1.0563333];
								let params = {
									translateX: paramsArray[0],
									translateY: paramsArray[1],
									translateZ: paramsArray[2],
									scaleX: paramsArray[3],
									scaleY: paramsArray[4],
									scaleZ: paramsArray[5],
								};

								// let params = {
								// 	"scaleX": 1,
								// 	"scaleY": 1,
								// 	"scaleZ": 1,
								// 	"translateX": 0,
								// 	"translateY": 0,
								// 	"translateZ": 0
								// };

								window.meshParams = params;

								mesh.currentTranslation = {
									x: 0.0,
									y: 0.0,
									z: 0.0,
								};

								this.__datGui.add(params, 'scaleX', 0.9, 1.2).onChange(value => {
									mesh.scale.set(value, mesh.scale.y, mesh.scale.z);
									this.__rosViewer.shouldRender();
								});
								this.__datGui.add(params, 'scaleY', 0.9, 1.2).onChange(value => {
									mesh.scale.set(mesh.scale.x, value, mesh.scale.z);
									this.__rosViewer.shouldRender();
								});
								this.__datGui.add(params, 'scaleZ', 0.9, 1.2).onChange(value => {
									mesh.scale.set(mesh.scale.x, mesh.scale.y, value);
									this.__rosViewer.shouldRender();
								});

								mesh.scale.set(params.scaleX, params.scaleY, params.scaleZ);

								this.__datGui.add(params, 'translateX', -2.0, 2.0).onChange(value => {
									mesh.translateX(value - mesh.currentTranslation.x);
									mesh.currentTranslation.x = value;
									this.__rosViewer.shouldRender();
								});
								this.__datGui.add(params, 'translateY', -2.0, 2.0).onChange(value => {
									mesh.translateY(value - mesh.currentTranslation.y);
									mesh.currentTranslation.y = value;
									this.__rosViewer.shouldRender();
								});
								this.__datGui.add(params, 'translateZ', -2.0, 2.0).onChange(value => {
									mesh.translateZ(value - mesh.currentTranslation.z);
									mesh.currentTranslation.z = value;
									this.__rosViewer.shouldRender();
								});

								mesh.translateX(params.translateX - mesh.currentTranslation.x);
								mesh.currentTranslation.x = params.translateX;
								mesh.translateY(params.translateY - mesh.currentTranslation.y);
								mesh.currentTranslation.y = params.translateY;
								mesh.translateZ(params.translateZ - mesh.currentTranslation.z);
								mesh.currentTranslation.z = params.translateZ;

								this.__rosViewer.shouldRender();
							});

							// undefined = the user can't toggle this 3D object
							return undefined;
						}
						// ---------------------------------------------
						case 'visualization_msgs/Marker': {
							let markerClient = (model.object = new ROS3D.MarkerClient({
								ros,
								tfClient: this.__tfClient,
								topic: plugin.ros.topic,
								rootObject: this.__rosViewer.scene,
							}));
							model.toggleOn = markerClient.subscribe;
							model.toggleOff = () => {
								markerClient.unsubscribe();
								for (let markerInM in markerClient.markers) {
									markerClient.rootObject.remove(markerClient.markers[markerInM]);
								}
								this.__rosViewer.shouldRender();
							};
							model.name = plugin.name;

							// Queue a re-render any time the model is updated.
							markerClient.on('change', () => this.__rosViewer.shouldRender());

							return model;
						}
						// ---------------------------------------------
						case 'visualization_msgs/MarkerArray': {
							const client = new ROS3D.MarkerArrayClient({
								ros,
								tfClient: this.__tfClient,
								topic: plugin.ros.topic,
								rootObject: this.__rosViewer.scene,
							});

							model.toggleOn = client.subscribe;
							model.toggleOff = () => {
								client.unsubscribe();
								for (let markerInM in client.markers) {
									client.rootObject.remove(client.markers[markerInM]);
								}
								this.__rosViewer.shouldRender();
							};
							model.name = plugin.name;

							// Queue a re-render any time the client is updated.
							client.on('change', () => this.__rosViewer.shouldRender());

							return model;
						}
						// ---------------------------------------------
						case 'visualization_msgs/InteractiveMarker': {
							const client = new ROS3D.InteractiveMarkerClient({
								ros,
								tfClient: this.__tfClient,
								rootObject: this.__rosViewer.scene,
								// topic: plugin.ros.topic,
								camera: this.__rosViewer.camera,
								rosViewer: this.__rosViewer
							});
							model.toggleOn = () => {
								console.log("interactive marker subs");
								// client.subscribe(undefined, plugin.ros.topic + '/update_full', plugin.ros.topic + '/update');
								client.subscribe(plugin.ros.topic, plugin.ros.topic + '/update_full', plugin.ros.topic + '/update');
								this.__rosViewer.shouldRender();

								// this.__rosViewer.addObjectToLayer(client.scene, plugin.layer ?? 'front', true);
							};
							model.toggleOff = () => {
								console.log("interactive marker unsubs");
							};
							model.name = plugin.name;
							model.default = true;

							model.toggleOn();

							this.__rosViewer.shouldRender();

							return model;
						}
						// ---------------------------------------------
						case 'std_msgs/String': {
							// WIP
							// Subscribe to the /mapper_gltf topic which will send GLTFs as JSON strings
							// TODO: ROS string unfortunately don't carry a timestamp
							// therefore we will have to change the message type in the future
							// to something that does have a timestamp, such as sensor_msgs/Image
							// NOTE: Not sure about ROS 1, but in ROS 2 all messages
							// have time stamps outside of their type. For a given message,
							// it's the time at which the message was sent, rather than the
							// timestamp generated by a ROS process making the message.
							this.__subscribeToRealtimeGLTF();

							// undefined = the user can't toggle this 3D object
							return undefined;
						}
						// ---------------------------------------------
						default: {
							console.error('Undefined viewer plugin provided', {plugin});
							return undefined;
						}
					}
				})
				.filter(x => x !== undefined);

			// add plugins toggle buttons to the GUI menu
			this.__viewerPlugins.map(x => {
				// turn off the plugin visibility by default
				if (!x.default) {
					x.toggleOff();
				}

				// reflect the default value
				let params = {};
				params[x.name] = false;
				if (x.default) {
					params[x.name] = true;
				}

				// add a toggle button
				this.__datGui.add(params, x.name).onChange(value => {
					if (value) {
						x.toggleOn();
					} else {
						x.toggleOff();
					}

					// Queue a re-render anytime the option changes.
					this.__rosViewer.shouldRender();
				});
			});
		}

		var params = {
			'World Lighting': [LightMode.Box, LightMode.Octa].includes(lightMode)
				? 0.42
				: lightMode === LightMode.AmbientOnly
				? 1
				: 1,
		};

		const lights = this.__makeLights(params);

		const intensityRange = [LightMode.Octa, LightMode.Box].includes(lightMode)
			? 1.5
			: LightMode.AmbientOnly === lightMode
			? 1.0
			: 1.0;

		gui.add(params, 'World Lighting', 0.0, intensityRange).onChange(lights.onIntensityChange);

		// Queue a render after initial setup.
		this.__rosViewer.shouldRender();
	}

	__makeLights(params) {
		// Three.js does not have light clustering or deferred rendering
		// yet, which allows for performant multi-light rendering. We would
		// need to fork THREE.WebGLRenderer.
		//
		// More info on these techniques:
		//
		// https://hacks.mozilla.org/2014/01/webgl-deferred-shading/
		//   links to https://github.com/tiansijie/Tile_Based_WebGL_DeferredShader
		// https://discourse.threejs.org/t/dr-strangelight-or-how-i-learned-to-stop-worrying-and-love-the-cluster/23104/14
		// https://github.com/AmanSachan1/WebGL-Clustered-Deferred-Forward-Plus
		// https://alteredqualia.com/three/examples/webgl_deferred_postprocessing.html
		// https://va3c.github.io/three.js/examples/webgldeferred_pointlights.html
		// https://github.com/mrdoob/three.js/issues/7095
		// https://twitter.com/garrettkjohnson/status/1263135280380305415
		//   by Garrett Johnson from JPL

		// for reference: astrobee dock position is
		// x = 9.8, y = -9.8, z = 4.3
		if (lightMode === LightMode.AmbientOnly) {
			this.__worldLights = [new THREE.AmbientLight('white', params['World Lighting'])];
			this.__rosViewer.addObject(this.__worldLights[0]);
			this.__rosViewer.addObjectToAllLayers(this.__worldLights[0]);
		} else if (lightMode === LightMode.Octa) {
			// approximately ISS center
			const x = 5;
			const y = -2;
			const z = 5;

			this.__worldLights = [
				this.__addPointLightToScene({x: x + 0, y: y + 20, z: z + 0}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 0, y: y + -20, z: z + 0}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 20, y: y + 0, z: z + 0}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + -20, y: y + 0, z: z + 0}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 0, y: y + 0, z: z + 20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 0, y: y + 0, z: z + -20}, params['World Lighting'], 'world'),
			];
		} else if (lightMode === LightMode.Box) {
			// approximately ISS center
			const x = 5;
			const y = -2;
			const z = 5;

			this.__worldLights = [
				this.__addPointLightToScene({x: x + 20, y: y + 20, z: z + 20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 20, y: y + 20, z: z + -20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 20, y: y + -20, z: z + 20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + 20, y: y + -20, z: z + -20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + -20, y: y + 20, z: z + 20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + -20, y: y + 20, z: z + -20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + -20, y: y + -20, z: z + 20}, params['World Lighting'], 'world'),
				this.__addPointLightToScene({x: x + -20, y: y + -20, z: z + -20}, params['World Lighting'], 'world'),
			];
		}

		return {
			onIntensityChange: value => {
				for (let i = 0; i < this.__worldLights.length; i++) {
					this.__worldLights[i].intensity = value;
				}

				// Queue a re-render on light intensity GUI changes
				this.__rosViewer.shouldRender();
			},
		};
	}

	/**
	 * Add a point light into a ROS scene
	 *
	 * @returns nothing
	 */
	__addPointLightToScene(positionObject, intensity, frameID) {
		// TODO this function needs major clean-up
		let pointLight = new THREE.PointLight(0xffffff, intensity, 0, 2.0);
		pointLight.castShadow = true;
		pointLight.shadow.bias = -0.0001;
		// pointLight.shadow.mapSize.width = 1024*4;
		// pointLight.shadow.mapSize.height = 1024*4;

		if (DEBUG) {
			const helper = new THREE.PointLightHelper(pointLight, 0.15);
			this.__rosViewer.addObject(helper);
			this.__rosViewer.addObjectToLayer(helper, 'back', true);

			const mat = new THREE.MeshBasicMaterial({color: 'limegreen', side: THREE.DoubleSide});
			const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1), mat);
			// bulb.castShadow = false;
			// bulb.receiveShadow = false;
			pointLight.add(bulb);
			console.log('Add debug light helper');
		}

		let position = new ROSLIB.Vector3(positionObject);
		let orientation = new ROSLIB.Quaternion();
		let pose = new ROSLIB.Pose({position, orientation});

		let pointLightSceneNode = new SceneNode({
			tfClient: this.__tfClient,
			frameID: frameID,
			object: pointLight,
			pose: pose,
		});

		this.__rosViewer.addObject(pointLightSceneNode);
		this.__rosViewer.addObjectToAllLayers(pointLightSceneNode, true);

		return pointLight;
	}

	__makeStars() {
		// TODO explain
		const stars = new THREE.Mesh(
			new THREE.SphereBufferGeometry(5000),
			new THREE.MeshBasicMaterial({
				color: 'white',
				// TODO download this and put it in this repo, we should not be loading in stuff from codepen
				map: new THREE.TextureLoader().load('//assets.codepen.io/191583/galaxy_starfield.png'),
				side: THREE.DoubleSide,
			})
		);

		stars.castShadow = false;
		stars.receiveShadow = false;

		this.__rosViewer.addObject(stars);
		this.__rosViewer.addObjectToLayer(stars, 'back');
	}

	__renderEffectStoppers = [];

	/** @type {boolean} */
	__singleMeshTextureIsCreated = false;

	// Start to decouple render effect from handling of incoming data by moving
	// render effect here. Set reactive variables with the data needed for
	// rendering, then react to the changes here.
	//
	// This will make it easier to migrate to declarative systems like
	// react-three-fiber or LUME later if we want to, without having to
	// detangle things later.
	__startRenderEffects() {
		// TODO for Joe: scope any console log comments with a debug statement, clean up if need be
		this.__renderEffectStoppers.push(
			autorun(() => {
				if (!this.__singleImageTextureMesh()) return;

				if (!this.__singleImageTextureMeshDupe) throw new Error('Expected dupe texture to exist by now.');

				this.__singleImageTextureMeshDupe.material = new THREE.MeshPhongMaterial({
					// The transparent blue happens to match with the OpenMCT theme.
					color: new THREE.Color(0, 0.5, 1),
					transparent: true,
					opacity: 0.4,
				});
				this.__singleImageTextureMeshDupe.material.needsUpdate = true;

				this.__rosViewer.shouldRender();
			}),
			autorun(() => {
				if (this.__singleMeshTextureVersion() === 0) return;

				const canvas = this.__singleMeshTextureCanvas();
				const mesh = this.__singleImageTextureMesh();

				if (!(canvas && mesh)) return;

				console.log('Canvas and mesh both available. Rendering...');

				if (!this.__singleMeshTextureIsCreated) {
					this.__singleMeshTextureIsCreated = true;

					// Only create a texture once, initially.
					console.log('create initial texture');

					const texture = new THREE.Texture(canvas);
					texture.flipY = false;
					texture.minFilter = THREE.NearestFilter;
					texture.needsUpdate = true;

					mesh.material = new THREE.MeshPhongMaterial({
						map: texture,
						color: 'white',
						transparent: true,
					});
					mesh.material.needsUpdate = true;
				} else {
					// We only create the texture once, initially, so we just signal that it was updated.
					console.log('reuse texture');
					if (Array.isArray(mesh.material)) throw new Error('Material arrays not handled.');

					// This is how to do a type (up)cast in plain JS with JSDom
					// syntax (note the parentheses are required, and Prettier
					// will leave them). It is a bit cumbersome compared to
					// regular TS syntax.
					const mat = /** @type {THREE.MeshPhongMaterial} */ (mesh.material);

					mat.map.needsUpdate = true;
				}

				this.__rosViewer.shouldRender();
			})
		);

		this.__renderEffectStoppers.push(stop);
	}

	__stopRenderEffects() {
		for (const stop of this.__renderEffectStoppers) stop();
	}

	connectedCallback() {
		this.__possiblyInitialize();
	}

	disconnectedCallback() {
		this.__initialized = false;
		this.__resizeObserver?.unobserve(this);
		this.__datGui?.destroy();
		// stops the viewer's render loop if any
		this.__rosViewer?.stop();
		// unsubscribes all ROS3D Clients
		this.__tfClient?.dispose();
		this.__imageListener?.unsubscribe();
		for (const stop of this.__subscriptionStoppers) stop();
		this.__stopRenderEffects();
		this.__ros?.close();
	}

	// The following show() and destroy() methods are called by OpenMCT if this
	// element is returned to OpenMCT from a provider `view()`.

	/**
	 * @param {HTMLElement} container
	 */
	show(container) {
		container.append(this);
	}

	destroy() {
		this.remove();
	}
}

customElements.define('robot-scene', RobotScene);

/**
 * Generates a ROS 3D view
 *
 * @returns The plugin install function.
 */
export function RosView() {
	/**
	 * @param {Record<string, any>} openmct
	 */
	function install(openmct) {
		openmct.types.addType('ros.view', {
			name: 'ROS View',
			cssClass: 'icon-image',
			description: 'A 3D visualization of a ROS environment',
			creatable: true,
		});
		openmct.objectViews.addProvider({
			key: 'ros.view',
			name: 'ROS View',
			cssClass: 'icon-image',
			canView(domainObject) {
				return domainObject.type === 'ros.view';
			},
			priority(domainObject) {
				return 1;
			},
			view(domainObject) {
				const scene = new RobotScene();
				scene.openmct = openmct;
				scene.domainObject = domainObject;
				return scene;
			},
		});
	}

	return install;
}

async function getConfig() {
	const response = await fetch('/api/config.json');
	return await response.json();
}
