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

// @ts-check

// Cleanup helpers adapted from https://github.com/lume/lume/blob/a16fc59473e11ac53e7fa67e1d3cb7e060fe1d72/src/utils/three.ts
// XXX We could import Three.js types to use here instead of these manual (and
// inaccurate) placeholders.

/**
 * @typedef {Record<string, any>} Object3D
 */

/**
 * @typedef {Record<string, any>} Obj
 */

/**
 * @typedef {{material: Obj, geometry: Obj}} Renderable
 */

/**
 * @param {any} obj
 * @returns {obj is Renderable}
 */
export function isRenderItem(obj) {
	return 'geometry' in obj && 'material' in obj;
}

/**
 * @param {Object3D} obj
 */
export function disposeMaterial(obj) {
	if (!isRenderItem(obj)) return;

	// because obj.material can be a material or array of materials
	const materials = [].concat(obj.material);

	for (const material of materials) {
		material.dispose();
	}
}

/**
 * @param {Object3D} obj
 */
export function disposeObject(obj, removeFromParent = true, destroyGeometry = true, destroyMaterial = true) {
	if (!obj) return;

	if (isRenderItem(obj)) {
		if (obj.geometry && destroyGeometry) obj.geometry.dispose();
		if (destroyMaterial) disposeMaterial(obj);
	}

	removeFromParent &&
		Promise.resolve().then(() => {
			// if we remove children in the same tick then we can't continue traversing,
			// so we defer to the next microtask
			obj.parent && obj.parent.remove(obj);
		});
}

/**
 * @typedef {Partial<{
 *   removeFromParent: boolean
 *   destroyGeometry: boolean
 *   destroyMaterial: boolean
 * }>} DisposeOptions
 */

/**
 * @param {Object3D} obj
 * @param {DisposeOptions} disposeOptions
 */
export function disposeObjectTree(obj, disposeOptions = {}) {
	obj.traverse(node => {
		disposeObject(
			node,
			disposeOptions.removeFromParent,
			disposeOptions.destroyGeometry,
			disposeOptions.destroyMaterial
		);
	});
}
