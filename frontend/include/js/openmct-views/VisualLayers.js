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

// Adapted from https://discourse.threejs.org/t/12503/35

// @ts-check

/** Allows rendering objects into one ore more visual layers that are stacked on top of each other. Each layers renders  */
export class VisualLayers {
	/** @type {Array<Layer>} */
	__layers = [];
	/** @type {THREE.Renderer} */
	__renderer;
	/** @type {typeof THREE.Scene} */
	__Scene;

	/**
	 * @param {THREE.Renderer} renderer The `THREE.Renderer` (f.e. `THREE.WebGLRenderer`) that
	 * will be used to render the layers.
	 * @param {typeof THREE.Scene} Scene The `THREE.Scene` class that will be used for each layer
	 * (one per layer). If not provided, `THREE.Scene` is used by default.
	 */
	// IDEA: Optionally accept different Scene types per layer.
	constructor(renderer, Scene = THREE.Scene) {
		this.__renderer = renderer;
		this.__Scene = Scene;
	}

	dispose() {
		this.__layers.length = 0;
	}

	/**
	 * Defines a new layer.
	 * @param {LayerName} layerName The name to give the layer.
	 * @param order The order it will have. The newly-defined layer will
	 * render above other layers that have lower numbers, and below other layers
	 * that have higher order numbers.
	 * @returns {Layer} The created object representing the layer.
	 */
	defineLayer(layerName, order = 0) {
		const layer = this.__getOrMakeLayer(layerName);

		const previousOrder = layer.order;
		layer.order = order;

		// Sort only if order changed.
		if (previousOrder !== layer.order) this.__layers.sort((a, b) => a.order - b.order);

		return layer;
	}

	/**
	 * Set the visibility of one or more layers.
	 * @param {LayerNames} layerNames The name of a layer (or array of names of layers) that will have its (their) visibility set.
	 * @param {boolean} visible A boolean indicating whether the layer or layers should be visible.
	 */
	setLayerVisible(layerNames, visible) {
		if (typeof layerNames == 'string') return this.__setLayerVisible(layerNames, visible);
		for (const name of layerNames) this.__setLayerVisible(name, visible);
	}

	/**
	 * @param {LayerName} layerName
	 * @param {boolean} visible
	 */
	__setLayerVisible(layerName, visible) {
		const layer = this.__layers.find(l => l.name === layerName);
		if (!layer) throw new Error('Can not set visibility of layer that does not exist.');
		layer.visible = visible;
	}

	/**
	 * Get a layer by name (if it doesn't exist, creates it with default order 0).
	 * @param {LayerName} layerName
	 * @returns {Layer}
	 */
	__getOrMakeLayer(layerName) {
		let layer = this.__layers.find(l => l.name === layerName);

		if (!layer) {
			layer = {name: layerName, backingScene: new this.__Scene(), order: 0, visible: true};
			layer.backingScene.autoUpdate = false;
			this.__layers.push(layer);
		}

		return layer;
	}

	/**
	 * Remove a layer.
	 * @param {LayerName} layerName The name of the layer to remove.
	 */
	removeLayer(layerName) {
		const index = this.__layers.findIndex(l => {
			if (l.name === layerName) {
				l.backingScene.children.length = 0;
				return true;
			}

			return false;
		});

		if (index >= 0) this.__layers.splice(index, 1);
	}

	/**
	 * Check if a layer exists.
	 * @param {LayerName} layerName The name of the layer to check existence of.
	 * @returns {boolean} A boolean indicating if the layer exists.
	 */
	hasLayer(layerName) {
		return this.__layers.some(l => l.name === layerName);
	}

	/**
	 * @returns {number}
	 */
	get layerCount() {
		return this.__layers.length;
	}

	/**
	 * Add an object (anything that is or extends from THREE.Object3D) to the named layer (or named layers).
	 *
	 * @param {THREE.Object3D} obj The object to add. Must be an `instanceof THREE.Object3D`.
	 *
	 * @param {LayerNames} layerNames The name of a layer (or array of names of layers) that
	 * the object will be added to. If an object is added to multiple layers, the
	 * object will be rendered multiple times, once per layer.
	 *
	 * @param {boolean | undefined} withSubtree When true, this causes an object that was added into
	 * specified layer(s) be rendered with its (grand)children, rather than it
	 * being rendered only by itself without any of its (grand)children.
	 *
	 * It is useful for `withSubtree` to be set to `false` (the default) when you
	 * want to have a hierarchy with different parts of the hierarchy rendered
	 * in different layers
	 *
	 * On the other hand, sometimes you have a whole tree that you want to put in
	 * a layer and don’t want to have to specify layers for all of the sub-nodes.
	 * Set `withSubtree` to `true` in this case to add a root node to a layer
	 * to render that whole subtree in that layer.
	 *
	 * It is easier to add a whole tree into a layer with `withSubtree` as
	 * `true`. When `withSubtree` is `false` each node in a subtree would
	 * need to be added to a layer manually, but this allows more fine grained control of
	 * which parts of a tree will render in various layers.
	 */
	addObjectToLayer(obj, layerNames, withSubtree = false) {
		if (typeof layerNames == 'string') return this.__addObjectToLayer(obj, layerNames, withSubtree);
		for (const name of layerNames) this.__addObjectToLayer(obj, name, withSubtree);
	}

	/**
	 * Similar to `addObjectToLayer`, but for adding multiple objects at once.
	 * @param {THREE.Object3D[]} objects An array of objects that are `instanceof THREE.Object3D`.
	 * @param {LayerNames} layerNames The layer or layers to add the objects to.
	 * @param {boolean | undefined} withSubtree Whether rendering of the objects will also render their
	 * children. See `withSubtree` of `addObjectToLayer`
	 */
	addObjectsToLayer(objects, layerNames, withSubtree = false) {
		for (const obj of objects) this.addObjectToLayer(obj, layerNames, withSubtree);
	}

