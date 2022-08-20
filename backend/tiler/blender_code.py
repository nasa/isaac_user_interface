

### Code for extracting ("baking") textures from a mesh ###
# Version 8/12/22
# Author: Nitzan Orr, University of Wisconsin--Madison
# Email: nitzan@cs.wisc.edu
# Please reach out with any questions


# This code invokes blender to load a textured mesh (which may have
#   extraneous texture data) and save only the textures that are
#   present on the mesh itself ("baking the texture"), discarding any
#   extranous texture data. A new UV map is created. The texture data
#   as well as its mapping onto the mesh (UV map)
#   is exported at the end of this procedure.


### TO RUN ###
# Download the latest version (tested with 3.2.1) of Blender from their website
# Option 1: Run from terminal
#   * Go to directory containing Blender executable
#   * ./blender --background --python ~/Code/blender_code.py 
#
# Option 2: Run using Blender's Console
#   * Open Blender GUI
#   * Open file inside Blender's scripting view and click run


### BACKGROUND ###
# The journey to create this code involved first learning from video 
#   tutorials how to perform the texture baking procedure the typical
#   way, using the Blender software GUI. The steps taken are listed
#   below in numerical order. Then, the steps taken in the GUI were translated into code, 
#   namely using the Blender Python API. 
# Much of the translation was possible thanks to many Stack
#   Overflow questions & answers about each GUI sub-procedure: 
#   I.e. "How to create a new UV map using the Blender python api"
#     
# Helpful tutorials on accomplishing this procedure in Blender GUI:
#
# 1. "Bake Textures From one UV Map to Another UV Map (Blender Tutorial)"
# By: YouTube channel "Ryan King Art"
# https://youtu.be/1HyexrUEIv0
#
# 2. "How to Unwrap and Bake Textures in Blender 2.8 [...]and 3.2?"
# By: One Wheel Studio
# https://youtu.be/c2ut0Trcdi0
#
# 3. Bake Multiple Materials to One Texture Map (Blender Tutorial)
# By: Ryan King Art
# https://youtu.be/wG6ON8wZYLc


### BLENDER API DOCUMENTATION ###
# For Blender Python API documentation, see the quickstart:
# https://docs.blender.org/api/current/info_quickstart.html
#
# Running Blender python files outside of Blener:
# https://blender.stackexchange.com/questions/100497/use-blenders-bpy-in-projects-outside-blender#:%7E:text=The%20easy%20way%20is%20to%20use%20blender.&text=The%20other%20option%20to%20get,of%20blender%20as%20a%20pymodule.
# https://gist.github.com/chrdiller/ae72a70ce7414ec9d35609536113345c
# https://blender.stackexchange.com/questions/1365/how-can-i-run-blender-from-command-line-or-a-python-script-without-opening-a-gui




'''
===================================
Steps for using the Blender GUI for creating (i.e. baking) a texture map
from a textured 3D obj model. The steps were created from following tutorials. 

SETUP
0. Import obj, delete default cube, Open 3 window-ed layout: 
    hover mouse over bottom black line, right click, split view
1. 1) Open UV editor, 2) shader editor, and 3) "normal" view (not render, to save RAM)

UV UN-WRAPPING
2. Pick Object data properties tab on right. 
3. Open UV Map menu on right, Create new UV map called uv map 2
4. Open Object Data Properties tab on right > UV Maps > Click on UV Map 2 
5. Go to Edit Mode (tab)
6. With UV map 2 selected: UV smart unwrap with island padding of 0.001
7. Inspect and check that UV map 2 doesn't have overlapping triangles
        ctrl+p to re-pack islands?, if they dont fill up the image?

BAKING SETUP
8. In shader view, to create new node: shift+a > search > image texture > 
    new > name: test_texture (4096 x 4096) (Reqs 7-9 GB RAM). Maybe 
    try something smaller like 2K (2048x2048) (reqs 4-6 GB RAM during baking)
9. In shader view, shift+a > search > uv map > connect "UV" to 
    "vector" of test_texture node
    After connecting, Select uv map 2 from the drop down menu of the uv map node
10. In shader view, create another uv map > connect it to existing texture, 
    and select the exisiting UV map from the drop down menu to show blender 
    that the current texture uses the current uv map. At this point, there
    should be 3 new nodes in the shader view
11. Repeat above steps 8-10 for each of the materials (the active material
    can be selected on the right from the  material properties tab)

BAKE SETTINGS
12. On right, select render tab > Render Engine: Cycles
13. For max samples select 10 and 10 for viewport and renderer.
14. Click bake dropdown panel > diffuse. Uncheck boxes direct & indirect light. 

BAKING
15. In shader view, for each material, Select the new texture image node
16. Click Bake (being in Object Mode doesn't seem neccessary like in tutorial)
    (Requires 5-6Gb RAM for 2k, 8-9GB RAM for 4k) Takes 10+ seconds
17. In shader view, for each material, attach the new texture image node to 
    the BDSF node in place of the previous UV map 

SAVING & EXPORT
18. Save baked texture: Image > Save As...
19. File > External Data > Pack Resources
20. File > External Data > Unpack Resources > Use Files in Current Directory (create if not found)
21. File > Export obj
22. Check that the new texture is specified in the outputted .mtl file

'''


import bpy
import os
import sys

# Argument parsing assumes this file was called from terminal in this format:
# ./blender --background --python ~/Code/blender_code.py arg1 arg2 arg3
# Note: argv[5] will make blender return an error at the end of execution
# which you can ignore.
# Ignore: Error: File format is not supported in file...[argv[5]] 

