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
Library defining a tile system, i.e., a mapping between integer tile
coordinates and the nominal bounding box for their corresponding tiles,
as well as how to form the path to each tile.
"""

import itertools

import numpy as np

DEFAULT_TILE_PATH_FORMAT = "{zoom}/{xi}/{yi}/{zi}"


class Tile(object):
    """
    Represents a tile in the tile system. Stores the zoom level and
    integer indices.
    """

    def __init__(self, zoom, xi, yi, zi):
        self.zoom = zoom
        self.xi = xi
        self.yi = yi
        self.zi = zi

    def __repr__(self):
        return f"<Tile {self.zoom}/{self.xi}/{self.yi}/{self.zi}>"


class BoundingBox(object):
    """
    A K-dimensional bounding box represented using its minimum and
    maximum corners.

    The interval constraint on each axis has "half-open" interval
    semantics [min, max), i.e., val is considered to be inside the box
    if it satisfies min <= val < max. Because adjacent tiles at the same
    zoom level in the tile system share boundaries, these semantics
    ensure every point is in exactly one tile at each zoom level, even
    if it falls exactly on a tile boundary.
    """

    def __init__(self, min_corner, max_corner):
        self.min_corner = min_corner
        self.max_corner = max_corner

    def __repr__(self):
        return f"<BoundingBox {self.min_corner} {self.max_corner}>"

    def is_inside(self, pts):
        """
        Return a boolean np.array indicating which points are inside the
        box.

        Inputs: @pts is an N x K np.array whose N rows represent N
        K-dimensional points.

        Outputs: An N x 1 np.array whose N rows are boolean values
        specifying which of the points are inside the box.
        """
        return np.logical_and(
            np.all(self.min_corner <= pts, axis=1),
            np.all(pts < self.max_corner, axis=1),
        )


class TileSystem(object):
    """
    Represents a tile system, i.e., a mapping between integer tile
    coordinates and the nominal bounding box for their corresponding
    tiles, as well as how to form the path to each tile.
    """

    def __init__(
        self, tile_origin, tile_scale, tile_path_format=DEFAULT_TILE_PATH_FORMAT
    ):
        self.tile_origin = tile_origin
        """
        The coordinates of the minimum corner of the (0,0,0) tile at
        each zoom level.

        You may find it convenient to set the tile origin to the minimum
        corner of the bounding box containing your complete geometry so
        that all tiles that contain geometry will have indices that are
        small and positive. Tiles with negative indices should in
        principle be fine, but having geometry that brackets the tile
        origin may force low-zoom tiles to be broken up in a sub-optimal
        way, with mild performance impact.
        """

        self.tile_scale = tile_scale
        """
        The width of the cubic tiles at zoom level 0. Each time the
        zoom level increases by 1, the width of the tiles is cut in
        half.
        """

        self.tile_path_format = tile_path_format
        """
        A format template used to build the path for a tile based
        on its indices.
        """

    def get_path(self, tile):
        """
        Return a path fragment used to build the path for the tile
        based on its indices.
        """
        return self.tile_path_format.format_map(tile.__dict__)

    def get_zoom_scale(self, zoom):
        """
        Return the width of the cubic tiles at the specified zoom
        level.
        """
        return self.tile_scale / 2**zoom

    def get_scale(self, tile):
        """
        Return the width of the cubic tile.
        """
        return self.get_zoom_scale(tile.zoom)

    def get_index_vec(self, tile):
        """
        Return the tile coordinates represented as an index vector.
        """
        return np.array([tile.xi, tile.yi, tile.zi], dtype=np.int32)

    def get_bounding_box(self, tile):
        """
        Return the nominal BoundingBox for the tile, as specified by the
        tile system.

        (Note that a tile's actual geometry content might sometimes
        extend outside the nominal tile volume, so the 3D Tiles
        boundingVolume property should be recalculated based on the
        actual geometry, to ensure correctness.)
        """
        scale = self.get_scale(tile)
        min_corner = self.tile_origin + scale * self.get_index_vec(tile)
        return BoundingBox(min_corner, min_corner + scale)

    def get_centroid(self, tile):
        """
        Return the centroid of the tile's bounding box.
        """
        return self.tile_origin + self.get_scale() * (
            self.get_index_vec(tile) + 0.5 * np.ones(3)
        )

    def get_index_vec_for_pt(self, pt, zoom):
        """
        Return the index vector for the tile containing the 3D @pt at
        the specified zoom level.
        """
        return ((pt - self.tile_origin) / self.get_zoom_scale(zoom)).astype(np.int32)

    def get_children(self, tile):
        """
        Return an iterator generating the children of the tile in the
        zoom hierarchy. (Each tile is subdivided into eight child tiles
        at the next zoom level.)
        """
        for xo, yo, zo in itertools.product([0, 1], repeat=3):
            yield Tile(
                tile.zoom + 1, 2 * tile.xi + xo, 2 * tile.yi + yo, 2 * tile.zi + zo
            )
