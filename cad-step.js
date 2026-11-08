function stepString(value) {
    return String(value).replace(/'/g, "''").replace(/[\u0000-\u001f]/g, " ");
}

export function exportFacetedStep(name, meshes) {
    if (!Array.isArray(meshes) || !meshes.length) {
        throw new Error("Add at least one visible body before exporting STEP.");
    }
    const entities = [
        "#1=APPLICATION_CONTEXT('managed model based 3d engineering');",
        "#2=APPLICATION_PROTOCOL_DEFINITION('international standard','ap242_managed_model_based_3d_engineering',2014,#1);",
        "#3=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNIT_ASSIGNED_CONTEXT((#4,#5,#6)) REPRESENTATION_CONTEXT('',''));",
        "#4=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));",
        "#5=(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));",
        "#6=(NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($,.STERADIAN.));",
        "#7=PRODUCT_CONTEXT('',#1,'mechanical');",
        `#8=PRODUCT('1','${stepString(name)}','',(#7));`,
        "#9=PRODUCT_DEFINITION_FORMATION('','',#8);",
        "#10=PRODUCT_DEFINITION('design','',#9,#11);",
        "#11=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');",
        "#12=PRODUCT_DEFINITION_SHAPE('','',#10);",
        "#13=SHAPE_DEFINITION_REPRESENTATION(#12,#14);"
    ];
    const itemRefs = [];
    let entityId = 15;
    let totalTriangles = 0;

    for (const mesh of meshes) {
        if (!Array.isArray(mesh.positions) || mesh.positions.length % 3 !== 0) {
            throw new Error("STEP mesh positions must contain complete XYZ coordinates.");
        }
        const vertexCount = mesh.positions.length / 3;
        const indices = mesh.indices || Array.from({ length: vertexCount }, (_, index) => index);
        if (!indices.length || indices.length % 3 !== 0 || indices.some((index) =>
            !Number.isInteger(index) || index < 0 || index >= vertexCount
        )) throw new Error("STEP mesh contains invalid triangle indices.");
        totalTriangles += indices.length / 3;
        if (totalTriangles > 300_000) throw new Error("STEP export is limited to 300,000 triangles.");
        if (!mesh.positions.every(Number.isFinite)) throw new Error("STEP mesh contains non-finite coordinates.");

        const coordinatesId = entityId++;
        const faceSetId = entityId++;
        const coordinates = [];
        for (let offset = 0; offset < mesh.positions.length; offset += 3) {
            coordinates.push(`(${mesh.positions[offset]},${mesh.positions[offset + 1]},${mesh.positions[offset + 2]})`);
        }
        const triangles = [];
        for (let offset = 0; offset < indices.length; offset += 3) {
            triangles.push(`(${indices[offset] + 1},${indices[offset + 1] + 1},${indices[offset + 2] + 1})`);
        }
        entities.push(`#${coordinatesId}=CARTESIAN_POINT_LIST_3D('',(${coordinates.join(",")}));`);
        entities.push(`#${faceSetId}=TRIANGULATED_FACE_SET('${stepString(mesh.name || "Body")}',#${coordinatesId},$,$,.T.,$,(${triangles.join(",")}));`);
        itemRefs.push(`#${faceSetId}`);
    }

    entities.unshift(`#14=SHAPE_REPRESENTATION('',(${itemRefs.join(",")}),#3);`);
    return [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('Smart Desk faceted CAD model'),'2;1');",
        `FILE_NAME('${stepString(name)}.step','',(''),(''),'Smart Desk','Smart Desk','');`,
        "FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));",
        "ENDSEC;",
        "DATA;",
        ...entities,
        "ENDSEC;",
        "END-ISO-10303-21;"
    ].join("\n");
}

export function importFacetedStep(text) {
    if (typeof text !== "string" || text.length > 40 * 1024 * 1024) {
        throw new Error("STEP files must be text smaller than 40 MB.");
    }
    if (!/ISO-10303-21\s*;/i.test(text) || !/END-ISO-10303-21\s*;/i.test(text)) {
        throw new Error("This is not a complete ISO 10303-21 STEP file.");
    }
    const pointLists = new Map();
    for (const match of text.matchAll(/#(\d+)\s*=\s*CARTESIAN_POINT_LIST_3D\s*\(\s*'[^']*'\s*,\s*\(([\s\S]*?)\)\s*\)\s*;/gi)) {
        const points = [...match[2].matchAll(/\(\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\)/g)]
            .map((point) => point.slice(1).map(Number));
        if (points.length && points.every((point) => point.every(Number.isFinite))) {
            pointLists.set(Number(match[1]), points);
        }
    }
    const meshes = [];
    for (const match of text.matchAll(/#\d+\s*=\s*TRIANGULATED_FACE_SET\s*\(\s*'((?:''|[^'])*)'\s*,\s*#(\d+)\s*,\s*\$\s*,\s*\$\s*,\s*\.T\.\s*,\s*\$\s*,\s*\(([\s\S]*?)\)\s*\)\s*;/gi)) {
        const points = pointLists.get(Number(match[2]));
        if (!points) throw new Error("A STEP triangulated face set references missing coordinates.");
        const indices = [];
        for (const face of match[3].matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)) {
            const triangle = face.slice(1).map((index) => Number(index) - 1);
            if (triangle.some((index) => index < 0 || index >= points.length)) {
                throw new Error("A STEP triangle references an invalid vertex.");
            }
            indices.push(...triangle);
        }
        if (!indices.length) continue;
        meshes.push({
            name: match[1].replace(/''/g, "'").slice(0, 48) || `STEP body ${meshes.length + 1}`,
            positions: points.flat(),
            indices
        });
    }
    if (!meshes.length) {
        throw new Error("This STEP file contains no AP242 triangulated face sets. Import a faceted STEP export; analytic B-rep STEP solids are not supported.");
    }
    if (meshes.reduce((total, mesh) => total + mesh.indices.length / 3, 0) > 300_000) {
        throw new Error("STEP import is limited to 300,000 triangles.");
    }
    return meshes;
}
