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

import os
import subprocess
from datetime import datetime

import numpy as np

# This file crops an obj file based on a bounding box, and outputs
# the cropped mesh as well as the texture that pertains to the remaining
# part of the mesh. This code calls blender_code.py, which relies on Blender.
#
# Make sure to set the `BLENDER_EXEC_DIR` variable to point to the location
# of your Blender executable. Tested with Blender 3.2.1
#
# Tuneable parameters: texture output resolution
#
# Version 8/12/22
# Author: Nitzan Orr, University of Wisconsin--Madison
# Email: nitzan@cs.wisc.edu
# Please reach out with any questions
#
# Version 6/6/22
# Author: Khaled Sharif, NASA

BLENDER_EXEC_DIR = "/home/user/software/blender-3.2.1-linux-x64"


def run(command):
    try:
        subprocess.run(command, shell=True, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        print(e.returncode)
        print(e.output)


# Get the 3 vertex indices of a face from a line defining a face
def get_f_line_vertex_indices(line_elements):
    """
    Examples of lines defining faces.
    In each line, vertex indices are 10, 40, and 70
    f 10 40 70
    f 10/10 40/20 70/30
    f 10/30/40 40/50/60 70/80/90
    f 10//30 40//60 70//90
    """
    output = []
    for l in line_elements:
        output.append(l.split("/"))  # split each result by '/'
    return output[1][0], output[2][0], output[3][0]


# Main cropping function: given a bounding box, if the centroid of a face
# falls within the bounding box, then include the whole face, otherwise discard.
# Also crop the texture image to include only textures requested by the bounding box
def make_tile_4(
    input_file, output_file, minX, minY, minZ, maxX, maxY, maxZ, resolution=512
):

    print("\nCropping Mesh:", input_file)

    vertex_idx = [-1]

    with open(input_file, "r", encoding="utf-8") as obj_file, open(
        output_file, "w", encoding="utf-8"
    ) as new_obj_file:
        # Retrieve index of each vertex by adding all vertices to list
        # And write vertices, vt, vn, etc. to new_obj_file to maintain
        # their index after cropping
        for line in obj_file:
            line_elements = line.split()
            if line_elements:
                if line_elements[0] in [
                    "v",
                    "vt",
                    "vn",
                    "vp",
                    "l",
                    "usemtl",
                    "mtllib",
                    "o",
                    "g",
                ]:
                    new_obj_file.write(line)
                    if line_elements[0] == "v":
                        vX = float(line_elements[1])
                        vY = float(line_elements[2])
                        vZ = float(line_elements[3])
                        vertex_idx.append((vX, vY, vZ))
                if line_elements[0] == "f":
                    # get vertex indices from line defining a face
                    vertex_idxs = get_f_line_vertex_indices(line_elements)
                    v1_idx = int(vertex_idxs[0])
                    v2_idx = int(vertex_idxs[1])
                    v3_idx = int(vertex_idxs[2])

                    # get x y z coords of the 3 vertices making a face
                    v1 = np.array(vertex_idx[v1_idx])
                    v2 = np.array(vertex_idx[v2_idx])
                    v3 = np.array(vertex_idx[v3_idx])

                    # calculate centroid of face
                    # centroid = (v1 + v2 + v3) / 3
                    centroid = (v1 + v2 + v3) / 3.0
                    bbox_min = np.array((minX, minY, minZ))
                    bbox_max = np.array((maxX, maxY, maxZ))

                    # check if triangle's centroid falls inside bbox
                    inside_bbox_min = (centroid >= bbox_min).all()
                    inside_bbox_max = (centroid < bbox_max).all()
                    inside_bbox = inside_bbox_min and inside_bbox_max

                    if inside_bbox:
                        new_obj_file.write(line)

    # Save only the textures pertaining to the newly cropped mesh
    # Assumes blender_code.py is in same directory at this file
    this_dir = os.path.dirname(os.path.realpath(__file__))
    print("PATH:", this_dir)
    blender_py_code_path = os.path.join(this_dir, "blender_code.py")

    # Command: cd [path_to_blender_executable] &&
    #  ./blender --background --python blender_code.py arg1 arg2 arg3)
    command = "cd " + BLENDER_EXEC_DIR
    command += (
        " && ./blender --background --python "
        + blender_py_code_path
        + " -- "
        + input_file
        + " "
        + output_file
        + " "
        + str(resolution)
    )
    print("COMMAND:", command)
    run(command)

    print("Wrote cropped mesh to:", output_file)
    print()


def main():
    # For testing cropper.py independently
    # `python3 cropper.py`
    input_file = "/path/to/run.obj"
    time_str = datetime.now().strftime("%Y_%m_%d-%I_%M_%S_%p")
    output_file = "/path/to/output_" + time_str + ".obj"
    # make_tile_4(input_file, output_file, 11, -9, 3, 13, -8, 6) # no crop
    # make_tile_4(input_file, output_file, 11, -9, 3, 13, -8.5, 6) # crops top
    make_tile_4(input_file, output_file, 11, -8.5, 3, 13, -8, 6)  # crops bottom


if __name__ == "__main__":
    main()
