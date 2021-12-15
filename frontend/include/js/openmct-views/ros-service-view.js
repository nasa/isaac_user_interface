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

const DEBUG = false;

class RosServiceScene extends HTMLElement {
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
	__rosViewer;
	__ros;

	constructor() {
		super();

		this.id = 'rosServiceScene';

		this.style.setProperty('display', 'block');
		this.style.setProperty('width', '100%');
		this.style.setProperty('height', '50px');
	}

	onLoad() {
		this.serviceArguments = [];

		// if the ROS service has arguments (i.e.: it is not an empty service call)
		// then we will provide drop down menus
		if (this.domainObject && this.domainObject.ros.args) {

			// iterate over the different arguments 
			// for this service call
			for (const property in this.domainObject.ros.args) {
				// arg name is the label of this drop down menu
				let argName = document.createElement('p');
				argName.style.setProperty('display', 'block');
				argName.style.setProperty('height', '20px');
				argName.innerText = property;

				// the menu for this arg will be a select html element
				let menu = document.createElement('select');
				menu.style.setProperty('display', 'block');
				menu.style.setProperty('min-width', '200px');
				menu.style.setProperty('height', '20px');
				menu.style.setProperty('margin-bottom', '10px');

				// attach the property to the menu html element (it will stay hidden)
				menu.name = property;

				// iterate over each argument choice
				for (const argChoice of this.domainObject.ros.args[property]) {
					// each arg choice will be an option html element
					let option = document.createElement('option');
					option.innerText = String(argChoice);
					option.value = String(argChoice);
					menu.appendChild(option);
				}

				// add the argument name (label) and drop
				// down menu to the widget
				this.appendChild(argName);
				this.appendChild(menu);

				// push menu to a list so we can keep track of which
				// argument choices the user has selected when the user
				// decides to send the ROS service request
				this.serviceArguments.push(menu);
			}

		}

		this.button = document.createElement('button');
		this.buttonText = document.createElement('p');
		this.buttonText.innerText = this.domainObject.name;
		this.button.appendChild(this.buttonText);

		// this is meant to match the style of openmct buttons
		// TODO get this from the openmct espresso sass file somehow
		this.button.style.setProperty('background', 'linear-gradient(#4e4e4e, #424242)');
		this.button.style.setProperty('color', 'white');
		this.button.style.setProperty('border-radius', '5px');

		// when the ros service call button is clicked we will
		// call the onClick function (be sure to bind to the correct 'this')
		this.button.onclick = this.onClick.bind(this);

		this.appendChild(this.button);
	}

	onClick() {
		let rosServiceClient = new ROSLIB.Service({
			ros: this.__ros,
			name: this.domainObject.ros.name,
			serviceType: this.domainObject.ros.type,
		});

		let request = new ROSLIB.ServiceRequest();

		// iterate through the ros service arguments and
		// set their values 
		for (const serviceArgument of this.serviceArguments) {
			const servicePropertyName = serviceArgument.name;
			const servicePropertyValue = serviceArgument.value;
			request[servicePropertyName] = servicePropertyValue;
		}

		rosServiceClient.callService(
			// this is the ros service request
			request, 
			// this is the callback when ros service call succeeds
			(result) => {
				console.log("[debug] ros service call succeeded", {request, result});
			},
			// this is the callback when ros service call fails
			(error) => {
				console.error("[debug] ros service call failed", {request, error});
			}
		);
	}

	/**
	 * Holds unsubscribe functions for any telemetry subscriptions. These should
	 * all be called on cleanup in disconnectedCallback.
	 * @type {Array<() => void>}
	 */
	__subscriptionStoppers = [];

	__initialized = false;

	/**
	 * This runs once three things have happened: openmct is set, domainObject
	 * is set, and the element is connected. No-ops if already initialized.
	 */
	__possiblyInitialize() {
		if (!(this.openmct && this.domainObject && this.isConnected)) return;

		if (this.__initialized) return;
		this.__initialized = true;

		// Connect to ROS
		const ros = new ROSLIB.Ros({
			url: 'ws://' + window.location.hostname + ':' + window.location.port + '/rosbridge',
		});

		this.__ros = ros;
	}

	connectedCallback() {
		this.__possiblyInitialize();
	}

	disconnectedCallback() {
		this.__initialized = false;
		this.__resizeObserver?.unobserve(this);
		for (const stop of this.__subscriptionStoppers) stop();
		this.__ros?.close();
	}

	// The following show() and destroy() methods are called by OpenMCT if this
	// element is returned to OpenMCT from a provider `view()`. {{{

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

customElements.define('ros-service-scene', RosServiceScene);

/**
 * Generates a ROS Service view
 *
 * @returns The plugin install function.
 */
export function RosService() {
	/**
	 * @param {Record<string, any>} openmct
	 */
	function install(openmct) {
		openmct.types.addType('ros.service', {
			name: 'ROS Service',
			cssClass: 'icon-image',
			description: 'Call a ROS service',
			creatable: true,
		});
		openmct.objectViews.addProvider({
			key: 'ros.service',
			name: 'ROS Service',
			cssClass: 'icon-image',
			canView(domainObject) {
				return domainObject.type === 'ros.service';
			},
			priority(domainObject) {
				return 1;
			},
			view(domainObject) {
				const scene = new RosServiceScene();
				scene.openmct = openmct;
				scene.domainObject = domainObject;
				scene.onLoad();
				return scene;
			},
		});
	}

	return install;
}

async function getServiceConfig() {
	const response = await fetch('/api/config.json');
	const data = await response.json();
	return {service: data.service};
}
