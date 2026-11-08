import assert from "node:assert/strict";
import test from "node:test";
import { exportFacetedStep, importFacetedStep } from "./cad-step.js";

test("round-trips multiple named faceted STEP bodies", () => {
    const source = [
        { name: "Body O'ne", positions: [0, 0, 0, 10, 0, 0, 0, 10, 0], indices: [0, 1, 2] },
        { name: "Second", positions: [1, 2, 3, 2, 2, 3, 1, 3, 3], indices: [0, 1, 2] }
    ];
    const result = importFacetedStep(exportFacetedStep("Bench", source));
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Body O'ne");
    assert.deepEqual(result[0].positions, source[0].positions);
    assert.deepEqual(result[0].indices, source[0].indices);
    assert.deepEqual(result[1].positions, source[1].positions);
});

test("rejects malformed and unsupported STEP input", () => {
    assert.throws(() => exportFacetedStep("Empty", []), /visible body/);
    assert.throws(() => exportFacetedStep("Invalid", [{
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 3]
    }]), /invalid triangle indices/);
    assert.throws(() => importFacetedStep("not a STEP file"), /complete ISO 10303-21/);
    assert.throws(() => importFacetedStep(
        "ISO-10303-21;DATA;#1=MANIFOLD_SOLID_BREP();ENDSEC;END-ISO-10303-21;"
    ), /no AP242 triangulated face sets/);
});
