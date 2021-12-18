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

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

./shutdown.sh
./build.sh
./run.sh

./status.sh

# this is the gateway of the isaac network
export ROS_IP=172.19.0.1

# this is the fixed ip of the rosmaster node
# within the isaac network
export ROS_MASTER_URI=http://172.19.0.5:11311

# launch astrobee simulation connected to
# the ISAAC UI ROS Master node (--wait)
roslaunch astrobee sim.launch rviz:=false dds:=false robot:=sim_pub --wait

# cannot run because sim node died
# and will show errors
# ./status.sh

./shutdown.sh

# return to tests dir
cd tests
