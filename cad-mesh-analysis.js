const EDGE_DIRECTIONS = [[0, 1], [1, 2], [2, 0]];

export function analyzeTriangleMesh(positions, indices = null) {
    if (!positions || positions.length < 9 || positions.length % 3 !== 0) {
        throw new Error("Mesh positions must contain at least one complete triangle.");
    }
    if (indices && (indices.length === 0 || indices.length % 3 !== 0)) {
        throw new Error("Mesh indices must contain complete triangles.");
    }

    const vertexCount = positions.length / 3;
    const elementCount = indices ? indices.length : vertexCount;
    if (indices) {
        for (const index of indices) {
            if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
                throw new Error("Mesh indices contain an invalid vertex reference.");
            }
        }
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let index = 0; index < positions.length; index += 3) {
        const x = positions[index];
        const y = positions[index + 1];
        const z = positions[index + 2];
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            throw new Error("Mesh positions contain a non-finite coordinate.");
        }
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }

    const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
    const tolerance = Math.max(diagonal * 1e-7, 1e-9);
    const vertexKeys = new Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const offset = vertex * 3;
        vertexKeys[vertex] = [
            Math.round(positions[offset] / tolerance),
            Math.round(positions[offset + 1] / tolerance),
            Math.round(positions[offset + 2] / tolerance)
        ].join(",");
    }

    const triangleCount = elementCount / 3;
    const parents = new Uint32Array(triangleCount);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) parents[triangle] = triangle;
    const findRoot = (value) => {
        let root = value;
        while (parents[root] !== root) root = parents[root];
        while (parents[value] !== value) {
            const parent = parents[value];
            parents[value] = root;
            value = parent;
        }
        return root;
    };
    const union = (first, second) => {
        const firstRoot = findRoot(first);
        const secondRoot = findRoot(second);
        if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
    };

    const edges = new Map();
    let degenerateTriangles = 0;
    let signedVolume = 0;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const elementOffset = triangle * 3;
        const aIndex = indices ? indices[elementOffset] : elementOffset;
        const bIndex = indices ? indices[elementOffset + 1] : elementOffset + 1;
        const cIndex = indices ? indices[elementOffset + 2] : elementOffset + 2;
        const aOffset = aIndex * 3;
        const bOffset = bIndex * 3;
        const cOffset = cIndex * 3;
        const ax = positions[aOffset];
        const ay = positions[aOffset + 1];
        const az = positions[aOffset + 2];
        const abx = positions[bOffset] - ax;
        const aby = positions[bOffset + 1] - ay;
        const abz = positions[bOffset + 2] - az;
        const acx = positions[cOffset] - ax;
        const acy = positions[cOffset + 1] - ay;
        const acz = positions[cOffset + 2] - az;
        const crossX = aby * acz - abz * acy;
        const crossY = abz * acx - abx * acz;
        const crossZ = abx * acy - aby * acx;
        if (Math.hypot(crossX, crossY, crossZ) / 2 <= tolerance * tolerance) {
            degenerateTriangles += 1;
        }
        signedVolume += (
            ax * (positions[bOffset + 1] * positions[cOffset + 2] - positions[bOffset + 2] * positions[cOffset + 1]) +
            ay * (positions[bOffset + 2] * positions[cOffset] - positions[bOffset] * positions[cOffset + 2]) +
            az * (positions[bOffset] * positions[cOffset + 1] - positions[bOffset + 1] * positions[cOffset])
        ) / 6;

        const vertices = [aIndex, bIndex, cIndex];
        for (const [fromCorner, toCorner] of EDGE_DIRECTIONS) {
            const fromKey = vertexKeys[vertices[fromCorner]];
            const toKey = vertexKeys[vertices[toCorner]];
            const key = fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
            const direction = fromKey < toKey ? 1 : -1;
            const incidents = edges.get(key);
            if (incidents) {
                incidents.push({ triangle, direction });
                union(triangle, incidents[0].triangle);
            } else {
                edges.set(key, [{ triangle, direction }]);
            }
        }
    }

    let boundaryEdges = 0;
    let nonManifoldEdges = 0;
    let inconsistentWindingEdges = 0;
    for (const incidents of edges.values()) {
        if (incidents.length === 1) boundaryEdges += 1;
        else if (incidents.length > 2) nonManifoldEdges += 1;
        else if (incidents[0].direction === incidents[1].direction) inconsistentWindingEdges += 1;
    }

    const components = new Set();
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        components.add(findRoot(triangle));
    }

    return {
        triangleCount,
        vertexCount,
        boundaryEdges,
        nonManifoldEdges,
        inconsistentWindingEdges,
        degenerateTriangles,
        connectedComponents: components.size,
        signedVolume,
        watertight: boundaryEdges === 0 && nonManifoldEdges === 0
    };
}
