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

class Image {
	// When Texture.toJSON is called, it will read the `src`
	// sent property and that what will be sent through
	// Worker.postMessage. On the other side, the image still
	// has to be loaded from the URL, and then finally
	// sent into the GPU. Can we make it faster if we supply an
	// ImageBitmap instead (pre-computed here in the worker)?
	set src(v) {
		this.__src = v;
		this.__load();
	}
	get src() {
		return this.__src;
	}

	__src;

	__onLoad = () => {};

	addEventListener(name, callback) {
		if (name === 'load') {
			this.__onLoad = callback;
		}
		// TODO 'error' event
	}

	async __load() {
		// This makes Texture.toJSON grab the original `src` value
		// and simply send it back (main thread will do the actual
		// fetching).
		await new Promise(r => setTimeout(r, 0));

		// // This replaces the src URL with a Blob URL and that is
		// // sent back to main thread. Is it faster?
		// console.log('-- USE FETCH TO BLOB METHOD');
		// const response = await fetch(this.#src);
		// const blob = await response.blob();
		// this.#src = URL.createObjectURL(blob);

		const event = {
			target: this,
			currentTarget: this,
		};

		this.__onLoad(event);
	}
}

importScripts(
	'/include/js/prebuilt/roslib.js',
	'/include/js/prebuilt/ros3d.js',
	'/include/js/prebuilt/comlink.js',
	'/include/js/prebuilt/DOMParser.js'
);

class ColladaWorker {
	load(url, onLoad, onProgress, onError) {
		// We use a custom LoadingManager so that we can wait not just for the
		// ColladLoader meshes to be loaded, but also for any textures to also be
		// loaded. More info: https://discourse.threejs.org/t/25304
		const manager = new THREE.LoadingManager();

		const loader = new THREE.ColladaLoader(manager);

		let collada;

		manager.onLoad = () => {
			collada = {scene: collada.scene.toJSON()};

			// We call this here, instead of in the loader's onLoad, otherwise the
			// loader's onLoad is called with meshes loaded but textures not yet
			// loaded.
			onLoad(collada);
		};

		manager.onError = onError;

		loader.load(url, c => (collada = c), onProgress, onError);
	}
}

Comlink.expose(ColladaWorker);
