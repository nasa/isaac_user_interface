#!/bin/bash
#
# Copyright © 2021, United States Government, as represented by the Administrator of the 
# National Aeronautics and Space Administration. All rights reserved.
#
# The “ISAAC - Integrated System for Autonomous and Adaptive Caretaking platform” software is 
# licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License. 
#
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the 
# License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
# either express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#

echo "--------------------------------------------------------------------------------------------------"
echo "Diagnosing the NASA ISAAC User Interface"
echo "--------------------------------------------------------------------------------------------------"

# this function checks if a particular docker container is running
check_container() {
    if [ $(docker inspect $1 | grep Running | grep true | wc -l) -lt 1 ]; then
        echo "--------------------------------------------------------------------------------------------------"
        echo "ERROR!"
        echo "The ISAAC UI $2 subsystem is not running correctly."
        echo "Check the subsystem log below for errors."
        echo "--------------------------------------------------------------------------------------------------"
        docker logs $1
        echo "--------------------------------------------------------------------------------------------------"
        exit 1
    fi
}

check_container "idi_frontend" "frontend"
check_container "idi_backend" "backend"
check_container "rosbridge" "ROS Bridge node"
check_container "rosvideo" "ROS Video node"
check_container "idi_arangodb" "database"

echo "All ISAAC UI Docker containers appear to be running."