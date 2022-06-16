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
echo "Systems Check for the NASA ISAAC User Interface"
echo "--------------------------------------------------------------------------------------------------"

# ref: https://dev.to/ifenna__/adding-colors-to-bash-scripts-48g4
RED="\e[31m"
GREEN="\e[32m"
ENDCOLOR="\e[0m"

# Global variable
# 0 = no errors! all systems are go!
# 1 = fatal error! abort mission!
FATAL_ERROR=0

print_error() {
    echo -e "[$1] ${RED}ERROR${ENDCOLOR}"
}
print_pass() {
    echo -e "[$1] ${GREEN}PASS${ENDCOLOR}"
}

# this function checks if a particular docker container is running
check_container() {
    if [ $(docker inspect $1 | grep Running | grep true | wc -l) -lt 1 ]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "C1"
        echo "The ISAAC UI $2 subsystem is not running correctly."
        echo "Check the subsystem log below for errors."
        echo "--------------------------------------------------------------------------------------------------"
        docker logs $1
        echo "--------------------------------------------------------------------------------------------------"
        exit 1
    fi
}

# this function runs rosnode ping (all nodes) and roswtf inside a docker container
check_ros_connection() {
    # ----------------------------------------------------------------------------------------------------
    # Run roswtf in the container to determine communication errors
    # ----------------------------------------------------------------------------------------------------
    ROS_WTF_OUTPUT=$(docker exec -it $1 /ros_entrypoint.sh roswtf)
    SUB1="connection refused"
    SUB2="does not appear to be running"
    SUB9="No errors or warnings"
    echo "[R1] Running roswtf within the $2 subsystem"
    if [[ "$ROS_WTF_OUTPUT" == *"$SUB1"* ]]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R1a"
        echo "The ISAAC UI $2 subsystem is experiencing ROS networking issues."
        echo "Check the output below for a connection error (look for the phrase 'connection refused')"
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_WTF_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi
    if [[ "$ROS_WTF_OUTPUT" == *"$SUB2"* ]]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R1b"
        echo "The ISAAC UI $2 subsystem detected that another subsystem is not running."
        echo "Look below for the phrase 'does not appear to be running'"
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_WTF_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi
    if [[ "$ROS_WTF_OUTPUT" == *"$SUB9"* ]]; then
        print_pass "R1z"
    else
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R1z"
        echo "The ISAAC UI $2 subsystem is experiencing ROS networking issues."
        echo "The roswtf did not output the phrase 'No errors or warnings'"
        echo "Check the output of roswtf below to understand why this happened."
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_WTF_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi

    # ----------------------------------------------------------------------------------------------------
    # Run rosnode ping -a in the container to determine communication errors
    # ----------------------------------------------------------------------------------------------------
    ROS_NODE_OUTPUT=$(docker exec -it $1 /ros_entrypoint.sh rosnode ping -a)
    SUB1="Could not contact the following node"
    SUB2="Errors connecting to the following service"
    SUB3="connection refused"
    echo "[R2] Running rosnode ping -a within the $2 subsystem"
    if [[ "$ROS_NODE_OUTPUT" == *"$SUB1"* ]]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R2a"
        echo "The ISAAC UI $2 subsystem could not contact one or more ROS nodes."
        echo "Check the output below for ROS node miscommunication errors."
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_NODE_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi
    if [[ "$ROS_NODE_OUTPUT" == *"$SUB2"* ]]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R2b"
        echo "The ISAAC UI $2 subsystem experienced a fatal error connecting to one or more ROS services."
        echo "Check the output below for ROS service connection errors."
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_NODE_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi
    if [[ "$ROS_NODE_OUTPUT" == *"$SUB3"* ]]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "R2c"
        echo "The ISAAC UI $2 subsystem experienced a fatal connection error."
        echo "Check the output below for the phrase 'connection refused'"
        echo "--------------------------------------------------------------------------------------------------"
        echo "${ROS_NODE_OUTPUT}"
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    fi
    print_pass "R2z"
}

check_url() {
    # -m, --max-time <seconds>
    # Maximum  time  in  seconds that you allow the whole operation to
    # take.  This is useful for preventing your batch jobs from  hang‐
    # ing  for  hours due to slow networks or links going down.

    # --connect-timeout <seconds>
    # Maximum  time  in  seconds  that you allow the connection to the
    # server to take.  This only limits  the  connection  phase,  once
    # curl has connected this option is of no more use.

    echo "[U1] Testing if hitting $1 returns HTTP 2XX"

    if [ $(curl -s -o /dev/null -w "%{http_code}" -LI --connect-timeout 1 --max-time 3 $1) -gt 299 ]; then
        echo "--------------------------------------------------------------------------------------------------"
        print_error "U1a"
        echo "The ISAAC UI $2 subsystem is not running correctly."
        echo "This is because the HTTP GET request to $1"
        echo "returned an HTTP error code >= 300."
        echo "--------------------------------------------------------------------------------------------------"
        FATAL_ERROR=1
    else
        print_pass "U1z"
    fi
}

check_container "iui_frontend" "frontend"
check_container "iui_backend" "backend"
check_container "iui_rosbridge" "ROS Bridge node"
check_container "iui_arangodb" "database"

check_ros_connection "iui_rosbridge" "ROS Bridge node"

if [ $(docker container ls | grep rosmaster | wc -l)  -gt 0 ]; then
    check_ros_connection "rosmaster" "ROS Master node"
fi

sleep 2
check_url "http://localhost:8080" "frontend static server (UI home page)"
sleep 5
check_url "http://localhost:8080/api/config.json" "backend API (configuration provider)"

echo "--------------------------------------------------------------------------------------------------"

if [ $FATAL_ERROR -lt 1 ]; then
    echo -e "${GREEN}ALL SYSTEMS ARE GO${ENDCOLOR}"
    echo "The ISAAC User Interface appears to be running nominally."
else
    echo -e "${RED}HOUSTON, WE HAVE A PROBLEM${ENDCOLOR}"
    echo "Check above for errors that indicate possible failiures within the subsystems."
fi



echo "--------------------------------------------------------------------------------------------------"
