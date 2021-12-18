#!/bin/bash

set -e

if [ $(docker ps -q | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "No Docker containers should be running for this test to begin."
    echo "To kill all running containers:"
    echo "   docker kill \$(docker ps -q)"
    exit 1
fi

if [ $(ps aux | grep '[r]osmaster' | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "Kill the existing rosmaster process before running this test."
    exit 1
fi

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

# launch a roscore process and detach from it
# don't worry, we kill this process later in
# the script using its PID
roscore > /dev/null 2>&1 &

./status.sh

./shutdown.sh

# find the PID of the roscore process we created
ROSCORE_PID=$(ps aux | grep '[r]osmaster' | awk '{print $2}')
kill -9 $ROSCORE_PID

cd tests