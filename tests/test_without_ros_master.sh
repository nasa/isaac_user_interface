#!/bin/bash

if [ $(docker container ls | grep rosmaster | wc -l) -gt 0 ]; then
    docker kill rosmaster
fi

set -e

source /home/khaled/astrobee/devel/setup.bash
cd /home/khaled/Repositories/isaac_data_interface

export ROS_MASTER_URI=http://localhost:11311
./build.sh
./run.sh

./status.sh

sleep 2

curl -LI http://localhost:8080

sleep 5 

curl -LI http://localhost:8080/api/config.json

sleep 2

docker exec -it rosbridge /ros_entrypoint.sh roswtf

export ROS_IP=`ip -4 addr show docker0 | grep -oP "(?<=inet ).*(?=/)"`
roslaunch astrobee sim.launch --wait

./shutdown.sh