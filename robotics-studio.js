import * as THREE from "three";

const STORAGE_KEY = "smart-desk-robotics-project-v1";
const RENDER_MODE_KEY = "smart-desk-robotics-low-end";
const MAX_COMPONENTS = 100;
const MAX_PROJECT_BYTES = 2_000_000;
const parts = [
    { type: "arduino-uno", name: "Arduino Uno", group: "Controller", pins: "", color: "#218c78", shape: "uno", description: "ATmega328P development board · 5 V logic" },
    { type: "servo", name: "Micro servo", group: "Actuator", pins: "9", color: "#dc8755", shape: "servo", description: "3-wire hobby servo · suggested signal pin D9" },
    { type: "ultrasonic", name: "Ultrasonic sensor", group: "Distance", pins: "7, 8", color: "#4b86b5", shape: "ultrasonic", description: "HC-SR04-style trigger / echo · 5 V module" },
    { type: "ir-sensor", name: "IR obstacle sensor", group: "Sensor", pins: "2", color: "#765ea8", shape: "sensor", description: "Digital obstacle output · verify module voltage" },
    { type: "soil-moisture", name: "Soil moisture sensor", group: "Sensor", pins: "A0", color: "#668b54", shape: "sensor", description: "Analog moisture output · generic module" },
    { type: "dc-motor", name: "DC motor + driver", group: "Actuator", pins: "5, 6", color: "#b65f57", shape: "motor", description: "Motor driver required · do not connect a motor directly to the Uno" },
    { type: "ldr", name: "Light sensor (LDR)", group: "Sensor", pins: "A1", color: "#d0a641", shape: "sensor", description: "Analog input · requires a voltage-divider resistor" },
    { type: "button", name: "Push button", group: "Input", pins: "4", color: "#677f95", shape: "button", description: "Digital input · use INPUT_PULLUP or an external pull resistor" },
    { type: "led", name: "LED + resistor", group: "Output", pins: "13", color: "#d0a641", shape: "led", description: "Include a current-limiting resistor" },
    { type: "buzzer", name: "Buzzer", group: "Output", pins: "3", color: "#9b718d", shape: "buzzer", description: "Check buzzer current; use a driver for larger loads" },
    { type: "temperature", name: "Analog temperature sensor", group: "Sensor", pins: "A2", color: "#c17c63", shape: "sensor", description: "Generic analog sensor · confirm the sensor pinout before wiring" },
    { type: "potentiometer", name: "Potentiometer", group: "Input", pins: "A3", color: "#667f95", shape: "sensor", description: "Three-terminal analog input · connect outer pins to 5 V and GND" },
    { type: "pir", name: "PIR motion sensor", group: "Sensor", pins: "12", color: "#805f9a", shape: "sensor", description: "Digital motion output · check startup delay and module voltage" },
    { type: "rain-sensor", name: "Rain sensor", group: "Sensor", pins: "A5", color: "#5186ae", shape: "sensor", description: "Analog module output · protect exposed electronics from water" },
    { type: "usb-power", name: "USB 5 V supply", group: "Power", pins: "", color: "#526d83", shape: "power-usb", description: "Regulated 5 V source · never connect external 5 V and USB 5 V together" },
    { type: "battery-4xaa", name: "4×AA battery pack", group: "Power", pins: "", color: "#9b783c", shape: "power-aa", description: "Nominal 6 V; voltage changes with chemistry and charge · not a regulated 5 V supply" },
    { type: "battery-9v", name: "9 V battery", group: "Power", pins: "", color: "#568064", shape: "power-9v", description: "Nominal 9 V · limited current capacity; unsuitable for motors or servos" },
    { type: "breadboard-regulator", name: "Breadboard 5 V regulator", group: "Power", pins: "", color: "#477b70", shape: "power-regulator", description: "Generic regulated 5 V module · verify input range, current rating, and pinout" }
];

const editor = document.querySelector("#roboticsStudio");
const stage = editor.querySelector("[data-robotics-stage]");
const canvas = editor.querySelector("[data-robotics-canvas]");
const lowCanvas = editor.querySelector("[data-robotics-low-canvas]");
const partsList = editor.querySelector("[data-robotics-parts]");
const placedParts = editor.querySelector("[data-robotics-placed-parts]");
const warningList = editor.querySelector("[data-robotics-warnings]");
const wireForm = editor.querySelector("[data-robotics-wire-form]");
const wireFrom = editor.querySelector("[data-wire-from]");
const wireTo = editor.querySelector("[data-wire-to]");
const wireKind = editor.querySelector("[data-wire-kind]");
const wireList = editor.querySelector("[data-robotics-wire-list]");
const codeEditor = editor.querySelector("[data-robotics-code]");
const blockStack = editor.querySelector("[data-block-stack]");
const blockWorkspace = editor.querySelector("[data-block-workspace]");
const status = editor.querySelector("[data-robotics-status]");
const lowModeToggle = editor.querySelector("[data-robotics-low]");
const angleSlider = editor.querySelector("[data-servo-slider]");
const distanceSlider = editor.querySelector("[data-distance-slider]");
const irSlider = editor.querySelector("[data-ir-slider]");
const pirSlider = editor.querySelector("[data-pir-slider]");
const moistureSlider = editor.querySelector("[data-moisture-slider]");
const lightSlider = editor.querySelector("[data-light-slider]");
const potentiometerSlider = editor.querySelector("[data-potentiometer-slider]");
const rainSlider = editor.querySelector("[data-rain-slider]");
const temperatureSlider = editor.querySelector("[data-temperature-slider]");
const buttonSlider = editor.querySelector("[data-button-slider]");
const simulationMonitor = editor.querySelector("[data-sim-monitor]");
const simulationVariables = editor.querySelector("[data-sim-variables]");
const simulationConsole = editor.querySelector("[data-sim-console]");
let project = { components: [], wires: [], blocks: [], code: "" };
let renderer = null;
let scene = null;
let camera = null;
let robotGroup = null;
let servoArms = [];
let componentGroups = new Map();
let sonarLine = null;
let renderedWires = [];
let animationFrame = 0;
let running = false;
let simulationPaused = false;
let targetAngle = 90;
let currentAngle = 90;
let motorPhase = 0;
let lastFrameTime = 0;
let cameraYaw = -0.65;
let cameraPitch = 0.72;
let cameraDistance = 132;
let dragState = null;
let resizeObserver = null;
let simulationRunId = 0;
const simulation = {
    variables: Object.create(null), outputs: Object.create(null), logs: [],
    buttonState: Object.create(null), logTimes: new Map(), instructionCount: 0
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const findPart = (type) => parts.find((part) => part.type === type);
const sensorTypes = ["ultrasonic", "ir-sensor", "soil-moisture", "ldr", "temperature", "potentiometer", "pir", "rain-sensor", "button"];
const blockTitles = {
    read: "Read sensor",
    if: "If sensor condition",
    repeat: "Repeat",
    repeatUntil: "Repeat until",
    waitUntil: "Wait until",
    whenButtonPressed: "When button pressed",
    whenStarted: "When Arduino starts",
    defineFunction: "Define custom block",
    callFunction: "Run custom block",
    servo: "Set servo angle",
    led: "Set LED",
    buzzer: "Set buzzer",
    motor: "Set motor speed",
    wait: "Wait",
    print: "Print text",
    setVariable: "Set variable",
    changeVariable: "Change variable"
};
const makeBlockId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const sensorThresholdMax = (type) => type === "ultrasonic" ? 300 :
    ["ir-sensor", "pir", "button"].includes(type) ? 1 : 1023;
const comparisonOperators = ["<", "<=", "==", "!=", ">=", ">"];

const starterTemplates = {
    "obstacle-rover": {
        components: [
            { id: "uno", type: "arduino-uno", x: 0, z: 0, pins: "" },
            { id: "sonar", type: "ultrasonic", x: -27, z: -16, pins: "7, 8" },
            { id: "servo", type: "servo", x: 27, z: -15, pins: "9" },
            { id: "motor", type: "dc-motor", x: 26, z: 16, pins: "5, 6" },
            { id: "battery", type: "battery-4xaa", x: -27, z: 16, pins: "" }
        ],
        wires: [
            { id: "rover-sonar", from: "uno", to: "sonar", kind: "signal" },
            { id: "rover-servo", from: "uno", to: "servo", kind: "signal" },
            { id: "rover-motor-signal", from: "uno", to: "motor", kind: "signal" },
            { id: "rover-battery-servo", from: "battery", to: "servo", kind: "power" },
            { id: "rover-battery-motor", from: "battery", to: "motor", kind: "power" },
            { id: "rover-battery-ground", from: "battery", to: "uno", kind: "ground" }
        ],
        blocks: [
            { id: "rover-read-distance", type: "read", componentId: "sonar", variable: "distanceCm" },
            {
                id: "rover-obstacle-check", type: "if", componentId: "sonar", leftType: "sensor",
                operator: "<", rightType: "number", threshold: 25,
                children: [
                    { id: "rover-avoid-servo", type: "servo", componentId: "servo", value: 45 },
                    { id: "rover-reverse-motor", type: "motor", componentId: "motor", value: 130, reverse: true }
                ],
                elseChildren: [
                    { id: "rover-center-servo", type: "servo", componentId: "servo", value: 90 },
                    { id: "rover-forward-motor", type: "motor", componentId: "motor", value: 170, reverse: false }
                ]
            }
        ]
    },
    "plant-monitor": {
        components: [
            { id: "uno", type: "arduino-uno", x: 0, z: 0, pins: "" },
            { id: "moisture", type: "soil-moisture", x: -27, z: -16, pins: "A0" },
            { id: "rain", type: "rain-sensor", x: 27, z: -16, pins: "A5" },
            { id: "regulator", type: "breadboard-regulator", x: -27, z: 16, pins: "" },
            { id: "battery", type: "battery-4xaa", x: 27, z: 16, pins: "" }
        ],
        wires: [
            { id: "plant-moisture", from: "uno", to: "moisture", kind: "signal" },
            { id: "plant-rain", from: "uno", to: "rain", kind: "signal" },
            { id: "plant-battery-regulator", from: "battery", to: "regulator", kind: "power" },
            { id: "plant-regulator-uno", from: "regulator", to: "uno", kind: "power" },
            { id: "plant-ground", from: "regulator", to: "uno", kind: "ground" }
        ],
        blocks: [
            { id: "plant-read-moisture", type: "read", componentId: "moisture", variable: "moistureLevel" },
            { id: "plant-read-rain", type: "read", componentId: "rain", variable: "rainLevel" },
            {
                id: "plant-dry-check", type: "if", leftType: "variable", variable: "moistureLevel",
                operator: ">", rightType: "number", threshold: 700,
                children: [{ id: "plant-dry-message", type: "print", message: "Soil is dry; consider watering." }],
                elseChildren: [{ id: "plant-ok-message", type: "print", message: "Soil moisture is adequate." }]
            }
        ]
    },
    "servo-scanner": {
        components: [
            { id: "uno", type: "arduino-uno", x: 0, z: 0, pins: "" },
            { id: "servo", type: "servo", x: -25, z: -15, pins: "9" },
            { id: "sonar", type: "ultrasonic", x: 25, z: -15, pins: "7, 8" },
            { id: "knob", type: "potentiometer", x: -25, z: 16, pins: "A0" },
            { id: "led", type: "led", x: 25, z: 16, pins: "13" },
            { id: "supply", type: "battery-4xaa", x: 0, z: 26, pins: "" }
        ],
        wires: [
            { id: "scanner-servo", from: "uno", to: "servo", kind: "signal" },
            { id: "scanner-sonar", from: "uno", to: "sonar", kind: "signal" },
            { id: "scanner-knob", from: "uno", to: "knob", kind: "signal" },
            { id: "scanner-led", from: "uno", to: "led", kind: "signal" },
            { id: "scanner-supply-servo", from: "supply", to: "servo", kind: "power" },
            { id: "scanner-supply-ground", from: "supply", to: "uno", kind: "ground" }
        ],
        blocks: [
            { id: "scanner-read-distance", type: "read", componentId: "sonar", variable: "distanceCm" },
            {
                id: "scanner-obstacle-check", type: "if", componentId: "sonar", leftType: "sensor",
                operator: "<", rightType: "number", threshold: 30,
                children: [
                    { id: "scanner-turn-left", type: "servo", componentId: "servo", value: 35 },
                    { id: "scanner-led-on", type: "led", componentId: "led", enabled: true }
                ],
                elseChildren: [
                    { id: "scanner-turn-right", type: "servo", componentId: "servo", value: 145 },
                    { id: "scanner-led-off", type: "led", componentId: "led", enabled: false }
                ]
            }
        ]
    }
};

function requiredPinCount(type) {
    return type === "ultrasonic" || type === "dc-motor" ? 2 :
        type === "arduino-uno" || isPowerSource(type) ? 0 : 1;
}

function isPowerSource(type) {
    return ["usb-power", "battery-4xaa", "battery-9v", "breadboard-regulator"].includes(type);
}

function powerSourceLabel(type) {
    return ({
        "usb-power": "USB regulated 5 V",
        "battery-4xaa": "4×AA · nominal 6 V",
        "battery-9v": "9 V battery · low current",
        "breadboard-regulator": "regulated 5 V module"
    })[type] || "";
}

function normalizedPins(component) {
    const part = findPart(component.type);
    if (!part || !requiredPinCount(component.type)) return [];
    const raw = typeof component.pins === "string" ? component.pins : part.pins;
    const pins = raw.split(",").map((pin) => pin.trim().toUpperCase().replace(/^D(?=\d)/, ""));
    if (pins.length !== requiredPinCount(component.type) ||
        pins.some((pin) => !/^(?:[0-9]|1[0-3]|A[0-5])$/.test(pin))) return null;
    return pins;
}

function pinKey(pin) {
    return pin.startsWith("A") ? String(14 + Number(pin.slice(1))) : String(Number(pin));
}

function pinExpression(pin) {
    return pin.startsWith("A") ? pin : String(Number(pin));
}

function getWiringWarnings() {
    const warnings = [];
    const usedPins = new Map();
    const analogParts = new Set(["soil-moisture", "ldr", "temperature", "potentiometer", "rain-sensor"]);
    for (const component of project.components) {
        const part = findPart(component.type);
        if (!part || component.type === "arduino-uno") continue;
        const pins = normalizedPins(component);
        if (!pins) {
            warnings.push(`${part.name}: use ${requiredPinCount(component.type)} valid Uno pin${requiredPinCount(component.type) === 1 ? "" : "s"} (D0–D13 or A0–A5).`);
            continue;
        }
        if (analogParts.has(component.type) && pins.some((pin) => !pin.startsWith("A"))) {
            warnings.push(`${part.name}: connect its analog output to A0–A5.`);
        }
        if (component.type === "dc-motor" && ![3, 5, 6, 9, 10, 11].includes(Number(pins[0]))) {
            warnings.push(`${part.name}: D${pins[0]} is not a PWM pin on an Uno; use D3, D5, D6, D9, D10, or D11 for speed control.`);
        }
        for (const pin of pins) {
            const key = pinKey(pin);
            const previous = usedPins.get(key);
            if (previous) warnings.push(`${part.name} and ${previous} both use ${pin}; assign unique pins.`);
            else usedPins.set(key, part.name);
            if (key === "0" || key === "1") warnings.push(`${part.name} uses D${key}, which conflicts with the USB serial connection.`);
        }
    }
    const motorCount = project.components.filter((component) => component.type === "dc-motor").length;
    if (motorCount) warnings.push("Motor outputs are initialized to zero. Use a motor driver and separate motor supply; do not connect motors to Uno pins.");
    if (project.components.some((component) => component.type === "servo")) {
        warnings.push("Power servos from a suitable external supply and connect its ground to Uno GND.");
    }
    const componentById = new Map(project.components.map((component) => [component.id, component]));
    for (const source of project.components.filter((component) => isPowerSource(component.type))) {
        warnings.push(`${powerSourceLabel(source.type)} is a diagram part only; it does not regulate or measure real voltage/current.`);
        if (source.type === "battery-9v") warnings.push("9 V rectangular batteries have limited current and are generally a poor choice for motors, servos, or long-running robots.");
        if (source.type === "battery-4xaa") warnings.push("AA pack voltage varies with battery chemistry and charge; measure it and use regulation where needed.");
    }
    const actuatorTypes = new Set(["servo", "dc-motor"]);
    for (const wire of project.wires || []) {
        const from = componentById.get(wire.from);
        const to = componentById.get(wire.to);
        if (!from || !to) continue;
        const source = isPowerSource(from.type) ? from : isPowerSource(to.type) ? to : null;
        const load = source === from ? to : source === to ? from : null;
        if (wire.kind === "power" && !source) warnings.push("Power (+) wire has no power-source component; connect a source in the diagram.");
        if (wire.kind === "signal" && source) warnings.push("A power source is not a signal pin; use a Power (+) or Ground wire instead.");
        if (source && wire.kind === "power" && load?.type === "arduino-uno") {
            if (source.type === "battery-9v") warnings.push("9 V source to Uno: use VIN/barrel only, never the 5V pin; verify your exact board documentation.");
            if (source.type === "battery-4xaa") warnings.push("4×AA is nominally 6 V, below the Uno's typical 7 V VIN recommendation; do not connect directly to 5V.");
            if (source.type === "usb-power") warnings.push("Do not connect an external 5 V source while USB is also powering the Uno; avoid back-feeding USB.");
        }
        if (source && wire.kind === "power" && actuatorTypes.has(load?.type)) {
            if (source.type === "battery-9v") warnings.push("A rectangular 9 V battery usually cannot supply motor/servo current; select a supply rated for stall current.");
            if (source.type === "battery-4xaa") warnings.push("Check actuator voltage range and pack current under stall load before connecting.");
        }
    }
    const poweredActuators = new Set((project.wires || [])
        .filter((wire) => wire.kind === "power")
        .flatMap((wire) => {
            const from = componentById.get(wire.from);
            const to = componentById.get(wire.to);
            if (isPowerSource(from?.type)) return [to?.id];
            if (isPowerSource(to?.type)) return [from?.id];
            return [];
        }));
    for (const wire of project.wires || []) {
        if (wire.kind !== "power") continue;
        const from = componentById.get(wire.from);
        const to = componentById.get(wire.to);
        if (isPowerSource(from?.type) && isPowerSource(to?.type)) warnings.push("Do not connect two power-source outputs together unless their design explicitly supports it.");
    }
    for (const actuator of project.components.filter((component) => actuatorTypes.has(component.type) && poweredActuators.has(component.id))) {
        const supplies = (project.wires || []).filter((wire) => {
            if (wire.kind !== "power") return false;
            const from = componentById.get(wire.from);
            const to = componentById.get(wire.to);
            return (from?.id === actuator.id && isPowerSource(to?.type)) ||
                (to?.id === actuator.id && isPowerSource(from?.type));
        }).map((wire) => wire.from === actuator.id ? wire.to : wire.from);
        const hasCommonGround = (project.wires || []).some((wire) =>
            wire.kind === "ground" && supplies.some((sourceId) =>
                (wire.from === sourceId && componentById.get(wire.to)?.type === "arduino-uno") ||
                (wire.to === sourceId && componentById.get(wire.from)?.type === "arduino-uno")
            )
        );
        if (!hasCommonGround) warnings.push(`${findPart(actuator.type).name}: add a GND connection between the external supply and Uno; check the real wiring.`);
    }
    return warnings;
}

function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function readProject() {
    let saved;
    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        setStatus(`Could not read the saved robotics project: ${error.message}`, true);
        return;
    }
    if (!saved) {
        project = {
            components: [{ id: "arduino-uno-initial", type: "arduino-uno", x: 0, z: 0 }],
            wires: [],
            blocks: [],
            code: ""
        };
        project.code = generateSketch(project.components);
        renderAll();
        return;
    }
    try {
        project = normalizeProject(JSON.parse(saved));
        if (!project.code) project.code = generateSketch(project.components);
        renderAll();
        setStatus("Saved project restored. Visual simulation only — no hardware is connected.");
    } catch (error) {
        project = { components: [{ id: "arduino-uno-initial", type: "arduino-uno", x: 0, z: 0 }], wires: [], blocks: [], code: "" };
        project.code = generateSketch(project.components);
        renderAll();
        setStatus(`The saved project could not be loaded: ${error.message}`, true);
    }
}

