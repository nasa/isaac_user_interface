#!/bin/bash
#
# Copyright © 2021, United States Government, as represented by the Administrator of the 
# National Aeronautics and Space Administration. All rights reserved.
#
# The “ISAAC - Integrated System for Autonomous and Adaptive Caretaking platform” software is 
# licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License. 
#
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the 
# License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
# either express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#

set -e

echo "--------------------------------------------------------------------------------------------------"
echo "Shutting down the ISAAC User Interface"
echo "--------------------------------------------------------------------------------------------------"

usage_string="$0 usage:  [-h] [-i | --isaac] [-a | --astrobee]"

usage()
{
    echo "$usage_string"
}

bridge=""

while [ "$1" != "" ]; do
    case $1 in
        -i | --isaac )      bridge=" -f ./plugins/isaac.docker-compose.yml "
                            ;;
        -a | --astrobee )   bridge=" -f ./plugins/astrobee.docker-compose.yml "
                            ;;
        -h | --help )       usage
                            exit
                            ;;
        * )                 usage
                            exit 1
    esac
    shift
done

if [ $(docker container ls | grep rosmaster | wc -l)  -gt 0 ]; then

    docker-compose -f ./docker-compose.yml -f ./plugins/ros.docker-compose.yml $bridge down --remove-orphans --timeout 1

else

    docker-compose -f ./docker-compose.yml down --remove-orphans --timeout 1

fi

echo "--------------------------------------------------------------------------------------------------"
echo "See you later, alligator!"
echo "--------------------------------------------------------------------------------------------------"
