#!/bin/bash

set -e

if [ $(docker ps -q | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "No Docker containers should be running for this test to begin."
    exit 1
fi

if [[ -z "${DEFAULT_ASTROBEE_PATH}" ]]; then
    DEFAULT_ASTROBEE_PATH=$HOME/astrobee/devel/setup.bash
fi
if ! [[ -f "$DEFAULT_ASTROBEE_PATH" ]]; then
    echo "ERROR!"
    echo "Set the DEFAULT_ASTROBEE_PATH environment variable to equal"
    echo "the path to your Astrobee devel/setup.bash file."
    exit 1
fi
source $DEFAULT_ASTROBEE_PATH

# go back to repository root
cd ..

# by setting the ROS MASTER URI
# we tell ISAAC UI to not launch
# its own ROS Master node
export ROS_MASTER_URI=http://172.19.0.1:11311
export ROS_IP=172.19.0.1

./build.sh
./run.sh

# ==============================================
# TODO future khaled
#
# When the user runs ./status.sh at this
# point the test will fail because no ros master
# found.
#
# What it should instead do is intelligently
# recognize that the IUI is in a transient state
# and is waiting for the user to launch 
# ROS Master node at the user specified address.
#
# The user will be notified of this. Either
# this is user error or networking error. Help
# should be provided to solve either.
# ==============================================

# the astrobee sim will launch its
# own ROS master because we didn't
# add "--wait" to the end
roslaunch astrobee sim.launch rviz:=false dds:=false robot:=sim_pub

# script blocks, ctrl+c to continue

# WARNING
# you cannot run a status check here
# because ROS Master is down
# ./status.sh

./shutdown.sh
cd tests