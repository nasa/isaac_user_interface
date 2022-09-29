#!/usr/bin/env python3
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

"""
Turn an OBJ file into 3D Tiles.
"""

import argparse
import json
import logging
import os

import numpy as np
from obj_geometry import Geometry
from tile_generator import TileGenerator
from tile_system import TileSystem

DEFAULT_TARGET_TEXELS_PER_TILE = 512


def get_auto_config(geom):
    """
    Return auto-configured tile system parameters designed so the
    (0,0,0) tile at zoom level 0 includes the whole geometry. Set
    min_zoom to 0, creating a single top-level tile that holds
    everything.
    """
    bbox = geom.get_bounding_box()
    centroid = 0.5 * (bbox.min_corner + bbox.max_corner)
    box_dims = bbox.max_corner - bbox.min_corner
    max_dim = np.max(box_dims)
    origin = centroid - 0.5 * 1.1 * box_dims
    return {
        "origin": list(origin),
        "scale": 1.1 * max_dim,
        "min_zoom": 0,
    }


def tiler(in_obj, out_dir, target_texels_per_tile, debug_glb, debug_tileset):
    if os.path.exists(out_dir):
        logging.warning(f"Output directory {out_dir} already exists, not overwriting")
        return

    geom = Geometry.read(in_obj)

    # Note that we could read the config from a file instead if we want
    # to keep the tile system consistent from run to run. But the
    # auto-config is convenient.
    config = get_auto_config(geom)
    logging.info("%s", json.dumps(config, indent=4, sort_keys=True))

    tile_system = TileSystem(
        np.array(config["origin"], dtype=np.float64),
        config["scale"],
        "{zoom}/{xi}/{yi}/{zi}",
    )
    generator = TileGenerator(
        out_dir,
        tile_system,
        config["min_zoom"],
        target_texels_per_tile,
        debug_glb,
        debug_tileset,
    )

    generator.generate(geom)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-s",
        "--image_size",
        help="hint desired resolution for tile texture images",
        nargs="?",
        type=int,
        default=DEFAULT_TARGET_TEXELS_PER_TILE,
    )
    parser.add_argument(
        "--debug-glb",
        help="output GLB format tiles and debug_glb_viewer.html",
        default=False,
        action="store_true",
    )
    parser.add_argument(
        "--debug-tileset",
        help="output debug_tileset_viewer.html",
        default=False,
        action="store_true",
    )
    parser.add_argument("in_obj", help="input obj file")
    parser.add_argument("out_dir", help="output directory for 3D tiles")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    tiler(
        args.in_obj, args.out_dir, args.image_size, args.debug_glb, args.debug_tileset
    )


if __name__ == "__main__":
    main()