function normalizeProject(parsed) {
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.components) ||
        parsed.components.length < 1 || parsed.components.length > MAX_COMPONENTS) {
        throw new Error(`The project must contain between 1 and ${MAX_COMPONENTS} supported components.`);
    }
    const seenIds = new Set();
    const components = parsed.components.map((item) => {
        if (!item || typeof item.id !== "string" || !item.id.trim() || item.id.length > 80 ||
            !findPart(item.type) || !Number.isFinite(item.x) || !Number.isFinite(item.z) ||
            seenIds.has(item.id)) {
            throw new Error("The project contains an invalid component or duplicate component ID.");
        }
        seenIds.add(item.id);
        return {
            id: item.id,
            type: item.type,
            x: clamp(item.x, -38, 38),
            z: clamp(item.z, -28, 28),
            pins: typeof item.pins === "string" ? item.pins.slice(0, 20) : findPart(item.type).pins
        };
    });
    const componentIds = new Set(components.map((component) => component.id));
    const componentById = new Map(components.map((component) => [component.id, component]));
    if (parsed.wires !== undefined && (!Array.isArray(parsed.wires) || parsed.wires.length > 200)) {
        throw new Error("The project can contain at most 200 wires.");
    }
    const seenWireIds = new Set();
    const wires = (parsed.wires || []).map((wire) => {
        if (!wire || typeof wire.id !== "string" || !wire.id.trim() || wire.id.length > 80 ||
            seenWireIds.has(wire.id) || typeof wire.from !== "string" || typeof wire.to !== "string" ||
            wire.from === wire.to || !componentIds.has(wire.from) || !componentIds.has(wire.to) ||
            !["signal", "power", "ground"].includes(wire.kind)) {
            throw new Error("The project contains an invalid wire or unknown component reference.");
        }
        seenWireIds.add(wire.id);
        return { id: wire.id, from: wire.from, to: wire.to, kind: wire.kind };
    });
    const blocks = normalizeBlocks(parsed.blocks, componentIds, componentById);
    validateBlockFunctions(blocks);
    return { components, wires, blocks, code: typeof parsed.code === "string" ? parsed.code.slice(0, 100000) : "" };
}

function validateBlockFunctions(blocks) {
    const definitions = new Map();
    const calls = [];
    const collect = (items) => items.forEach((block) => {
        if (block.type === "defineFunction") {
            if (definitions.has(block.functionName)) throw new Error(`Custom block name "${block.functionName}" is used more than once.`);
            definitions.set(block.functionName, block);
        }
        if (block.type === "callFunction" && block.functionName) calls.push(block.functionName);
        collect(block.children || []);
        collect(block.elseChildren || []);
    });
    collect(blocks);
    const missing = calls.find((name) => !definitions.has(name));
    if (missing) throw new Error(`The custom block "${missing}" has no definition.`);
    const visiting = new Set();
    const visited = new Set();
    const visit = (name) => {
        if (visiting.has(name)) throw new Error(`Custom block calls contain a recursive cycle at "${name}".`);
        if (visited.has(name)) return;
        visiting.add(name);
        const nestedCalls = [];
        const findCalls = (items) => items.forEach((block) => {
            if (block.type === "callFunction" && block.functionName) nestedCalls.push(block.functionName);
            findCalls(block.children || []);
            findCalls(block.elseChildren || []);
        });
        findCalls(definitions.get(name)?.children || []);
        nestedCalls.forEach(visit);
        visiting.delete(name);
        visited.add(name);
    };
    definitions.forEach((_, name) => visit(name));
}

function normalizeBlocks(source, componentIds, componentById, state = { ids: new Set(), count: 0 }, depth = 0) {
    if (source !== undefined && (!Array.isArray(source) || source.length > 100)) {
        throw new Error("A block program can contain at most 100 blocks.");
    }
    return (source || []).map((block) => {
        if (!block || typeof block.id !== "string" || !block.id.trim() || block.id.length > 80 ||
            state.ids.has(block.id) || !Object.hasOwn(blockTitles, block.type)) {
            throw new Error("The project contains an invalid or duplicate code block.");
        }
        state.ids.add(block.id);
        state.count += 1;
        if (state.count > 100 || depth > 8) throw new Error("Block programs support up to 100 blocks nested 8 levels deep.");
        const componentId = typeof block.componentId === "string" ? block.componentId : "";
        const outputId = typeof block.outputId === "string" ? block.outputId : "";
        if ((componentId && !componentIds.has(componentId)) || (outputId && !componentIds.has(outputId))) {
            throw new Error("A code block refers to a component that is not in this project.");
        }
        const normalized = { id: block.id, type: block.type, componentId, outputId };
        if (["if", "waitUntil", "repeatUntil"].includes(block.type)) {
            const sensor = componentById.get(componentId);
            normalized.leftType = block.leftType === "variable" ? "variable" : "sensor";
            normalized.variable = typeof block.variable === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.variable)
                ? block.variable : "counter";
            normalized.operator = comparisonOperators.includes(block.operator) ? block.operator : "<";
            normalized.rightType = block.rightType === "variable" ? "variable" : "number";
            normalized.rightVariable = typeof block.rightVariable === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.rightVariable) ? block.rightVariable : "counter";
            normalized.threshold = clamp(Number.isFinite(block.threshold) ? block.threshold : 30,
                normalized.leftType === "variable" ? -32768 : 0,
                normalized.leftType === "variable" ? 32767 : sensorThresholdMax(sensor?.type));
            normalized.useSecondCondition = Boolean(block.useSecondCondition);
            normalized.secondComponentId = componentIds.has(block.secondComponentId) ? block.secondComponentId : componentId;
            normalized.secondLeftType = block.secondLeftType === "variable" ? "variable" : "sensor";
            normalized.secondVariable = typeof block.secondVariable === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.secondVariable) ? block.secondVariable : "counter";
            normalized.secondOperator = comparisonOperators.includes(block.secondOperator) ? block.secondOperator : "<";
            normalized.secondThreshold = clamp(Number.isFinite(block.secondThreshold) ? block.secondThreshold : 30,
                normalized.secondLeftType === "variable" ? -32768 : 0,
                normalized.secondLeftType === "variable" ? 32767 :
                    sensorThresholdMax(componentById.get(normalized.secondComponentId)?.type));
            normalized.secondRightType = block.secondRightType === "variable" ? "variable" : "number";
            normalized.secondRightVariable = typeof block.secondRightVariable === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.secondRightVariable) ? block.secondRightVariable : "counter";
            normalized.logic = block.logic === "OR" ? "OR" : "AND";
        }
        if (block.type === "defineFunction") {
            if (depth !== 0) throw new Error("Custom block definitions must be placed at the top level.");
            normalized.functionName = typeof block.functionName === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.functionName) ? block.functionName : "myBlock";
            normalized.children = normalizeBlocks(block.children, componentIds, componentById, state, depth + 1);
        } else if (block.type === "whenStarted") {
            if (depth !== 0) throw new Error("Start-event scripts must be placed at the top level.");
            normalized.children = normalizeBlocks(block.children, componentIds, componentById, state, depth + 1);
        } else if (block.type === "callFunction") {
            normalized.functionName = typeof block.functionName === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.functionName) ? block.functionName : "";
        } else if (block.type === "if") {
            const legacyType = ["servo", "motor"].includes(block.action) ? block.action :
                ["led", "buzzer"].includes(block.action) ? block.action : "";
            const migratedChildren = legacyType && block.outputId ? [{
                id: `${block.id}-action`,
                type: legacyType,
                componentId: block.outputId,
                value: Number.isFinite(block.value) ? block.value : legacyType === "servo" ? 90 : 160,
                enabled: block.enabled !== false,
                reverse: Boolean(block.reverse)
            }] : [];
            normalized.children = normalizeBlocks(Array.isArray(block.children) ? block.children : migratedChildren,
                componentIds, componentById, state, depth + 1);
            normalized.elseChildren = normalizeBlocks(block.elseChildren, componentIds, componentById, state, depth + 1);
        } else if (["repeat", "repeatUntil"].includes(block.type)) {
            normalized.value = clamp(Number.isFinite(block.value) ? block.value : 5, 1, 1000);
            normalized.children = normalizeBlocks(block.children, componentIds, componentById, state, depth + 1);
        } else if (block.type === "waitUntil") {
            normalized.timeout = clamp(Number.isFinite(block.timeout) ? block.timeout : 0, 0, 60000);
        } else if (block.type === "whenButtonPressed") {
            if (componentById.get(componentId)?.type !== "button") normalized.componentId = "";
            normalized.children = normalizeBlocks(block.children, componentIds, componentById, state, depth + 1);
        } else if (["servo", "motor"].includes(block.type)) {
            normalized.value = clamp(Number.isFinite(block.value) ? block.value : block.type === "servo" ? 90 : 160,
                0, block.type === "servo" ? 180 : 255);
            normalized.reverse = Boolean(block.reverse);
        } else if (["led", "buzzer"].includes(block.type)) {
            normalized.enabled = block.enabled !== false;
        } else if (block.type === "wait") {
            normalized.value = clamp(Number.isFinite(block.value) ? block.value : 500, 1, 60000);
        } else if (block.type === "print") {
            normalized.message = typeof block.message === "string" ? block.message.slice(0, 120) : "Hello from Smart Desk!";
        } else if (block.type === "read") {
            normalized.variable = typeof block.variable === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.variable) ? block.variable : "";
        } else if (["setVariable", "changeVariable"].includes(block.type)) {
            normalized.variable = typeof block.variable === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.variable)
                ? block.variable : "counter";
            normalized.value = clamp(Number.isFinite(block.value) ? block.value : 1, -32768, 32767);
            normalized.valueType = block.valueType === "variable" ? "variable" : "number";
            normalized.valueVariable = typeof block.valueVariable === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(block.valueVariable) ? block.valueVariable : "counter";
            normalized.operation = ["set", "add", "subtract", "multiply", "divide"].includes(block.operation)
                ? block.operation : block.type === "changeVariable" ? "add" : "set";
        }
        return normalized;
    });
}

function hasBuildToReplace() {
    if (project.components.length > 1 || (project.wires || []).length > 0 || (project.blocks || []).length > 0) return true;
    try {
        return codeEditor.value !== generateSketch(project.components);
    } catch {
        return true;
    }
}

function loadStarterTemplate() {
    const templateId = editor.querySelector("[data-robotics-template]").value;
    const template = starterTemplates[templateId];
    if (!template) {
        setStatus("Choose a starter example first.", true);
        return;
    }
    if (hasBuildToReplace() &&
        !window.confirm("Replace your current robotics workbench with this example? Your current project is saved only in this browser.")) return;
    stopSimulation();
    simulation.variables = Object.create(null);
    simulation.outputs = Object.create(null);
    simulation.logs = [];
    simulation.buttonState = Object.create(null);
    renderSimulationMonitor();
    project = {
        components: template.components.map((component) => ({ ...component })),
        wires: template.wires.map((wire) => ({ ...wire })),
        blocks: template.blocks.map((block) => structuredClone(block)),
        code: ""
    };
    try {
        project.code = generateBlockSketch(project.components, project.blocks);
    } catch (error) {
        setStatus(`Example loaded, but its sketch could not be generated: ${error.message}`, true);
        renderAll();
        return;
    }
    renderAll();
    if (!saveProject()) return;
    setStatus("Example loaded with a runnable block program and generated sketch. Simulation uses synthetic inputs; review wiring and power warnings before building.");
}

