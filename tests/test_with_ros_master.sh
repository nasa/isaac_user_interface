#!/bin/bash

set -e

source /home/khaled/astrobee/devel/setup.bash
cd /home/khaled/Repositories/isaac_data_interface

unset ROS_MASTER_URI

./build.sh
./run.sh


# Start native astrobee simulation and connect to socket network
export ROS_IP=`ip -4 addr show docker0 | grep -oP "(?<=inet ).*(?=/)"`
export ROS_MASTER_URI=http://172.19.0.5:11311
roslaunch astrobee sim.launch rviz:=false dds:=false robot:=sim_pub streaming_mapper:=false --wait

./shutdown.sh
