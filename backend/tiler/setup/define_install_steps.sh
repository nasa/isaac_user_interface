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

# Define install steps to be sourced by both Dockerfile and install_local.sh

install_apt () {
    # install of apt-utils suppresses bogus warnings later
    apt-get update
    apt-get install -y apt-utils 2>&1 | grep -v "debconf: delaying package configuration, since apt-utils is not installed"
    apt-get install -y --no-install-recommends \
            build-essential \
            curl \
            git \
            npm \
            python3-numpy \
            python3-opencv
    rm -rf /var/lib/apt/lists/*
}

install_premake () {
    # used by xatlas
    mkdir /tmp/premake
    pushd /tmp/premake
    curl -LOs https://github.com/premake/premake-core/releases/download/v5.0.0-beta2/premake-5.0.0-beta2-linux.tar.gz
    tar xfz premake-5.0.0-beta2-linux.tar.gz
    mkdir -p /usr/bin
    mv premake5 /usr/bin
    popd
    rm -rf /tmp/premake
}

install_xatlas () {
    mkdir /tmp/xatlas
    pushd /tmp/xatlas

    # Using trey0 fork that restores the example_repack tool that was
    # removed from the main fork.
    git clone --quiet https://github.com/trey0/xatlas.git --branch repack

    cd xatlas
    premake5 gmake
    cd build/gmake
    make example_repack
    mv bin/x86_64/Release/example_repack /usr/bin
    popd
    rm -rf /tmp/xatlas
}

install_obj23dtiles () {
    mkdir -p /usr/lib
    pushd /usr/lib
    git clone --quiet https://github.com/PrincessGod/objTo3d-tiles.git
    cd objTo3d-tiles

    # We're depending on a low-profile individual developer. Let's
    # freeze the commit we're using to help mitigate the remote chance
    # of a supply chain attack.
    git checkout --quiet 181b186e2b3bddad0bd5d7857811f29b768f3406

    # Use ci instead of install because we need to use the
    # package-lock.json dependency versions or the build will break.
    # This package is no longer maintained and doesn't work with
    # the latest dependency versions.
    npm ci

    # Fix a case mismatch that is significant only on case-sensitive
    # file systems.
    cp lib/obj2b3dm.js lib/obj2B3dm.js

    # There's probably a better way to properly install this,
    # but not obvious.
    cat >/usr/bin/obj23dtiles <<EOF
#!/bin/sh
NODE_PATH="/usr/lib/objTo3d-tiles/node_modules:\$(npm root -g)" exec node /usr/lib/objTo3d-tiles/bin/obj23dtiles.js "\$@"
EOF
    chmod a+x /usr/bin/obj23dtiles
    popd
}

install_all () {
    install_apt
    install_premake
    install_xatlas
    install_obj23dtiles
}

# exit on error
set -e

# echo commands to stdout
BASH_XTRACEFD=1
set -x
