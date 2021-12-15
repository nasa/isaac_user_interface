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
// Request historical telemetry that was previously published on a ROS topic
// ----------------------------------------------------------------------------------------------------

import {sluggifyRosTopic, resolve} from "./utils.js";

/**
 * Request historical ROS telemetry for all ROS telemetry objects
 *
 * @returns function
 */
export function HistoricalRosTelemetryPlugin() {
  return function (openmct) {
    // http://docs.ros.org/api/rosgraph_msgs/html/msg/Log.html
    const rosMessageLevelMap = {
      1: "Debug",
      2: "Info",
      4: "Warning",
      8: "Error",
      16: "Fatal",
    };

    var provider = {
      supportsRequest: function (domainObject) {
        return domainObject.type === "ros.telemetry";
      },
      request: function (domainObject, options) {
        const sluggifiedRosTopic = sluggifyRosTopic(domainObject.ros.topic);

        var url =
          "/api/history/" + // anything starting with /api is redirected to backend
          sluggifiedRosTopic +
          "/start/" +
          options.start + // warning: openmct uses milliseconds since epoch, not seconds
          "/end/" +
          options.end;

        const transformRosMessage = domainObject.telemetry.values
          .filter((x) => x.ros)
          .map((x) => ({ key: x.key, value: x.ros }));

        function transformData(rosMessage) {
          let newRosMessage = {
            timestamp: parseInt(rosMessage.header.stamp.secs),
            id: domainObject.identifier.key,
          };

          transformRosMessage.map((x) => {
            newRosMessage[x.key] = resolve(x.value, rosMessage);
          });

          let shouldCallCallback = true;
          if (domainObject.ros.filter) {
            for (const property in domainObject.ros.filter) {
              const valueShouldStartWith = domainObject.ros.filter[property];
              const valueStartsWith = resolve(property, rosMessage);
              if (!valueStartsWith.startsWith(valueShouldStartWith)) {
                shouldCallCallback = false;
              }
            }
          }

          if (shouldCallCallback) {
            return newRosMessage;
          } else {
            return undefined;
          }
        }

        return http.get(url).then(function (resp) {
          return JSON.parse(resp.data).map(transformData).filter((x) => (x !== undefined));
        });
      },
    };

    openmct.telemetry.addProvider(provider);
  };
}
