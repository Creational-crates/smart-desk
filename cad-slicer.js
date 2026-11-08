import { analyzeTriangleMesh } from "./cad-mesh-analysis.js";

const DEFAULTS = {
    bedWidth: 220,
    bedDepth: 220,
    bedHeight: 250,
    qualityPreset: "balanced",
    materialPreset: "pla",
    layerHeight: 0.2,
    lineWidth: 0.45,
    nozzleDiameter: 0.4,
    filamentDiameter: 1.75,
    infillPercent: 20,
    infillPattern: "grid",
    topLayers: 3,
    bottomLayers: 3,
    nozzleTemperature: 205,
    bedTemperature: 60,
    perimeterSpeed: 30,
    infillSpeed: 45,
    travelSpeed: 120
};
const MAX_LAYER_COUNT = 1250;
const MAX_TRIANGLES = 100_000;
const MAX_TRIANGLE_LAYER_TESTS = 20_000_000;
const MAX_GCODE_MOVES = 250_000;

function validateSettings(input) {
    const settings = {};
    for (const [key, fallback] of Object.entries(DEFAULTS)) {
        if (key === "qualityPreset" || key === "materialPreset" || key === "infillPattern") {
            settings[key] = String(input[key] ?? fallback);
            continue;
        }
        const value = Number(input[key] ?? fallback);
        if (!Number.isFinite(value)) throw new Error(`Slicer setting "${key}" must be a finite number.`);
        settings[key] = value;
    }
    const ranges = [
        ["bedWidth", 50, 1000],
        ["bedDepth", 50, 1000],
        ["bedHeight", 20, 2000],
        ["nozzleDiameter", 0.2, 1.2],
        ["filamentDiameter", 1, 3],
        ["layerHeight", 0.06, 0.8],
        ["lineWidth", 0.2, 1.5],
        ["infillPercent", 0, 100],
        ["topLayers", 0, 20],
        ["bottomLayers", 0, 20],
        ["nozzleTemperature", 0, 300],
        ["bedTemperature", 0, 150],
        ["perimeterSpeed", 5, 180],
        ["infillSpeed", 5, 240],
        ["travelSpeed", 10, 400]
    ];
    for (const [key, minimum, maximum] of ranges) {
        const value = settings[key];
        if (value < minimum || value > maximum) {
            throw new Error(`${key} must be between ${minimum} and ${maximum}.`);
        }
        if (!["draft", "balanced", "detail"].includes(settings.qualityPreset)) {
            throw new Error("Choose draft, balanced, or fine-detail print quality.");
        }
        if (!["pla", "petg", "abs"].includes(settings.materialPreset)) {
            throw new Error("Choose a supported generic material preset.");
        }
        if (!["lines", "grid", "triangles"].includes(settings.infillPattern)) {
            throw new Error("Choose lines, grid, or triangles for the infill pattern.");
        }
        if (["topLayers", "bottomLayers"].includes(key) && !Number.isInteger(value)) {
            throw new Error(`${key} must be a whole number.`);
        }
    }
    if (settings.layerHeight > settings.nozzleDiameter * 0.8) {
        throw new Error("Layer height must be no more than 80% of the nozzle diameter.");
    }
    if (settings.lineWidth < settings.nozzleDiameter * 0.8 ||
        settings.lineWidth > settings.nozzleDiameter * 1.5) {
        throw new Error("Line width must be between 80% and 150% of the nozzle diameter.");
    }
    return settings;
}

function meshBounds(positions) {
    const bounds = {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity
    };
    for (let offset = 0; offset < positions.length; offset += 3) {
        const x = positions[offset];
        const y = positions[offset + 1];
        const z = positions[offset + 2];
        if (![x, y, z].every(Number.isFinite)) throw new Error("A model contains non-finite coordinates.");
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.maxZ = Math.max(bounds.maxZ, z);
    }
    return bounds;
}

