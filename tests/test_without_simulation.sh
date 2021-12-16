#!/bin/bash

set -e

source /home/khaled/astrobee/devel/setup.bash
cd /home/khaled/Repositories/isaac_user_interface
export ROS_MASTER_URI=http://localhost:11311

./build.sh
./run.sh
sleep 5
./status.sh
./shutdown.sh