function exportProject() {
    const projectData = { ...project, code: codeEditor.value };
    const blob = new Blob([JSON.stringify({
        format: "smart-desk-robotics",
        version: 1,
        project: projectData
    }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smart-desk-robotics-project.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Project backup downloaded as JSON.");
}

async function importProject(file) {
    if (!file) return;
    if (file.size > MAX_PROJECT_BYTES) {
        setStatus("Project file is too large to import (maximum 2 MB).", true);
        return;
    }
    try {
        const parsed = JSON.parse(await file.text());
        if (parsed?.format && (parsed.format !== "smart-desk-robotics" || parsed.version !== 1)) {
            throw new Error("This file is not a supported Smart Desk robotics project.");
        }
        const imported = normalizeProject(parsed?.project || parsed);
        if (hasBuildToReplace() &&
            !window.confirm("Replace the current robotics workbench with the imported project?")) return;
        if (!imported.code) imported.code = generateSketch(imported.components);
        project = imported;
        renderAll();
        if (!saveProject()) return;
        setStatus("Project imported and saved on this device. Review its wiring before building.");
    } catch (error) {
        setStatus(`Could not import project: ${error.message}`, true);
    }
}

function saveProject() {
    project.code = codeEditor.value;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setStatus("Project saved on this device. Visual simulation only — no hardware is connected.");
        return true;
    } catch (error) {
        setStatus(`Could not save the robotics project: ${error.message}`, true);
        return false;
    }
}

function generateSketch(components) {
    const active = components.map((item) => ({ component: item, part: findPart(item.type) })).filter((item) => item.part);
    const ofType = (type) => active.filter(({ component }) => component.type === type);
    const getPins = (component) => {
        const pins = normalizedPins(component);
        if (!pins) throw new Error(`${findPart(component.type).name} has invalid pin assignments. Fix the wiring check before generating code.`);
        return pins.map(pinExpression);
    };
    const declarationGroups = [
        ["servo", (component, index) => `const byte servo${index}Pin = ${getPins(component)[0]};\nint servo${index}Angle = 90;`],
        ["ultrasonic", (component, index) => `const byte trigPin${index} = ${getPins(component)[0]};\nconst byte echoPin${index} = ${getPins(component)[1]};`],
        ["ir-sensor", (component, index) => `const byte irPin${index} = ${getPins(component)[0]};`],
        ["soil-moisture", (component, index) => `const byte moisturePin${index} = ${getPins(component)[0]};`],
        ["ldr", (component, index) => `const byte lightPin${index} = ${getPins(component)[0]};`],
        ["temperature", (component, index) => `const byte temperaturePin${index} = ${getPins(component)[0]};`],
        ["potentiometer", (component, index) => `const byte potentiometerPin${index} = ${getPins(component)[0]};`],
        ["rain-sensor", (component, index) => `const byte rainPin${index} = ${getPins(component)[0]};`],
        ["pir", (component, index) => `const byte pirPin${index} = ${getPins(component)[0]};`],
        ["button", (component, index) => `const byte buttonPin${index} = ${getPins(component)[0]};`],
        ["led", (component, index) => `const byte ledPin${index} = ${getPins(component)[0]};`],
        ["buzzer", (component, index) => `const byte buzzerPin${index} = ${getPins(component)[0]};`],
        ["dc-motor", (component, index) => {
            const [pwm, direction] = getPins(component);
            return `const byte motorPwmPin${index} = ${pwm};\nconst byte motorDirectionPin${index} = ${direction};`;
        }]
    ];
    const declarations = declarationGroups.flatMap(([type, create]) =>
        ofType(type).map(({ component }, index) => create(component, index + 1))
    ).join("\n");
    const sensorTypes = ["soil-moisture", "ldr", "temperature", "potentiometer", "rain-sensor", "ir-sensor", "pir", "button", "ultrasonic"];
    const hasSensorReadings = sensorTypes.some((type) => ofType(type).length > 0);
    const setup = [
        ...ofType("servo").map((_, index) => `  pinMode(servo${index + 1}Pin, OUTPUT);`),
        ...(hasSensorReadings ? ["  Serial.begin(9600);"] : []),
        ...ofType("ultrasonic").map((_, index) => `  pinMode(trigPin${index + 1}, OUTPUT);\n  pinMode(echoPin${index + 1}, INPUT);`),
        ...ofType("pir").map((_, index) => `  pinMode(pirPin${index + 1}, INPUT);`),
        ...ofType("ir-sensor").map((_, index) => `  pinMode(irPin${index + 1}, INPUT);`),
        ...ofType("button").map((_, index) => `  pinMode(buttonPin${index + 1}, INPUT_PULLUP);`),
        ...ofType("led").map((_, index) => `  pinMode(ledPin${index + 1}, OUTPUT);\n  digitalWrite(ledPin${index + 1}, LOW);`),
        ...ofType("buzzer").map((_, index) => `  pinMode(buzzerPin${index + 1}, OUTPUT);\n  digitalWrite(buzzerPin${index + 1}, LOW);`),
        ...ofType("dc-motor").map((_, index) => `  pinMode(motorPwmPin${index + 1}, OUTPUT);\n  pinMode(motorDirectionPin${index + 1}, OUTPUT);\n  analogWrite(motorPwmPin${index + 1}, 0);`)
    ].join("\n");
    const sensorReadings = [
        ...ofType("soil-moisture").map((_, index) => `  int moisture${index + 1} = analogRead(moisturePin${index + 1});`),
        ...ofType("soil-moisture").map((_, index) => `  Serial.print("Moisture ${index + 1}: "); Serial.println(moisture${index + 1});`),
        ...ofType("ldr").map((_, index) => `  int lightLevel${index + 1} = analogRead(lightPin${index + 1});`),
        ...ofType("ldr").map((_, index) => `  Serial.print("Light ${index + 1}: "); Serial.println(lightLevel${index + 1});`),
        ...ofType("temperature").map((_, index) => `  int temperatureReading${index + 1} = analogRead(temperaturePin${index + 1});`),
        ...ofType("temperature").map((_, index) => `  Serial.print("Temperature ADC ${index + 1}: "); Serial.println(temperatureReading${index + 1});`),
        ...ofType("potentiometer").map((_, index) => `  int potentiometerValue${index + 1} = analogRead(potentiometerPin${index + 1});`),
        ...ofType("potentiometer").map((_, index) => `  Serial.print("Potentiometer ${index + 1}: "); Serial.println(potentiometerValue${index + 1});`),
        ...ofType("rain-sensor").map((_, index) => `  int rainValue${index + 1} = analogRead(rainPin${index + 1});`),
        ...ofType("rain-sensor").map((_, index) => `  Serial.print("Rain sensor ${index + 1}: "); Serial.println(rainValue${index + 1});`),
        ...ofType("ir-sensor").map((_, index) => `  int obstacle${index + 1} = digitalRead(irPin${index + 1});`),
        ...ofType("ir-sensor").map((_, index) => `  Serial.print("IR raw ${index + 1}: "); Serial.println(obstacle${index + 1});`),
        ...ofType("pir").map((_, index) => `  int motion${index + 1} = digitalRead(pirPin${index + 1});`),
        ...ofType("pir").map((_, index) => `  Serial.print("Motion ${index + 1}: "); Serial.println(motion${index + 1});`),
        ...ofType("button").map((_, index) => `  bool buttonPressed${index + 1} = (digitalRead(buttonPin${index + 1}) == LOW);`),
        ...ofType("button").map((_, index) => `  Serial.print("Button ${index + 1}: "); Serial.println(buttonPressed${index + 1} ? "pressed" : "released");`),
        ...ofType("ultrasonic").flatMap((_, index) => [
            `  digitalWrite(trigPin${index + 1}, LOW);`,
            "  delayMicroseconds(2);",
            `  digitalWrite(trigPin${index + 1}, HIGH);`,
            "  delayMicroseconds(10);",
            `  digitalWrite(trigPin${index + 1}, LOW);`,
            `  unsigned long echoTime${index + 1} = pulseIn(echoPin${index + 1}, HIGH, 30000UL);`,
            `  if (echoTime${index + 1} == 0) {`,
            `    Serial.println("Ultrasonic ${index + 1}: no echo / out of range");`,
            "  } else {",
            `    float distanceCm${index + 1} = echoTime${index + 1} * 0.0343f / 2.0f;`,
            `    Serial.print("Distance ${index + 1} cm: "); Serial.println(distanceCm${index + 1});`,
            "  }"
        ])
    ].join("\n");
    const servoHelper = ofType("servo").length
        ? "void writeServoAngle(byte pin, int angle) {\n  int pulseUs = map(constrain(angle, 0, 180), 0, 180, 544, 2400);\n  digitalWrite(pin, HIGH);\n  delayMicroseconds(pulseUs);\n  digitalWrite(pin, LOW);\n}\n\n"
        : "";
    const loop = [
        ...ofType("servo").map((_, index) => `  writeServoAngle(servo${index + 1}Pin, servo${index + 1}Angle);`),
        ...(hasSensorReadings ? [
            "  if (millis() - lastSensorReportMs >= 250UL) {",
            "    lastSensorReportMs = millis();",
            sensorReadings,
            "  }"
        ] : []),
        "  delay(18);"
    ].join("\n");
    const reportClock = hasSensorReadings ? "unsigned long lastSensorReportMs = 0;\n\n" : "";
    return `${reportClock}${declarations ? `${declarations}\n\n` : ""}${servoHelper}void setup() {\n${setup || "  // Configure your pins here."}\n}\n\nvoid loop() {\n${loop}\n}\n`;
}

function generateBlockSketch(components, blocks) {
    if (!blocks.length) return generateSketch(components);
    validateBlockFunctions(blocks);
    const componentPins = new Map();
    const pinDeclarations = [];
    for (const [index, component] of components.entries()) {
        const part = findPart(component.type);
        if (!part || !requiredPinCount(component.type)) continue;
        const pins = normalizedPins(component);
        if (!pins) throw new Error(`${part.name} has an invalid pin assignment. Fix Wiring check before generating code.`);
        const names = pins.map((pin, pinIndex) => `part${index}Pin${pinIndex}`);
        names.forEach((name, pinIndex) => pinDeclarations.push(`const byte ${name} = ${pinExpression(pins[pinIndex])};`));
        componentPins.set(component.id, { component, names });
    }
    const getPart = (id, expectedTypes, label) => {
        const entry = componentPins.get(id);
        if (!entry || !expectedTypes.includes(entry.component.type)) {
            throw new Error(`Choose a placed ${label} for this block.`);
        }
        return entry;
    };
    const sensorExpression = (entry) => {
        const { component, names } = entry;
        if (component.type === "ultrasonic") return `readDistanceCm(${names[0]}, ${names[1]})`;
        if (["soil-moisture", "ldr", "temperature", "potentiometer", "rain-sensor"].includes(component.type)) {
            return `analogRead(${names[0]})`;
        }
        if (component.type === "button") return `(digitalRead(${names[0]}) == LOW)`;
        return `digitalRead(${names[0]})`;
    };
    const setupPins = new Set();
    let needsSerial = false;
    let needsServoHelper = false;
    let needsDistanceHelper = false;
    let repeatCounter = 0;
    let reportCounter = 0;
    let eventCounter = 0;
    const reportTimers = [];
    const variables = new Set();
    const collectVariables = (items) => items.forEach((block) => {
        if (["setVariable", "changeVariable"].includes(block.type)) {
            variables.add(block.variable || "counter");
            if (block.valueType === "variable") variables.add(block.valueVariable || "counter");
        }
        if (block.type === "read" && block.variable) variables.add(block.variable);
        if (["if", "waitUntil", "repeat", "repeatUntil", "whenButtonPressed", "whenStarted", "defineFunction"].includes(block.type)) {
            if (block.leftType === "variable") variables.add(block.variable || "counter");
            if (block.rightType === "variable") variables.add(block.rightVariable || "counter");
            if (block.useSecondCondition && block.secondLeftType === "variable") variables.add(block.secondVariable || "counter");
            if (block.useSecondCondition && block.secondRightType === "variable") variables.add(block.secondRightVariable || "counter");
            collectVariables(block.children || []);
            if (block.type === "if") collectVariables(block.elseChildren || []);
        }
    });
    collectVariables(blocks);
    const variableNames = new Map([...variables].map((name) => [name, `userVar_${name}`]));
    const configureSensor = (entry) => {
        const { component, names } = entry;
        if (component.type === "ultrasonic") {
            setupPins.add(`pinMode(${names[0]}, OUTPUT);`);
            setupPins.add(`pinMode(${names[1]}, INPUT);`);
            needsDistanceHelper = true;
        } else if (component.type === "button") setupPins.add(`pinMode(${names[0]}, INPUT_PULLUP);`);
        else if (["ir-sensor", "pir"].includes(component.type)) setupPins.add(`pinMode(${names[0]}, INPUT);`);
    };
    const outputAction = (action, entry, value, reverse = false) => {
        const { names } = entry;
        if (action === "servo") {
            needsServoHelper = true;
            setupPins.add(`pinMode(${names[0]}, OUTPUT);`);
            return `writeServoAngle(${names[0]}, ${clamp(value, 0, 180)});`;
        }
        if (action === "led" || action === "buzzer") {
            setupPins.add(`pinMode(${names[0]}, OUTPUT);`);
            return `digitalWrite(${names[0]}, ${value ? "HIGH" : "LOW"});`;
        }
        setupPins.add(`pinMode(${names[0]}, OUTPUT);`);
        setupPins.add(`pinMode(${names[1]}, OUTPUT);`);
        return `digitalWrite(${names[1]}, ${reverse ? "HIGH" : "LOW"});\nanalogWrite(${names[0]}, ${clamp(value, 0, 255)});`;
    };
    const emitAction = (lines, indent, action, entry, value, reverse = false) => {
        outputAction(action, entry, value, reverse).split("\n")
            .forEach((line) => lines.push(`${indent}${line}`));
    };
    const operandExpression = (block, second = false) => {
        const useVariable = second
            ? block.secondLeftType === "variable"
            : block.leftType === "variable";
        const variable = second ? block.secondVariable : block.variable;
        const componentId = second ? block.secondComponentId : block.componentId;
        const entry = useVariable
            ? null
            : getPart(componentId, sensorTypes, "sensor");
        if (entry) configureSensor(entry);
        const left = useVariable
            ? variableNames.get(variable || "counter")
            : sensorExpression(entry);
        const rightIsVariable = second ? block.secondRightType === "variable" : block.rightType === "variable";
        const rightVariable = second ? block.secondRightVariable : block.rightVariable;
        const number = second ? block.secondThreshold : block.threshold;
        return [left, rightIsVariable ? (variableNames.get(rightVariable || "counter") || "userVar_counter") : String(number)];
    };
    const conditionExpression = (block) => {
        const [left, right] = operandExpression(block);
        const first = `(${left} ${block.operator} ${right})`;
        if (!block.useSecondCondition) return first;
        const [secondLeft, secondRight] = operandExpression(block, true);
        return `(${first} ${block.logic === "OR" ? "||" : "&&"} (${secondLeft} ${block.secondOperator} ${secondRight}))`;
    };
    const emitBlocks = (items, indentLevel = 1) => {
        const indent = "  ".repeat(indentLevel);
        const lines = [];
        for (const block of items) {
            if (block.type === "defineFunction" || block.type === "whenStarted") {
                continue;
            } else if (block.type === "callFunction") {
                if (!block.functionName) throw new Error("Choose a custom block to run.");
                lines.push(`${indent}userFn_${block.functionName}();`);
            } else if (block.type === "read") {
                const entry = getPart(block.componentId, sensorTypes, "sensor");
                configureSensor(entry);
                needsSerial = true;
                const timer = `lastBlockReportMs${++reportCounter}`;
                reportTimers.push(`unsigned long ${timer} = 0;`);
                lines.push(`${indent}if (millis() - ${timer} >= 250UL) {`);
                lines.push(`${indent}  ${timer} = millis();`);
                if (block.variable) lines.push(`${indent}  ${variableNames.get(block.variable)} = ${sensorExpression(entry)};`);
                lines.push(`${indent}  Serial.print(F(${JSON.stringify(findPart(entry.component.type).name + ": ")}));`);
                lines.push(`${indent}  Serial.println(${sensorExpression(entry)});`);
                lines.push(`${indent}}`);
            } else if (block.type === "if") {
                lines.push(`${indent}if ${conditionExpression(block)} {`);
                lines.push(...emitBlocks(block.children || [], indentLevel + 1));
                if (block.elseChildren?.length) {
                    lines.push(`${indent}} else {`);
                    lines.push(...emitBlocks(block.elseChildren, indentLevel + 1));
                }
                lines.push(`${indent}}`);
            } else if (block.type === "waitUntil") {
                const waitStarted = `waitStarted${++reportCounter}`;
                reportTimers.push(`unsigned long ${waitStarted} = 0;`);
                lines.push(`${indent}${waitStarted} = millis();`);
                lines.push(`${indent}while (!${conditionExpression(block)}${block.timeout > 0 ? ` && millis() - ${waitStarted} < ${clamp(block.timeout, 1, 60000)}UL` : ""}) {`);
                lines.push(`${indent}  delay(10);`);
                lines.push(`${indent}}`);
            } else if (block.type === "repeat") {
                const repeatIndex = `repeatIndex${++repeatCounter}`;
                lines.push(`${indent}for (unsigned int ${repeatIndex} = 0; ${repeatIndex} < ${clamp(block.value, 1, 1000)}; ${repeatIndex}++) {`);
                lines.push(...emitBlocks(block.children || [], indentLevel + 1));
                lines.push(`${indent}}`);
            } else if (block.type === "repeatUntil") {
                lines.push(`${indent}do {`);
                lines.push(...emitBlocks(block.children || [], indentLevel + 1));
                lines.push(`${indent}} while (!${conditionExpression(block)});`);
            } else if (block.type === "whenButtonPressed") {
                const entry = getPart(block.componentId, ["button"], "push button");
                configureSensor(entry);
                const wasPressed = `buttonWasPressed${++eventCounter}`;
                reportTimers.push(`bool ${wasPressed} = false;`);
                lines.push(`${indent}if (digitalRead(${entry.names[0]}) == LOW && !${wasPressed}) {`);
                lines.push(`${indent}  ${wasPressed} = true;`);
                lines.push(...emitBlocks(block.children || [], indentLevel + 1));
                lines.push(`${indent}} else if (digitalRead(${entry.names[0]}) == HIGH) {`);
                lines.push(`${indent}  ${wasPressed} = false;`);
                lines.push(`${indent}}`);
            } else if (block.type === "servo") {
                emitAction(lines, indent, "servo", getPart(block.componentId, ["servo"], "servo"), block.value);
            } else if (block.type === "led" || block.type === "buzzer") {
                emitAction(lines, indent, block.type, getPart(block.componentId, [block.type], block.type), block.enabled);
            } else if (block.type === "motor") {
                emitAction(lines, indent, "motor", getPart(block.componentId, ["dc-motor"], "motor driver"), block.value, block.reverse);
            } else if (block.type === "wait") {
                lines.push(`${indent}delay(${clamp(block.value, 1, 60000)}UL);`);
            } else if (block.type === "print") {
                needsSerial = true;
                const timer = `lastBlockReportMs${++reportCounter}`;
                reportTimers.push(`unsigned long ${timer} = 0;`);
                lines.push(`${indent}if (millis() - ${timer} >= 250UL) {`);
                lines.push(`${indent}  ${timer} = millis();`);
                lines.push(`${indent}  Serial.println(F(${JSON.stringify(block.message)}));`);
                lines.push(`${indent}}`);
            } else if (block.type === "setVariable") {
                const operand = block.valueType === "variable"
                    ? (variableNames.get(block.valueVariable) || "userVar_counter") : String(block.value);
                const target = variableNames.get(block.variable);
                const operation = block.operation || "set";
                if (operation === "divide") lines.push(`${indent}if (${operand} != 0) ${target} /= ${operand};`);
                else lines.push(`${indent}${target} ${operation === "set" ? "=" : operation === "add" ? "+=" : operation === "subtract" ? "-=" : "*="} ${operand};`);
            } else if (block.type === "changeVariable") {
                const operand = block.valueType === "variable"
                    ? (variableNames.get(block.valueVariable) || "userVar_counter") : String(block.value);
                const target = variableNames.get(block.variable);
                const operation = block.operation === "set" ? "=" : block.operation === "subtract" ? "-=" : block.operation === "multiply" ? "*=" : block.operation === "divide" ? "/=" : "+=";
                if (operation === "/=") lines.push(`${indent}if (${operand} != 0) ${target} /= ${operand};`);
                else lines.push(`${indent}${target} ${operation} ${operand};`);
            }
        }
        return lines;
    };
    const startupLines = emitBlocks(blocks.filter((block) => block.type === "whenStarted")
        .flatMap((block) => block.children));
    const loopLines = emitBlocks(blocks.filter((block) => block.type !== "whenStarted"));
    const functionBlocks = blocks.filter((block) => block.type === "defineFunction");
    const functionCode = functionBlocks.flatMap((block) => {
        const body = emitBlocks(block.children, 1);
        return [`void userFn_${block.functionName}() {`, ...(body.length ? body : ["  // Add steps to this custom block."]), "}"];
    });
    const functionPrototypes = functionBlocks.map((block) => `void userFn_${block.functionName}();`);
    const helpers = [];
    if (needsServoHelper) helpers.push(
        "void writeServoAngle(byte pin, int angle) {\n" +
        "  int pulseUs = map(constrain(angle, 0, 180), 0, 180, 544, 2400);\n" +
        "  digitalWrite(pin, HIGH);\n  delayMicroseconds(pulseUs);\n  digitalWrite(pin, LOW);\n}"
    );
    if (needsDistanceHelper) helpers.push(
        "float readDistanceCm(byte trigPin, byte echoPin) {\n" +
        "  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n" +
        "  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n" +
        "  digitalWrite(trigPin, LOW);\n" +
        "  unsigned long echoTime = pulseIn(echoPin, HIGH, 30000UL);\n" +
        "  return echoTime == 0 ? 999.0f : echoTime * 0.0343f / 2.0f;\n}"
    );
    const setupLines = [...(needsSerial ? ["Serial.begin(9600);"] : []), ...setupPins].map((line) => `  ${line}`);
    setupLines.push(...startupLines);
    const setup = setupLines.join("\n");
    const loop = loopLines.join("\n");
    const globals = [...pinDeclarations, ...[...variableNames.values()].map((name) => `long ${name} = 0;`), ...reportTimers];
    return `${globals.join("\n")}${globals.length ? "\n\n" : ""}` +
        `${helpers.length ? `${helpers.join("\n\n")}\n\n` : ""}` +
        `${functionPrototypes.length ? `${functionPrototypes.join("\n")}\n\n` : ""}` +
        `${functionCode.length ? `${functionCode.join("\n")}\n\n` : ""}` +
        `void setup() {\n${setup || "  // No setup blocks required."}\n}\n\n` +
        `void loop() {\n${loop || "  // Add blocks to define the repeated program."}\n  delay(10);\n}\n`;
}

function componentOptions(types) {
    return project.components.filter((component) => types.includes(component.type));
}

function blockSelect(block, property, choices, placeholder, labelText, formatPart = null) {
    const select = document.createElement("select");
    select.dataset.blockId = block.id;
    select.dataset.blockProperty = property;
    select.setAttribute("aria-label", labelText);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.append(empty);
    for (const choice of choices) {
        const option = document.createElement("option");
        option.value = choice.id;
        option.textContent = formatPart ? formatPart(choice) : findPart(choice.type).name;
        select.append(option);
    }
    select.value = block[property] || "";
    return select;
}

function blockNumber(block, property, labelText, min, max, suffix = "") {
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(block[property]);
    input.dataset.blockId = block.id;
    input.dataset.blockProperty = property;
    input.setAttribute("aria-label", labelText);
    if (suffix) input.dataset.suffix = suffix;
    return input;
}

function blockChoice(block, property, values, labelText) {
    const select = document.createElement("select");
    select.dataset.blockId = block.id;
    select.dataset.blockProperty = property;
    select.setAttribute("aria-label", labelText);
    for (const [value, label] of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
    }
    select.value = String(block[property]);
    return select;
}

function blockText(block, property, labelText, maxLength = 24) {
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = maxLength;
    input.value = block[property] || "";
    input.dataset.blockId = block.id;
    input.dataset.blockProperty = property;
    input.setAttribute("aria-label", labelText);
    return input;
}

function renderComparison(block, fields, prefix = "", second = false) {
    const property = (name) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
    fields.append(blockChoice(block, property("leftType"), [["sensor", "sensor"], ["variable", "variable"]], "Left side type"));
    if (block[property("leftType")] === "variable") {
        fields.append(blockText(block, property("variable"), "Variable to compare"));
    } else {
        fields.append(blockSelect(block, property("componentId"),
            componentOptions(sensorTypes), "choose sensor", "Sensor to compare"));
    }
    fields.append(blockChoice(block, property("operator"),
        comparisonOperators.map((operator) => [operator, operator]), "Comparison operator"));
    fields.append(blockChoice(block, property("rightType"), [["number", "number"], ["variable", "variable"]], "Right side type"));
    if (block[property("rightType")] === "variable") {
        fields.append(blockText(block, property("rightVariable"), "Right-side variable"));
    } else {
        const sensor = project.components.find((component) => component.id === block[property("componentId")]);
        const minimum = block[property("leftType")] === "variable" ? -32768 : 0;
        const maximum = block[property("leftType")] === "variable" ? 32767 : sensorThresholdMax(sensor?.type);
        fields.append(blockNumber(block, property("threshold"), "Comparison number", minimum, maximum));
    }
}

function renderBlockStack() {
    blockStack.replaceChildren();
    renderBlockArray(blockStack, project.blocks, null, null);
}

function addAccessibleBlockControls(container, ownerId, branch) {
    const row = document.createElement("div");
    row.className = "robotics-block-insert-row";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Block to add");
    for (const [type, title] of Object.entries(blockTitles)) {
        if (ownerId && ["defineFunction", "whenStarted"].includes(type)) continue;
        const option = document.createElement("option");
        option.value = type;
        option.textContent = title;
        select.append(option);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Add block";
    button.dataset.addToStack = "";
    button.dataset.blockType = select.value;
    button.dataset.blockOwner = ownerId || "";
    button.dataset.blockBranch = branch || "";
    select.addEventListener("change", () => { button.dataset.blockType = select.value; });
    row.append(select, button);
    container.append(row);
}

function renderBlockArray(container, blocks, ownerId, branch) {
    if (ownerId) {
        container.dataset.blockOwner = ownerId;
        container.dataset.blockBranch = branch;
    }
    blocks.forEach((block, index) => {
        const card = document.createElement("article");
        card.className = `robotics-code-block robotics-code-block-${block.type}`;
        card.draggable = true;
        card.tabIndex = 0;
        card.dataset.blockId = block.id;
        card.setAttribute("aria-label", `${blockTitles[block.type]} block. Drag to move.`);
        const head = document.createElement("div");
        head.className = "robotics-code-block-head";
        const title = document.createElement("strong");
        title.textContent = ({
            read: "read", if: "if", repeat: "repeat", repeatUntil: "repeat until",
            waitUntil: "wait until", whenButtonPressed: "when pressed", whenStarted: "when started",
            defineFunction: "define custom", callFunction: "run custom",
            servo: "set", led: "set",
            buzzer: "set", motor: "set", wait: "wait", print: "print",
            setVariable: "set", changeVariable: "change"
        })[block.type];
        const handle = document.createElement("span");
        handle.className = "robotics-block-icon";
        handle.textContent = ({
            read: "◉", if: "◆", repeat: "↻", repeatUntil: "↻", waitUntil: "◷",
            whenButtonPressed: "●", whenStarted: "⚑", defineFunction: "ƒ", callFunction: "ƒ",
            servo: "↻", led: "●",
            buzzer: "♫", motor: "⚙", wait: "◷", print: "▤",
            setVariable: "x", changeVariable: "x"
        })[block.type];
        handle.setAttribute("aria-hidden", "true");
        const controls = document.createElement("div");
        controls.className = "robotics-block-order";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.dataset.blockAction = "remove";
        remove.dataset.blockId = block.id;
        remove.setAttribute("aria-label", `Remove ${blockTitles[block.type]} block`);
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "↑";
        up.dataset.blockAction = "up";
        up.dataset.blockId = block.id;
        up.disabled = index === 0;
        up.setAttribute("aria-label", `Move ${blockTitles[block.type]} block up`);
        const down = document.createElement("button");
        down.type = "button";
        down.textContent = "↓";
        down.dataset.blockAction = "down";
        down.dataset.blockId = block.id;
        down.disabled = index === blocks.length - 1;
        down.setAttribute("aria-label", `Move ${blockTitles[block.type]} block down`);
        controls.append(up, down, remove);
        head.append(handle, title, controls);
        card.append(head);
        const fields = document.createElement("div");
        fields.className = "robotics-code-block-fields";
        const sensorChoices = componentOptions(sensorTypes);
        if (block.type === "read") {
            const sentence = document.createElement("span");
            sentence.textContent = "read";
            fields.append(sentence, blockSelect(block, "componentId", sensorChoices, "choose sensor", "Sensor for read block"),
                document.createTextNode("into"), blockText(block, "variable", "Variable to store sensor reading"));
        } else if (block.type === "defineFunction" || block.type === "whenStarted") {
            if (block.type === "defineFunction") {
                fields.append(document.createTextNode("name"), blockText(block, "functionName", "Custom block name"));
            }
            const body = document.createElement("div");
            body.className = "robotics-if-body robotics-repeat-body";
            const label = document.createElement("span");
            label.textContent = block.type === "defineFunction"
                ? "custom steps · drag blocks here"
                : "run once at startup · drag blocks here";
            const childStack = document.createElement("div");
            childStack.className = "robotics-nested-block-stack";
            body.append(label, childStack);
            renderBlockArray(childStack, block.children, block.id, "children");
            fields.append(body);
        } else if (block.type === "callFunction") {
            const choices = project.blocks.filter((item) => item.type === "defineFunction")
                .map((item) => ({ id: item.functionName, name: item.functionName }));
            fields.append(document.createTextNode("run"),
                blockSelect(block, "functionName", choices, "choose custom block", "Custom block to run", (choice) => choice.name));
        } else if (block.type === "if") {
            renderComparison(block, fields);
            const second = document.createElement("input");
            second.type = "checkbox";
            second.checked = block.useSecondCondition;
            second.dataset.blockId = block.id;
            second.dataset.blockProperty = "useSecondCondition";
            second.setAttribute("aria-label", "Add a second condition");
            fields.append(second, document.createTextNode("also check"));
            if (block.useSecondCondition) {
                fields.append(blockChoice(block, "logic", [["AND", "AND"], ["OR", "OR"]], "Combine conditions using"));
                renderComparison(block, fields, "second");
            }
            const then = document.createElement("div");
            then.className = "robotics-if-body";
            const thenLabel = document.createElement("span");
            thenLabel.textContent = "then · drag blocks here";
            then.append(thenLabel);
            const thenStack = document.createElement("div");
            thenStack.className = "robotics-nested-block-stack";
            then.append(thenStack);
            renderBlockArray(thenStack, block.children, block.id, "children");
            fields.append(then);
            const otherwise = document.createElement("div");
            otherwise.className = "robotics-if-body robotics-else-body";
            const elseLabel = document.createElement("span");
            elseLabel.textContent = "else · optional";
            otherwise.append(elseLabel);
            const elseStack = document.createElement("div");
            elseStack.className = "robotics-nested-block-stack";
            otherwise.append(elseStack);
            renderBlockArray(elseStack, block.elseChildren, block.id, "elseChildren");
            fields.append(otherwise);
        } else if (["repeat", "repeatUntil"].includes(block.type)) {
            if (block.type === "repeatUntil") renderComparison(block, fields);
            else fields.append(document.createTextNode("times"), blockNumber(block, "value", "Repeat count", 1, 1000));
            const body = document.createElement("div");
            body.className = "robotics-if-body robotics-repeat-body";
            const label = document.createElement("span");
            label.textContent = block.type === "repeat" ? "do · drag blocks here" : "until condition · repeat body";
            const childStack = document.createElement("div");
            childStack.className = "robotics-nested-block-stack";
            body.append(label, childStack);
            renderBlockArray(childStack, block.children, block.id, "children");
            fields.append(body);
        } else if (block.type === "waitUntil") {
            renderComparison(block, fields);
            fields.append(document.createTextNode("timeout ms (0 = wait forever)"),
                blockNumber(block, "timeout", "Wait-until timeout in milliseconds", 0, 60000));
        } else if (block.type === "whenButtonPressed") {
            fields.append(blockSelect(block, "componentId", componentOptions(["button"]),
                "choose button", "Button event source"));
            const body = document.createElement("div");
            body.className = "robotics-if-body robotics-repeat-body";
            const label = document.createElement("span");
            label.textContent = "on press · drag blocks here";
            const childStack = document.createElement("div");
            childStack.className = "robotics-nested-block-stack";
            body.append(label, childStack);
            renderBlockArray(childStack, block.children, block.id, "children");
            fields.append(body);
        } else if (block.type === "servo" || block.type === "led" || block.type === "buzzer" || block.type === "motor") {
            const types = { servo: ["servo"], led: ["led"], buzzer: ["buzzer"], motor: ["dc-motor"] }[block.type];
            const sentence = document.createElement("span");
            sentence.textContent = block.type === "servo" ? "servo" : block.type === "motor" ? "motor" : block.type;
            fields.append(sentence, blockSelect(block, "componentId", componentOptions(types), `choose ${block.type}`, `${block.type} component`));
            if (block.type === "servo" || block.type === "motor") {
                const suffix = document.createElement("span");
                suffix.textContent = block.type === "servo" ? "angle to" : "speed to";
                fields.append(suffix, blockNumber(block, "value", block.type === "servo" ? "Servo angle" : "Motor speed", 0, block.type === "servo" ? 180 : 255));
            }
            if (block.type === "motor") {
                fields.append(blockChoice(block, "reverse", [["false", "forward"], ["true", "reverse"]], "Motor direction"));
            }
            if (block.type === "led" || block.type === "buzzer") {
                fields.append(blockChoice(block, "enabled", [["true", "on"], ["false", "off"]], `${block.type} state`));
            }
        } else if (block.type === "wait") {
            fields.append(document.createTextNode("for"), blockNumber(block, "value", "Wait duration in milliseconds", 1, 60000), document.createTextNode("milliseconds"));
        } else if (block.type === "print") {
            const input = document.createElement("input");
            input.type = "text";
            input.maxLength = 120;
            input.value = block.message;
            input.dataset.blockId = block.id;
            input.dataset.blockProperty = "message";
            input.setAttribute("aria-label", "Text to print to Serial Monitor");
            fields.append(document.createTextNode("to Serial Monitor"), input);
        } else if (block.type === "setVariable" || block.type === "changeVariable") {
            fields.append(blockText(block, "variable", "Arduino variable name"),
                blockChoice(block, "operation", [["set", "set"], ["add", "add"], ["subtract", "subtract"], ["multiply", "multiply"], ["divide", "divide"]], "Math operation"),
                blockChoice(block, "valueType", [["number", "number"], ["variable", "variable"]], "Value source"));
            if (block.valueType === "variable") fields.append(blockText(block, "valueVariable", "Variable value"));
            else fields.append(blockNumber(block, "value", "Numeric value", -32768, 32767));
        }
        card.append(fields);
        container.append(card);
    });
    addAccessibleBlockControls(container, ownerId, branch);
}

function regenerateFromBlocks() {
    try {
        const blockingWarnings = getWiringWarnings().filter((warning) =>
            /valid Uno pin|analog output|PWM pin|both use|USB serial connection/.test(warning)
        );
        if (blockingWarnings.length) throw new Error("Fix the pin errors in Wiring check before generating the sketch.");
        codeEditor.value = generateBlockSketch(project.components, project.blocks);
        project.code = codeEditor.value;
        saveProject();
        setStatus(project.blocks.length
                ? "Arduino sketch generated from your blocks. Run simulation executes the block program, not this C++."
            : "No code blocks yet; generated the parts-based starter sketch.");
    } catch (error) {
        saveProject();
        setStatus(`Block program saved, but code could not be generated: ${error.message}`, true);
    }
}

function defaultCodeBlock(type) {
    const sensor = componentOptions(sensorTypes)[0];
    const condition = {
        leftType: "sensor", componentId: sensor?.id || "", variable: "counter",
        operator: "<", rightType: "number", rightVariable: "counter",
        threshold: sensorThresholdMax(sensor?.type) === 1 ? 1 : 30,
        useSecondCondition: false, secondComponentId: sensor?.id || "",
        secondLeftType: "sensor", secondVariable: "counter", secondOperator: "<",
        secondRightType: "number", secondRightVariable: "counter", secondThreshold: 30, logic: "AND"
    };
    const functionNames = project.blocks.filter((block) => block.type === "defineFunction")
        .map((block) => block.functionName);
    let functionName = "myBlock";
    let suffix = 2;
    while (functionNames.includes(functionName)) functionName = `myBlock${suffix++}`;
    const defaults = {
        read: { componentId: sensor?.id || "", variable: "" },
        if: { ...condition, children: [], elseChildren: [] },
        repeat: { value: 5, children: [] },
        repeatUntil: { ...condition, children: [] },
        waitUntil: { ...condition, timeout: 0 },
        whenButtonPressed: { componentId: componentOptions(["button"])[0]?.id || "", children: [] },
        whenStarted: { children: [] },
        defineFunction: { functionName, children: [] },
        callFunction: { functionName: functionNames[0] || "" },
        servo: { componentId: componentOptions(["servo"])[0]?.id || "", value: 90 },
        led: { componentId: componentOptions(["led"])[0]?.id || "", enabled: true },
        buzzer: { componentId: componentOptions(["buzzer"])[0]?.id || "", enabled: true },
        motor: { componentId: componentOptions(["dc-motor"])[0]?.id || "", value: 160, reverse: false },
        wait: { value: 500 },
        print: { message: "Hello from Smart Desk!" },
        setVariable: { variable: "counter", operation: "set", valueType: "number", valueVariable: "counter", value: 0 },
        changeVariable: { variable: "counter", operation: "add", valueType: "number", valueVariable: "counter", value: 1 }
    }[type];
    return { id: makeBlockId(), type, ...defaults };
}

function countBlocks(items) {
    return items.reduce((count, block) => count + 1 +
        (block.children ? countBlocks(block.children) : 0) +
        (block.elseChildren ? countBlocks(block.elseChildren) : 0), 0);
}

function findBlockLocation(id, items = project.blocks) {
    for (let index = 0; index < items.length; index += 1) {
        const block = items[index];
        if (block.id === id) return { list: items, index, block };
        for (const childList of [block.children, block.elseChildren]) {
            if (!childList) continue;
            const found = findBlockLocation(id, childList);
            if (found) return found;
        }
    }
    return null;
}

function getBlockList(ownerId, branch) {
    if (!ownerId) return project.blocks;
    const owner = findBlockLocation(ownerId)?.block;
    if (!owner || !["children", "elseChildren"].includes(branch) ||
        !Array.isArray(owner[branch])) return null;
    return owner[branch];
}

function getBlockListDepth(targetList, items = project.blocks, depth = 0) {
    if (items === targetList) return depth;
    for (const block of items) {
        for (const childList of [block.children, block.elseChildren]) {
            if (!childList) continue;
            const found = getBlockListDepth(targetList, childList, depth + 1);
            if (found !== -1) return found;
        }
    }
    return -1;
}

function findContainingFunction(targetList, items = project.blocks, owner = null) {
    if (items === targetList) return owner;
    for (const block of items) {
        if (!block.children) continue;
        const found = findContainingFunction(block.children, targetList,
            block.type === "defineFunction" ? block : owner);
        if (found) return found;
        if (block.elseChildren) {
            const elseFound = findContainingFunction(block.elseChildren, targetList,
                block.type === "defineFunction" ? block : owner);
            if (elseFound) return elseFound;
        }
    }
    return null;
}

function getControlDepth(block) {
    const childDepth = [block.children, block.elseChildren].filter(Array.isArray)
        .flatMap((children) => children.map(getControlDepth));
    return (["if", "repeat", "repeatUntil", "whenButtonPressed", "whenStarted", "defineFunction"].includes(block.type) ? 1 : 0) + Math.max(0, ...childDepth);
}

function addCodeBlock(type, insertionIndex, targetList = project.blocks) {
    if (!Object.hasOwn(blockTitles, type)) return;
    if (["defineFunction", "whenStarted"].includes(type) && targetList !== project.blocks) {
        setStatus("Custom block definitions and start-event scripts must be at the top level.", true);
        return;
    }
    if (countBlocks(project.blocks) >= 100) {
        setStatus("A program can contain up to 100 blocks.", true);
        return;
    }
    const depth = getBlockListDepth(targetList);
    if (depth < 0 || (["if", "repeat", "repeatUntil", "whenButtonPressed", "whenStarted", "defineFunction"].includes(type) && depth >= 8)) {
        setStatus("Control blocks can be nested up to 8 levels deep.", true);
        return;
    }
    const insertAt = Number.isInteger(insertionIndex) ? insertionIndex : targetList.length;
    const block = defaultCodeBlock(type);
    if (type === "callFunction") {
        const owner = findContainingFunction(targetList);
        const available = project.blocks.filter((item) => item.type === "defineFunction" &&
            item.functionName !== owner?.functionName);
        block.functionName = available[0]?.functionName || "";
    }
    targetList.splice(clamp(insertAt, 0, targetList.length), 0, block);
    if (type === "callFunction" && block.functionName) {
        try {
            validateBlockFunctions(project.blocks);
        } catch (error) {
            block.functionName = "";
            setStatus(`Choose a non-recursive custom block: ${error.message}`, true);
        }
    }
    renderBlockStack();
    regenerateFromBlocks();
}

function updateBlockFromField(field) {
    const block = findBlockLocation(field.dataset.blockId)?.block;
    if (!block) return;
    const property = field.dataset.blockProperty;
    const previousValue = block[property];
    if (["value", "threshold", "secondThreshold", "timeout"].includes(property)) {
        const value = Number(field.value);
        if (!Number.isFinite(value)) return;
        const second = property === "secondThreshold";
        const sensorId = second ? block.secondComponentId : block.componentId;
        const sensor = project.components.find((component) => component.id === sensorId);
        const leftType = second ? block.secondLeftType : block.leftType;
        const maximum = property === "threshold" || second
            ? leftType === "variable" ? 32767 : sensorThresholdMax(sensor?.type)
            : property === "timeout" ? 60000
                : block.type === "wait" ? 60000
                : block.type === "repeat" ? 1000
                    : block.type === "servo" ? 180 : 32767;
        const minimum = property === "timeout" ? 0
            : property === "value" && ["wait", "repeat"].includes(block.type) ? 1
                : property === "value" && block.type === "changeVariable" ? -32768
                    : property === "threshold" && leftType === "variable" ? -32768
                        : second && block.secondLeftType === "variable" ? -32768 : 0;
        block[property] = clamp(value, minimum, maximum);
    } else if (["enabled", "reverse", "useSecondCondition"].includes(property)) block[property] = field.type === "checkbox" ? field.checked : field.value === "true";
    else if (["variable", "secondVariable", "rightVariable", "secondRightVariable", "valueVariable"].includes(property)) {
        if (block.type === "read" && property === "variable" && !field.value) {
            block[property] = "";
        } else if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(field.value)) {
            setStatus("Variable names must start with a letter or underscore and contain only letters, numbers, and underscores.", true);
            return;
        } else {
            block[property] = field.value;
        }
    } else if (property === "functionName") {
        if (block.type === "defineFunction" && !/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(field.value)) {
            setStatus("Custom block names must start with a letter or underscore and contain only letters, numbers, and underscores.", true);
            return;
        }
        block[property] = field.value;
        if (block.type === "defineFunction") {
            const duplicate = project.blocks.some((candidate) =>
                candidate !== block && candidate.type === "defineFunction" && candidate.functionName === field.value);
            if (duplicate) {
                block[property] = previousValue;
                setStatus("Custom block names must be unique.", true);
                renderBlockStack();
                return;
            }
            const renameCalls = (items) => items.forEach((candidate) => {
                if (candidate.type === "callFunction" && candidate.functionName === previousValue) candidate.functionName = field.value;
                renameCalls(candidate.children || []);
                renameCalls(candidate.elseChildren || []);
            });
            renameCalls(project.blocks);
        }
        try {
            validateBlockFunctions(project.blocks);
        } catch (error) {
            block[property] = previousValue;
            if (block.type === "defineFunction") {
                const undoCalls = (items) => items.forEach((candidate) => {
                    if (candidate.type === "callFunction" && candidate.functionName === field.value) candidate.functionName = previousValue;
                    undoCalls(candidate.children || []);
                    undoCalls(candidate.elseChildren || []);
                });
                undoCalls(project.blocks);
            }
            setStatus(error.message, true);
            renderBlockStack();
            return;
        }
    } else block[property] = field.value;
    if (["if", "waitUntil", "repeatUntil"].includes(block.type) &&
        ["componentId", "leftType"].includes(property) && block.leftType !== "variable") {
        block.threshold = clamp(block.threshold, 0, sensorThresholdMax(project.components.find((component) => component.id === block.componentId)?.type));
    }
    if (["if", "waitUntil", "repeatUntil"].includes(block.type) &&
        ["secondComponentId", "secondLeftType"].includes(property) && block.secondLeftType !== "variable") {
        block.secondThreshold = clamp(block.secondThreshold, 0,
            sensorThresholdMax(project.components.find((component) => component.id === block.secondComponentId)?.type));
    }
    renderBlockStack();
    regenerateFromBlocks();
}

function moveCodeBlock(id, directionOrTarget, afterTarget = false, destinationList = null) {
    const source = findBlockLocation(id);
    if (!source) return;
    const [block] = source.list.splice(source.index, 1);
    let targetList = project.blocks;
    let targetIndex;
    if (directionOrTarget === "up" || directionOrTarget === "down") {
        targetList = source.list;
        targetIndex = directionOrTarget === "up"
            ? Math.max(0, source.index - 1)
            : Math.min(source.list.length, source.index + 1);
    } else if (destinationList) {
        targetList = destinationList;
        const anchorIndex = directionOrTarget
            ? targetList.findIndex((item) => item.id === directionOrTarget)
            : -1;
        targetIndex = anchorIndex < 0
            ? targetList.length
            : anchorIndex + (afterTarget ? 1 : 0);
    } else {
        const target = directionOrTarget ? findBlockLocation(directionOrTarget) : null;
        if (target) {
            targetList = target.list;
            targetIndex = target.index + (afterTarget ? 1 : 0);
        } else targetIndex = targetList.length;
    }
    const containsTargetList = (item) => [item.children, item.elseChildren]
        .filter(Array.isArray)
        .some((children) => children === targetList || children.some(containsTargetList));
    const movesInsideItself = containsTargetList(block);
    const destinationDepth = getBlockListDepth(targetList);
    if (movesInsideItself || destinationDepth < 0 ||
        destinationDepth + getControlDepth(block) > 8 ||
        (["defineFunction", "whenStarted"].includes(block.type) && targetList !== project.blocks)) {
        source.list.splice(source.index, 0, block);
        setStatus(movesInsideItself
            ? "A control block cannot be moved inside itself."
            : ["defineFunction", "whenStarted"].includes(block.type) && targetList !== project.blocks
                ? "Custom block definitions and start-event scripts must stay at the top level."
                : "Control blocks can be nested up to 8 levels deep.", true);
        return;
    }
    targetList.splice(clamp(targetIndex, 0, targetList.length), 0, block);
    renderBlockStack();
    regenerateFromBlocks();
}

function renderLibrary() {
    const query = editor.querySelector("[data-robotics-search]").value.trim().toLowerCase();
    partsList.replaceChildren();
    for (const part of parts.filter((item) => `${item.name} ${item.group} ${item.description}`.toLowerCase().includes(query))) {
        const button = document.createElement("button");
        button.className = "robotics-part-card";
        button.type = "button";
        button.draggable = true;
        button.dataset.addPart = part.type;
        const pinLabel = isPowerSource(part.type)
            ? powerSourceLabel(part.type)
            : part.pins ? (/^A\d/.test(part.pins) ? part.pins : `D${part.pins}`) : "5 V board";
        button.innerHTML = `<span class="robotics-part-dot" style="--part-color:${part.color}"></span><span class="robotics-part-copy"><strong>${part.name}</strong><small>${part.group} · ${pinLabel}</small></span><span aria-hidden="true">+</span>`;
        button.title = `${part.description}. Click or drag to add.`;
        partsList.append(button);
    }
}

function renderPlacedParts() {
    placedParts.replaceChildren();
    const grouped = project.components.map((component) => ({ component, part: findPart(component.type) }));
    for (const { component, part } of grouped) {
        const row = document.createElement("div");
        row.className = "robotics-placed-part";
        const label = document.createElement("span");
        label.className = "robotics-placed-name";
        label.textContent = part.name;
        row.append(label);
        const pinCount = requiredPinCount(component.type);
        if (pinCount) {
            const pinInput = document.createElement("input");
            pinInput.type = "text";
            pinInput.value = typeof component.pins === "string" ? component.pins : part.pins;
            pinInput.maxLength = 12;
            pinInput.autocomplete = "off";
            pinInput.spellcheck = false;
            pinInput.dataset.componentPins = component.id;
            pinInput.setAttribute("aria-label", `${part.name} pin assignment`);
            pinInput.title = pinCount === 2 ? "Enter two Uno pins separated by a comma" : "Enter an Uno pin, such as 9 or A0";
            row.append(pinInput);
        } else {
            const boardTag = document.createElement("span");
            boardTag.className = "robotics-board-tag";
            boardTag.textContent = isPowerSource(component.type) ? powerSourceLabel(component.type) : "Controller";
            row.append(boardTag);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.removePart = component.id;
        remove.setAttribute("aria-label", `Remove ${part.name}`);
        remove.textContent = "×";
        remove.disabled = project.components.length <= 1;
        row.append(remove);
        placedParts.append(row);
    }
    editor.querySelector("[data-robotics-count]").textContent = `${project.components.length} component${project.components.length === 1 ? "" : "s"}`;
    editor.querySelector("[data-robotics-empty]").hidden = project.components.length > 0;
    renderConnectionControls();
    renderWiringWarnings();
}

function componentLabel(component) {
    const sameType = project.components.filter((item) => item.type === component.type);
    const suffix = sameType.length > 1 ? ` ${sameType.indexOf(component) + 1}` : "";
    return `${findPart(component.type).name}${suffix}`;
}

function renderConnectionControls() {
    const oldFrom = wireFrom.value;
    const oldTo = wireTo.value;
    for (const select of [wireFrom, wireTo]) {
        select.replaceChildren();
        for (const component of project.components) {
            const option = document.createElement("option");
            option.value = component.id;
            option.textContent = componentLabel(component);
            select.append(option);
        }
    }
    wireFrom.value = project.components.some((item) => item.id === oldFrom) ? oldFrom : project.components[0]?.id || "";
    wireTo.value = project.components.some((item) => item.id === oldTo) ? oldTo : project.components[1]?.id || project.components[0]?.id || "";
    wireTo.disabled = project.components.length < 2;
    wireForm.querySelector("button[type='submit']").disabled = project.components.length < 2;
    wireList.replaceChildren();
    const componentById = new Map(project.components.map((component) => [component.id, component]));
    for (const wire of project.wires || []) {
        const from = componentById.get(wire.from);
        const to = componentById.get(wire.to);
        if (!from || !to) continue;
        const row = document.createElement("div");
        row.className = `robotics-wire-row is-${wire.kind}`;
        const label = document.createElement("span");
        label.textContent = `${componentLabel(from)} → ${componentLabel(to)} · ${wire.kind === "ground" ? "GND" : wire.kind === "power" ? "Power +" : "Signal"}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.removeWire = wire.id;
        remove.setAttribute("aria-label", `Remove ${label.textContent}`);
        remove.textContent = "×";
        row.append(label, remove);
        wireList.append(row);
    }
    editor.querySelector("[data-robotics-wire-count]").textContent =
        `${(project.wires || []).length} connection${(project.wires || []).length === 1 ? "" : "s"}`;
}

function addWire(from, to, kind) {
    if (!from || !to || from === to) {
        setStatus("Choose two different components to connect.", true);
        return;
    }
    if (!(project.wires || []).some((wire) =>
        wire.kind === kind && ((wire.from === from && wire.to === to) || (wire.from === to && wire.to === from))
    )) {
        project.wires ||= [];
        project.wires.push({
            id: `wire-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            from,
            to,
            kind
        });
    }
    renderAll();
    saveProject();
    setStatus("Wire added to the diagram. Verify exact terminals, polarity, and voltage before connecting real hardware.");
}

function removeWire(id) {
    project.wires = (project.wires || []).filter((wire) => wire.id !== id);
    renderAll();
    saveProject();
    setStatus("Wire removed from the diagram.");
}

function renderWiringWarnings() {
    const warnings = getWiringWarnings();
    for (const input of placedParts.querySelectorAll("[data-component-pins][aria-invalid='true']")) {
        const component = project.components.find((item) => item.id === input.dataset.componentPins);
        warnings.unshift(`${findPart(component.type).name}: enter valid Uno pins before generating code.`);
    }
    warningList.replaceChildren();
    editor.querySelector("[data-robotics-check-count]").textContent = warnings.length
        ? `${warnings.length} check${warnings.length === 1 ? "" : "s"}`
        : "Pin assignments pass basic checks";
    editor.querySelector(".robotics-wiring-check").classList.toggle("has-warnings", warnings.length > 0);
    for (const warning of warnings) {
        const item = document.createElement("li");
        item.textContent = warning;
        warningList.append(item);
    }
}

function renderAll() {
    renderLibrary();
    renderPlacedParts();
    renderBlockStack();
    codeEditor.value = project.code;
    updateSensorReadouts();
    drawScene();
}

function addPart(type, position = null) {
    if (!findPart(type)) return;
    if (project.components.length >= MAX_COMPONENTS) {
        setStatus(`A workbench can hold up to ${MAX_COMPONENTS} parts.`, true);
        return;
    }
    const index = project.components.length;
    const component = {
        id: `robot-${Date.now()}-${index}`,
        type,
        x: position ? clamp(position.x, -38, 38) : clamp(-24 + (index % 4) * 16, -38, 38),
        z: position ? clamp(position.z, -28, 28) : clamp(-16 + (Math.floor(index / 4) % 4) * 12, -28, 28)
    };
    const part = findPart(type);
    if (part.pins) component.pins = part.pins;
    project.components.push(component);
    renderAll();
    saveProject();
    setStatus(`${part.name} added. Check your exact module's pinout and power requirements.`);
}

function removePart(id) {
    if (project.components.length <= 1) {
        setStatus("Keep at least one component on the workbench.", true);
        return;
    }
    project.components = project.components.filter((item) => item.id !== id);
    project.wires = (project.wires || []).filter((wire) => wire.from !== id && wire.to !== id);
    const clearReferences = (blocks) => blocks.forEach((block) => {
        if (block.componentId === id) block.componentId = "";
        if (block.secondComponentId === id) block.secondComponentId = "";
        if (block.outputId === id) block.outputId = "";
        clearReferences(block.children || []);
        clearReferences(block.elseChildren || []);
    });
    clearReferences(project.blocks || []);
    delete simulation.outputs[id];
    renderAll();
    saveProject();
    setStatus("Part removed. Generate the sketch again to match the current build.");
}

function updatePinAssignment(input) {
    const component = project.components.find((item) => item.id === input.dataset.componentPins);
    if (!component) return;
    const previousPins = component.pins;
    component.pins = input.value.trim().toUpperCase();
    const valid = normalizedPins(component) !== null;
    input.setAttribute("aria-invalid", String(!valid));
    if (valid) {
        renderWiringWarnings();
        saveProject();
        setStatus("Pin assignment saved. Generate the sketch again to apply the updated pins.");
    } else {
        component.pins = previousPins;
        renderWiringWarnings();
        setStatus("Use Uno pins D0–D13 or A0–A5; parts with two pins need a comma-separated pair.", true);
    }
}

function updateSensorReadouts() {
    editor.querySelector("[data-servo-angle]").textContent = `${Math.round(targetAngle)}°`;
    editor.querySelector("[data-distance-value]").textContent = `${distanceSlider.value} cm`;
    editor.querySelector("[data-ir-value]").textContent = Number(irSlider.value) ? "Obstacle" : "Clear";
    editor.querySelector("[data-pir-value]").textContent = Number(pirSlider.value) ? "Motion detected" : "No motion";
    editor.querySelector("[data-moisture-value]").textContent = `${moistureSlider.value}%`;
    editor.querySelector("[data-light-value]").textContent = `${lightSlider.value} / 1023`;
    editor.querySelector("[data-potentiometer-value]").textContent = `${potentiometerSlider.value} / 1023`;
    editor.querySelector("[data-rain-value]").textContent = `${rainSlider.value} / 1023`;
    editor.querySelector("[data-temperature-value]").textContent = `${temperatureSlider.value} / 1023`;
    editor.querySelector("[data-button-value]").textContent = Number(buttonSlider.value) ? "Pressed" : "Released";
}

function simulationSensorValue(componentId) {
    const component = project.components.find((item) => item.id === componentId);
    if (!component || !sensorTypes.includes(component.type)) throw new Error("Choose a placed sensor before running the simulation.");
    if (component.type === "ultrasonic") return Number(distanceSlider.value);
    if (component.type === "ir-sensor") return Number(irSlider.value);
    if (component.type === "pir") return Number(pirSlider.value);
    if (component.type === "button") return Number(buttonSlider.value);
    if (component.type === "soil-moisture") return Math.round((100 - Number(moistureSlider.value)) * 10.23);
    if (component.type === "ldr") return Number(lightSlider.value);
    if (component.type === "potentiometer") return Number(potentiometerSlider.value);
    if (component.type === "rain-sensor") return Number(rainSlider.value);
    return Number(temperatureSlider.value);
}

function renderSimulationMonitor() {
    simulationVariables.replaceChildren();
    const variables = Object.entries(simulation.variables);
    const outputs = Object.entries(simulation.outputs);
    if (!variables.length && !outputs.length) {
        const empty = document.createElement("li");
        empty.textContent = "No values yet.";
        simulationVariables.append(empty);
    }
    for (const [name, value] of variables) {
        const row = document.createElement("li");
        row.textContent = `${name} = ${value}`;
        simulationVariables.append(row);
    }
    for (const [id, output] of outputs) {
        const component = project.components.find((item) => item.id === id);
        const label = component ? findPart(component.type)?.name || component.type : "Removed output";
        const row = document.createElement("li");
        row.textContent = `${label}: ${typeof output === "object" ? JSON.stringify(output) : output}`;
        simulationVariables.append(row);
    }
    simulationConsole.replaceChildren();
    for (const message of simulation.logs.slice(-50)) {
        const row = document.createElement("li");
        row.textContent = message;
        simulationConsole.append(row);
    }
    if (!simulation.logs.length) {
        const row = document.createElement("li");
        row.textContent = "Console is empty.";
        simulationConsole.append(row);
    }
}

function simulationLog(message, blockId = "") {
    const now = performance.now();
    const lastLog = simulation.logTimes.get(blockId);
    if (blockId && lastLog !== undefined && now - lastLog < 250) return;
    if (blockId) simulation.logTimes.set(blockId, now);
    simulation.logs.push(message);
    if (simulation.logs.length > 200) simulation.logs.splice(0, simulation.logs.length - 200);
    renderSimulationMonitor();
}

function evaluateBlockCondition(block, prefix = "", second = false) {
    const prop = (name) => prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
    const left = block[prop("leftType")] === "variable"
        ? Number(simulation.variables[block[prop("variable")]] || 0)
        : simulationSensorValue(block[prop("componentId")]);
    const right = block[prop("rightType")] === "variable"
        ? Number(simulation.variables[block[prop("rightVariable")]] || 0)
        : Number(block[prop("threshold")]);
    const operator = block[prop("operator")];
    if (operator === "<") return left < right;
    if (operator === "<=") return left <= right;
    if (operator === "==") return left === right;
    if (operator === "!=") return left !== right;
    if (operator === ">=") return left >= right;
    return left > right;
}

function blockCondition(block) {
    const first = evaluateBlockCondition(block);
    if (!block.useSecondCondition) return first;
    const second = evaluateBlockCondition(block, "second");
    return block.logic === "OR" ? first || second : first && second;
}

async function simulationDelay(milliseconds, runId) {
    let remaining = milliseconds;
    while (remaining > 0 && running && runId === simulationRunId) {
        if (simulationPaused) {
            await new Promise((resolve) => window.setTimeout(resolve, 40));
            continue;
        }
        const slice = Math.min(remaining, 40);
        await new Promise((resolve) => window.setTimeout(resolve, slice));
        remaining -= slice;
    }
    return running && runId === simulationRunId;
}

async function simulationCheckpoint(runId) {
    if (!running || runId !== simulationRunId) return false;
    while (simulationPaused && running && runId === simulationRunId) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
    if (!running || runId !== simulationRunId) return false;
    simulation.instructionCount += 1;
    if (simulation.instructionCount % 8 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    return running && runId === simulationRunId;
}

async function executeSimulationBlock(block, runId, callDepth = 0) {
    if (!running || runId !== simulationRunId) return;
    if (block.type === "defineFunction" || block.type === "whenStarted") {
        return;
    } else if (block.type === "callFunction") {
        if (!block.functionName) throw new Error("Choose a custom block before running the simulation.");
        if (callDepth >= 8) throw new Error("Custom block calls exceeded the 8-level recursion safety limit.");
        const definition = project.blocks.find((candidate) =>
            candidate.type === "defineFunction" && candidate.functionName === block.functionName);
        if (!definition) throw new Error(`The custom block "${block.functionName}" has no definition.`);
        await executeSimulationBlocks(definition.children, runId, callDepth + 1);
    } else if (block.type === "read") {
        const value = simulationSensorValue(block.componentId);
        if (block.variable) simulation.variables[block.variable] = value;
        simulationLog(`${findPart(project.components.find((item) => item.id === block.componentId)?.type)?.name || "Sensor"}: ${value}`, block.id);
    } else if (block.type === "if") {
        await executeSimulationBlocks(blockCondition(block) ? block.children : block.elseChildren, runId, callDepth);
    } else if (block.type === "repeat") {
        for (let index = 0; index < clamp(block.value, 1, 1000) && running && runId === simulationRunId; index += 1) {
            await executeSimulationBlocks(block.children, runId, callDepth);
        }
    } else if (block.type === "repeatUntil") {
        let iterations = 0;
        do {
            await executeSimulationBlocks(block.children, runId, callDepth);
            if (!running || runId !== simulationRunId || blockCondition(block)) break;
            iterations += 1;
            if (iterations >= 1000) {
                simulationLog("Repeat-until stopped at the 1,000-iteration safety limit.");
                break;
            }
        } while (running && runId === simulationRunId);
    } else if (block.type === "waitUntil") {
        const startedAt = performance.now();
        while (running && runId === simulationRunId && !blockCondition(block)) {
            if (block.timeout > 0 && performance.now() - startedAt >= block.timeout) {
                simulationLog("Wait-until timed out; continuing the program.");
                break;
            }
            if (!await simulationDelay(10, runId)) break;
        }
    } else if (block.type === "whenButtonPressed") {
        const pressed = simulationSensorValue(block.componentId) === 1;
        const wasPressed = Boolean(simulation.buttonState[block.id]);
        simulation.buttonState[block.id] = pressed;
        if (pressed && !wasPressed) await executeSimulationBlocks(block.children, runId, callDepth);
    } else if (block.type === "servo") {
        const value = clamp(Number(block.value), 0, 180);
        simulation.outputs[block.componentId] = value;
        targetAngle = value;
        angleSlider.value = String(value);
        updateSensorReadouts();
    } else if (block.type === "led" || block.type === "buzzer") {
        simulation.outputs[block.componentId] = Boolean(block.enabled);
    } else if (block.type === "motor") {
        simulation.outputs[block.componentId] = { speed: clamp(Number(block.value), 0, 255), direction: block.reverse ? "reverse" : "forward" };
    } else if (block.type === "wait") {
        await simulationDelay(clamp(block.value, 1, 60000), runId);
    } else if (block.type === "print") {
        simulationLog(block.message, block.id);
    } else if (block.type === "setVariable" || block.type === "changeVariable") {
        const operand = block.valueType === "variable"
            ? Number(simulation.variables[block.valueVariable] || 0)
            : Number(block.value);
        const current = Number(simulation.variables[block.variable] || 0);
        const operation = block.operation || (block.type === "changeVariable" ? "add" : "set");
        let result = operation === "add" ? current + operand
            : operation === "subtract" ? current - operand
                : operation === "multiply" ? current * operand
                    : operation === "divide" ? current / operand : operand;
        if (!Number.isFinite(result)) throw new Error(`Cannot divide ${block.variable} by zero.`);
        result = clamp(Math.trunc(result), -2147483648, 2147483647);
        simulation.variables[block.variable] = result;
    }
    renderSimulationMonitor();
    updateSimulationVisuals();
    await simulationCheckpoint(runId);
}

async function executeSimulationBlocks(blocks, runId, callDepth = 0) {
    for (const block of blocks || []) {
        if (!running || runId !== simulationRunId) return;
        await executeSimulationBlock(block, runId, callDepth);
    }
}

async function runSimulationProgram(runId) {
    try {
        const startupBlocks = project.blocks.filter((block) => block.type === "whenStarted")
            .flatMap((block) => block.children);
        await executeSimulationBlocks(startupBlocks, runId);
        const loopBlocks = project.blocks.filter((block) => block.type !== "whenStarted");
        while (running && runId === simulationRunId) {
            await executeSimulationBlocks(loopBlocks, runId);
            await simulationDelay(10, runId);
        }
    } catch (error) {
        simulationLog(`Simulation stopped: ${error.message}`);
        stopSimulation("Stopped after error");
        setStatus(`Simulation stopped: ${error.message}`, true);
    }
}

function startSimulation() {
    const hasProgram = project.blocks.some((block) =>
        block.type === "whenStarted" ? block.children?.length : block.type !== "defineFunction");
    if (!hasProgram) {
        editor.querySelector("[data-sim-state]").textContent = "Idle · no program";
        setStatus("Nothing to simulate yet. Add a code block or load a starter example with a sample program.");
        return;
    }
    running = true;
    simulationPaused = false;
    const runId = ++simulationRunId;
    simulation.variables = Object.create(null);
    simulation.outputs = Object.create(null);
    simulation.logs = [];
    simulation.buttonState = Object.create(null);
    simulation.logTimes = new Map();
    simulation.instructionCount = 0;
    renderSimulationMonitor();
    updateSimulationVisuals();
    simulationMonitor.setAttribute("aria-busy", "true");
    editor.querySelector("[data-sim-state]").textContent = "Running · simulated";
    const runButton = editor.querySelector("[data-robotics-run]");
    runButton.setAttribute("aria-pressed", "true");
    runButton.textContent = "Ⅱ Pause simulation";
    runButton.setAttribute("aria-label", "Pause simulation");
    editor.querySelector("[data-robotics-stop]").disabled = false;
    setStatus("Block simulation running against simulated sensor inputs. No hardware is connected.");
    runSimulationProgram(runId);
    startRendering();
}

function pauseSimulation() {
    simulationPaused = !simulationPaused;
    const runButton = editor.querySelector("[data-robotics-run]");
    runButton.setAttribute("aria-pressed", String(!simulationPaused));
    runButton.textContent = simulationPaused ? "▶ Resume simulation" : "Ⅱ Pause simulation";
    runButton.setAttribute("aria-label", simulationPaused ? "Resume simulation" : "Pause simulation");
    editor.querySelector("[data-sim-state]").textContent = simulationPaused ? "Paused · simulated" : "Running · simulated";
    simulationMonitor.setAttribute("aria-busy", String(!simulationPaused));
    setStatus(simulationPaused
        ? "Simulation paused. Program state and outputs are preserved; no hardware is connected."
        : "Simulation resumed from its paused state. No hardware is connected.");
}

function stopSimulation(state = "Stopped") {
    running = false;
    simulationPaused = false;
    simulationRunId += 1;
    const runButton = editor.querySelector("[data-robotics-run]");
    runButton.setAttribute("aria-pressed", "false");
    runButton.textContent = "▶ Run simulation";
    runButton.setAttribute("aria-label", "Run simulation");
    editor.querySelector("[data-robotics-stop]").disabled = true;
    editor.querySelector("[data-sim-state]").textContent = state;
    simulationMonitor.setAttribute("aria-busy", "false");
}

function updateSimulationVisuals() {
    for (const component of project.components) {
        const group = componentGroups.get(component.id);
        if (!group) continue;
        const output = simulation.outputs[component.id];
        group.traverse((object) => {
            if (object.name.includes("LED") && object.material) {
                object.material.emissive?.set(output ? "#ffb52e" : "#000000");
                object.material.emissiveIntensity = output ? 0.8 : 0;
            }
            if (object.name === "Buzzer emitter" && object.material) {
                object.material.emissive?.set(output ? "#9b718d" : "#000000");
                object.material.emissiveIntensity = output ? 0.65 : 0;
            }
        });
    }
    if (lowModeToggle.checked) drawLowEnd();
    else if (renderer && scene && camera) renderer.render(scene, camera);
}

function makeBox(parent, name, size, position, color, material = {}) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.12, ...material })
    );
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
}