function makeSliceSegments(positions, indices, layerY, tolerance) {
    const edges = [[0, 1], [1, 2], [2, 0]];
    const elementCount = indices ? indices.length : positions.length / 3;
    const segments = [];
    for (let offset = 0; offset < elementCount; offset += 3) {
        const vertexIds = indices
            ? [indices[offset], indices[offset + 1], indices[offset + 2]]
            : [offset, offset + 1, offset + 2];
        const points = [];
        for (const [firstCorner, secondCorner] of edges) {
            const firstOffset = vertexIds[firstCorner] * 3;
            const secondOffset = vertexIds[secondCorner] * 3;
            const firstY = positions[firstOffset + 1];
            const secondY = positions[secondOffset + 1];
            if (!((firstY <= layerY && secondY > layerY) || (secondY <= layerY && firstY > layerY))) continue;
            const amount = (layerY - firstY) / (secondY - firstY);
            const point = {
                x: positions[firstOffset] + (positions[secondOffset] - positions[firstOffset]) * amount,
                z: positions[firstOffset + 2] + (positions[secondOffset + 2] - positions[firstOffset + 2]) * amount
            };
            if (!points.some((existing) => Math.hypot(existing.x - point.x, existing.z - point.z) <= tolerance)) {
                points.push(point);
            }
        }
        if (points.length === 2 &&
            Math.hypot(points[0].x - points[1].x, points[0].z - points[1].z) > tolerance) {
            segments.push(points);
        }
    }
    return segments;
}

function traceContours(segments, tolerance, objectName, layerIndex) {
    const vertices = new Map();
    const edges = [];
    const edgeKeys = new Set();
    const vertexKey = (point) => `${Math.round(point.x / tolerance)},${Math.round(point.z / tolerance)}`;
    for (const [first, second] of segments) {
        const firstKey = vertexKey(first);
        const secondKey = vertexKey(second);
        if (firstKey === secondKey) continue;
        const edgeKey = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
        if (edgeKeys.has(edgeKey)) continue;
        edgeKeys.add(edgeKey);
        if (!vertices.has(firstKey)) vertices.set(firstKey, { point: first, edges: [] });
        if (!vertices.has(secondKey)) vertices.set(secondKey, { point: second, edges: [] });
        const edgeIndex = edges.length;
        edges.push([firstKey, secondKey]);
        vertices.get(firstKey).edges.push(edgeIndex);
        vertices.get(secondKey).edges.push(edgeIndex);
    }

    for (const vertex of vertices.values()) {
        if (vertex.edges.length !== 2) {
            throw new Error(`"${objectName}" has an open or branching contour near layer ${layerIndex + 1}.`);
        }
    }

    const visited = new Uint8Array(edges.length);
    const contours = [];
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
        if (visited[edgeIndex]) continue;
        const [startKey, nextKey] = edges[edgeIndex];
        const contour = [vertices.get(startKey).point];
        let currentKey = nextKey;
        visited[edgeIndex] = 1;
        let closed = false;
        for (let step = 0; step <= edges.length; step += 1) {
            if (currentKey === startKey) {
                closed = true;
                break;
            }
            contour.push(vertices.get(currentKey).point);
            const nextEdge = vertices.get(currentKey).edges.find((candidate) => !visited[candidate]);
            if (nextEdge === undefined) break;
            visited[nextEdge] = 1;
            const [edgeStart, edgeEnd] = edges[nextEdge];
            const followingKey = edgeStart === currentKey ? edgeEnd : edgeStart;
            currentKey = followingKey;
        }
        if (!closed || contour.length < 3) {
            throw new Error(`"${objectName}" has an unclosed contour near layer ${layerIndex + 1}.`);
        }
        const area = contour.reduce((total, point, index) => {
            const next = contour[(index + 1) % contour.length];
            return total + point.x * next.z - next.x * point.z;
        }, 0) / 2;
        if (Math.abs(area) <= tolerance * tolerance) {
            throw new Error(`"${objectName}" has a zero-area contour near layer ${layerIndex + 1}.`);
        }
        contours.push(contour);
    }
    return contours;
}

