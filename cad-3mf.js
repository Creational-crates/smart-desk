const encoder = new TextEncoder();
const decoder = new TextDecoder();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
    view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
    view.setUint32(offset, value, true);
}

function makeZip(files) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const [name, text] of files) {
        const nameBytes = encoder.encode(name);
        const contents = encoder.encode(text);
        const checksum = crc32(contents);
        const local = new Uint8Array(30 + nameBytes.length + contents.length);
        const localView = new DataView(local.buffer);
        write32(localView, 0, 0x04034b50);
        write16(localView, 4, 20);
        write16(localView, 6, 0x0800);
        write16(localView, 8, 0);
        write16(localView, 10, 0);
        write16(localView, 12, 0x21);
        write32(localView, 14, checksum);
        write32(localView, 18, contents.length);
        write32(localView, 22, contents.length);
        write16(localView, 26, nameBytes.length);
        local.set(nameBytes, 30);
        local.set(contents, 30 + nameBytes.length);
        localParts.push(local);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);
        write32(centralView, 0, 0x02014b50);
        write16(centralView, 4, 20);
        write16(centralView, 6, 20);
        write16(centralView, 8, 0x0800);
        write16(centralView, 10, 0);
        write16(centralView, 12, 0);
        write16(centralView, 14, 0x21);
        write32(centralView, 16, checksum);
        write32(centralView, 20, contents.length);
        write32(centralView, 24, contents.length);
        write16(centralView, 28, nameBytes.length);
        write32(centralView, 38, 0);
        write32(centralView, 42, localOffset);
        central.set(nameBytes, 46);
        centralParts.push(central);
        localOffset += local.length;
    }

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    write32(endView, 0, 0x06054b50);
    write16(endView, 8, files.length);
    write16(endView, 10, files.length);
    write32(endView, 12, centralSize);
    write32(endView, 16, localOffset);
    const archive = new Uint8Array(localOffset + centralSize + end.length);
    let offset = 0;
    for (const part of [...localParts, ...centralParts, end]) {
        archive.set(part, offset);
        offset += part.length;
    }
    return archive;
}

function escapeXml(value) {
    return String(value).replace(/[<>&"']/g, (character) => ({
        "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;"
    })[character]);
}

function modelXml(name, meshes) {
    const objects = [];
    const buildItems = [];
    let totalTriangles = 0;
    meshes.forEach((mesh, index) => {
        if (!Array.isArray(mesh.positions) || mesh.positions.length === 0 ||
            mesh.positions.length % 3 !== 0 || mesh.positions.length > 1_500_000) {
            throw new Error("3MF mesh positions must contain up to 500,000 complete vertices.");
        }
        const id = index + 1;
        const points = [];
        for (let vertex = 0; vertex < mesh.positions.length; vertex += 3) {
            const x = mesh.positions[vertex];
            const y = mesh.positions[vertex + 1];
            const z = mesh.positions[vertex + 2];
            if (![x, y, z].every(Number.isFinite)) throw new Error("3MF mesh contains non-finite vertex coordinates.");
            points.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
        }
        const indices = mesh.indices || Array.from({ length: points.length }, (_, vertex) => vertex);
        if (!indices.length || indices.length % 3 !== 0 || indices.some((vertex) =>
            !Number.isInteger(vertex) || vertex < 0 || vertex >= points.length
        )) throw new Error("3MF mesh contains invalid triangle indices.");
        totalTriangles += indices.length / 3;
        if (totalTriangles > 500_000) throw new Error("3MF export is limited to 500,000 triangles.");
        const triangles = [];
        for (let offset = 0; offset < indices.length; offset += 3) {
            triangles.push(`<triangle v1="${indices[offset]}" v2="${indices[offset + 1]}" v3="${indices[offset + 2]}"/>`);
        }
        objects.push(`<object id="${id}" name="${escapeXml(mesh.name || `Body ${id}`)}" type="model"><mesh><vertices>${points.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh></object>`);
        buildItems.push(`<item objectid="${id}"/>`);
    });
    return `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${escapeXml(name)}</metadata><resources>${objects.join("")}</resources><build>${buildItems.join("")}</build></model>`;
}

