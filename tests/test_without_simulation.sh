#!/bin/bash

if [ $(docker container ls | grep rosmaster | wc -l) -gt 0 ]; then
    docker kill rosmaster
fi

set -e

export ROS_MASTER_URI=http://localhost:11311

# this is the gateway ip for the isaac docker network
export ROS_IP=172.19.0.1

# go back to repository root
cd ..

./shutdown.sh
./build.sh
./run.sh

# this is a blocking command
# while this is running other checks
# should be done
# for now, ctrl+c to continue
roscore

# =========================
# ideas for checks
# =========================
# curl -LI http://localhost:8080/api/config.json
# docker exec -it rosbridge /ros_entrypoint.sh roswtf
# =========================

# make sure a rosmaster docker container was not launched
if [ $(docker container ls -a | grep rosmaster | wc -l) -gt 0 ]; then

    if [ $(docker inspect rosmaster | grep Running | grep true | wc -l) -gt 0 ]; then

        echo "ERROR! ROS Master node Docker container detected."
        exit 1

    fi

fi

./status.sh
./shutdown.sh

# return to tests directory
cd tests