	addObjectToAllLayers(obj, withSubtree = false) {
		for (const layer of this.__layers) this.__addObjectToLayer(obj, layer.name, withSubtree);
	}

	addObjectsToAllLayers(objects, withSubtree = false) {
		for (const obj of objects) this.addObjectToAllLayers(obj, withSubtree);
	}

	/** @readonly */
	__emptyArray = Object.freeze([]);

	/**
	 * @param {THREE.Object3D} obj
	 * @param {LayerName} layerName
	 * @param {boolean | undefined} withSubtree
	 */
	__addObjectToLayer(obj, layerName, withSubtree) {
		const layer = this.__getOrMakeLayer(layerName);

		if (!this.__layerHasObject(layer, obj)) {
			const proxy = Object.create(obj, withSubtree ? {} : {children: {get: () => this.__emptyArray}});

			// We use `children.push()` here instead of `children.add()` so that the
			// added child will not be removed from its parent in its original scene.
			// This allows us to add an object to multiple layers, and to not
			// interfere with the user's original tree.
			layer.backingScene.children.push(proxy);
		}
	}

	/**
	 * @param {Layer} layer
	 * @param {THREE.Object3D} obj
	 * @return {boolean}
	 */
	__layerHasObject(layer, obj) {
		return layer.backingScene.children.some(proxy => proxy.__proto__ === obj);
	}

	/**
	 * Remove an object from a layer or set of layers.
	 * @param {THREE.Object3D} obj The object to remove from the specified layer or layers.
	 * @param {LayerNames} layerNames The layer or layers from which to remove the object from.
	 */
	removeObjectFromLayer(obj, layerNames) {
		if (typeof layerNames == 'string') {
			const layer = this.__layers.find(l => l.name === layerNames);
			return this.__removeObjectFromLayer(obj, layer);
		}

		for (const name of layerNames) {
			const layer = this.__layers.find(l => l.name === name);
			this.__removeObjectFromLayer(obj, layer);
		}
	}

	/**
	 * @param {THREE.Object3D} obj
	 * @param {Layer | undefined} layer The layer or layers from which to remove the object from.
	 */
	__removeObjectFromLayer(obj, layer) {
		if (!layer) throw new Error('Can not remove object from layer that does not exist.');

		const children = layer.backingScene.children;
		const index = children.findIndex(proxy => proxy.__proto__ === obj);

		if (index >= 0) {
			children[index] = children[children.length - 1];
			children.pop();
		}
	}

	/**
	 * Remove the given objects from all layers they may belong to.
	 * @param {THREE.Object3D[]} objects The objects to remove.
	 */
	removeObjectsFromAllLayers(objects) {
		for (const layer of this.__layers) for (const obj of objects) this.__removeObjectFromLayer(obj, layer);
	}

	/**
	 * Render visible layers.
	 * @param {THREE.Camera} camera A THREE.Camera to render all the layers with.
	 * @param {BeforeAllCallback | undefined} beforeAll Optional: Called before rendering all layers. If not
	 * supplied, the default value will turn off the rendere's auto clearing, so that
	 * each layer can be manually drawn stacked on top of each other.
	 * @param {BeforeEachCallback | undefined} beforeEach Optional: When the layers are being rendered in the order they are
	 * defined to be in, this callback will be called right before a layer is
	 * rendered. It will be passed the name of the layer that is about to be
	 * rendered. By default, this does nothing.
	 * @param {AfterEachCallback | undefined} afterEach Optional: When the layers are being rendered in the order
	 * they are defined to be in, this callback will be called right after a
	 * layer is rendered. It will be passed the name of the layer that was just
	 * rendered. The default is that `clearDepth()` will be called on a
	 * `WebGLRenderer` to ensure layers render on top of each other from low
	 * order to high order. If you provide your own callback, you'll have to
	 * remember to call `clearDepth` manually, unless you wish for layers to blend into
	 * the same 3D space rather than appaering as separate scenes stacked on
	 * top of each other.
	 */
	// IDEA: Allow different cameras per layer? It may not be common, but could
	// be useful for, for example, making background effects, etc.
	render(
		camera,
		beforeAll = this.__defaultBeforeAllCallback,
		beforeEach = this.__defaultBeforeEachCallback,
		afterEach = this.__defaultAfterEachCallback
	) {
		beforeAll();
		for (const layer of this.__layers) {
			if (!layer.visible) continue;
			beforeEach(layer.name);
			this.__renderer.render(layer.backingScene, camera);
			afterEach(layer.name);
		}
	}

	__defaultBeforeAllCallback = () => {
		if (this.__renderer instanceof THREE.WebGLRenderer) {
			this.__renderer.autoClear = false;
			this.__renderer.clear();
		}
	};

	__defaultBeforeEachCallback = () => {};

	__defaultAfterEachCallback = () => {
		// By default, the depth of a WebGLRenderer is cleared, so that layers
		// render on top of each other in order from lowest to highest order value.
		if (this.__renderer instanceof THREE.WebGLRenderer) this.__renderer.clearDepth();
	};
}

/** @typedef {string} LayerName */
/** @typedef {LayerName | LayerName[]} LayerNames */

/** @typedef {{name: LayerName; backingScene: THREE.Scene; order: number; visible: boolean}} Layer */
/** @typedef {(layerName: LayerName) => void} BeforeEachCallback */
/** @typedef {() => void} BeforeAllCallback */
/** @typedef {(layerName: LayerName) => void} AfterEachCallback */
