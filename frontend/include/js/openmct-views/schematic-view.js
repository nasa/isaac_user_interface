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

// taken from:
// https://stackoverflow.com/a/16788517
function objectEquals(x, y) {
	if (x === null || x === undefined || y === null || y === undefined) {
		return x === y;
	}
	// after this just checking type of one would be enough
	if (x.constructor !== y.constructor) {
		return false;
	}
	// if they are functions, they should exactly refer to same one (because of closures)
	if (x instanceof Function) {
		return x === y;
	}
	// if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
	if (x instanceof RegExp) {
		return x === y;
	}
	if (x === y || x.valueOf() === y.valueOf()) {
		return true;
	}
	if (Array.isArray(x) && x.length !== y.length) {
		return false;
	}

	// if they are dates, they must had equal valueOf
	if (x instanceof Date) {
		return false;
	}

	// if they are strictly equal, they both need to be object at least
	if (!(x instanceof Object)) {
		return false;
	}
	if (!(y instanceof Object)) {
		return false;
	}

	// recursive object equality check
	var p = Object.keys(x);
	return (
		Object.keys(y).every(function (i) {
			return p.indexOf(i) !== -1;
		}) &&
		p.every(function (i) {
			return objectEquals(x[i], y[i]);
		})
	);
}

function createRobotsFromEsterel(message) {
	let robots = {};

	const plan = message.result.esterel_plan;

	for (let i = 0; i < plan.nodes.length; i++) {
		const actionName = plan.nodes[i].name.toUpperCase();
		const params = plan.nodes[i].action.parameters;
		const startTime = plan.nodes[i].action.dispatch_time;
		const duration = plan.nodes[i].action.duration;
		const paramsAsObject = {};
		for (let j = 0; j < params.length; j++) {
			paramsAsObject[params[j].key] = params[j].value;
		}
		
		let robotName = paramsAsObject['movingrobot'] || paramsAsObject['robot'] || 'undefined';

		// WARNING: temporary fix to remove the 'PLANNER' row
		if (robotName === 'undefined') {
			continue;
		}

		robotName = robotName.toUpperCase();
		
		if (!(robotName in robots)) {
			robots[robotName] = {
				label: robotName,
				times: [],
			};
		}
		
		let robotFrom = paramsAsObject['from'] || paramsAsObject['b'] || 'UNKNOWN';
		robotFrom = robotFrom.toUpperCase();

		let robotTo =  paramsAsObject['to'] || paramsAsObject['loc'] || 'UNKNOWN';
		robotTo = robotTo.toUpperCase();

		robots[robotName].times.push({
			starting_time: startTime,
			ending_time: startTime + duration,
			action_name: actionName,
			action_from: robotFrom,
			action_to: robotTo,
			robot_name: robotName,
		});
	}



	return robots;
}

function getMaxTimeFromRobots(robots) {
	let maxTime = 0;
	for (let robotName in robots) {
		let robotEndingTimes = robots[robotName].times.map((x) => x.ending_time);
		let robotMaxEndTime = robotEndingTimes[robotEndingTimes.length - 1];
		if (robotMaxEndTime > maxTime) {
			maxTime = robotMaxEndTime;
		}
	}
	return maxTime;
}

function createRobotsFromPDDL(data) {
	data = data.replace(/ +(?= )/g, '');

	const splitLines = str => str.split(/\r?\n/);

	let pddl = splitLines(data);

	// this will contain the entire plan, with
	// the index corresponding to the robot name,
	// which happens to occur in the 2nd spot of each
	// pddl solution line
	// eg: for the following solution line
	// 200.0042:   (MOVE-TO-TRANSFER-STATION ASTROBEE LOC_E LOC_C) [10.0000]
	// the robot is ASTROBEE
	//
	let robots = {};

	for (let i = 0; i < pddl.length; i++) {
		// skip comment lines (start with a ;) and
		// any blank lines
		if (pddl[i][0] == ';' || pddl[i].length == 0) {
			continue;
		}

		// Warning! ugly code attempting to parse a pddl solution file ahead :)
		const pddl_split = pddl[i].split(': (');

		// pddl time is the starting time of the segment
		// it's usually an offset from the start of the plan, the start being 0s
		// for testing purposes, we will assume the plan starts at the current time
		// but in the future this should be whatever the planning executor decides
		let pddl_time = pddl_split[0];
		pddl_time = parseFloat(pddl_time) * 1000.0; // need in milliseconds because JS uses ms

		// pddl context should be something like:
		// [ Action, Robot, Action-From, Action-To ]
		// we want to group by Robot because each row in the PDDL plan is a robot
		let pddl_context = pddl_split[1].split(')')[0];
		pddl_context = pddl_context.split(' ');

		// pddl duration is the time each segment of the plan needs to execute in seconds
		let pddl_duration = pddl_split[1].split(')')[1];
		pddl_duration = pddl_duration.replace('[', '').replace(']', '');
		pddl_duration = parseFloat(pddl_duration) * 1000.0; // need in milliseconds because JS uses ms

		// recall that d3 timeline wants each row to look like:
		//
		// {
		//	label: 'person a',
		//	times: [
		//		{starting_time: 1355752800000, ending_time: 1355759900000},
		//		{starting_time: 1355767900000, ending_time: 1355774400000},
		//	],
		// }

		// this is the current timestamp, we will use this to offset
		// the pddl time; this is obviously incorrect, but it will work
		// for now until we can figure out a way to know the true start time of
		// a particular segment of the pddl solution
		const time_now = Date.now();

		const pddl_robot = pddl_context[1];
		if (!(pddl_robot in robots)) {
			robots[pddl_robot] = {
				label: pddl_robot,
				times: [],
			};
		}

		robots[pddl_robot].times.push({
			starting_time: pddl_time,
			ending_time: pddl_time + pddl_duration,
			action_name: pddl_context[0],
			action_from: pddl_context[2],
			action_to: pddl_context[3],
			robot_name: pddl_robot,
		});
	}

	return robots;
}

