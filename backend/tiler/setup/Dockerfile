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

FROM ubuntu:20.04

SHELL ["/bin/bash", "-c"]

# suppress certain warnings during install_apt
ARG DEBIAN_FRONTEND=noninteractive
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

COPY setup/define_install_steps.sh /steps

RUN source /steps && install_apt

# suppress detached head warnings later
RUN git config --global advice.detachedHead false

RUN source /steps && install_premake

RUN source /steps && install_xatlas

RUN source /steps && install_obj23dtiles

RUN mkdir -p /tiler

COPY *.py *.html *.js /tiler/