function makeCylinder(parent, radius, length, position, color, direction = "y") {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, 20),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.28 })
    );
    if (direction === "z") mesh.rotation.x = Math.PI / 2;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
}

function makeRobotPart(component) {
    const part = findPart(component.type);
    const group = new THREE.Group();
    group.position.set(component.x, 0, component.z);
    group.userData.componentId = component.id;
    if (component.type === "arduino-uno") {
        makeBox(group, "Arduino Uno board", [36, 2.2, 24], [0, 2, 0], "#168875");
        makeBox(group, "USB connector", [10, 4, 7], [-22, 4, -2], "#abb7bd", { metalness: 0.75 });
        makeBox(group, "Power jack", [8, 5, 9], [-21, 4, 9], "#202a32");
        makeBox(group, "Microcontroller", [10, 3, 10], [4, 4, 0], "#222a30");
        makeBox(group, "Reset button", [3, 2, 3], [-9, 4, -8], "#d34b45");
        for (let index = 0; index < 14; index += 1) makeBox(group, "Digital pin", [1, 2, 1], [-13 + index * 2, 4, -12], "#e1c16d");
        for (let index = 0; index < 6; index += 1) makeBox(group, "Analog pin", [1, 2, 1], [6 + index * 2, 4, 12], "#e1c16d");
    } else if (component.type === "servo") {
        makeBox(group, "Servo case", [19, 13, 16], [0, 8, 0], "#345d9b");
        makeBox(group, "Servo mount left", [5, 2, 24], [-12, 8, 0], "#345d9b");
        makeBox(group, "Servo mount right", [5, 2, 24], [12, 8, 0], "#345d9b");
        makeCylinder(group, 3, 2, [0, 15, 0], "#d4bc69");
        const servoArm = new THREE.Group();
        servoArm.position.set(0, 17, 0);
        makeBox(servoArm, "Servo horn", [22, 1.4, 3], [11, 0, 0], "#f1f0e9");
        makeCylinder(servoArm, 1.5, 2, [22, 0, 0], "#f1f0e9");
        group.add(servoArm);
        servoArm.userData.componentId = component.id;
        servoArm.userData.currentAngle = 90;
        servoArms.push(servoArm);
    } else if (component.type === "ultrasonic") {
        makeBox(group, "Ultrasonic PCB", [21, 2, 13], [0, 3, 0], "#347da0");
        makeCylinder(group, 5.2, 4, [-6, 6, 0], "#bbc8ca");
        makeCylinder(group, 5.2, 4, [6, 6, 0], "#bbc8ca");
        makeCylinder(group, 3.8, 1, [-6, 6, -2.6], "#263c4b");
        makeCylinder(group, 3.8, 1, [6, 6, -2.6], "#263c4b");
    } else if (component.type === "dc-motor") {
        makeBox(group, "Motor driver board", [17, 3, 15], [0, 3, 0], "#374c47");
        makeCylinder(group, 5, 20, [14, 7, 0], "#abb3b4", "z");
        const shaft = makeCylinder(group, 2, 5, [14, 7, -12], "#b9a764", "z");
        shaft.name = "Motor shaft";
    } else if (component.type === "ir-sensor" || component.type === "soil-moisture" || component.type === "ldr" || component.type === "temperature") {
        makeBox(group, `${part.name} board`, [16, 2, 12], [0, 2, 0], part.color);
        makeCylinder(group, 3, 4, [0, 5, 0], "#272f38");
        makeCylinder(group, 1.5, 2, [-5, 4, 0], "#dabd75");
        makeCylinder(group, 1.5, 2, [5, 4, 0], "#dabd75");
    } else if (component.type === "button") {
        makeBox(group, "Push button base", [11, 2, 11], [0, 2, 0], "#4b6273");
        makeBox(group, "Push button cap", [6, 4, 6], [0, 5, 0], "#d15f58");
    } else if (component.type === "led") {
        const base = makeCylinder(group, 3, 6, [0, 5, 0], "#d0a641");
        base.name = "LED base";
        const emitter = makeCylinder(group, 2.5, 4, [0, 9, 0], "#eac354", "y");
        emitter.name = "LED emitter";
    } else if (component.type === "buzzer") {
        makeCylinder(group, 6, 5, [0, 4, 0], "#302f3c");
        const emitter = makeCylinder(group, 2, 1, [0, 7, 0], "#c2a15d");
        emitter.name = "Buzzer emitter";
    } else if (component.type === "usb-power") {
        makeBox(group, "USB regulated power source", [19, 5, 14], [0, 4, 0], "#526d83");
        makeBox(group, "USB plug", [7, 3, 5], [-12, 4, 0], "#aebac1");
    } else if (component.type === "battery-4xaa") {
        makeBox(group, "Four AA battery holder", [25, 7, 17], [0, 4, 0], "#67543a");
        for (let index = 0; index < 4; index += 1) {
            makeCylinder(group, 3.2, 11, [-9 + (index % 2) * 18, 8, -3 + Math.floor(index / 2) * 7], "#c39a4e", "z");
        }
    } else if (component.type === "battery-9v") {
        makeBox(group, "9 volt battery", [14, 21, 10], [0, 11, 0], "#568064");
        makeCylinder(group, 1.5, 2, [-3, 22, 0], "#c8b87b");
        makeCylinder(group, 1.5, 2, [3, 22, 0], "#d2d3d0");
    } else if (component.type === "breadboard-regulator") {
        makeBox(group, "Regulated 5 V power module", [20, 3, 14], [0, 3, 0], "#477b70");
        makeBox(group, "Regulator", [6, 4, 5], [0, 6, 0], "#27333a");
        makeBox(group, "Breadboard rail", [25, 1, 3], [0, 1, 10], "#d5d9d3");
    }
    group.userData.partColor = part.color;
    return group;
}

