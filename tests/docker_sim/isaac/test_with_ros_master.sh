#!/bin/bash

set -e

if [ $(docker image ls | grep isaac | grep latest-ubuntu20.04 | wc -l) -lt 1 ] ; then 
    echo "ERROR!"
    echo "The Docker image isaac/isaac:latest-ubuntu20.04 was not found."
    echo "Build it using the nasa/isaac repository."
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
# that we want to also launch ISAAC sim
./build.sh -i
./run.sh -i

./status.sh

XSOCK=/tmp/.X11-unix
XAUTH=/tmp/.docker.xauth
touch $XAUTH
xauth nlist $DISPLAY | sed -e 's/^..../ffff/' | xauth -f $XAUTH nmerge -

# launch astrobee simulation connected to
# the ISAAC UI ROS Master node (--wait)
docker run -it --rm --name isaac \
        --network isaac \
        --volume=$XSOCK:$XSOCK:rw \
        --volume=$XAUTH:$XAUTH:rw \
        --env="ROS_MASTER_URI=http://172.19.0.5:11311" \
        --env="ASTROBEE_RESOURCE_DIR=/src/astrobee/src/astrobee/resources" \
        --env="XAUTHORITY=${XAUTH}" \
        --env="DISPLAY" \
        --gpus all \
      isaac/isaac:latest-ubuntu20.04 \
    /ros_entrypoint.sh roslaunch isaac sim.launch --wait dds:=false robot:=sim_pub
