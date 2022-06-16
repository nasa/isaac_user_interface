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

usage_string="$0 usage: [-h | --help] [-i | --isaac] [-a | --astrobee]"

usage()
{
    echo "$usage_string"
}

DOCKER_COMPOSE=" -f ./docker-compose.yml "
ASTROBEE_SIM=0
ISAAC_SIM=0

while [ "$1" != "" ]; do
    case $1 in
        -i | --isaac )      DOCKER_COMPOSE+=" -f ./plugins/isaac.docker-compose.yml "
                            ISAAC_SIM=1
                            ;;
        -a | --astrobee )   DOCKER_COMPOSE+=" -f ./plugins/astrobee.docker-compose.yml "
                            ASTROBEE_SIM=1
                            ;;
        -h | --help )       usage
                            exit
                            ;;
        * )                 usage
                            exit 1
    esac
    shift
done

# [CHECK] ISAAC and Astrobee cannot be run at the same time
if [ $ISAAC_SIM -gt 0 ] && [ $ASTROBEE_SIM -gt 0 ]; then
    echo "ERROR!"
    echo "You cannot run both ISAAC and Astrobee sims concurrently."
    echo "Either use -i (--isaac) or -a (--astrobee) but never both."
    exit 1
fi

echo "--------------------------------------------------------------------------------------------------"
echo "Running the NASA ISAAC User Interface"
echo "--------------------------------------------------------------------------------------------------"

# Check that the ISAAC UI isn't already running
# TODO this is a rudimentary check that is prone to error
# eg: it doesn't check if the UI is completely running
if [ $(docker ps -q | grep iui_frontend | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "The ISAAC UI is already running."
    echo "You can shutdown the ISAAC UI using the following script:"
    echo "./shutdown.sh"
    exit 1
fi

# The user has two options, either use your own ROS Master node
# or let the UI launch one for you within a Docker container
# 0 = don't launch, 1 = launch
LAUNCH_ROS_MASTER=0

if [ $ISAAC_SIM -lt 1 ] && [ $ASTROBEE_SIM -lt 1 ]; then
    if [ -n "$ROS_MASTER_URI" ]; then
        echo "Using existing ROS Master node at $ROS_MASTER_URI"
        echo "Warning: only ROS Master nodes on 172.19.0.1 at 11311 are supported for now."
        echo "ie: if your ROS_MASTER_URI is not http://172.19.0.1:11311 you may experience"
        echo "    connectivity problems."
        echo "This will be fixed in future updates to include any ROS Master IP."

        export DOCKER_COMPOSE_ROS_MASTER_URI=http://172.19.0.1:11311
    else
        LAUNCH_ROS_MASTER=1
        echo "Launching a new ROS Master node at http://172.19.0.5:11311"
        
        export DOCKER_COMPOSE_ROS_MASTER_URI=http://172.19.0.5:11311
    fi
else
    echo "Because you specified a predefined simulation (Astrobee or ISAAC),"
    echo "the ISAAC UI will automatically run the relevant Docker containers"
    echo "and use its own ROS Master node at http://172.19.0.5:11311"
    
    export DOCKER_COMPOSE_ROS_MASTER_URI=http://172.19.0.5:11311
fi
# auto exit on any error below
set -e

if [ $ISAAC_SIM -gt 0 ] || [ $ASTROBEE_SIM -gt 0 ] || [ $LAUNCH_ROS_MASTER -gt 0 ]; then 

    # launch our own ROS Master
    DOCKER_COMPOSE+=" -f ./plugins/ros.docker-compose.yml "

    # change the value of ROS_MASTER_URI to the ip address of container
    export ROS_MASTER_URI=http://172.19.0.5:11311

fi

echo "--------------------------------------------------------------------------------------------------"

docker-compose $DOCKER_COMPOSE up -d --remove-orphans

echo "--------------------------------------------------------------------------------------------------"
echo "ISAAC User Interface is now live!"
echo "Point your favorite browser to:"
echo "http://localhost:8080/"

echo "You can also run"
echo "./status.sh"
echo "for a more complete status check."
echo "--------------------------------------------------------------------------------------------------"