function createRenderer() {
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    if (lowModeToggle.checked) {
        editor.dataset.renderMode = "low";
        editor.querySelector("[data-robotics-render-label]").textContent = "LOW-END · LINE VIEW";
        return;
    }
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        editor.dataset.renderMode = "3d";
        editor.querySelector("[data-robotics-render-label]").textContent = "INTERACTIVE 3D";
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#eef3f6");
        scene.add(new THREE.HemisphereLight("#ffffff", "#8292a1", 2.2));
        const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
        keyLight.position.set(-35, 75, 38);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight("#91b7d4", 1.0);
        fillLight.position.set(25, 30, -40);
        scene.add(fillLight);
        camera = new THREE.PerspectiveCamera(36, 1, 1, 500);
        robotGroup = new THREE.Group();
        scene.add(robotGroup);
        scene.add(new THREE.GridHelper(120, 24, "#a9b8c5", "#d4dde3"));
        camera.position.set(95, 78, 105);
        camera.lookAt(0, 0, 0);
    } catch (error) {
        lowModeToggle.checked = true;
        editor.dataset.renderMode = "low";
        editor.querySelector("[data-robotics-render-label]").textContent = "LOW-END · LINE VIEW";
        setStatus(`WebGL is unavailable; switched to low-end line view. ${error.message}`);
    }
}

