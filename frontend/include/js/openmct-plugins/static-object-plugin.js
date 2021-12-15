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
// Configuration loader
// the specific configuration file can be found at:
// isaac_data_interface/frontend/config.json
// where isaac_data_interface is the root of this repository
// ----------------------------------------------------------------------------------------------------

/**
 * Load configuration (JSON) file and populate OpenMCT with it
 *
 * @param {string} openmct - openmct object passed by openmct to this function automatically
 *
 * @returns function
 */
export function StaticObjectPlugin(openmct) {
	return function install(openmct) {
		function getDictionary() {
			return http.get('/api/config.json').then(function (result) {
				// modify view part because its a special case

				let data = result.data;

				data.view = data.view
					.filter(x => x.ros && x.ros.type === 'camera')
					.map(x => ({
						name: x.name,
						type: 'ros.view',
						key: x.key,
					}));

				return data;
			});
		}

		let objectProvider = {
			get: function (identifier) {
				return getDictionary().then(function (dictionary) {
					// ---------------------------------------------------------------------------------
					// Root objects
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('-folder')) {
						let folderName = identifier.key.replace('-folder', '');
						folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);

						return {
							identifier: identifier,
							name: folderName,
							type: 'folder',
							location: 'ROOT',
						};
					}

					// ---------------------------------------------------------------------------------
					// Telemetry Plot
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('telemetry.plot')) {
						let plotConfig = dictionary.plots.filter(a => a.key === identifier.key)[0];

						return {
							location: 'plots:plots-folder',
							identifier: identifier,
							name: plotConfig.name,
							type: 'telemetry.plot.overlay',
							id: undefined,
							composition: plotConfig.series.map(b => `${identifier.namespace}:${b}`),
							configuration: {
								xAxis: {},
								yAxis: {},
								series: plotConfig.series.map(c => ({
									identifier: {
										namespace: identifier.namespace,
										key: c,
									},
								})),
							},
						};
					}

					// ---------------------------------------------------------------------------------
					// ROS Video
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('ros.video')) {
						let m = dictionary.video.filter(a => a.key === identifier.key)[0];
						let r = {
							identifier: identifier,
							name: m.name,
							type: 'ros.video',
							location: 'video:video-folder',
						};
						r.ros = m.ros;
						r.ros.type = 'sensor_msgs/Image';
						return r;
					}

					// ---------------------------------------------------------------------------------
					// ROS Services
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('ros.service')) {
						let m = dictionary.service.filter(a => a.key === identifier.key)[0];
						let r = {
							identifier: identifier,
							name: m.name,
							type: 'ros.service',
							location: 'service:service-folder',
						};
						r.ros = m.ros;
						return r;
					}

					// ---------------------------------------------------------------------------------
					// ROS Logs
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('ros.logs')) {
						let m = dictionary.logs.filter(a => a.key === identifier.key)[0];

						let r = {
							configuration: {hiddenColumns: {name: true}},
							identifier: identifier,
							name: m.name,
							type: 'ros.logs',
							location: 'logs:logs-folder',
						};

						// we fix a few attributes of the ROS dictionary
						// for all log objects
						if (m.ros.type === 'std_msgs/String') {
							m.ros.fieldName = 'Data';
							m.ros.fieldPosition = 'data';
						} else {
							m.ros.fieldName = 'Message';
							m.ros.fieldPosition = 'msg';
						}

						let yAxisValue = [
							{
								key: m.ros.fieldName,
								name: m.ros.fieldName,
								ros: m.ros.fieldPosition,
							},
						];

						let xAxisValue = [
							{
								key: 'utc',
								source: 'timestamp',
								name: 'Timestamp',
								format: 'utc',
								hints: {
									domain: 1,
								},
							},
						];

						r.telemetry = {
							values: [].concat(yAxisValue, xAxisValue),
						};

						r.ros = m.ros;

						return r;
					}

					// ---------------------------------------------------------------------------------
					// Static Schematic (WIP)
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('static.schematic')) {
						let m = dictionary.schematic.filter(a => a.key === identifier.key)[0];

						if (m == undefined) {
							console.log("Old schematic detected:",{identifier, dictionary});
						}

						let r = {
							identifier: identifier,
							name: m.name,
							type: 'static.schematic',
							location: 'view:view-folder',
							package: m.package, // path to a pddl solution file
							param: m.param, // name of ROS parameter if specified instead of path
							ros: m.ros // pass through ROS dictionary if provided
						};

						return r;
					}

					// ---------------------------------------------------------------------------------
					// ROS View
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('ros.view')) {
						let m = dictionary.view.filter(a => a.key === identifier.key)[0];

						if (m == undefined) {
							console.log("Old camera or view detected:",{identifier, dictionary});
						}

						let r = {
							identifier: identifier,
							name: m.name,
							type: 'ros.view',
							location: 'view:view-folder',
						};

						return r;
					}

					// ---------------------------------------------------------------------------------
					// All other telemetry
					// ---------------------------------------------------------------------------------

					let measurement = dictionary.telemetry.filter(function (m) {
						return m.key === identifier.key;
					});

					if (measurement.length == 0) {
						console.error("Couldn't find measurement", {identifier});
					}

					measurement = measurement[0];

					// ---------------------------------------------------------------------------------
					// ROS Telemetry
					// ---------------------------------------------------------------------------------
					if (identifier.key.includes('ros.telemetry')) {
						let r = {
							identifier: identifier,
							name: measurement.name,
							type: 'ros.telemetry',
							location: 'telemetry:telemetry-folder',
						};

						let yAxisValue = [
							{
								key: measurement.ros.fieldName,
								name: measurement.ros.fieldName,
								ros: measurement.ros.fieldPosition,
								units: measurement.ros.fieldUnit || 'arbitrary',
								format: 'float',
								hints: {
									range: 1,
								},
							},
						];

						let xAxisValue = [
							{
								key: 'utc',
								source: 'timestamp',
								name: 'Timestamp',
								format: 'utc',
								hints: {
									domain: 1,
								},
							},
						];

						r.telemetry = {
							values: [].concat(yAxisValue, xAxisValue),
						};

						r.ros = measurement.ros;

						return r;
					}

					console.error("Couldn't match to anything");
				});
			},
		};

		let compositionProvider = {
			appliesTo: function (domainObject) {
				return domainObject.identifier.namespace !== '' && domainObject.type === 'folder';
			},
			load: function (domainObject) {
				let namespace = domainObject.identifier.namespace;
				return getDictionary().then(function (dictionary) {
					if (dictionary[namespace] === undefined) {
						console.error({dictionary, namespace});
						return [];
					}

					return dictionary[namespace].map(function (m) {
						return {
							namespace: namespace,
							key: m.key,
						};
					});
				});
			},
		};

		const folderNames = ['telemetry', 'plots', 'video', 'logs', 'view', 'service', 'schematic'];
		folderNames.map(x => {
			openmct.objects.addRoot({
				namespace: x,
				key: x + '-folder',
			});
			openmct.objects.addProvider(x, objectProvider);
		});
		openmct.composition.addProvider(compositionProvider);

		openmct.types.addType('ros.telemetry', {
			name: 'ROS Telemetry Point',
			description: 'ROS telemetry point streaming in from ROS bridge',
			cssClass: 'icon-telemetry',
		});

		openmct.types.addType('ros.logs', {
			name: 'ROS logs',
			description: 'ROS logs streaming in from ROS bridge',
			cssClass: 'icon-telemetry',
		});
	};
}
