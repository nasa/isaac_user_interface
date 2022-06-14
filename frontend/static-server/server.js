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

var StaticServer = require('./static-server');
var app = require('express')();

var staticServer = new StaticServer();
app.use('/', staticServer);

const proxy = require('express-http-proxy');

const {createProxyMiddleware} = require('http-proxy-middleware');

// this is a proxy for the IDI backend API
// by doing this we can access the backend API from the
// frontend by using:
// /api/***
app.use('/api', proxy('http://iui_backend:9091'));

// this is a proxy for ROS web video server
// by doing this we can access ROS web video server from
// the frontend by using:
// /video/***
app.use(
	'/video',
	proxy('http://' + (process.env.ROS_VIDEO_IP || 'rosbridge') + ':' + (process.env.ROS_VIDEO_PORT || 8080))
);

// proxy for rosbridge websockets
let wsProxy = createProxyMiddleware(
	'ws://' + (process.env.ROS_BRIDGE_IP || 'rosbridge') + ':' + (process.env.ROS_BRIDGE_PORT || 9090),
	{changeOrigin: true}
);
app.use('/rosbridge', wsProxy);

var port = process.env.PORT || 8080;

let server = app.listen(port, function () {
	console.log('NASA ISAAC User Interface is now live at http://localhost:' + port);
});

server.on('upgrade', wsProxy.upgrade);
