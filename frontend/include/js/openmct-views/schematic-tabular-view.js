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

// this function will parse a PDDL solution file
// given as a string (data) and use it to generate a table
function createTable(data) {
    data = data.replace(/ +(?= )/g,'');

    const splitLines = str => str.split(/\r?\n/);

    let pddl = splitLines(data);

    // this will contain the entire plan as a table
    let table = [];
    
    for (let i = 0; i < pddl.length; i++) {
        // skip comment lines (start with a ;) and
        // any blank lines
        if (pddl[i][0] == ";" || pddl[i].length == 0) {
            continue;
        }
        
        const pddl_split = pddl[i].split(": (");

        // pddl time is the starting time of the segment
        // it's usually an offset from the start of the plan, the start being 0s
        // for testing purposes, we will assume the plan starts at the current time
        // but in the future this should be whatever the planning executor decides
        let pddl_time = pddl_split[0];
        pddl_time = parseFloat(pddl_time);

        // pddl context should be something like:
        // [ Action, Robot, Action-From, Action-To ]
        // we want to group by Robot because each row in the PDDL plan is a robot
        let pddl_context = pddl_split[1].split(")")[0];
        pddl_context = pddl_context.split(" ");

        // pddl duration is the time each segment of the plan needs to execute in seconds
        let pddl_duration = pddl_split[1].split(")")[1];
        pddl_duration = pddl_duration.replace("[","").replace("]","");
        pddl_duration = parseFloat(pddl_duration);
        
        table.push({
            'Subsystem': pddl_context[1],
            'Action': pddl_context[0],
            'From': pddl_context[2],
            'To': pddl_context[3],
            'Start Time': (pddl_time).toFixed(0),
            'End Time': (pddl_time+pddl_duration).toFixed(0)
        });
    }

    // Simple DataTables
    // ref: https://github.com/fiduswriter/Simple-DataTables
    // also helpful: https://github.com/fiduswriter/Simple-DataTables/issues/84#issuecomment-752723980
    const dataTable = new simpleDatatables.DataTable("#data-table", {      
        data: {
			headings: Object.keys(table[0]), 
			data: table.map(item => Object.values(item))
		},
        searchable: false,
	    fixedHeight: false,
        scrollY: "500px",
        paging: false
    });
}


export function SchematicTabularView(openmct) {
	return function install(openmct) {

		// Add view for the newly created schematic type
		openmct.objectViews.addProvider({
			key: 'schematic-tabular-view',
			name: 'Tabular View',
			cssClass: 'icon-image',
			canView: function (domainObject) {
				return domainObject.type === 'static.schematic';
			},
			priority: function (domainObject) {
				return -1;
			},
			view: function (domainObject) {
				return {
					show: function (container) {
                        // config the inner html of the schematic container
                        // TODO this should be modernized but im too lazy atm
                        container.innerHTML = `
                            <div style="padding:10px">
                                <table id="data-table" style="width:100%; height: 100%"></table>
                            </div>
                        `;

                        // bind the createTimeline function to the correct
                        // version of 'this'
                        this.createTable = createTable.bind(this);

                        if (domainObject.package) {
                            // the user has specified in the config that the
                            // PDDL solution file is a static file that we should
                            // load into the browser then parse

                            http.get(domainObject.package).then((result) => {
                                let data = result.data;
                                this.createTable(data);

                                // TODO handle errors (e.g.: bad url provided)
                            });
                        }

                        if (domainObject.param) {
                            // the user has specified in the config that
                            // the PDDL solution string is available through
                            // a particular ROS parameter

                            let pddlSolutionParam = new ROSLIB.Param({
                                ros: ros,
                                name: domainObject.param
                            });

                            pddlSolutionParam.get((result) => {
                                if (!result) {
                                    console.error(`Could not get a valid string from the ROS parameter '${domainObject.param}'`);
                                } else {
                                    this.createTable(result);
                                }
                            })
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
