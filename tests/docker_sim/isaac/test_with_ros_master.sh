#!/bin/bash

set -e

if [ $(docker image ls | grep isaac | grep latest-ubuntu20.04 | wc -l) -lt 1 ] ; then 
    echo "ERROR!"
    echo "The Docker image isaac/isaac:latest-ubuntu20.04 was not found."
    echo "Build it using the nasa/isaac repository."
    exit 1
fi

if [ $(docker ps -q | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "No Docker containers should be running for this test to begin."
    exit 1
fi

# go back to repository root
cd ../../..

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

./shutdown.sh
./build.sh
./run.sh

./status.sh

# launch astrobee simulation connected to
# the ISAAC UI ROS Master node (--wait)
docker run -it --rm --name astrobee \
        --network isaac \
        --volume=$XSOCK:$XSOCK:rw \
        --volume=$XAUTH:$XAUTH:rw \
        --env="ROS_MASTER_URI=http://172.19.0.5:11311" \
        --env="XAUTHORITY=${XAUTH}" \
        --env="DISPLAY" \
        --gpus all \
      isaac/isaac:latest-ubuntu20.04 \
    /astrobee_init.sh roslaunch astrobee sim.launch --wait