function updateCamera() {
    if (!camera) return;
    camera.position.set(
        cameraDistance * Math.sin(cameraYaw) * Math.cos(cameraPitch),
        cameraDistance * Math.sin(cameraPitch),
        cameraDistance * Math.cos(cameraYaw) * Math.cos(cameraPitch)
    );
    camera.lookAt(0, 0, 0);
}

function drawScene() {
    if (lowModeToggle.checked || !renderer || !scene || !robotGroup) {
        drawLowEnd();
        return;
    }
    if (sonarLine) {
        scene.remove(sonarLine);
        sonarLine.geometry.dispose();
        sonarLine.material.dispose();
        sonarLine = null;
    }
    for (const child of robotGroup.children) {
        child.traverse((object) => {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
            else object.material?.dispose();
        });
    }
    robotGroup.clear();
    for (const wire of renderedWires) {
        scene.remove(wire);
        wire.geometry.dispose();
        wire.material.dispose();
    }
    renderedWires = [];
    servoArms = [];
    componentGroups = new Map();
    sonarLine = null;
    makeBox(robotGroup, "Workbench", [88, 1, 62], [0, 0, 0], "#dbe6ed", { roughness: 0.92 });
    for (const component of project.components) {
        const group = makeRobotPart(component);
        componentGroups.set(component.id, group);
        robotGroup.add(group);
    }
    const componentById = new Map(project.components.map((component) => [component.id, component]));
    const wireColors = { signal: "#e5aa49", power: "#cf635d", ground: "#536777" };
    for (const wire of project.wires || []) {
        const from = componentById.get(wire.from);
        const to = componentById.get(wire.to);
        if (!from || !to) continue;
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(from.x, 5, from.z),
                new THREE.Vector3((from.x + to.x) / 2, 11, (from.z + to.z) / 2),
                new THREE.Vector3(to.x, 5, to.z)
            ]),
            new THREE.LineBasicMaterial({ color: wireColors[wire.kind] || wireColors.signal })
        );
        scene.add(line);
        renderedWires.push(line);
    }
    const ultrasonic = project.components.find((component) => component.type === "ultrasonic");
    if (ultrasonic) {
        const distance = Number(distanceSlider.value);
        sonarLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(ultrasonic.x, 9, ultrasonic.z - 8),
                new THREE.Vector3(ultrasonic.x, 9, ultrasonic.z - Math.min(distance, 300) * 0.18)
            ]),
            new THREE.LineDashedMaterial({ color: distance < 20 ? "#da9b43" : "#51a0c3", dashSize: 2, gapSize: 1.2 })
        );
        scene.add(sonarLine);
        sonarLine.computeLineDistances();
    }
    updateSimulationVisuals();
    resizeCanvas();
}