# "--" is Blender specific for passing in arguments to Blender python scripts
# https://blender.stackexchange.com/questions/6817/how-to-pass-command-line-arguments-to-a-blender-python-script
args = sys.argv[sys.argv.index("--") + 1:]
print("ARGS:",args)
INPUT_PATH = args[0]
OUTPUT_PATH = args[1]
RESOLUTION = int(args[2])
print('Input Path:', INPUT_PATH)
print('Output Path:', OUTPUT_PATH)
print('Resolution:', RESOLUTION)
print()

input_path = INPUT_PATH
export_filepath = OUTPUT_PATH 


# delete the default cube at blender startup
objs = bpy.data.objects
if 'Cube' in objs:
    objs.remove(objs["Cube"])

# Load obj
imported_object = bpy.ops.import_scene.obj(filepath=input_path)
obj = bpy.context.selected_objects[0] 
print('Imported name: ', obj.name)
objs[obj.name].select_set(True) # obj should already be selected, but just in case
# sets our mesh to be active
bpy.context.view_layer.objects.active = objs[obj.name] 

bpy.ops.object.mode_set(mode='EDIT') # Go to Edit mode
new_uv_map_name = 'UVMap_2'
obj.data.uv_layers.new(name=new_uv_map_name) # create and name new UV Map
# Set new UV map to active
bpy.data.meshes[obj.name].uv_layers[new_uv_map_name].active = True 
# UV Unwrap the mesh textures
bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.001)


# Working in shader view now...
obj = bpy.context.active_object 
# You can choose your texture size (This will be the baked image)
image_name = obj.name + '_BakedTexture'
img = bpy.data.images.new(image_name, RESOLUTION, RESOLUTION)



texture_node_name = 'Bake_node'
old_uv_map_node_name = 'UV1_node'
new_uv_map_node_name = 'UV2_node'

print("Creating nodes for each material...")
for mat in obj.data.materials:
    node_tree = mat.node_tree
    nodes = node_tree.nodes

    orig_img_tex_node = nodes['Image Texture']

    # Creates uv map node in shader view and sets its uv map to current uv map
    uv_map_node = nodes.new('ShaderNodeUVMap')
    uv_map_node.name = old_uv_map_node_name 
    uv_map_node.uv_map = obj.data.uv_layers[0].name
    node_tree.links.new(uv_map_node.outputs['UV'], orig_img_tex_node.inputs['Vector'])

    # Create image texture node in shader view and sets its image
    texture_node = nodes.new('ShaderNodeTexImage') # Creates node in shader view
    texture_node.name = texture_node_name
    texture_node.select = True
    nodes.active = texture_node
    texture_node.image = img #Assign the image to the node

    # Creates another uv map node in shader view and sets its uv map to new uv map
    new_uv_map_node = nodes.new('ShaderNodeUVMap')
    new_uv_map_node.name = new_uv_map_node_name
    new_uv_map_node.uv_map = obj.data.uv_layers[new_uv_map_name].name  
    node_tree.links.new(new_uv_map_node.outputs['UV'], texture_node.inputs['Vector'])

    # Make texture_node the only one selected. Make it active, as required for baking 
    for n in nodes:
        n.select = False
    nodes[texture_node.name].select = True
    nodes.active = nodes[texture_node.name]


# Set render engine to cycles and set settings
# This changes things in the Render Properties tab on the right-hand-side (Camera icon)
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples =  10
bpy.context.scene.cycles.preview_samples = 10 # Takes a few seconds to update GUI
bpy.context.scene.cycles.bake_type = 'DIFFUSE'
bpy.context.scene.render.bake.use_pass_direct = False
bpy.context.scene.render.bake.use_pass_indirect = False

print("Baking...")
bpy.ops.object.bake(type='DIFFUSE', save_mode='EXTERNAL', filepath='/home/nitz/Downloads/8_8_22')



# This tells Blender what textures belong to the model during export
# In shader view, for each material, link new texture image node to BDSF node
# And delete the original image texture and old uv map nodes
for mat in obj.data.materials:
    node_tree = mat.node_tree
    nodes = node_tree.nodes

    texture_node = nodes[texture_node_name]
    old_texture_node = nodes['Image Texture']
    old_uv_map_node = nodes[old_uv_map_node_name]
    BSDF_node = nodes['Principled BSDF']

    # Link new texture node to model
    node_tree.links.new(texture_node.outputs['Color'], BSDF_node.inputs['Base Color'])

    # Delete old texture and uv map nodes
    nodes.remove(old_texture_node)
    nodes.remove(old_uv_map_node)

# Remove old UV Map layer, which essentially makes the new UV Map used during export
uv_textures = obj.data.uv_layers
uv_textures.remove(uv_textures['UVMap'])

output_dir = os.path.dirname(export_filepath)
print("OUTPUT PATH:", output_dir)
if not os.path.exists(output_dir):
    os.mkdir(output_dir)

# Textures will be saved to path where blender file is saved to.
# The saving of the blend file has no other purpose. File is deleted.
blend_file_name = 'temp.blend'
blend_file_path = os.path.join(output_dir, blend_file_name)
bpy.ops.wm.save_as_mainfile(filepath=blend_file_path)
# Packing and unpacking is used for exported files to include textures 
bpy.data.images[image_name].pack()
bpy.ops.file.unpack_all(method='USE_ORIGINAL') # USE_ORIGINAL saves textures in curr dir
bpy.ops.export_scene.obj(filepath=export_filepath, path_mode='RELATIVE')
os.remove(blend_file_path) # remove temp blend file
print('Exported to:', export_filepath)
print('Finished! \nBlender quitting...')


