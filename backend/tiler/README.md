# NASA ISAAC User Interface: 3D Tiles Subsystem

[![GitHub license](https://img.shields.io/github/license/nasa/isaac_user_interface)](https://github.com/nasa/isaac_user_interface/blob/master/LICENSE)

### This section contains the 3D Tiles subsystem of the UI which is part of the backend.

![3d tiles diagram (credit: CesiumGS)](https://raw.githubusercontent.com/CesiumGS/3d-tiles/main/specification/figures/tree.png)

---

## Getting started

```bash
python3 octree.py --input path/to/obj --output path/to/tileset
```

---

## Arguments

Input: path to .obj file (that links to .mtl with same name & 1 or more .png files linked from .mtl file)

Output: path to new directory that will contain tileset.json and multiple .b3dm files

---

## References

* [3D Tiles Format Specification](https://github.com/CesiumGS/3d-tiles/tree/main/specification)
* [Open3D](http://www.open3d.org/docs/release/)