def make_tile(input_file,output_file,maxX,maxY,maxZ,minX,minY,minZ):

    # bounding_box = [  11.8,-7.1,4.01,  9.8, -9.8,3.9    ]

    # maxX = bounding_box[0]
    # maxY = bounding_box[1]
    # maxZ = bounding_box[2]
    # minX = bounding_box[3]
    # minY = bounding_box[4]
    # minZ = bounding_box[5]

    v_keepers = dict()  # keeps track of which vertices are within the bounding box

    kept_vertices = 0
    discarded_vertices = 0

    kept_faces = 0
    discarded_faces = 0

    discarded_lines = 0
    kept_lines = 0

    obj_file = open(input_file, 'r')
    new_obj_file = open(output_file, 'w')

    # the number of the next "v" vertex lines to process.
    original_v_number = 1  # the number of the next "v" vertex lines to process.
    # the new ordinal position of this vertex if out of bounds vertices were discarded.
    new_v_number = 1

    for line in obj_file:
        line_elements = line.split()

        # Python doesn't have a SWITCH statement, but we only have three cases, so we'll just use cascading if stmts
        # if it isn't an "f" type line (face definition)
        if line_elements[0] != "f":

            # and it isn't an "v" type line either (vertex definition)
            if line_elements[0] != "v":
                # ************************ PROCESS ALL NON V AND NON F LINE TYPES ******************
                # then we just copy it unchanged from the input OBJ to the output OBJ
                new_obj_file.write(line)
                kept_lines = kept_lines + 1

            else:  # then line_elements[0] == "v":
                # ************************ PROCESS VERTICES ****************************************
                #  a "v" line looks like this:
                #  f x y z ...
                x = float(line_elements[1])
                y = float(line_elements[2])
                z = float(line_elements[3])

                if minX < x < maxX and minY < y < maxY and minZ < z < maxZ:
                    # if vertex is within  the bounding box, we include it in the new OBJ file
                    new_obj_file.write(line)
                    v_keepers[str(original_v_number)] = str(new_v_number)
                    new_v_number = new_v_number + 1
                    kept_vertices = kept_vertices + 1
                    kept_lines = kept_lines + 1
                else:     # if vertex is NOT in the bounding box
                    new_obj_file.write(line)
                    discarded_vertices = discarded_vertices + 1
                    discarded_lines = discarded_lines + 1
                original_v_number = original_v_number + 1

        else:  # line_elements[0] == "f":
            # ************************ PROCESS FACES ****************************************
            #  a "f" line looks like this:
            #  f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...

            #  We need to delete any face lines where ANY of the 3 vertices v1, v2 or v3 are NOT in v_keepers.

            v = ["", "", ""]
            # Note that v1, v2 and v3 are the first "/" separated elements within each line element.
            for i in range(0, 3):
                v[i] = line_elements[i+1].split('/')[0]

            # now we can check if EACH of these 3 vertices are  in v_keepers.
            # for each f line, we need to determine if all 3 vertices are in the v_keepers list
            if v[0] in v_keepers and v[1] in v_keepers and v[2] in v_keepers:
                new_obj_file.write(line)
                kept_lines = kept_lines + 1
                kept_faces = kept_faces + 1
            else:  # at least one of the vertices in this face has been deleted, so we need to delete the face too.
                discarded_lines = discarded_lines + 1
                discarded_faces = discarded_faces + 1
                new_obj_file.write("# CROPPED "+line)

    # end of line processing loop
    obj_file.close()
    new_obj_file.close()
