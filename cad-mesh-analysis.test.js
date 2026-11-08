import assert from "node:assert/strict";
import test from "node:test";
import { analyzeTriangleMesh } from "./cad-mesh-analysis.js";

const tetrahedronPositions = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
];
const tetrahedronIndices = [
    0, 2, 1,
    0, 1, 3,
    0, 3, 2,
    1, 2, 3
];

test("recognizes a closed, consistently oriented indexed tetrahedron", () => {
    const result = analyzeTriangleMesh(tetrahedronPositions, tetrahedronIndices);
    assert.equal(result.triangleCount, 4);
    assert.equal(result.boundaryEdges, 0);
    assert.equal(result.nonManifoldEdges, 0);
    assert.equal(result.inconsistentWindingEdges, 0);
    assert.equal(result.degenerateTriangles, 0);
    assert.equal(result.connectedComponents, 1);
    assert.equal(result.watertight, true);
    assert.ok(Math.abs(Math.abs(result.signedVolume) - 1 / 6) < 1e-12);
});

test("finds open boundaries and disconnected shells in non-indexed triangles", () => {
    const result = analyzeTriangleMesh([
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        3, 0, 0, 4, 0, 0, 3, 1, 0
    ]);
    assert.equal(result.boundaryEdges, 6);
    assert.equal(result.connectedComponents, 2);
    assert.equal(result.watertight, false);
});

test("reports degenerate faces, non-manifold edges, and inconsistent winding", () => {
    const nonManifold = analyzeTriangleMesh(
        [
            0, 0, 0, 1, 0, 0, 0, 1, 0,
            1, 0, 0, 0, 0, 0, 0, -1, 0,
            0, 0, 0, 1, 0, 0, 0, 0, 1
        ]
    );
    assert.equal(nonManifold.nonManifoldEdges, 1);

    const inconsistent = analyzeTriangleMesh([
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        0, 0, 0, 1, 0, 0, 0, -1, 0
    ]);
    assert.equal(inconsistent.inconsistentWindingEdges, 1);

    const degenerate = analyzeTriangleMesh([
        0, 0, 0, 1, 0, 0, 2, 0, 0
    ]);
    assert.equal(degenerate.degenerateTriangles, 1);
});

test("rejects invalid mesh buffers instead of returning a clean-looking report", () => {
    assert.throws(() => analyzeTriangleMesh([0, 0, 0]), /complete triangle/);
    assert.throws(() => analyzeTriangleMesh([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 3]), /invalid vertex/);
    assert.throws(() => analyzeTriangleMesh([0, 0, 0, 1, 0, 0, 0, 1, 0, NaN, 0, 0]), /non-finite/);
});
