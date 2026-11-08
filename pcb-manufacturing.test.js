import test from "node:test";
import assert from "node:assert/strict";
import {
    createPcbManufacturingZip,
    generatePcbManufacturingFiles,
    validatePcbManufacturingProject
} from "./pcb-manufacturing.js";

const definitions = {
    resistor: { footprint: { type: "through-hole" } },
    capacitor: { footprint: { type: "smd-0805" } }
};

function projectFixture() {
    return {
        name: "Robot controller",
        width: 10,
        height: 10,
        thickness: 1.6,
        components: [{ reference: "R1" }, { reference: "C1" }],
        layout: {
            outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
            layers: [
                { id: "top-copper", name: "Top copper", type: "copper", side: "top" },
                { id: "bottom-copper", name: "Bottom copper", type: "copper", side: "bottom" },
                { id: "board-outline", name: "Board outline", type: "outline", side: "both" },
                { id: "top-silkscreen", name: "Top silkscreen", type: "silkscreen", side: "top" }
            ],
            footprints: [
                { id: "f1", type: "resistor", reference: "R1", value: "10k", x: 2, y: 2, rotation: 0,
                    pads: [
                        { number: 1, name: "A", offset: { x: -1, y: 0 }, kind: "through-hole", netId: "n1" },
                        { number: 2, name: "B", offset: { x: 1, y: 0 }, kind: "through-hole", netId: "n2" }
                    ] },
                { id: "f2", type: "capacitor", reference: "C1", value: "100nF", x: 4, y: 4, rotation: 90,
                    pads: [{ number: 1, name: "1", offset: { x: -1, y: 0 }, kind: "smd", netId: "n1" }] }
            ],
            tracks: [{ id: "t1", netId: "n1", layerId: "top-copper", width: 0.3,
                points: [{ x: 1, y: 2 }, { x: 3, y: 2 }] }],
            vias: [{ id: "v1", x: 5, y: 5, diameter: 0.8, netId: "n1", layers: ["top-copper", "bottom-copper"] }],
            zones: [{ id: "z1", netId: "n1", layerId: "top-copper",
                points: [{ x: 6, y: 6 }, { x: 9, y: 6 }, { x: 9, y: 9 }] }],
            nets: [{ id: "n1", name: "VCC", nodes: [{ reference: "R1", pin: 1 }] }]
        }
    };
}

function configuration() {
    return {
        selectedLayers: ["top-copper", "bottom-copper", "board-outline"],
        outputs: { gerber: true, drill: true, bom: true, pickPlace: true, netlist: true, project: true, documentation: true },
        throughHoleDrillMm: 0.8,
        viaDrillMm: 0.3,
        throughHolePadDiameterMm: 1.8,
        smdPadWidthMm: 1.6,
        smdPadHeightMm: 0.9,
        generatedAt: "2026-11-02T00:00:00.000Z"
    };
}

test("generates actual Gerber, Excellon, BOM, placement, netlist, project and documentation files", () => {
    const result = generatePcbManufacturingFiles(projectFixture(), configuration(), (type) => definitions[type]);
    const byName = new Map(result.files.map((file) => [file.path, file]));

    assert.ok(byName.has("Robot-controller.GTL"));
    assert.ok(byName.has("Robot-controller.GBL"));
    assert.ok(byName.has("Robot-controller.GKO"));
    assert.ok(byName.has("Robot-controller.DRL"));
    assert.ok(byName.has("Robot-controller-BOM.csv"));
    assert.ok(byName.has("Robot-controller-pick-and-place.csv"));
    assert.ok(byName.has("Robot-controller-netlist.csv"));
    assert.ok(byName.has("Robot-controller-project.json"));
    assert.ok(byName.has("Robot-controller-manufacturing.md"));
    assert.match(byName.get("Robot-controller.GTL").content, /%MOMM\*%/);
    assert.match(byName.get("Robot-controller.GTL").content, /G36\*/);
    assert.match(byName.get("Robot-controller.GTL").content, /D01\*/);
    assert.match(byName.get("Robot-controller.GTL").content, /M02\*/);
    assert.match(byName.get("Robot-controller.DRL").content, /T01C0\.3000/);
    assert.match(byName.get("Robot-controller.DRL").content, /T02C0\.8000/);
    assert.match(byName.get("Robot-controller.DRL").content, /METRIC,LZ,000\.0000/);
    assert.match(byName.get("Robot-controller-BOM.csv").content, /R1/);
    assert.match(byName.get("Robot-controller-pick-and-place.csv").content, /C1/);
    assert.doesNotMatch(byName.get("Robot-controller-pick-and-place.csv").content, /R1/);
    assert.match(byName.get("Robot-controller-netlist.csv").content, /VCC,R1,1/);
    assert.match(byName.get("Robot-controller-manufacturing.md").content, /zone filling and clearances are not implemented/);
    assert.ok(result.warnings.some((warning) => warning.includes("zone")));
});

test("manufacturing checks reject self-crossing profiles and off-board pads", () => {
    const project = projectFixture();
    project.layout.outline = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }];
    const report = validatePcbManufacturingProject(project, configuration());
    assert.ok(report.errors.some((error) => error.includes("crosses itself")));

    const offBoard = projectFixture();
    offBoard.layout.footprints[0].x = 11;
    const offBoardReport = validatePcbManufacturingProject(offBoard, configuration());
    assert.ok(offBoardReport.errors.some((error) => error.includes("outside the board outline")));
});

test("readiness reports 3D-only components that have no physical layout footprint", () => {
    const project = projectFixture();
    project.layout.footprints = [];
    const report = validatePcbManufacturingProject(project, configuration(), (type) => definitions[type]);
    assert.ok(report.warnings.some((warning) => warning.includes("3D preview component(s)") &&
        warning.includes("BOM and fabrication geometry use only")));
});

test("project packaging creates a standards-shaped, readable stored ZIP archive", () => {
    const files = [{ path: "hello.txt", content: "Aqua PCB export" }, { path: "layout.GTL", content: "M02*" }];
    const zip = createPcbManufacturingZip(files, new Date("2026-11-02T12:00:00.000Z"));
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.ok([...Array(zip.length - 4)].some((_, index) => view.getUint32(index, true) === 0x02014b50));
    assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
    const archiveText = new TextDecoder().decode(zip);
    assert.ok(archiveText.includes("hello.txt"));
    assert.ok(archiveText.includes("Aqua PCB export"));
    assert.ok(archiveText.includes("layout.GTL"));
});