function drawLowEnd() {
    const context = lowCanvas.getContext("2d");
    if (!context) return;
    const bounds = lowCanvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1);
    lowCanvas.width = Math.round(bounds.width * ratio);
    lowCanvas.height = Math.round(bounds.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.fillStyle = "#eef3f6";
    context.fillRect(0, 0, bounds.width, bounds.height);
    const scale = Math.min(bounds.width / 104, bounds.height / 74);
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    context.strokeStyle = "#d1dce4";
    context.lineWidth = 1;
    for (let x = centerX % (scale * 5); x < bounds.width; x += scale * 5) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, bounds.height); context.stroke();
    }
    for (let y = centerY % (scale * 5); y < bounds.height; y += scale * 5) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(bounds.width, y); context.stroke();
    }
    const toScreen = (x, z) => ({
        x: centerX + (x * Math.cos(cameraYaw) - z * Math.sin(cameraYaw)) * scale,
        y: centerY + (x * Math.sin(cameraYaw) + z * Math.cos(cameraYaw)) * scale
    });
    const board = toScreen(0, 0);
    context.fillStyle = "#dbe6ed";
    context.strokeStyle = "#8ea2b1";
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(board.x - 43 * scale, board.y - 30 * scale, 86 * scale, 60 * scale, 5);
    context.fill();
    context.stroke();
    const componentById = new Map(project.components.map((component) => [component.id, component]));
    const wireColors = { signal: "#e5aa49", power: "#cf635d", ground: "#536777" };
    for (const wire of project.wires || []) {
        const from = componentById.get(wire.from);
        const to = componentById.get(wire.to);
        if (!from || !to) continue;
        const start = toScreen(from.x, from.z);
        const end = toScreen(to.x, to.z);
        context.strokeStyle = wireColors[wire.kind] || wireColors.signal;
        context.lineWidth = wire.kind === "power" ? 3 : 2;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.quadraticCurveTo((start.x + end.x) / 2, Math.min(start.y, end.y) - 12, end.x, end.y);
        context.stroke();
    }
    for (const component of project.components) {
        const part = findPart(component.type);
        const point = toScreen(component.x, component.z);
        context.fillStyle = "#f4f7f9";
        context.strokeStyle = part.color;
        context.lineWidth = 2.5;
        context.beginPath();
        context.roundRect(point.x - 7 * scale, point.y - 5 * scale, 14 * scale, 10 * scale, 2);
        context.fill();
        context.stroke();
        const output = simulation.outputs[component.id];
        context.fillStyle = component.type === "led" && output ? "#ffc047" : part.color;
        context.font = `bold ${clamp(scale * 2.8, 9, 13)}px sans-serif`;
        context.textAlign = "center";
        context.fillText(part.name.replace("Arduino ", "").replace(" sensor", ""), point.x, point.y + 0.8 * scale);
        if (component.type === "servo") {
            const servoAngle = typeof simulation.outputs[component.id] === "number"
                ? simulation.outputs[component.id]
                : currentAngle;
            const radians = (servoAngle - 90) * Math.PI / 180;
            context.strokeStyle = "#d98348";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(point.x + Math.cos(radians) * 12 * scale, point.y - Math.sin(radians) * 12 * scale);
            context.stroke();
        }
        if (component.type === "dc-motor") {
            const motor = simulation.outputs[component.id];
            if (motor && typeof motor === "object" && motor.speed > 0) {
                const radians = motorPhase * motor.speed / 255 * (motor.direction === "reverse" ? -1 : 1);
                const length = 4 * scale;
                context.strokeStyle = "#354a50";
                context.lineWidth = 1.5;
                context.beginPath();
                context.moveTo(point.x - Math.cos(radians) * length, point.y - Math.sin(radians) * length);
                context.lineTo(point.x + Math.cos(radians) * length, point.y + Math.sin(radians) * length);
                context.stroke();
            }
        }
    }
    const ultrasonic = project.components.find((component) => component.type === "ultrasonic");
    if (ultrasonic) {
        const point = toScreen(ultrasonic.x, ultrasonic.z);
        const distance = Number(distanceSlider.value);
        const end = toScreen(ultrasonic.x, ultrasonic.z - Math.min(distance, 300) * 0.18);
        context.strokeStyle = distance < 20 ? "#da9b43" : "#51a0c3";
        context.setLineDash([5, 4]);
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        context.setLineDash([]);
    }
}

