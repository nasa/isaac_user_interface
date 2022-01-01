#!/bin/bash

set -e

if [ $(docker image ls | grep astrobee | grep latest-ubuntu20.04 | wc -l) -lt 1 ]; then 
    echo "ERROR!"
    echo "The Docker image astrobee/astrobee:latest-ubuntu20.04 was not found."
    echo "Build it using the nasa/astrobee repository."
    exit 1
fi

SCRIPT_PATH=$(dirname "$(realpath -s "$0")")

cd $SCRIPT_PATH/../../..

./shutdown.sh

if [ $(docker ps -q | wc -l) -gt 0 ]; then
    echo "ERROR!"
    echo "No Docker containers should be running for this test to begin."
    exit 1
fi

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

# the -i passed to build and run scripts indicates
# that we want to also launch Astrobee sim
./build.sh -a
./run.sh -a

./status.sh

XSOCK=/tmp/.X11-unix
XAUTH=/tmp/.docker.xauth
touch $XAUTH
xauth nlist $DISPLAY | sed -e 's/^..../ffff/' | xauth -f $XAUTH nmerge -

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
      astrobee/astrobee:latest-ubuntu20.04 \
    /astrobee_init.sh roslaunch astrobee sim.launch --wait dds:=false robot:=sim_pub
