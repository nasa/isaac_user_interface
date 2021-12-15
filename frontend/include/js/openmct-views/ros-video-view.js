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

export function RosVideoView(openmct) {
  return function install(openmct) {
    openmct.types.addType('ros.video', {
      name: 'ROS Video View',
      cssClass: "icon-image",
      description: 'A visualization of a ROS sensor image',
      creatable: true
    });
    openmct.objectViews.addProvider({
      key: "ros.video",
      name: "ROS Video View",
      cssClass: "icon-image",
      canView: function (domainObject) {
        return domainObject.type === "ros.video";
      },
      priority: function (domainObject) {
        return 1;
      },
      view: function (domainObject) {
        return {
          show: function (container) {
            // Invoked by OpenMCT when the view is displayed,
            // with the containing html element being passed in
            container.innerHTML = `
              <div style="width: 100%; height: 100%">
                <img alt="ROS video stream for topic ${domainObject.ros.topic}" style="width: 100%; height: 100%" src="/video/stream?topic=${domainObject.ros.topic}">
                </img>
              </div>
            `;
          },
          destroy: function (container) {
            // Do any cleanup here (eg. event observers, etc).
          },
        };
      },
    });
  };
}
