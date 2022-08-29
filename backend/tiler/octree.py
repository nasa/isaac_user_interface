import argparse
import json
import os
import os.path as op
import subprocess

import open3d as o3d
from chopper import gen_tile as gt

# Note: octree.py and chopper.py are works in progress. They provide
# a logical outline of code that will convert an obj to an octree.
# Additional work is needed.


def gen_tile(
    tile_dir,
    obj_path,
    tree_counter,
    x_min,
    x_max,
    y_min,
    y_max,
    z_min,
    z_max,
    quality=60,
    scale=6.25,
):
    print("Tile_dir:", tile_dir)
    print("Tree_counter:", tree_counter)
    tree_counter = str(tree_counter)
    print(tile_dir + "/" + tree_counter)
    # gt(obj_path, tile_dir+"/"+tree_counter, True, True, x_min, x_max, y_min, y_max, z_min, z_max, quality, scale)
    gt(
        obj_path,
        tile_dir + "/" + tree_counter,
        True,
        True,
        x_min,
        y_min,
        z_min,
        x_max,
        y_max,
        z_max,
        quality,
        scale,
    )


parser = argparse.ArgumentParser()

parser.add_argument(
    "--input",
    help="path to .obj file (that links to .mtl with same name & 1 or more .png files linked from .mtl file)",
    type=str,
    required=True,
)
parser.add_argument(
    "--output",
    help="path to new directory that will contain tileset.json and multiple .b3dm files",
    type=str,
    required=True,
)

args = parser.parse_args()

obj_path = op.abspath(args.input)
tile_dir = op.abspath(args.output)

# NITZAN added: remove the output folder before running, for ease of repeated testing
bashCommand = "rm -r /home/nitz/Downloads/6_23_22/output"
process = subprocess.Popen(bashCommand.split(), stdout=subprocess.PIPE)
output, error = process.communicate()

assert op.exists(obj_path)
assert obj_path.endswith(".obj")
assert not op.exists(tile_dir)
os.mkdir(tile_dir)

tree = {
    "asset": {"version": "1.0", "gltfUpAxis": "Z"},
    "root": {"children": []},
    "geometricError": 1.1,
}

tree_counter = -1


def f_traverse(node, node_info):
    global tree_counter
    tree_counter += 1

    early_stop = False

    # Global min bound (include). A point is within bound iff origin <= point < origin + size.
    # For origin x_o, y_o, z_o), point (a, b, c), and size S, a point is within bound iff:
    # (x_o, y_o, z_o) <= (a, b, c) AND (a, b, c) < (x_o+S, y_o+S, z_o+S)
    #
    # ref: http://www.open3d.org/docs/latest/python_api/open3d.geometry.Octree.html
    origin, size = node_info.origin, node_info.size
    x, y, z = origin[0], origin[1], origin[2]

    # fixing edges between 3d tiles
    # Khaled: apparently tiles need to overlap lol wtf
    size += size / 10.0

    # calc center point of cuboid
    hl = size / 2.0  # half-length (hl)
    x_mid = x + hl
    y_mid = y + hl
    z_mid = z + hl

    # define box boundry, with center point, size (half-length), and axes of bounding
    # box in relation to the parent
    box_boundaries = [x_mid, y_mid, z_mid, hl, 0, 0, 0, hl, 0, 0, 0, hl]

    if node_info.depth == 0:
        tree["root"]["boundingVolume"] = {"box": box_boundaries}
        tree["root"]["content"] = {"uri": str(tree_counter) + ".b3dm"}
        tree["root"]["geometricError"] = 1.0
        tree["root"]["refine"] = "REPLACE"

        print("Depth 0")
        print("Cuboid origin, size:", node_info.origin, node_info.size)
        print("Cropping To:")
        print("X: {} to {}".format(x, x + size))
        print("Y: {} to {}".format(y, y + size))
        print("Z: {} to {}".format(z, z + size))

        gen_tile(
            tile_dir,
            obj_path,
            tree_counter,
            x,
            x + size,
            y,
            y + size,
            z,
            z + size,
            quality=60,
            scale=6.25,
        )

        # For debugging, stop execution here:
        # exit()
    elif node_info.depth == 1:
        obj = {"boundingVolume": {"box": box_boundaries}}
        obj["geometricError"] = 0.25
        obj["content"] = {"uri": str(tree_counter) + ".b3dm"}
        obj["children"] = []
        tree["root"]["children"].append(obj)

        gen_tile(
            tile_dir,
            obj_path,
            tree_counter,
            x,
            x + size,
            y,
            y + size,
            z,
            z + size,
            quality=60,
            scale=12.5,
        )

    # else:
    elif node_info.depth == 2:
        obj = {"boundingVolume": {"box": box_boundaries}}
        obj["geometricError"] = 0.1
        obj["content"] = {"uri": str(tree_counter) + ".b3dm"}

        obj_set = False

        try:
            gen_tile(
                tile_dir,
                obj_path,
                tree_counter,
                x,
                x + size,
                y,
                y + size,
                z,
                z + size,
                quality=75,
                scale=25,
            )
            obj_set = True
        except Exception as e:
            print("[exception in level 2 of octree]", e)

        if obj_set:
            for i, j in enumerate(tree["root"]["children"]):
                if len(j["children"]) < 8:
                    parent_volume = j["boundingVolume"]["box"]
                    p_x, p_y, p_z, p_hl = (
                        parent_volume[0],
                        parent_volume[1],
                        parent_volume[2],
                        parent_volume[3],
                    )

                    if (
                        ((p_x - p_hl) <= x_mid <= (p_x + p_hl))
                        and ((p_y - p_hl) <= y_mid <= (p_y + p_hl))
                        and ((p_z - p_hl) <= z_mid <= (p_z + p_hl))
                    ):

                        tree["root"]["children"][i]["children"].append(obj)
                        break

    else:
        print("DEPTH NOT SUPPORTED YET")

    return early_stop


print("[a] Reading mesh from {}".format(obj_path))
mesh = o3d.io.read_triangle_mesh(obj_path)

print("[b] Read mesh:", mesh)
# NITZAN changed voxel_size=0.5 --> 0.05. Needs further tuning
voxel_grid = o3d.geometry.VoxelGrid.create_from_triangle_mesh(mesh, voxel_size=0.05)
print("Voxel Grid:", voxel_grid)

print("[c] Created voxel grid:", voxel_grid)
octree = o3d.geometry.Octree(max_depth=2)
octree.create_from_voxel_grid(voxel_grid)


print("[d] Created octree:", octree)
octree.traverse(f_traverse)

with open(tile_dir + "/tileset.json", "w", encoding="utf-8") as f:
    json.dump(tree, f, ensure_ascii=False, indent=4)

print("[e] Completed!")
