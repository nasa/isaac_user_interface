#!/bin/bash

set -e

cd /home/khaled/Repositories/isaac_user_interface

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

./shutdown.sh
./build.sh
./run.sh
./status.sh
# sleep 5
# ./status.sh
# ./shutdown.sh