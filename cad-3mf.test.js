import assert from "node:assert/strict";
import test from "node:test";
import { export3mf, import3mf } from "./cad-3mf.js";

function asFile(bytes, name = "model.3mf") {
    return {
        name,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
}

test("round-trips a named, indexed mesh through a 3MF archive", async () => {
    const bytes = export3mf("Bracket", [{
        name: "Mount",
        positions: [0, 0, 0, 20, 0, 0, 0, 10, 0, 0, 0, 5],
        indices: [0, 1, 2, 0, 3, 1]
    }]);
    const [mesh] = await import3mf(asFile(bytes));
    assert.equal(mesh.name, "Mount");
    assert.deepEqual(mesh.positions, [0, 0, 0, 20, 0, 0, 0, 10, 0, 0, 0, 5]);
    assert.deepEqual(mesh.indices, [0, 1, 2, 0, 3, 1]);
});

test("round-trips multiple 3MF objects and escapes XML names", async () => {
    const bytes = export3mf("Desk & stand", [
        { name: "Leg <left>", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] },
        { name: "Top", positions: [0, 0, 0, 2, 0, 0, 0, 2, 0], indices: [0, 1, 2] }
    ]);
    const meshes = await import3mf(asFile(bytes));
    assert.equal(meshes.length, 2);
    assert.equal(meshes[0].name, "Leg <left>");
    assert.equal(meshes[1].name, "Top");
});

test("rejects empty exports and corrupt archives", async () => {
    assert.throws(() => export3mf("Empty", []), /visible body/);
    await assert.rejects(import3mf(asFile(new Uint8Array([1, 2, 3]))), /ZIP directory/);
});
