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

/**
 * Sluggify a ROS topic so that it can fit inside a URL
 * this is because the forward slash typically found in ROS
 * topics shouldn't be inside a URL
 *
 * For example, this function will convert:
 * /hw/imu
 * to
 * hw__imu
 *
 * @param {string} rosTopic
 *
 * @returns string
 */
export function sluggifyRosTopic(rosTopic) {
	return rosTopic.slice(1).replace(new RegExp('/', 'g'), '__');
}

/**
 * Helpful function that takes as input a "path" to a variable inside a nested
 * Javascript object and returns that particular object
 * For example, if your Javascript object is:
 * {a: {b: "c"}}
 * and your path is:
 * "a.b"
 * then this function will return "c"
 *
 * @param {string} path
 * @param {object} obj
 *
 * @returns object
 */
export function resolve(path, obj) {
	return path.split('.').reduce(function (prev, curr) {
		return prev ? prev[curr] : null;
	}, obj || self);
}
