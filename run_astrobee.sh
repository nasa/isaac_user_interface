#!/bin/bash

set -e

XSOCK=/tmp/.X11-unix
XAUTH=/tmp/.docker.xauth
touch $XAUTH
xauth nlist $DISPLAY | sed -e 's/^..../ffff/' | xauth -f $XAUTH nmerge -

docker run -it --rm --name astrobee \
        --network iui \
        --volume=$XSOCK:$XSOCK:rw \
        --volume=$XAUTH:$XAUTH:rw \
        --env="ROS_MASTER_URI=http://rosmaster:11311" \
        --env="XAUTHORITY=${XAUTH}" \
        --env="DISPLAY" \
        --gpus all \
      astrobee/astrobee:latest-ubuntu20.04 \
    /astrobee_init.sh roslaunch astrobee sim.launch --wait dds:=false robot:=sim_pub
