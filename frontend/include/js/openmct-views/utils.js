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

/**
 * @param {ImageSizeOpts} options
 * @returns {Promise<ImageSize>}
 */
export function getImageSize(options) {
	let size = cache.get(options);

	if (size) return Promise.resolve(size);

	/** @type {(value: ImageSize) => void} */
	let resolve;

	/** @type {(error: Error) => void} */
	let reject;

	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	const img = new Image();

	img.onload = () => {
		size = {width: img.naturalWidth, height: img.naturalHeight};
		cache.set(options, size);
		resolve(size);
	};
	img.onerror = () => reject(new Error('Failed to load image for URL: ' + options?.imgUrl));
	img.src = options.imgUrl;

	return promise;
}

/** @typedef {{imgUrl: string}} ImageSizeOpts */
/** @typedef {{width: number, height: number}} ImageSize */

/** @type {WeakMap<ImageSizeOpts, ImageSize>} */
const cache = new WeakMap();

/**
 * Extend a tfClient instance so that it triggers a re-render on updates.
 *
 * @param {import('./RobotSceneRos3dViewer').RobotSceneRos3dViewer} viewer
 * @param {ROS3D.TFClient} tfClient
 *
 * @returns {ROS3D.TFClient} The extended client (not the same reference that was passed in).
 */
export function tfClientWithRender(viewer, tfClient) {
	return {
		__proto__: tfClient,

		// Override the TFClient's subscribe method.
		subscribe(frameId, callback) {
			const newCallback = (...args) => {
				// Call the original
				callback(...args);

				// Queue a re-render on any TF updates.
				viewer.shouldRender();
			};

			super.subscribe(frameId, newCallback);
		},
	};
}