function makeInfill(contours, spacing, tolerance, inset, angle) {
    if (!contours.length || !Number.isFinite(spacing) || spacing <= 0) return [];
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const toLocal = (point) => ({
        u: point.x * cosine + point.z * sine,
        v: -point.x * sine + point.z * cosine
    });
    const toModel = (u, v) => ({
        x: u * cosine - v * sine,
        z: u * sine + v * cosine
    });
    let minimumZ = Infinity;
    let maximumZ = -Infinity;
    for (const contour of contours) {
        for (const point of contour) {
            const local = toLocal(point);
            minimumZ = Math.min(minimumZ, local.v);
            maximumZ = Math.max(maximumZ, local.v);
        }
    }
    const lines = [];
    const firstZ = minimumZ + spacing / 2;
    for (let z = firstZ; z < maximumZ - tolerance; z += spacing) {
        const intersections = [];
        for (const contour of contours) {
            for (let index = 0; index < contour.length; index += 1) {
                const first = contour[index];
                const second = contour[(index + 1) % contour.length];
                const firstLocal = toLocal(first);
                const secondLocal = toLocal(second);
                if ((firstLocal.v <= z && secondLocal.v > z) || (secondLocal.v <= z && firstLocal.v > z)) {
                    intersections.push(firstLocal.u +
                        (secondLocal.u - firstLocal.u) * (z - firstLocal.v) / (secondLocal.v - firstLocal.v));
                }
            }
        }
        intersections.sort((first, second) => first - second);
        if (intersections.length % 2 !== 0) {
            throw new Error("A sliced contour produced an invalid infill intersection.");
        }
        for (let index = 0; index + 1 < intersections.length; index += 2) {
            const start = intersections[index] + inset;
            const end = intersections[index + 1] - inset;
            if (end - start > tolerance * 2) {
                lines.push([toModel(start, z), toModel(end, z)]);
            }
        }
    }
    return lines;
}

function gcodeNumber(value) {
    return (Math.round(value * 1000) / 1000).toFixed(3);
}

