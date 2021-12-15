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


// Type definitions.

// When any JS files have a "// @ts-check" comment at the top, VS Code will
// automatically try to type-check those files (underlining any errors with red
// squiggly lines).

// These are type "any" for now (like plain JS), to silence some type errors.
declare const ROS3D: any;
declare const GLTFLoader: any;

// These provide nice type checking intellisense (f.e. hover on THREE.MeshBasicMaterial in a
// file to see useful info).
declare const ROSLIB: typeof import('roslib');
declare const THREE: typeof import('three');
declare const dat: typeof import('dat.gui');

declare module 'https://cdn.skypack.dev/@lume/variable@0.6.1' {
	export * from '@lume/variable';
}
