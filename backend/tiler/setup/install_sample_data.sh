#!/bin/bash
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

setup_dir=$(dirname "$(readlink -f "$0")")
cd "$setup_dir"

if [ -e data/.install_data_complete ]; then
    echo "Sample data already installed, doing nothing."
    exit 0
fi

mkdir -p data
cd data

# download sample model with extraneous imagery in texture atlas
curl -LOs https://raw.githubusercontent.com/mikedh/trimesh/main/models/fuze.obj
curl -LOs https://raw.githubusercontent.com/mikedh/trimesh/main/models/fuze.obj.mtl
curl -LOs https://raw.githubusercontent.com/mikedh/trimesh/main/models/fuze%20uv.jpg

# fix texture atlas filename because repack OBJ parser can't handle
# spaces in filenames
mv "fuze%20uv.jpg" fuze_uv.jpg
sed -i "s/fuze uv.jpg/fuze_uv.jpg/" fuze.obj.mtl

touch .install_data_complete
