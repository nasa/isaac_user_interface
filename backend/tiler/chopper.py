from cropper import make_tile
import argparse
import string
import random
import subprocess
from os import mkdir
import os.path as op
from glob import glob
from shutil import copyfile, rmtree

def run(command):
    subprocess.run(command, shell=True, check=True)

def random_string(N):
    return ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(N))

parser = argparse.ArgumentParser()

parser.add_argument('--input', help='path to .obj file (that links to .mtl & .png)', type=str)
parser.add_argument('--output', help='path to .b3dm or .glb file', type=str)

parser.add_argument('--crop', help='true = crop using min/max x/y/z, false = no cropping', default=False)
parser.add_argument('--b3dm', help='true = generate b3dm, false = generate glb', default=False)

parser.add_argument('--min_x', help='minimum x axis', type=float, required=False)
parser.add_argument('--max_x', help='maximum x axis', type=float, required=False)
parser.add_argument('--min_y', help='minimum y axis', type=float, required=False)
parser.add_argument('--max_y', help='maximum y axis', type=float, required=False)
parser.add_argument('--min_z', help='minimum z axis', type=float, required=False)
parser.add_argument('--max_z', help='maximum z axis', type=float, required=False)

parser.add_argument('--quality', help='number between 1 (worst) and 99 (best)', type=str, default="50")
parser.add_argument('--scale', help='number between 1 (smallest) and 99 (largest)', type=str, default="10")

args = parser.parse_args()

tmp_dir = "/tmp/" + random_string(20)
mkdir(tmp_dir)

obj_filename = args.input.split("/")[-1]
tmp_cropped_obj = tmp_dir+"/"+obj_filename

mtl_filename = obj_filename.replace(".obj",".mtl")

if args.crop:
    print(f"making cropped version of {args.input} at {tmp_cropped_obj}")
    make_tile(input_file=op.abspath(args.input), 
        output_file=tmp_cropped_obj, 
        maxX=args.max_x, maxY=args.max_y, maxZ=args.max_z, 
        minX=args.min_x, minY=args.min_y, minZ=args.min_z)
    print("cropping completed")
else:
    print("not cropping, set --crop to true to crop to x/y/z min/max")
    copyfile(op.abspath(args.input),tmp_cropped_obj)


parent_dir = op.dirname(op.abspath(args.input))

for png_file in glob(parent_dir+"/*.png"):
    png_filename = png_file.split("/")[-1].replace(".png", ".jpg")
    output_jpg = tmp_dir + "/" + png_filename

    print(f"converting {png_file} to {output_jpg} at {args.quality}% quality")

    run('convert -resize '+ args.scale +'% -quality '+ args.quality +'% "'+ png_file +'" "'+ output_jpg +'"')

# copy over mtl
src_mtl = parent_dir+"/"+mtl_filename
dst_mtl = tmp_dir+"/"+mtl_filename
copyfile(src_mtl, dst_mtl)

# replace mtl png with jpg
fin = open(dst_mtl, "rt")
data = fin.read()
data = data.replace('.png', '.jpg')
fin.close()
fin = open(dst_mtl, "wt")
fin.write(data)
fin.close()

if not args.b3dm:
    print("running glb maker")
    run(f"obj2gltf -i {op.abspath(tmp_cropped_obj)} -b -o {op.abspath(args.output)}")
else:
    print("running b3dm maker")
    b3dm_tmp_path = op.abspath(tmp_cropped_obj).replace(".obj",".b3dm")
    run(f"obj23dtiles -i {op.abspath(tmp_cropped_obj)} -b --b3dm -o {b3dm_tmp_path}")
    copyfile(b3dm_tmp_path, op.abspath(args.output))

rmtree(tmp_dir)

print("done!")