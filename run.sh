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
echo "Running the NASA ISAAC User Interface"
echo "--------------------------------------------------------------------------------------------------"

# Check that the ISAAC UI isn't already running
if [ $(docker ps -q | grep idi_frontend | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "The ISAAC UI is already running."
    echo "You can shutdown the ISAAC UI using the following script:"
    echo "./shutdown.sh"
    exit 1
fi

# 0 = don't launch, 1 = launch
LAUNCH_ROS_MASTER=0

if [ -n "$ROS_MASTER_URI" ]; then
    echo "Using existing ROS Master node at $ROS_MASTER_URI"
    echo "Warning: only ROS Master nodes on localhost at 11311 are supported for now"
else
    LAUNCH_ROS_MASTER=1
    echo "Launching a new ROS Master node at http://172.19.0.5:11311"
fi

# auto exit on any error below
set -e

if [ $LAUNCH_ROS_MASTER -gt 0 ]; then 

    # launching our own ros master using ros.docker-compose.yml
    docker-compose -f ./ros.docker-compose.yml -f ./idi.docker-compose.yml up -d --remove-orphans

else

    # not launching ros master by only using docker-compose.yml
    docker-compose -f ./docker-compose.yml up -d --remove-orphans

fi

echo "--------------------------------------------------------------------------------------------------"
echo "ISAAC User Interface is now live!"
echo "Point your favorite browser to:"
echo "http://localhost:8080/"

echo "You can also run"
echo "./status.sh"
echo "for a more complete status check."
echo "--------------------------------------------------------------------------------------------------"