function resizeCanvas() {
    if (!renderer || !camera) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / bounds.height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
}

function renderFrame() {
    animationFrame = 0;
    if (editor.hidden) return;
    const now = performance.now();
    const deltaSeconds = lastFrameTime ? clamp((now - lastFrameTime) / 1000, 0, 0.1) : 1 / 60;
    lastFrameTime = now;
    const maxServoStep = 600 * deltaSeconds;
    if (!simulationPaused) {
        currentAngle += clamp(targetAngle - currentAngle, -maxServoStep, maxServoStep);
        for (const servoArm of servoArms) {
            const output = simulation.outputs[servoArm.userData.componentId];
            const goal = typeof output === "number" ? output : targetAngle;
            const angle = servoArm.userData.currentAngle;
            servoArm.userData.currentAngle = angle + clamp(goal - angle, -maxServoStep, maxServoStep);
            servoArm.rotation.y = THREE.MathUtils.degToRad(servoArm.userData.currentAngle - 90);
        }
        if (running) motorPhase = (motorPhase + deltaSeconds * 2 * Math.PI * 2) % (2 * Math.PI);
    }
    for (const component of project.components) {
        if (component.type !== "dc-motor") continue;
        const output = simulation.outputs[component.id];
        const group = componentGroups.get(component.id);
        const direction = output?.direction === "reverse" ? -1 : 1;
        const speed = output && typeof output === "object" ? output.speed : 0;
        group?.traverse((object) => {
            if (object.name === "Motor shaft") object.rotation.z = motorPhase * speed / 255 * direction;
        });
    }
    if (lowModeToggle.checked) drawLowEnd();
    else if (renderer && scene && camera) renderer.render(scene, camera);
    const servoMoving = !simulationPaused && (Math.abs(targetAngle - currentAngle) > 0.4 ||
        servoArms.some((arm) => Math.abs((typeof simulation.outputs[arm.userData.componentId] === "number"
            ? simulation.outputs[arm.userData.componentId]
            : targetAngle) - arm.userData.currentAngle) > 0.4));
    const motorRunning = running && !simulationPaused &&
        Object.values(simulation.outputs).some((output) => output && typeof output === "object" && output.speed > 0);
    if ((running && !simulationPaused) || servoMoving || motorRunning) {
        animationFrame = window.requestAnimationFrame(renderFrame);
    }
}

function startRendering() {
    if (!animationFrame && !editor.hidden) {
        resizeCanvas();
        animationFrame = window.requestAnimationFrame(renderFrame);
    }
}

function stopRendering() {
    stopSimulation();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
}

function stageDropPosition(event) {
    const bounds = stage.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 76;
    const z = ((event.clientY - bounds.top) / bounds.height - 0.5) * 54;
    return { x, z };
}

function downloadSketch() {
    const blob = new Blob([codeEditor.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smart-desk-robotics.ino";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

partsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-part]");
    if (button) addPart(button.dataset.addPart);
});

partsList.addEventListener("dragstart", (event) => {
    const button = event.target.closest("[data-add-part]");
    if (button) event.dataTransfer.setData("text/plain", button.dataset.addPart);
});

stage.addEventListener("dragover", (event) => event.preventDefault());
stage.addEventListener("drop", (event) => {
    event.preventDefault();
    addPart(event.dataTransfer.getData("text/plain"), stageDropPosition(event));
});

placedParts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-part]");
    if (button) removePart(button.dataset.removePart);
});
placedParts.addEventListener("change", (event) => {
    const input = event.target.closest("[data-component-pins]");
    if (input) updatePinAssignment(input);
});

wireForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addWire(wireFrom.value, wireTo.value, wireKind.value);
});
wireList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-wire]");
    if (button) removeWire(button.dataset.removeWire);
});

editor.querySelector("[data-robotics-search]").addEventListener("input", renderLibrary);
editor.querySelector("[data-robotics-low]").addEventListener("change", () => {
    try {
        localStorage.setItem(RENDER_MODE_KEY, String(lowModeToggle.checked));
    } catch (error) {
        setStatus(`Render mode changed, but the preference could not be saved: ${error.message}`, true);
    }
    createRenderer();
    drawScene();
    startRendering();
});
editor.querySelector("[data-robotics-run]").addEventListener("click", () => {
    if (!running) startSimulation();
    else pauseSimulation();
});
editor.querySelector("[data-robotics-stop]").addEventListener("click", () => {
    stopSimulation();
    setStatus("Simulation stopped. Start again to reset the program state; no hardware is connected.");
});
editor.querySelector("[data-robotics-save]").addEventListener("click", saveProject);
editor.querySelector("[data-robotics-generate]").addEventListener("click", () => {
    const blockingWarnings = getWiringWarnings().filter((warning) =>
        /valid Uno pin|analog output|PWM pin|both use|USB serial connection/.test(warning)
    );
    if (blockingWarnings.length) {
        setStatus("Fix the pin errors in Wiring check before generating the sketch.", true);
        return;
    }
    try {
        codeEditor.value = generateBlockSketch(project.components, project.blocks || []);
        project.code = codeEditor.value;
        saveProject();
        setStatus("Sketch generated from blocks. Simulation runs a separate block interpreter; verify and compile this C++ with your board toolchain.");
    } catch (error) {
        setStatus(`Could not generate the sketch: ${error.message}`, true);
    }
});
editor.querySelector("[data-robotics-download]").addEventListener("click", downloadSketch);
editor.querySelectorAll("[data-code-tab]").forEach((tab) => tab.addEventListener("click", () => {
    const showBlocks = tab.dataset.codeTab === "blocks";
    editor.querySelector("[data-block-editor]").hidden = !showBlocks;
    editor.querySelector("[data-code-view]").hidden = showBlocks;
    editor.querySelectorAll("[data-code-tab]").forEach((item) =>
        item.setAttribute("aria-selected", String(item === tab))
    );
    if (!showBlocks) setStatus("C++ edits are saved in the project; they do not update the visual blocks.");
}));
const codeFullscreenButton = editor.querySelector("[data-code-fullscreen]");
function setCodeFullscreen(isFullscreen, restoreFocus = true) {
    editor.classList.toggle("code-fullscreen", isFullscreen);
    codeFullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
    codeFullscreenButton.textContent = isFullscreen ? "×" : "⛶";
    codeFullscreenButton.setAttribute(
        "aria-label",
        isFullscreen ? "Close full-screen coding editor" : "Expand coding editor to full screen"
    );
    codeFullscreenButton.title = isFullscreen ? "Back to robotics studio" : "Expand coding editor";
    if (!isFullscreen && restoreFocus) codeFullscreenButton.focus();
}
codeFullscreenButton.addEventListener("click", () => {
    setCodeFullscreen(!editor.classList.contains("code-fullscreen"));
});
editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editor.classList.contains("code-fullscreen")) {
        event.preventDefault();
        event.stopPropagation();
        setCodeFullscreen(false);
    }
});
editor.querySelectorAll("[data-add-block]").forEach((button) => button.addEventListener("click", () => {
    addCodeBlock(button.dataset.addBlock);
}));
editor.querySelectorAll("[data-add-block]").forEach((button) => button.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-smartdesk-block", `new:${button.dataset.addBlock}`);
    event.dataTransfer.setData("text/plain", `new:${button.dataset.addBlock}`);
}));
blockStack.addEventListener("change", (event) => {
    const field = event.target.closest("[data-block-property]");
    if (field) updateBlockFromField(field);
});
blockStack.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-to-stack]");
    if (addButton) {
        const targetList = getBlockList(addButton.dataset.blockOwner, addButton.dataset.blockBranch);
        if (targetList) addCodeBlock(addButton.dataset.blockType, targetList.length, targetList);
        return;
    }
    const button = event.target.closest("[data-block-action]");
    if (!button) return;
    if (button.dataset.blockAction === "remove") {
        const location = findBlockLocation(button.dataset.blockId);
        if (location) {
            if (location.block.type === "defineFunction") {
                const clearCalls = (items) => items.forEach((candidate) => {
                    if (candidate.type === "callFunction" && candidate.functionName === location.block.functionName) candidate.functionName = "";
                    clearCalls(candidate.children || []);
                    clearCalls(candidate.elseChildren || []);
                });
                clearCalls(project.blocks);
            }
            location.list.splice(location.index, 1);
        }
        renderBlockStack();
        regenerateFromBlocks();
    } else moveCodeBlock(button.dataset.blockId, button.dataset.blockAction);
});
blockStack.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-block-id]");
    if (!card || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    moveCodeBlock(card.dataset.blockId, event.key === "ArrowUp" ? "up" : "down");
});
blockStack.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-block-id]");
    if (!card || event.target.closest("button, input, select")) {
        event.preventDefault();
        return;
    }
    const draggedBlockId = card.dataset.blockId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-smartdesk-block", `move:${draggedBlockId}`);
    event.dataTransfer.setData("text/plain", `move:${draggedBlockId}`);
});
blockWorkspace.addEventListener("dragover", (event) => {
    const payload = event.dataTransfer.types.includes("application/x-smartdesk-block") ||
        event.dataTransfer.types.includes("text/plain");
    if (!payload) return;
    event.preventDefault();
    blockStack.classList.add("is-block-drop-target");
    blockStack.querySelectorAll(".is-block-insertion-target").forEach((item) => item.classList.remove("is-block-insertion-target"));
    event.target.closest("[data-block-id]")?.classList.add("is-block-insertion-target");
});
blockWorkspace.addEventListener("drop", (event) => {
    event.preventDefault();
    const targetSlot = event.target.closest("[data-block-owner]");
    let target = event.target.closest("[data-block-id]");
    if (targetSlot && target?.dataset.blockId === targetSlot.dataset.blockOwner) target = null;
    const payload = event.dataTransfer.getData("application/x-smartdesk-block") || event.dataTransfer.getData("text/plain");
    if (!payload) return;
    const destinationList = targetSlot
        ? getBlockList(targetSlot.dataset.blockOwner, targetSlot.dataset.blockBranch)
        : project.blocks;
    if (!destinationList) return;
    let targetLocation = target ? findBlockLocation(target.dataset.blockId) : null;
    let afterTarget = false;
    let insertionIndex = destinationList.length;
    if (target) {
        const bounds = target.getBoundingClientRect();
        afterTarget = event.clientY >= bounds.top + bounds.height / 2;
        if (targetLocation) insertionIndex = targetLocation.index + (afterTarget ? 1 : 0);
    }
    if (payload.startsWith("new:")) {
        const list = targetLocation ? targetLocation.list : destinationList;
        addCodeBlock(payload.slice(4), targetLocation ? insertionIndex : list.length, list);
    } else if (payload.startsWith("move:")) {
        const sourceId = payload.slice(5);
        if (sourceId !== target?.dataset.blockId) {
            if (targetLocation) moveCodeBlock(sourceId, target.dataset.blockId, afterTarget, targetLocation.list);
            else moveCodeBlock(sourceId, "", false, destinationList);
        }
    }
    blockStack.classList.remove("is-block-drop-target");
    blockStack.querySelectorAll(".is-block-insertion-target").forEach((item) => item.classList.remove("is-block-insertion-target"));
});
blockWorkspace.addEventListener("dragleave", (event) => {
    if (!blockWorkspace.contains(event.relatedTarget)) {
        blockStack.classList.remove("is-block-drop-target");
        blockStack.querySelectorAll(".is-block-insertion-target").forEach((item) => item.classList.remove("is-block-insertion-target"));
    }
});
editor.addEventListener("dragend", () => {
    blockStack.classList.remove("is-block-drop-target");
    blockStack.querySelectorAll(".is-block-insertion-target").forEach((item) => item.classList.remove("is-block-insertion-target"));
});
editor.querySelector("[data-robotics-load-template]").addEventListener("click", loadStarterTemplate);
editor.querySelector("[data-robotics-export]").addEventListener("click", exportProject);
editor.querySelector("[data-robotics-import-trigger]").addEventListener("click", () => {
    editor.querySelector("[data-robotics-import]").click();
});
editor.querySelector("[data-robotics-import]").addEventListener("change", (event) => {
    const input = event.currentTarget;
    importProject(input.files[0]).finally(() => {
        input.value = "";
    });
});
codeEditor.addEventListener("input", () => {
    project.code = codeEditor.value;
    saveProject();
});

for (const input of [
    angleSlider, distanceSlider, irSlider, pirSlider, moistureSlider, lightSlider,
    potentiometerSlider, rainSlider, temperatureSlider, buttonSlider
]) {
    input.addEventListener("input", () => {
        if (input === angleSlider && !running) targetAngle = Number(angleSlider.value);
        updateSensorReadouts();
        drawScene();
        if (input === angleSlider) startRendering();
    });
}

stage.addEventListener("pointerdown", (event) => {
    dragState = { x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    cameraYaw += (event.clientX - dragState.x) * 0.012;
    cameraPitch = clamp(cameraPitch + (dragState.y - event.clientY) * 0.008, 0.2, 1.35);
    dragState = { x: event.clientX, y: event.clientY };
    updateCamera();
    drawScene();
});
stage.addEventListener("pointerup", () => { dragState = null; });
stage.addEventListener("pointercancel", () => { dragState = null; });
stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    cameraDistance = clamp(cameraDistance + event.deltaY * 0.08, 75, 220);
    updateCamera();
    drawScene();
}, { passive: false });

editor.querySelector("[data-close-robotics]").addEventListener("click", () => {
    window.dispatchEvent(new Event("smartdesk:close-studios"));
});

window.addEventListener("smartdesk:robotics-open", () => {
    if (!project.components.length) readProject();
    createRenderer();
    drawScene();
    startRendering();
});
window.addEventListener("smartdesk:robotics-close", () => {
    setCodeFullscreen(false, false);
    stopRendering();
});
editor.addEventListener("click", (event) => event.stopPropagation());
window.addEventListener("resize", resizeCanvas);
resizeObserver = new ResizeObserver(() => {
    if (!editor.hidden && lowModeToggle.checked) drawLowEnd();
    else resizeCanvas();
});
resizeObserver.observe(stage);
window.addEventListener("beforeunload", () => {
    stopRendering();
    if (renderer) renderer.dispose();
    resizeObserver.disconnect();
});

readProject();
try {
    lowModeToggle.checked = localStorage.getItem(RENDER_MODE_KEY) === "true";
} catch (error) {
    setStatus(`Could not restore the low-end mode preference: ${error.message}`, true);
}