// this function will parse a PDDL solution file
// given as a string (data) and use it to generate a timeline view
function createTimeline(robots) {
	// this should be dynamically set and should change when the user
	// resizes the window or places the widget in a dashboard
	// TODO fix
	var width = 1000;
	var height = 1000;

	// get the last ending time from the robots dictionary
	// this will be used to equally space the x-axis by dividing it by 10 or something reasonable
	const robotsMaxTime = getMaxTimeFromRobots(robots);

	// this example is taken from:
	// https://github.com/jiahuang/d3-timeline/blob/master/examples/example.html

	console.log("[debug] [robots]", {robotsMaxTime, robots});

	var chart = d3.timeline();
	chart.tickFormat({
		format: function (d) {
			return +d;
		},
		tickInterval: robotsMaxTime / 10,
		tickSize: 10,
	});
	chart.stack();
	chart.itemHeight(100);
	chart.margin({left: 200, right: 0, top: 0, bottom: 0});
	chart.itemMargin(0);
	chart.labelMargin(25);
	chart.showTimeAxisTick();
	chart.showTimeAxisTickFormat({stroke: 'stroke-dasharray', spacing: '1 1'});
	chart.rowSeparators('white');

	const hoverResDiv = document.querySelector('#hoverRes');

	// When the user hovers over a particular segment of the plan
	chart.hover(function (d, i, datum) {
		// d is the current rendering object
		// i is the index during d3 rendering
		// datum is the id object

		// change the text in the description box above the timeline
		// to show additional information about the segment that
		// the mouse is hovering over

		if (d.action_name.startsWith('PICK-UP')) {
			hoverResDiv.textContent = `${datum.label}: Pick-up ${d.action_from} from location ${d.action_to}`;
		} else if (d.action_name.startsWith('PLACE')) {
			hoverResDiv.textContent = `${datum.label}: Place ${d.action_from} at location ${d.action_to}`;
		} else if (d.action_name.startsWith('MOVE-TO')) {
			hoverResDiv.textContent = `${datum.label}: Move from ${d.action_from} to ${d.action_to}`;
		} else {
			hoverResDiv.textContent = `${datum.label}: ${d.action_name} from ${d.action_from} to ${d.action_to}`;
		}

		// change the color of a segment that the mouse
		// is hovering over
		d3.selectAll('rect').each(function (x, y) {
			if (objectEquals(d, x)) {
				const d3Selector = d3.select(this);

				// check if this "rect" is actually the plan segment
				// or if its something else (e.g. background rectangle)
				if (!d3Selector.attr('class').startsWith('timelineSeries')) return;

				// we now know that this "rect" object is
				// actually the one that was selected

				if (this.segmentSelected) {
					// pass
				} else {
					// set this segment to green but retain its original color
					// for when we mouseout and have to revert the segment back
					// to the color it used to be
					this.segmentSelected = true;
					this.originalColor = d3Selector.style('fill');
					d3Selector.style('fill', 'green');
				}
			}
		});
	});

	// When the user moves the mouse away from a segment
	chart.mouseout(function () {
		// TODO remove segment highlight
		hoverResDiv.textContent = 'No segment selected.';

		// remove the hover color from any segment that
		// was hovered over
		d3.selectAll('rect').each(function (x, y) {
			const d3Selector = d3.select(this);

			if (!d3Selector.attr('class').startsWith('timelineSeries')) return;

			if (this.segmentSelected) {
				// pass
				this.segmentSelected = false;
				d3Selector.style('fill', this.originalColor);
			}
		});
	});

	// When the user clicks a particular segment of the plan
	chart.click(function (d, i, datum) {
		// pass for now, might implement something later
	});

	// Each row color alternates between these two colors
	var backgroundColor = '#FCFCFD';
	var altBackgroundColor = '#afafc4';
	chart.background(function (datum, i) {
		var odd = i % 2 === 0;
		return odd ? altBackgroundColor : backgroundColor;
	});
	chart.fullLengthBackgrounds();

	// I tried to use this to resize the SVG automatically
	// but it doesn't seem to work :(
	// https://stackoverflow.com/questions/16265123/resize-svg-when-window-is-resized-in-d3-js
	this.svg = d3
		.select('#schematicContainer')
		.append('svg')
		.attr('viewBox', '0 75 1100 1100')
		.attr('width', width)
		.attr('height', height)
		.datum(Object.values(robots))
		.call(chart);

	// this will make the color of the x-axis labels white
	// if there's a better way of doing this we should do it
	d3.selectAll('g').each(function (x, y) {
		const selector = d3.select(this);
		if (selector.attr('class') != 'tick') return;
		selector.selectAll('text').style('fill', '#e8f7ff');
	});

	// this adds a thin white border to all rectangles
	// in the timeline as a visual aid
	d3.selectAll('rect').each(function (x, y) {
		const selector = d3.select(this);
		selector.style('stroke-width', '1');
		selector.style('stroke', 'rgb(255,255,255)');
	});
}

