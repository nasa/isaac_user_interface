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

## Notes

The main idea behind 3D Tiles is segmenting a 3D object into multiple tiles. Each tile can contain several smaller sub-tiles each with a higher resolution texture than the parent tile. The viewer will intelligently select, load, and render the correct tiles according to the viewer's orientation and zoom level. Each tile has a pre-determined geometric error, which is estimated by finding the diagonal of the largest feature in the tile. The viewer chooses to load a higher resolution tile in place of a lower resolution tile based on a geometric error threshold. A leaf tile has no sub-tiles, uses full resolution texture, and has zero geometric error.

Below is an example of a 3D tiles tileset.

```json
{
    "asset": {
        "version": "1.0",
        "gltfUpAxis": "Z"
    },
    "root": {
        "children": [...]
    },
    "geometricError": 100
}
```

Within the `children` array, tiles are added, with the first tile representing the bounding volume. Below is an example of a tile definition.

```json
{
    "boundingVolume": {
        "region": [...]
    },
    "refine": "REPLACE",
    "geometricError": 25,
    "content": {
        "uri": "tile.b3dm"
    },
    "children": [...]
}
```

Each tile is bound by a `boundingVolume`, which is a bounding box in 3D space. For our use case, tiles will replace their parent tile when they are loaded, and therefore we define `refine` as `REPLACE`. Geometric error of the tile is estimated by the diagonal of the smallest feature identifiable in the tile's texture. Finally, the content of the tile is a link to the `b3dm` file represented by the tile, which is a GLTF optimized

---

## References

* [3D Tiles Format Specification](https://github.com/CesiumGS/3d-tiles/tree/main/specification)
* [Open3D](http://www.open3d.org/docs/release/)
