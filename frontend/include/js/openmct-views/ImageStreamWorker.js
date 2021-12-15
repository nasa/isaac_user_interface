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

// Polyfill some things for in-worker code.
globalThis.window = globalThis;
globalThis.document = {
	createElementNS: (ns, tag) => createElement(tag),
	createElement,
};

function createElement(tagname) {
	if (tagname === 'img') return new Image();
	else throw new Error('Other mock elements not yet implemented.');
}

// NOTE, `import` syntax is not supported inside Workers in Firefox yet.
// prettier-ignore
importScripts(
	'/include/js/prebuilt/roslib.js',
	'/include/js/prebuilt/ros3d.js',
	'/include/js/prebuilt/comlink.js',
);

class ImageStreamWorker {
	/**
	 * @type {OffscreenCanvas}
	 */
	canvas;

	/**
	 * @type {OffscreenCanvasRenderingContext2D}
	 */
	context;

	/**
	 * @param {OffscreenCanvas} canvas
	 */
	async setCanvas(canvas) {
		this.canvas = canvas;
		this.context = canvas.getContext('2d');
	}

	/**
	 * @param {string} imgUrl
	 */
	async processImage(imgUrl) {
		if (!this.canvas) {
			throw new TypeError(
				'Make sure to pass a canvas to setCanvas from the main thread first (and await for the call to finish).'
			);
		}

		const response = await fetch(imgUrl);
		const blob = await response.blob();
		const bitmap = await createImageBitmap(blob);

		// Draw the bitmaps onto the same canvas, merging them each
		// time a new one arrives.
		// TODO draw only the sub-image, to make it faster. We need to know
		// what the sub-image position and size is.
		// NEW resize the bitmap to the canvas width and height
		this.context.drawImage(bitmap, 0, 0, this.canvas.width, this.canvas.height);
	}
}

Comlink.expose(ImageStreamWorker);
