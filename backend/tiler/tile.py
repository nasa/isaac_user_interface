import subprocess


def run(command):
    subprocess.run(command, shell=True, check=True)

def gen_tile(tile_dir, obj_path, tile_index, min_x, max_x, min_y, max_y, min_z, max_z, quality=60, scale=6.25):
    chopper_src = "/home/khaled/Repositories/python/chopper.py"
    run(f"python3 {chopper_src} --input '{obj_path}' --output '{tile_dir}/{tile_index}.b3dm' --b3dm true --crop true --min_x {min_x} --min_y {min_y} --min_z {min_z} --max_x {max_x} --max_y {max_y} --max_z {max_z} --quality {quality} --scale {scale}")

