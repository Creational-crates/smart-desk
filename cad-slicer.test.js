import assert from "node:assert/strict";
import test from "node:test";
import { BoxGeometry } from "three";
import { sliceMeshes } from "./cad-slicer.js";

function cubeMesh(name = "Cube", xOffset = 0) {
    const geometry = new BoxGeometry(20, 20, 20);
    geometry.translate(xOffset, 10, 0);
    return {
        name,
        positions: geometry.getAttribute("position").array,
        indices: geometry.getIndex().array
    };
}

test("slices a watertight cube into bounded, front-left-origin G-code", () => {
    const result = sliceMeshes([cubeMesh()], {
        infillPercent: 20,
        bottomLayers: 2,
        topLayers: 2
    }, "Test cube");
    assert.equal(result.layerCount, 100);
    assert.equal(result.triangleCount, 12);
    assert.ok(result.perimeterSegments > 0);
    assert.ok(result.infillSegments > 0);
    assert.ok(result.filamentMm > 0);
    assert.match(result.gcode, /G21 ; millimetres/);
    assert.match(result.gcode, /G90 ; absolute XYZ/);
    assert.match(result.gcode, /;LAYER:99/);
    assert.match(result.gcode, /; End print/);
    assert.doesNotMatch(result.gcode, /G1 X-|\bNaN\b|\bInfinity\b/);
    const toolMoves = result.gcode.matchAll(/G[01] X(-?\d+\.\d{3}) Y(-?\d+\.\d{3}) Z(-?\d+\.\d{3})/g);
    const moves = [...toolMoves].map((match) => match.slice(1).map(Number));
    assert.ok(moves.length > 0);
    assert.ok(moves.every(([x, y, z]) => x >= 0 && x <= 220 && y >= 0 && y <= 220 && z >= 0));
    assert.ok(moves.some(([, , z]) => z === 0.2));
});

test("uses configurable infill density and solid top and bottom layers", () => {
    const solid = sliceMeshes([cubeMesh()], {
        infillPercent: 0,
        bottomLayers: 1,
        topLayers: 1
    });
    const sparse = sliceMeshes([cubeMesh()], {
        infillPercent: 10,
        bottomLayers: 1,
        topLayers: 1
    });
    assert.ok(solid.infillSegments > 0);
    assert.ok(sparse.infillSegments > solid.infillSegments);
});

test("generates distinct line, grid, and triangular infill toolpaths", () => {
    const settings = { bottomLayers: 1, topLayers: 1, infillPercent: 15 };
    const lines = sliceMeshes([cubeMesh()], { ...settings, infillPattern: "lines" });
    const grid = sliceMeshes([cubeMesh()], { ...settings, infillPattern: "grid" });
    const triangles = sliceMeshes([cubeMesh()], { ...settings, infillPattern: "triangles" });
    assert.ok(grid.infillSegments > lines.infillSegments);
    assert.ok(triangles.infillSegments > grid.infillSegments);
    assert.match(triangles.gcode, /; Infill: triangles at 15%/);
});

test("writes generic material and quality preset labels without claiming print safety", () => {
    const result = sliceMeshes([cubeMesh()], {
        qualityPreset: "detail",
        materialPreset: "petg",
        layerHeight: 0.12,
        nozzleTemperature: 240,
        bedTemperature: 80
    });
    assert.match(result.gcode, /; Presets: detail quality \| generic PETG/);
    assert.match(result.gcode, /; Temperatures: nozzle 240 C \| bed 80 C/);
    assert.throws(() => sliceMeshes([cubeMesh()], { materialPreset: "unknown" }), /supported generic material/);
});

test("rejects open meshes instead of exporting incomplete toolpaths", () => {
    const cube = cubeMesh();
    assert.throws(() => sliceMeshes([{
        name: "Open face",
        positions: cube.positions,
        indices: cube.indices.slice(0, cube.indices.length - 6)
    }]), /not a clean, watertight solid/);
});

test("rejects parts outside the bed and unsafe slicer parameters", () => {
    assert.throws(() => sliceMeshes([cubeMesh("Outside", 110)]), /exceeds the configured build volume/);
    assert.throws(() => sliceMeshes([cubeMesh()], { layerHeight: 0.4, nozzleDiameter: 0.4 }), /80%/);
    assert.throws(() => sliceMeshes([cubeMesh()], { infillPercent: 101 }), /between 0 and 100/);
});

test("rejects models that do not start on the build plate", () => {
    const geometry = new BoxGeometry(20, 20, 20);
    geometry.translate(0, 30, 0);
    assert.throws(() => sliceMeshes([{
        name: "Floating cube",
        positions: geometry.getAttribute("position").array,
        indices: geometry.getIndex().array
    }]), /must sit on the build plate/);
});
