#!/bin/bash

if [ $(docker container ls | grep rosmaster | wc -l) -gt 0 ]; then
    docker kill rosmaster
fi

set -e

source /home/khaled/astrobee/devel/setup.bash

# go back to repository root
cd ..

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

./shutdown.sh
./build.sh
./run.sh

# ================ debugging ================
./status.sh
sleep 2
curl -LI http://localhost:8080
sleep 5 
curl -LI http://localhost:8080/api/config.json
sleep 2
docker exec -it rosbridge /ros_entrypoint.sh roswtf
# ===========================================

# this is the gateway of the isaac network
export ROS_IP=172.19.0.1

# this is the fixed ip of the rosmaster node
# within the isaac network
export ROS_MASTER_URI=http://172.19.0.5:11311

# launch astrobee simulation connected to
# the ISAAC UI ROS Master node (--wait)
roslaunch astrobee sim.launch rviz:=false dds:=false robot:=sim_pub streaming_mapper:=false --wait

./status.sh

./shutdown.sh

# return to tests dir
cd tests
