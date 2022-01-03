# NASA ISAAC User Interface: 3D Tiles Subsystem

[![GitHub license](https://img.shields.io/github/license/nasa/isaac_user_interface)](https://github.com/nasa/isaac_user_interface/blob/master/LICENSE)

### This section contains the 3D Tiles subsystem of the UI which is part of the backend.

## Getting started

```bash
python3 octree.py --input path/to/obj --output path/to/tileset
```

Input: path to .obj file (that links to .mtl with same name & 1 or more .png files linked from .mtl file)

Output: path to new directory that will contain tileset.json and multiple .b3dm files
