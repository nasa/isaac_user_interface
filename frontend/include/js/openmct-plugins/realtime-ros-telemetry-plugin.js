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

// ----------------------------------------------------------------------------------------------------
// ISAAC Interface
// Web-based Frontend
// ----------------------------------------------------------------------------------------------------
// Subscribe to telemetry coming from a ROS topic
// ----------------------------------------------------------------------------------------------------

import {resolve} from './utils.js';

/**
 * Support realtime ROS telemetry for all ROS telemetry objects
 *
 * @returns function
 */
export function RealtimeRosTelemetryPlugin() {
	return function (openmct) {
		var rosWebSocket = new ROSLIB.Ros({
			url: 'ws://' + window.location.hostname + ':' + window.location.port + '/rosbridge',
		});

		let provider = {
			supportsSubscribe: function (domainObject) {
				return domainObject.type === 'ros.telemetry';
			},
			subscribe: function (domainObject, callback) {
				let listener = new ROSLIB.Topic({
					ros: rosWebSocket,
					name: domainObject.ros.topic,
					messageType: domainObject.ros.type,
					throttle_rate: 100,
				});

				// Example of what OpenMCT expects as a message in order to
				// properly plot it using the default plotting library that OpenMCT uses
				//
				// {timestamp: 1586151014145, value: 3.9173265303878275}
				//

				const transformRosMessage = domainObject.telemetry.values
					.filter(x => x.ros)
					.map(x => ({key: x.key, value: x.ros}));

				let transformThenCallback = function (rosMessage, postTransformCallback) {
					let newRosMessage = {
						// Warning! this is a temporary fix to get the timestamps in
						// the realtime ROS messages to be correct. This should be fixed
						// by setting the correct simulation time in ROS.
						timestamp: Date.now(),
					};

					transformRosMessage.map(x => {
						newRosMessage[x.key] = resolve(x.value, rosMessage);
					});

					postTransformCallback(newRosMessage);
				};

				listener.subscribe(x => transformThenCallback(x, callback));
				return listener.unsubscribe;
			},
		};

		openmct.telemetry.addProvider(provider);
	};
}
