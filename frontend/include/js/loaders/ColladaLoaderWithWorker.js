const ONE_WORKER_PER_MODEL = true;

const colladaWorkerUrl = '/include/js/loaders/ColladaWorker.js';
const objectLoader = new THREE.ObjectLoader();

let _SingleColladaWorker;

class ColladaLoaderWithWorker {
	async load(url, onLoad, onProgress, onError) {
		console.log(' ------------ ColladaLoaderWithWorker');

		let worker;
		let ColladaWorker;

		if (ONE_WORKER_PER_MODEL) {
			worker = new Worker(colladaWorkerUrl);
			ColladaWorker = Comlink.wrap(worker);
		} else {
			if (!_SingleColladaWorker) {
				worker = new Worker(colladaWorkerUrl);
				_SingleColladaWorker = Comlink.wrap(worker);
			}

			ColladaWorker = _SingleColladaWorker;
		}

		const colladaWorker = await new ColladaWorker();

		onLoad =
			onLoad &&
			Comlink.proxy(collada => {
				console.log(' --- onLoad', collada);
				collada = {scene: objectLoader.parse(collada.scene)};
				onLoad(collada);

				if (ONE_WORKER_PER_MODEL) {
					setTimeout(() => {
						worker.terminate();
					});
				}
			});

		onProgress = onProgress && Comlink.proxy(onProgress);
		onError = onError && Comlink.proxy(onError);

		await colladaWorker.load(url, onLoad, onProgress, onError);
	}
}

THREE.ColladaLoaderWithWorker = ColladaLoaderWithWorker;
