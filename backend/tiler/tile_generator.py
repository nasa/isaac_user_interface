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
Library for generating a 3D Tiles reperesentation from an OBJ file.
"""

import json
import logging
import os
import shutil

import cv2
import numpy as np
from obj_geometry import Geometry, abs_path_from_file, rel_path_from_file
from tile_system import Tile

UPSAMPLE_FACTOR = 1.0
"""
Upsampling factor for image processing.

As a workaround for the oversimplified pixel resampling algorithm in
example_repack, we upsample images before repacking and downsampling them to
the desired resolution. This means the resampling is effectively being
provided by the more sophisticated algorithms available in OpenCV.

Increasing the value up to about 3.0 provides a noticeable quality improvement,
but unfortunately, we run into an error in example_repack's image loading
library if it tries to unpack an image that will occupy more than ~ 1 GB memory
(it uses 32-bit byte offsets). We can't really set UPSAMPLE_FACTOR larger than
1.0 as long as some of the models we care about have texture images at size
8192 x 8192.  If the texture images were limited to 2048 x 2048 we would
probably be able to go up to 3.0.
"""

BIG_GEOMETRIC_ERROR = 100
"""
An arbitrary big value to provide for the 3D Tiles geometricError property we
use when we want to ensure that a tile is always rendered.
"""

Z_UP_TO_Y_UP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.int32)
"""
Z-up to Y-up rotation.
"""

Y_UP_TO_Z_UP = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], dtype=np.int32)
"""
Y-up to Z-up rotation.
"""


def dosys(cmd, exc_on_error=True):
    """
    Execute @cmd with logging to console. If @exc_on_error is True, raise an
    exception if the command returns with a non-zero return value (error).
    """
    logging.info("%s", cmd)
    ret = os.system(cmd)
    if ret != 0:
        logging.warning("warning: command returned with non-zero return value %s", ret)
        if exc_on_error:
            raise RuntimeError("bailing out after dosys() error")
    return ret


def resize_to(out_dim, in_path, out_path, scale_factor_limit=None):
    """
    Read the image at @in_path, resize to @out_dim, and write to @out_path.

    @out_dim is a tuple (width, height). Each of the values is
    interpreted as a maximum constraint, and the output image will
    preserve the input image's aspect ratio. For example, if @out_dim is
    (100, 100), the output image could have size (100, 50), (75, 100),
    or (100, 100), whatever best matches the input aspect ratio. This is
    the same behavior as ImageMagick "convert -resize WxH".

    If @scale_factor_limit is specified, it provides a maximum scale
    factor that can reduce the output image size if it is smaller than
    the scale factor calculated from @out_dim. This can be used to
    ensure the output image resolution never exceeds the original source
    resolution, which would waste space without providing any benefit.
    """
    logging.info(f"resize_to {out_dim} {in_path} {out_path} {scale_factor_limit}")
    assert os.path.exists(in_path)
    in_img = cv2.imread(in_path, cv2.IMREAD_UNCHANGED)
    in_h, in_w, num_channels = in_img.shape

    # Adjust out_dim to preserve the input aspect ratio
    out_w, out_h = out_dim
    scale_factor = min(float(out_w) / in_w, float(out_h) / in_h)
    if scale_factor_limit:
        scale_factor = min(scale_factor_limit, scale_factor)
    out_dim_aspect = tuple([int(round(scale_factor * val)) for val in (in_w, in_h)])

    out_img = cv2.resize(in_img, out_dim_aspect, interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(out_path, out_img)

    return scale_factor


def resize_scale(scale_factor, in_path, out_path):
    """
    Read the image at @in_path, scale by @scale_factor, and write to
    @out_path.
    """
    logging.info(f"resize_scale {scale_factor} {in_path} {out_path}")
    assert os.path.exists(in_path)
    in_img = cv2.imread(in_path, cv2.IMREAD_UNCHANGED)
    in_h, in_w, num_channels = in_img.shape

    out_dim = tuple([int(round(scale_factor * val)) for val in (in_w, in_h)])

    out_img = cv2.resize(in_img, out_dim, interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(out_path, out_img)


class TileGenerator(object):
    """
    Class for generating a 3D Tiles reperesentation from an OBJ file.
    """

    def __init__(
        self,
        out_path,
        tile_system,
        min_zoom,
        target_texels_per_tile,
        debug_glb,
        debug_tileset,
    ):
        self.out_path = out_path
        """
        The path to the directory where temporary build files
        and 3D Tiles output files will be written.
        """

        self.tile_system = tile_system
        """
        A TileSystem instance defining the tile naming scheme and how
        tile indices correspond to nominal tile bounding boxes.
        """

        self.min_zoom = min_zoom
        """
        The minimum zoom level of the TileSystem to use for the top 3D
        Tiles that contain actual geometry.
        """

        self.target_texels_per_tile = target_texels_per_tile
        """
        A size hint for the desired width and height (in pixels) of the
        texture image associated with each 3D Tile. Actual output texture
        images could be larger or smaller than the size hint in certain
        corner cases.
        """

        self.debug_glb = debug_glb
        """
        If True, output GLB format tiles and debug_glb_viewer.html.
        """

        self.debug_tileset = debug_tileset
        """
        If True, output debug_tileset_viewer.html.
        """

        self.up_texture_map = {}
        """
        A dictionary mapping original texture image paths to upsampled output
        texture image paths. Used in writing modified MTL files that reference
        the upsampled image textures.
        """

        self.input_texel_size = None
        """
        The median size of a texture image pixel (texel) in the original
        source texture images. If the xyz coordinates in the geometry
        are interpreted as physical units of meters (as in ISAAC
        geometry mapper models), the value has units of meters per
        texel.
        """

        if self.debug_glb:
            self.leaf_tiles_path = os.path.join(
                self.out_path, "build", "leaf_tiles.txt"
            )
            self.leaf_tiles = None

    def generate(self, geom):
        """
        Output a 3D Tile set for the specified Geometry. This is the
        main driver function.
        """
        self.input_texel_size = geom.get_median_texel_size()
        self.upsample_texture(geom)

        if self.debug_glb:
            os.makedirs(os.path.dirname(self.leaf_tiles_path), exist_ok=True)
            self.leaf_tiles = open(self.leaf_tiles_path, "w", encoding="utf-8")

        meta = {
            "asset": {"version": "1.0"},
            "geometricError": BIG_GEOMETRIC_ERROR,
            "root": {
                "boundingVolume": geom.get_bounding_volume(),
                "geometricError": BIG_GEOMETRIC_ERROR,
                "refine": "REPLACE",
            },
        }
        meta["root"]["children"] = self.generate_top_tiles(geom)

        tileset_path = self.write_tileset(meta)
        self.install_file(tileset_path)

        if self.debug_glb:
            self.write_debug_glb_viewer(geom)
        if self.debug_tileset:
            self.write_debug_tileset_viewer(geom)

    def write_tileset(self, meta):
        """
        Write the tileset.json metadata file.
        """
        tileset_path = self.get_tileset_path()
        with open(tileset_path, "w", encoding="utf-8") as out:
            json.dump(meta, out, ensure_ascii=False, indent=4)
        return tileset_path

    def write_debug_glb_viewer(self, geom):
        """
        Write debug_glb_viewer.{html,js}.

        Opening the viewer in a browser will use Three.js GLTFLoader to
        load and visualize the GLB-format version of every leaf tile in
        the tile set, which should look almost exactly like the original
        OBJ model at full texture resolution.
        """
        self.leaf_tiles.close()
        self.leaf_tiles = None

        this_dir = os.path.dirname(os.path.realpath(__file__))
        base_prefix = "debug_glb_viewer"

        in_html_path = os.path.join(this_dir, base_prefix + ".html")
        out_html_path = os.path.join(self.out_path, "build", base_prefix + ".html")
        shutil.copyfile(in_html_path, out_html_path)

        in_js_path = os.path.join(this_dir, base_prefix + ".js")
        out_js_path = os.path.join(self.out_path, "build", base_prefix + ".js")
        with open(self.leaf_tiles_path, "r", encoding="utf-8") as leaf_tiles:
            leaf_tiles_text = leaf_tiles.read()
        with open(in_js_path, "r", encoding="utf-8") as in_js:
            js_text = in_js.read()

        bbox = geom.get_bounding_box()
        centroid = 0.5 * (bbox.min_corner + bbox.max_corner)
        width = np.max(bbox.max_corner - bbox.min_corner)
        with open(out_js_path, "w", encoding="utf-8") as out_js:
            replace_params = (
                ("{{ leaf_tiles }}", leaf_tiles_text),
                ("{{ centroid }}", json.dumps(list(centroid))),
                ("{{ width }}", str(width)),
            )
            for pattern, value in replace_params:
                js_text = js_text.replace(pattern, value)
            out_js.write(js_text)

        logging.info("=====================================")
        logging.info("Generated %s", out_html_path)
        logging.info("To view the GLB format leaf tiles:")
        logging.info("  1. Run a local web server:")
        logging.info("       cd %s", os.path.join(self.out_path, "build"))
        logging.info("       python3 -m http.server")
        logging.info("       (OR python2 -m SimpleHTTPServer)")
        logging.info(
            "  2. Point your browser at: http://localhost:8000/%s.html", base_prefix
        )
        logging.info("=====================================")

    def write_debug_tileset_viewer(self, geom):
        """
        Write debug_tileset_viewer.{html,js}.

        Opening the viewer in a browser will use the NASA AMMOS
        3D-tiles-renderer library to load and visualize the 3D Tiles
        tile set. Bounding boxes for individual 3D Tiles are displayed
        for debugging, so you can see when parent tiles are replaced
        with higher-zoom children.
        """
        this_dir = os.path.dirname(os.path.realpath(__file__))
        base_prefix = "debug_tileset_viewer"

        in_html_path = os.path.join(this_dir, base_prefix + ".html")
        out_html_path = os.path.join(self.out_path, "build", base_prefix + ".html")
        shutil.copyfile(in_html_path, out_html_path)

        in_js_path = os.path.join(this_dir, base_prefix + ".js")
        out_js_path = os.path.join(self.out_path, "build", base_prefix + ".js")
        with open(in_js_path, "r", encoding="utf-8") as in_js:
            js_text = in_js.read()

        bbox = geom.get_bounding_box()
        centroid = 0.5 * (bbox.min_corner + bbox.max_corner)
        width = np.max(bbox.max_corner - bbox.min_corner)
        with open(out_js_path, "w", encoding="utf-8") as out_js:
            replace_params = (
                ("{{ centroid }}", json.dumps(list(centroid))),
                ("{{ width }}", str(width)),
            )
            for pattern, value in replace_params:
                js_text = js_text.replace(pattern, value)
            out_js.write(js_text)

        logging.info("=====================================")
        logging.info("Generated %s", out_html_path)
        logging.info("To view the 3D Tiles tile set:")
        logging.info("  1. Run a local web server:")
        logging.info("       cd %s", os.path.join(self.out_path, "build"))
        logging.info("       python3 -m http.server")
        logging.info("       (OR python2 -m SimpleHTTPServer)")
        logging.info(
            "  2. Point your browser at: http://localhost:8000/%s.html", base_prefix
        )
        logging.info(
            "Note that you may find you need to zoom the viewer in and out a bit to get the tiles to initially load (use mouse wheel or two-finger scroll motion)."
        )
        logging.info("=====================================")

    def generate_top_tiles(self, geom):
        """
        Generate the top tiles in the tile set that contain actual
        geometry. Depending on the tile system parameters and the
        @min_zoom value, there might be one such tile, or many.

        All of these top tiles will be children of a single root tile
        with no geometry (no 3D Tiles content field specified).
        """
        bbox = geom.get_bounding_box()
        min_idx = self.tile_system.get_index_vec_for_pt(bbox.min_corner, self.min_zoom)
        max_idx = (
            self.tile_system.get_index_vec_for_pt(bbox.max_corner, self.min_zoom) + 1
        )

        meta = []
        for xi in range(min_idx[0], max_idx[0]):
            for yi in range(min_idx[1], max_idx[1]):
                for zi in range(min_idx[2], max_idx[2]):
                    tile = Tile(self.min_zoom, xi, yi, zi)
                    child_meta = self.generate_tile(
                        geom, tile, True, BIG_GEOMETRIC_ERROR
                    )
                    if child_meta is not None:
                        meta.append(child_meta)
        return meta

    def get_crop_tile_path(self, tile):
        """
        Return the path to use for writing a tile after the crop step.
        """
        return (
            os.path.join(self.out_path, "build", self.tile_system.get_path(tile))
            + "_crop"
        )

    def get_repack_tile_path(self, tile):
        """
        Return the path to use for writing a tile after the texture repack step.
        """
        return (
            os.path.join(self.out_path, "build", self.tile_system.get_path(tile))
            + "_repack"
        )

    def get_downsample_tile_path(self, tile):
        """
        Return the path to use for writing a tile after the downsample texture image step.
        """
        return (
            os.path.join(self.out_path, "build", self.tile_system.get_path(tile))
            + "_downsample"
        )

    def get_output_tile_path(self, tile):
        """
        Return the path to use for writing the final output file.
        """
        return os.path.join(self.out_path, "build", self.tile_system.get_path(tile))

    def get_tileset_path(self):
        """
        Return the path to use for writing the tile set metadata.
        """
        return os.path.join(self.out_path, "build", "tileset.json")

    def upsample_texture(self, geom):
        """
        Upsample the original texture images, prior to doing per-tile
        repacking and dowsampling.
        """
        for input_img_path, input_img_shape in geom.mtllib.materials.values():
            full_input_img_path = abs_path_from_file(
                input_img_path, geom.mtllib.input_path
            )
            input_base = os.path.basename(input_img_path)
            output_base = f"up_{input_base}"
            output_base = os.path.splitext(output_base)[0] + ".png"
            output_img_path = os.path.realpath(
                os.path.join(self.out_path, "build", output_base)
            )
            os.makedirs(os.path.dirname(output_img_path), exist_ok=True)
            resize_scale(UPSAMPLE_FACTOR, full_input_img_path, output_img_path)
            rel_output_img_path = os.path.join("..", "..", "..", output_base)
            self.up_texture_map[input_img_path] = rel_output_img_path

    def write_cropped_tile(self, geom, tile):
        """
        Write the tile after the crop step. This step writes modified
        OBJ and MTL files that reference the upsampled texture images.
        """
        crop_tile_path = self.get_crop_tile_path(tile)
        os.makedirs(os.path.dirname(crop_tile_path), exist_ok=True)

        # Our geometry is inherently Z-up but glTF specifies Y-up, so we need
        # to apply a rotation. 3D Tiles uses Z-up coordinates and interprets
        # any glTF geometry as Y-up, so it will apply the inverse rotation to
        # any glTF models it loads and we'll end up back with our desired
        # geometry. (Note that our final B3DM format output is essentially a
        # wrapped binary glTF.) See
        # https://github.com/CesiumGS/3d-tiles/blob/main/specification/README.md#tile-transforms
        tf_geom = geom.get_rotated(Z_UP_TO_Y_UP)

        tf_geom.write(crop_tile_path + ".obj", self.up_texture_map)

    def repack_texture(self, tile):
        """
        Repack multiple texture images into a single texture image. This
        step writes modified OBJ, MTL, and texture images.
        """
        crop_tile_path = self.get_crop_tile_path(tile)
        repack_tile_path = self.get_repack_tile_path(tile)

        # this fails because example_repack has oversimplified path logic
        # dosys(f"example_repack {crop_tile_path}.obj {repack_tile_path}")

        # instead do this
        common_dir = os.path.dirname(crop_tile_path)
        crop_tile_base = os.path.basename(crop_tile_path)
        repack_tile_base = os.path.basename(repack_tile_path)
        dosys(
            f"cd {common_dir} && example_repack {crop_tile_base}.obj {repack_tile_base}"
        )

    def downsample_texture(self, tile, force_full_res):
        """
        Downsample the texture image output by the repack step. Return
        the effective scale factor for the whole processing chain
        between the original source image and the final downsampled
        image.
        """
        repack_tile_path = self.get_repack_tile_path(tile)
        downsample_tile_path = self.get_downsample_tile_path(tile)

        repack_tile_image = repack_tile_path + ".png"
        downsample_tile_image = downsample_tile_path + ".jpg"

        if force_full_res:
            scale_factor = 1.0 / UPSAMPLE_FACTOR
            resize_scale(
                scale_factor,
                repack_tile_image,
                downsample_tile_image,
            )
        else:
            scale_factor = resize_to(
                (self.target_texels_per_tile, self.target_texels_per_tile),
                repack_tile_image,
                downsample_tile_image,
                scale_factor_limit=1.0 / UPSAMPLE_FACTOR,
            )

        repack_geom = Geometry.read(repack_tile_path + ".obj")
        assert len(repack_geom.mtllib.materials) == 1
        rel_repack_tile_image, repack_mtl_img_shape = next(
            iter(repack_geom.mtllib.materials.values())
        )
        rel_downsample_tile_image = os.path.basename(downsample_tile_image)
        downsample_texture_map = {
            rel_repack_tile_image: rel_downsample_tile_image,
        }
        repack_geom.write(downsample_tile_path + ".obj", downsample_texture_map)

        return scale_factor * UPSAMPLE_FACTOR

    def obj23dtiles(self, output_ext, input_path, output_path):
        """
        Call obj23dtiles to convert the OBJ to the specified type.
        Return the path to the output file.
        """
        arg_map = {
            ".glb": "-b",
            ".b3dm": "--b3dm",
        }
        arg = arg_map[output_ext]

        # This should theoretically work, but the script doesn't properly
        #   respect the -o argument:
        # dosys(f"obj23dtiles {arg} -i {input_path}.obj -o {output_path}{output_ext}")

        # So we do this instead:
        dosys(f"obj23dtiles {arg} -i {input_path}.obj")
        os.rename(input_path + output_ext, output_path + output_ext)
        return output_path + output_ext

    def convert_to_glb(self, tile):
        """
        Debug only. Convert the final OBJ output to GLB format that can
        be loaded by debug_glb_viewer.html.
        """
        downsample_tile_path = self.get_downsample_tile_path(tile)
        downsample_geom = Geometry.read(downsample_tile_path + ".obj")

        # A bit of a hack. The debug viewer assumes Z-up, so undo
        # the rotation we applied earlier.
        unrot_geom = downsample_geom.get_rotated(Y_UP_TO_Z_UP)
        unrot_tile_path = downsample_tile_path + "_unrot"
        unrot_geom.write(unrot_tile_path + ".obj")

        return self.obj23dtiles(
            ".glb", unrot_tile_path, self.get_output_tile_path(tile)
        )

    def convert_to_b3dm(self, tile):
        """
        Convert the final OBJ output to B3DM format compatible with
        the 3D Tiles spec.
        """
        downsample_tile_path = self.get_downsample_tile_path(tile)
        output_tile_b3dm = self.obj23dtiles(
            ".b3dm",
            downsample_tile_path,
            self.get_output_tile_path(tile),
        )
        self.install_file(output_tile_b3dm)

    def install_file(self, build_path):
        """
        Copy a file from its location under the "build" directory to the
        corresponding location under the output "tiles" directory.
        """
        suffix = os.path.relpath(
            os.path.realpath(build_path),
            os.path.realpath(os.path.join(self.out_path, "build")),
        )
        install_path = os.path.realpath(os.path.join(self.out_path, "tiles", suffix))
        install_dir = os.path.dirname(install_path)
        os.makedirs(install_dir, mode=0o755, exist_ok=True)
        shutil.copyfile(build_path, install_path)
        os.chmod(install_path, 0o644)

    def generate_tile(self, parent_geom, tile, root, parent_max_error):
        """
        Generate one tile in the 3D Tiles tile set. This function is
        called recursively while walking the octree structure defined by
        the tile system.
        """
        logging.info("generate_tile %s", tile)

        geom = parent_geom.get_cropped(self.tile_system.get_bounding_box(tile))
        if geom.is_empty():
            return None

        self.write_cropped_tile(geom, tile)
        self.repack_texture(tile)

        # If cropping didn't discard any faces, go ahead and force full-res
        # output at this zoom level. Further splitting the tile is not likely
        # to help. This is a corner case for our poor-man's cropping approach
        # that discards faces but can't crop a face to fit a tile. The
        # recursion can blow up if it encounters a face whose full-res texture
        # image is larger than the target tile image size.
        force_full_res = not root and (len(parent_geom.f) == len(geom.f))

        scale_factor = self.downsample_texture(tile, force_full_res)

        self.convert_to_b3dm(tile)
        if self.debug_glb:
            output_tile_glb = self.convert_to_glb(tile)

        rel_tile_b3dm = rel_path_from_file(
            self.get_output_tile_path(tile) + ".b3dm",
            self.get_tileset_path(),
        )

        # The 3D Tiles geometricError field for a tile is defined to be the
        # maximum geometric error that would be incurred by *not* loading the
        # tile. In our approach, that is the maximum error in the parent tile
        # this tile replaces.
        meta = {
            "boundingVolume": geom.get_bounding_volume(),
            "content": {"uri": rel_tile_b3dm},
            "geometricError": parent_max_error,
        }

        # We are currently using identical mesh geometry at all zoom levels in
        # the tile set (no mesh simplification). However, lower-zoom tiles do
        # have more scaled-down texture images, so the max error at a zoom
        # level is based on its texel size.
        max_error = self.input_texel_size / scale_factor

        # This tile is a leaf if it is at the full source resolution. Note that
        # the computed scale_factor at full resolution might not be exactly 1.0
        # due to round-off.
        if scale_factor > 0.999:
            if self.debug_glb:
                rel_tile_glb = rel_path_from_file(output_tile_glb, self.leaf_tiles_path)
                self.leaf_tiles.write(rel_tile_glb + "\n")
            return meta

        # If not a leaf, expand children.
        meta["children"] = []
        for child in self.tile_system.get_children(tile):
            child_meta = self.generate_tile(geom, child, False, max_error)
            if child_meta is not None:
                meta["children"].append(child_meta)
        return meta
