#!/bin/bash

if [ $(docker container ls | grep rosmaster | wc -l) -gt 0 ]; then
    docker kill rosmaster
fi

set -e

# go back to repository root
cd ..

# unset ROS_MASTER_URI to let the IUI know that
# it should launch its own ROS Master node
unset ROS_MASTER_URI

./shutdown.sh
./build.sh
./run.sh

sleep 2

./status.sh

sleep 2

curl -LI http://localhost:8080
curl -LI http://localhost:8080/api/config.json

docker exec -it rosbridge /ros_entrypoint.sh roswtf

# ./shutdown.sh

# return to tests directory
cd tests