export function SchematicView(openmct) {
	return function install(openmct) {
		// Add schematic type
		openmct.types.addType('static.schematic', {
			name: 'Static Schematic View', // TODO better name
			cssClass: 'icon-image', // TODO correct icon
			description: 'A schematic that does not change at run-time', // TODO better description
			creatable: true,
		});

		// Add view for the newly created schematic type
		openmct.objectViews.addProvider({
			key: 'schematic-view',
			name: 'Schematic View',
			cssClass: 'icon-image',
			canView: function (domainObject) {
				return domainObject.type === 'static.schematic';
			},
			priority: function (domainObject) {
				return 1;
			},
			view: function (domainObject) {
				return {
					show: function (container) {
						// config the inner html of the schematic container
						this.container = container;

						this.resetContainer = () => {
							this.container.innerHTML = `
                            <div style="padding:10px">
                                <div id="hoverRes" style="margin-top: 25px; margin-bottom: 0px; margin-left: 5px">
                                    No segment selected.
                                </div>
                                <div id="schematicContainer" style="width: 100%; height: 100%"></div>
                            </div>
                        `;
						};

						this.resetContainer();

						// bind the createTimeline function to the correct
						// version of 'this'
						this.createTimeline = createTimeline.bind(this);

						// Connect to ROS
						const ros = new ROSLIB.Ros({
							url: 'ws://' + window.location.hostname + ':' + window.location.port + '/rosbridge',
						});

						if (domainObject.package) {
							// the user has specified in the config that the
							// PDDL solution file is a static file that we should
							// load into the browser then parse

							http.get(domainObject.package).then(result => {
								let data = result.data;
								let robots = createRobotsFromPDDL(data);
								this.createTimeline(robots);

								// TODO handle errors (e.g.: bad url provided)
							});
						}

						if (domainObject.param) {
							// the user has specified in the config that
							// the PDDL solution string is available through
							// a particular ROS parameter

							let pddlSolutionParam = new ROSLIB.Param({
								ros: ros,
								name: domainObject.param,
							});

							pddlSolutionParam.get(result => {
								if (!result) {
									console.error(`Could not get a valid string from the ROS parameter '${domainObject.param}'`);
								} else {
									let robots = createRobotsFromPDDL(result);
									this.createTimeline(robots);
								}
							});
						}

						if (domainObject.ros) {
							// the user has specifed a ROS topic to
							// populate the plan timeline
							// NOTE at the moment only topics of type:
							// rosplan_dispatch_msgs/PlanParserActionResult
							// are supported, more type support to come in future
                            // NOTE we can also get the same message type
                            // but as a JSON string

							let t = {
								ros: ros,
								name: domainObject.ros.topic,
								messageType: domainObject.ros.type,
							};

                            // NOTE
                            // sometimes this topic can come in as a JSON string
                            // on a regular looking std_msgs/String topic, this
                            // was done because the message definitions themselves 
                            // might not be available to us
                            const isMessageJSON = domainObject.ros.type === "std_msgs/String";

							let esterelTopic = new ROSLIB.Topic(t);

                            console.log("[debug] [esterel] subscribing to esterel plan topic", {t, isMessageJSON});

							esterelTopic.subscribe(message => {
                                // blank canvas
                                this.resetContainer();
                                console.log("[debug] [esterel] got message on ros topic", {message});

                                if (isMessageJSON) {
                                    message = JSON.parse(message.data);
                                    console.log("[debug] [esterel] got JSON message, parsing now", {message});
                                }

                                let robots = createRobotsFromEsterel(message);

                                console.log("[debug] [esterel] parsed message and got a robots dictionary", {robots});

								this.createTimeline(robots);
							});
						}
					},
					destroy: function (container) {
						// Do any cleanup here (eg. event observers, etc).
					},
				};
			},
		});
	};
}
