#!/bin/bash

set -e

source /home/khaled/astrobee/devel/setup.bash
cd /home/khaled/Repositories/isaac_data_interface

export ROS_MASTER_URI=http://localhost:11311
./build.sh
./run.sh

export ROS_IP=`ip -4 addr show docker0 | grep -oP "(?<=inet ).*(?=/)"`
roslaunch astrobee sim.launch rviz:=false dds:=false robot:=sim_pub streaming_mapper:=false --wait

./shutdown.sh