export function export3mf(name, meshes) {
    if (!Array.isArray(meshes) || !meshes.length) throw new Error("Add at least one visible body before exporting 3MF.");
    const model = modelXml(name, meshes);
    return makeZip([
        ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacture-3dmodel+xml"/></Types>`],
        ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`],
        ["3D/3dmodel.model", model]
    ]);
}

async function unzipModel(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 40 * 1024 * 1024) throw new Error("3MF files must be smaller than 40 MB.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endOffset = -1;
    for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset += 1) {
        if (view.getUint32(offset, true) === 0x06054b50) endOffset = offset;
    }
    if (endOffset < 0) throw new Error("The 3MF archive is missing its ZIP directory.");
    const entryCount = view.getUint16(endOffset + 10, true);
    let cursor = view.getUint32(endOffset + 16, true);
    for (let entry = 0; entry < entryCount; entry += 1) {
        if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
            throw new Error("The 3MF ZIP directory is invalid.");
        }
        const method = view.getUint16(cursor + 10, true);
        const checksum = view.getUint32(cursor + 16, true);
        const compressedSize = view.getUint32(cursor + 20, true);
        const size = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const localOffset = view.getUint32(cursor + 42, true);
        if (cursor + 46 + nameLength + extraLength + commentLength > bytes.length) {
            throw new Error("The 3MF ZIP directory is truncated.");
        }
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, "/");
        if (size > 40 * 1024 * 1024 || localOffset + 30 > bytes.length) {
            throw new Error("A 3MF ZIP entry exceeds the supported size or is truncated.");
        }
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        if (dataStart + compressedSize > bytes.length) throw new Error("A 3MF ZIP entry is truncated.");
        if (name.toLowerCase().endsWith(".model")) {
            const compressed = bytes.slice(dataStart, dataStart + compressedSize);
            let modelBytes;
            if (method === 0) modelBytes = compressed;
            if (method === 8 && typeof DecompressionStream !== "undefined") {
                const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
                modelBytes = new Uint8Array(await new Response(stream).arrayBuffer());
            }
            if (!modelBytes) throw new Error(`Unsupported 3MF compression method: ${method}.`);
            if (modelBytes.length !== size || crc32(modelBytes) !== checksum) {
                throw new Error("The 3MF model ZIP entry failed its size or integrity check.");
            }
            return decoder.decode(modelBytes);
        }
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error("The 3MF archive does not contain a model file.");
}

function parseAttributes(markup) {
    const attributes = {};
    for (const match of markup.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g)) {
        attributes[match[1]] = match[2].replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x([0-9a-f]+)|(\d+));/gi, (entity, hex, decimal) => {
            if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
            if (decimal) return String.fromCodePoint(Number(decimal));
            return { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[entity.toLowerCase()];
        });
    }
    return attributes;
}

export async function import3mf(file) {
    const xml = await unzipModel(file);
    const modelTag = xml.match(/<model\b[^>]*>/i)?.[0] || "";
    const modelAttributes = parseAttributes(modelTag);
    const unitScale = {
        micron: 0.001,
        millimeter: 1,
        centimeter: 10,
        inch: 25.4,
        foot: 304.8,
        meter: 1000
    }[(modelAttributes.unit || "millimeter").toLowerCase()];
    if (!unitScale) throw new Error(`Unsupported 3MF model unit: ${modelAttributes.unit}.`);
    const objectMatches = [...xml.matchAll(/<object\b[^>]*>([\s\S]*?)<\/object>/gi)];
    if (!objectMatches.length) throw new Error("The 3MF file does not contain mesh objects.");
    if (objectMatches.length > 500) throw new Error("3MF files are limited to 500 mesh objects.");
    const objectsById = new Map();
    let totalTriangles = 0;
    let totalVertices = 0;
    for (const match of objectMatches) {
        const attributes = parseAttributes(match[0].slice(0, match[0].indexOf(">") + 1));
        const meshMatch = match[1].match(/<mesh\b[^>]*>([\s\S]*?)<\/mesh>/i);
        if (!attributes.id || objectsById.has(attributes.id)) throw new Error("The 3MF file contains an invalid or duplicate object ID.");
        if (!meshMatch && /<components\b/i.test(match[1])) {
            throw new Error("3MF component objects are not yet supported. Save the model as direct mesh objects and retry.");
        }
        if (!meshMatch) continue;
        const verticesMatch = meshMatch[1].match(/<vertices\b[^>]*>([\s\S]*?)<\/vertices>/i);
        const trianglesMatch = meshMatch[1].match(/<triangles\b[^>]*>([\s\S]*?)<\/triangles>/i);
        if (!verticesMatch || !trianglesMatch) throw new Error("A 3MF mesh is missing its vertices or triangles.");
        const positions = [];
        for (const vertex of verticesMatch[1].matchAll(/<vertex\b[^>]*\/?>/gi)) {
            const point = parseAttributes(vertex[0]);
            const coordinates = [Number(point.x), Number(point.y), Number(point.z)];
            if (!coordinates.every(Number.isFinite)) throw new Error("A 3MF vertex has invalid coordinates.");
            positions.push(...coordinates.map((coordinate) => coordinate * unitScale));
            if (positions.length > 1_500_000) throw new Error("A 3MF mesh exceeds the 500,000 vertex limit.");
        }
        totalVertices += positions.length / 3;
        if (totalVertices > 1_500_000) throw new Error("3MF files are limited to 1,500,000 mesh vertices.");
        const indices = [];
        for (const triangle of trianglesMatch[1].matchAll(/<triangle\b[^>]*\/?>/gi)) {
            const face = parseAttributes(triangle[0]);
            const vertices = [Number(face.v1), Number(face.v2), Number(face.v3)];
            if (!vertices.every((index) => Number.isInteger(index) && index >= 0 && index < positions.length / 3)) {
                throw new Error("A 3MF triangle references an invalid vertex.");
            }
            indices.push(...vertices);
        }
        totalTriangles += indices.length / 3;
        if (!indices.length || totalTriangles > 500_000) throw new Error("3MF projects must contain up to 500,000 triangles.");
        objectsById.set(attributes.id, {
            name: (attributes.name || `3MF body ${objectsById.size + 1}`).slice(0, 48),
            positions,
            indices
        });
    }
    if (!objectsById.size) throw new Error("The 3MF file contains no supported mesh objects.");
    const buildItems = [...(xml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/i)?.[1] || "")
        .matchAll(/<item\b[^>]*\/?>/gi)];
    if (!buildItems.length) return [...objectsById.values()];
    if (buildItems.length > 500) throw new Error("3MF projects are limited to 500 build items.");
    const objects = [];
    let builtTriangleCount = 0;
    let builtVertexCount = 0;
    for (const item of buildItems) {
        const attributes = parseAttributes(item[0]);
        const source = objectsById.get(attributes.objectid);
        if (!source) throw new Error("A 3MF build item references a missing object.");
        builtTriangleCount += source.indices.length / 3;
        builtVertexCount += source.positions.length / 3;
        if (builtTriangleCount > 500_000) throw new Error("3MF projects are limited to 500,000 built triangles.");
        if (builtVertexCount > 1_500_000) throw new Error("3MF projects are limited to 1,500,000 built vertices.");
        const transform = attributes.transform
            ? attributes.transform.trim().split(/\s+/).map(Number)
            : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
        if (transform.length !== 12 || !transform.every(Number.isFinite)) {
            throw new Error("A 3MF build item contains an invalid transform.");
        }
        const positions = [];
        for (let offset = 0; offset < source.positions.length; offset += 3) {
            const [x, y, z] = source.positions.slice(offset, offset + 3);
            positions.push(
                transform[0] * x + transform[1] * y + transform[2] * z + transform[9] * unitScale,
                transform[3] * x + transform[4] * y + transform[5] * z + transform[10] * unitScale,
                transform[6] * x + transform[7] * y + transform[8] * z + transform[11] * unitScale
            );
        }
        if (!positions.every(Number.isFinite)) throw new Error("A 3MF transform produced invalid coordinates.");
        objects.push({ name: source.name, positions, indices: [...source.indices] });
    }
    return objects;
}
