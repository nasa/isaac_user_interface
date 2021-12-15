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

import {StaticObjectPlugin} from './openmct-plugins/static-object-plugin.js';
import {RealtimeRosTelemetryPlugin} from './openmct-plugins/realtime-ros-telemetry-plugin.js';
import {HistoricalRosTelemetryPlugin} from './openmct-plugins/historical-ros-telemetry-plugin.js';
import {RealtimeRosLogsPlugin} from './openmct-plugins/realtime-ros-logs-plugin.js';
import {HistoricalRosLogsPlugin} from './openmct-plugins/historical-ros-logs-plugin.js';
import {RosView} from './openmct-views/ros3djs-view.js';
import {RosVideoView} from './openmct-views/ros-video-view.js';
import {RosService} from './openmct-views/ros-service-view.js';
import {SchematicView} from './openmct-views/schematic-view.js';
import {SchematicTabularView} from './openmct-views/schematic-tabular-view.js';

// OpenMCT asset path
openmct.setAssetPath('openmct/dist');

// OpenMCT bundled plugins
openmct.install(openmct.plugins.LocalStorage());
openmct.install(openmct.plugins.MyItems());
openmct.install(openmct.plugins.UTCTimeSystem());

// OpenMCT time settings
openmct.time.clock('local', {start: -15 * 60 * 1000, end: 0});
openmct.time.timeSystem('utc');

// OpenMCT theme
openmct.install(openmct.plugins.Espresso());

// -----------------------------------------------------------------------
// OpenMCT custom views
// -----------------------------------------------------------------------
openmct.install(RosView());
openmct.install(RosService());
openmct.install(RosVideoView());
openmct.install(SchematicView());
openmct.install(SchematicTabularView());
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// OpenMCT custom object plugins
// -----------------------------------------------------------------------
openmct.install(StaticObjectPlugin());
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// OpenMCT and ROS custom interface plugins
// -----------------------------------------------------------------------
openmct.install(RealtimeRosTelemetryPlugin());
openmct.install(HistoricalRosTelemetryPlugin());
openmct.install(RealtimeRosLogsPlugin());
openmct.install(HistoricalRosLogsPlugin());
// -----------------------------------------------------------------------

openmct.start();
