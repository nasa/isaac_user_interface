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
Tools for working with textured 3D meshes. Read and write in OBJ format.
Perform basic processing.
"""

import array
import logging
import os

import cv2
import numpy as np
from tile_system import BoundingBox


def abs_path_from_file(rel_path, file_path):
    """
    Return the absolute path for the specified relative path assuming
    it was read from the file loaded from file_path.
    """
    return os.path.realpath(os.path.join(
        os.path.dirname(os.path.realpath(file_path)),
        rel_path
    ))


def rel_path_from_file(abs_path, file_path):
    """
    Return a relative path that would resolve to the specified
    absolute path if it was written to the file at file_path.
    Using relative paths makes it easier to relocate the tiler
    output.
    """
    return os.path.relpath(
        os.path.realpath(abs_path),
        os.path.dirname(os.path.realpath(file_path)),
    )


def parse_face_vertex(v):
    """
    Parse one of the vertex arguments to the OBJ "f" directive,
    returning a length-3 integer array. Each vertex argument can include
    up to three integer indices that reference the v, vt, and vn arrays,
    respectively. Missing indices are represented by the value -1.
    """
    idx_strings = v.split("/")
    idx = [(-1 if s == "" else int(s)) for s in idx_strings]
    idx.extend([-1] * (3 - len(idx)))
    return idx


def dump_face_vertex(idx):
    """
    Serialize one of the vertex arguments for the OBJ "f" directive to a
    string.  Input is a length-3 integer array, with missing indices
    represented by the value -1.
    """
    if idx[1] == -1:
        if idx[2] == -1:
            return str(idx[0])
        else:
            return "%s//%s" % (idx[0], idx[2])
    elif idx[2] == -1:
        return "%s/%s" % (idx[0], idx[1])
    else:
        return "%s/%s/%s" % (*idx,)


INT32_MAX = np.iinfo(np.int32).max


def garbage_collect(in_refs, in_objects):
    """
    Non-destructively garbage collect unused objects.

    Inputs: @in_objects should be an N x K np.array. @in_refs should be
    a length-M np.array of indices referencing rows of @in_objects.

    Rows of @in_objects are considered to be unused if no index in
    @in_refs references them. The return values are updated copies of
    @in_refs and @in_objects that discard the unused objects.

    Outputs: @out_objects will be an N' x K np.array, where N' is the
    number of distinct indices in @in_refs. @out_refs will be a length-M
    np.array of indices referencing rows of @out_objects, satisfying
    out_objects[out_refs[i], :] == in_objects[in_refs[i], :] for all i.
    """

    keep_refs = np.unique(in_refs)

    # fill invalid entries in reference index array with INT32_MAX in order to
    # force an error if we accidentally dereference them
    remap_refs = np.full(in_objects.shape[0], INT32_MAX, dtype=np.int32)
    remap_refs[keep_refs] = np.arange(keep_refs.size)

    out_refs = remap_refs[in_refs]
    out_objects = in_objects[keep_refs]

    return out_refs, out_objects


class MtlLib(object):
    """
    Represents the OBJ format's MTL companion file that specifies
    material properties. This implementation only surfaces texture image
    information so we can upsample/repack/downsample the texture
    atlases.
    """

    def __init__(self, input_path, materials, lines):
        self.input_path = input_path
        """
        The path the MTL file was read from.
        """

        self.materials = materials
        """
        A dictionary mapping each material name to a tuple of
        information about the material's texture image. The tuple has
        the form (material_image_path, material_image_shape), where
        material_image_shape is the shape (H, W) of the image loaded
        from material_image_path.
        """

        self.lines = lines
        """
        An unmodified array of the lines read from the original MTL
        file. The lines can be processed as they are written back to a
        modified MTL file.
        """

    @classmethod
    def read(cls, input_path):
        """
        Parse an MTL file, returning an MtlLib instance. The texture
        images will also be loaded in order to read their resolution.
        """
        input_path = os.path.realpath(input_path)
        logging.info("MtlLib.read %s", input_path)

        lines = []
        materials = {}
        mtl_name = None
        with open(input_path, "r", encoding="utf-8") as inp:
            for line in inp:
                lines.append(line)
                if line == "#":
                    continue
                fields = line.split(None, 1)
                if len(fields) < 2:
                    continue
                cmd, arg = fields
                arg = arg.rstrip()

                if cmd == "newmtl":
                    mtl_name = arg

                elif cmd == "map_Kd":
                    mtl_image_path = arg
                    full_image_path = abs_path_from_file(mtl_image_path, input_path)
                    img = cv2.imread(full_image_path)
                    materials[mtl_name] = (mtl_image_path, img.shape[:2])

        return MtlLib(input_path, materials, lines)

    def write(self, output_path, texture_map):
        """
        Write to an MTL file. Any texture images referenced by
        the MTL must be written separately.
        """
        output_path = os.path.realpath(output_path)
        logging.info("MtlLib.write %s", output_path)

        if texture_map is None:
            texture_map = {}

        with open(output_path, "w", encoding="utf-8") as out:
            for line in self.lines:
                if line == "#":
                    out.write(line)
                    continue
                fields = line.split(None, 1)
                if len(fields) < 2:
                    out.write(line)
                    continue
                cmd, arg = fields
                arg = arg.rstrip()

                if cmd == "map_Kd":
                    input_texture_image = arg
                    output_texture_image = texture_map.get(
                        input_texture_image, input_texture_image
                    )
                    out.write(f"map_Kd {output_texture_image}\n")
                else:
                    out.write(line)


class Geometry(object):
    """
    Represents the geometry in an OBJ file. This implementation covers
    only a small subset of the commands available in the OBJ file
    format, focusing on supporting triangular meshes with associated
    texture images, as produced by the ISAAC geometry mapper.
    """

    def __init__(self, input_path, v, vt, vn, f, mtllib, usemtl, f_mtl):
        self.input_path = input_path
        """
        The path the OBJ file was read from.
        """

        self.v = v
        """
        An N x 3 array containing N vertex positions in xyz space.
        """

        self.vt = vt
        """
        An N x 2 array containing N UV texture coordinates of vertices.
        Each coordinate is in the range 0 .. 1. To get the actual pixel
        coordinates in the texture image, scale by the image size.
        """

        self.vn = vn
        """
        An N x 3 array containing N vertex normals in xyz space.
        """

        self.f = f
        """
        An M x 3 x 3 tensor containing the vertex indices of triangles
        in the mesh. Tensor axis 0 has length M for the M triangles in
        the mesh.  Axis 1 has length 3 for the 3 vertices of the
        triangle. Axis 2 specifies which array of vertex coordinates the
        indices are referencing: 0 for v, 1 for vt, 2 for vn.
        """

        self.mtllib = mtllib
        """
        An MtlLib instance representing the companion MTL for this OBJ
        file.
        """

        self.usemtl = usemtl
        """
        An array array of material names specified by "usemtl" commands in the
        OBJ that must reference materials declared by "newmtl" commands in the
        MTL.
        """

        self.f_mtl = f_mtl
        """
        A length-M array of material indices specifying the materials for the M
        faces of the mesh. The indices reference entries in the usemtl array.
        """

    @classmethod
    def read(cls, input_path):
        """
        Parse an OBJ file, returning a Geometry instance. The companion
        MTL file and texture images will also be loaded.
        """
        input_path = os.path.realpath(input_path)
        logging.info("Geometry.read %s", input_path)

        v = array.array("d")
        vt = array.array("d")
        vn = array.array("d")
        f = array.array("l")
        mtllib = None
        usemtl = []
        f_mtl = array.array("l")

        with open(input_path, "r", encoding="utf-8") as inp:
            for line in inp:
                if line.startswith("#"):
                    continue

                fields = line.split()
                if not fields:
                    continue

                cmd = fields[0]
                args = fields[1:]

                if cmd == "v":
                    assert len(args) == 3
                    v.extend((float(a) for a in args))

                elif cmd == "vt":
                    assert len(args) == 2
                    vt.extend((float(a) for a in args))

                elif cmd == "vn":
                    assert len(args) == 3
                    vn.extend((float(a) for a in args))

                elif cmd == "f":
                    assert len(args) == 3
                    for a in args:
                        f.extend(parse_face_vertex(a))
                    f_mtl.append(len(usemtl) - 1)

                elif cmd == "mtllib":
                    assert len(args) == 1
                    mtl_path = args[0]
                    input_mtl_path = abs_path_from_file(mtl_path, input_path)
                    mtllib = MtlLib.read(input_mtl_path)

                elif cmd == "usemtl":
                    assert len(args) == 1
                    usemtl.append(args[0])

                else:
                    print(
                        f"WARNING: Geometry.load(): unknown command '{cmd}', ignoring"
                    )

        # convert to numpy
        v = np.array(v, dtype=np.float64).reshape((-1, 3))
        vt = np.array(vt, dtype=np.float64).reshape((-1, 2))
        vn = np.array(vn, dtype=np.float64).reshape((-1, 3))
        f = np.array(f, dtype=np.int32).reshape((-1, 3, 3))
        f_mtl = np.array(f_mtl, dtype=np.int32)

        # convert from OBJ 1-based indexing to Python 0-based indexing
        f = f - 1

        return Geometry(input_path, v, vt, vn, f, mtllib, usemtl, f_mtl)

    def write(self, output_path, texture_map=None):
        """
        Write an OBJ file and its associated MTL file. Any texture
        images referenced by the MTL must be written separately.
        """
        output_path = os.path.realpath(output_path)
        logging.info("Geometry.write %s", output_path)

        if self.mtllib:
            output_mtl_path = os.path.splitext(output_path)[0] + ".mtl"
            self.mtllib.write(output_mtl_path, texture_map)

        with open(output_path, "w", encoding="utf-8") as out:
            if self.mtllib:
                mtl_from_output_path = rel_path_from_file(
                    output_mtl_path, output_path
                )
                out.write(f"mtllib {mtl_from_output_path}\n")
            for v in self.v:
                out.write("v %s %s %s\n" % (*v,))
            for vt in self.vt:
                out.write("vt %s %s\n" % (*vt,))
            for vn in self.vn:
                out.write("vn %s %s %s\n" % (*vn,))

            # convert from Python 0-based indexing to OBJ 1-based indexing
            out_f = self.f + 1

            last_f_mtl = None
            for f, f_mtl in zip(out_f, self.f_mtl):
                if f_mtl != last_f_mtl:
                    out.write("\n")
                    out.write(f"usemtl {self.usemtl[f_mtl]}\n")
                out.write("f %s %s %s\n" % tuple(dump_face_vertex(v) for v in f))
                last_f_mtl = f_mtl

    def get_rotated(self, R):
        """
        Return a copy of the geometry with the specified rotation
        applied to the xyz coordinates. This only affects the v and vn
        arrays, and not the vt array, because it contains UV texture
        coordinates.
        """
        v = np.matmul(self.v, R.T)
        vn = np.matmul(self.vn, R.T)
        return Geometry(
            self.input_path,
            v,
            self.vt,
            vn,
            self.f,
            self.mtllib,
            self.usemtl,
            self.f_mtl,
        )

    def get_cropped(self, bbox):
        """
        Return a copy of the geometry approximately cropped to the
        specified nominal bounding box.

        Specifically, each face of the triangular mesh whose centroid is
        within the box will be kept in the copy.  This is a simple way
        to make sure that each face appears in exactly one tile at every
        zoom level. Note, however, that this approach means some
        triangles are likely to extend outside the nominal bounding box.

        Since 3D Tiles requires all geometry of a tile to be within the
        value specified in its boundingVolume property, the
        boundingVolume for each tile will need to be recalculated based
        on its actual contents rather than using the nominal bounding
        box for the tile specified by the tile system. This will cause
        adjacent tile boundingVolume boxes to overlap, but that is
        explicitly allowed in the 3D Tiles spec.
        """

        # keep faces whose centroids are within the bounding box
        face_centroids = np.mean(self.v[self.f[:, :, 0], :], axis=1)
        keep_faces = bbox.is_inside(face_centroids)
        f = self.f[keep_faces]
        f_mtl = self.f_mtl[keep_faces]

        # keep only the vertex information that is referenced by the remaining
        # faces
        f[:, :, 0], v = garbage_collect(f[:, :, 0], self.v)
        f[:, :, 1], vt = garbage_collect(f[:, :, 1], self.vt)
        f[:, :, 2], vn = garbage_collect(f[:, :, 2], self.vn)

        return Geometry(self.input_path, v, vt, vn, f, self.mtllib, self.usemtl, f_mtl)

    def get_bounding_box(self):
        """
        Return a BoundingBox that contains all faces in the mesh.
        """
        return BoundingBox(np.amin(self.v, axis=0), np.amax(self.v, axis=0))

    def get_bounding_volume(self):
        """
        Return a bounding box that contains all faces in the mesh, in 3D
        Tiles boundingVolume format.
        """
        bbox = self.get_bounding_box()
        centroid = 0.5 * (bbox.min_corner + bbox.max_corner)
        hl = 0.5 * (bbox.max_corner - bbox.min_corner)
        x_hl = [hl[0], 0, 0]
        y_hl = [0, hl[1], 0]
        z_hl = [0, 0, hl[2]]
        return {"box": list(centroid) + x_hl + y_hl + z_hl}

    def is_empty(self):
        """
        Return True if the mesh contains no faces.
        """
        return self.f.size == 0

    def get_median_texel_size(self):
        """
        Return the median size of a texture image pixel (texel). If the
        xyz coordinates in the geometry are interpreted as physical
        units of meters (as in ISAAC geometry mapper models), the
        returned value has units of meters per texel.

        Note that our tiling implementation is *not* really robust to
        meshes that have a non-uniform texel size. We expect this
        algorithm to be applied to a mesh with approximately uniform
        texel size, but took a robust estimation approach in order to
        avoid getting thrown off by round-off error, which could be
        greatly magnified if some triangles happen to be very small.
        """
        xyz_tris = self.v[self.f[:, :, 0], :]
        xyz_side_diffs = np.diff(xyz_tris, axis=1, append=xyz_tris[:, 0:1, :])
        xyz_side_lengths0 = np.linalg.norm(xyz_side_diffs, axis=2)
        xyz_side_lengths = xyz_side_lengths0.reshape(-1)

        texture_image_sizes = [
            self.mtllib.materials[mtl_name][1] for mtl_name in self.usemtl
        ]
        texture_image_sizes = np.array(texture_image_sizes, dtype=np.int32)
        f_image_size = texture_image_sizes[self.f_mtl, :]

        uv_tris = self.vt[self.f[:, :, 1], :]
        texel_tris = uv_tris * f_image_size[:, np.newaxis, :]
        texel_side_diffs = np.diff(texel_tris, axis=1, append=texel_tris[:, 0:1, :])
        texel_side_lengths0 = np.linalg.norm(texel_side_diffs, axis=2)
        texel_side_lengths = texel_side_lengths0.reshape(-1)

        non_zero = texel_side_lengths != 0
        texel_size = xyz_side_lengths[non_zero] / texel_side_lengths[non_zero]

        median_texel_size = np.median(texel_size)

        if 0:  # debug
            print(f"\n=== xyz_tris ===\n\n{xyz_tris[:10, :, :]}")
            print(f"\n=== xyz_side_diffs (cm) ===\n\n{100 * xyz_side_diffs[:10, :, :]}")
            print(
                f"\n=== xyz_side_lengths0 (cm) ===\n\n{100 * xyz_side_lengths0[:10, :]}"
            )
            print(f"\n=== texture_image_sizes ===\n\n{texture_image_sizes}")
            print(f"\n=== uv_tris ===\n\n{uv_tris[:10, :, :]}")
            print(f"\n=== texel_tris ===\n\n{texel_tris[:10, :, :]}")
            print(f"\n=== texel_side_diffs ===\n\n{texel_side_diffs[:10, :, :]}")
            print(f"\n=== texel_side_lengths0 ===\n\n{texel_side_lengths0[:10, :]}")
            print(f"\n=== median_texel_size (cm) ===\n\n{100 * median_texel_size}")

        return median_texel_size
