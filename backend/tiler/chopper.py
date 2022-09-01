from cropper import make_tile_4
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

def gen_tile(input,output,b3dm,crop, min_x, min_y, min_z, max_x, max_y, max_z, quality,scale):
    tmp_dir = "/tmp/" + random_string(20)
    mkdir(tmp_dir)

    obj_filename = input.split("/")[-1]
    tmp_cropped_obj = tmp_dir+"/"+obj_filename

    # TODO: Fix mtl_filename to equal the mtl file defined in the obj file
    # rather than assuming that the mtl file will have the same name as 
    # the obj file and replacing only the extension
    mtl_filename = obj_filename.replace(".obj",".mtl")

    if crop:
        print(f"making cropped version of {input} at {tmp_cropped_obj}")
        cropped_mesh = make_tile_4(input_file=op.abspath(input), 
            output_file=tmp_cropped_obj, 
            maxX=max_x, maxY=max_y, maxZ=max_z, 
            minX=min_x, minY=min_y, minZ=min_z, resolution=1024)
        print("cropping completed")
    else:
        print("not cropping, set --crop to true to crop to x/y/z min/max")
        copyfile(op.abspath(input),tmp_cropped_obj)


    parent_dir = op.dirname(op.abspath(input))

    # TODO: Resize texture images. Use jpg compression to decrease file size
    # Note 1: changing the extension of a file does not convert a file
    # To convert png to jpg, use an appropriate python module.
    # Note 2: Instead of reducing file size via png to jpg conversion
    # it may suffice to change the resolution arg when calling make_tile_4
    for png_file in glob(parent_dir+"/*.png"):
        png_filename = png_file.split("/")[-1].replace(".png", ".jpg")
        output_jpg = tmp_dir + "/" + png_filename

        print(f"converting {png_file} to {output_jpg} at {quality}% quality")

        run('convert -resize '+ scale +'% -quality '+ quality +'% "'+ png_file +'" "'+ output_jpg +'"')


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


    # Convert obj file to gltf or to 3d tiles
    if not b3dm:
        print("running glb maker")
        run(f"obj2gltf -i {op.abspath(tmp_cropped_obj)} -b -o {op.abspath(output)}")
    else:
        print("running b3dm maker")
        b3dm_tmp_path = op.abspath(tmp_cropped_obj).replace(".obj",".b3dm")
        run(f"obj23dtiles -i {op.abspath(tmp_cropped_obj)} -b --b3dm -o {b3dm_tmp_path}")
        copyfile(b3dm_tmp_path, op.abspath(output))

    rmtree(tmp_dir)

if __name__ == "__main__":
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

    gen_tile(args.input,args.output,args.b3dm,args.crop,
        args.min_x,args.min_y,args.min_z,args.max_x,args.max_y,args.max_z,
        args.quality,args.scale)