export function sliceMeshes(meshes, inputSettings = {}, projectName = "Smart Desk") {
    if (!Array.isArray(meshes) || meshes.length === 0) throw new Error("Add at least one body before slicing.");
    const settings = validateSettings(inputSettings);
    const prepared = [];
    let totalTriangles = 0;
    let maximumY = 0;
    for (const mesh of meshes) {
        const positions = mesh.positions;
        const indices = mesh.indices || null;
        if (!positions || positions.length < 9 || positions.length % 3 !== 0) {
            throw new Error(`"${mesh.name || "Body"}" has invalid triangle positions.`);
        }
        const triangleCount = (indices?.length ?? positions.length / 3) / 3;
        if (!Number.isInteger(triangleCount)) throw new Error(`"${mesh.name || "Body"}" has incomplete triangles.`);
        totalTriangles += triangleCount;
        if (totalTriangles > MAX_TRIANGLES) throw new Error("This experimental slicer is limited to 100,000 triangles.");
        const analysis = analyzeTriangleMesh(positions, indices);
        if (!analysis.watertight || analysis.inconsistentWindingEdges || analysis.degenerateTriangles) {
            throw new Error(
                `"${mesh.name || "Body"}" is not a clean, watertight solid ` +
                `(open edges ${analysis.boundaryEdges}, non-manifold edges ${analysis.nonManifoldEdges}, ` +
                `winding errors ${analysis.inconsistentWindingEdges}, degenerate faces ${analysis.degenerateTriangles}).`
            );
        }
        if (Math.abs(analysis.signedVolume) < 1e-9) {
            throw new Error(`"${mesh.name || "Body"}" encloses no reliable printable volume.`);
        }
        const bounds = meshBounds(positions);
        const tolerance = Math.max(Math.hypot(
            bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ
        ) * 1e-7, 1e-8);
        if (bounds.minY < -tolerance || bounds.minY > settings.layerHeight * 0.5 + tolerance) {
            throw new Error(`"${mesh.name || "Body"}" must sit on the build plate (minimum Z/height is ${gcodeNumber(bounds.minY)} mm).`);
        }
        if (bounds.minX < -settings.bedWidth / 2 - tolerance ||
            bounds.maxX > settings.bedWidth / 2 + tolerance ||
            bounds.minZ < -settings.bedDepth / 2 - tolerance ||
            bounds.maxZ > settings.bedDepth / 2 + tolerance ||
            bounds.maxY > settings.bedHeight + tolerance) {
            throw new Error(`"${mesh.name || "Body"}" exceeds the configured build volume.`);
        }
        maximumY = Math.max(maximumY, bounds.maxY);
        prepared.push({ name: mesh.name || "Body", positions, indices, bounds, tolerance, triangleCount });
    }

    const layerCount = Math.ceil(maximumY / settings.layerHeight);
    if (!layerCount || layerCount > MAX_LAYER_COUNT) {
        throw new Error(`The slice must contain between 1 and ${MAX_LAYER_COUNT} layers.`);
    }
    const operationCount = totalTriangles * layerCount;
    if (operationCount > MAX_TRIANGLE_LAYER_TESTS) {
        throw new Error("This model exceeds the interactive slicer's geometry-work limit. Reduce mesh detail or model height.");
    }

    let perimeterSegments = 0;
    let infillSegments = 0;
    let totalPathLength = 0;
    let extrusion = 0;
    let moveCount = 0;
    let current = null;
    let previousInfillDirection = false;
    const filamentArea = Math.PI * (settings.filamentDiameter / 2) ** 2;
    const extrusionPerMm = settings.lineWidth * settings.layerHeight / filamentArea;
    const startLines = [
        "; Smart Desk experimental single-nozzle FDM output",
        "; Generic Marlin-style G-code. Verify firmware, temperature, limits, and first-layer adhesion.",
        "; No support generation, nozzle compensation, retraction, bridging, or printer-specific start sequence.",
        "; CAD X/Z are shifted from the centered build plate to the printer's front-left XY origin.",
        `; Project: ${String(projectName).replace(/[\r\n;]/g, " ").slice(0, 100)}`,
        `; Layers: ${layerCount} | Layer height: ${settings.layerHeight} mm | One boundary pass`,
        `; Presets: ${settings.qualityPreset} quality | generic ${settings.materialPreset.toUpperCase()}`,
        `; Infill: ${settings.infillPattern} at ${settings.infillPercent}% | Filament diameter: ${settings.filamentDiameter} mm`,
        `; Temperatures: nozzle ${settings.nozzleTemperature} C | bed ${settings.bedTemperature} C`,
        "G21 ; millimetres",
        "G90 ; absolute XYZ",
        "M82 ; absolute extrusion",
        "M107 ; fan off",
        `M140 S${settings.bedTemperature}`,
        `M104 S${settings.nozzleTemperature}`,
        "G28 ; home",
        `M190 S${settings.bedTemperature}`,
        `M109 S${settings.nozzleTemperature}`,
        "G92 E0",
        `G1 Z${gcodeNumber(settings.layerHeight)} F${Math.round(settings.travelSpeed * 60)}`
    ];
    const lines = [...startLines];

    const emitPath = (path, y, speed, close = false) => {
        if (path.length < 2) return;
        const first = path[0];
        const originX = settings.bedWidth / 2;
        const originY = settings.bedDepth / 2;
        moveCount += 1;
        if (moveCount > MAX_GCODE_MOVES) {
            throw new Error("This toolpath exceeds the interactive G-code move limit of 250,000.");
        }
        lines.push(`G0 X${gcodeNumber(first.x + originX)} Y${gcodeNumber(first.z + originY)} Z${gcodeNumber(y)} F${Math.round(settings.travelSpeed * 60)}`);
        current = { x: first.x, y: first.z, z: y };
        const pointCount = path.length + (close ? 1 : 0);
        for (let pointIndex = 1; pointIndex < pointCount; pointIndex += 1) {
            const point = path[pointIndex % path.length];
            const distance = Math.hypot(point.x - current.x, point.z - current.y);
            if (distance <= 1e-8) continue;
            moveCount += 1;
            if (moveCount > MAX_GCODE_MOVES) {
                throw new Error("This toolpath exceeds the interactive G-code move limit of 250,000.");
            }
            extrusion += distance * extrusionPerMm;
            totalPathLength += distance;
            lines.push(
                `G1 X${gcodeNumber(point.x + originX)} Y${gcodeNumber(point.z + originY)} Z${gcodeNumber(y)} ` +
                `E${gcodeNumber(extrusion)} F${Math.round(speed * 60)}`
            );
            current = { x: point.x, y: point.z, z: y };
        }
    };

    for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        const layerY = (layerIndex + 0.5) * settings.layerHeight;
        const layerContours = [];
        for (const mesh of prepared) {
            if (layerY < mesh.bounds.minY - mesh.tolerance || layerY > mesh.bounds.maxY + mesh.tolerance) continue;
            const segments = makeSliceSegments(mesh.positions, mesh.indices, layerY, mesh.tolerance);
            if (!segments.length) continue;
            const contours = traceContours(segments, mesh.tolerance, mesh.name, layerIndex);
            layerContours.push(...contours);
        }
        if (!layerContours.length) {
            throw new Error(`No solid cross-section was found at layer ${layerIndex + 1}; unsupported or disconnected geometry is not handled.`);
        }
        lines.push(`;LAYER:${layerIndex}`);
        lines.push(`G1 Z${gcodeNumber((layerIndex + 1) * settings.layerHeight)} F${Math.round(settings.travelSpeed * 60)}`);

        for (const contour of layerContours) {
            emitPath(contour, (layerIndex + 1) * settings.layerHeight, settings.perimeterSpeed, true);
            perimeterSegments += contour.length;
        }
        const solidLayer = layerIndex < settings.bottomLayers || layerIndex >= layerCount - settings.topLayers;
        const density = solidLayer ? 100 : settings.infillPercent;
        if (density > 0) {
            const spacing = settings.lineWidth / (density / 100);
            let directions;
            if (settings.infillPattern === "grid") directions = [0, Math.PI / 2];
            else if (settings.infillPattern === "triangles") directions = [0, Math.PI / 3, Math.PI * 2 / 3];
            else directions = [previousInfillDirection ? Math.PI / 2 : 0];
            const infill = directions.flatMap((angle) =>
                makeInfill(layerContours, spacing, 1e-8, settings.lineWidth / 2, angle)
            );
            if (settings.infillPattern !== "lines" && previousInfillDirection) {
                infill.forEach((path, index) => {
                    if (index % directions.length === 0) path.reverse();
                });
            }
            for (const path of infill) emitPath(path, (layerIndex + 1) * settings.layerHeight, settings.infillSpeed);
            infillSegments += infill.length;
            previousInfillDirection = !previousInfillDirection;
        }
    }
    const lastY = layerCount * settings.layerHeight;
    lines.push(
        "; End print",
        "M400 ; wait for moves",
        "M107",
        "M104 S0",
        "M140 S0",
        `G1 Z${gcodeNumber(Math.min(settings.bedHeight, lastY + 5))} F${Math.round(settings.travelSpeed * 60)}`,
        "G1 X0 Y0 F3000",
        "M84"
    );
    const gcode = `${lines.join("\n")}\n`;
    return {
        gcode,
        layerCount,
        triangleCount: totalTriangles,
        perimeterSegments,
        infillSegments,
        pathLengthMm: totalPathLength,
        filamentMm: extrusion
    };
}
