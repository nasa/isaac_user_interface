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

FROM isaac:msgs

RUN apt update

RUN apt-get install -y \
    ros-kinetic-joint-state-publisher \
    ros-kinetic-robot-state-publisher \
    ros-kinetic-rosbridge-server \
    ros-kinetic-tf2-ros \
    ros-kinetic-tf2-web-republisher \
    ros-kinetic-interactive-marker-proxy

RUN . /opt/ros/kinetic/setup.sh \
  && apt-get update \
  && apt-get upgrade -y \
  && rosdep update 2>&1 | egrep -v 'as root|fix-permissions' \
  && apt-get install -y python-pip

RUN pip install future
RUN mkdir /rosbridge
COPY ./publishers.launch ./rosbridge/

RUN echo "#!/bin/bash\nset -e\n\nsource \"/opt/ros/kinetic/setup.bash\"\nsource \"/src/isaac/devel/setup.bash\"\nexec \"\$@\"" > /ros_entrypoint.sh && \
  chmod +x /ros_entrypoint.sh