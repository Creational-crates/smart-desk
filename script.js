import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { export3mf, import3mf } from "./cad-3mf.js";
import { exportFacetedStep, importFacetedStep } from "./cad-step.js";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { analyzeTriangleMesh } from "./cad-mesh-analysis.js";
import { sliceMeshes } from "./cad-slicer.js";
import {
    createPcbManufacturingZip,
    generatePcbManufacturingFiles,
    validatePcbManufacturingProject
} from "./pcb-manufacturing.js";

// SMART DESK OS: Core interactions

const $ = (id) => document.getElementById(id);
// Elements
const bubbleUniverse = $("bubbleUniverse");
const assistantBubble = $("assistantBubble");
const orbitBubbles = $("orbitBubbles");
const diwaliScene = document.querySelector(".diwali-scene");
const blankScreen = $("blankScreen");
let blankScreenTimer;
let isOpeningBlankScreen = false;

const leftSidebar = $("leftSidebar");
const rightSidebar = $("rightSidebar");
const overlay = $("sidebarOverlay");

const leftTrigger = $("leftSidebarTrigger");
const rightTrigger = $("rightSidebarTrigger");

const defaultTheme = { main: "#6487bd", side: "#e7f2fb" };
const diwaliThemeColors = { main: "#b94f13", side: "#fff1d2" };
const themeStorageKey = "smart-desk-theme";
let colorMode = "light";
let diwaliThemeEnabled = false;
let savedThemeColors = { ...defaultTheme };
const nameStorageKey = "smart-desk-name";
const themeInputs = document.querySelectorAll("[data-theme-input]");
const themePresets = document.querySelectorAll("[data-theme-preset]");
const sidebars = [leftSidebar, rightSidebar];
const accountPanels = document.querySelectorAll("[data-account-panel]");
const displayName = $("displayName");
const newDesignScreen = $("newDesign");
const pcbSetup = $("pcbSetup");
const pcbEditor = $("pcbEditor");
const pcbBoard = document.querySelector("[data-pcb-board]");
const roboticsStudio = $("roboticsStudio");
const modelEditor = $("modelEditor");
const modelCanvas = document.querySelector("[data-model-canvas]");
const objectList = document.querySelector("[data-object-list]");
const inspectorContent = document.querySelector("[data-inspector-content]");
const inspectorEmpty = document.querySelector("[data-inspector-empty]");
const editorProjectName = document.querySelector("[data-editor-project-name]");
const projectStorageKey = "smart-desk-3d-projects";
const canvasProjectStorageKey = "smart-desk-2d-project";
const pcbProjectStorageKey = "smart-desk-pcb-project";
const pcbProjectsStorageKey = "smart-desk-pcb-projects";
const pcbThemes = ["forest", "ocean", "midnight", "amber"];
const pcbViewModes = ["3d", "color", "mono"];
const pcbComponentCategories = [
    "Passives", "Semiconductors", "Power", "Connectors", "Controls", "Microcontrollers", "Modules",
    "Robotics", "Robotics · Controllers", "Robotics · Servos", "Robotics · Motor control", "Robotics · Sensors",
    "Robotics · Ultrasonic", "Robotics · Power", "Robotics · Battery management", "Robotics · Communication"
];
const pcbRoboticsTemplates = [
    { id: "custom", name: "Custom robotics board", controller: "", parts: [], voltage: 5, functions: [], rails: [] },
    {
        id: "esp32-development", name: "ESP32 development board", controller: "esp32", parts: ["esp32", "power"],
        voltage: 3.3, functions: [
            { id: "robot-esp32-gpio18", name: "Actuator PWM", group: "Actuator control", preferredPins: ["GPIO18", "GPIO19", "GPIO21"] },
            { id: "robot-esp32-gpio21", name: "I²C SDA", group: "Sensor bus", preferredPins: ["GPIO21", "GPIO22"] },
            { id: "robot-esp32-gpio22", name: "I²C SCL", group: "Sensor bus", preferredPins: ["GPIO22", "GPIO21"] }
        ], rails: [{ id: "logic", name: "Logic rail", voltage: 3.3, minimum: 3.0, maximum: 3.6 }]
    },
    {
        id: "arduino-controller", name: "Arduino controller board", controller: "arduinoUno", parts: ["arduinoUno", "power"],
        voltage: 5, functions: [
            { id: "robot-arduino-d3", name: "Actuator PWM", group: "Actuator control", preferredPins: ["D3", "D5", "D6", "D9", "D10", "D11"] },
            { id: "robot-arduino-a4", name: "I²C SDA", group: "Sensor bus", preferredPins: ["A4"] },
            { id: "robot-arduino-a5", name: "I²C SCL", group: "Sensor bus", preferredPins: ["A5"] }
        ], rails: [{ id: "logic", name: "Logic rail", voltage: 5, minimum: 4.5, maximum: 5.5 }]
    },
    {
        id: "servo-controller", name: "Servo controller board", controller: "arduinoUno", parts: ["arduinoUno", "servoConnector", "power", "ground"],
        voltage: 5, functions: [1, 2, 3].map((number, index) => ({
            id: `robot-servo-${number}`, name: `Servo ${number} signal`, group: "Servo planning",
            preferredPins: [["D3", "D5", "D6"], ["D9", "D10", "D11"], ["D5", "D6", "D9"]][index]
        })),
        rails: [{ id: "logic", name: "Controller logic", voltage: 5, minimum: 4.5, maximum: 5.5 },
            { id: "servo", name: "Servo supply (check servo datasheet)", voltage: 5, minimum: 4.8, maximum: 6 }]
    },
    {
        id: "dc-motor-driver", name: "DC motor driver board", controller: "arduinoUno", parts: ["arduinoUno", "motorDriver", "power"],
        voltage: 5, functions: [
            { id: "robot-motor-pwm-a", name: "Motor A PWM", group: "Motor driver", preferredPins: ["D3", "D5", "D6", "D9", "D10", "D11"] },
            { id: "robot-motor-pwm-b", name: "Motor B PWM", group: "Motor driver", preferredPins: ["D5", "D6", "D9", "D10", "D11", "D3"] },
            { id: "robot-motor-dir-a", name: "Motor A direction", group: "Motor driver", preferredPins: ["D7", "D8", "D4", "D2"] },
            { id: "robot-motor-dir-b", name: "Motor B direction", group: "Motor driver", preferredPins: ["D8", "D7", "D4", "D2"] }
        ], rails: [{ id: "logic", name: "Controller logic", voltage: 5, minimum: 4.5, maximum: 5.5 },
            { id: "motor", name: "Motor supply (check driver/motor ratings)", voltage: 6, minimum: 3, maximum: 12 }]
    },
    {
        id: "sensor-interface", name: "Sensor interface board", controller: "esp32", parts: ["esp32", "sensor", "sensorConnector"],
        voltage: 3.3, functions: [
            { id: "robot-sensor-sda", name: "I²C SDA", group: "Sensor interface", preferredPins: ["GPIO21", "GPIO22"] },
            { id: "robot-sensor-scl", name: "I²C SCL", group: "Sensor interface", preferredPins: ["GPIO22", "GPIO21"] },
            { id: "robot-sensor-interrupt", name: "Sensor interrupt", group: "Sensor interface", preferredPins: ["GPIO27", "GPIO26", "GPIO25"] }
        ], rails: [{ id: "logic", name: "Sensor/controller logic", voltage: 3.3, minimum: 3, maximum: 3.6 }]
    },
    {
        id: "ultrasonic-sensor", name: "Ultrasonic sensor board", controller: "arduinoUno", parts: ["arduinoUno", "ultrasonicConnector", "power"],
        voltage: 5, functions: [
            { id: "robot-ultrasonic-trigger", name: "Ultrasonic TRIG", group: "Ultrasonic sensor", preferredPins: ["D7", "D8", "D4"] },
            { id: "robot-ultrasonic-echo", name: "Ultrasonic ECHO", group: "Ultrasonic sensor", preferredPins: ["D8", "D7", "D4"] }
        ], rails: [{ id: "logic", name: "Logic / sensor rail", voltage: 5, minimum: 4.5, maximum: 5.5 }]
    },
    {
        id: "power-distribution", name: "Power distribution board", controller: "", parts: ["power", "regulator", "connector", "ground"],
        voltage: 5, functions: [], rails: [
            { id: "input", name: "External input (verify regulator input range)", voltage: 9, minimum: 4.5, maximum: 12 },
            { id: "logic", name: "Regulated logic output", voltage: 5, minimum: 4.8, maximum: 5.2 }
        ]
    },
    {
        id: "battery-interface", name: "Battery management interface", controller: "", parts: ["batteryConnector", "power", "regulator", "connector", "diode"],
        voltage: 5, functions: [], rails: [
            { id: "battery", name: "Battery input (external protection/BMS required)", voltage: 7.4, minimum: 0.1, maximum: 12 },
            { id: "logic", name: "Regulated logic output", voltage: 5, minimum: 4.8, maximum: 5.2 }
        ]
    },
    {
        id: "robot-controller", name: "Robot controller board", controller: "esp32", parts: ["esp32", "motorDriver", "servoConnector", "sensorConnector", "power"],
        voltage: 3.3, functions: [
            { id: "robot-main-motor-left", name: "Left motor PWM", group: "Motor planning", preferredPins: ["GPIO18", "GPIO19", "GPIO23"] },
            { id: "robot-main-motor-right", name: "Right motor PWM", group: "Motor planning", preferredPins: ["GPIO19", "GPIO23", "GPIO18"] },
            { id: "robot-main-servo", name: "Servo signal", group: "Servo planning", preferredPins: ["GPIO21", "GPIO22", "GPIO25"] },
            { id: "robot-main-sda", name: "I²C SDA", group: "Sensor planning", preferredPins: ["GPIO21", "GPIO22"] },
            { id: "robot-main-scl", name: "I²C SCL", group: "Sensor planning", preferredPins: ["GPIO22", "GPIO21"] }
        ], rails: [{ id: "logic", name: "Controller logic", voltage: 3.3, minimum: 3, maximum: 3.6 },
            { id: "servo", name: "Servo supply (separate high-current rail)", voltage: 5, minimum: 4.8, maximum: 6 },
            { id: "motor", name: "Motor supply (check driver/motor ratings)", voltage: 6, minimum: 3, maximum: 12 }]
    },
    {
        id: "communication-interface", name: "Communication interface board", controller: "esp32", parts: ["esp32", "sensorConnector", "connector"],
        voltage: 3.3, functions: [
            { id: "robot-comm-tx", name: "UART TX", group: "Communication interface", preferredPins: ["GPIO17", "TX0/GPIO1"] },
            { id: "robot-comm-rx", name: "UART RX", group: "Communication interface", preferredPins: ["GPIO16", "RX0/GPIO3"] },
            { id: "robot-comm-sda", name: "I²C SDA", group: "Communication interface", preferredPins: ["GPIO21", "GPIO22"] },
            { id: "robot-comm-scl", name: "I²C SCL", group: "Communication interface", preferredPins: ["GPIO22", "GPIO21"] }
        ], rails: [{ id: "logic", name: "Communication logic", voltage: 3.3, minimum: 3, maximum: 3.6 }]
    }
];
const pcbComponent = (name, category, prefix, width, height, color, pinNames, specs, symbol, footprint, description) => ({
    name, category, prefix, width, height, color, pins: pinNames.length, pinNames, electrical: specs,
    symbol, footprint: { type: footprint, width, height, pads: pinNames.length, pitch: 2.54 },
    description
});
const arduinoUnoLegacyPins = [
    ...Array.from({ length: 14 }, (_, index) => `D${index}`),
    ...Array.from({ length: 6 }, (_, index) => `A${index}`),
    "5V", "3V3", "GND", "VIN"
];
const arduinoUnoDigitalPins = [
    ...Array.from({ length: 14 }, (_, index) => `D${index}`),
    "GND", "AREF", "SDA", "SCL"
];
const arduinoUnoPowerPins = ["IOREF", "RESET", "3V3", "5V", "GND", "GND", "VIN"];
const arduinoUnoAnalogPins = Array.from({ length: 6 }, (_, index) => `A${index}`);
const arduinoUnoIcspPins = ["ICSP_MISO", "ICSP_5V", "ICSP_SCK", "ICSP_MOSI", "ICSP_RESET", "ICSP_GND"];
const arduinoUnoExtraPins = ["GND", "AREF", "SDA", "SCL", "IOREF", "RESET", "GND", ...arduinoUnoIcspPins];
const arduinoUnoPinNames = [...arduinoUnoLegacyPins, ...arduinoUnoExtraPins];
const arduinoUnoPhysicalPads = [
    ...arduinoUnoDigitalPins.map((name, index) => ({
        name, x: -21.59 + index * 2.54, y: -21.5, labelSide: "above"
    })),
    ...arduinoUnoPowerPins.map((name, index) => ({
        name, x: -24.0, y: -10 + index * 2.54, labelSide: "right"
    })),
    ...arduinoUnoAnalogPins.map((name, index) => ({
        name, x: -22 + index * 2.54, y: 21.5, labelSide: "below"
    })),
    ...arduinoUnoIcspPins.map((name, index) => ({
        name, x: 14 + (index % 2) * 2.54, y: 12 + Math.floor(index / 2) * 2.54, labelSide: "right"
    }))
];
const arduinoUnoPhysicalPadsByName = new Map();
arduinoUnoPhysicalPads.forEach((pad) => {
    if (!arduinoUnoPhysicalPadsByName.has(pad.name)) arduinoUnoPhysicalPadsByName.set(pad.name, []);
    arduinoUnoPhysicalPadsByName.get(pad.name).push(pad);
});
const arduinoUnoPinOccurrences = new Map();
const arduinoUnoLayoutPads = arduinoUnoPinNames.map((name) => {
    const occurrence = arduinoUnoPinOccurrences.get(name) || 0;
    arduinoUnoPinOccurrences.set(name, occurrence + 1);
    return arduinoUnoPhysicalPadsByName.get(name)?.[occurrence] || { name, x: 0, y: 0 };
});
const esp32DevKitCLegacyPins = [
    "3V3", "GND", "EN", "VP/GPIO36", "VN/GPIO39", "GPIO34", "GPIO35", "GPIO32", "GPIO33", "GPIO25",
    "GPIO26", "GPIO27", "GPIO14", "GPIO12", "GND", "GPIO13", "SD2/GPIO9", "SD3/GPIO10", "CMD/GPIO11",
    "CLK/GPIO6", "SD0/GPIO7", "SD1/GPIO8", "GPIO5", "GPIO18", "GPIO19", "GPIO21", "RX0/GPIO3", "TX0/GPIO1",
    "GPIO22", "GPIO23", "GND", "5V"
];
const esp32DevKitCLeftPins = [
    "3V3", "EN", "VP/GPIO36", "VN/GPIO39", "GPIO34", "GPIO35", "GPIO32", "GPIO33", "GPIO25",
    "GPIO26", "GPIO27", "GPIO14", "GPIO12", "GND", "GPIO13", "SD2/GPIO9", "SD3/GPIO10", "CMD/GPIO11", "5V"
];
const esp32DevKitCRightPins = [
    "GND", "GPIO23", "GPIO22", "TX0/GPIO1", "RX0/GPIO3", "GPIO21", "GND", "GPIO19", "GPIO18",
    "GPIO5", "GPIO17", "GPIO16", "GPIO4", "GPIO0", "GPIO2", "GPIO15", "SD1/GPIO8", "SD0/GPIO7", "CLK/GPIO6"
];
const esp32DevKitCPhysicalPads = [
    ...esp32DevKitCLeftPins.map((name, index) => ({
        name, x: -10.8, y: -22.86 + index * 2.54, labelSide: "right"
    })),
    ...esp32DevKitCRightPins.map((name, index) => ({
        name, x: 10.8, y: -22.86 + index * 2.54, labelSide: "left"
    }))
];
const esp32DevKitCPinNames = [...esp32DevKitCLegacyPins, "GPIO17", "GPIO16", "GPIO4", "GPIO0", "GPIO2", "GPIO15"];
const esp32DevKitCPhysicalPadsByName = new Map();
esp32DevKitCPhysicalPads.forEach((pad) => {
    if (!esp32DevKitCPhysicalPadsByName.has(pad.name)) esp32DevKitCPhysicalPadsByName.set(pad.name, []);
    esp32DevKitCPhysicalPadsByName.get(pad.name).push(pad);
});
const esp32DevKitCPinOccurrences = new Map();
const esp32DevKitCLayoutPads = esp32DevKitCPinNames.map((name) => {
    const occurrence = esp32DevKitCPinOccurrences.get(name) || 0;
    esp32DevKitCPinOccurrences.set(name, occurrence + 1);
    return esp32DevKitCPhysicalPadsByName.get(name)?.[occurrence] || { name, x: 0, y: 0 };
});
const pcbParts = {
    resistor: pcbComponent("Resistor", "Passives", "R", 10, 4, "#c79656", ["1", "2"], { resistance: "10 kΩ", power: "0.25 W", tolerance: "±5%" }, "resistor", "axial-through-hole", "General-purpose fixed resistor."),
    capacitor: pcbComponent("Capacitor", "Passives", "C", 6, 6, "#d3d9d4", ["1", "2"], { capacitance: "100 nF", voltage: "50 V", dielectric: "Ceramic" }, "capacitor", "radial-through-hole", "Ceramic decoupling capacitor."),
    led: pcbComponent("LED", "Semiconductors", "D", 6, 6, "#e76d69", ["A", "K"], { color: "Red", forwardVoltage: "2.0 V", current: "20 mA" }, "led", "led-5mm-through-hole", "5 mm indicator LED; observe anode and cathode."),
    diode: pcbComponent("Diode", "Semiconductors", "D", 7, 4, "#d3b86e", ["A", "K"], { type: "Rectifier", maximumCurrent: "1 A", reverseVoltage: "50 V" }, "diode", "axial-through-hole", "General-purpose rectifier diode."),
    transistor: pcbComponent("NPN transistor", "Semiconductors", "Q", 6, 7, "#55666a", ["B", "C", "E"], { type: "NPN", maximumCurrent: "600 mA", maximumVoltage: "40 V" }, "transistor", "to-92-through-hole", "Small-signal NPN bipolar transistor."),
    mosfet: pcbComponent("N-channel MOSFET", "Semiconductors", "Q", 7, 8, "#47585d", ["G", "D", "S"], { channel: "N", maximumVoltage: "30 V", gate: "Logic level" }, "mosfet", "to-220-through-hole", "Logic-level N-channel switching MOSFET."),
    regulator: pcbComponent("Voltage regulator", "Power", "U", 8, 8, "#4d5a58", ["IN", "GND", "OUT"], { output: "3.3 V", input: "4.5–12 V", current: "800 mA" }, "regulator", "sot-223-smd", "Linear regulator for a regulated low-voltage rail."),
    connector: pcbComponent("Pin header", "Connectors", "J", 12, 5, "#202b2b", ["1", "2", "3", "4"], { pitch: "2.54 mm", rows: "1", mounting: "Through-hole" }, "connector", "1x4-pin-header", "General-purpose 1 × 4 board header."),
    switch: pcbComponent("Slide switch", "Controls", "SW", 8, 8, "#48545a", ["1", "COM", "2"], { positions: "SPDT", rating: "12 V · 100 mA" }, "switch", "spdt-slide-through-hole", "Three-terminal SPDT slide switch."),
    button: pcbComponent("Push button", "Controls", "SW", 8, 8, "#48545a", ["1A", "1B", "2A", "2B"], { type: "Momentary NO", rating: "12 V · 50 mA" }, "switch", "6mm-tactile-through-hole", "Normally-open tactile momentary push button."),
    power: pcbComponent("Power source", "Power", "BT", 10, 8, "#b78845", ["+", "−"], { nominalVoltage: "5 V", source: "External supply" }, "source", "2-pin-power-terminal", "Two-pin DC power input terminal."),
    ground: pcbComponent("Ground terminal", "Power", "GND", 6, 6, "#748a7c", ["GND"], { net: "GND", pins: "1" }, "ground", "single-ground-pad", "Single-pin ground reference terminal."),
    arduinoUno: {
        ...pcbComponent("Arduino Uno R3", "Microcontrollers", "A", 68.6, 53.4, "#008184", arduinoUnoPinNames, {
            processor: "ATmega328P · 16 MHz", usbInterface: "ATmega16U2", logic: "5 V",
            digitalIO: "14 · 6 PWM", analogInput: "6 · 10-bit ADC", onboardPower: "5 V, 3.3 V",
            board: "68.6 × 53.4 mm · 2.54 mm headers", interface: "USB-B · barrel jack · ICSP"
        }, "module", "arduino-uno-r3-through-hole", "Arduino Uno Rev3 board with ATmega328P, ATmega16U2 USB interface, power input, reset, ICSP and correctly named headers."),
        boardModel: "arduino-uno-r3",
        layoutPads: arduinoUnoLayoutPads,
        boardThickness: 1.6
    },
    esp32: {
        ...pcbComponent("ESP32 DevKitC V4", "Microcontrollers", "U", 27.9, 54.4, "#187a55", esp32DevKitCPinNames, {
            processor: "ESP32-D0WD-V3 · dual-core Xtensa LX6",
            module: "ESP-WROOM-32 · 2.4 GHz Wi-Fi + Bluetooth",
            logic: "3.3 V", usbInterface: "USB-to-UART bridge · Micro-USB", onboardPower: "5 V / AMS1117 3.3 V",
            board: "27.9 × 54.4 mm · 38-pin · 2.54 mm headers",
            caution: "GPIO6–GPIO11 are connected to module flash; avoid general-purpose use."
        }, "module", "esp32-devkitc-v4-38pin", "Espressif ESP32-DevKitC V4 with ESP-WROOM-32, micro-USB, CP2102N, 3.3 V regulator, EN/BOOT buttons and the documented 38-pin header layout."),
        boardModel: "esp32-devkitc-v4",
        layoutPads: esp32DevKitCLayoutPads,
        boardThickness: 1.6
    },
    mcu: pcbComponent("ATmega microcontroller", "Microcontrollers", "U", 18, 18, "#28312f", ["RESET", "VCC", "GND", "XTAL1", "XTAL2", "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "A0", "A1", "A2", "A3", "A4", "A5", "AVCC", "AREF", "GND"], { logic: "5 V", flash: "32 KB", package: "DIP-28" }, "ic", "dip-28-through-hole", "ATmega328P-class 8-bit microcontroller in a DIP-28 package."),
    ic: pcbComponent("Op-amp", "Semiconductors", "U", 12, 8, "#28312f", ["OUT A", "−IN A", "+IN A", "V−", "+IN B", "−IN B", "OUT B", "V+"], { type: "Dual op-amp", supply: "3–32 V" }, "ic", "soic-8-smd", "Dual operational amplifier in an eight-pin package."),
    motorDriver: pcbComponent("Motor driver", "Modules", "U", 15, 12, "#34404a", ["VM", "VCC", "GND", "A01", "A02", "B01", "B02", "PWMA", "AIN1", "AIN2", "STBY", "BIN1", "BIN2", "PWMB"], { motorVoltage: "2–10 V", logic: "3.3–5 V", channels: "2" }, "module", "dual-motor-driver-module", "Dual H-bridge motor driver breakout."),
    servoConnector: pcbComponent("Servo connector", "Connectors", "J", 9, 5, "#253433", ["GND", "5V", "PWM"], { pitch: "2.54 mm", signal: "PWM", voltage: "5 V" }, "connector", "1x3-servo-header", "Three-pin servo power, ground and control connector."),
    sensor: pcbComponent("Sensor module", "Modules", "A", 15, 12, "#34404a", ["VCC", "GND", "SDA", "SCL"], { bus: "I²C", logic: "3.3–5 V" }, "module", "i2c-sensor-breakout", "Generic I²C sensor breakout module."),
    sensorConnector: pcbComponent("Sensor connector", "Connectors", "J", 10, 6, "#34404a", ["VCC", "GND", "SDA", "SCL"], { interface: "I²C", pitch: "2.54 mm" }, "connector", "1x4-sensor-header", "Four-pin connector for common digital sensors."),
    ultrasonicConnector: pcbComponent("Ultrasonic sensor connector", "Connectors", "J", 10, 6, "#34404a", ["VCC", "TRIG", "ECHO", "GND"], { interface: "Trigger/echo", voltage: "5 V", signalCompatibility: "Echo may require level shifting for 3.3 V GPIO" }, "connector", "1x4-ultrasonic-header", "Four-pin ultrasonic range sensor interface; verify module voltage and echo level shifting."),
    batteryConnector: pcbComponent("Battery management interface", "Power", "J", 12, 7, "#34404a", ["BATT+", "BATT−", "BMS_SDA", "BMS_SCL", "NTC"], { interface: "External battery monitor/BMS connection only", cells: "Verify chemistry and series count", caution: "Not a charger or cell-protection circuit" }, "connector", "1x5-battery-monitor-header", "Battery monitor/BMS interface connector only; it does not provide charging, balancing, or cell protection.")
};
let customPcbParts = {};
const getPcbPartDefinition = (type) => Object.hasOwn(pcbParts, type)
    ? pcbParts[type]
    : Object.hasOwn(customPcbParts, type)
        ? customPcbParts[type]
        : null;
const pcbComponentLibraryStorageKey = "smart-desk-pcb-component-library";

function getPcbRoboticsCategories(type) {
    const categories = [];
    if (["arduinoUno", "esp32", "mcu"].includes(type)) categories.push("Robotics · Controllers");
    if (type === "servoConnector" || type === "button") categories.push("Robotics · Servos");
    if (type === "motorDriver" || type === "mosfet") categories.push("Robotics · Motor control");
    if (["sensor", "sensorConnector", "ultrasonicConnector"].includes(type)) categories.push("Robotics · Sensors");
    if (type === "ultrasonicConnector") categories.push("Robotics · Ultrasonic");
    if (["power", "ground", "regulator", "diode"].includes(type)) categories.push("Robotics · Power");
    if (["power", "regulator", "connector", "diode", "batteryConnector"].includes(type)) categories.push("Robotics · Battery management");
    if (["connector", "ic", "sensorConnector"].includes(type)) categories.push("Robotics · Communication");
    return categories;
}

function getPcbRoboticsCategory(type) {
    return getPcbRoboticsCategories(type)[0] || null;
}

function matchesPcbComponentCategory(type, definition, category) {
    if (category === "all") return true;
    if (category === definition.category) return true;
    const roboticsCategories = getPcbRoboticsCategories(type);
    return category === "Robotics" ? roboticsCategories.length > 0 : roboticsCategories.includes(category);
}

function clampPcbPitch(pitch) {
    const boundedPitch = Math.max(-170, Math.min(170, pitch));
    if (boundedPitch > 76 && boundedPitch < 104) return boundedPitch < 90 ? 76 : 104;
    if (boundedPitch < -76 && boundedPitch > -104) return boundedPitch > -90 ? -76 : -104;
    return boundedPitch;
}

let activeProject = null;
let activePcbProject = null;
let pcbProjects = [];
let pcbManufacturingFiles = [];
let pcbManufacturingWarnings = [];
let pcbManufacturingSelectedFile = "";
let pcbUndoStack = [];
let pcbRedoStack = [];
let selectedPcbLibraryType = null;
let editingPcbCustomType = null;
let pcbWorkspaceMode = "board";
let selectedSchematicComponentIds = new Set();
let selectedSchematicPin = null;
let activeSchematicTool = "select";
let selectedPcbLayoutIds = new Set();
let selectedPcbLayoutTrackId = null;
let pcbRouteSuggestions = [];
let pcbConnectivityAnalysis = null;
let pcbConnectivityLayout = null;
let pcbValidationIssues = null;
let pcbValidationDirty = false;
let pcbValidationHighlight = null;
let pcbLayoutPointer = null;
let pcbLayoutDraft = null;
let pcbLayoutSpacePressed = false;
let schematicPointer = null;
let schematicWireDraft = null;
let schematicSnapTarget = null;
let schematicSpacePressed = false;
let selectedPcbPartId = null;
let nextPcbPartId = 0;
let pcbPointer = null;
let pcbSaveTimer;
let pcbCameraFrame = 0;
let pcbRenderedCamera = null;
let selectedObjectId = null;
let selectedObjectIds = [];
let activeTool = "select";
let projectSaveTimer;
let canvasResizeObserver;
let cadRenderer;
let cadScene;
let cadCamera;
let cadControls;
let cadProjection = "perspective";
let orthographicViewHeight = 360;
let cadGrid;
let cadPlate;
let cadMeshes = new Map();
const cadMeshDataIds = new WeakMap();
let nextCadMeshDataId = 1;
let cadRaycaster = new THREE.Raycaster();
let cadGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let cadAnimationFrame = 0;
let undoStack = [];
let redoStack = [];
let lastCommittedProject = "";
let uniformDimensions = true;
let snapToGrid = true;
let viewportCamera = { yaw: 0.78, pitch: 0.68, distance: 400 };
let pointerInteraction = null;
let sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 110);
let measurementPoints = [];
let measurementLine = null;
let sectionEnabled = false;
let measureMode = false;
let activeCanvasProject = null;
let canvasDrawings = [];
let canvasUndoStack = [];
let canvasRedoStack = [];
let canvasTool = "brush";
let canvasPointer = null;
let selectedCanvasIndex = null;
let activeCanvasLayerId = null;
const canvasImageCache = new Map();
const canvasLayerBuffer = document.createElement("canvas");
const defaultCanvasBrushSettings = { profile: "round", tip: "round", opacity: 100, smoothing: 35 };
let canvasSaveTimer;
let canvasZoom = 1;

function loadName() {
    try {
        return (localStorage.getItem(nameStorageKey) || "").trim().slice(0, 40);
    } catch (error) {
        console.warn("Unable to load the saved Smart Desk name.", error);
        return "";
    }
}

function updateNameDisplay(name) {
    displayName.textContent = name;
    displayName.hidden = !name;
    document.querySelectorAll("[data-account-current-name]").forEach((element) => {
        element.textContent = name || "Not set";
    });
}

let savedName = loadName();
updateNameDisplay(savedName);

function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function setTheme(main, side, persist) {
    if (!isHexColor(main) || !isHexColor(side)) {
        throw new Error("Theme colours must be six-digit hexadecimal values.");
    }

    savedThemeColors = { main, side };
    const activeColors = diwaliThemeEnabled ? diwaliThemeColors : savedThemeColors;
    document.documentElement.style.setProperty("--theme-main", activeColors.main);
    document.documentElement.style.setProperty("--theme-side", activeColors.side);
    document.documentElement.dataset.diwaliTheme = String(diwaliThemeEnabled);

    themeInputs.forEach((input) => {
        input.value = input.dataset.themeInput === "main" ? main : side;
    });

    themePresets.forEach((preset) => {
        const presetMain = preset.dataset.main.toLowerCase();
        const presetSide = preset.dataset.side.toLowerCase();
        preset.style.setProperty("--preset-main", preset.dataset.main);
        preset.style.setProperty("--preset-side", preset.dataset.side);
        preset.setAttribute(
            "aria-pressed", String(!diwaliThemeEnabled &&
                presetMain === main.toLowerCase() && presetSide === side.toLowerCase())
        );
    });
    document.querySelectorAll("[data-diwali-theme-toggle]").forEach((toggle) => {
        toggle.checked = diwaliThemeEnabled;
    });

    if (persist) {
        try {
            localStorage.setItem(themeStorageKey, JSON.stringify({
                main, side, mode: colorMode, diwali: diwaliThemeEnabled
            }));
        } catch (error) {
            console.warn("Unable to save the Smart Desk colour theme.", error);
        }
    }
}

function loadTheme() {
    try {
        const savedTheme = localStorage.getItem(themeStorageKey);
        if (savedTheme === null) {
            return { ...defaultTheme, mode: "light", diwali: false };
        }

        const theme = JSON.parse(savedTheme);
        if (isHexColor(theme.main) && isHexColor(theme.side)) {
            return {
                ...theme,
                mode: theme.mode === "dark" ? "dark" : "light",
                diwali: theme.diwali === true
            };
        }

        console.warn("Saved Smart Desk colour theme is invalid; using the default palette.");
    } catch (error) {
        console.warn("Unable to load the saved Smart Desk colour theme.", error);
    }
    
    return { ...defaultTheme, mode: "light", diwali: false };
}

function setSidebarView(view) {
    sidebars.forEach((sidebar) => {
        sidebar.querySelector(".workspace-view").hidden = view !== "workspace";
        sidebar.querySelector("[data-theme-panel]").hidden = view !== "theme";
        sidebar.querySelector("[data-account-panel]").hidden = view !== "account";
    });
}

function setActiveNavigation(group, itemKey) {
    document.querySelectorAll(".sidebar-nav").forEach((nav) => {
        if (nav.getAttribute("aria-label") !== group) {
            return;
        }

        nav.querySelectorAll(".sidebar-link[data-nav-item]").forEach((link) => {
            const isActive = link.dataset.navItem === itemKey;
            link.classList.toggle("active", isActive);
            link.setAttribute("aria-pressed", String(isActive));
        });
    });
}

const initialTheme = loadTheme();
diwaliThemeEnabled = initialTheme.diwali === true;
setTheme(initialTheme.main, initialTheme.side, false);
setColorMode(initialTheme.mode, false);

function setColorMode(mode, persist = true) {
    colorMode = mode === "dark" ? "dark" : "light";
    document.documentElement.dataset.colorMode = colorMode;
    applyCadColorMode();
    document.querySelectorAll("[data-color-mode-toggle]").forEach((toggle) => {
        toggle.setAttribute("aria-checked", String(colorMode === "dark"));
        toggle.setAttribute("aria-label", `Switch to ${colorMode === "dark" ? "light" : "dark"} mode`);
        toggle.querySelector(".appearance-toggle-icon").textContent = colorMode === "dark" ? "☀" : "☾";
        toggle.querySelector(".appearance-toggle-label").textContent =
            colorMode === "dark" ? "Light mode" : "Dark mode";
    });
    if (persist) {
        try {
            localStorage.setItem(themeStorageKey, JSON.stringify({
                main: savedThemeColors.main,
                side: savedThemeColors.side,
                mode: colorMode,
                diwali: diwaliThemeEnabled
            }));
        } catch (error) {
            console.warn("Unable to save the Smart Desk display mode.", error);
        }
    }
}

document.querySelectorAll("[data-color-mode-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
        setColorMode(colorMode === "dark" ? "light" : "dark");
    });
});

document.querySelectorAll(".sidebar-link[data-nav-item]").forEach((link) => {
    link.addEventListener("click", () => {
        const group = link.closest(".sidebar-nav").getAttribute("aria-label");
        const itemKey = link.dataset.navItem;

        if (itemKey === "customisation") {
            setSidebarView("theme");
        } else if (itemKey === "account") {
            setSidebarView("account");
            accountPanels.forEach((panel) => {
                panel.querySelector("[data-account-menu]").hidden = false;
                panel.querySelector("[data-name-editor]").hidden = true;
            });
        } else if (group === "Workspace") {
            setSidebarView("workspace");
        }

        setActiveNavigation(group, itemKey);
    });
});

document.querySelectorAll("[data-theme-back]").forEach((button) => {
    button.addEventListener("click", () => {
        setSidebarView("workspace");
        setActiveNavigation("Workspace", "main-menu");
    });
});

document.querySelectorAll("[data-diwali-theme-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
        diwaliThemeEnabled = toggle.checked;
        if (!diwaliThemeEnabled) {
            window.clearTimeout(diwaliFinaleTimer);
            document.querySelector(".diwali-fireworks").replaceChildren();
        }
        setTheme(savedThemeColors.main, savedThemeColors.side, true);
    });
});

document.querySelectorAll("[data-account-back]").forEach((button) => {
    button.addEventListener("click", () => {
        setSidebarView("workspace");
        setActiveNavigation("Workspace", "main-menu");
        setActiveNavigation("Personal", "");
    });
});

accountPanels.forEach((panel) => {
    const accountMenu = panel.querySelector("[data-account-menu]");
    const nameEditor = panel.querySelector("[data-name-editor]");
    const input = panel.querySelector("[data-name-input]");
    const status = panel.querySelector("[data-name-status]");

    panel.querySelector("[data-open-name]").addEventListener("click", () => {
        input.value = savedName;
        input.setCustomValidity("");
        status.textContent = "";
        accountMenu.hidden = true;
        nameEditor.hidden = false;
        input.focus();
    });

    panel.querySelector("[data-name-back]").addEventListener("click", () => {
        nameEditor.hidden = true;
        accountMenu.hidden = false;
    });

    input.addEventListener("input", () => {
        input.setCustomValidity(input.value.trim() ? "" : "Please enter your name.");
        status.textContent = "";
    });

    panel.querySelector("[data-name-form]").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = input.value.trim();
        input.setCustomValidity(name ? "" : "Please enter your name.");
        if (!input.reportValidity()) {
            return;
        }

        try {
            localStorage.setItem(nameStorageKey, name);
        } catch (error) {
            console.warn("Unable to save the Smart Desk name.", error);
            status.textContent = "Could not save your name. Please try again.";
            return;
        }

        savedName = name;
        updateNameDisplay(savedName);
        status.textContent = "Name saved.";
    });
});

themeInputs.forEach((input) => {
    input.addEventListener("input", () => {
        diwaliThemeEnabled = false;
        const theme = {
            main: document.querySelector('[data-theme-input="main"]').value,
            side: document.querySelector('[data-theme-input="side"]').value
        };
        setTheme(theme.main, theme.side, true);
    });
});

themePresets.forEach((preset) => {
    preset.addEventListener("click", () => {
        diwaliThemeEnabled = false;
        setTheme(preset.dataset.main, preset.dataset.side, true);
    });
});

// 1. LIVE CLOCK, DATE AND GREETING
function updateDateTime() {
    const now = new Date();
    const hour = now.getHours();

    let greeting = "Good evening";

    if (hour >= 5 && hour < 12) {
        greeting = "Good morning";
    } else if (hour >= 12 && hour < 17) {
        greeting = "Good afternoon";
    }

    $("greetingText").textContent = greeting;

    $("clock").textContent = now.toLocaleTimeString(
        undefined,
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

    $("date").textContent = now.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    $("day").textContent = now.toLocaleDateString(
        undefined,
        { weekday: "long" }
    );
}

updateDateTime();
setInterval(updateDateTime, 1000);

// 2. 3D PRINT DESIGN STUDIO
function cloneProject(project) {
    return JSON.parse(JSON.stringify(project));
}

function makeDesignProject(name, description) {
    return {
        schema: 1,
        id: `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim() || "New Design",
        description: description.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        objects: []
    };
}

function projectFingerprint(project) {
    return JSON.stringify(project);
}

function setSaveStatus(text, isError) {
    const status = document.querySelector("[data-save-status]");
    status.textContent = text;
    status.classList.toggle("error", Boolean(isError));
}

function readSavedProjects() {
    try {
        const saved = localStorage.getItem(projectStorageKey);
        if (saved === null) return [];
        const projects = JSON.parse(saved);
        if (!Array.isArray(projects)) throw new Error("Saved design library is not a list.");
        return projects;
    } catch (error) {
        console.warn("Unable to read saved Smart Desk designs.", error);
        setSaveStatus("Could not read local projects", true);
        throw error;
    }
}

function persistProject(showStatus = false) {
    if (!activeProject) return false;
    activeProject.updatedAt = new Date().toISOString();
    try {
        const projects = readSavedProjects().filter((project) => project.id !== activeProject.id);
        projects.unshift(cloneProject(activeProject));
        localStorage.setItem(projectStorageKey, JSON.stringify(projects.slice(0, 50)));
        lastCommittedProject = projectFingerprint(activeProject);
        setSaveStatus(showStatus ? "Project saved on this device" : "All changes saved");
        return true;
    } catch (error) {
        console.warn("Unable to save this Smart Desk design.", error);
        setSaveStatus("Save failed — storage may be full", true);
        return false;
    }
}

function scheduleProjectSave() {
    setSaveStatus("Saving…");
    window.clearTimeout(projectSaveTimer);
    projectSaveTimer = window.setTimeout(() => persistProject(false), 350);
}

function recordProjectChange() {
    if (!activeProject) return;
    const current = projectFingerprint(activeProject);
    if (undoStack[undoStack.length - 1] !== current) undoStack.push(current);
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
    lastCommittedProject = current;
    syncHistoryButtons();
}

function syncHistoryButtons() {
    document.querySelector("[data-undo]").disabled = undoStack.length === 0;
    document.querySelector("[data-redo]").disabled = redoStack.length === 0;
}

function restoreProjectSnapshot(snapshot) {
    const nextProject = JSON.parse(snapshot);
    if (undoStack.length && nextProject.id !== activeProject.id) return;
    activeProject = nextProject;
    selectedObjectId = activeProject.objects[0]?.id || null;
    selectedObjectIds = selectedObjectId ? [selectedObjectId] : [];
    lastCommittedProject = projectFingerprint(activeProject);
    editorProjectName.textContent = activeProject.name;
    updateSceneInterface();
    persistProject(false);
}

function undoProjectChange() {
    if (!undoStack.length || !activeProject) return;
    redoStack.push(projectFingerprint(activeProject));
    restoreProjectSnapshot(undoStack.pop());
    syncHistoryButtons();
}

function redoProjectChange() {
    if (!redoStack.length || !activeProject) return;
    undoStack.push(projectFingerprint(activeProject));
    restoreProjectSnapshot(redoStack.pop());
    syncHistoryButtons();
}

function selectedModelObject() {
    return activeProject?.objects.find((object) => object.id === selectedObjectId) || null;
}

function visibleProjectObjects() {
    return activeProject?.objects.filter((object) => object.visible !== false && object.suppressed !== true) || [];
}

function createModelObject(type) {
    if (!activeProject) return;
    if (activeProject.objects.length >= 500) {
        setSaveStatus("This project has reached the 500-body limit", true);
        return;
    }
    const defaults = {
        box: { name: "Box", width: 20, depth: 20, height: 20, icon: "▰" },
        cylinder: { name: "Cylinder", width: 24, depth: 24, height: 24, icon: "◉" },
        sphere: { name: "Sphere", width: 24, depth: 24, height: 24, icon: "●" },
        cone: { name: "Cone", width: 24, depth: 24, height: 30, icon: "△" },
        torus: { name: "Torus", width: 32, depth: 32, height: 12, icon: "◎" },
        capsule: { name: "Capsule", width: 18, depth: 18, height: 36, icon: "⬭" },
        pyramid: { name: "Pyramid", width: 28, depth: 28, height: 28, icon: "◇" },
        wedge: { name: "Wedge", width: 30, depth: 24, height: 20, icon: "◢" }
    };
    const shape = defaults[type];
    if (!shape) return;

    recordProjectChange();
    const index = activeProject.objects.length;
    const column = index % 4;
    const row = Math.floor(index / 4);
    const object = {
        id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${shape.name} ${index + 1}`,
        type,
        x: Math.round((column - 1.5) * 28),
        y: 0,
        z: Math.round(row * 28),
        width: shape.width,
        depth: shape.depth,
        height: shape.height,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        color: "#7ea5d0"
    };
    activeProject.objects.push(object);
    selectedObjectId = object.id;
    selectedObjectIds = [object.id];
    updateSceneInterface();
    scheduleProjectSave();
}

function createSketchFeature(formData) {
    if (!activeProject) return;
    const editId = cadFeatureForm.dataset.editObjectId;
    if (!editId && activeProject.objects.length >= 500) {
        setSaveStatus("This project has reached the 500-body limit", true);
        return;
    }
    const profileKind = String(formData.get("profile"));
    const operation = String(formData.get("operation"));
    const edgeStyle = String(formData.get("edgeStyle") || "fillet");
    if (!["rectangle", "circle", "slot", "hexagon", "star"].includes(profileKind) ||
        !["extrude", "revolve"].includes(operation) ||
        !["fillet", "chamfer"].includes(edgeStyle)) {
        setSaveStatus("Choose a supported sketch profile and feature", true);
        return;
    }
    const equalAxes = operation === "extrude" && formData.get("equalAxes") === "on";
    const width = Math.max(1, Math.min(220, Number(formData.get("width"))));
    const enteredDepth = Number(formData.get("depth"));
    const depth = equalAxes
        ? width
        : operation === "revolve"
        ? Math.max(0, Math.min(220, enteredDepth))
        : Math.max(1, Math.min(220, enteredDepth));
    const height = Math.max(1, Math.min(220, Number(formData.get("height"))));
    const bevel = Math.max(0, Math.min(5, Number(formData.get("bevel")) || 0));
    if (![width, depth, height, bevel].every(Number.isFinite)) {
        setSaveStatus("Enter valid sketch dimensions", true);
        return;
    }
    const existing = editId ? activeProject.objects.find((item) => item.id === editId) : null;
    if (existing && !["extrude", "revolve"].includes(existing.type)) {
        setSaveStatus("Only sketch-based features can be edited here", true);
        return;
    }
    recordProjectChange();
    const index = existing ? activeProject.objects.indexOf(existing) : activeProject.objects.length;
    const featureName = String(formData.get("featureName") || "").trim().slice(0, 48) ||
        `${operation === "extrude" ? "Extrude" : "Revolve"} ${index + 1}`;
    const object = {
        ...(existing || {}),
        id: existing?.id || `feature-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: featureName,
        type: operation,
        profile: { kind: profileKind, operation, bevel, edgeStyle, equalAxes },
        x: existing?.x ?? Math.round(((index % 4) - 1.5) * 28),
        y: existing?.y ?? 0,
        z: existing?.z ?? Math.floor(index / 4) * 28,
        width,
        depth,
        height,
        rotationX: existing?.rotationX ?? 0,
        rotationY: existing?.rotationY ?? 0,
        rotationZ: existing?.rotationZ ?? 0,
        color: existing?.color || "#6f9fc9"
    };
    if (existing) Object.assign(existing, object);
    else activeProject.objects.push(object);
    delete cadFeatureForm.dataset.editObjectId;
    document.querySelector("[data-feature-submit]").textContent = "Create feature →";
    selectedObjectId = object.id;
    selectedObjectIds = [object.id];
    updateSceneInterface();
    scheduleProjectSave();
}

function createLinearPattern(formData) {
    const source = selectedModelObject();
    if (!source || !activeProject) return;
    if (source.type === "mesh" || source.instanceOf) {
        setSaveStatus("Choose a primitive or sketch feature as the pattern source", true);
        return;
    }
    const axis = String(formData.get("axis"));
    const count = Number(formData.get("count"));
    const spacing = Number(formData.get("spacing"));
    if (!["x", "y", "z"].includes(axis) || !Number.isInteger(count) ||
        count < 2 || count > 50 || !Number.isFinite(spacing) || spacing < 0.1 || spacing > 220) {
        setSaveStatus("Enter a valid pattern direction, count, and spacing", true);
        return;
    }
    const existingInstances = activeProject.objects.filter((object) => object.instanceOf === source.id).length;
    if (activeProject.objects.length - existingInstances + count - 1 > 500) {
        setSaveStatus("This pattern would exceed the 500-body project limit", true);
        return;
    }

    recordProjectChange();
    source.patternConfig = {
        axis,
        count,
        spacing,
        name: String(formData.get("featureName") || "").trim().slice(0, 48) || "Linear pattern"
    };
    syncPatternInstances();
    selectedObjectId = source.id;
    selectedObjectIds = [source.id];
    updateSceneInterface();
    scheduleProjectSave();
}

function createMirrorFeature(formData) {
    const source = selectedModelObject();
    if (!source || !activeProject || source.instanceOf || source.mirrorOf) return;
    const axis = String(formData.get("axis"));
    const offset = Number(formData.get("offset"));
    if (!["x", "y", "z"].includes(axis) || !Number.isFinite(offset) || offset < -220 || offset > 220) {
        setSaveStatus("Enter a valid mirror plane and offset", true);
        return;
    }
    if (!source.mirrorConfig && activeProject.objects.length >= 500) {
        setSaveStatus("This mirror would exceed the 500-body project limit", true);
        return;
    }
    recordProjectChange();
    source.mirrorConfig = {
        axis,
        offset,
        name: String(formData.get("featureName") || "").trim().slice(0, 48) || `${source.name} mirror`
    };
    syncMirrorInstances();
    selectedObjectId = source.id;
    selectedObjectIds = [source.id];
    updateSceneInterface();
    scheduleProjectSave();
}

function syncPatternInstances() {
    if (!activeProject) return;
    const sources = activeProject.objects.filter((object) => object.patternConfig);
    for (const source of sources) {
        const config = source.patternConfig;
        const existing = new Map(
            activeProject.objects
                .filter((object) => object.instanceOf === source.id && object.instanceKind !== "mirror")
                .map((object) => [object.instanceIndex, object])
        );
        for (let index = 1; index < config.count; index += 1) {
            const id = `pattern-${source.id}-${index}`;
            let instance = existing.get(index);
            if (!instance) {
                instance = {
                    id,
                    name: `${config.name} ${index + 1}`,
                    type: source.type,
                    instanceOf: source.id,
                    instanceKind: "pattern",
                    instanceIndex: index
                };
                activeProject.objects.push(instance);
            }
            const offset = index * config.spacing;
            instance.name = `${config.name} ${index + 1}`;
            instance.type = source.type;
            instance.profile = source.profile ? { ...source.profile } : undefined;
            instance.width = source.width;
            instance.depth = source.depth;
            instance.height = source.height;
            instance.x = source.x + (config.axis === "x" ? offset : 0);
            instance.y = source.y + (config.axis === "y" ? offset : 0);
            instance.z = source.z + (config.axis === "z" ? offset : 0);
            instance.rotationX = source.rotationX;
            instance.rotationY = source.rotationY;
            instance.rotationZ = source.rotationZ;
            instance.color = source.color;
            instance.patternConfig = undefined;
            instance.meshData = undefined;
        }
        for (const [index, instance] of existing) {
            if (index >= config.count) {
                activeProject.objects = activeProject.objects.filter((object) => object !== instance);
            }
        }
    }
}

function syncMirrorInstances() {
    if (!activeProject) return;
    const sources = activeProject.objects.filter((object) => object.mirrorConfig);
    for (const source of sources) {
        const config = source.mirrorConfig;
        const mirrorId = `mirror-${source.id}`;
        let mirror = activeProject.objects.find((object) => object.mirrorOf === source.id);
        if (!mirror) {
            mirror = {
                id: mirrorId,
                name: config.name,
                type: "mesh",
                mirrorOf: source.id,
                color: source.color
            };
            activeProject.objects.push(mirror);
        }
        const sourceSignature = JSON.stringify([
            cadGeometrySignature(source),
            source.x, source.y, source.z,
            source.rotationX, source.rotationY, source.rotationZ,
            source.color, config.axis, config.offset, config.name
        ]);
        if (mirror.mirrorSourceSignature === sourceSignature) continue;

        const mesh = createCadMesh(source);
        mesh.updateMatrixWorld(true);
        const reflection = new THREE.Matrix4().makeScale(
            config.axis === "x" ? -1 : 1,
            config.axis === "y" ? -1 : 1,
            config.axis === "z" ? -1 : 1
        );
        const translation = new THREE.Vector3(
            config.axis === "x" ? config.offset * 2 : 0,
            config.axis === "y" ? config.offset * 2 : 0,
            config.axis === "z" ? config.offset * 2 : 0
        );
        reflection.setPosition(translation);
        let geometry = mesh.geometry.clone().applyMatrix4(reflection.multiply(mesh.matrixWorld));
        if (geometry.index) {
            const indexedGeometry = geometry;
            geometry = indexedGeometry.toNonIndexed();
            indexedGeometry.dispose();
        }
        const positions = geometry.getAttribute("position");
        for (let vertex = 0; vertex < positions.count; vertex += 3) {
            const first = new THREE.Vector3().fromBufferAttribute(positions, vertex + 1);
            const second = new THREE.Vector3().fromBufferAttribute(positions, vertex + 2);
            positions.setXYZ(vertex + 1, second.x, second.y, second.z);
            positions.setXYZ(vertex + 2, first.x, first.y, first.z);
        }
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);

        mirror.name = config.name;
        mirror.type = "mesh";
        mirror.color = source.color;
        mirror.width = size.x;
        mirror.height = size.y;
        mirror.depth = size.z;
        mirror.x = center.x;
        mirror.y = center.y - size.y / 2;
        mirror.z = center.z;
        mirror.rotationX = 0;
        mirror.rotationY = 0;
        mirror.rotationZ = 0;
        mirror.meshData = meshGeometryData(geometry);
        mirror.meshData.size = { width: size.x, height: size.y, depth: size.z };
        mirror.mirrorSourceSignature = sourceSignature;
        mesh.geometry.dispose();
        mesh.material.dispose();
        geometry.dispose();
    }
    const sourceIds = new Set(sources.map((source) => source.id));
    activeProject.objects = activeProject.objects.filter((object) =>
        !object.mirrorOf || sourceIds.has(object.mirrorOf)
    );
}

function isLinkedFeatureObject(object) {
    return Boolean(object?.instanceOf || object?.mirrorOf || object?.patternConfig || object?.mirrorConfig);
}

function createFixedAssembly() {
    if (!activeProject || selectedObjectIds.length !== 2) return;
    const members = selectedObjectIds.map((id) => activeProject.objects.find((item) => item.id === id));
    if (members.some((object) => !object || isLinkedFeatureObject(object) || object.assemblyId)) {
        setSaveStatus("Choose two independent bodies that are not already in an assembly", true);
        return;
    }
    recordProjectChange();
    const assemblyId = `assembly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    members.forEach((object) => { object.assemblyId = assemblyId; });
    selectedObjectId = members[0].id;
    selectedObjectIds = members.map((object) => object.id);
    updateSceneInterface();
    scheduleProjectSave();
    setSaveStatus("Fixed assembly created. Select any member to move or rotate the group.");
}

function releaseFixedAssembly() {
    const object = selectedModelObject();
    if (!activeProject || !object?.assemblyId) return;
    recordProjectChange();
    const assemblyId = object.assemblyId;
    activeProject.objects
        .filter((item) => item.assemblyId === assemblyId)
        .forEach((item) => { delete item.assemblyId; });
    selectedObjectIds = [object.id];
    updateSceneInterface();
    scheduleProjectSave();
    setSaveStatus("Assembly released; bodies can now be transformed independently.");
}

function updateSceneInterface() {
    if (!activeProject) return;
    syncPatternInstances();
    syncMirrorInstances();
    editorProjectName.textContent = activeProject.name;
    objectList.replaceChildren();
    if (!activeProject.objects.length) {
        const empty = document.createElement("p");
        empty.className = "object-list-empty";
        empty.textContent = "Your design is ready. Add a primitive to begin.";
        objectList.append(empty);
    } else {
        activeProject.objects.forEach((object) => {
            const row = document.createElement("div");
            row.className = `object-row${selectedObjectIds.includes(object.id) ? " selected" : ""}`;
            row.dataset.visible = String(object.visible !== false && !object.suppressed);
            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.className = "object-row-select";
            selectButton.setAttribute("aria-pressed", String(selectedObjectIds.includes(object.id)));
            const icon = document.createElement("span");
            icon.className = "object-row-icon";
            const icons = {
                box: "▰", cylinder: "◉", sphere: "●", cone: "△", torus: "◎",
                capsule: "⬭", pyramid: "◇", wedge: "◢", extrude: "▱", revolve: "⟳", mesh: "◈"
            };
            icon.textContent = icons[object.type] || "◈";
            const name = document.createElement("span");
            name.className = "object-row-name";
            name.textContent = object.instanceOf || object.mirrorOf ? `${object.name} · linked` : object.name;
            selectButton.append(icon, name);
            selectButton.addEventListener("click", (event) => selectModelObject(object.id, event.ctrlKey || event.metaKey));
            const visibilityButton = document.createElement("button");
            visibilityButton.type = "button";
            visibilityButton.className = "object-visibility";
            visibilityButton.textContent = object.visible === false ? "○" : "◉";
            visibilityButton.setAttribute("aria-label", `${object.visible === false ? "Show" : "Hide"} ${object.name}`);
            visibilityButton.setAttribute("aria-pressed", String(object.visible !== false));
            visibilityButton.title = `${object.visible === false ? "Show" : "Hide"} ${object.name}`;
            visibilityButton.addEventListener("click", () => {
                recordProjectChange();
                object.visible = object.visible === false;
                updateSceneInterface();
                scheduleProjectSave();
            });
            const actions = document.createElement("span");
            actions.className = "object-row-actions";
            const actionButton = (label, title, handler, disabled = false) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "object-row-action";
                button.textContent = label;
                button.title = title;
                button.setAttribute("aria-label", title);
                button.disabled = disabled;
                button.addEventListener("click", handler);
                actions.append(button);
            };
            const objectIndex = activeProject.objects.indexOf(object);
            actionButton("↑", `Move ${object.name} earlier`, () => moveFeature(object.id, -1), objectIndex === 0);
            actionButton("↓", `Move ${object.name} later`, () => moveFeature(object.id, 1), objectIndex === activeProject.objects.length - 1);
            actionButton(object.suppressed ? "▶" : "■", `${object.suppressed ? "Resume" : "Suppress"} ${object.name}`, () => {
                recordProjectChange();
                object.suppressed = !object.suppressed;
                updateSceneInterface();
                scheduleProjectSave();
            });
            if (["extrude", "revolve"].includes(object.type)) {
                actionButton("✎", `Edit ${object.name}`, () => editSketchFeature(object.id));
            }
            row.append(selectButton, visibilityButton, actions);
            objectList.append(row);
        });
    }

    const object = selectedModelObject();
    inspectorEmpty.hidden = Boolean(object);
    inspectorContent.hidden = !object;
    document.querySelector("[data-selection-status]").textContent = object
        ? `${object.name}  ·  ${object.width} × ${object.depth} × ${object.height} mm`
        : `${activeProject.objects.length} object${activeProject.objects.length === 1 ? "" : "s"}  ·  No object selected`;
    if (object) syncInspector(object);
    document.querySelectorAll("[data-boolean]").forEach((button) => {
        button.disabled = selectedObjectIds.length !== 2 ||
            selectedObjectIds.some((id) => isLinkedFeatureObject(activeProject.objects.find((item) => item.id === id)));
    });
    const patternSelection = selectedObjectIds.some((id) =>
        isLinkedFeatureObject(activeProject.objects.find((item) => item.id === id))
    );
    document.querySelector(".feature-tree-hint").textContent = patternSelection
        ? "Linked feature bodies cannot be used in Boolean operations. Toggle the eye to hide; edit the source to update them."
        : selectedObjectIds.length === 2
            ? "Two bodies selected. Choose a Boolean tool, or toggle an eye to hide a body."
            : selectedObjectIds.length > 2
                ? `${selectedObjectIds.length} bodies selected. Boolean tools require exactly two; align or distribute this selection.`
                : "Ctrl-click to multi-select. Toggle the eye to hide; hidden bodies are omitted from exports.";
    const transformSelection = selectedObjectIds
        .map((id) => activeProject.objects.find((item) => item.id === id))
        .filter((item) => item && !isLinkedFeatureObject(item));
    document.querySelector("[data-open-align]").disabled = transformSelection.length < 2;
    document.querySelector("[data-open-distribute]").disabled = transformSelection.length < 3;
    document.querySelector("[data-linear-pattern]").disabled =
        !object || object.type === "mesh" || Boolean(object.instanceOf || object.mirrorOf);
    document.querySelector("[data-remove-pattern]").hidden = !object?.patternConfig;
    document.querySelector("[data-mirror-feature]").disabled = !object || Boolean(object.instanceOf || object.mirrorOf);
    document.querySelector("[data-remove-mirror]").hidden = !object?.mirrorConfig;
    const mirrorNameInput = document.querySelector("[data-mirror-form] [name='featureName']");
    if (object?.mirrorConfig && document.activeElement !== mirrorNameInput) {
        mirrorNameInput.value = object.mirrorConfig.name;
        document.querySelector("[data-mirror-form] [name='axis']").value = object.mirrorConfig.axis;
        document.querySelector("[data-mirror-form] [name='offset']").value = object.mirrorConfig.offset;
        document.querySelector("[data-mirror-note]").textContent = "This feature already has a mirror. Saving replaces its plane settings.";
    } else if (object && !object.mirrorConfig && document.activeElement !== mirrorNameInput) {
        mirrorNameInput.value = `${object.name} mirror`;
        document.querySelector("[data-mirror-form] [name='axis']").value = "x";
        document.querySelector("[data-mirror-form] [name='offset']").value = "0";
        document.querySelector("[data-mirror-note]").textContent = "The copy reflects across the chosen plane and stays linked to its source body.";
    }
    const patternNameInput = document.querySelector("[data-pattern-form] [name='featureName']");
    if (object?.patternConfig && document.activeElement !== patternNameInput) {
        patternNameInput.value = object.patternConfig.name;
        document.querySelector("[data-pattern-form] [name='axis']").value = object.patternConfig.axis;
        document.querySelector("[data-pattern-form] [name='count']").value = object.patternConfig.count;
        document.querySelector("[data-pattern-form] [name='spacing']").value = object.patternConfig.spacing;
        document.querySelector("[data-pattern-note]").textContent = "This feature already has a pattern. Saving replaces its direction, count, and spacing.";
    } else if (object && !object.patternConfig && document.activeElement !== patternNameInput) {
        patternNameInput.value = `${object.name} pattern`;
        document.querySelector("[data-pattern-note]").textContent = "The source body is the first item; spacing is measured between body origins.";
    }
    document.querySelector("[data-object-name]").disabled = Boolean(object?.instanceOf || object?.mirrorOf);
    document.querySelectorAll("[data-property]").forEach((input) => {
        input.disabled = Boolean(object?.instanceOf || object?.mirrorOf ||
            (object?.assemblyId && ["width", "depth", "height"].includes(input.dataset.property)));
    });
    document.querySelector("[data-duplicate-object]").disabled = Boolean(object?.instanceOf || object?.mirrorOf || object?.patternConfig || object?.mirrorConfig || object?.assemblyId);
    document.querySelector("[data-delete-object]").disabled = Boolean(object?.instanceOf || object?.mirrorOf);
    document.querySelector("[data-isolate-selection]").disabled =
        !object || activeProject.objects.every((item) => item.id === object.id || item.visible === false);
    document.querySelector("[data-show-all]").disabled =
        !activeProject.objects.some((item) => item.visible === false);
    document.querySelector("[data-create-assembly]").disabled = selectedObjectIds.length !== 2 ||
        selectedObjectIds.some((id) => {
            const member = activeProject.objects.find((item) => item.id === id);
            return !member || isLinkedFeatureObject(member) || Boolean(member.assemblyId);
        });
    document.querySelector("[data-break-assembly]").disabled = !object?.assemblyId;
    syncHistoryButtons();
    renderModel();
}

function moveFeature(id, offset) {
    if (!activeProject) return;
    const index = activeProject.objects.findIndex((object) => object.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= activeProject.objects.length) return;
    recordProjectChange();
    const [object] = activeProject.objects.splice(index, 1);
    activeProject.objects.splice(target, 0, object);
    updateSceneInterface();
    scheduleProjectSave();
}

function editSketchFeature(id) {
    const object = activeProject?.objects.find((item) => item.id === id);
    if (!object?.profile || !["extrude", "revolve"].includes(object.type)) return;
    selectModelObject(object.id);
    cadFeatureForm.dataset.editObjectId = object.id;
    cadFeatureForm.elements.featureName.value = object.name;
    cadFeatureForm.elements.profile.value = object.profile.kind;
    cadFeatureForm.elements.operation.value = object.type;
    cadFeatureForm.elements.width.value = object.width;
    cadFeatureForm.elements.depth.value = object.depth;
    cadFeatureForm.elements.height.value = object.height;
    cadFeatureForm.elements.bevel.value = object.profile.bevel || 0;
    cadFeatureForm.elements.edgeStyle.value = object.profile.edgeStyle || "fillet";
    cadFeatureForm.elements.equalAxes.checked = object.profile.equalAxes === true;
    document.querySelector("[data-feature-submit]").textContent = "Update feature →";
    updateSketchFeatureNote();
    cadFeatureDialog.showModal();
}

function selectModelObject(id, additive = false) {
    const clicked = activeProject?.objects.find((item) => item.id === id);
    const groupIds = clicked?.assemblyId
        ? activeProject.objects.filter((item) => item.assemblyId === clicked.assemblyId).map((item) => item.id)
        : [id];
    if (additive) {
        if (groupIds.every((groupId) => selectedObjectIds.includes(groupId))) {
            selectedObjectIds = selectedObjectIds.filter((selectedId) => !groupIds.includes(selectedId));
        } else {
            selectedObjectIds = [...new Set([...selectedObjectIds, ...groupIds])];
        }
        selectedObjectId = selectedObjectIds[selectedObjectIds.length - 1] || null;
    } else {
        selectedObjectId = id;
        selectedObjectIds = groupIds;
    }
    updateSceneInterface();
}

function syncInspector(object) {
    document.querySelector("[data-object-name]").value = object.name;
    document.querySelector('[data-property="color"]').value = object.color;
    for (const [property, value] of Object.entries({
        width: object.width,
        depth: object.depth,
        height: object.height,
        x: object.x,
        y: object.y,
        z: object.z,
        rotationX: object.rotationX,
        rotationY: object.rotationY,
        rotationZ: object.rotationZ
    })) {
        const input = document.querySelector(`[data-property="${property}"]`);
        if (document.activeElement !== input) input.value = value;
    }
}

function openNewDesignScreen() {
    isOpeningBlankScreen = false;
    blankScreen.classList.remove("flowing");
    blankScreen.classList.add("open");
    blankScreen.setAttribute("aria-hidden", "false");
    blankScreen.setAttribute("aria-label", "New 3D design");
    roboticsStudio.hidden = true;
    document.querySelector("#canvasSetup").hidden = true;
    document.querySelector("#canvasEditor").hidden = true;
    modelEditor.hidden = true;
    newDesignScreen.hidden = false;
    document.querySelector("[data-project-form]").reset();
    document.querySelector("#projectName").value = "New Design";
    document.querySelector("#projectName").focus();
}

function resetCadInspectionTools() {
    measureMode = false;
    sectionEnabled = false;
    measurementPoints = [];
    if (measurementLine && cadScene) {
        cadScene.remove(measurementLine);
        measurementLine.geometry.dispose();
        measurementLine.material.dispose();
        measurementLine = null;
    }
    document.querySelector("[data-measure-toggle]").setAttribute("aria-pressed", "false");
    document.querySelector("[data-section-toggle]").setAttribute("aria-pressed", "false");
    document.querySelector("[data-section-control]").hidden = true;
    document.querySelector("[data-viewport-hint]").textContent =
        "Drag to move · Right-drag to orbit · Scroll to zoom";
}

function openModelEditor(project) {
    resetCadInspectionTools();
    activeProject = project;
    selectedObjectId = project.objects[0]?.id || null;
    selectedObjectIds = selectedObjectId ? [selectedObjectId] : [];
    activeTool = "select";
    viewportCamera = { yaw: 0.78, pitch: 0.68, distance: 400 };
    uniformDimensions = true;
    document.querySelector("[data-uniform-scale]").checked = true;
    undoStack = [];
    redoStack = [];
    lastCommittedProject = projectFingerprint(activeProject);
    editorProjectName.textContent = project.name;
    newDesignScreen.hidden = true;
    modelEditor.hidden = false;
    modelEditor.classList.remove("show-inspector");
    document.querySelectorAll("[data-tool]").forEach((button) => {
        const active = button.dataset.tool === activeTool;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    updateSceneInterface();
    requestAnimationFrame(() => {
        resizeModelCanvas();
        startCadRenderLoop();
        modelCanvas.focus();
    });
    persistProject(false);
}

function startProjectWaterTransition(project) {
    isOpeningBlankScreen = true;
    newDesignScreen.hidden = true;
    document.querySelector("#canvasSetup").hidden = true;
    blankScreen.classList.remove("open");
    blankScreen.classList.add("flowing");
    blankScreen.setAttribute("aria-hidden", "false");
    window.clearTimeout(blankScreenTimer);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 1200;
    blankScreenTimer = window.setTimeout(() => {
        blankScreen.classList.remove("flowing");
        blankScreen.classList.add("open");
        isOpeningBlankScreen = false;
        openModelEditor(project);
    }, duration);
}

function createCanvasProject(name = "", description = "") {
    const now = new Date().toISOString();
    return {
        schema: 1,
        kind: "smart-desk-2d-canvas",
        id: `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim().slice(0, 80) || "Untitled canvas",
        description: description.trim().slice(0, 500),
        width: 1600,
        height: 1000,
        background: "#ffffff",
        layers: [{ id: `layer-${Date.now()}`, name: "Artwork", visible: true, locked: false }],
        activeLayerId: null,
        brushSettings: { ...defaultCanvasBrushSettings },
        drawings: [],
        createdAt: now,
        updatedAt: now
    };
}

function openCanvasSetup() {
    isOpeningBlankScreen = false;
    blankScreen.classList.remove("flowing");
    blankScreen.classList.add("open");
    blankScreen.setAttribute("aria-hidden", "false");
    blankScreen.setAttribute("aria-label", "New 2D canvas project");
    roboticsStudio.hidden = true;
    newDesignScreen.hidden = true;
    modelEditor.hidden = true;
    document.querySelector("#canvasEditor").hidden = true;
    document.querySelector("#canvasSetup").hidden = false;
    const form = document.querySelector("[data-canvas-project-form]");
    form.reset();
    form.querySelector("[name='name']").value = "";
    form.querySelector("[name='description']").value = "";
    const resumeButton = document.querySelector("[data-canvas-resume]");
    const resumeStatus = document.querySelector("[data-canvas-resume-status]");
    resumeStatus.textContent = "";
    try {
        const saved = localStorage.getItem(canvasProjectStorageKey);
        resumeButton.hidden = saved === null;
        if (saved !== null) {
            const project = JSON.parse(saved);
            resumeButton.textContent = `Resume “${project.name || "Untitled canvas"}”`;
        }
    } catch (error) {
        console.warn("Unable to read the saved 2D canvas project.", error);
        resumeButton.hidden = true;
        resumeStatus.textContent = "The saved canvas could not be read.";
    }
    document.querySelector("#canvasProjectName").focus();
}

function setCanvasTool(tool) {
    canvasTool = tool;
    document.querySelectorAll("[data-canvas-tool]").forEach((button) => {
        const isActive = button.dataset.canvasTool === tool;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
    const descriptions = {
        select: "Select an object to move it",
        brush: "Brush ready",
        eraser: "Eraser ready",
        eyedropper: "Click artwork to sample a color",
        line: "Line tool ready",
        rectangle: "Rectangle tool ready",
        ellipse: "Ellipse tool ready",
        polygon: "Hexagon tool ready",
        star: "Star tool ready",
        text: "Click the canvas to place text"
    };
    document.querySelector("[data-canvas-tool-status]").textContent = descriptions[tool] || "Canvas ready";
    document.querySelector("[data-drawing-canvas]").style.cursor = tool === "text" ? "text" : tool === "eyedropper" ? "copy" : "default";
}

function drawCanvasItem(context, item) {
    context.save();
    context.globalAlpha = Math.max(0.05, Math.min(1, item.opacity ?? 1));
    context.lineCap = item.tip === "square" ? "square" : "round";
    context.lineJoin = "round";
    context.lineWidth = item.size || 2;
    context.strokeStyle = item.color || "#28374b";
    context.fillStyle = item.color || "#28374b";
    if (item.brushProfile === "pencil") {
        context.globalAlpha *= 0.62;
        context.lineWidth *= 0.68;
    } else if (item.brushProfile === "marker") {
        context.globalAlpha *= 0.54;
        context.lineWidth *= 1.65;
    } else if (item.brushProfile === "airbrush") {
        context.globalAlpha *= 0.18;
        context.lineWidth *= 1.8;
        context.shadowBlur = context.lineWidth * 0.75;
        context.shadowColor = item.color || "#28374b";
    }
    if (item.type === "eraser") context.globalCompositeOperation = "destination-out";

    if (item.type === "brush" || item.type === "eraser") {
        const baseWidth = context.lineWidth;
        if (item.points.length === 1) {
            context.beginPath();
            context.lineWidth = baseWidth * (0.35 + (item.points[0].pressure ?? 1) * 0.65);
            if (item.tip === "square") {
                context.fillRect(item.points[0].x - context.lineWidth / 2, item.points[0].y - context.lineWidth / 2, context.lineWidth, context.lineWidth);
            } else {
                context.arc(item.points[0].x, item.points[0].y, context.lineWidth / 2, 0, Math.PI * 2);
            }
            context.fill();
        } else {
            const samples = canvasStrokeSamples(item.points, item.smoothing ?? 0.35);
            for (let index = 1; index < samples.length; index += 1) {
                const start = samples[index - 1];
                const end = samples[index];
                const pressure = ((start.pressure ?? 1) + (end.pressure ?? 1)) / 2;
                context.lineWidth = baseWidth * (0.35 + pressure * 0.65);
                context.beginPath();
                context.moveTo(start.x, start.y);
                context.lineTo(end.x, end.y);
                context.stroke();
            }
        }
    } else if (item.type === "line") {
        context.beginPath();
        context.moveTo(item.x, item.y);
        context.lineTo(item.x + item.width, item.y + item.height);
        context.stroke();
    } else if (item.type === "rectangle") {
        if (item.fill) context.fillRect(item.x, item.y, item.width, item.height);
        else context.strokeRect(item.x, item.y, item.width, item.height);
    } else if (item.type === "ellipse") {
        context.beginPath();
        context.ellipse(
            item.x + item.width / 2,
            item.y + item.height / 2,
            Math.max(Math.abs(item.width / 2), 0.5),
            Math.max(Math.abs(item.height / 2), 0.5),
            0,
            0,
            Math.PI * 2
        );
        if (item.fill) context.fill();
        else context.stroke();
    } else if (item.type === "polygon" || item.type === "star") {
        const left = Math.min(item.x, item.x + item.width);
        const top = Math.min(item.y, item.y + item.height);
        const width = Math.abs(item.width);
        const height = Math.abs(item.height);
        const vertexCount = item.type === "star" ? 10 : 6;
        context.beginPath();
        for (let index = 0; index < vertexCount; index += 1) {
            const angle = index * Math.PI * 2 / vertexCount - Math.PI / 2;
            const radius = item.type === "star" && index % 2 ? 0.22 : 0.5;
            const x = left + width / 2 + Math.cos(angle) * width * radius;
            const y = top + height / 2 + Math.sin(angle) * height * radius;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        }
        context.closePath();
        if (item.fill) context.fill();
        else context.stroke();
    } else if (item.type === "text") {
        context.globalCompositeOperation = "source-over";
        context.font = `${Math.max(12, item.size * 4)}px "${item.fontFamily || "sans-serif"}"`;
        context.textBaseline = "top";
        context.fillText(item.text, item.x, item.y, 700);
    } else if (item.type === "image") {
        context.globalCompositeOperation = "source-over";
        let image = canvasImageCache.get(item.src);
        if (!image) {
            image = new Image();
            canvasImageCache.set(item.src, image);
            image.addEventListener("load", () => renderCanvasArtwork());
            image.src = item.src;
        }
        if (image.complete && image.naturalWidth) context.drawImage(image, item.x, item.y, item.width, item.height);
    }
    context.restore();
}

function canvasStrokeSamples(points, smoothing) {
    const amount = Math.max(0, Math.min(1, smoothing));
    if (points.length < 3 || amount === 0) return points;
    const samples = [points[0]];
    const stride = Math.max(1, Math.ceil((points.length - 2) / 1200));
    const steps = 1 + Math.round(amount * 2);
    for (let index = 1; index < points.length - 1; index += stride) {
        const previous = points[index - 1];
        const current = points[index];
        const next = points[Math.min(index + stride, points.length - 1)];
        const start = index === 1 ? previous : {
            x: (previous.x + current.x) / 2,
            y: (previous.y + current.y) / 2,
            pressure: ((previous.pressure ?? 1) + (current.pressure ?? 1)) / 2
        };
        const end = {
            x: (current.x + next.x) / 2,
            y: (current.y + next.y) / 2,
            pressure: ((current.pressure ?? 1) + (next.pressure ?? 1)) / 2
        };
        for (let step = 1; step <= steps; step += 1) {
            const t = step / steps;
            const inverse = 1 - t;
            samples.push({
                x: inverse * inverse * start.x + 2 * inverse * t * current.x + t * t * end.x,
                y: inverse * inverse * start.y + 2 * inverse * t * current.y + t * t * end.y,
                pressure: inverse * start.pressure + t * end.pressure
            });
        }
    }
    samples.push(points[points.length - 1]);
    return samples;
}

function renderCanvasArtwork(preview = null) {
    const canvas = document.querySelector("[data-drawing-canvas]");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    const layers = activeCanvasProject?.layers || [];
    for (const layer of layers) {
        if (!layer.visible) continue;
        if (canvasLayerBuffer.width !== canvas.width || canvasLayerBuffer.height !== canvas.height) {
            canvasLayerBuffer.width = canvas.width;
            canvasLayerBuffer.height = canvas.height;
        }
        const layerContext = canvasLayerBuffer.getContext("2d");
        layerContext.clearRect(0, 0, canvasLayerBuffer.width, canvasLayerBuffer.height);
        for (const item of canvasDrawings) {
            if ((item.layerId || layers[0]?.id) === layer.id) drawCanvasItem(layerContext, item);
        }
        context.drawImage(canvasLayerBuffer, 0, 0);
    }
    renderCanvasPreview(preview);
}

function renderCanvasPreview(preview) {
    const canvas = document.querySelector("[data-canvas-preview]");
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (preview) drawCanvasItem(context, preview);
    if (selectedCanvasIndex !== null && canvasDrawings[selectedCanvasIndex] &&
        activeCanvasProject?.layers.find((layer) => layer.id === activeCanvasLayerId)?.visible) {
        const bounds = canvasItemBounds(canvasDrawings[selectedCanvasIndex]);
        context.save();
        context.strokeStyle = "#168a83";
        context.fillStyle = "#ffffff";
        context.lineWidth = Math.max(1.5, canvas.width / 900);
        context.setLineDash([7, 5]);
        context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        context.setLineDash([]);
        const handleSize = Math.max(7, canvas.width / 180);
        for (const x of [bounds.x, bounds.x + bounds.width]) {
            for (const y of [bounds.y, bounds.y + bounds.height]) {
                context.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
                context.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
            }
        }
        context.restore();
    }
}

function canvasItemBounds(item) {
    if (item.points?.length) {
        const xs = item.points.map((point) => point.x);
        const ys = item.points.map((point) => point.y);
        const padding = Math.max(6, item.size / 2);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        return {
            x: left - padding,
            y: top - padding,
            width: Math.max(1, Math.max(...xs) - left + padding * 2),
            height: Math.max(1, Math.max(...ys) - top + padding * 2)
        };
    }
    if (item.type === "text") {
        return { x: item.x, y: item.y, width: Math.max(24, item.text.length * item.size * 2.4), height: item.size * 4 };
    }
    const padding = Math.max(6, item.size / 2);
    const left = Math.min(item.x, item.x + item.width);
    const top = Math.min(item.y, item.y + item.height);
    return {
        x: left - padding,
        y: top - padding,
        width: Math.max(1, Math.abs(item.width) + padding * 2),
        height: Math.max(1, Math.abs(item.height) + padding * 2)
    };
}

function canvasItemGeometryBounds(item) {
    if (item.points?.length) {
        const xs = item.points.map((point) => point.x);
        const ys = item.points.map((point) => point.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        return { x: left, y: top, width: Math.max(1, Math.max(...xs) - left), height: Math.max(1, Math.max(...ys) - top) };
    }
    if (item.type === "text") {
        return { x: item.x, y: item.y, width: Math.max(24, item.text.length * item.size * 2.4), height: item.size * 4 };
    }
    const left = Math.min(item.x, item.x + item.width);
    const top = Math.min(item.y, item.y + item.height);
    return { x: left, y: top, width: Math.max(1, Math.abs(item.width)), height: Math.max(1, Math.abs(item.height)) };
}

function distanceToCanvasSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const amount = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
    return Math.hypot(point.x - (start.x + amount * dx), point.y - (start.y + amount * dy));
}

function canvasItemContainsPoint(item, point) {
    const tolerance = Math.max(8, item.size / 2);
    if (item.points?.length) {
        for (let index = 0; index < item.points.length; index += 1) {
            const start = item.points[index];
            const end = item.points[index + 1] || start;
            if (distanceToCanvasSegment(point, start, end) <= tolerance) return true;
        }
        return false;
    }
    if (item.type === "text") {
        const bounds = canvasItemBounds(item);
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
    }
    if (item.type === "line") {
        return distanceToCanvasSegment(point, { x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.height }) <= tolerance;
    }
    const left = Math.min(item.x, item.x + item.width);
    const top = Math.min(item.y, item.y + item.height);
    const width = Math.max(1, Math.abs(item.width));
    const height = Math.max(1, Math.abs(item.height));
    const localX = point.x - left;
    const localY = point.y - top;
    if (item.type === "ellipse") {
        const radiusX = width / 2;
        const radiusY = height / 2;
        const normalized = ((localX - radiusX) / radiusX) ** 2 + ((localY - radiusY) / radiusY) ** 2;
        return normalized <= 1 + tolerance / Math.max(1, Math.min(radiusX, radiusY));
    }
    const insideX = localX >= -tolerance && localX <= width + tolerance;
    const insideY = localY >= -tolerance && localY <= height + tolerance;
    return insideX && insideY;
}

function findCanvasItem(point) {
    for (let index = canvasDrawings.length - 1; index >= 0; index -= 1) {
        const item = canvasDrawings[index];
        const layer = activeCanvasProject.layers.find((candidate) => candidate.id === item.layerId);
        if (layer?.visible && !layer.locked && canvasItemContainsPoint(item, point)) return index;
    }
    return null;
}

function canvasResizeHandle(point, bounds, tolerance) {
    const handles = [
        ["nw", bounds.x, bounds.y],
        ["ne", bounds.x + bounds.width, bounds.y],
        ["sw", bounds.x, bounds.y + bounds.height],
        ["se", bounds.x + bounds.width, bounds.y + bounds.height]
    ];
    return handles.find(([, x, y]) => Math.hypot(point.x - x, point.y - y) <= tolerance)?.[0] || null;
}

function resizeCanvasItem(item, original, originalBounds, handle, delta) {
    const leftHandle = handle.endsWith("w");
    const topHandle = handle.startsWith("n");
    const fixedX = leftHandle ? originalBounds.x + originalBounds.width : originalBounds.x;
    const fixedY = topHandle ? originalBounds.y + originalBounds.height : originalBounds.y;
    const movingX = (leftHandle ? originalBounds.x : originalBounds.x + originalBounds.width) + delta.x;
    const movingY = (topHandle ? originalBounds.y : originalBounds.y + originalBounds.height) + delta.y;
    const left = Math.min(movingX, fixedX);
    const top = Math.min(movingY, fixedY);
    const width = Math.max(2, Math.abs(movingX - fixedX));
    const height = Math.max(2, Math.abs(movingY - fixedY));
    if (original.points?.length) {
        const xs = original.points.map((value) => value.x);
        const ys = original.points.map((value) => value.y);
        const sourceLeft = Math.min(...xs);
        const sourceTop = Math.min(...ys);
        const sourceWidth = Math.max(1, Math.max(...xs) - sourceLeft);
        const sourceHeight = Math.max(1, Math.max(...ys) - sourceTop);
        item.points = original.points.map((value) => ({
            x: left + (value.x - sourceLeft) / sourceWidth * width,
            y: top + (value.y - sourceTop) / sourceHeight * height
        }));
    } else if (original.type === "text") {
        item.x = left;
        item.y = top;
        item.size = Math.max(3, original.size * (width / originalBounds.width + height / originalBounds.height) / 2);
    } else {
        item.x = left;
        item.y = top;
        item.width = width;
        item.height = height;
    }
}

function moveCanvasItem(item, original, delta) {
    if (original.points) {
        item.points = original.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
    } else {
        item.x = original.x + delta.x;
        item.y = original.y + delta.y;
    }
}

function setCanvasSaveState(message, isError = false) {
    const status = document.querySelector("[data-canvas-save-state]");
    status.textContent = message.toUpperCase();
    status.classList.toggle("error", isError);
}

function persistCanvasProject() {
    if (!activeCanvasProject) return;
    activeCanvasProject.drawings = canvasDrawings;
    activeCanvasProject.activeLayerId = activeCanvasLayerId;
    activeCanvasProject.brushSettings = readCanvasBrushSettings();
    activeCanvasProject.updatedAt = new Date().toISOString();
    try {
        localStorage.setItem(canvasProjectStorageKey, JSON.stringify(activeCanvasProject));
        setCanvasSaveState("All changes saved");
    } catch (error) {
        console.warn("Unable to save the 2D canvas project.", error);
        setCanvasSaveState("Storage unavailable — export project JSON", true);
    }
}

function scheduleCanvasSave() {
    setCanvasSaveState("Saving…");
    window.clearTimeout(canvasSaveTimer);
    canvasSaveTimer = window.setTimeout(persistCanvasProject, 450);
}

function pushCanvasHistory() {
    canvasUndoStack.push(JSON.stringify({ drawings: canvasDrawings, layers: activeCanvasProject.layers, activeLayerId: activeCanvasLayerId }));
    if (canvasUndoStack.length > 24) canvasUndoStack.shift();
    canvasRedoStack = [];
    document.querySelector("[data-canvas-undo]").disabled = false;
    document.querySelector("[data-canvas-redo]").disabled = true;
}

function restoreCanvasHistory(fromStack, toStack) {
    if (fromStack.length === 0) return;
    toStack.push(JSON.stringify({ drawings: canvasDrawings, layers: activeCanvasProject.layers, activeLayerId: activeCanvasLayerId }));
    const state = JSON.parse(fromStack.pop());
    canvasDrawings = state.drawings;
    activeCanvasProject.drawings = canvasDrawings;
    activeCanvasProject.layers = state.layers;
    activeCanvasLayerId = state.activeLayerId;
    activeCanvasProject.activeLayerId = activeCanvasLayerId;
    renderCanvasArtwork();
    renderCanvasLayers();
    document.querySelector("[data-canvas-undo]").disabled = canvasUndoStack.length === 0;
    document.querySelector("[data-canvas-redo]").disabled = canvasRedoStack.length === 0;
    scheduleCanvasSave();
}

function openCanvasEditor(project) {
    ensureCanvasLayers(project);
    activeCanvasProject = project;
    canvasDrawings = project.drawings;
    activeCanvasLayerId = project.activeLayerId;
    project.brushSettings = applyCanvasBrushSettings(project.brushSettings);
    selectedCanvasIndex = null;
    canvasUndoStack = [];
    canvasRedoStack = [];
    canvasPointer = null;
    canvasZoom = 1;
    document.querySelector("#canvasSetup").hidden = true;
    newDesignScreen.hidden = true;
    modelEditor.hidden = true;
    const editor = document.querySelector("#canvasEditor");
    editor.hidden = false;
    document.querySelector("[data-canvas-project-name]").textContent = project.name;
    document.querySelector("[data-canvas-inspector-title]").textContent = project.name;
    document.querySelector("[data-canvas-inspector-description]").textContent =
        project.description || "Your ideas, drawn at full resolution.";
    document.querySelector("[data-canvas-background]").value = project.background;
    document.querySelector("[data-canvas-artboard]").style.backgroundColor = project.background;
    document.querySelector("[data-canvas-background-label]").textContent =
        project.background.toLowerCase() === "#ffffff" ? "Pure white" : project.background.toUpperCase();
    document.querySelector("[data-canvas-undo]").disabled = true;
    document.querySelector("[data-canvas-redo]").disabled = true;
    document.querySelector("[data-canvas-stage]").scrollTop = 0;
    document.querySelector("[data-canvas-stage]").scrollLeft = 0;
    document.querySelector("[data-canvas-artboard]").style.width = "";
    document.querySelector("[data-canvas-artboard]").classList.remove("grid-hidden");
    document.querySelector("[data-canvas-artboard]").style.backgroundColor = project.background;
    document.querySelector("[data-canvas-grid]").setAttribute("aria-pressed", "true");
    setCanvasTool("brush");
    fitCanvasToStage();
    renderCanvasLayers();
    renderCanvasArtwork();
    persistCanvasProject();
    requestAnimationFrame(() => document.querySelector("[data-drawing-canvas]").focus());
}

function setCanvasZoom(zoom) {
    canvasZoom = Math.max(0.35, Math.min(2, zoom));
    const artboard = document.querySelector("[data-canvas-artboard]");
    artboard.style.width = `${1200 * canvasZoom}px`;
    artboard.style.setProperty("--canvas-grid-size", `${40 * canvasZoom}px`);
    const label = `${Math.round(canvasZoom * 100)}%`;
    document.querySelector("[data-canvas-zoom]").textContent = label;
    document.querySelector("[data-canvas-zoom-status]").textContent = label;
}

function fitCanvasToStage() {
    const stage = document.querySelector("[data-canvas-stage]");
    const availableWidth = Math.max(320, stage.clientWidth - 64);
    const availableHeight = Math.max(240, stage.clientHeight - 64);
    setCanvasZoom(Math.min(1, availableWidth / 1200, availableHeight / 750));
}

function canvasPoint(event) {
    const canvas = document.querySelector("[data-drawing-canvas]");
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
        y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
    };
}

function createCanvasShape(point) {
    const color = document.querySelector("[data-canvas-color]").value;
    const settings = readCanvasBrushSettings();
    const size = Number(document.querySelector("[data-canvas-size]").value) *
        (document.querySelector("[data-drawing-canvas]").width /
            document.querySelector("[data-drawing-canvas]").getBoundingClientRect().width);
    if (canvasTool === "brush" || canvasTool === "eraser") {
        return {
            type: canvasTool, color, size, points: [point], layerId: activeCanvasLayerId,
            brushProfile: settings.profile, tip: settings.tip, opacity: settings.opacity / 100,
            smoothing: settings.smoothing / 100
        };
    }
    return {
        type: canvasTool,
        color,
        size,
        layerId: activeCanvasLayerId,
        opacity: settings.opacity / 100,
        fill: document.querySelector("[data-canvas-fill]").checked,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0
    };
}

function readCanvasBrushSettings() {
    return {
        profile: document.querySelector("[data-canvas-brush]").value,
        tip: document.querySelector("[data-canvas-tip]").value,
        opacity: Number(document.querySelector("[data-canvas-opacity]").value),
        smoothing: Number(document.querySelector("[data-canvas-smoothing]").value)
    };
}

function applyCanvasBrushSettings(settings = {}) {
    const restored = { ...defaultCanvasBrushSettings, ...settings };
    document.querySelector("[data-canvas-brush]").value = restored.profile;
    document.querySelector("[data-canvas-tip]").value = restored.tip;
    document.querySelector("[data-canvas-opacity]").value = restored.opacity;
    document.querySelector("[data-canvas-opacity-label]").textContent = `${restored.opacity}%`;
    document.querySelector("[data-canvas-smoothing]").value = restored.smoothing;
    document.querySelector("[data-canvas-smoothing-label]").textContent = `${restored.smoothing}%`;
    return restored;
}

function importCanvasProject(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        try {
            const project = JSON.parse(String(reader.result));
            validateCanvasProject(project);
            activeCanvasProject = project;
            canvasDrawings = project.drawings;
            activeCanvasLayerId = project.activeLayerId;
            project.brushSettings = applyCanvasBrushSettings(project.brushSettings);
            selectedCanvasIndex = null;
            canvasUndoStack = [];
            canvasRedoStack = [];
            document.querySelector("[data-canvas-project-name]").textContent = project.name;
            document.querySelector("[data-canvas-inspector-title]").textContent = project.name;
            document.querySelector("[data-canvas-inspector-description]").textContent =
                project.description || "Your ideas, drawn at full resolution.";
            document.querySelector("[data-canvas-background]").value = project.background;
            document.querySelector("[data-canvas-artboard]").style.backgroundColor = project.background;
            document.querySelector("[data-canvas-background-label]").textContent =
                project.background.toLowerCase() === "#ffffff" ? "Pure white" : project.background.toUpperCase();
            document.querySelector("[data-canvas-undo]").disabled = true;
            document.querySelector("[data-canvas-redo]").disabled = true;
            renderCanvasLayers();
            renderCanvasArtwork();
            persistCanvasProject();
        } catch (error) {
            console.warn("Unable to open the selected canvas project.", error);
            setCanvasSaveState(error.message || "Could not open project", true);
        }
    });
    reader.addEventListener("error", () => {
        setCanvasSaveState("Could not read project file", true);
    });
    reader.readAsText(file);
}

function validateCanvasProject(project) {
    const validTypes = new Set(["brush", "eraser", "line", "rectangle", "ellipse", "polygon", "star", "text", "image"]);
    if (
        project?.kind !== "smart-desk-2d-canvas" ||
        project.schema !== 1 ||
        typeof project.name !== "string" ||
        project.name.length > 80 ||
        typeof project.description !== "string" ||
        project.description.length > 500 ||
        project.width !== 1600 ||
        project.height !== 1000 ||
        !/^#[0-9a-f]{6}$/i.test(project.background) ||
        !Array.isArray(project.drawings) ||
        project.drawings.length > 10000 ||
        project.drawings.some((item) => !item || !validTypes.has(item.type)) ||
        (project.layers !== undefined && (!Array.isArray(project.layers) || project.layers.length > 100 ||
            project.layers.some((layer) => !layer || typeof layer.name !== "string" || layer.name.length > 40)))
    ) {
        throw new Error("That file is not a supported Smart Desk canvas project.");
    }
    project.drawings.forEach((item) => {
        if (!/^#[0-9a-f]{6}$/i.test(item.color) || !Number.isFinite(item.size) || item.size < 0 || item.size > 1000) {
            throw new Error("The project contains invalid drawing properties.");
        }
        if (item.type === "brush" || item.type === "eraser") {
            if (!Array.isArray(item.points) || item.points.length === 0 || item.points.length > 10000 ||
                item.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
                throw new Error("The project contains invalid drawing data.");
            }
        } else if (![item.x, item.y].every(Number.isFinite) ||
            (item.type !== "text" && ![item.width, item.height].every(Number.isFinite))) {
            throw new Error("The project contains invalid shape data.");
        }
        if (item.type === "text" && (typeof item.text !== "string" || item.text.length > 200)) {
            throw new Error("The project contains invalid text data.");
        }
        if (item.type === "image" && (typeof item.src !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,/i.test(item.src) || item.src.length > 8_000_000 ||
            ![item.x, item.y, item.width, item.height].every(Number.isFinite) || item.width <= 0 || item.height <= 0)) {
            throw new Error("The project contains invalid image data.");
        }
    });
    ensureCanvasLayers(project);
    return project;
}

function ensureCanvasLayers(project) {
    if (!Array.isArray(project.layers) || project.layers.length === 0) {
        const layer = { id: `layer-${Date.now()}`, name: "Artwork", visible: true, locked: false };
        project.layers = [layer];
        project.drawings.forEach((item) => { item.layerId = layer.id; });
    }
    const usedIds = new Set();
    project.layers = project.layers.map((layer, index) => {
        let id = typeof layer.id === "string" && layer.id ? layer.id : `layer-${Date.now()}-${index}`;
        while (usedIds.has(id)) id = `layer-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
        usedIds.add(id);
        return {
            id,
            name: String(layer.name || `Layer ${index + 1}`).trim().slice(0, 40) || `Layer ${index + 1}`,
            visible: layer.visible !== false,
            locked: Boolean(layer.locked)
        };
    });
    const fallbackId = project.layers[0].id;
    project.drawings.forEach((item) => {
        if (!usedIds.has(item.layerId)) item.layerId = fallbackId;
    });
    project.activeLayerId = usedIds.has(project.activeLayerId) ? project.activeLayerId : fallbackId;
}

function renderCanvasLayers() {
    if (!activeCanvasProject) return;
    const list = document.querySelector("[data-canvas-layer-list]");
    list.replaceChildren();
    [...activeCanvasProject.layers].reverse().forEach((layer) => {
        const index = activeCanvasProject.layers.indexOf(layer);
        const row = document.createElement("div");
        row.className = `canvas-layer-card${layer.id === activeCanvasLayerId ? " active" : ""}`;

        const select = document.createElement("div");
        select.className = "canvas-layer-select";
        select.setAttribute("role", "button");
        select.tabIndex = 0;
        select.setAttribute("aria-pressed", String(layer.id === activeCanvasLayerId));
        select.setAttribute("aria-label", `Select layer ${layer.name}`);
        const thumb = document.createElement("span");
        thumb.className = "canvas-layer-thumb";
        thumb.setAttribute("aria-hidden", "true");
        const mark = document.createElement("i");
        thumb.append(mark);
        const details = document.createElement("span");
        details.className = "canvas-layer-details";
        const title = document.createElement("strong");
        title.textContent = layer.name;
        const name = document.createElement("input");
        name.type = "text";
        name.className = "canvas-layer-name";
        name.value = layer.name;
        name.maxLength = 40;
        name.setAttribute("aria-label", `Rename layer ${layer.name}`);
        const count = canvasDrawings.filter((item) => item.layerId === layer.id).length;
        const itemCount = document.createElement("small");
        itemCount.textContent = `${count} ${count === 1 ? "item" : "items"}${layer.locked ? " · locked" : ""}`;
        details.append(title, itemCount);
        select.append(thumb, details);

        const actions = document.createElement("div");
        actions.className = "canvas-layer-actions";
        const createAction = (label, glyph, action, disabled = false) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.layerAction = action;
            button.title = label;
            button.setAttribute("aria-label", label);
            button.setAttribute("aria-pressed", String(action === "visibility" ? layer.visible : action === "lock" ? layer.locked : false));
            button.textContent = glyph;
            button.disabled = disabled;
            actions.append(button);
            return button;
        };
        createAction(layer.visible ? "Hide layer" : "Show layer", layer.visible ? "◉" : "○", "visibility");
        createAction(layer.locked ? "Unlock layer" : "Lock layer", layer.locked ? "▣" : "◇", "lock");
        createAction("Move layer up", "↑", "up", index === activeCanvasProject.layers.length - 1);
        createAction("Move layer down", "↓", "down", index === 0);
        createAction("Delete layer", "×", "delete", activeCanvasProject.layers.length === 1);
        row.append(select, name, actions);
        list.append(row);

        select.addEventListener("click", () => {
            activeCanvasLayerId = layer.id;
            activeCanvasProject.activeLayerId = layer.id;
            selectedCanvasIndex = null;
            document.querySelector("[data-canvas-tool-status]").textContent = layer.locked
                ? "Layer locked" : `${layer.name} selected`;
            renderCanvasLayers();
            renderCanvasPreview(null);
            scheduleCanvasSave();
        });
        select.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                select.click();
            }
        });
        name.addEventListener("change", () => {
            layer.name = name.value.trim().slice(0, 40) || "Untitled layer";
            name.value = layer.name;
            select.setAttribute("aria-label", `Select layer ${layer.name}`);
            title.textContent = layer.name;
            if (layer.id === activeCanvasLayerId) document.querySelector("[data-canvas-tool-status]").textContent = `${layer.name} selected`;
            scheduleCanvasSave();
        });
        actions.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-layer-action]");
            if (!button || button.disabled) return;
            const action = button.dataset.layerAction;
            if (action === "visibility") {
                pushCanvasHistory();
                layer.visible = !layer.visible;
                if (!layer.visible && layer.id === activeCanvasLayerId) selectedCanvasIndex = null;
            } else if (action === "lock") {
                pushCanvasHistory();
                layer.locked = !layer.locked;
            } else if (action === "up" || action === "down") {
                pushCanvasHistory();
                const nextIndex = index + (action === "up" ? 1 : -1);
                [activeCanvasProject.layers[index], activeCanvasProject.layers[nextIndex]] =
                    [activeCanvasProject.layers[nextIndex], activeCanvasProject.layers[index]];
            } else if (action === "delete") {
                pushCanvasHistory();
                activeCanvasProject.layers.splice(index, 1);
                canvasDrawings = canvasDrawings.filter((item) => item.layerId !== layer.id);
                activeCanvasProject.drawings = canvasDrawings;
                if (activeCanvasLayerId === layer.id) activeCanvasLayerId = activeCanvasProject.layers[0].id;
                activeCanvasProject.activeLayerId = activeCanvasLayerId;
                selectedCanvasIndex = null;
            }
            renderCanvasLayers();
            renderCanvasArtwork();
            scheduleCanvasSave();
        });
    });
}

function addCanvasLayer() {
    if (!activeCanvasProject || activeCanvasProject.layers.length >= 100) return;
    pushCanvasHistory();
    const layer = {
        id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `Layer ${activeCanvasProject.layers.length + 1}`,
        visible: true,
        locked: false
    };
    activeCanvasProject.layers.push(layer);
    activeCanvasLayerId = layer.id;
    activeCanvasProject.activeLayerId = layer.id;
    selectedCanvasIndex = null;
    renderCanvasLayers();
    renderCanvasArtwork();
    document.querySelector("[data-canvas-tool-status]").textContent = `${layer.name} selected`;
    scheduleCanvasSave();
}

function exportCanvasPng() {
    const output = document.createElement("canvas");
    output.width = 1600;
    output.height = 1000;
    const context = output.getContext("2d");
    if (!context) {
        setCanvasSaveState("Could not export PNG", true);
        return;
    }
    context.fillStyle = activeCanvasProject.background;
    context.fillRect(0, 0, output.width, output.height);
    if (!document.querySelector("[data-canvas-artboard]").classList.contains("grid-hidden")) {
        const spacing = output.width / 30;
        context.strokeStyle = "rgba(97, 119, 145, 0.1)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = spacing; x < output.width; x += spacing) {
            context.moveTo(x, 0);
            context.lineTo(x, output.height);
        }
        for (let y = spacing; y < output.height; y += spacing) {
            context.moveTo(0, y);
            context.lineTo(output.width, y);
        }
        context.stroke();
    }
    context.drawImage(document.querySelector("[data-drawing-canvas]"), 0, 0);
    output.toBlob((blob) => {
        if (!blob) {
            setCanvasSaveState("Could not export PNG", true);
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${activeCanvasProject.name}.png`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
}

function startCanvasWaterTransition(project) {
    isOpeningBlankScreen = true;
    document.querySelector("#canvasSetup").hidden = true;
    blankScreen.classList.remove("open");
    blankScreen.classList.add("flowing");
    blankScreen.setAttribute("aria-hidden", "false");
    blankScreen.setAttribute("aria-label", "Opening 2D canvas studio");
    window.clearTimeout(blankScreenTimer);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 1200;
    blankScreenTimer = window.setTimeout(() => {
        blankScreen.classList.remove("flowing");
        blankScreen.classList.add("open");
        blankScreen.setAttribute("aria-label", "2D canvas studio");
        isOpeningBlankScreen = false;
        openCanvasEditor(project);
    }, duration);
}

const drawingCanvas = document.querySelector("[data-drawing-canvas]");
let pendingCanvasTextPoint = null;
drawingCanvas.addEventListener("pointerdown", (event) => {
    if (!activeCanvasProject || document.querySelector("#canvasEditor").hidden) return;
    const point = canvasPoint(event);
    if (canvasTool === "select") {
        selectedCanvasIndex = findCanvasItem(point);
        renderCanvasPreview(null);
        if (selectedCanvasIndex !== null) {
            const item = canvasDrawings[selectedCanvasIndex];
            activeCanvasLayerId = item.layerId;
            activeCanvasProject.activeLayerId = activeCanvasLayerId;
            renderCanvasLayers();
            const bounds = canvasItemBounds(item);
            const tolerance = Math.max(12, drawingCanvas.width / drawingCanvas.getBoundingClientRect().width * 9);
            const handle = canvasResizeHandle(point, bounds, tolerance);
            canvasPointer = {
                mode: handle ? "resize" : "move",
                start: point,
                original: JSON.parse(JSON.stringify(item)),
                originalBounds: canvasItemGeometryBounds(item),
                handle,
                historyPushed: false,
                moved: false
            };
            drawingCanvas.setPointerCapture(event.pointerId);
        }
        return;
    }
    if (canvasTool === "eyedropper") {
        const pixel = drawingCanvas.getContext("2d").getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
        if (pixel[3] > 0) {
            document.querySelector("[data-canvas-color]").value = `#${[...pixel.slice(0, 3)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
            setCanvasTool("brush");
        } else {
            document.querySelector("[data-canvas-tool-status]").textContent = "No artwork color at this point";
        }
        return;
    }
    const activeLayer = activeCanvasProject.layers.find((layer) => layer.id === activeCanvasLayerId);
    if (!activeLayer?.visible || activeLayer.locked) {
        document.querySelector("[data-canvas-tool-status]").textContent = activeLayer?.locked
            ? "Unlock this layer to edit" : "Show this layer to edit";
        return;
    }
    if (canvasTool === "text") {
        pendingCanvasTextPoint = point;
        const dialog = document.querySelector("[data-canvas-text-dialog]");
        const form = document.querySelector("[data-canvas-text-form]");
        form.reset();
        dialog.showModal();
        form.elements.text.focus();
        return;
    }
    selectedCanvasIndex = null;
    pushCanvasHistory();
    canvasPointer = { mode: "draw", start: point, item: null };
    canvasPointer.item = createCanvasShape(canvasPointer.start);
    if (canvasPointer.item.points) {
        canvasPointer.item.points[0].pressure = event.pointerType === "mouse" ? 1 : Math.max(0.05, event.pressure || 1);
    }
    drawingCanvas.setPointerCapture(event.pointerId);
    if (canvasPointer.item.points) {
        renderCanvasPreview(canvasPointer.item);
    }
});

drawingCanvas.addEventListener("pointermove", (event) => {
    if (!canvasPointer) return;
    const point = canvasPoint(event);
    if (canvasPointer.mode === "move" || canvasPointer.mode === "resize") {
        const delta = { x: point.x - canvasPointer.start.x, y: point.y - canvasPointer.start.y };
        if (Math.hypot(delta.x, delta.y) < 0.5) return;
        if (!canvasPointer.historyPushed) {
            pushCanvasHistory();
            canvasPointer.historyPushed = true;
        }
        canvasPointer.moved = true;
        const item = canvasDrawings[selectedCanvasIndex];
        if (canvasPointer.mode === "resize") {
            resizeCanvasItem(item, canvasPointer.original, canvasPointer.originalBounds, canvasPointer.handle, delta);
        } else {
            moveCanvasItem(item, canvasPointer.original, delta);
        }
        renderCanvasArtwork();
        return;
    }
    const item = canvasPointer.item;
    if (item.points) {
        const lastPoint = item.points[item.points.length - 1];
        if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 1.4 || item.points.length >= 10000) return;
        point.pressure = event.pointerType === "mouse" ? 1 : Math.max(0.05, event.pressure || 1);
        item.points.push(point);
    } else {
        item.width = point.x - canvasPointer.start.x;
        item.height = point.y - canvasPointer.start.y;
    }
    renderCanvasPreview(item);
});

function finishCanvasPointer(event) {
    if (!canvasPointer) return;
    if (canvasPointer.mode === "move" || canvasPointer.mode === "resize") {
        if (canvasPointer.moved && event.type === "pointerup") scheduleCanvasSave();
        canvasPointer = null;
        renderCanvasPreview(null);
        return;
    }
    if (event.type === "pointerup") {
        const point = canvasPoint(event);
        const item = canvasPointer.item;
        if (item.points) {
            const lastPoint = item.points[item.points.length - 1];
            if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 1) {
                point.pressure = event.pointerType === "mouse" ? 1 : Math.max(0.05, event.pressure || 1);
                item.points.push(point);
            }
        } else {
            item.width = point.x - canvasPointer.start.x;
            item.height = point.y - canvasPointer.start.y;
        }
    }
    drawCanvasItem(drawingCanvas.getContext("2d"), canvasPointer.item);
    canvasDrawings.push(canvasPointer.item);
    canvasPointer = null;
    renderCanvasPreview(null);
    scheduleCanvasSave();
}

drawingCanvas.addEventListener("pointerup", finishCanvasPointer);
drawingCanvas.addEventListener("pointercancel", finishCanvasPointer);

document.querySelectorAll("[data-canvas-tool]").forEach((button) => {
    button.addEventListener("click", () => setCanvasTool(button.dataset.canvasTool));
});
document.querySelector("[data-canvas-size]").addEventListener("input", (event) => {
    document.querySelector("[data-canvas-size-label]").textContent = `${event.target.value} px`;
});
document.querySelector("[data-canvas-brush]").addEventListener("change", scheduleCanvasSave);
document.querySelector("[data-canvas-tip]").addEventListener("change", scheduleCanvasSave);
document.querySelector("[data-canvas-opacity]").addEventListener("input", (event) => {
    document.querySelector("[data-canvas-opacity-label]").textContent = `${event.target.value}%`;
    scheduleCanvasSave();
});
document.querySelector("[data-canvas-smoothing]").addEventListener("input", (event) => {
    document.querySelector("[data-canvas-smoothing-label]").textContent = `${event.target.value}%`;
    scheduleCanvasSave();
});
document.querySelectorAll("[data-canvas-swatch]").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelector("[data-canvas-color]").value = button.dataset.canvasSwatch;
    });
});
document.addEventListener("pointerdown", (event) => {
    const menu = document.querySelector("[data-canvas-brush-menu]");
    if (menu.open && !menu.contains(event.target)) menu.open = false;
});
document.querySelector("[data-canvas-undo]").addEventListener("click", () => restoreCanvasHistory(canvasUndoStack, canvasRedoStack));
document.querySelector("[data-canvas-redo]").addEventListener("click", () => restoreCanvasHistory(canvasRedoStack, canvasUndoStack));
document.querySelector("[data-canvas-grid]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const visible = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(visible));
    document.querySelector("[data-canvas-artboard]").classList.toggle("grid-hidden", !visible);
});
document.querySelector("[data-canvas-background]").addEventListener("input", (event) => {
    if (!activeCanvasProject) return;
    activeCanvasProject.background = event.target.value;
    document.querySelector("[data-canvas-artboard]").style.backgroundColor = event.target.value;
    document.querySelector("[data-canvas-background-label]").textContent =
        event.target.value.toLowerCase() === "#ffffff" ? "Pure white" : event.target.value.toUpperCase();
    scheduleCanvasSave();
});
document.querySelector("[data-canvas-clear]").addEventListener("click", () => {
    if (!activeCanvasProject) return;
    const layer = activeCanvasProject.layers.find((candidate) => candidate.id === activeCanvasLayerId);
    if (layer?.locked) {
        document.querySelector("[data-canvas-tool-status]").textContent = "Unlock this layer to clear it";
        return;
    }
    const remaining = canvasDrawings.filter((item) => item.layerId !== activeCanvasLayerId);
    if (remaining.length === canvasDrawings.length) return;
    pushCanvasHistory();
    canvasDrawings = remaining;
    selectedCanvasIndex = null;
    renderCanvasLayers();
    renderCanvasArtwork();
    scheduleCanvasSave();
});
document.querySelector("[data-canvas-add-layer]").addEventListener("click", addCanvasLayer);
document.querySelector("[data-canvas-zoom-in]").addEventListener("click", () => setCanvasZoom(canvasZoom + 0.15));
document.querySelector("[data-canvas-zoom-out]").addEventListener("click", () => setCanvasZoom(canvasZoom - 0.15));
document.querySelector("[data-canvas-fit]").addEventListener("click", fitCanvasToStage);
document.querySelector("[data-canvas-export]").addEventListener("click", exportCanvasPng);
document.querySelector("[data-canvas-save]").addEventListener("click", () => {
    persistCanvasProject();
    const blob = new Blob([JSON.stringify(activeCanvasProject, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeCanvasProject.name}.smartdesk-canvas.json`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.querySelector("[data-canvas-open]").addEventListener("click", () => document.querySelector("[data-canvas-file]").click());
document.querySelector("[data-canvas-file]").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importCanvasProject(file);
    event.target.value = "";
});
document.querySelector("[data-canvas-import-image]").addEventListener("click", () => {
    document.querySelector("[data-canvas-image-file]").click();
});
document.querySelector("[data-canvas-image-file]").addEventListener("change", (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file || !activeCanvasProject) return;
    const activeLayer = activeCanvasProject.layers.find((layer) => layer.id === activeCanvasLayerId);
    if (!activeLayer?.visible || activeLayer.locked) {
        document.querySelector("[data-canvas-tool-status]").textContent = activeLayer?.locked
            ? "Unlock this layer to import an image" : "Show this layer to import an image";
        return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        const image = new Image();
        image.addEventListener("load", () => {
            const scale = Math.min(1, 1600 / image.naturalWidth, 1000 / image.naturalHeight);
            const width = Math.max(1, Math.round(image.naturalWidth * scale));
            const height = Math.max(1, Math.round(image.naturalHeight * scale));
            const bitmap = document.createElement("canvas");
            bitmap.width = width;
            bitmap.height = height;
            bitmap.getContext("2d").drawImage(image, 0, 0, width, height);
            const src = bitmap.toDataURL("image/webp", 0.86);
            if (src.length > 8_000_000) {
                document.querySelector("[data-canvas-tool-status]").textContent = "Image is too large to embed in this project";
                return;
            }
            pushCanvasHistory();
            canvasImageCache.set(src, image);
            canvasDrawings.push({
                type: "image", src, x: (1600 - width) / 2, y: (1000 - height) / 2,
                width, height, size: 1, color: "#000000", layerId: activeCanvasLayerId
            });
            selectedCanvasIndex = canvasDrawings.length - 1;
            setCanvasTool("select");
            renderCanvasLayers();
            renderCanvasArtwork();
            scheduleCanvasSave();
        }, { once: true });
        image.addEventListener("error", () => {
            document.querySelector("[data-canvas-tool-status]").textContent = "Could not read that image";
        }, { once: true });
        image.src = String(reader.result);
    });
    reader.addEventListener("error", () => {
        document.querySelector("[data-canvas-tool-status]").textContent = "Could not read that image";
    }, { once: true });
    reader.readAsDataURL(file);
});
document.querySelector("[data-canvas-resume]").addEventListener("click", () => {
    try {
        const saved = localStorage.getItem(canvasProjectStorageKey);
        if (saved === null) throw new Error("There is no saved canvas to resume.");
        startCanvasWaterTransition(validateCanvasProject(JSON.parse(saved)));
    } catch (error) {
        console.warn("Unable to resume the saved canvas project.", error);
        document.querySelector("[data-canvas-resume-status]").textContent = error.message || "Unable to resume saved canvas.";
    }
});
document.querySelector("[data-canvas-project-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const project = createCanvasProject(String(form.get("name") || ""), String(form.get("description") || ""));
    startCanvasWaterTransition(project);
});
document.querySelector("[data-canvas-text-cancel]").addEventListener("click", () => {
    pendingCanvasTextPoint = null;
    document.querySelector("[data-canvas-text-dialog]").close();
});
document.querySelector("[data-canvas-text-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") || "").trim();
    const layer = activeCanvasProject?.layers.find((candidate) => candidate.id === activeCanvasLayerId);
    if (!text || !pendingCanvasTextPoint || !layer?.visible || layer.locked) return;
    pushCanvasHistory();
    canvasDrawings.push({
        type: "text",
        text: text.slice(0, 200),
        fontFamily: String(form.get("fontFamily") || "sans-serif"),
        color: document.querySelector("[data-canvas-color]").value,
        size: Number(document.querySelector("[data-canvas-size]").value),
        opacity: Number(document.querySelector("[data-canvas-opacity]").value) / 100,
        layerId: activeCanvasLayerId,
        x: pendingCanvasTextPoint.x,
        y: pendingCanvasTextPoint.y
    });
    selectedCanvasIndex = canvasDrawings.length - 1;
    pendingCanvasTextPoint = null;
    document.querySelector("[data-canvas-text-dialog]").close();
    setCanvasTool("select");
    renderCanvasLayers();
    renderCanvasArtwork();
    scheduleCanvasSave();
});
document.querySelector("[data-canvas-text-dialog]").addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === event.currentTarget) event.currentTarget.close();
});

document.addEventListener("keydown", (event) => {
    const editor = document.querySelector("#canvasEditor");
    if (editor.hidden) return;
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (typing) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) restoreCanvasHistory(canvasRedoStack, canvasUndoStack);
        else restoreCanvasHistory(canvasUndoStack, canvasRedoStack);
        return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        document.querySelector("[data-canvas-save]").click();
        return;
    }
    const shortcuts = { v: "select", b: "brush", e: "eraser", i: "eyedropper", l: "line", r: "rectangle", o: "ellipse", h: "polygon", a: "star", t: "text" };
    if (shortcuts[key]) {
        event.preventDefault();
        setCanvasTool(shortcuts[key]);
    } else if ((key === "delete" || key === "backspace") && selectedCanvasIndex !== null) {
        const item = canvasDrawings[selectedCanvasIndex];
        const layer = activeCanvasProject.layers.find((candidate) => candidate.id === item.layerId);
        if (!layer?.locked) {
            event.preventDefault();
            pushCanvasHistory();
            canvasDrawings.splice(selectedCanvasIndex, 1);
            selectedCanvasIndex = null;
            renderCanvasLayers();
            renderCanvasArtwork();
            scheduleCanvasSave();
        }
    } else if (key === "escape") {
        selectedCanvasIndex = null;
        renderCanvasPreview(null);
    } else if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) && selectedCanvasIndex !== null) {
        const item = canvasDrawings[selectedCanvasIndex];
        const layer = activeCanvasProject.layers.find((candidate) => candidate.id === item.layerId);
        if (layer && !layer.locked && layer.visible) {
            event.preventDefault();
            pushCanvasHistory();
            const step = event.shiftKey ? 10 : 1;
            const delta = {
                x: key === "arrowleft" ? -step : key === "arrowright" ? step : 0,
                y: key === "arrowup" ? -step : key === "arrowdown" ? step : 0
            };
            moveCanvasItem(item, JSON.parse(JSON.stringify(item)), delta);
            renderCanvasArtwork();
            scheduleCanvasSave();
        }
    } else if (key === "+" || key === "=") {
        setCanvasZoom(canvasZoom + 0.1);
    } else if (key === "-") {
        setCanvasZoom(canvasZoom - 0.1);
    }
});
document.querySelector("[data-close-canvas-setup]").addEventListener("click", resetBubbles);
document.querySelector("[data-close-canvas]").addEventListener("click", resetBubbles);
document.querySelector("#canvasEditor").addEventListener("click", (event) => event.stopPropagation());

function selectEditorTool(tool) {
    activeTool = tool;
    document.querySelectorAll("[data-tool]").forEach((button) => {
        const active = button.dataset.tool === tool;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    if (cadControls) cadControls.mouseButtons.LEFT = tool === "orbit" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    modelCanvas.style.cursor = tool === "orbit" ? "grab" : tool === "move" ? "move" : "crosshair";
    document.querySelector("[data-viewport-hint]").textContent = tool === "orbit"
        ? "Drag to orbit the view · Scroll to zoom"
        : tool === "rotate"
            ? "Drag a selected body to rotate · Right-drag to orbit"
            : "Drag a body to move · Ctrl-click two bodies for Booleans · Right-drag to orbit";
}

function legacyResizeModelCanvas() {
    const bounds = modelCanvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    modelCanvas.width = Math.round(bounds.width * ratio);
    modelCanvas.height = Math.round(bounds.height * ratio);
    modelContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderModel();
}

function normalize3(vector) {
    const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot3(first, second) {
    return first.x * second.x + first.y * second.y + first.z * second.z;
}

function cameraBasis() {
    const { yaw, pitch } = viewportCamera;
    const forward = {
        x: -Math.sin(yaw) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: -Math.cos(yaw) * Math.cos(pitch)
    };
    const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
    return {
        forward,
        right,
        up: normalize3({
            x: right.y * forward.z - right.z * forward.y,
            y: right.z * forward.x - right.x * forward.z,
            z: right.x * forward.y - right.y * forward.x
        })
    };
}

function projectModelPoint(point, width, height) {
    const { forward, right, up } = cameraBasis();
    const relativePoint = { x: point.x, y: point.y, z: point.z };
    const depth = viewportCamera.distance + dot3(relativePoint, forward);
    if (depth < 15) return null;
    const focal = Math.min(width, height) * 0.98;
    const scale = focal / depth;
    return {
        x: width * 0.5 + dot3(relativePoint, right) * scale,
        y: height * 0.5 - dot3(relativePoint, up) * scale,
        depth,
        scale
    };
}

function traceWorldLine(first, second, width, height) {
    const a = projectModelPoint(first, width, height);
    const b = projectModelPoint(second, width, height);
    if (!a || !b) return false;
    modelContext.beginPath();
    modelContext.moveTo(a.x, a.y);
    modelContext.lineTo(b.x, b.y);
    return true;
}

function drawBuildGrid(width, height) {
    const ctx = modelContext;
    const corners = [
        { x: -110, y: 0, z: -110 },
        { x: 110, y: 0, z: -110 },
        { x: 110, y: 0, z: 110 },
        { x: -110, y: 0, z: 110 }
    ].map((point) => projectModelPoint(point, width, height));
    if (corners.every(Boolean)) {
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.slice(1).forEach((corner) => ctx.lineTo(corner.x, corner.y));
        ctx.closePath();
        ctx.fillStyle = "rgba(115, 167, 208, 0.065)";
        ctx.fill();
        ctx.strokeStyle = "rgba(95, 143, 186, 0.24)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    for (let coordinate = -110; coordinate <= 110; coordinate += 10) {
        const major = coordinate % 50 === 0;
        ctx.lineWidth = major ? 0.9 : 0.55;
        ctx.strokeStyle = coordinate === 0 ? "rgba(114, 153, 191, 0.54)" :
            major ? "rgba(133, 170, 202, 0.27)" : "rgba(146, 179, 205, 0.17)";
        if (traceWorldLine({ x: coordinate, y: 0, z: -110 }, { x: coordinate, y: 0, z: 110 }, width, height)) ctx.stroke();
        if (traceWorldLine({ x: -110, y: 0, z: coordinate }, { x: 110, y: 0, z: coordinate }, width, height)) ctx.stroke();
    }

    const origin = projectModelPoint({ x: 0, y: 0, z: 0 }, width, height);
    if (origin) {
        ctx.font = "9px Segoe UI, sans-serif";
        ctx.fillStyle = "rgba(105, 133, 163, 0.8)";
        ctx.fillText("0", origin.x + 5, origin.y + 12);
        for (const value of [-100, -50, 50, 100]) {
            const label = projectModelPoint({ x: value, y: 0, z: 110 }, width, height);
            if (label && label.x > 8 && label.x < width - 18) {
                ctx.fillText(String(value), label.x - 8, label.y + 12);
            }
        }
    }
}

function rotateLocalPoint(point, object) {
    let { x, y, z } = point;
    const rx = object.rotationX * Math.PI / 180;
    const ry = object.rotationY * Math.PI / 180;
    const rz = object.rotationZ * Math.PI / 180;
    let nextY = y * Math.cos(rx) - z * Math.sin(rx);
    let nextZ = y * Math.sin(rx) + z * Math.cos(rx);
    y = nextY;
    z = nextZ;
    let nextX = x * Math.cos(ry) + z * Math.sin(ry);
    nextZ = -x * Math.sin(ry) + z * Math.cos(ry);
    x = nextX;
    z = nextZ;
    nextX = x * Math.cos(rz) - y * Math.sin(rz);
    nextY = x * Math.sin(rz) + y * Math.cos(rz);
    return { x: nextX + object.x, y: nextY + object.y + object.height / 2, z: z + object.z };
}

function modelTriangles(object) {
    const hx = object.width / 2;
    const hy = object.height / 2;
    const hz = object.depth / 2;
    const triangles = [];
    const add = (a, b, c) => triangles.push([a, b, c]);
    if (object.type === "box") {
        const v = [
            [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
            [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]
        ].map(([x, y, z]) => ({ x, y, z }));
        [[0, 2, 1, 0, 3, 2], [4, 5, 6, 4, 6, 7], [0, 1, 5, 0, 5, 4],
            [3, 7, 6, 3, 6, 2], [0, 4, 7, 0, 7, 3], [1, 2, 6, 1, 6, 5]]
            .forEach((face) => {
                for (let index = 0; index < face.length; index += 3) add(v[face[index]], v[face[index + 1]], v[face[index + 2]]);
            });
    } else if (object.type === "cylinder") {
        const segments = 32;
        const top = [];
        const bottom = [];
        for (let index = 0; index < segments; index += 1) {
            const angle = Math.PI * 2 * index / segments;
            const x = Math.cos(angle) * hx;
            const z = Math.sin(angle) * hz;
            top.push({ x, y: hy, z });
            bottom.push({ x, y: -hy, z });
        }
        const topCenter = { x: 0, y: hy, z: 0 };
        const bottomCenter = { x: 0, y: -hy, z: 0 };
        for (let index = 0; index < segments; index += 1) {
            const next = (index + 1) % segments;
            add(topCenter, top[index], top[next]);
            add(bottomCenter, bottom[next], bottom[index]);
            add(bottom[index], bottom[next], top[next]);
            add(bottom[index], top[next], top[index]);
        }
    } else if (object.type === "sphere") {
        const rings = 12;
        const segments = 24;
        const vertex = (ring, segment) => {
            const latitude = -Math.PI / 2 + Math.PI * ring / rings;
            const longitude = 2 * Math.PI * segment / segments;
            return {
                x: Math.cos(latitude) * Math.cos(longitude) * hx,
                y: Math.sin(latitude) * hy,
                z: Math.cos(latitude) * Math.sin(longitude) * hz
            };
        };
        for (let ring = 0; ring < rings; ring += 1) {
            for (let segment = 0; segment < segments; segment += 1) {
                const next = (segment + 1) % segments;
                const a = vertex(ring, segment);
                const b = vertex(ring + 1, segment);
                const c = vertex(ring + 1, next);
                const d = vertex(ring, next);
                add(a, b, d);
                add(b, c, d);
            }
        }
    }
    return triangles;
}

function shadeModelColor(hexColor, amount) {
    const raw = hexColor.replace("#", "");
    const red = parseInt(raw.slice(0, 2), 16) || 0;
    const green = parseInt(raw.slice(2, 4), 16) || 0;
    const blue = parseInt(raw.slice(4, 6), 16) || 0;
    return `rgb(${Math.min(255, Math.round(red * amount))}, ${Math.min(255, Math.round(green * amount))}, ${Math.min(255, Math.round(blue * amount))})`;
}

function drawModelObject(object, width, height, selected) {
    const ctx = modelContext;
    const light = normalize3({ x: -0.5, y: 0.82, z: 0.35 });
    const faces = modelTriangles(object).map((triangle) => {
        const world = triangle.map((point) => rotateLocalPoint(point, object));
        const projected = world.map((point) => projectModelPoint(point, width, height));
        const averageDepth = projected.reduce((total, point) => total + (point?.depth || 0), 0) / projected.length;
        const first = {
            x: world[1].x - world[0].x, y: world[1].y - world[0].y, z: world[1].z - world[0].z
        };
        const second = {
            x: world[2].x - world[0].x, y: world[2].y - world[0].y, z: world[2].z - world[0].z
        };
        const normal = normalize3({
            x: first.y * second.z - first.z * second.y,
            y: first.z * second.x - first.x * second.z,
            z: first.x * second.y - first.y * second.x
        });
        const lighting = 0.73 + Math.abs(dot3(normal, light)) * 0.28;
        return { projected, averageDepth, fill: shadeModelColor(object.color, lighting) };
    }).sort((a, b) => b.averageDepth - a.averageDepth);

    faces.forEach((face) => {
        if (face.projected.some((point) => !point)) return;
        ctx.beginPath();
        ctx.moveTo(face.projected[0].x, face.projected[0].y);
        ctx.lineTo(face.projected[1].x, face.projected[1].y);
        ctx.lineTo(face.projected[2].x, face.projected[2].y);
        ctx.closePath();
        ctx.fillStyle = face.fill;
        ctx.fill();
        ctx.strokeStyle = selected ? "rgba(255,255,255,0.72)" : "rgba(48,76,106,0.22)";
        ctx.lineWidth = selected ? 1.25 : 0.65;
        ctx.stroke();
    });

    const center = projectModelPoint({ x: object.x, y: object.y + object.height / 2, z: object.z }, width, height);
    if (center && selected) {
        const extent = Math.max(object.width, object.depth, object.height) * center.scale * 0.72;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, Math.max(extent, 14), Math.max(extent * 0.62, 10), 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(82, 132, 190, 0.42)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawAxisGizmo(width, height) {
    const ctx = modelContext;
    const origin = projectModelPoint({ x: 0, y: 0, z: 0 }, width, height);
    if (!origin) return;
    const axes = [
        { key: "X", point: { x: 26, y: 0, z: 0 }, color: "#d77a7e" },
        { key: "Y", point: { x: 0, y: 26, z: 0 }, color: "#58a67f" },
        { key: "Z", point: { x: 0, y: 0, z: 26 }, color: "#628fc9" }
    ];
    axes.forEach((axis) => {
        const end = projectModelPoint(axis.point, width, height);
        if (!end) return;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = axis.color;
        ctx.font = "bold 9px Segoe UI, sans-serif";
        ctx.fillText(axis.key, end.x + 3, end.y - 3);
    });
}

function renderLegacyModel() {
    if (!modelEditor || modelEditor.hidden || !modelContext) return;
    const bounds = modelCanvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (modelCanvas.width !== Math.round(bounds.width * ratio) || modelCanvas.height !== Math.round(bounds.height * ratio)) {
        resizeModelCanvas();
        return;
    }
    const ctx = modelContext;
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    drawBuildGrid(bounds.width, bounds.height);
    if (activeProject) {
        const objects = activeProject.objects.map((object) => ({
            object,
            depth: projectModelPoint({ x: object.x, y: object.y + object.height / 2, z: object.z }, bounds.width, bounds.height)?.depth || 0
        })).sort((first, second) => second.depth - first.depth);
        objects.forEach(({ object }) => drawModelObject(object, bounds.width, bounds.height, object.id === selectedObjectId));
    }
    drawAxisGizmo(bounds.width, bounds.height);
    const zoom = Math.round(400 / viewportCamera.distance * 100);
    document.querySelector("[data-zoom-status]").textContent = `ZOOM ${zoom}%`;
}

function legacyHitTestModelObject(screenX, screenY) {
    if (!activeProject) return null;
    const bounds = modelCanvas.getBoundingClientRect();
    const candidates = activeProject.objects.map((object) => {
        const center = projectModelPoint({ x: object.x, y: object.y + object.height / 2, z: object.z }, bounds.width, bounds.height);
        if (!center) return null;
        const radius = Math.max(17, Math.max(object.width, object.depth, object.height) * center.scale * 0.72);
        const distance = Math.hypot(screenX - center.x, screenY - center.y);
        return distance <= radius ? { object, distance, depth: center.depth } : null;
    }).filter(Boolean).sort((a, b) => a.distance - b.distance || a.depth - b.depth);
    return candidates[0]?.object || null;
}

function moveModelObjectOnGround(object, deltaX, deltaY) {
    const width = modelCanvas.clientWidth;
    const height = modelCanvas.clientHeight;
    const point = { x: object.x, y: object.y + object.height / 2, z: object.z };
    const origin = projectModelPoint(point, width, height);
    const xProjection = projectModelPoint({ ...point, x: point.x + 1 }, width, height);
    const zProjection = projectModelPoint({ ...point, z: point.z + 1 }, width, height);
    if (!origin || !xProjection || !zProjection) return;
    const a = xProjection.x - origin.x;
    const b = zProjection.x - origin.x;
    const c = xProjection.y - origin.y;
    const d = zProjection.y - origin.y;
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 0.0001) return;
    const worldX = (deltaX * d - b * deltaY) / determinant;
    const worldZ = (a * deltaY - deltaX * c) / determinant;
    const nextX = Math.max(-110, Math.min(110, object.x + worldX));
    const nextZ = Math.max(-110, Math.min(110, object.z + worldZ));
    object.x = snapToGrid ? Math.round(nextX / 10) * 10 : Math.round(nextX);
    object.z = snapToGrid ? Math.round(nextZ / 10) * 10 : Math.round(nextZ);
    object.y = 0;
}

function legacyHandleModelPointerDown(event) {
    if (!activeProject) return;
    const rect = modelCanvas.getBoundingClientRect();
    if (event.button === 2 || activeTool === "orbit" || event.altKey) {
        pointerInteraction = { kind: "orbit", lastX: event.clientX, lastY: event.clientY };
        modelCanvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
    }
    if (event.button !== 0) return;

    const target = legacyHitTestModelObject(event.clientX - rect.left, event.clientY - rect.top);
    if (!target) {
        if (activeTool === "select") {
            selectedObjectId = null;
            updateSceneInterface();
        }
        return;
    }

    selectModelObject(target.id);
    pointerInteraction = {
        kind: activeTool === "rotate" ? "rotate" : activeTool === "move" || activeTool === "select" ? "move" : "select",
        objectId: target.id,
        lastX: event.clientX,
        lastY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        historyRecorded: false
    };
    modelCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
}

function legacyHandleModelPointerMove(event) {
    if (!pointerInteraction) return;
    const current = pointerInteraction;
    const deltaX = event.clientX - current.lastX;
    const deltaY = event.clientY - current.lastY;
    if (current.kind !== "orbit" && Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY) > 1) {
        current.moved = true;
    }
    if (current.kind === "orbit") {
        viewportCamera.yaw -= deltaX * 0.008;
        viewportCamera.pitch = Math.max(0.12, Math.min(1.42, viewportCamera.pitch + deltaY * 0.006));
        modelCanvas.style.cursor = "grabbing";
        renderModel();
    } else if (current.kind === "move" || current.kind === "select") {
        const object = activeProject.objects.find((item) => item.id === current.objectId);
        if (object && current.moved) {
            const movedObject = { ...object };
            moveModelObjectOnGround(movedObject, deltaX, deltaY);
            if (movedObject.x !== object.x || movedObject.z !== object.z) {
                if (!current.historyRecorded) {
                    recordProjectChange();
                    current.historyRecorded = true;
                }
                object.x = movedObject.x;
                object.z = movedObject.z;
                updateSceneInterface();
                scheduleProjectSave();
            }
        }
    } else if (current.kind === "rotate") {
        const object = activeProject.objects.find((item) => item.id === current.objectId);
        if (object) {
            const rotationY = Math.round((object.rotationY + deltaX * 0.7) / 5) * 5;
            const rotationX = Math.round((object.rotationX + deltaY * 0.35) / 5) * 5;
            if (rotationX !== object.rotationX || rotationY !== object.rotationY) {
                if (!current.historyRecorded) {
                    recordProjectChange();
                    current.historyRecorded = true;
                }
                object.rotationX = rotationX;
                object.rotationY = rotationY;
                updateSceneInterface();
                scheduleProjectSave();
            }
        }
    }
    current.lastX = event.clientX;
    current.lastY = event.clientY;
}

function legacyHandleModelPointerUp() {
    if (pointerInteraction?.moved && pointerInteraction.kind !== "orbit") {
        scheduleProjectSave();
    }
    pointerInteraction = null;
    if (activeTool === "orbit") modelCanvas.style.cursor = "grab";
    else modelCanvas.style.cursor = activeTool === "move" ? "move" : "crosshair";
}

function createProfileShape(kind, width, depth) {
    const shape = new THREE.Shape();
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    if (kind === "circle") {
        shape.absellipse(0, 0, halfWidth, halfDepth, 0, Math.PI * 2, false, 0);
    } else if (kind === "slot") {
        const radius = Math.min(halfWidth, halfDepth);
        if (width >= depth) {
            shape.moveTo(-halfWidth + radius, -halfDepth);
            shape.lineTo(halfWidth - radius, -halfDepth);
            shape.absarc(halfWidth - radius, 0, radius, -Math.PI / 2, Math.PI / 2, false);
            shape.lineTo(-halfWidth + radius, halfDepth);
            shape.absarc(-halfWidth + radius, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
        } else {
            shape.moveTo(-halfWidth, -halfDepth + radius);
            shape.absarc(0, -halfDepth + radius, radius, Math.PI, Math.PI * 2, false);
            shape.lineTo(halfWidth, halfDepth - radius);
            shape.absarc(0, halfDepth - radius, radius, 0, Math.PI, false);
        }
    } else if (kind === "hexagon" || kind === "star") {
        const points = kind === "hexagon" ? 6 : 10;
        for (let index = 0; index < points; index += 1) {
            const angle = -Math.PI / 2 + index * Math.PI * 2 / points;
            const multiplier = kind === "star" && index % 2 ? 0.46 : 1;
            const x = Math.cos(angle) * halfWidth * multiplier;
            const y = Math.sin(angle) * halfDepth * multiplier;
            if (index === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
    } else {
        shape.moveTo(-halfWidth, -halfDepth);
        shape.lineTo(halfWidth, -halfDepth);
        shape.lineTo(halfWidth, halfDepth);
        shape.lineTo(-halfWidth, halfDepth);
        shape.closePath();
    }
    return shape;
}

function centerCadGeometry(geometry) {
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
}

function removeDegenerateTriangles(geometry) {
    const index = geometry.getIndex();
    const positions = geometry.getAttribute("position");
    if (!index || !positions) return geometry;

    geometry.computeBoundingBox();
    const diagonal = geometry.boundingBox.getSize(new THREE.Vector3()).length();
    const minimumDoubleArea = Math.max(diagonal * diagonal * 1e-10, 1e-12);
    const validIndices = [];
    for (let offset = 0; offset < index.count; offset += 3) {
        const aIndex = index.getX(offset);
        const bIndex = index.getX(offset + 1);
        const cIndex = index.getX(offset + 2);
        const a = new THREE.Vector3().fromBufferAttribute(positions, aIndex);
        const b = new THREE.Vector3().fromBufferAttribute(positions, bIndex);
        const c = new THREE.Vector3().fromBufferAttribute(positions, cIndex);
        const doubleArea = b.sub(a).cross(c.sub(a)).length();
        if (doubleArea > minimumDoubleArea) {
            validIndices.push(aIndex, bIndex, cIndex);
        }
    }
    if (validIndices.length !== index.count) geometry.setIndex(validIndices);
    return geometry;
}

function createCadGeometry(object) {
    const width = Math.max(0.1, Number(object.width) || 1);
    const depth = Math.max(0.1, Number(object.depth) || 1);
    const height = Math.max(0.1, Number(object.height) || 1);
    let geometry;
    if (object.type === "mesh" && object.meshData?.positions?.length) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(object.meshData.positions, 3));
        if (object.meshData.indices?.length) geometry.setIndex(object.meshData.indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        return geometry;
    }
    if (object.type === "extrude") {
        const shape = createProfileShape(object.profile?.kind || "rectangle", width, depth);
        geometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: Boolean(object.profile?.bevel),
            bevelThickness: Number(object.profile?.bevel) || 0,
            bevelSize: Number(object.profile?.bevel) || 0,
            bevelSegments: object.profile?.edgeStyle === "chamfer" ? 1 : 5,
            curveSegments: 32,
            steps: 1
        });
        geometry.rotateX(-Math.PI / 2);
        centerCadGeometry(geometry);
        const bounds = geometry.boundingBox;
        const size = bounds.getSize(new THREE.Vector3());
        geometry.scale(width / size.x, height / size.y, depth / size.z);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        return geometry;
    }
    if (object.type === "revolve") {
        const outerRadius = width / 2;
        const innerRadius = Math.min(outerRadius - 0.1, Math.max(0, depth / 2));
        const points = [
            new THREE.Vector2(innerRadius, -height / 2),
            new THREE.Vector2(outerRadius, -height / 2),
            new THREE.Vector2(outerRadius, height / 2),
            new THREE.Vector2(innerRadius, height / 2)
        ];
        geometry = new THREE.LatheGeometry(points, 64);
        return centerCadGeometry(geometry);
    }
    if (object.type === "box") {
        geometry = new THREE.BoxGeometry(width, height, depth);
    } else if (object.type === "cylinder") {
        geometry = new THREE.CylinderGeometry(width / 2, width / 2, height, 48);
        geometry.scale(1, 1, depth / width);
    } else if (object.type === "cone") {
        geometry = new THREE.ConeGeometry(width / 2, height, 48);
        geometry.scale(1, 1, depth / width);
    } else if (object.type === "sphere") {
        geometry = new THREE.SphereGeometry(1, 40, 24);
        geometry.scale(width / 2, height / 2, depth / 2);
    } else if (object.type === "torus") {
        geometry = new THREE.TorusGeometry(0.36, 0.14, 20, 64);
        geometry.scale(width, depth, height / 0.28);
        geometry.rotateX(Math.PI / 2);
    } else if (object.type === "capsule") {
        geometry = new THREE.CapsuleGeometry(0.5, 1, 10, 32);
        geometry.scale(width, height / 2, depth);
        removeDegenerateTriangles(geometry);
    } else if (object.type === "pyramid") {
        geometry = new THREE.ConeGeometry(width / 2, height, 4);
        geometry.scale(1, 1, depth / width);
        geometry.rotateY(Math.PI / 4);
    } else if (object.type === "wedge") {
        const shape = new THREE.Shape();
        shape.moveTo(-width / 2, 0);
        shape.lineTo(width / 2, 0);
        shape.lineTo(width / 2, height);
        shape.closePath();
        geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, 0, depth / 2);
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        geometry.scale(width / size.x, height / size.y, depth / size.z);
    } else {
        geometry = new THREE.BoxGeometry(width, height, depth);
    }
    return centerCadGeometry(geometry);
}

function cadGeometrySignature(object) {
    let meshDataId = null;
    if (object.meshData && typeof object.meshData === "object") {
        meshDataId = cadMeshDataIds.get(object.meshData);
        if (!meshDataId) {
            meshDataId = nextCadMeshDataId;
            nextCadMeshDataId += 1;
            cadMeshDataIds.set(object.meshData, meshDataId);
        }
    }
    return JSON.stringify([
        object.type, object.width, object.depth, object.height, object.profile || null, meshDataId,
        object.meshData?.size || null
    ]);
}

function createCadMesh(object) {
    const geometry = createCadGeometry(object);
    const material = new THREE.MeshStandardMaterial({
        color: object.color || "#7ea5d0",
        roughness: 0.48,
        metalness: 0.08
    });
    const mesh = new THREE.Mesh(geometry, material);
    if (object.type === "mesh" && object.meshData?.size) {
        mesh.scale.set(
            object.width / Math.max(0.001, object.meshData.size.width),
            object.height / Math.max(0.001, object.meshData.size.height),
            object.depth / Math.max(0.001, object.meshData.size.depth)
        );
    }
    mesh.position.set(object.x || 0, (object.y || 0) + (object.height || 0) / 2, object.z || 0);
    mesh.rotation.set(
        THREE.MathUtils.degToRad(object.rotationX || 0),
        THREE.MathUtils.degToRad(object.rotationY || 0),
        THREE.MathUtils.degToRad(object.rotationZ || 0)
    );
    mesh.userData.objectId = object.id;
    return mesh;
}

function initializeCadViewport() {
    if (cadRenderer) return;
    cadRenderer = new THREE.WebGLRenderer({ canvas: modelCanvas, antialias: true, alpha: false });
    cadRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    cadRenderer.outputColorSpace = THREE.SRGBColorSpace;
    cadRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    cadRenderer.toneMappingExposure = 1.12;
    cadRenderer.setClearColor(colorMode === "dark" ? 0x111b24 : 0xf1f5f9, 1);
    cadRenderer.localClippingEnabled = true;

    cadScene = new THREE.Scene();
    cadScene.background = new THREE.Color(colorMode === "dark" ? 0x111b24 : 0xf1f5f9);
    cadCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
    cadCamera.position.set(270, 250, 310);
    cadControls = new OrbitControls(cadCamera, modelCanvas);
    cadControls.target.set(0, 30, 0);
    cadControls.enableDamping = true;
    cadControls.dampingFactor = 0.075;
    cadControls.minDistance = 70;
    cadControls.maxDistance = 1600;
    cadControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    cadControls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

    cadScene.add(new THREE.HemisphereLight(0xf5faff, 0x8291a3, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-160, 300, 220);
    cadScene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc6def5, 1.15);
    fillLight.position.set(180, 110, -180);
    cadScene.add(fillLight);

    cadPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(220, 220),
        new THREE.MeshBasicMaterial({
            color: colorMode === "dark" ? 0x263641 : 0xeaf1f7,
            transparent: true,
            opacity: colorMode === "dark" ? 0.78 : 0.55,
            side: THREE.DoubleSide
        })
    );
    cadPlate.rotation.x = -Math.PI / 2;
    cadPlate.position.y = -0.15;
    cadScene.add(cadPlate);
    cadGrid = new THREE.GridHelper(
        220,
        22,
        colorMode === "dark" ? 0x718da1 : 0x6989aa,
        colorMode === "dark" ? 0x3b505e : 0xc6d3df
    );
    cadGrid.position.y = 0.02;
    cadScene.add(cadGrid);
    const axes = new THREE.AxesHelper(38);
    axes.position.y = 0.04;
    cadScene.add(axes);
    cadControls.addEventListener("change", renderCadFrame);
    resizeModelCanvas();
}

function applyCadColorMode() {
    if (!cadRenderer || !cadScene || !cadPlate || !cadGrid) return;
    const dark = colorMode === "dark";
    const background = dark ? 0x111b24 : 0xf1f5f9;
    cadRenderer.setClearColor(background, 1);
    cadScene.background.setHex(background);
    cadPlate.material.color.setHex(dark ? 0x263641 : 0xeaf1f7);
    cadPlate.material.opacity = dark ? 0.78 : 0.55;
    cadGrid.material.forEach((material, index) => {
        material.color.setHex(dark
            ? index === 0 ? 0x718da1 : 0x3b505e
            : index === 0 ? 0x6989aa : 0xc6d3df);
    });
    cadGrid.material.forEach((material) => { material.needsUpdate = true; });
    renderCadFrame();
}

function replaceCadCamera(projection) {
    if (!cadRenderer || !cadScene || !cadCamera || !cadControls || cadProjection === projection) return;
    const target = cadControls.target.clone();
    const position = cadCamera.position.clone();
    const up = cadCamera.up.clone();
    const aspect = Math.max(0.1, modelCanvas.clientWidth / Math.max(1, modelCanvas.clientHeight));
    const direction = position.clone().sub(target).normalize();
    const viewHeight = cadCamera.isOrthographicCamera
        ? (cadCamera.top - cadCamera.bottom) / cadCamera.zoom
        : 2 * position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(cadCamera.fov / 2));

    cadControls.dispose();
    if (projection === "orthographic") {
        orthographicViewHeight = Math.max(1, viewHeight);
        cadCamera = new THREE.OrthographicCamera(
            -orthographicViewHeight * aspect / 2,
            orthographicViewHeight * aspect / 2,
            orthographicViewHeight / 2,
            -orthographicViewHeight / 2,
            0.1,
            5000
        );
    } else {
        cadCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 5000);
    }
    cadProjection = projection;
    const perspectiveFov = cadCamera.isPerspectiveCamera ? cadCamera.fov : 42;
    const perspectiveDistance = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(perspectiveFov / 2)));
    cadCamera.position.copy(target).addScaledVector(
        direction,
        projection === "perspective" ? perspectiveDistance : Math.max(position.distanceTo(target), 1)
    );
    cadCamera.up.copy(up);
    cadCamera.lookAt(target);
    cadControls = new OrbitControls(cadCamera, modelCanvas);
    cadControls.target.copy(target);
    cadControls.enableDamping = true;
    cadControls.dampingFactor = 0.075;
    cadControls.minDistance = 10;
    cadControls.maxDistance = 1600;
    cadControls.minZoom = 0.1;
    cadControls.maxZoom = 20;
    cadControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    cadControls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    cadControls.addEventListener("change", renderCadFrame);
    document.querySelector("[data-projection-toggle]").setAttribute("aria-pressed", String(projection === "orthographic"));
    document.querySelector("[data-projection-toggle]").textContent = projection === "orthographic" ? "Ortho" : "Persp";
    document.querySelector(".viewport-perspective").textContent =
        projection === "orthographic" ? "ORTHOGRAPHIC" : "PERSPECTIVE";
    resizeModelCanvas();
    renderModel();
}

function setStandardCadView(view) {
    if (!cadCamera || !cadControls) return;
    const directions = {
        front: { direction: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
        top: { direction: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
        right: { direction: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
        iso: { direction: new THREE.Vector3(1, 0.9, 1).normalize(), up: new THREE.Vector3(0, 1, 0) }
    };
    const preset = directions[view];
    if (!preset) return;
    const distance = cadCamera.position.distanceTo(cadControls.target);
    cadCamera.up.copy(preset.up);
    cadCamera.position.copy(cadControls.target).addScaledVector(preset.direction, distance);
    cadCamera.lookAt(cadControls.target);
    cadControls.update();
    document.querySelectorAll("[data-view]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    renderCadFrame();
}

function fitCadView(selectionOnly = false) {
    if (!activeProject || !cadCamera || !cadControls) return;
    syncCadMeshes();
    const bounds = new THREE.Box3();
    const selected = new Set(selectedObjectIds);
    for (const [id, entry] of cadMeshes) {
        if (!entry.mesh.visible) continue;
        if (selectionOnly && !selected.has(id)) continue;
        bounds.expandByObject(entry.mesh);
    }
    if (bounds.isEmpty()) {
        if (selectionOnly) {
            setSaveStatus("Select a body before fitting the selection", true);
            return;
        }
        bounds.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(220, 20, 220));
    }

    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1);
    const direction = cadCamera.position.clone().sub(cadControls.target).normalize();
    cadControls.target.copy(center);
    if (cadCamera.isPerspectiveCamera) {
        const halfFov = THREE.MathUtils.degToRad(cadCamera.fov / 2);
        const distance = Math.max(cadControls.minDistance, (radius * 1.25) / Math.sin(halfFov));
        cadCamera.position.copy(center).addScaledVector(direction, distance);
    } else {
        orthographicViewHeight = radius * 2.5;
        cadCamera.zoom = 1;
        const aspect = Math.max(0.1, cadCamera.aspect);
        cadCamera.left = -orthographicViewHeight * aspect / 2;
        cadCamera.right = orthographicViewHeight * aspect / 2;
        cadCamera.top = orthographicViewHeight / 2;
        cadCamera.bottom = -orthographicViewHeight / 2;
        cadCamera.position.copy(center).addScaledVector(direction, Math.max(radius * 3, 100));
        cadCamera.updateProjectionMatrix();
    }
    cadCamera.lookAt(center);
    cadControls.update();
    renderCadFrame();
}

function syncCadMeshes() {
    if (!activeProject || !cadScene) return;
    const present = new Set();
    activeProject.objects.forEach((object) => {
        present.add(object.id);
        const signature = cadGeometrySignature(object);
        let entry = cadMeshes.get(object.id);
        if (!entry || entry.signature !== signature) {
            if (entry) {
                cadScene.remove(entry.mesh);
                entry.mesh.geometry.dispose();
                entry.mesh.material.dispose();
            }
            const mesh = createCadMesh(object);
            entry = { mesh, signature };
            cadMeshes.set(object.id, entry);
            cadScene.add(mesh);
        } else {
            entry.mesh.position.set(object.x || 0, (object.y || 0) + (object.height || 0) / 2, object.z || 0);
            entry.mesh.rotation.set(
                THREE.MathUtils.degToRad(object.rotationX || 0),
                THREE.MathUtils.degToRad(object.rotationY || 0),
                THREE.MathUtils.degToRad(object.rotationZ || 0)
            );
            entry.mesh.material.color.set(object.color || "#7ea5d0");
        }
        entry.mesh.material.emissive.set(selectedObjectIds.includes(object.id) ? "#315c82" : "#000000");
        entry.mesh.material.emissiveIntensity = selectedObjectIds.includes(object.id) ? 0.12 : 0;
    });
    for (const [id, entry] of cadMeshes) {
        if (!present.has(id)) {
            cadScene.remove(entry.mesh);
            entry.mesh.geometry.dispose();
            entry.mesh.material.dispose();
            cadMeshes.delete(id);
        }
    }
    for (const object of activeProject.objects) {
        const entry = cadMeshes.get(object.id);
        if (entry) {
            entry.mesh.visible = object.visible !== false && object.suppressed !== true;
            const hasSectionPlane = entry.mesh.material.clippingPlanes?.[0] === sectionPlane;
            if (hasSectionPlane !== sectionEnabled) {
                entry.mesh.material.clippingPlanes = sectionEnabled ? [sectionPlane] : null;
                entry.mesh.material.needsUpdate = true;
            }
        }
    }
}

function renderCadFrame() {
    if (!cadRenderer || !cadScene || modelEditor.hidden) return;
    cadRenderer.render(cadScene, cadCamera);
    const viewHeight = cadCamera.isOrthographicCamera
        ? (cadCamera.top - cadCamera.bottom) / cadCamera.zoom
        : 2 * cadCamera.position.distanceTo(cadControls.target) *
            Math.tan(THREE.MathUtils.degToRad(cadCamera.fov / 2));
    document.querySelector("[data-zoom-status]").textContent =
        `ZOOM ${Math.round(310 / viewHeight * 100)}%`;
}

function startCadRenderLoop() {
    if (cadAnimationFrame) return;
    const animate = () => {
        if (modelEditor.hidden) {
            cadAnimationFrame = 0;
            return;
        }
        cadControls.update();
        renderCadFrame();
        cadAnimationFrame = window.requestAnimationFrame(animate);
    };
    cadAnimationFrame = window.requestAnimationFrame(animate);
}

function renderModel() {
    if (!cadRenderer || !cadScene || modelEditor.hidden) return;
    syncPatternInstances();
    syncMirrorInstances();
    syncCadMeshes();
    renderCadFrame();
}

function resizeModelCanvas() {
    if (!modelCanvas || modelEditor.hidden) return;
    initializeCadViewport();
    const bounds = modelCanvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    cadRenderer.setSize(bounds.width, bounds.height, false);
    if (cadCamera.isPerspectiveCamera) {
        cadCamera.aspect = bounds.width / bounds.height;
    } else {
        cadCamera.aspect = bounds.width / bounds.height;
        cadCamera.left = -orthographicViewHeight * cadCamera.aspect / 2;
        cadCamera.right = orthographicViewHeight * cadCamera.aspect / 2;
        cadCamera.top = orthographicViewHeight / 2;
        cadCamera.bottom = -orthographicViewHeight / 2;
    }
    cadCamera.updateProjectionMatrix();
    renderModel();
}

function cadPointerRay(event) {
    const rect = modelCanvas.getBoundingClientRect();
    const normalized = new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    cadRaycaster.setFromCamera(normalized, cadCamera);
}

function hitTestCadObject(event) {
    if (!cadScene) return null;
    cadPointerRay(event);
    const meshes = [...cadMeshes.values()].map((entry) => entry.mesh).filter((mesh) => mesh.visible);
    const hit = cadRaycaster.intersectObjects(meshes, false)[0];
    return hit ? activeProject.objects.find((object) => object.id === hit.object.userData.objectId) || null : null;
}

function getCadSurfaceHit(event) {
    if (!cadScene) return null;
    cadPointerRay(event);
    const meshes = [...cadMeshes.values()].map((entry) => entry.mesh).filter((mesh) => mesh.visible);
    return cadRaycaster.intersectObjects(meshes, false)[0] || null;
}

function recordMeasurementPoint(point) {
    if (measurementPoints.length === 2) {
        if (measurementLine) {
            cadScene.remove(measurementLine);
            measurementLine.geometry.dispose();
            measurementLine.material.dispose();
            measurementLine = null;
        }
        measurementPoints = [];
    }
    measurementPoints.push(point.clone());
    if (measurementPoints.length === 1) {
        document.querySelector("[data-viewport-hint]").textContent =
            "First surface point selected · Choose a second point";
        return;
    }
    const distance = measurementPoints[0].distanceTo(measurementPoints[1]);
    const geometry = new THREE.BufferGeometry().setFromPoints(measurementPoints);
    measurementLine = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x1676b8, depthTest: false, toneMapped: false })
    );
    measurementLine.renderOrder = 10;
    cadScene.add(measurementLine);
    document.querySelector("[data-viewport-hint]").textContent =
        `${distance.toFixed(2)} mm between surface points · Select a point to measure again`;
    renderCadFrame();
}

function intersectCadGround(event) {
    cadPointerRay(event);
    return cadRaycaster.ray.intersectPlane(cadGroundPlane, new THREE.Vector3());
}

function handleModelPointerDown(event) {
    if (!activeProject || event.button !== 0 || activeTool === "orbit") return;
    if (measureMode) {
        const hit = getCadSurfaceHit(event);
        if (hit) recordMeasurementPoint(hit.point);
        event.preventDefault();
        return;
    }
    const object = hitTestCadObject(event);
    if (!object) return;
    selectModelObject(object.id, event.ctrlKey || event.metaKey);
    if (object.instanceOf || object.mirrorOf) return;
    const groundPoint = intersectCadGround(event);
    if (!groundPoint) return;
    const primary = selectedModelObject();
    pointerInteraction = {
        kind: activeTool === "rotate" ? "rotate" : "move",
        objectId: primary.id,
        lastX: event.clientX,
        lastY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        startPoint: groundPoint,
        startPosition: { x: primary.x, y: primary.y, z: primary.z },
        startRotation: { x: primary.rotationX || 0, y: primary.rotationY || 0 },
        startAssembly: (primary.assemblyId
            ? activeProject.objects.filter((item) => item.assemblyId === primary.assemblyId).map((item) => item.id)
            : [primary.id]).map((id) => {
            const member = activeProject.objects.find((item) => item.id === id);
            return {
                id,
                x: member.x,
                y: member.y,
                z: member.z,
                rotationX: member.rotationX || 0,
                rotationY: member.rotationY || 0,
                rotationZ: member.rotationZ || 0
            };
        }),
        moved: false,
        historyRecorded: false
    };
    cadControls.enabled = false;
    modelCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
}

function handleModelPointerMove(event) {
    if (!pointerInteraction || !activeProject) return;
    const current = pointerInteraction;
    const object = activeProject.objects.find((item) => item.id === current.objectId);
    if (!object) return;
    const totalDistance = Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY);
    if (totalDistance > 2) current.moved = true;
    if (!current.moved) return;
    if (!current.historyRecorded) {
        recordProjectChange();
        current.historyRecorded = true;
    }
    if (current.kind === "rotate") {
        const rotationY = Math.round((current.startRotation.y + (event.clientX - current.startX) * 0.7) / 5) * 5;
        const rotationX = Math.round((current.startRotation.x + (event.clientY - current.startY) * 0.35) / 5) * 5;
        const deltaY = THREE.MathUtils.degToRad(rotationY - current.startRotation.y);
        const deltaX = THREE.MathUtils.degToRad(rotationX - current.startRotation.x);
        const pivot = new THREE.Vector3(current.startPosition.x, current.startPosition.y, current.startPosition.z);
        const rotation = new THREE.Euler(deltaX, deltaY, 0, "XYZ");
        for (const start of current.startAssembly) {
            const member = activeProject.objects.find((item) => item.id === start.id);
            if (!member) continue;
            const position = new THREE.Vector3(start.x, start.y, start.z).sub(pivot).applyEuler(rotation).add(pivot);
            member.x = position.x;
            member.y = position.y;
            member.z = position.z;
            member.rotationX = start.rotationX + rotationX - current.startRotation.x;
            member.rotationY = start.rotationY + rotationY - current.startRotation.y;
            member.rotationZ = start.rotationZ;
        }
    } else {
        const groundPoint = intersectCadGround(event);
        if (!groundPoint) return;
        let x = current.startPosition.x + groundPoint.x - current.startPoint.x;
        let z = current.startPosition.z + groundPoint.z - current.startPoint.z;
        if (snapToGrid) {
            x = Math.round(x / 10) * 10;
            z = Math.round(z / 10) * 10;
        }
        const deltaX = Math.max(-110, Math.min(110, x)) - current.startPosition.x;
        const deltaZ = Math.max(-110, Math.min(110, z)) - current.startPosition.z;
        for (const start of current.startAssembly) {
            const member = activeProject.objects.find((item) => item.id === start.id);
            if (!member) continue;
            member.x = Math.max(-110, Math.min(110, start.x + deltaX));
            member.z = Math.max(-110, Math.min(110, start.z + deltaZ));
        }
    }
    document.querySelector("[data-selection-status]").textContent =
        `${object.name}  ·  ${object.width} × ${object.depth} × ${object.height} mm`;
    renderModel();
    scheduleProjectSave();
}

function handleModelPointerUp() {
    if (pointerInteraction?.moved) scheduleProjectSave();
    pointerInteraction = null;
    if (cadControls) cadControls.enabled = true;
    if (activeTool === "orbit") modelCanvas.style.cursor = "grab";
    else modelCanvas.style.cursor = activeTool === "move" ? "move" : "crosshair";
}

function meshGeometryData(geometry) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    return {
        positions: Array.from(position.array),
        indices: index ? Array.from(index.array) : null
    };
}

function openTransformDialog(operation) {
    const selected = selectedObjectIds
        .map((id) => activeProject?.objects.find((object) => object.id === id))
        .filter((object) => object && !isLinkedFeatureObject(object));
    const minimum = operation === "distribute" ? 3 : 2;
    if (selected.length < minimum) return;
    const dialog = document.querySelector("[data-transform-dialog]");
    const form = document.querySelector("[data-transform-form]");
    const isDistribute = operation === "distribute";
    dialog.dataset.operation = operation;
    document.querySelector("#transformTitle").textContent = isDistribute
        ? "Distribute selected bodies"
        : "Align selected bodies";
    document.querySelector("[data-transform-description]").textContent = isDistribute
        ? "Space the selected body centers evenly along an axis, keeping the outermost centers fixed."
        : "Align every selected body to the primary selection’s bounding-box plane.";
    document.querySelector("[data-align-mode-field]").hidden = isDistribute;
    document.querySelector("[data-transform-note]").textContent = isDistribute
        ? "At least three bodies are required. Existing body order is determined by its center on the chosen axis."
        : "Alignment moves bodies without changing their dimensions or rotation. Linked pattern/mirror features are excluded.";
    form.elements.axis.value = "x";
    form.elements.mode.value = "min";
    dialog.showModal();
}

function applyTransformSelection(operation, axis, mode) {
    if (!activeProject) return;
    const selected = selectedObjectIds
        .map((id) => activeProject.objects.find((object) => object.id === id))
        .filter((object) => object && !isLinkedFeatureObject(object));
    const minimum = operation === "distribute" ? 3 : 2;
    if (selected.length < minimum || !["x", "y", "z"].includes(axis)) {
        setSaveStatus(`Select at least ${minimum} unlinked bodies`, true);
        return;
    }

    const boundsByObject = new Map();
    try {
        for (const object of selected) {
            const geometry = transformedExportGeometry(object);
            try {
                geometry.computeBoundingBox();
                const bounds = geometry.boundingBox;
                boundsByObject.set(object.id, {
                    min: bounds.min[axis],
                    center: (bounds.min[axis] + bounds.max[axis]) / 2,
                    max: bounds.max[axis]
                });
            } finally {
                geometry.dispose();
            }
        }
    } catch (error) {
        console.error("Unable to calculate selected-body bounds.", error);
        setSaveStatus(`Could not calculate body bounds: ${error.message}`, true);
        return;
    }

    const positions = new Map();
    if (operation === "align") {
        const anchor = boundsByObject.get(selectedObjectId);
        if (!anchor || !["min", "center", "max"].includes(mode)) {
            setSaveStatus("Choose a valid alignment target", true);
            return;
        }
        for (const object of selected) {
            const bounds = boundsByObject.get(object.id);
            const delta = anchor[mode] - bounds[mode];
            positions.set(object.id, object[axis] + delta);
        }
    } else if (operation === "distribute") {
        const ordered = [...selected].sort((first, second) =>
            boundsByObject.get(first.id).center - boundsByObject.get(second.id).center
        );
        const firstCenter = boundsByObject.get(ordered[0].id).center;
        const lastCenter = boundsByObject.get(ordered[ordered.length - 1].id).center;
        const interval = (lastCenter - firstCenter) / (ordered.length - 1);
        ordered.forEach((object, index) => {
            const bounds = boundsByObject.get(object.id);
            const targetCenter = firstCenter + interval * index;
            positions.set(object.id, object[axis] + targetCenter - bounds.center);
        });
    } else {
        setSaveStatus("Choose align or distribute", true);
        return;
    }

    if ([...positions.values()].some((position) => !Number.isFinite(position))) {
        setSaveStatus("The transform would create an invalid body position", true);
        return;
    }
    recordProjectChange();
    for (const object of selected) object[axis] = positions.get(object.id);
    updateSceneInterface();
    scheduleProjectSave();
}

function applyBooleanOperation(operation) {
    if (!activeProject || selectedObjectIds.length !== 2) return;
    const [targetId, toolId] = selectedObjectIds;
    const target = activeProject.objects.find((object) => object.id === targetId);
    const tool = activeProject.objects.find((object) => object.id === toolId);
    if (!target || !tool) return;
    if (isLinkedFeatureObject(target) || isLinkedFeatureObject(tool)) {
        setSaveStatus("Remove linked features before using a Boolean operation", true);
        return;
    }

    const operationMap = { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION };
    const csgOperation = operationMap[operation];
    if (csgOperation === undefined) return;

    try {
        const targetMesh = createCadMesh(target);
        const toolMesh = createCadMesh(tool);
        targetMesh.updateMatrixWorld(true);
        toolMesh.updateMatrixWorld(true);
        const targetBrush = new Brush(targetMesh.geometry, targetMesh.material);
        const toolBrush = new Brush(toolMesh.geometry, toolMesh.material);
        targetBrush.position.copy(targetMesh.position);
        targetBrush.rotation.copy(targetMesh.rotation);
        targetBrush.scale.copy(targetMesh.scale);
        toolBrush.position.copy(toolMesh.position);
        toolBrush.rotation.copy(toolMesh.rotation);
        toolBrush.scale.copy(toolMesh.scale);
        targetBrush.updateMatrixWorld(true);
        toolBrush.updateMatrixWorld(true);
        const evaluator = new Evaluator();
        evaluator.useGroups = false;
        const result = evaluator.evaluate(targetBrush, toolBrush, csgOperation);
        result.updateMatrixWorld(true);
        const worldGeometry = result.geometry.clone().applyMatrix4(result.matrixWorld);
        worldGeometry.computeBoundingBox();
        const bounds = worldGeometry.boundingBox;
        const size = bounds.getSize(new THREE.Vector3());
        if (!size.x || !size.y || !size.z) throw new Error("The result has no printable volume.");
        const worldCenter = bounds.getCenter(new THREE.Vector3());
        worldGeometry.translate(-worldCenter.x, -worldCenter.y, -worldCenter.z);

        recordProjectChange();
        target.type = "mesh";
        target.meshData = meshGeometryData(worldGeometry);
        target.meshData.size = { width: size.x, height: size.y, depth: size.z };
        target.width = Math.round(size.x * 100) / 100;
        target.height = Math.round(size.y * 100) / 100;
        target.depth = Math.round(size.z * 100) / 100;
        target.x = worldCenter.x;
        target.y = worldCenter.y - size.y / 2;
        target.z = worldCenter.z;
        target.rotationX = 0;
        target.rotationY = 0;
        target.rotationZ = 0;
        target.name = `${target.name} · ${operation}`;
        activeProject.objects = activeProject.objects.filter((object) => object.id !== toolId);
        selectedObjectId = targetId;
        selectedObjectIds = [targetId];
        worldGeometry.dispose();
        result.geometry.dispose();
        targetMesh.geometry.dispose();
        toolMesh.geometry.dispose();
        targetMesh.material.dispose();
        toolMesh.material.dispose();
        updateSceneInterface();
        scheduleProjectSave();
    } catch (error) {
        console.error("CAD Boolean operation failed.", error);
        setSaveStatus(`Boolean operation failed: ${error.message}`, true);
    }
}

function downloadProjectJson() {
    if (!activeProject) return;
    const saved = persistProject(true);
    downloadCadFile(`${activeProject.name}.smartdesk.json`, JSON.stringify(activeProject, null, 2), "application/json");
    setSaveStatus(saved ? "Project JSON exported" : "Project JSON exported; local save failed", !saved);
}

function importProjectFile(file) {
    if (file.size > 20 * 1024 * 1024) {
        setSaveStatus("Project files must be smaller than 20 MB", true);
        return;
    }
    const reader = new FileReader();
    reader.addEventListener("error", () => setSaveStatus("Could not read that project file", true));
    reader.addEventListener("load", () => {
        try {
            const parsed = JSON.parse(String(reader.result));
            if (parsed.schema !== 1 || typeof parsed.name !== "string" || !parsed.name.trim() ||
                parsed.name.length > 80 || !Array.isArray(parsed.objects) || parsed.objects.length > 500) {
                throw new Error("This isn't a Smart Desk 3D project file.");
            }
            const importedObjectIds = new Set();
            parsed.objects.forEach((object) => {
                if (typeof object.id !== "string" || !object.id || importedObjectIds.has(object.id) ||
                    !["box", "cylinder", "sphere", "cone", "torus", "capsule", "pyramid", "wedge", "extrude", "revolve", "mesh"].includes(object.type) ||
                    !["x", "y", "z", "width", "depth", "height", "rotationX", "rotationY", "rotationZ"].every((key) => Number.isFinite(object[key])) ||
                    !/^#[0-9a-f]{6}$/i.test(object.color) || typeof object.name !== "string" ||
                    (object.visible !== undefined && typeof object.visible !== "boolean") ||
                    (object.suppressed !== undefined && typeof object.suppressed !== "boolean") ||
                    (object.assemblyId !== undefined && (typeof object.assemblyId !== "string" || !object.assemblyId))) {
                    throw new Error("The project contains an invalid object.");
                }
                importedObjectIds.add(object.id);
                const maximumDimension = object.type === "mesh" ? 440 : 220;
                if (object.width <= 0 || object.height <= 0 || (object.type !== "revolve" && object.depth <= 0) ||
                    object.width > maximumDimension || object.depth > maximumDimension || object.height > maximumDimension) {
                    throw new Error(`Object dimensions must be between 1 and ${maximumDimension} mm.`);
                }
                if (object.profile && (
                    !["rectangle", "circle", "slot", "hexagon", "star"].includes(object.profile.kind) ||
                    !["extrude", "revolve"].includes(object.profile.operation) ||
                    !Number.isFinite(object.profile.bevel) ||
                    object.profile.bevel < 0 || object.profile.bevel > 5 ||
                    (object.profile.equalAxes !== undefined && typeof object.profile.equalAxes !== "boolean") ||
                    (object.type === "extrude" && object.profile.operation !== "extrude") ||
                    (object.type === "revolve" && object.profile.operation !== "revolve") ||
                    (object.profile.edgeStyle !== undefined &&
                        !["fillet", "chamfer"].includes(object.profile.edgeStyle))
                )) throw new Error("The project contains an invalid sketch feature.");
                if (object.patternConfig && (
                    !["x", "y", "z"].includes(object.patternConfig.axis) ||
                    !Number.isInteger(object.patternConfig.count) ||
                    object.patternConfig.count < 2 || object.patternConfig.count > 50 ||
                    !Number.isFinite(object.patternConfig.spacing) ||
                    object.patternConfig.spacing < 0.1 || object.patternConfig.spacing > 220 ||
                    typeof object.patternConfig.name !== "string" ||
                    object.type === "mesh" || object.instanceOf || object.mirrorOf
                )) throw new Error("The project contains an invalid linear pattern.");
                if (object.mirrorConfig && (
                    !["x", "y", "z"].includes(object.mirrorConfig.axis) ||
                    !Number.isFinite(object.mirrorConfig.offset) ||
                    object.mirrorConfig.offset < -220 || object.mirrorConfig.offset > 220 ||
                    typeof object.mirrorConfig.name !== "string" ||
                    object.instanceOf || object.mirrorOf
                )) throw new Error("The project contains an invalid mirror feature.");
                if (object.instanceOf && (
                    typeof object.instanceOf !== "string" ||
                    !Number.isInteger(object.instanceIndex) ||
                    object.instanceIndex < 1 || object.instanceIndex > 49 ||
                    object.type === "mesh" || object.patternConfig
                )) throw new Error("The project contains an invalid pattern instance.");
                if (object.type === "mesh" && (
                    !Array.isArray(object.meshData?.positions) ||
                    object.meshData.positions.length === 0 ||
                    object.meshData.positions.length % 3 !== 0 ||
                    (!object.meshData.indices && object.meshData.positions.length % 9 !== 0) ||
                    object.meshData.positions.length > 1500000 ||
                    !object.meshData.positions.every(Number.isFinite) ||
                    !["width", "height", "depth"].every((dimension) =>
                        Number.isFinite(object.meshData?.size?.[dimension]) && object.meshData.size[dimension] > 0
                    ) ||
                    (object.meshData.indices && (!Array.isArray(object.meshData.indices) ||
                        object.meshData.indices.length === 0 || object.meshData.indices.length % 3 !== 0 ||
                        object.meshData.indices.length > 4500000 ||
                        object.meshData.indices.some((index) => !Number.isInteger(index) || index < 0 || index >= object.meshData.positions.length / 3)))
                )) throw new Error("The project contains invalid Boolean mesh data.");
                if (object.mirrorOf && (
                    typeof object.mirrorOf !== "string" ||
                    object.type !== "mesh" ||
                    typeof object.mirrorSourceSignature !== "string" ||
                    object.mirrorConfig || object.instanceOf
                )) throw new Error("The project contains an invalid mirrored body.");
            });
            const objectsById = new Map(parsed.objects.map((object) => [object.id, object]));
            const assemblyMembers = new Map();
            const patternIndices = new Set();
            const mirroredSources = new Set();
            const patternInstanceCounts = new Map();
            parsed.objects.forEach((object) => {
                if (object.assemblyId) {
                    assemblyMembers.set(object.assemblyId, (assemblyMembers.get(object.assemblyId) || 0) + 1);
                    if (isLinkedFeatureObject(object)) throw new Error("Linked feature bodies cannot be assembly members.");
                }
                if (object.instanceOf) {
                    const source = objectsById.get(object.instanceOf);
                    const patternIndex = `${object.instanceOf}:${object.instanceIndex}`;
                    if (!source?.patternConfig || object.type !== source.type ||
                        object.instanceIndex >= source.patternConfig.count || patternIndices.has(patternIndex)) {
                        throw new Error("The project contains an unlinked pattern instance.");
                    }
                    patternIndices.add(patternIndex);
                    patternInstanceCounts.set(object.instanceOf, (patternInstanceCounts.get(object.instanceOf) || 0) + 1);
                }
                if (object.mirrorOf) {
                    const source = objectsById.get(object.mirrorOf);
                    if (!source?.mirrorConfig || source.id === object.id || mirroredSources.has(source.id)) {
                        throw new Error("The project contains an unlinked mirrored body.");
                    }
                    mirroredSources.add(source.id);
                }
            });
            if ([...assemblyMembers.values()].some((count) => count < 2)) {
                throw new Error("Each saved assembly must contain at least two bodies.");
            }
            const generatedObjectCount = parsed.objects.length + parsed.objects.reduce((missing, object) => {
                if (object.patternConfig) {
                    return missing + Math.max(
                        0,
                        object.patternConfig.count - 1 - (patternInstanceCounts.get(object.id) || 0)
                    );
                }
                if (object.mirrorConfig && !mirroredSources.has(object.id)) return missing + 1;
                return missing;
            }, 0);
            if (generatedObjectCount > 500) {
                throw new Error("The project’s linked features exceed the 500-body limit.");
            }
            parsed.id = `design-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            parsed.updatedAt = new Date().toISOString();
            openModelEditor(parsed);
            setSaveStatus("Project imported and saved on this device");
        } catch (error) {
            console.warn("Unable to import the selected design.", error);
            window.alert(error.message || "That file could not be opened as a Smart Desk project.");
        }
    });
    reader.readAsText(file);
}

function transformedExportGeometry(object) {
    const mesh = createCadMesh(object);
    try {
        mesh.updateMatrixWorld(true);
        return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    } finally {
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
}

async function importModelFile(file) {
    if (!activeProject) return;
    if (file.size > 20 * 1024 * 1024) {
        setSaveStatus("Model files must be smaller than 20 MB", true);
        return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "stl" && extension !== "obj") {
        setSaveStatus("Choose an STL or OBJ model file", true);
        return;
    }
    if (activeProject.objects.length >= 500) {
        setSaveStatus("This project has reached the 500-body limit", true);
        return;
    }

    let geometry;
    try {
        if (extension === "stl") {
            geometry = new STLLoader().parse(await file.arrayBuffer());
        } else {
            const root = new OBJLoader().parse(await file.text());
            root.updateMatrixWorld(true);
            const positions = [];
            const indices = [];
            root.traverse((child) => {
                if (!child.isMesh || !child.geometry.getAttribute("position")) return;
                const source = child.geometry.clone();
                source.applyMatrix4(child.matrixWorld);
                const attribute = source.getAttribute("position");
                const offset = positions.length / 3;
                for (let vertex = 0; vertex < attribute.count; vertex += 1) {
                    positions.push(attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex));
                }
                const sourceIndex = source.getIndex();
                if (sourceIndex) {
                    for (const index of sourceIndex.array) indices.push(offset + index);
                } else {
                    for (let index = 0; index < attribute.count; index += 1) indices.push(offset + index);
                }
                source.dispose();
            });
            if (!positions.length) throw new Error("The OBJ file contains no triangle meshes.");
            geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            geometry.setIndex(indices);
        }

        if (!geometry.getAttribute("position")) throw new Error("The model has no vertex positions.");
        if (!geometry.getIndex()) {
            const unmergedGeometry = geometry;
            geometry = mergeVertices(unmergedGeometry);
            unmergedGeometry.dispose();
        }
        const triangleCount = (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
        if (!Number.isInteger(triangleCount) || triangleCount < 1 || triangleCount > 500_000) {
            throw new Error("Models must contain between 1 and 500,000 triangles.");
        }
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(Number.isFinite) ||
            Math.max(size.x, size.y, size.z) > 440 ||
            Math.max(size.x, size.y, size.z) <= 0) {
            throw new Error("Model dimensions must be finite and no larger than 440 mm.");
        }
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.computeVertexNormals();
        const meshData = meshGeometryData(geometry);
        meshData.size = {
            width: Math.max(size.x, 0.1),
            height: Math.max(size.y, 0.1),
            depth: Math.max(size.z, 0.1)
        };

        recordProjectChange();
        const index = activeProject.objects.length;
        const object = {
            id: `mesh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name.replace(/\.(stl|obj)$/i, "").slice(0, 48) || `Imported mesh ${index + 1}`,
            type: "mesh",
            x: Math.round(((index % 4) - 1.5) * 28),
            y: 0,
            z: Math.floor(index / 4) * 28,
            width: meshData.size.width,
            height: meshData.size.height,
            depth: meshData.size.depth,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            color: "#7ea5d0",
            meshData
        };
        activeProject.objects.push(object);
        selectedObjectId = object.id;
        selectedObjectIds = [object.id];
        updateSceneInterface();
        scheduleProjectSave();
        setSaveStatus(`${extension.toUpperCase()} model imported`);
    } catch (error) {
        console.error("Unable to import the selected 3D model.", error);
        setSaveStatus(`Model import failed: ${error.message}`, true);
    } finally {
        geometry?.dispose();
    }
}

function addImportedMeshRecords(records, fallbackName) {
    if (!activeProject || !records.length) throw new Error("The file contains no supported mesh bodies.");
    if (activeProject.objects.length + records.length > 500) {
        throw new Error("Importing these bodies would exceed the 500-body project limit.");
    }
    const prepared = [];
    let totalTriangles = 0;
    const overallBounds = new THREE.Box3();
    try {
        for (const record of records) {
            if (!Array.isArray(record.positions) || !record.positions.length || record.positions.length % 3 ||
                record.positions.length > 1_500_000 || !record.positions.every(Number.isFinite)) {
                throw new Error("An imported mesh contains invalid or oversized vertex data.");
            }
            const vertexCount = record.positions.length / 3;
            const indices = record.indices || Array.from({ length: vertexCount }, (_, index) => index);
            if (!indices.length || indices.length % 3 || indices.length > 1_500_000 ||
                indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertexCount)) {
                throw new Error("An imported mesh contains invalid triangle indices.");
            }
            totalTriangles += indices.length / 3;
            if (totalTriangles > 500_000) throw new Error("Import is limited to 500,000 triangles.");
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(record.positions, 3));
            geometry.setIndex(indices);
            geometry.computeBoundingBox();
            const bounds = geometry.boundingBox;
            const size = bounds.getSize(new THREE.Vector3());
            if (![size.x, size.y, size.z].every(Number.isFinite) ||
                Math.max(size.x, size.y, size.z) > 440 || Math.max(size.x, size.y, size.z) <= 0) {
                geometry.dispose();
                throw new Error("Imported mesh dimensions must be finite and no larger than 440 mm.");
            }
            overallBounds.union(bounds);
            prepared.push({ record, geometry, size, center: bounds.getCenter(new THREE.Vector3()) });
        }
        const center = overallBounds.getCenter(new THREE.Vector3());
        const floor = overallBounds.min.y;
        const placementIndex = activeProject.objects.length;
        const placementX = Math.round(((placementIndex % 4) - 1.5) * 28);
        const placementZ = Math.floor(placementIndex / 4) * 28;
        recordProjectChange();
        const ids = [];
        for (const [index, item] of prepared.entries()) {
            item.geometry.translate(-item.center.x, -item.center.y, -item.center.z);
            item.geometry.computeVertexNormals();
            const meshData = meshGeometryData(item.geometry);
            meshData.size = {
                width: Math.max(item.size.x, 0.1),
                height: Math.max(item.size.y, 0.1),
                depth: Math.max(item.size.z, 0.1)
            };
            const object = {
                id: `mesh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`,
                name: String(item.record.name || `${fallbackName} ${index + 1}`).slice(0, 48),
                type: "mesh",
                x: item.center.x - center.x + placementX,
                y: item.center.y - item.size.y / 2 - floor,
                z: item.center.z - center.z + placementZ,
                width: meshData.size.width,
                height: meshData.size.height,
                depth: meshData.size.depth,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                color: "#7ea5d0",
                meshData
            };
            activeProject.objects.push(object);
            ids.push(object.id);
            item.geometry.dispose();
        }
        selectedObjectId = ids[0];
        selectedObjectIds = [ids[0]];
        updateSceneInterface();
        scheduleProjectSave();
        setSaveStatus(`${ids.length} mesh bod${ids.length === 1 ? "y" : "ies"} imported`);
    } catch (error) {
        prepared.forEach(({ geometry }) => geometry.dispose());
        throw error;
    }
}

function exportModelStl() {
    if (!activeProject) return;
    const exportObjects = visibleProjectObjects();
    if (!exportObjects.length) {
        setSaveStatus("Show at least one body before exporting", true);
        return;
    }
    const geometries = [];
    try {
        exportObjects.forEach((object) => geometries.push(transformedExportGeometry(object)));
        const triangleCount = geometries.reduce((total, geometry) => {
            const count = geometry.getIndex()?.count ?? geometry.getAttribute("position").count;
            if (count % 3 !== 0) throw new Error("An exported body has incomplete triangle data.");
            return total + count / 3;
        }, 0);
        if (!Number.isSafeInteger(triangleCount) || triangleCount > 0xffffffff) {
            throw new Error("The design is too large for a binary STL export.");
        }
        const buffer = new ArrayBuffer(84 + triangleCount * 50);
        const bytes = new Uint8Array(buffer);
        const header = new TextEncoder().encode(
            `Smart Desk CAD - ${activeProject.name.replace(/[^\x20-\x7e]/gi, "_")}`.slice(0, 80)
        );
        bytes.set(header, 0);
        const data = new DataView(buffer);
        data.setUint32(80, triangleCount, true);
        let offset = 84;
        for (const geometry of geometries) {
            const indexed = geometry.getIndex();
            const positions = geometry.getAttribute("position");
            const count = indexed?.count ?? positions.count;
            for (let index = 0; index < count; index += 3) {
                const indices = indexed
                    ? [indexed.getX(index), indexed.getX(index + 1), indexed.getX(index + 2)]
                    : [index, index + 1, index + 2];
                const a = new THREE.Vector3().fromBufferAttribute(positions, indices[0]);
                const b = new THREE.Vector3().fromBufferAttribute(positions, indices[1]);
                const c = new THREE.Vector3().fromBufferAttribute(positions, indices[2]);
                const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
                for (const component of [normal.x, normal.y, normal.z]) {
                    data.setFloat32(offset, component, true);
                    offset += 4;
                }
                for (const vertex of [a, b, c]) {
                    for (const component of [vertex.x, vertex.y, vertex.z]) {
                        data.setFloat32(offset, component, true);
                        offset += 4;
                    }
                }
                data.setUint16(offset, 0, true);
                offset += 2;
            }
        }
        downloadCadFile(`${activeProject.name}.stl`, buffer, "model/stl");
        setSaveStatus(`STL exported in millimetres · ${triangleCount.toLocaleString()} triangles`);
    } catch (error) {
        console.error("Unable to export the CAD model as STL.", error);
        setSaveStatus(`STL export failed: ${error.message}`, true);
    } finally {
        geometries.forEach((geometry) => geometry.dispose());
    }
}

function exportModelObj() {
    const exportObjects = visibleProjectObjects();
    if (!activeProject || !exportObjects.length) {
        setSaveStatus("Show at least one body before exporting", true);
        return;
    }
    const lines = [`# ${activeProject.name}`, "# Smart Desk parametric CAD · units: mm"];
    let vertexOffset = 1;
    const geometries = [];
    try {
        exportObjects.forEach((object) => {
            const geometry = transformedExportGeometry(object);
            geometries.push(geometry);
            const position = geometry.getAttribute("position");
            const index = geometry.getIndex();
            lines.push(`o ${object.name.replace(/[^a-z0-9_-]/gi, "_") || "Body"}`);
            for (let vertex = 0; vertex < position.count; vertex += 1) {
                lines.push(`v ${position.getX(vertex).toFixed(6)} ${position.getY(vertex).toFixed(6)} ${position.getZ(vertex).toFixed(6)}`);
            }
            const indices = index ? index.array : Array.from({ length: position.count }, (_, i) => i);
            for (let face = 0; face + 2 < indices.length; face += 3) {
                lines.push(`f ${indices[face] + vertexOffset} ${indices[face + 1] + vertexOffset} ${indices[face + 2] + vertexOffset}`);
            }
            vertexOffset += position.count;
        });
        downloadCadFile(`${activeProject.name}.obj`, lines.join("\n"), "text/plain");
        setSaveStatus("OBJ exported in millimetres");
    } catch (error) {
        console.error("Unable to export the CAD model as OBJ.", error);
        setSaveStatus(`OBJ export failed: ${error.message}`, true);
    } finally {
        geometries.forEach((geometry) => geometry.dispose());
    }
}

function visibleMeshRecordsForExchange(maximumTriangles) {
    const objects = visibleProjectObjects();
    if (!objects.length) throw new Error("Show at least one body before exporting.");
    const geometries = [];
    let triangleCount = 0;
    try {
        const meshes = objects.map((object) => {
            const geometry = transformedExportGeometry(object);
            geometries.push(geometry);
            const count = (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
            triangleCount += count;
            if (!Number.isInteger(count) || triangleCount > maximumTriangles) {
                throw new Error(`Export is limited to ${maximumTriangles.toLocaleString()} triangles.`);
            }
            return { name: object.name, ...meshGeometryData(geometry) };
        });
        return { meshes, geometries };
    } catch (error) {
        geometries.forEach((geometry) => geometry.dispose());
        throw error;
    }
}

function exportModel3mf() {
    if (!activeProject) return;
    let result;
    try {
        result = visibleMeshRecordsForExchange(500_000);
        const archive = export3mf(activeProject.name, result.meshes);
        downloadCadFile(`${activeProject.name}.3mf`, archive, "model/3mf");
        setSaveStatus(`3MF exported in millimetres · ${result.meshes.length} bodies`);
    } catch (error) {
        console.error("Unable to export the CAD model as 3MF.", error);
        setSaveStatus(`3MF export failed: ${error.message}`, true);
    } finally {
        result?.geometries.forEach((geometry) => geometry.dispose());
    }
}

function exportModelStep() {
    if (!activeProject) return;
    let result;
    try {
        result = visibleMeshRecordsForExchange(300_000);
        const step = exportFacetedStep(activeProject.name, result.meshes);
        downloadCadFile(`${activeProject.name}.step`, step, "model/step");
        setSaveStatus(`Faceted STEP exported · ${result.meshes.length} bodies. This is tessellated, not native B-rep geometry.`);
    } catch (error) {
        console.error("Unable to export the CAD model as faceted STEP.", error);
        setSaveStatus(`STEP export failed: ${error.message}`, true);
    } finally {
        result?.geometries.forEach((geometry) => geometry.dispose());
    }
}

function runMeshPreflight() {
    const dialog = document.querySelector("[data-mesh-check-dialog]");
    const summary = document.querySelector("[data-mesh-check-summary]");
    const tableBody = document.querySelector("[data-mesh-check-results]");
    const resultStatus = document.querySelector("[data-mesh-check-status]");
    tableBody.replaceChildren();

    const checkObjects = visibleProjectObjects();
    if (!activeProject || !checkObjects.length) {
        summary.textContent = "Show at least one body before running a mesh check.";
        resultStatus.textContent = "NO BODIES";
        resultStatus.className = "mesh-check-status warning";
        dialog.showModal();
        return;
    }

    const maximumTriangles = 1_000_000;
    const results = [];
    let totalTriangles = 0;
    try {
        syncPatternInstances();
        syncMirrorInstances();
        for (const object of checkObjects) {
            const geometry = transformedExportGeometry(object);
            try {
                const position = geometry.getAttribute("position");
                if (!position) throw new Error(`"${object.name}" has no vertex positions.`);
                const index = geometry.getIndex();
                const triangleCount = (index?.count ?? position.count) / 3;
                if (!Number.isInteger(triangleCount)) {
                    throw new Error(`"${object.name}" has incomplete triangle data.`);
                }
                totalTriangles += triangleCount;
                if (totalTriangles > maximumTriangles) {
                    throw new Error("Mesh check is limited to 1,000,000 triangles per project to keep the editor responsive.");
                }
                const analysis = analyzeTriangleMesh(position.array, index?.array || null);
                results.push({ object, analysis });
            } finally {
                geometry.dispose();
            }
        }
    } catch (error) {
        console.error("CAD mesh preflight failed.", error);
        summary.textContent = error.message || "The design could not be analyzed.";
        resultStatus.textContent = "CHECK FAILED";
        resultStatus.className = "mesh-check-status warning";
        dialog.showModal();
        return;
    }

    const failedBodies = results.filter(({ analysis }) =>
        !analysis.watertight || analysis.inconsistentWindingEdges > 0 || analysis.degenerateTriangles > 0
    ).length;
    const multiShellBodies = results.filter(({ analysis }) => analysis.connectedComponents > 1).length;
    resultStatus.textContent = failedBodies ? `${failedBodies} NEED ATTENTION` : "CHECK PASSED";
    resultStatus.className = `mesh-check-status ${failedBodies ? "warning" : "passed"}`;
    summary.textContent = failedBodies
        ? `${failedBodies} of ${results.length} bodies have mesh integrity issues. STL stores triangles only; it does not repair invalid geometry.`
        : multiShellBodies
            ? `All ${results.length} bodies are closed and consistently oriented. ${multiShellBodies} contain multiple disconnected shells; verify they are intentional before printing.`
            : `All ${results.length} bodies are closed, consistently oriented, and free of degenerate faces. This check does not replace a slicer or guarantee printability.`;

    for (const { object, analysis } of results) {
        const row = document.createElement("tr");
        const nameCell = document.createElement("th");
        nameCell.scope = "row";
        nameCell.textContent = object.name;
        const trianglesCell = document.createElement("td");
        trianglesCell.textContent = analysis.triangleCount.toLocaleString();
        const shellsCell = document.createElement("td");
        shellsCell.textContent = String(analysis.connectedComponents);
        const issuesCell = document.createElement("td");
        const issues = [];
        if (analysis.boundaryEdges) issues.push(`${analysis.boundaryEdges} open`);
        if (analysis.nonManifoldEdges) issues.push(`${analysis.nonManifoldEdges} non-manifold`);
        if (analysis.inconsistentWindingEdges) issues.push(`${analysis.inconsistentWindingEdges} winding`);
        if (analysis.degenerateTriangles) issues.push(`${analysis.degenerateTriangles} degenerate`);
        if (!issues.length && analysis.connectedComponents > 1) issues.push("multiple shells");
        issuesCell.textContent = issues.join(", ") || "None";
        row.append(nameCell, trianglesCell, shellsCell, issuesCell);
        tableBody.append(row);
    }
    dialog.showModal();
}

function runCadSlicer(formData) {
    const sliceObjects = visibleProjectObjects();
    if (!activeProject || !sliceObjects.length) throw new Error("Show at least one body before slicing.");
    syncPatternInstances();
    syncMirrorInstances();
    const geometries = [];
    try {
        const meshes = sliceObjects.map((object) => {
            const geometry = transformedExportGeometry(object);
            geometries.push(geometry);
            const positions = geometry.getAttribute("position");
            if (!positions) throw new Error(`"${object.name}" has no triangle positions.`);
            return {
                name: object.name,
                positions: positions.array,
                indices: geometry.getIndex()?.array || null
            };
        });
        const settings = Object.fromEntries(formData.entries());
        const sliced = sliceMeshes(meshes, settings, activeProject.name);
        downloadCadFile(`${activeProject.name}.gcode`, sliced.gcode, "text/x-gcode");
        return sliced;
    } finally {
        geometries.forEach((geometry) => geometry.dispose());
    }
}

function downloadCadFile(fileName, contents, mimeType) {
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function escapePcbMarkup(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function normalizePcbProject(project) {
    const valid = project &&
        typeof project.name === "string" &&
        pcbThemes.includes(project.theme) &&
        Number.isFinite(project.width) && project.width >= 30 && project.width <= 200 &&
        Number.isFinite(project.height) && project.height >= 25 && project.height <= 160 &&
        Number.isFinite(project.thickness) && project.thickness >= 0.8 && project.thickness <= 3.2 &&
        (project.viewMode === undefined || pcbViewModes.includes(project.viewMode)) &&
        (project.camera === undefined || (
            Number.isFinite(project.camera.yaw) &&
            Number.isFinite(project.camera.pitch) &&
            Number.isFinite(project.camera.zoom) &&
            project.camera.zoom >= 0.6 && project.camera.zoom <= 2
        )) &&
        Array.isArray(project.components) &&
        project.components.length <= 100 &&
        project.components.every((part) =>
            part &&
            typeof part.id === "string" &&
            /^[\w-]{1,40}$/.test(part.id) &&
            Boolean(getPcbPartDefinition(part.type)) &&
            typeof part.reference === "string" &&
            /^[A-Z0-9-]{1,8}$/.test(part.reference) &&
            Number.isFinite(part.x) &&
            Number.isFinite(part.y) &&
            Number.isFinite(part.rotation)
        );
    if (!valid) throw new Error("The PCB project has invalid or unsupported data.");
    project.schemaVersion = 1;
    project.id ||= `pcb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    project.createdAt ||= new Date().toISOString();
    project.updatedAt ||= project.createdAt;
    project.viewMode ||= "3d";
    project.camera ||= { yaw: -28, pitch: 53, zoom: 1 };
    if (!project.schematic || typeof project.schematic !== "object") {
        project.schematic = createPcbSchematic();
    } else {
        project.schematic.sheets = Array.isArray(project.schematic.sheets)
            ? project.schematic.sheets.map(normalizePcbSchematicSheet)
            : [createPcbSchematicSheet("Sheet 1")];
        if (!project.schematic.sheets.length) project.schematic.sheets.push(createPcbSchematicSheet("Sheet 1"));
        if (!project.schematic.sheets.some((sheet) => sheet.id === project.schematic.activeSheetId)) {
            project.schematic.activeSheetId = project.schematic.sheets[0].id;
        }
        project.schematic.view = {
            zoom: Math.min(2.5, Math.max(0.35, Number(project.schematic.view?.zoom) || 1)),
            panX: Number.isFinite(project.schematic.view?.panX) ? project.schematic.view.panX : 0,
            panY: Number.isFinite(project.schematic.view?.panY) ? project.schematic.view.panY : 0
        };
        project.schematic.nextComponentId = Math.max(1, Number(project.schematic.nextComponentId) || 1);
        project.schematic.nextWireId = Math.max(1, Number(project.schematic.nextWireId) || 1);
        project.schematic.nextLabelId = Math.max(1, Number(project.schematic.nextLabelId) || 1);
    }
    project.layout = normalizePcbLayout(project.layout, project.width, project.height);
    const manufacturing = project.manufacturing && typeof project.manufacturing === "object"
        ? project.manufacturing
        : {};
    const manufacturingDefaults = {
        throughHoleDrillMm: 0.8,
        viaDrillMm: 0.3,
        throughHolePadDiameterMm: 1.8,
        smdPadWidthMm: 1.6,
        smdPadHeightMm: 0.9,
        outputs: {
            gerber: true, drill: true, bom: true, pickPlace: true, netlist: true, project: true, documentation: true
        }
    };
    const supportedManufacturingLayers = project.layout.layers.filter((layer) =>
        layer.type === "copper" || layer.type === "outline").map((layer) => layer.id);
    project.manufacturing = {
        ...manufacturingDefaults,
        ...manufacturing,
        selectedLayers: Array.isArray(manufacturing.selectedLayers)
            ? [...new Set(manufacturing.selectedLayers.filter((id) => supportedManufacturingLayers.includes(id)))]
            : supportedManufacturingLayers,
        throughHoleDrillMm: Math.min(10, Math.max(0.1, Number(manufacturing.throughHoleDrillMm) || manufacturingDefaults.throughHoleDrillMm)),
        viaDrillMm: Math.min(10, Math.max(0.1, Number(manufacturing.viaDrillMm) || manufacturingDefaults.viaDrillMm)),
        throughHolePadDiameterMm: Math.min(10, Math.max(0.1, Number(manufacturing.throughHolePadDiameterMm) || manufacturingDefaults.throughHolePadDiameterMm)),
        smdPadWidthMm: Math.min(10, Math.max(0.1, Number(manufacturing.smdPadWidthMm) || manufacturingDefaults.smdPadWidthMm)),
        smdPadHeightMm: Math.min(10, Math.max(0.1, Number(manufacturing.smdPadHeightMm) || manufacturingDefaults.smdPadHeightMm)),
        outputs: Object.fromEntries(Object.keys(manufacturingDefaults.outputs).map((key) => [
            key, typeof manufacturing.outputs?.[key] === "boolean"
                ? manufacturing.outputs[key]
                : manufacturingDefaults.outputs[key]
        ])),
        history: Array.isArray(manufacturing.history)
            ? manufacturing.history.slice(-20).filter((entry) => entry && typeof entry.createdAt === "string")
                .map((entry) => ({
                    createdAt: entry.createdAt.slice(0, 40),
                    action: String(entry.action || "Export prepared").slice(0, 48),
                    files: Array.isArray(entry.files) ? entry.files.filter((name) => typeof name === "string").slice(0, 40) : [],
                    warningCount: Math.max(0, Math.min(1000, Number(entry.warningCount) || 0))
                }))
            : []
    };
    project.robotics = normalizePcbRobotics(project.robotics);
    return project;
}

function getPcbRoboticsTemplate(templateId) {
    return pcbRoboticsTemplates.find((template) => template.id === templateId) || pcbRoboticsTemplates[0];
}

function createPcbRoboticsPlan(templateId = "custom") {
    const template = getPcbRoboticsTemplate(templateId);
    return {
        schemaVersion: 1,
        templateId: template.id,
        source: "manual",
        sourceRobot: null,
        controllerType: template.controller,
        requiredParts: [...template.parts],
        functions: template.functions.map((item) => ({
            id: item.id,
            name: item.name,
            group: item.group,
            preferredPins: [...(item.preferredPins || [])],
            requiresPin: item.requiresPin !== false
        })),
        assignments: {},
        rails: template.rails.map((rail) => ({ ...rail })),
        simulatorBridge: { schema: "aqua.robotics-electronics", version: 1, transferState: "ready-for-export" }
    };
}

function normalizePcbRobotics(robotics) {
    const base = createPcbRoboticsPlan(
        typeof robotics?.templateId === "string" ? robotics.templateId : "custom"
    );
    if (!robotics || typeof robotics !== "object") return base;
    const functions = Array.isArray(robotics.functions) ? robotics.functions.slice(0, 100).map((item, index) => ({
        id: /^[\w-]{1,64}$/.test(String(item?.id || "")) ? item.id : `custom-signal-${index + 1}`,
        name: String(item?.name || "Signal").trim().slice(0, 40) || "Signal",
        group: String(item?.group || "Custom robotics").trim().slice(0, 32) || "Custom robotics",
        preferredPins: Array.isArray(item?.preferredPins)
            ? item.preferredPins.filter((pin) => typeof pin === "string").slice(0, 20).map((pin) => pin.slice(0, 32))
            : [],
        requiresPin: item?.requiresPin !== false
    })) : base.functions;
    const functionIds = new Set(functions.map((item) => item.id));
    const assignments = {};
    if (robotics.assignments && typeof robotics.assignments === "object" && !Array.isArray(robotics.assignments)) {
        Object.entries(robotics.assignments).forEach(([functionId, assignment]) => {
            if (!functionIds.has(functionId) || !assignment || typeof assignment.componentId !== "string" ||
                !Number.isInteger(assignment.pinIndex)) return;
            assignments[functionId] = {
                componentId: assignment.componentId.slice(0, 48),
                pinIndex: assignment.pinIndex
            };
        });
    }
    const savedRails = new Map(Array.isArray(robotics.rails)
        ? robotics.rails.filter((rail) => rail && typeof rail.id === "string").map((rail) => [rail.id, rail])
        : []);
    const rails = base.rails.length ? base.rails.map((rail) => {
        const saved = savedRails.get(rail.id);
        const voltage = Number(saved?.voltage);
        return { ...rail, voltage: Number.isFinite(voltage) ? Math.min(60, Math.max(0, voltage)) : rail.voltage };
    }) : (Array.isArray(robotics.rails) ? robotics.rails.slice(0, 20).map((rail, index) => {
        const minimum = Number(rail?.minimum);
        const maximum = Number(rail?.maximum);
        return {
            id: /^[\w-]{1,48}$/.test(String(rail?.id || "")) ? rail.id : `custom-rail-${index + 1}`,
            name: String(rail?.name || `Rail ${index + 1}`).slice(0, 40),
            voltage: Math.min(60, Math.max(0, Number(rail?.voltage) || 0)),
            minimum: Number.isFinite(minimum) ? Math.min(60, Math.max(0, minimum)) : 0,
            maximum: Number.isFinite(maximum) ? Math.min(60, Math.max(0, maximum)) : 60
        };
    }) : []);
    const sourceRobot = robotics.sourceRobot && typeof robotics.sourceRobot === "object"
        ? {
            id: String(robotics.sourceRobot.id || "").slice(0, 80),
            name: String(robotics.sourceRobot.name || "Robot").slice(0, 80)
        }
        : null;
    return {
        ...base,
        source: robotics.source === "simulator" ? "simulator" : "manual",
        sourceRobot,
        controllerType: ["esp32", "arduinoUno", "mcu"].includes(robotics.controllerType)
            ? robotics.controllerType
            : base.controllerType,
        requiredParts: Array.isArray(robotics.requiredParts)
            ? [...new Set(robotics.requiredParts.filter((type) => typeof type === "string" && getPcbPartDefinition(type)))].slice(0, 40)
            : base.requiredParts,
        functions,
        assignments,
        rails,
        simulatorBridge: { ...base.simulatorBridge }
    };
}

function createPcbLayout(width, height) {
    return {
        outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }],
        outlineMode: "rectangle",
        footprints: [],
        tracks: [],
        vias: [],
        zones: [],
        measurements: [],
        layers: [
            { id: "top-copper", name: "Top copper", type: "copper", side: "top", visible: true },
            { id: "inner-1", name: "Inner 1", type: "copper", side: "inner", visible: true },
            { id: "inner-2", name: "Inner 2", type: "copper", side: "inner", visible: true },
            { id: "bottom-copper", name: "Bottom copper", type: "copper", side: "bottom", visible: true },
            { id: "top-silkscreen", name: "Top silkscreen", type: "silkscreen", side: "top", visible: true },
            { id: "bottom-silkscreen", name: "Bottom silkscreen", type: "silkscreen", side: "bottom", visible: false },
            { id: "board-outline", name: "Board outline", type: "outline", side: "both", visible: true }
        ],
        activeLayerId: "top-copper",
        activeTool: "select",
        grid: 1,
        trackWidth: 0.3,
        performanceMode: false,
        viaDiameter: 0.8,
        zoom: 1,
        panX: width / 2,
        panY: height / 2,
        nextFootprintId: 1,
        nextTrackId: 1,
        nextViaId: 1,
        nextZoneId: 1,
        nextMeasurementId: 1,
        nextLayerId: 1
    };
}

function normalizePcbLayout(layout, width, height) {
    const defaults = createPcbLayout(width, height);
    if (!layout || typeof layout !== "object") return defaults;
    const validPoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
        Math.abs(point.x) <= 1000 && Math.abs(point.y) <= 1000;
    const outline = Array.isArray(layout.outline) && layout.outline.length >= 4 &&
        layout.outline.length <= 100 && layout.outline.every(validPoint)
        ? layout.outline.map((point) => ({ x: point.x, y: point.y }))
        : defaults.outline;
    const footprints = Array.isArray(layout.footprints) ? layout.footprints.filter((item) =>
        item && typeof item.id === "string" && typeof item.reference === "string" &&
        Boolean(getPcbPartDefinition(item.type)) && Number.isFinite(item.x) && Number.isFinite(item.y) &&
        Number.isFinite(item.rotation)
    ).slice(0, 200).map((item) => {
        const definition = getPcbPartDefinition(item.type);
        const savedPads = Array.isArray(item.pads) ? item.pads.filter((pad) =>
            pad && Number.isInteger(pad.number) && pad.number >= 1 && pad.number <= definition.pins &&
            validPoint(pad.offset)
        ).map((pad) => ({
            number: pad.number,
            name: String(pad.name || definition.pinNames[pad.number - 1]).slice(0, 32),
            offset: { x: pad.offset.x, y: pad.offset.y },
            kind: pad.kind === "smd" ? "smd" : "through-hole",
            netId: typeof pad.netId === "string" ? pad.netId.slice(0, 48) : null
        })) : [];
        const savedPadsByNumber = new Map(savedPads.map((pad) => [pad.number, pad]));
        const pads = definition.boardModel && definition.layoutPads
            ? definition.pinNames.map((name, index) => ({
                number: index + 1,
                name,
                offset: { x: definition.layoutPads[index].x, y: definition.layoutPads[index].y },
                kind: "through-hole",
                netId: savedPadsByNumber.get(index + 1)?.netId || null
            }))
            : savedPads;
        const rotation = ((item.rotation % 360) + 360) % 360;
        const radians = rotation * Math.PI / 180;
        const halfWidth = (Math.abs(definition.width * Math.cos(radians)) + Math.abs(definition.height * Math.sin(radians))) / 2;
        const halfHeight = (Math.abs(definition.width * Math.sin(radians)) + Math.abs(definition.height * Math.cos(radians))) / 2;
        return {
            id: item.id.slice(0, 48),
            schematicId: typeof item.schematicId === "string" ? item.schematicId.slice(0, 48) : null,
            type: item.type,
            reference: item.reference.slice(0, 8),
            value: String(item.value || "").slice(0, 32),
            x: definition.boardModel && (item.x < halfWidth || item.x > width - halfWidth)
                ? width / 2
                : Math.max(0, Math.min(width, item.x)),
            y: definition.boardModel && (item.y < halfHeight || item.y > height - halfHeight)
                ? height / 2
                : Math.max(0, Math.min(height, item.y)),
            rotation,
            pads
        };
    }) : [];
    const footprintIds = new Set(footprints.map((item) => item.id));
    const validPad = (pad) => pad && footprintIds.has(pad.footprintId) &&
        Number.isInteger(pad.number) && footprints.some((item) =>
            item.id === pad.footprintId && item.pads.some((entry) => entry.number === pad.number));
    const tracks = Array.isArray(layout.tracks) ? layout.tracks.filter((track) =>
        track && typeof track.id === "string" && typeof track.netId === "string" &&
        Array.isArray(track.points) && track.points.length >= 2 && track.points.length <= 200 &&
        track.points.every(validPoint) && Number.isFinite(track.width) && track.width >= 0.1 && track.width <= 5 &&
        typeof track.layerId === "string" && layout.layers?.some((layer) => layer.id === track.layerId && layer.type === "copper")
    ).slice(0, 2000).map((track) => ({
        id: track.id.slice(0, 48),
        netId: track.netId.slice(0, 48),
        layerId: track.layerId,
        width: track.width,
        points: track.points.map((point) => ({ x: point.x, y: point.y })),
        startPad: validPad(track.startPad) ? { footprintId: track.startPad.footprintId, number: track.startPad.number } : null,
        endPad: validPad(track.endPad) ? { footprintId: track.endPad.footprintId, number: track.endPad.number } : null
    })) : [];
    const vias = Array.isArray(layout.vias) ? layout.vias.filter((via) =>
        via && typeof via.id === "string" && validPoint(via) && Number.isFinite(via.diameter) &&
        via.diameter >= 0.4 && via.diameter <= 3 && typeof via.netId === "string" &&
        Array.isArray(via.layers) && via.layers.length >= 2
    ).slice(0, 1000).map((via) => ({
        id: via.id.slice(0, 48),
        x: via.x, y: via.y, diameter: via.diameter, netId: via.netId.slice(0, 48),
        layers: via.layers.filter((id) => layout.layers?.some((layer) => layer.id === id && layer.type === "copper")).slice(0, 8)
    })) : [];
    const zones = Array.isArray(layout.zones) ? layout.zones.filter((zone) =>
        zone && typeof zone.id === "string" && typeof zone.netId === "string" &&
        typeof zone.layerId === "string" && layout.layers?.some((layer) => layer.id === zone.layerId && layer.type === "copper") &&
        Array.isArray(zone.points) && zone.points.length >= 3 && zone.points.length <= 100 && zone.points.every(validPoint)
    ).slice(0, 100).map((zone) => ({
        id: zone.id.slice(0, 48), netId: zone.netId.slice(0, 48), layerId: zone.layerId,
        points: zone.points.map((point) => ({ x: point.x, y: point.y }))
    })) : [];
    const measurements = Array.isArray(layout.measurements) ? layout.measurements.filter((item) =>
        item && typeof item.id === "string" && validPoint(item.start) && validPoint(item.end)
    ).slice(0, 100).map((item) => ({
        id: item.id.slice(0, 48),
        start: { x: item.start.x, y: item.start.y },
        end: { x: item.end.x, y: item.end.y }
    })) : [];
    const validLayerTypes = ["copper", "silkscreen", "outline"];
    const layers = Array.isArray(layout.layers) ? layout.layers.filter((layer) =>
        layer && typeof layer.id === "string" && typeof layer.name === "string" &&
        validLayerTypes.includes(layer.type) && ["top", "bottom", "inner", "both"].includes(layer.side)
    ).slice(0, 12).map((layer) => ({
        id: layer.id.slice(0, 48), name: layer.name.slice(0, 32), type: layer.type,
        side: layer.side, visible: layer.visible !== false
    })) : defaults.layers;
    const activeLayerId = layers.some((layer) => layer.id === layout.activeLayerId)
        ? layout.activeLayerId
        : layers.find((layer) => layer.type === "copper")?.id || "top-copper";
    const nets = Array.isArray(layout.nets) ? layout.nets.filter((net) =>
        net && typeof net.id === "string" && typeof net.name === "string" && Array.isArray(net.nodes)
    ).slice(0, 1000).map((net) => ({
        id: net.id.slice(0, 48),
        name: net.name.slice(0, 48),
        nodes: net.nodes.filter((node) =>
            node && typeof node.reference === "string" && Number.isInteger(node.pin) && node.pin > 0
        ).map((node) => ({ reference: node.reference.slice(0, 8), pin: node.pin }))
    })) : [];
    return {
        ...defaults,
        ...layout,
        outline,
        outlineMode: layout.outlineMode === "custom" ? "custom" : "rectangle",
        footprints,
        tracks,
        vias,
        zones,
        measurements,
        nets,
        layers: layers.length ? layers : defaults.layers,
        activeLayerId,
        activeTool: ["select", "track", "via", "zone", "outline", "measure"].includes(layout.activeTool) ? layout.activeTool : "select",
        grid: Math.max(0.1, Math.min(10, Number(layout.grid) || 1)),
        trackWidth: Math.max(0.1, Math.min(5, Number(layout.trackWidth) || 0.3)),
        performanceMode: layout.performanceMode === true,
        viaDiameter: Math.max(0.4, Math.min(3, Number(layout.viaDiameter) || 0.8)),
        zoom: Math.max(0.4, Math.min(4, Number(layout.zoom) || 1)),
        panX: Number.isFinite(layout.panX) ? layout.panX : width / 2,
        panY: Number.isFinite(layout.panY) ? layout.panY : height / 2,
        nextFootprintId: Math.max(1, Number(layout.nextFootprintId) || 1),
        nextTrackId: Math.max(1, Number(layout.nextTrackId) || 1),
        nextViaId: Math.max(1, Number(layout.nextViaId) || 1),
        nextZoneId: Math.max(1, Number(layout.nextZoneId) || 1),
        nextMeasurementId: Math.max(1, Number(layout.nextMeasurementId) || 1),
        nextLayerId: Math.max(1, Number(layout.nextLayerId) || 1)
    };
}

function getProjectPcbNets() {
    if (!activePcbProject) return [];
    const netMap = new Map();
    activePcbProject.schematic.sheets.forEach((sheet) => {
        getPcbSchematicConnectivity(sheet).forEach((net) => {
            const named = !/^Net-\d+$/.test(net.name);
            const key = named ? net.name.toUpperCase() : `${sheet.id}:${net.name}`;
            if (!netMap.has(key)) {
                netMap.set(key, {
                    id: `net-${key.toLowerCase().replace(/[^\w-]+/g, "-").slice(0, 40)}`,
                    name: net.name,
                    nodes: [],
                    nodeKeys: new Set()
                });
            }
            const target = netMap.get(key);
            net.nodes.forEach((node) => {
                const pin = Number(node.pin);
                const nodeKey = `${node.reference}:${pin}`;
                if (!target.nodeKeys.has(nodeKey)) {
                    target.nodeKeys.add(nodeKey);
                    target.nodes.push({ reference: node.reference, pin });
                }
            });
        });
    });
    return [...netMap.values()].map(({ nodeKeys, ...net }) => net);
}

function createPcbLayoutFootprint(type, reference, value, x, y, schematicId = null, netLookup = new Map()) {
    const definition = getPcbPartDefinition(type);
    if (!definition) return null;
    const smd = definition.footprint.type.toLowerCase().includes("smd");
    const sideCount = Math.ceil(definition.pins / 2);
    const pads = definition.pinNames.map((name, index) => {
        const side = definition.pins === 1 ? 0 : index < sideCount ? -1 : 1;
        const sideIndex = side < 0 ? index : index - sideCount;
        const rowCount = side < 0 ? sideCount : definition.pins - sideCount;
        const offset = definition.layoutPads?.[index]
            ? { x: definition.layoutPads[index].x, y: definition.layoutPads[index].y }
            : side === 0
            ? { x: 0, y: definition.height / 2 }
            : {
                x: side * (definition.width / 2 + (smd ? 0 : 1.2)),
                y: (sideIndex - (rowCount - 1) / 2) * Math.min(2.54, definition.height / Math.max(2, rowCount))
            };
        return {
            number: index + 1,
            name,
            offset,
            kind: smd ? "smd" : "through-hole",
            netId: netLookup.get(`${reference}:${index + 1}`) || null
        };
    });
    return {
        id: `layout-footprint-${activePcbProject.layout.nextFootprintId++}`,
        schematicId,
        type,
        reference,
        value: String(value || ""),
        x,
        y,
        rotation: 0,
        pads
    };
}

function pcbBoardPadSilkscreenLabel(boardModel, name) {
    if (boardModel === "arduino-uno-r3") {
        return name.startsWith("ICSP_") ? "" : name;
    }
    const shortName = name.split("/")[0];
    return shortName.startsWith("GPIO") ? shortName.slice(4) : shortName;
}

function renderPcbBoardArtwork(boardModel, reference = "") {
    if (boardModel === "arduino-uno-r3") {
        const holes = [[-20.3, -24.7], [29.7, -24.7], [-20.3, 23.3], [29.7, 23.3]]
            .map(([x, y]) => `<circle class="pcb-module-hole" cx="${x}" cy="${y}" r="1.7"/><circle class="pcb-module-hole-drill" cx="${x}" cy="${y}" r="0.8"/>`)
            .join("");
        const digitalSilk = arduinoUnoPhysicalPads.slice(0, arduinoUnoDigitalPins.length).map((pad) =>
            `<text class="pcb-module-silk pcb-module-pin-label" x="${pad.x}" y="-23.2" text-anchor="middle" font-size="0.95">${pcbBoardPadSilkscreenLabel(boardModel, pad.name)}</text>`
        ).join("");
        const powerSilk = arduinoUnoPhysicalPads.slice(arduinoUnoDigitalPins.length, arduinoUnoDigitalPins.length + arduinoUnoPowerPins.length).map((pad) =>
            `<text class="pcb-module-silk pcb-module-pin-label" x="-21.2" y="${pad.y + 0.3}" text-anchor="start" font-size="0.9">${pcbBoardPadSilkscreenLabel(boardModel, pad.name)}</text>`
        ).join("");
        const analogStart = arduinoUnoDigitalPins.length + arduinoUnoPowerPins.length;
        const analogSilk = arduinoUnoPhysicalPads.slice(analogStart, analogStart + arduinoUnoAnalogPins.length).map((pad) =>
            `<text class="pcb-module-silk pcb-module-pin-label" x="${pad.x}" y="24.8" text-anchor="middle" font-size="0.95">${pad.name}</text>`
        ).join("");
        return `<g class="pcb-module-art">
            <g class="pcb-module-metal">
                <rect x="-34" y="-7" width="10.8" height="13" rx="1.4"/><rect class="pcb-module-metal-detail" x="-32.8" y="-5.5" width="7.5" height="10" rx="0.8"/>
                <rect x="-33.3" y="12" width="9.4" height="10.2" rx="2"/><circle class="pcb-module-metal-detail" cx="-28.6" cy="17.1" r="2.8"/>
            </g>
            <g class="pcb-module-chip">
                <rect x="-2.5" y="4.3" width="18" height="7.4" rx="1.1"/><path class="pcb-module-chip-mark" d="M1 4.3v-1.1m3 1.1v-1.1m3 1.1v-1.1m3 1.1v-1.1m3 1.1v-1.1m3 1.1v-1.1M1 11.7v1.1m3-1.1v1.1m3-1.1v1.1m3-1.1v1.1m3-1.1v1.1m3-1.1v1.1"/>
                <text class="pcb-module-chip-label" x="6.5" y="8.7" text-anchor="middle" font-size="1.35">ATMEGA328P</text>
                <rect x="-17.5" y="-6" width="7.6" height="7.6" rx="0.8"/><text class="pcb-module-chip-label" x="-13.7" y="-1.6" text-anchor="middle" font-size="0.95">16U2</text>
                <rect x="18.8" y="12.2" width="6.6" height="4.4" rx="0.5"/><text class="pcb-module-chip-label" x="22.1" y="15" text-anchor="middle" font-size="0.9">REG</text>
                <rect x="7.5" y="17.8" width="5.6" height="3.2" rx="0.5"/><text class="pcb-module-silk" x="10.3" y="20" text-anchor="middle" font-size="0.8">16 MHz</text>
                <rect x="-21.8" y="-16.7" width="3.1" height="3.1" rx="0.7"/><text class="pcb-module-silk" x="-20.25" y="-14.4" text-anchor="middle" font-size="0.65">RESET</text>
                <rect x="13.2" y="-13.1" width="7.6" height="7.6" rx="0.7"/><text class="pcb-module-chip-label" x="17" y="-8.6" text-anchor="middle" font-size="0.85">ICSP</text>
                <circle class="pcb-module-led is-power" cx="-7.4" cy="-14.2" r="0.8"/><text class="pcb-module-silk" x="-7.4" y="-12.7" text-anchor="middle" font-size="0.55">ON</text>
                <circle class="pcb-module-led is-data" cx="-3.8" cy="-14.2" r="0.65"/><text class="pcb-module-silk" x="-3.8" y="-12.7" text-anchor="middle" font-size="0.5">TX</text>
                <circle class="pcb-module-led is-data" cx="-0.6" cy="-14.2" r="0.65"/><text class="pcb-module-silk" x="-0.6" y="-12.7" text-anchor="middle" font-size="0.5">RX</text>
            </g>
            ${holes}
            <g class="pcb-module-silk">
                <text x="0" y="-18.1" text-anchor="middle" font-size="2">ARDUINO</text>
                <text x="7.3" y="1.7" text-anchor="middle" font-size="2.5">UNO</text>
                <text x="22.7" y="-0.8" text-anchor="middle" font-size="1.05">R3</text>
                <text x="0" y="15.3" text-anchor="middle" font-size="0.9">${escapePcbMarkup(reference || "UNO R3")}</text>
                ${digitalSilk}${powerSilk}${analogSilk}
            </g>
        </g>`;
    }
    if (boardModel === "esp32-devkitc-v4") {
        const leftSilk = esp32DevKitCPhysicalPads.slice(0, esp32DevKitCLeftPins.length).map((pad) =>
            `<text class="pcb-module-silk pcb-module-pin-label" x="-12.8" y="${pad.y + 0.28}" text-anchor="middle" font-size="0.7">${pcbBoardPadSilkscreenLabel(boardModel, pad.name)}</text>`
        ).join("");
        const rightSilk = esp32DevKitCPhysicalPads.slice(esp32DevKitCLeftPins.length).map((pad) =>
            `<text class="pcb-module-silk pcb-module-pin-label" x="12.8" y="${pad.y + 0.28}" text-anchor="middle" font-size="0.7">${pcbBoardPadSilkscreenLabel(boardModel, pad.name)}</text>`
        ).join("");
        return `<g class="pcb-module-art">
            <g class="pcb-module-metal">
                <rect x="-6.1" y="21.4" width="12.2" height="7.7" rx="1.2"/><rect class="pcb-module-metal-detail" x="-4.8" y="22.7" width="9.6" height="4.6" rx="0.6"/>
            </g>
            <g class="pcb-module-chip">
                <rect x="-9.2" y="-25.1" width="18.4" height="20.2" rx="1.2"/><path class="pcb-module-antenna" d="M-5.8-23.9h11.6v3.8H-5.8v3.4h11.6v3.4H-5.8v3.2h11.6"/>
                <rect class="pcb-module-metal" x="-8.7" y="-3.5" width="17.4" height="10.2" rx="1.1"/><text class="pcb-module-chip-label" x="0" y="1.4" text-anchor="middle" font-size="1.45">ESP-WROOM-32</text>
                <rect x="-7.1" y="8.6" width="6.2" height="5.4" rx="0.7"/><text class="pcb-module-chip-label" x="-4" y="12" text-anchor="middle" font-size="0.95">CP2102N</text>
                <rect x="3.2" y="9" width="4.8" height="3.3" rx="0.5"/><text class="pcb-module-silk" x="5.6" y="11.2" text-anchor="middle" font-size="0.75">3V3</text>
                <circle class="pcb-module-led is-power" cx="8.2" cy="19.4" r="0.9"/><text class="pcb-module-silk" x="8.2" y="21.1" text-anchor="middle" font-size="0.55">PWR</text>
                <rect x="-7.1" y="15.2" width="3.7" height="3.1" rx="0.5"/><text class="pcb-module-silk" x="-5.25" y="17.3" text-anchor="middle" font-size="0.65">EN</text>
                <rect x="3.5" y="15.2" width="3.7" height="3.1" rx="0.5"/><text class="pcb-module-silk" x="5.35" y="17.3" text-anchor="middle" font-size="0.65">BOOT</text>
                <rect x="-2.7" y="21.4" width="5.4" height="3.2" rx="0.7"/><text class="pcb-module-chip-label" x="0" y="23.5" text-anchor="middle" font-size="0.7">AMS1117</text>
            </g>
            <g class="pcb-module-silk">
                <text x="0" y="7.8" text-anchor="middle" font-size="1">${escapePcbMarkup(reference || "ESP32")}</text>
                ${leftSilk}${rightSilk}
            </g>
        </g>`;
    }
    return "";
}

function syncPcbLayoutFromSchematic() {
    if (!activePcbProject) return;
    const layout = activePcbProject.layout;
    const projectNets = getProjectPcbNets();
    const netLookup = new Map();
    projectNets.forEach((net) => net.nodes.forEach((node) => netLookup.set(`${node.reference}:${node.pin}`, net.id)));
    const schematicComponents = activePcbProject.schematic.sheets.flatMap((sheet) => sheet.components);
    const existing = new Map(layout.footprints.map((footprint) => [footprint.reference, footprint]));
    const references = new Set(schematicComponents.map((component) => component.reference));
    const footprints = schematicComponents.map((component, index) => {
        const old = existing.get(component.reference);
        if (old) {
            old.schematicId = component.id;
            old.type = component.type;
            old.value = component.value;
            const definition = getPcbPartDefinition(component.type);
            const nextFootprintId = layout.nextFootprintId;
            old.pads = createPcbLayoutFootprint(component.type, component.reference, component.value, old.x, old.y, component.id, netLookup)?.pads ||
                definition.pinNames.map((name, pinIndex) => ({
                    number: pinIndex + 1, name, offset: { x: 0, y: 0 }, kind: "through-hole",
                    netId: netLookup.get(`${component.reference}:${pinIndex + 1}`) || null
                }));
            layout.nextFootprintId = nextFootprintId;
            return old;
        }
        const columns = Math.max(1, Math.floor((activePcbProject.width - 16) / 24));
        const definition = getPcbPartDefinition(component.type);
        const x = definition.boardModel ? activePcbProject.width / 2 : 8 + (index % columns) * 24;
        const y = definition.boardModel ? activePcbProject.height / 2 : 8 + Math.floor(index / columns) * 20;
        return createPcbLayoutFootprint(component.type, component.reference, component.value,
            Math.min(activePcbProject.width - 5, x), Math.min(activePcbProject.height - 5, y), component.id, netLookup);
    }).filter(Boolean);
    layout.footprints = footprints;
    layout.nets = projectNets;
    layout.tracks = layout.tracks.filter((track) =>
        projectNets.some((net) => net.id === track.netId) &&
        (!track.startPad || references.has(footprints.find((item) => item.id === track.startPad.footprintId)?.reference)) &&
        (!track.endPad || references.has(footprints.find((item) => item.id === track.endPad.footprintId)?.reference)));
    layout.vias = layout.vias.filter((via) => projectNets.some((net) => net.id === via.netId));
    layout.zones = layout.zones.filter((zone) => projectNets.some((net) => net.id === zone.netId));
    updatePcbLayoutTrackEndpoints(layout);
    pcbRouteSuggestions = [];
    schedulePcbSave();
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent =
        `Synchronized ${footprints.length} footprints and ${projectNets.length} schematic nets.`;
}

function layoutSnapPoint(point) {
    const grid = activePcbProject?.layout.grid || 1;
    return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

function getLayoutSvgPoint(event) {
    const svg = document.querySelector("[data-layout-svg]");
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const world = point.matrixTransform(matrix.inverse());
    return { x: world.x, y: world.y };
}

function getLayoutPadPosition(footprint, pad) {
    const angle = footprint.rotation * Math.PI / 180;
    return {
        x: footprint.x + pad.offset.x * Math.cos(angle) - pad.offset.y * Math.sin(angle),
        y: footprint.y + pad.offset.x * Math.sin(angle) + pad.offset.y * Math.cos(angle)
    };
}

function updatePcbLayoutTrackEndpoints(layout, footprintIds = null) {
    const footprintById = new Map(layout.footprints.map((footprint) => [footprint.id, footprint]));
    layout.tracks.forEach((track) => {
        const startFootprint = track.startPad && footprintById.get(track.startPad.footprintId);
        const endFootprint = track.endPad && footprintById.get(track.endPad.footprintId);
        if (footprintIds && !footprintIds.has(startFootprint?.id) && !footprintIds.has(endFootprint?.id)) return;
        if (startFootprint) {
            const pad = startFootprint.pads.find((item) => item.number === track.startPad.number);
            if (pad) track.points[0] = getLayoutPadPosition(startFootprint, pad);
        }
        if (endFootprint) {
            const pad = endFootprint.pads.find((item) => item.number === track.endPad.number);
            if (pad) track.points[track.points.length - 1] = getLayoutPadPosition(endFootprint, pad);
        }
    });
}

function getLayoutPadTarget(target) {
    const pad = target.closest("[data-layout-pad]");
    return pad ? {
        footprintId: pad.dataset.footprintId,
        number: Number(pad.dataset.padNumber),
        netId: pad.dataset.netId || null
    } : null;
}

function findNearestLayoutPad(point, layout) {
    let nearest = null;
    let distance = Math.max(0.75, layout.grid * 0.75);
    layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
        const position = getLayoutPadPosition(footprint, pad);
        const candidateDistance = Math.hypot(point.x - position.x, point.y - position.y);
        if (candidateDistance <= distance) {
            distance = candidateDistance;
            nearest = {
                footprintId: footprint.id,
                number: pad.number,
                netId: pad.netId || null
            };
        }
    }));
    return nearest;
}

function getPcbLayoutViaClearanceConflicts(layout, via) {
    const conflicts = [];
    layout.tracks.forEach((track) => {
        if (track.netId === via.netId || !via.layers.includes(track.layerId)) return;
        if (pcbPolylineDistanceToPoint(via, track.points) < (via.diameter + track.width) / 2 + 0.2) {
            conflicts.push(`track:${track.id}`);
        }
    });
    layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
        if (pad.netId === via.netId) return;
        const position = getLayoutPadPosition(footprint, pad);
        if (Math.hypot(via.x - position.x, via.y - position.y) < via.diameter / 2 + pcbPadRadius(pad) + 0.2) {
            conflicts.push(`pad:${footprint.reference}.${pad.number}`);
        }
    }));
    layout.vias.forEach((other) => {
        if (other.netId !== via.netId && Math.hypot(via.x - other.x, via.y - other.y) <
            (via.diameter + other.diameter) / 2 + 0.2) conflicts.push(`via:${other.id}`);
    });
    layout.zones.forEach((zone) => {
        if (zone.netId !== via.netId && via.layers.includes(zone.layerId) && pcbPointInPolygon(via, zone.points)) {
            conflicts.push(`zone:${zone.id}`);
        }
    });
    return [...new Set(conflicts)];
}

function pcbOutlinePath(points) {
    return `${points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")} Z`;
}

function pcbLayoutPadKey(pad) {
    return `${pad.footprintId}:${pad.number}`;
}

function pcbPointSegmentDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared
        ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
        : 0;
    return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}

function pcbSegmentsIntersect(a, b, c, d) {
    const orientation = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) => q.x >= Math.min(p.x, r.x) - 1e-8 && q.x <= Math.max(p.x, r.x) + 1e-8 &&
        q.y >= Math.min(p.y, r.y) - 1e-8 && q.y <= Math.max(p.y, r.y) + 1e-8;
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
    return (Math.abs(abC) < 1e-8 && onSegment(a, c, b)) ||
        (Math.abs(abD) < 1e-8 && onSegment(a, d, b)) ||
        (Math.abs(cdA) < 1e-8 && onSegment(c, a, d)) ||
        (Math.abs(cdB) < 1e-8 && onSegment(c, b, d));
}

function pcbSegmentDistance(a, b, c, d) {
    if (pcbSegmentsIntersect(a, b, c, d)) return 0;
    return Math.min(
        pcbPointSegmentDistance(a, c, d),
        pcbPointSegmentDistance(b, c, d),
        pcbPointSegmentDistance(c, a, b),
        pcbPointSegmentDistance(d, a, b)
    );
}

function pcbPolylineSegments(points) {
    return points.slice(1).map((point, index) => [points[index], point]);
}

function pcbPolylineDistanceToPoint(point, points) {
    return Math.min(...pcbPolylineSegments(points).map(([start, end]) =>
        pcbPointSegmentDistance(point, start, end)));
}

function pcbPolylineBounds(points) {
    return {
        minX: Math.min(...points.map((point) => point.x)),
        maxX: Math.max(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxY: Math.max(...points.map((point) => point.y))
    };
}

function pcbBoundsContainPoint(bounds, point, padding = 0) {
    return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding &&
        point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding;
}

function pcbBoundsOverlap(first, second, padding = 0) {
    return first.minX <= second.maxX + padding && first.maxX >= second.minX - padding &&
        first.minY <= second.maxY + padding && first.maxY >= second.minY - padding;
}

function pcbPointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const a = polygon[index];
        const b = polygon[previous];
        const crosses = (a.y > point.y) !== (b.y > point.y) &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

function pcbPadRadius(pad) {
    return pad.kind === "smd" ? 0.62 : 0.82;
}

function pcbPadOnLayer(pad, layer) {
    return pad.kind !== "smd" || layer.side === "top";
}

function analyzePcbConnectivity(layout) {
    const parent = new Map();
    const nodeNet = new Map();
    const addNode = (id, netId) => {
        parent.set(id, id);
        nodeNet.set(id, netId);
        return id;
    };
    const find = (id) => {
        if (!parent.has(id)) return null;
        let root = id;
        while (parent.get(root) !== root) root = parent.get(root);
        while (parent.get(id) !== id) {
            const next = parent.get(id);
            parent.set(id, root);
            id = next;
        }
        return root;
    };
    const union = (first, second) => {
        if (!parent.has(first) || !parent.has(second) || nodeNet.get(first) !== nodeNet.get(second)) return;
        const firstRoot = find(first);
        const secondRoot = find(second);
        if (firstRoot !== secondRoot) parent.set(secondRoot, firstRoot);
    };
    const padEntries = [];
    layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
        const key = pcbLayoutPadKey({ footprintId: footprint.id, number: pad.number });
        const entry = {
            key,
            nodeId: addNode(`pad:${key}`, pad.netId),
            netId: pad.netId,
            footprint,
            pad,
            position: getLayoutPadPosition(footprint, pad)
        };
        padEntries.push(entry);
    }));
    const trackEntries = layout.tracks.map((track, index) => ({
        index,
        track,
        nodeId: addNode(`track:${track.id}`, track.netId),
        segments: pcbPolylineSegments(track.points),
        bounds: pcbPolylineBounds(track.points)
    }));
    const tracksByNet = new Map();
    const tracksByNetLayer = new Map();
    trackEntries.forEach((entry) => {
        if (!tracksByNet.has(entry.track.netId)) tracksByNet.set(entry.track.netId, []);
        tracksByNet.get(entry.track.netId).push(entry);
        const key = `${entry.track.netId}\u0000${entry.track.layerId}`;
        if (!tracksByNetLayer.has(key)) tracksByNetLayer.set(key, []);
        tracksByNetLayer.get(key).push(entry);
    });
    const viaEntries = layout.vias.map((via) => ({
        via,
        nodeId: addNode(`via:${via.id}`, via.netId)
    }));
    const zoneEntries = layout.zones.map((zone) => ({
        zone,
        nodeId: addNode(`zone:${zone.id}`, zone.netId)
    }));
    const viasByNet = new Map();
    viaEntries.forEach((entry) => {
        if (!viasByNet.has(entry.via.netId)) viasByNet.set(entry.via.netId, []);
        viasByNet.get(entry.via.netId).push(entry);
    });
    const zonesByNet = new Map();
    zoneEntries.forEach((entry) => {
        if (!zonesByNet.has(entry.zone.netId)) zonesByNet.set(entry.zone.netId, []);
        zonesByNet.get(entry.zone.netId).push(entry);
    });
    const layerById = new Map(layout.layers.map((layer) => [layer.id, layer]));

    padEntries.forEach((pad) => {
        if (!pad.netId) return;
        const radius = pcbPadRadius(pad.pad);
        (tracksByNet.get(pad.netId) || []).forEach(({ track, nodeId, bounds }) => {
            const layer = layerById.get(track.layerId);
            if (!layer || !pcbPadOnLayer(pad.pad, layer)) return;
            if (!pcbBoundsContainPoint(bounds, pad.position, radius + track.width / 2)) return;
            if (pcbPolylineDistanceToPoint(pad.position, track.points) <= radius + track.width / 2) {
                union(pad.nodeId, nodeId);
            }
        });
        (viasByNet.get(pad.netId) || []).forEach(({ via, nodeId }) => {
            if (via.layers.some((id) => pcbPadOnLayer(pad.pad, layerById.get(id) || {})) &&
                Math.hypot(pad.position.x - via.x, pad.position.y - via.y) <= radius + via.diameter / 2) {
                union(pad.nodeId, nodeId);
            }
        });
        (zonesByNet.get(pad.netId) || []).forEach(({ zone, nodeId }) => {
            if (pcbPadOnLayer(pad.pad, layerById.get(zone.layerId) || {}) &&
                pcbPointInPolygon(pad.position, zone.points)) union(pad.nodeId, nodeId);
        });
    });

    trackEntries.forEach((entry, index) => {
        const sameLayerTracks = tracksByNetLayer.get(`${entry.track.netId}\u0000${entry.track.layerId}`) || [];
        sameLayerTracks.forEach((other) => {
            if (index >= other.index) return;
            if (!pcbBoundsOverlap(entry.bounds, other.bounds, (entry.track.width + other.track.width) / 2)) return;
            if (entry.segments.some(([a, b]) => other.segments.some(([c, d]) =>
                pcbSegmentDistance(a, b, c, d) <= (entry.track.width + other.track.width) / 2 + 0.02))) {
                union(entry.nodeId, other.nodeId);
            }
        });
        (viasByNet.get(entry.track.netId) || []).forEach(({ via, nodeId }) => {
            if (!via.layers.includes(entry.track.layerId)) return;
            if (entry.segments.some(([a, b]) =>
                pcbPointSegmentDistance(via, a, b) <= (via.diameter + entry.track.width) / 2)) {
                union(entry.nodeId, nodeId);
            }
        });
        (zonesByNet.get(entry.track.netId) || []).forEach(({ zone, nodeId }) => {
            if (zone.layerId !== entry.track.layerId) return;
            const touchesZone = entry.track.points.some((point) => pcbPointInPolygon(point, zone.points)) ||
                entry.segments.some(([a, b]) => zone.points.some((point, pointIndex) =>
                    pcbSegmentsIntersect(a, b, point, zone.points[(pointIndex + 1) % zone.points.length])));
            if (touchesZone) union(entry.nodeId, nodeId);
        });
    });
    viaEntries.forEach(({ via, nodeId }) => {
        (zonesByNet.get(via.netId) || []).forEach(({ zone, nodeId: zoneNodeId }) => {
            if (via.layers.includes(zone.layerId) && pcbPointInPolygon(via, zone.points)) {
                union(nodeId, zoneNodeId);
            }
        });
    });

    const netPadEntries = new Map();
    padEntries.forEach((entry) => {
        if (!entry.netId) return;
        if (!netPadEntries.has(entry.netId)) netPadEntries.set(entry.netId, []);
        netPadEntries.get(entry.netId).push(entry);
    });
    const connectedRoots = new Map();
    const padRoots = new Map();
    let unroutedPads = 0;
    for (const [netId, pads] of netPadEntries) {
        const roots = new Map();
        pads.forEach((pad) => {
            const root = find(pad.nodeId);
            padRoots.set(pad.key, root);
            roots.set(root, (roots.get(root) || 0) + 1);
        });
        connectedRoots.set(netId, roots);
        if (pads.length > 1) {
            pads.forEach((pad) => {
                if ((roots.get(find(pad.nodeId)) || 0) < 2) unroutedPads += 1;
            });
        }
    }
    const padStates = new Map(padEntries.map((entry) => {
        if (!entry.netId) return [entry.key, "unassigned"];
        const siblings = netPadEntries.get(entry.netId) || [];
        if (siblings.length < 2) return [entry.key, "single"];
        const roots = connectedRoots.get(entry.netId);
        return [entry.key, (roots.get(find(entry.nodeId)) || 0) > 1 ? "connected" : "unconnected"];
    }));
    const clearanceConflicts = getPcbLayoutClearanceConflicts(layout);
    const unassignedPins = padEntries.filter((entry) => !entry.netId).length;
    return { padEntries, padStates, netPadEntries, connectedRoots, padRoots, unroutedPads, unassignedPins, clearanceConflicts };
}

function getPcbLayoutClearanceConflicts(layout, candidate = null, ignoredTrackId = null) {
    const conflicts = [];
    const routes = candidate ? [candidate] : layout.tracks;
    routes.forEach((route) => {
        const routeSegments = pcbPolylineSegments(route.points);
        const routeBounds = pcbPolylineBounds(route.points);
        layout.tracks.forEach((other) => {
            if (other.id === route.id || other.id === ignoredTrackId || other.netId === route.netId ||
                other.layerId !== route.layerId) return;
            const required = (route.width + other.width) / 2 + 0.2;
            if (!pcbBoundsOverlap(routeBounds, pcbPolylineBounds(other.points), required)) return;
            if (routeSegments.some(([a, b]) => pcbPolylineSegments(other.points).some(([c, d]) =>
                pcbSegmentDistance(a, b, c, d) < required))) {
                conflicts.push(`track:${other.id}`);
            }
        });
        const routeLayer = layout.layers.find((layer) => layer.id === route.layerId);
        layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
            if (pad.netId === route.netId || !routeLayer || !pcbPadOnLayer(pad, routeLayer)) return;
            const position = getLayoutPadPosition(footprint, pad);
            const required = pcbPadRadius(pad) + route.width / 2 + 0.2;
            if (pcbBoundsContainPoint(routeBounds, position, required) &&
                pcbPolylineDistanceToPoint(position, route.points) < required) {
                conflicts.push(`pad:${footprint.reference}.${pad.number}`);
            }
        }));
        layout.vias.forEach((via) => {
            if (via.netId === route.netId || !via.layers.includes(route.layerId)) return;
            if (pcbPolylineDistanceToPoint(via, route.points) < (via.diameter + route.width) / 2 + 0.2) {
                conflicts.push(`via:${via.id}`);
            }
        });
        layout.zones.forEach((zone) => {
            if (zone.netId === route.netId || zone.layerId !== route.layerId) return;
            if (route.points.some((point) => pcbPointInPolygon(point, zone.points))) {
                conflicts.push(`zone:${zone.id}`);
                return;
            }
            if (routeSegments.some(([a, b]) => zone.points.some((point, index) =>
                pcbSegmentsIntersect(a, b, point, zone.points[(index + 1) % zone.points.length])))) {
                conflicts.push(`zone:${zone.id}`);
            }
        });
    });
    layout.vias.forEach((via, index) => {
        layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
            if (pad.netId === via.netId) return;
            const position = getLayoutPadPosition(footprint, pad);
            if (Math.hypot(via.x - position.x, via.y - position.y) <
                via.diameter / 2 + pcbPadRadius(pad) + 0.2) {
                conflicts.push(`pad:${footprint.reference}.${pad.number}`);
            }
        }));
        layout.vias.slice(index + 1).forEach((other) => {
            if (other.netId === via.netId || !via.layers.some((id) => other.layers.includes(id))) return;
            if (Math.hypot(via.x - other.x, via.y - other.y) <
                (via.diameter + other.diameter) / 2 + 0.2) conflicts.push(`via:${other.id}`);
        });
    });
    layout.zones.forEach((zone) => conflicts.push(...getPcbLayoutZoneClearanceConflicts(layout, zone, zone.id)));
    return [...new Set(conflicts)];
}

function getPcbLayoutZoneClearanceConflicts(layout, zone, ignoredZoneId = null) {
    const conflicts = [];
    const layer = layout.layers.find((item) => item.id === zone.layerId);
    if (!layer) return conflicts;
    layout.footprints.forEach((footprint) => footprint.pads.forEach((pad) => {
        if (pad.netId === zone.netId || !pcbPadOnLayer(pad, layer)) return;
        if (pcbPointInPolygon(getLayoutPadPosition(footprint, pad), zone.points)) {
            conflicts.push(`pad:${footprint.reference}.${pad.number}`);
        }
    }));
    layout.tracks.forEach((track) => {
        if (track.netId === zone.netId || track.layerId !== zone.layerId) return;
        const segments = pcbPolylineSegments(track.points);
        if (track.points.some((point) => pcbPointInPolygon(point, zone.points)) ||
            segments.some(([a, b]) => zone.points.some((point, index) =>
                pcbSegmentsIntersect(a, b, point, zone.points[(index + 1) % zone.points.length])))) {
            conflicts.push(`track:${track.id}`);
        }
    });
    layout.vias.forEach((via) => {
        if (via.netId !== zone.netId && via.layers.includes(zone.layerId) && pcbPointInPolygon(via, zone.points)) {
            conflicts.push(`via:${via.id}`);
        }
    });
    layout.zones.forEach((other) => {
        if (other.id === ignoredZoneId || other.netId === zone.netId || other.layerId !== zone.layerId) return;
        if (zone.points.some((point) => pcbPointInPolygon(point, other.points)) ||
            other.points.some((point) => pcbPointInPolygon(point, zone.points)) ||
            zone.points.some((point, index) => other.points.some((otherPoint, otherIndex) =>
                pcbSegmentsIntersect(point, zone.points[(index + 1) % zone.points.length],
                    otherPoint, other.points[(otherIndex + 1) % other.points.length])))) {
            conflicts.push(`zone:${other.id}`);
        }
    });
    return conflicts;
}

function suggestPcbLayoutRoutes(layout) {
    const analysis = analyzePcbConnectivity(layout);
    const suggestions = [];
    const layer = layout.layers.find((item) => item.id === layout.activeLayerId);
    if (!layer) return suggestions;
    const gridPoint = (point) => ({
        x: Math.round(point.x / layout.grid) * layout.grid,
        y: Math.round(point.y / layout.grid) * layout.grid
    });
    analysis.netPadEntries.forEach((allPads, netId) => {
        if (allPads.length < 2 || suggestions.length >= 30) return;
        const pads = allPads.slice(0, 100).filter((pad) => pcbPadOnLayer(pad.pad, layer));
        let best = null;
        let closestPair = null;
        for (let firstIndex = 0; firstIndex < pads.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < pads.length; secondIndex += 1) {
                const startPad = pads[firstIndex];
                const endPad = pads[secondIndex];
                if (analysis.padRoots.get(startPad.key) === analysis.padRoots.get(endPad.key)) continue;
                const distance = Math.hypot(startPad.position.x - endPad.position.x, startPad.position.y - endPad.position.y);
                if (!closestPair || distance < closestPair.distance) closestPair = { startPad, endPad, distance };
            }
        }
        if (!closestPair) return;
        const { startPad, endPad } = closestPair;
        const start = startPad.position;
        const end = endPad.position;
        const bends = [
            gridPoint({ x: end.x, y: start.y }),
            gridPoint({ x: start.x, y: end.y }),
            gridPoint({ x: (start.x + end.x) / 2, y: start.y }),
            gridPoint({ x: end.x, y: (start.y + end.y) / 2 }),
            gridPoint({ x: start.x, y: (start.y + end.y) / 2 - Math.max(2, layout.grid * 2.5) }),
            gridPoint({ x: end.x, y: (start.y + end.y) / 2 - Math.max(2, layout.grid * 2.5) }),
            gridPoint({ x: start.x, y: (start.y + end.y) / 2 + Math.max(2, layout.grid * 2.5) }),
            gridPoint({ x: end.x, y: (start.y + end.y) / 2 + Math.max(2, layout.grid * 2.5) })
        ];
        const candidatePoints = [
            ...bends.map((bend) => [start, bend, end]),
            [
                start,
                gridPoint({ x: start.x, y: (start.y + end.y) / 2 - Math.max(2, layout.grid * 2.5) }),
                gridPoint({ x: end.x, y: (start.y + end.y) / 2 - Math.max(2, layout.grid * 2.5) }),
                end
            ],
            [
                start,
                gridPoint({ x: start.x, y: (start.y + end.y) / 2 + Math.max(2, layout.grid * 2.5) }),
                gridPoint({ x: end.x, y: (start.y + end.y) / 2 + Math.max(2, layout.grid * 2.5) }),
                end
            ]
        ];
        candidatePoints.forEach((candidate) => {
            const points = candidate.filter((point, index, list) =>
                !index || point.x !== list[index - 1].x || point.y !== list[index - 1].y);
            if (points.length < 2) return;
            const route = { id: "", netId, layerId: layout.activeLayerId, width: layout.trackWidth, points };
            const conflicts = getPcbLayoutClearanceConflicts(layout, route);
            const distance = pcbPolylineSegments(points).reduce((sum, [a, b]) =>
                sum + Math.hypot(b.x - a.x, b.y - a.y), 0);
            const score = distance + (points.length - 2) * layout.grid * 0.25 + conflicts.length * 10000;
            if (!best || score < best.score) best = {
                score, conflicts, route,
                startPad: { footprintId: startPad.footprint.id, number: startPad.pad.number },
                endPad: { footprintId: endPad.footprint.id, number: endPad.pad.number }
            };
        });
        if (best) suggestions.push({ ...best, netName: layout.nets.find((net) => net.id === netId)?.name || "Net" });
    });
    return suggestions;
}

function getPcbConnectivityAnalysis(layout) {
    if (pcbConnectivityLayout !== layout || !pcbConnectivityAnalysis) {
        pcbConnectivityLayout = layout;
        pcbConnectivityAnalysis = analyzePcbConnectivity(layout);
    }
    return pcbConnectivityAnalysis;
}

function parsePcbElectricalQuantity(value) {
    const text = String(value || "").trim();
    const namedVoltages = { "3V3": 3.3, "1V8": 1.8, "2V5": 2.5 };
    if (namedVoltages[text.toUpperCase()] !== undefined) return { value: namedVoltages[text.toUpperCase()], unit: "V" };
    const match = text.match(/(-?\d+(?:\.\d+)?)\s*(mA|uA|µA|A|mV|V|mW|W|kΩ|ohm|Ω|uF|µF|nF|pF)?/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    const scales = { ma: 0.001, ua: 0.000001, "µa": 0.000001, mv: 0.001, mw: 0.001, uf: 0.000001, "µf": 0.000001, nf: 0.000000001, pf: 0.000000000001 };
    const normalizedUnit = unit === "ω" || unit === "ohm" || unit === "kω" ? "Ω" : unit.endsWith("v") ? "V" : unit.endsWith("a") ? "A" : unit.endsWith("w") ? "W" : unit;
    const scale = scales[unit] || (unit === "kω" ? 1000 : 1);
    return { value: amount * scale, unit: normalizedUnit };
}

function getPcbSchematicValidationGroups(sheet) {
    const parent = new Map();
    const make = (key) => { if (!parent.has(key)) parent.set(key, key); };
    const find = (key) => {
        make(key);
        if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
        return parent.get(key);
    };
    const union = (first, second) => {
        const rootA = find(first);
        const rootB = find(second);
        if (rootA !== rootB) parent.set(rootB, rootA);
    };
    const keyFor = (componentId, pinIndex) => `${componentId}:${pinIndex}`;
    const labelsByName = new Map();
    const globalsByName = new Map();
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        definition.pinNames.forEach((pinName, pinIndex) => {
            const key = keyFor(component.id, pinIndex);
            make(key);
            const globalName = component.type === "ground"
                ? "GND"
                : component.type === "power"
                    ? pinIndex === 0 ? (component.value || "VCC") : "GND"
                    : pinName.toUpperCase() === "GND" ? "GND" : null;
            if (globalName) {
                const normalizedName = globalName.toUpperCase();
                if (globalsByName.has(normalizedName)) union(globalsByName.get(normalizedName), key);
                else globalsByName.set(normalizedName, key);
            }
        });
    });
    sheet.wires.forEach((wire) => union(
        keyFor(wire.start.componentId, wire.start.pinIndex),
        keyFor(wire.end.componentId, wire.end.pinIndex)
    ));
    sheet.labels.forEach((label) => {
        if (!label.pin) return;
        const key = keyFor(label.pin.componentId, label.pin.pinIndex);
        const normalizedName = label.name.toUpperCase();
        if (labelsByName.has(normalizedName)) union(labelsByName.get(normalizedName), key);
        else labelsByName.set(normalizedName, key);
    });
    const nodesByRoot = new Map();
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        definition.pinNames.forEach((pinName, pinIndex) => {
            const root = find(keyFor(component.id, pinIndex));
            if (!nodesByRoot.has(root)) nodesByRoot.set(root, []);
            nodesByRoot.get(root).push({ component, pinIndex, pinName });
        });
    });
    const nameByRoot = new Map();
    const labelsByRoot = new Map();
    sheet.labels.forEach((label) => {
        if (!label.pin) return;
        const root = find(keyFor(label.pin.componentId, label.pin.pinIndex));
        nameByRoot.set(root, label.name);
        if (!labelsByRoot.has(root)) labelsByRoot.set(root, []);
        labelsByRoot.get(root).push(label.name);
    });
    globalsByName.forEach((key, name) => nameByRoot.set(find(key), name));
    return [...nodesByRoot.entries()].map(([root, nodes]) => ({
        id: root,
        name: nameByRoot.get(find(root)) || "",
        labelNames: labelsByRoot.get(find(root)) || [],
        nodes
    }));
}

function validatePcbProject(project) {
    const issues = [];
    let nextIssueId = 1;
    const electricalCodes = new Set([
        "duplicate-reference", "missing-value", "missing-electrical-rating", "invalid-specification", "unconnected-pin",
        "power-rail-conflict", "voltage-rating", "ground-return", "robotics-pin-conflict",
        "robotics-pin-compatibility", "robotics-rail-voltage", "robotics-component-compatibility"
    ]);
    const addIssue = (severity, code, title, explanation, correction, target = null, kind = "rule") => {
        issues.push({
            id: `validation-${nextIssueId++}`,
            severity,
            code,
            domain: kind === "estimate" ? "estimate" : code === "checks-clear" ? "summary" :
                electricalCodes.has(code) ? "ERC" : "DRC",
            title,
            explanation,
            correction,
            target,
            kind
        });
    };
    const sheets = project.schematic.sheets;
    const allComponents = sheets.flatMap((sheet) => sheet.components.map((component) => ({ component, sheet })));
    const references = new Map();
    allComponents.forEach(({ component, sheet }) => {
        const reference = component.reference.toUpperCase();
        if (references.has(reference)) {
            addIssue("error", "duplicate-reference", `Duplicate reference ${component.reference}`,
                `Reference ${component.reference} is used more than once in the project, so netlist and layout references are ambiguous.`,
                "Give each component a unique reference across all sheets.",
                { area: "schematic", sheetId: sheet.id, componentId: component.id });
        } else references.set(reference, component);
        if (!String(component.value || "").trim()) {
            addIssue("warning", "missing-value", `${component.reference} has no value`,
                "The component's value field is empty, leaving the design and generated netlist underspecified.",
                "Enter a part value or a clear part number in the component inspector.",
                { area: "schematic", sheetId: sheet.id, componentId: component.id });
        }
        const definition = getPcbPartDefinition(component.type);
        const hasElectricalRating = Object.entries(definition.electrical || {}).some(([name, value]) =>
            /(voltage|current|power|resistance|capacitance|supply|logic|rating)/i.test(name) &&
            /\d+(?:\.\d+)?\s*(?:mA|uA|µA|A|mV|V|mW|W|kΩ|ohm|Ω|uF|µF|nF|pF)/i.test(String(value)));
        if (!hasElectricalRating && !["Connectors", "Controls"].includes(definition.category) && component.type !== "ground") {
            addIssue("warning", "missing-electrical-rating", `${component.reference} has no declared electrical rating`,
                `The component library entry has no numeric voltage, current, power, resistance, or capacitance rating that this validator can use.`,
                "Add the relevant ratings from the exact component datasheet, or confirm that they do not apply.",
                { area: "schematic", sheetId: sheet.id, componentId: component.id });
        }
        Object.entries(definition.electrical || {}).forEach(([name, value]) => {
            if (!/(voltage|current|power|resistance|capacitance)/i.test(name)) return;
            const quantity = parsePcbElectricalQuantity(value);
            if (quantity && quantity.value <= 0) {
                addIssue("error", "invalid-specification", `${component.reference} has an invalid ${name}`,
                    `The ${name} specification is ${value}, but this quantity must be greater than zero.`,
                    "Correct the component specification in the library or replace the part.",
                    { area: "schematic", sheetId: sheet.id, componentId: component.id });
            }
        });
    });

    sheets.forEach((sheet) => {
        const groups = getPcbSchematicValidationGroups(sheet);
        groups.forEach((group) => {
            if (group.nodes.length !== 1 || group.name) return;
            const node = group.nodes[0];
            if (node.component.type === "ground") return;
            addIssue("warning", "unconnected-pin", `${node.component.reference}.${node.pinName} is unconnected`,
                `This pin is not joined to another pin by a wire or a named net on ${sheet.name}.`,
                "Connect the pin, attach a net label, or confirm that it is intentionally unused.",
                { area: "schematic", sheetId: sheet.id, componentId: node.component.id, pinIndex: node.pinIndex });
        });

        groups.forEach((group) => {
            const namedVoltage = parsePcbElectricalQuantity(group.name);
            const sources = group.nodes.filter(({ component, pinIndex }) => component.type === "power" && pinIndex === 0)
                .map(({ component }) => {
                    const electrical = component.electrical || getPcbPartDefinition(component.type).electrical || {};
                    return {
                        component,
                        voltage: parsePcbElectricalQuantity(electrical.nominalVoltage) ||
                            parsePcbElectricalQuantity(component.value)
                    };
                })
                .filter((source) => source.voltage?.unit === "V");
            const voltages = sources.map((source) => source.voltage.value);
            const labelVoltages = group.labelNames.map(parsePcbElectricalQuantity)
                .filter((quantity) => quantity?.unit === "V");
            if (namedVoltage?.unit === "V") voltages.push(namedVoltage.value);
            labelVoltages.forEach((quantity) => voltages.push(quantity.value));
            const distinctVoltages = [...new Set(voltages.map((voltage) => Math.round(voltage * 100) / 100))];
            const shortedSource = sources.find((source) => group.nodes.some((node) =>
                node.component.id === source.component.id && node.pinIndex === 1 ||
                node.component.type === "ground"));
            if (distinctVoltages.length > 1 || shortedSource) {
                const source = sources[0];
                addIssue("error", "power-rail-conflict", shortedSource ? "Power source positive and return pins are shorted" : `Conflicting voltages on ${group.name || "one net"}`,
                    shortedSource
                        ? `The positive pin of ${shortedSource.component.reference} shares a schematic net with its return or a ground terminal.`
                        : `This net combines power sources or a voltage-named net with different declared voltages (${distinctVoltages.join(" V and ")} V).`,
                    "Separate the rails or correct the source/net labels so only compatible voltages share this net.",
                    source
                        ? { area: "schematic", sheetId: sheet.id, componentId: source.component.id, pinIndex: 0 }
                        : group.nodes[0]
                            ? { area: "schematic", sheetId: sheet.id, componentId: group.nodes[0].component.id, pinIndex: group.nodes[0].pinIndex }
                            : null);
            }
            const knownVoltage = sources.length === 1 ? sources[0].voltage?.value : null;
            if (Number.isFinite(knownVoltage)) {
                group.nodes.forEach(({ component, pinIndex }) => {
                    if (component.type === "power" && pinIndex === 0) return;
                    const definition = getPcbPartDefinition(component.type);
                    const maximum = parsePcbElectricalQuantity(definition.electrical?.maximumVoltage);
                    if (maximum?.unit !== "V" || knownVoltage <= maximum.value) return;
                    addIssue("warning", "voltage-rating", `${component.reference} may exceed its voltage rating`,
                        `The connected source is declared as ${knownVoltage} V, above this component's stated maximum of ${maximum.value} V.`,
                        "Verify the exact part and pin rating, then reduce the rail or add an appropriate interface/regulator.",
                        { area: "schematic", sheetId: sheet.id, componentId: component.id, pinIndex });
                });
            }
        });

        const hasPower = sheet.components.some((component) =>
            component.type === "power" || /^(?:VCC|VDD|VIN|5V|3V3)$/i.test(component.value));
        const groundedGroup = groups.find((group) => group.name.toUpperCase() === "GND");
        if (hasPower && (!groundedGroup || groundedGroup.nodes.length < 2)) {
            const source = sheet.components.find((component) => component.type === "power");
            addIssue("warning", "ground-return", "Ground return is not verified",
                "A powered design is present, but the schematic has no shared ground net joining a return pin to another circuit pin.",
                "Connect the circuit ground/reference to the supply return, or confirm that the circuit is intentionally isolated.",
                source ? { area: "schematic", sheetId: sheet.id, componentId: source.id } : null);
        }
    });

    const schematicWithFootprints = new Set(project.layout.footprints.map((footprint) => footprint.schematicId).filter(Boolean));
    allComponents.forEach(({ component, sheet }) => {
        if (component.type === "ground" || schematicWithFootprints.has(component.id)) return;
        addIssue("warning", "missing-footprint", `${component.reference} has no PCB footprint`,
            "This schematic component is not represented in the current physical layout.",
            "Use Sync schematic or add a matching footprint before routing the board.",
            { area: "schematic", sheetId: sheet.id, componentId: component.id });
    });

    const currentLoads = [];
    let knownPowerCapacity = null;
    let knownPowerVoltage = null;
    const powerSources = allComponents.filter(({ component }) => component.type === "power");
    const capacitySources = powerSources.map(({ component }) => {
        const electrical = component.electrical || getPcbPartDefinition(component.type).electrical || {};
        const capacity = parsePcbElectricalQuantity(electrical.currentCapacity || electrical.maxOutputCurrent || electrical.outputCurrent);
        const voltage = parsePcbElectricalQuantity(electrical.nominalVoltage) || parsePcbElectricalQuantity(component.value);
        return { capacity, voltage };
    }).filter((source) => source.capacity?.unit === "A");
    allComponents.forEach(({ component }) => {
        const electrical = component.electrical || getPcbPartDefinition(component.type).electrical || {};
        const explicitLoad = parsePcbElectricalQuantity(
            electrical.currentDraw || electrical.typicalCurrent || electrical.loadCurrent || electrical.currentConsumption
        );
        if (explicitLoad?.unit === "A" && explicitLoad.value > 0) {
            currentLoads.push(explicitLoad.value);
        } else if (component.type === "led") {
            const ledCurrent = parsePcbElectricalQuantity(electrical.current);
            if (ledCurrent?.unit === "A" && ledCurrent.value > 0) {
                currentLoads.push(ledCurrent.value);
            }
        }
    });
    if (capacitySources.length === 1 && currentLoads.length) {
        knownPowerCapacity = capacitySources[0].capacity.value;
        knownPowerVoltage = capacitySources[0].voltage?.unit === "V" ? capacitySources[0].voltage.value : null;
        const estimatedCurrent = currentLoads.reduce((sum, current) => sum + current, 0);
        const estimatedPower = knownPowerVoltage === null ? null : estimatedCurrent * knownPowerVoltage;
        if (estimatedCurrent > knownPowerCapacity) {
            addIssue("warning", "power-budget", "Estimated load exceeds declared supply capacity",
                `Listed load currents total about ${(estimatedCurrent * 1000).toFixed(1)} mA${estimatedPower === null ? "" : ` (${(estimatedPower * 1000).toFixed(1)} mW)`}, versus a declared ${(knownPowerCapacity * 1000).toFixed(1)} mA supply capacity.`,
                "Check actual operating loads and supply ratings; increase capacity or reduce the load if needed.",
                null,
                "estimate");
        } else {
            addIssue("suggestion", "power-budget", "Estimated power budget",
                `Listed load currents total about ${(estimatedCurrent * 1000).toFixed(1)} mA${estimatedPower === null ? "" : ` (${(estimatedPower * 1000).toFixed(1)} mW)`}; the declared supply capacity is ${(knownPowerCapacity * 1000).toFixed(1)} mA.`,
                "Include startup, peak, conversion-loss, and thermal margins using real datasheet values.",
                null,
                "estimate");
        }
    } else {
        const estimate = currentLoads.length
            ? `Known load-current entries total about ${(currentLoads.reduce((sum, current) => sum + current, 0) * 1000).toFixed(1)} mA. `
            : "";
        addIssue("suggestion", "power-budget-data", "Power/current estimate is incomplete",
            `${estimate}The project does not declare both usable load-current values and a single supply-current capacity, so a complete budget cannot be calculated.`,
            "Add realistic currentDraw/loadCurrent and currentCapacity specifications from component datasheets. LED current is treated only as a nominal load estimate.",
            null,
            "estimate");
    }

    const layout = project.layout;
    const connectivity = analyzePcbConnectivity(layout);
    const padsByNet = connectivity.netPadEntries;
    layout.nets.forEach((net) => {
        if (net.nodes.length < 2) return;
        const netPads = padsByNet.get(net.id) || [];
        if (netPads.length < 2) {
            const firstNode = net.nodes[0];
            const schematicNode = firstNode && allComponents.find(({ component }) =>
                component.reference === firstNode.reference);
            addIssue("warning", "net-not-placed", `${net.name} is not fully placed on the PCB`,
                `The synchronized net contains ${net.nodes.length} schematic pins, but fewer than two matching PCB pads are present.`,
                "Sync the schematic and place the footprints for every endpoint of this net.",
                netPads[0]
                    ? { area: "layout", footprintId: netPads[0].footprint.id, padNumber: netPads[0].pad.number, netId: net.id }
                    : schematicNode
                        ? { area: "schematic", sheetId: schematicNode.sheet.id, componentId: schematicNode.component.id, pinIndex: firstNode.pin - 1 }
                        : null);
            return;
        }
        const roots = new Set(netPads.map((entry) => connectivity.padRoots.get(entry.key)));
        if (roots.size > 1) {
            const first = netPads.find((entry) => connectivity.padStates.get(entry.key) === "unconnected") || netPads[0];
            addIssue("warning", "unrouted-net", `${net.name} has unconnected PCB pads`,
                `${netPads.length} PCB pads belong to this net, but the copper connectivity model finds ${roots.size} separate copper islands.`,
                "Route the remaining airwires, add vias between layers, or verify copper-zone connectivity.",
                { area: "layout", footprintId: first.footprint.id, padNumber: first.pad.number, netId: net.id });
        }
    });

    const outline = layout.outline;
    const outlineSegments = pcbPolylineSegments([...outline, outline[0]]);
    const isOnBoard = (point) => pcbPointInPolygon(point, outline) ||
        outlineSegments.some(([start, end]) => pcbPointSegmentDistance(point, start, end) <= 0.0001);
    layout.footprints.forEach((footprint) => {
        const definition = getPcbPartDefinition(footprint.type);
        const angle = footprint.rotation * Math.PI / 180;
        const halfWidth = definition.width / 2;
        const halfHeight = definition.height / 2;
        const corners = [
            { x: -halfWidth, y: -halfHeight }, { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight }, { x: -halfWidth, y: halfHeight }
        ].map((point) => ({
            x: footprint.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
            y: footprint.y + point.x * Math.sin(angle) + point.y * Math.cos(angle)
        }));
        const outsidePad = footprint.pads.find((pad) => !isOnBoard(getLayoutPadPosition(footprint, pad)));
        if (corners.some((point) => !isOnBoard(point)) || outsidePad) {
            addIssue("error", "footprint-boundary", `${footprint.reference} crosses the board outline`,
                `The rotated footprint body or at least one pad lies outside the defined board polygon.`,
                "Move or rotate the footprint inward, or adjust the board outline.",
                { area: "layout", footprintId: footprint.id, padNumber: outsidePad?.number || null });
        }
    });
    const segmentWithinBoard = (start, end) => {
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const steps = Math.max(1, Math.ceil(length / 2));
        for (let index = 0; index <= steps; index += 1) {
            const ratio = index / steps;
            if (!isOnBoard({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio })) return false;
        }
        return true;
    };
    layout.tracks.forEach((track) => {
        const outside = track.points.some((point, index) =>
            !isOnBoard(point) || (index > 0 && !segmentWithinBoard(track.points[index - 1], point)));
        if (outside) {
            addIssue("error", "track-boundary", "Copper track crosses the board edge",
                `Track ${track.id} has a vertex or segment outside the board outline.`,
                "Reshape or move the route so all of its copper remains inside the board boundary.",
                { area: "layout", trackId: track.id, netId: track.netId });
        }
    });
    layout.vias.forEach((via) => {
        const radius = via.diameter / 2;
        const perimeter = Array.from({ length: 12 }, (_, index) => {
            const angle = index * Math.PI / 6;
            return { x: via.x + Math.cos(angle) * radius, y: via.y + Math.sin(angle) * radius };
        });
        if (!isOnBoard(via) || perimeter.some((point) => !isOnBoard(point))) {
            addIssue("error", "via-boundary", `Via ${via.id} crosses the board edge`,
                `The via center or its modeled copper diameter lies outside the board outline.`,
                "Move the via inward or revise the board edge.",
                { area: "layout", viaId: via.id, netId: via.netId });
        }
    });
    layout.zones.forEach((zone) => {
        if (zone.points.some((point) => !isOnBoard(point))) {
            addIssue("error", "zone-boundary", `Copper zone ${zone.id} crosses the board edge`,
                "At least one copper-zone vertex lies outside the board polygon.",
                "Redraw the zone so it stays within the board outline.",
                { area: "layout", zoneId: zone.id, netId: zone.netId });
        }
    });

    const clearanceConflicts = getPcbLayoutClearanceConflicts(layout);
    clearanceConflicts.forEach((conflict) => {
        const separator = conflict.indexOf(":");
        const type = conflict.slice(0, separator);
        const identifier = conflict.slice(separator + 1);
        let target = { area: "layout" };
        if (type === "track") target.trackId = identifier;
        if (type === "via") target.viaId = identifier;
        if (type === "zone") target.zoneId = identifier;
        if (type === "pad") {
            const lastDot = identifier.lastIndexOf(".");
            const reference = identifier.slice(0, lastDot);
            const padNumber = Number(identifier.slice(lastDot + 1));
            const footprint = layout.footprints.find((item) => item.reference === reference);
            if (footprint) {
                target.footprintId = footprint.id;
                target.padNumber = padNumber;
            }
        }
        addIssue("error", "track-clearance", "Copper clearance conflict detected",
            `The geometry check found insufficient separation near ${identifier}. Aqua currently checks against an internal 0.2 mm clearance allowance; this is not a manufacturer-specific fabrication rule.`,
            "Increase spacing or reroute the copper, then confirm the actual board manufacturer's clearance limits.",
            target);
    });

    const robotics = normalizePcbRobotics(project.robotics);
    const roboticsTemplate = getPcbRoboticsTemplate(robotics.templateId);
    if (robotics.templateId !== "custom") {
        robotics.requiredParts.forEach((type) => {
            if (allComponents.some(({ component }) => component.type === type)) return;
            const definition = getPcbPartDefinition(type);
            addIssue("warning", "robotics-component-compatibility",
                `Robotics template part missing: ${definition?.name || type}`,
                `The ${roboticsTemplate.name} plan recommends this component, but it has not been added to the schematic yet.`,
                "Add the recommended parts, or update your robotics plan if this component is not used.",
                null);
        });
    }
    if (robotics.templateId === "battery-interface") {
        addIssue("warning", "robotics-component-compatibility", "Battery interface is not a battery protection system",
            "This template provides connection planning only. It does not implement a charger, cell balancing, over-current/over-voltage protection, or a battery-management circuit.",
            "Use a correctly rated battery-management/protection system and charger for the exact cell chemistry and pack, and verify all current and thermal limits.",
            null);
    }
    robotics.rails.forEach((rail) => {
        if (rail.voltage >= rail.minimum && rail.voltage <= rail.maximum) return;
        addIssue("error", "robotics-rail-voltage", `${rail.name} is outside the planned voltage range`,
            `The planned rail is ${rail.voltage} V; this template's declared range is ${rail.minimum}–${rail.maximum} V. This is a template-level compatibility check, not a component safety rating.`,
            "Set a compatible voltage and verify every connected component against its datasheet.",
            null);
    });
    const schematicComponentsById = new Map(allComponents.map(({ component, sheet }) => [component.id, { component, sheet }]));
    const occupiedPins = new Map();
    robotics.functions.forEach((signal) => {
        if (!signal.requiresPin) return;
        const assignment = robotics.assignments[signal.id];
        if (!assignment) {
            addIssue("warning", "robotics-pin-compatibility", `${signal.name} has no GPIO assignment`,
                `The robotics connection plan requires a controller pin, but this signal has not been mapped yet.`,
                "Choose an unused compatible controller pin in the GPIO & signal map.",
                null);
            return;
        }
        const mapped = schematicComponentsById.get(assignment.componentId);
        const definition = mapped && getPcbPartDefinition(mapped.component.type);
        const pinName = definition?.pinNames[assignment.pinIndex];
        if (!mapped || !pinName) {
            addIssue("error", "robotics-pin-compatibility", `${signal.name} maps to a missing controller pin`,
                "The saved pin assignment no longer matches an existing controller component or pin.",
                "Reassign this signal to a pin on a controller currently in the schematic.",
                null);
            return;
        }
        const pinKey = `${assignment.componentId}:${assignment.pinIndex}`;
        if (occupiedPins.has(pinKey)) {
            addIssue("error", "robotics-pin-conflict", `Controller pin ${mapped.component.reference}.${pinName} is assigned twice`,
                `${signal.name} and ${occupiedPins.get(pinKey)} both use this pin in the robotics plan.`,
                "Assign each independent signal to a different GPIO, or explicitly share a bus signal in the schematic.",
                { area: "schematic", sheetId: mapped.sheet.id, componentId: mapped.component.id, pinIndex: assignment.pinIndex });
        } else occupiedPins.set(pinKey, signal.name);
        if (robotics.controllerType && mapped.component.type !== robotics.controllerType) {
            addIssue("warning", "robotics-component-compatibility", `${mapped.component.reference} differs from the template controller`,
                `This plan expects ${getPcbPartDefinition(robotics.controllerType)?.name || robotics.controllerType}, but ${signal.name} is assigned to ${getPcbPartDefinition(mapped.component.type)?.name || mapped.component.type}.`,
                "Verify pin capabilities and signal voltage for the selected controller, or use the matching template controller.",
                { area: "schematic", sheetId: mapped.sheet.id, componentId: mapped.component.id, pinIndex: assignment.pinIndex });
        }
        const gpioNumber = pinName.match(/GPIO(\d+)/i)?.[1];
        if (mapped.component.type === "esp32" && gpioNumber && Number(gpioNumber) >= 34 &&
            /pwm|output|trig|tx|direction/i.test(signal.name)) {
            addIssue("warning", "robotics-pin-compatibility", `${mapped.component.reference}.${pinName} is input-only`,
                `ESP32 GPIO${gpioNumber} is an input-only pin in this board's pin table, but ${signal.name} needs an output-capable pin.`,
                "Reassign the signal to an output-capable GPIO and verify board-specific pin restrictions.",
                { area: "schematic", sheetId: mapped.sheet.id, componentId: mapped.component.id, pinIndex: assignment.pinIndex });
        }
    });
    const controllerComponents = allComponents.filter(({ component }) =>
        ["arduinoUno", "esp32", "mcu"].includes(component.type));
    if (robotics.templateId === "ultrasonic-sensor" && controllerComponents.some(({ component }) => component.type === "esp32")) {
        const sensorInterface = allComponents.find(({ component }) => component.type === "ultrasonicConnector");
        addIssue("warning", "robotics-component-compatibility", "Check ultrasonic echo logic level",
            "The ultrasonic connector template specifies a 5 V sensor interface. An ESP32 GPIO is not a 5 V-tolerant input; direct Echo wiring may damage the controller.",
            "Use a correctly designed level shifter or divider and verify the exact sensor module's output level.",
            sensorInterface
                ? { area: "schematic", sheetId: sensorInterface.sheet.id, componentId: sensorInterface.component.id }
                : null);
    }

    if (issues.length === 0) {
        addIssue("suggestion", "checks-clear", "No issues detected by available checks",
            "The internal checks found no modeled connectivity, boundary, clearance, or specification issue in the current project data.",
            "Review the estimates and verify the design against component datasheets and your PCB manufacturer's rules.",
            null);
    }
    const severityOrder = { error: 0, warning: 1, suggestion: 2 };
    return issues.sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity]);
}

function renderPcbValidationPanel() {
    const panels = document.querySelectorAll(".pcb-validation-panel");
    panels.forEach((panel) => {
        const status = panel.querySelector("[data-pcb-validation-status]");
        const summary = panel.querySelector("[data-pcb-validation-summary]");
        const list = panel.querySelector("[data-pcb-validation-issues]");
        if (!pcbValidationIssues) {
            status.textContent = "Checks have not been run yet.";
            summary.hidden = true;
            list.replaceChildren();
            return;
        }
        const errors = pcbValidationIssues.filter((issue) => issue.severity === "error").length;
        const warnings = pcbValidationIssues.filter((issue) => issue.severity === "warning").length;
        const suggestions = pcbValidationIssues.filter((issue) => issue.severity === "suggestion").length;
        summary.hidden = false;
        summary.textContent = `${errors} errors · ${warnings} warnings · ${suggestions} suggestions`;
        status.textContent = pcbValidationDirty
            ? "Design changed since the last run. Results may be out of date."
            : errors
                ? "Validation found issues that need review."
                : warnings
                    ? "Checks completed with warnings."
                    : "No rule violations detected by the available checks.";
        list.replaceChildren();
        pcbValidationIssues.forEach((issue) => {
            const item = document.createElement("li");
            item.className = `pcb-validation-issue is-${issue.severity}`;
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.validationIssue = issue.id;
            button.textContent = `${issue.severity.toUpperCase()} · ${issue.title}`;
            const kind = document.createElement("small");
            kind.textContent = issue.domain === "ERC" ? "Electrical rule check (ERC)"
                : issue.domain === "DRC" ? "Design rule check (DRC)"
                    : issue.domain === "estimate" ? "Estimate"
                        : "Validation summary";
            const explanation = document.createElement("p");
            explanation.textContent = issue.explanation;
            const correction = document.createElement("p");
            correction.className = "pcb-validation-correction";
            correction.textContent = `Suggested correction: ${issue.correction}`;
            item.append(button, kind, explanation, correction);
            list.append(item);
        });
    });
}

function focusPcbValidationIssue(issueId) {
    const issue = pcbValidationIssues?.find((item) => item.id === issueId);
    if (!issue?.target) return;
    const target = issue.target;
    pcbValidationHighlight = target;
    if (target.area === "schematic") {
        const sheet = activePcbProject.schematic.sheets.find((item) => item.id === target.sheetId);
        if (sheet) activePcbProject.schematic.activeSheetId = sheet.id;
        selectedSchematicComponentIds.clear();
        if (target.componentId) selectedSchematicComponentIds.add(target.componentId);
        selectedSchematicPin = Number.isInteger(target.pinIndex)
            ? { componentId: target.componentId, pinIndex: target.pinIndex }
            : target.wireId ? { wireId: target.wireId } : null;
        setPcbWorkspaceMode("schematic");
        renderPcbSchematic();
        return;
    }
    if (target.area !== "layout") return;
    const layout = activePcbProject.layout;
    let footprint = layout.footprints.find((item) => item.id === target.footprintId);
    if (!footprint && target.componentId) {
        footprint = layout.footprints.find((item) => item.schematicId === target.componentId);
    }
    if (!footprint && target.sheetId && target.componentId) {
        const component = activePcbProject.schematic.sheets.find((sheet) => sheet.id === target.sheetId)
            ?.components.find((item) => item.id === target.componentId);
        if (component) footprint = layout.footprints.find((item) => item.reference === component.reference);
    }
    selectedPcbLayoutIds.clear();
    if (footprint) selectedPcbLayoutIds.add(footprint.id);
    selectedPcbLayoutTrackId = target.trackId || null;
    const track = layout.tracks.find((item) => item.id === target.trackId);
    if (track) {
        const layer = layout.layers.find((item) => item.id === track.layerId);
        if (layer) layer.visible = true;
    }
    setPcbWorkspaceMode("layout");
    renderPcbLayout();
}

function getRoboticsControllerPins(component) {
    const definition = getPcbPartDefinition(component.type);
    if (!definition) return [];
    return definition.pinNames.map((name, pinIndex) => ({ name, pinIndex }))
        .filter(({ name }) => /(?:GPIO\d+|D\d+|A\d+|TX\d*(?:\/GPIO\d+)?|RX\d*(?:\/GPIO\d+)?)/i.test(name));
}

function getRoboticsControllers(project) {
    return project.schematic.sheets.flatMap((sheet) => sheet.components)
        .filter((component) => ["arduinoUno", "esp32", "mcu"].includes(component.type));
}

function autoMapRoboticsPins(project) {
    const robotics = project.robotics;
    const controllers = getRoboticsControllers(project);
    const preferredController = controllers.find((component) => component.type === robotics.controllerType);
    const usedPins = new Set();
    Object.values(robotics.assignments).forEach((assignment) => {
        const controller = controllers.find((component) => component.id === assignment.componentId);
        if (controller && getRoboticsControllerPins(controller).some((pin) => pin.pinIndex === assignment.pinIndex)) {
            usedPins.add(`${assignment.componentId}:${assignment.pinIndex}`);
        }
    });
    robotics.functions.forEach((signal) => {
        if (!signal.requiresPin) return;
        const existing = robotics.assignments[signal.id];
        const existingController = existing && controllers.find((component) => component.id === existing.componentId);
        const existingPin = existingController && getRoboticsControllerPins(existingController)
            .find((pin) => pin.pinIndex === existing.pinIndex);
        if (existingPin) return;
        delete robotics.assignments[signal.id];
        const candidates = [
            ...(preferredController ? [preferredController] : []),
            ...controllers.filter((component) => component !== preferredController)
        ].flatMap((controller) => getRoboticsControllerPins(controller).map((pin) => ({ controller, ...pin })));
        const chosen = signal.preferredPins
            .flatMap((preferred) => candidates.filter((candidate) =>
                candidate.controller.type === robotics.controllerType &&
                candidate.name.toUpperCase() === preferred.toUpperCase()))
            .find((candidate) => !usedPins.has(`${candidate.controller.id}:${candidate.pinIndex}`)) ||
            candidates.find((candidate) => !usedPins.has(`${candidate.controller.id}:${candidate.pinIndex}`));
        if (!chosen) return;
        const key = `${chosen.controller.id}:${chosen.pinIndex}`;
        usedPins.add(key);
        robotics.assignments[signal.id] = { componentId: chosen.controller.id, pinIndex: chosen.pinIndex };
    });
}

function renderPcbRoboticsPlanner() {
    const panel = document.querySelector(".pcb-robotics-panel");
    const project = activePcbProject;
    if (!panel || !project) return;
    project.robotics = normalizePcbRobotics(project.robotics);
    const robotics = project.robotics;
    const templateSelect = panel.querySelector("[data-robotics-template]");
    templateSelect.replaceChildren(...pcbRoboticsTemplates.map((template) =>
        new Option(template.name, template.id)));
    templateSelect.value = robotics.templateId;
    const template = getPcbRoboticsTemplate(robotics.templateId);
    const description = panel.querySelector("[data-robotics-description]");
    description.textContent = robotics.source === "simulator" && robotics.sourceRobot
        ? `Architecture from ${robotics.sourceRobot.name}. Validate imported pin and voltage requirements before routing.`
        : template.id === "custom"
            ? "Build a custom robotics board by adding signals and planning its controller pins and voltage rails."
            : `${template.name} · recommended parts: ${robotics.requiredParts.map((type) =>
                getPcbPartDefinition(type)?.name || type).join(", ") || "none"}.`;
    const status = panel.querySelector("[data-robotics-status]");
    if (!status.dataset.userMessage) {
        status.textContent = robotics.source === "simulator"
            ? `Simulator source${robotics.sourceRobot?.id ? ` · ${robotics.sourceRobot.id}` : ""} · review imported mappings.`
            : "GPIO assignments are planning metadata. Add schematic wires separately.";
    }

    const recommended = panel.querySelector("[data-robotics-recommended]");
    const addedTypes = new Set(project.schematic.sheets.flatMap((sheet) => sheet.components.map((component) => component.type)));
    const pendingParts = robotics.requiredParts.filter((type) => !addedTypes.has(type));
    recommended.textContent = robotics.requiredParts.length
        ? `${pendingParts.length ? `Not in schematic: ${pendingParts.map((type) => getPcbPartDefinition(type)?.name || type).join(", ")}` : "Recommended parts are in the schematic."}`
        : "No preset parts. Add components from the library or create your own signal plan.";
    panel.querySelector("[data-robotics-add-parts]").disabled = pendingParts.length === 0;

    const controllers = getRoboticsControllers(project);
    const assignments = robotics.assignments;
    const controllerById = new Map(controllers.map((controller) => [controller.id, controller]));
    const used = new Map();
    Object.entries(assignments).forEach(([functionId, assignment]) => {
        const component = controllerById.get(assignment.componentId);
        const pin = component && getRoboticsControllerPins(component).find((item) => item.pinIndex === assignment.pinIndex);
        if (pin) used.set(`${assignment.componentId}:${assignment.pinIndex}`, functionId);
    });
    const pinMap = panel.querySelector("[data-robotics-pin-map]");
    pinMap.replaceChildren();
    if (!controllers.length) {
        const empty = document.createElement("p");
        empty.className = "pcb-field-note";
        empty.textContent = "Add a controller board from the component library or use Add recommended parts to enable GPIO mapping.";
        pinMap.append(empty);
    } else {
        controllers.forEach((controller) => {
            const wrapper = document.createElement("div");
            wrapper.className = "pcb-robotics-controller-map";
            const heading = document.createElement("strong");
            heading.textContent = `${controller.reference} · ${getPcbPartDefinition(controller.type).name}`;
            const chips = document.createElement("div");
            chips.className = "pcb-robotics-pin-visual";
            getRoboticsControllerPins(controller).forEach(({ name, pinIndex }) => {
                const chip = document.createElement("span");
                chip.className = "pcb-robotics-pin-chip";
                chip.classList.toggle("is-assigned", used.has(`${controller.id}:${pinIndex}`));
                chip.textContent = name;
                chip.title = used.has(`${controller.id}:${pinIndex}`)
                    ? `${name} · ${robotics.functions.find((item) => item.id === used.get(`${controller.id}:${pinIndex}`))?.name || "Assigned"}`
                    : `${name} · available`;
                chips.append(chip);
            });
            wrapper.append(heading, chips);
            pinMap.append(wrapper);
        });
    }

    const connectionList = panel.querySelector("[data-robotics-connections]");
    connectionList.replaceChildren();
    robotics.functions.forEach((signal) => {
        const row = document.createElement("div");
        row.className = "pcb-robotics-connection";
        const label = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = signal.name;
        const group = document.createElement("small");
        group.textContent = signal.group;
        label.append(title, group);
        row.append(label);
        if (signal.requiresPin) {
            const select = document.createElement("select");
            select.setAttribute("aria-label", `${signal.name} controller pin`);
            select.dataset.roboticsSignal = signal.id;
            select.append(new Option("Unassigned", ""));
            controllers.forEach((controller) => {
                const groupOption = document.createElement("optgroup");
                groupOption.label = `${controller.reference} · ${getPcbPartDefinition(controller.type).name}`;
                getRoboticsControllerPins(controller).forEach(({ name, pinIndex }) => {
                    groupOption.append(new Option(name, `${controller.id}|${pinIndex}`));
                });
                select.append(groupOption);
            });
            const assignment = assignments[signal.id];
            if (assignment) select.value = `${assignment.componentId}|${assignment.pinIndex}`;
            row.append(select);
        } else {
            const planningTag = document.createElement("small");
            planningTag.textContent = "Power / connector assignment";
            row.append(planningTag);
        }
        connectionList.append(row);
    });

    const rails = panel.querySelector("[data-robotics-rails]");
    rails.replaceChildren();
    robotics.rails.forEach((rail) => {
        const row = document.createElement("label");
        row.className = "pcb-robotics-rail";
        const name = document.createElement("span");
        name.textContent = rail.name;
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "60";
        input.step = "0.1";
        input.value = String(rail.voltage);
        input.dataset.roboticsRail = rail.id;
        input.setAttribute("aria-label", `${rail.name} voltage in volts`);
        const range = document.createElement("small");
        range.textContent = `Template range ${rail.minimum}–${rail.maximum} V`;
        row.append(name, input, range);
        rails.append(row);
    });
}

function addRoboticsRecommendedParts() {
    const project = activePcbProject;
    const sheet = activePcbSchematic();
    if (!project || !sheet) return;
    const existing = new Set(project.schematic.sheets.flatMap((item) => item.components.map((component) => component.type)));
    const missing = project.robotics.requiredParts.filter((type) => !existing.has(type) && getPcbPartDefinition(type));
    if (!missing.length) {
        document.querySelector("[data-robotics-status]").textContent = "All recommended parts are already in the schematic.";
        return;
    }
    if (sheet.components.length + missing.length > 100) {
        document.querySelector("[data-robotics-status]").textContent = "This schematic supports up to 100 components per sheet; remove parts before adding this template.";
        return;
    }
    recordPcbHistory();
    const usedReferences = project.schematic.sheets.flatMap((item) => item.components)
        .map((component) => component.reference);
    const center = snapSchematicPoint({
        x: project.schematic.view.panX,
        y: project.schematic.view.panY
    });
    missing.forEach((type, index) => {
        const definition = getPcbPartDefinition(type);
        const usedNumbers = usedReferences.filter((reference) => reference.startsWith(definition.prefix))
            .map((reference) => Number(reference.slice(definition.prefix.length)) || 0);
        const reference = `${definition.prefix}${Math.max(0, ...usedNumbers) + 1}`;
        usedReferences.push(reference);
        const position = sheet.components.length + index;
        sheet.components.push({
            id: `schematic-${project.schematic.nextComponentId++}`,
            type,
            reference,
            value: type === "power" ? "5V" : type === "ground" ? "GND" :
                definition.electrical.resistance || definition.electrical.capacitance || definition.name,
            x: center.x + ((position % 3) - 1) * 200,
            y: center.y + Math.floor(position / 3) * 160,
            rotation: 0
        });
    });
    autoMapRoboticsPins(project);
    document.querySelector("[data-robotics-status]").textContent =
        `${missing.length} recommended component(s) added to ${sheet.name}. Signal plans remain separate from schematic wiring.`;
    document.querySelector("[data-robotics-status]").dataset.userMessage = "true";
    renderPcbSchematic();
    renderPcbRoboticsPlanner();
    schedulePcbSave();
}

function createRoboticsHandoff(project) {
    const robotics = normalizePcbRobotics(project.robotics);
    const controllers = getRoboticsControllers(project);
    const resolvedSignals = robotics.functions.map((signal) => {
        const assignment = robotics.assignments[signal.id];
        const controller = assignment && controllers.find((item) => item.id === assignment.componentId);
        const definition = controller && getPcbPartDefinition(controller.type);
        return {
            id: signal.id,
            name: signal.name,
            group: signal.group,
            requiresPin: signal.requiresPin,
            controllerReference: controller?.reference || null,
            pinNumber: definition && assignment ? assignment.pinIndex + 1 : null,
            pinName: definition && assignment ? definition.pinNames[assignment.pinIndex] || null : null
        };
    });
    return {
        schema: "aqua.robotics-electronics",
        version: 1,
        project: { id: project.id, name: project.name },
        sourceRobot: robotics.sourceRobot,
        template: { id: robotics.templateId, name: getPcbRoboticsTemplate(robotics.templateId).name },
        controllerType: robotics.controllerType || null,
        signals: resolvedSignals,
        rails: robotics.rails.map((rail) => ({
            id: rail.id, name: rail.name, voltage: rail.voltage, minimum: rail.minimum, maximum: rail.maximum
        })),
        recommendedParts: robotics.requiredParts,
        schematicComponents: project.schematic.sheets.flatMap((sheet) => sheet.components.map((component) => ({
            sheet: sheet.name, reference: component.reference, type: component.type, value: component.value
        }))),
        nets: getProjectPcbNets(),
        pcb: {
            boardWidth: project.width,
            boardHeight: project.height,
            footprints: project.layout.footprints.length,
            tracks: project.layout.tracks.length,
            vias: project.layout.vias.length
        },
        simulatorBridge: { schema: "aqua.robotics-electronics", version: 1, transferState: "ready-for-simulator-import" }
    };
}

function renderPcbLayout() {
    if (!activePcbProject) return;
    const layout = activePcbProject.layout;
    const connectivity = getPcbConnectivityAnalysis(layout);
    const stage = document.querySelector("[data-layout-stage]");
    const workspace = document.querySelector("[data-pcb-layout]");
    const svg = document.querySelector("[data-layout-svg]");
    const widthPx = Math.max(100, stage.clientWidth);
    const heightPx = Math.max(100, stage.clientHeight);
    const scale = Math.min(widthPx / (activePcbProject.width + 12), heightPx / (activePcbProject.height + 12)) * layout.zoom;
    const viewWidth = widthPx / scale;
    const viewHeight = heightPx / scale;
    svg.setAttribute("viewBox", `${layout.panX - viewWidth / 2} ${layout.panY - viewHeight / 2} ${viewWidth} ${viewHeight}`);
    const renderer = document.querySelector("[data-layout-render]");
    renderer.replaceChildren();
    renderer.dataset.highlightNet = document.querySelector("[data-layout-active-net]").value;
    workspace.dataset.performanceMode = String(layout.performanceMode);
    const performanceButton = document.querySelector("[data-layout-performance]");
    performanceButton.setAttribute("aria-pressed", String(layout.performanceMode));
    performanceButton.title = layout.performanceMode
        ? "Turn off reduced rendering for low-end devices"
        : "Reduce visual effects for low-end devices";
    const layerVisible = (id) => layout.layers.some((layer) => layer.id === id && layer.visible);
    const outlineLayer = layout.layers.find((layer) => layer.type === "outline");
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    outline.setAttribute("d", pcbOutlinePath(layout.outline));
    outline.setAttribute("class", "pcb-layout-board");
    outline.dataset.layoutOutline = "";
    if (pcbValidationHighlight?.area === "layout" && pcbValidationHighlight.targetType === "outline") {
        outline.classList.add("is-validation-target");
    }
    outline.style.display = outlineLayer?.visible === false ? "none" : "";
    renderer.append(outline);
    if (!layout.performanceMode) {
        const grid = document.createElementNS("http://www.w3.org/2000/svg", "path");
        grid.setAttribute("d", pcbOutlinePath(layout.outline));
        grid.setAttribute("class", "pcb-layout-grid");
        grid.style.display = layerVisible("top-copper") || layerVisible("bottom-copper") ? "" : "none";
        grid.setAttribute("fill", "url(#pcb-layout-grid)");
        svg.querySelector("#pcb-layout-grid").setAttribute("width", String(layout.grid));
        svg.querySelector("#pcb-layout-grid").setAttribute("height", String(layout.grid));
        svg.querySelector("#pcb-layout-grid circle").setAttribute("cx", String(layout.grid / 2));
        svg.querySelector("#pcb-layout-grid circle").setAttribute("cy", String(layout.grid / 2));
        renderer.append(grid);
    }
    const zones = layout.zones.filter((zone) => layerVisible(zone.layerId)).map((zone) => {
        const validationClass = pcbValidationHighlight?.area === "layout" && pcbValidationHighlight.zoneId === zone.id
            ? " is-validation-target"
            : "";
        const path = `<path class="pcb-layout-zone${validationClass}" data-layout-zone="${escapePcbMarkup(zone.id)}" data-net-id="${escapePcbMarkup(zone.netId)}" d="${pcbOutlinePath(zone.points)}"/>`;
        return path;
    }).join("");
    const zoneHolder = document.createElementNS("http://www.w3.org/2000/svg", "g");
    zoneHolder.innerHTML = zones;
    renderer.append(zoneHolder);
    layout.tracks.filter((track) => layerVisible(track.layerId)).forEach((track) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("pcb-layout-track");
        if (selectedPcbLayoutTrackId === track.id) path.classList.add("is-selected");
        if (pcbValidationHighlight?.area === "layout" && pcbValidationHighlight.trackId === track.id) {
            path.classList.add("is-validation-target");
        }
        if (renderer.dataset.highlightNet) {
            path.classList.add(track.netId === renderer.dataset.highlightNet ? "is-highlighted-net" : "is-muted-net");
        }
        path.dataset.layoutTrack = track.id;
        path.dataset.netId = track.netId;
        path.style.strokeWidth = String(track.width);
        path.setAttribute("d", track.points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "));
        renderer.append(path);
    });
    layout.vias.filter((via) => via.layers.some(layerVisible)).forEach((via) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.classList.add("pcb-layout-via");
        if (pcbValidationHighlight?.area === "layout" && pcbValidationHighlight.viaId === via.id) {
            group.classList.add("is-validation-target");
        }
        group.dataset.layoutVia = via.id;
        group.dataset.netId = via.netId;
        group.innerHTML = `<circle cx="${via.x}" cy="${via.y}" r="${via.diameter / 2}"/><circle class="pcb-layout-via-drill" cx="${via.x}" cy="${via.y}" r="${Math.max(0.18, via.diameter * 0.22)}"/>`;
        renderer.append(group);
    });
    layout.footprints.forEach((footprint) => {
        const definition = getPcbPartDefinition(footprint.type);
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.classList.add("pcb-layout-footprint");
        if (selectedPcbLayoutIds.has(footprint.id)) group.classList.add("is-selected");
        if (pcbValidationHighlight?.area === "layout" && pcbValidationHighlight.footprintId === footprint.id) {
            group.classList.add("is-validation-target");
        }
        if (renderer.dataset.highlightNet && !footprint.pads.some((pad) => pad.netId === renderer.dataset.highlightNet)) {
            group.classList.add("is-muted-net");
        }
        group.dataset.layoutFootprint = footprint.id;
        group.setAttribute("transform", `translate(${footprint.x} ${footprint.y}) rotate(${footprint.rotation})`);
        const smd = definition.footprint.type.toLowerCase().includes("smd");
        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        body.classList.add("pcb-layout-footprint-body");
        if (definition.boardModel) body.classList.add("is-module");
        body.setAttribute("x", String(-definition.width / 2));
        body.setAttribute("y", String(-definition.height / 2));
        body.setAttribute("width", String(definition.width));
        body.setAttribute("height", String(definition.height));
        group.append(body);
        if (definition.boardModel) {
            const artwork = document.createElementNS("http://www.w3.org/2000/svg", "g");
            artwork.classList.add("pcb-layout-module-art");
            artwork.innerHTML = renderPcbBoardArtwork(definition.boardModel, footprint.reference);
            group.append(artwork);
        }
        footprint.pads.forEach((pad) => {
            const localX = pad.offset.x;
            const localY = pad.offset.y;
            const padGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            padGroup.classList.add("pcb-layout-pad", pad.kind === "smd" ? "is-smd" : "is-through-hole");
            const padState = connectivity.padStates.get(pcbLayoutPadKey({ footprintId: footprint.id, number: pad.number })) || "unassigned";
            padGroup.classList.add(`is-${padState}`);
            if (pcbValidationHighlight?.area === "layout" &&
                pcbValidationHighlight.footprintId === footprint.id &&
                pcbValidationHighlight.padNumber === pad.number) {
                padGroup.classList.add("is-validation-target");
            }
            if (renderer.dataset.highlightNet) {
                padGroup.classList.add(pad.netId === renderer.dataset.highlightNet ? "is-highlighted-net" : "is-muted-net");
            }
            padGroup.dataset.layoutPad = "";
            padGroup.dataset.footprintId = footprint.id;
            padGroup.dataset.padNumber = String(pad.number);
            padGroup.dataset.netId = pad.netId || "";
            padGroup.setAttribute("aria-label", `${footprint.reference} pin ${pad.number}: ${pad.name}`);
            padGroup.innerHTML = `<title>${escapePcbMarkup(`${footprint.reference} · pin ${pad.number} · ${pad.name}`)}</title><rect x="${localX - (smd ? 0.8 : 0.9)}" y="${localY - (smd ? 0.45 : 0.9)}" width="${smd ? 1.6 : 1.8}" height="${smd ? 0.9 : 1.8}" rx="${smd ? 0.12 : 0.9}"/>${smd ? "" : `<circle class="pcb-layout-pad-drill" cx="${localX}" cy="${localY}" r="0.4"/>`}<text x="${localX}" y="${localY + 0.25}" text-anchor="middle">${pad.number}</text>`;
            group.append(padGroup);
        });
        const reference = document.createElementNS("http://www.w3.org/2000/svg", "text");
        reference.classList.add("pcb-layout-reference");
        reference.setAttribute("text-anchor", "middle");
        reference.setAttribute("y", String(-definition.height / 2 - 1.2));
        reference.textContent = footprint.reference;
        if (!layerVisible("top-silkscreen")) reference.style.display = "none";
        group.append(reference);
        const value = document.createElementNS("http://www.w3.org/2000/svg", "text");
        value.classList.add("pcb-layout-value");
        value.setAttribute("text-anchor", "middle");
        value.setAttribute("y", String(definition.height / 2 + 2.4));
        value.textContent = footprint.value;
        if (!layerVisible("top-silkscreen")) value.style.display = "none";
        group.append(value);
        renderer.append(group);
    });
    layout.measurements.forEach((measurement) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.classList.add("pcb-layout-measure");
        const distance = Math.hypot(measurement.end.x - measurement.start.x, measurement.end.y - measurement.start.y);
        group.innerHTML = `<path d="M ${measurement.start.x} ${measurement.start.y} L ${measurement.end.x} ${measurement.end.y}"/><text x="${(measurement.start.x + measurement.end.x) / 2}" y="${(measurement.start.y + measurement.end.y) / 2 - 1}">${distance.toFixed(2)} mm</text>`;
        renderer.append(group);
    });
    const interaction = document.querySelector("[data-layout-interaction]");
    interaction.replaceChildren();
    pcbRouteSuggestions.forEach((suggestion, index) => {
        if (suggestion.route.layerId !== layout.activeLayerId) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("pcb-layout-route-suggestion");
        path.dataset.suggestionIndex = String(index);
        path.setAttribute("d", suggestion.route.points.map((point, pointIndex) =>
            `${pointIndex ? "L" : "M"} ${point.x} ${point.y}`).join(" "));
        interaction.append(path);
    });
    const selectedTrack = layout.tracks.find((track) => track.id === selectedPcbLayoutTrackId);
    if (selectedTrack) selectedTrack.points.forEach((point, index) => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handle.classList.add("pcb-layout-track-handle");
        handle.dataset.layoutTrackHandle = selectedTrack.id;
        handle.dataset.trackPointIndex = String(index);
        handle.setAttribute("cx", String(point.x));
        handle.setAttribute("cy", String(point.y));
        handle.setAttribute("r", "0.85");
        interaction.append(handle);
    });
    if (pcbLayoutDraft?.cursor) {
        const draft = pcbLayoutDraft;
        const nearestPad = draft.type === "track" ? findNearestLayoutPad(draft.cursor, layout) : null;
        const nearestFootprint = nearestPad && layout.footprints.find((item) => item.id === nearestPad.footprintId);
        const snappedCursor = nearestFootprint && nearestPad
            ? getLayoutPadPosition(nearestFootprint, nearestFootprint.pads.find((item) => item.number === nearestPad.number))
            : layoutSnapPoint(draft.cursor);
        const cursor = snappedCursor;
        const points = draft.type === "track"
            ? [...draft.points, cursor]
            : draft.type === "outline" || draft.type === "zone"
                ? [draft.start, { x: cursor.x, y: draft.start.y }, cursor, { x: draft.start.x, y: cursor.y }]
                : [draft.start, cursor];
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("pcb-layout-draft");
        if (draft.type === "track" && getPcbLayoutClearanceConflicts(layout, {
            id: "",
            netId: draft.netId,
            layerId: layout.activeLayerId,
            width: layout.trackWidth,
            points: [...draft.points, cursor]
        }).length) path.classList.add("has-clearance-conflict");
        path.setAttribute("d", draft.type === "outline" || draft.type === "zone"
            ? pcbOutlinePath(points)
            : points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "));
        interaction.append(path);
    }
    const layerSelect = document.querySelector("[data-layout-active-layer]");
    const oldLayer = layout.activeLayerId;
    layerSelect.replaceChildren(...layout.layers.filter((layer) => layer.type === "copper")
        .map((layer) => new Option(layer.name, layer.id)));
    if (layout.layers.some((layer) => layer.id === oldLayer && layer.type === "copper")) layerSelect.value = oldLayer;
    const netSelect = document.querySelector("[data-layout-active-net]");
    const oldNet = netSelect.value;
    netSelect.replaceChildren(new Option("Unassigned", ""), ...layout.nets.map((net) => new Option(net.name, net.id)));
    if (layout.nets.some((net) => net.id === oldNet)) netSelect.value = oldNet;
    document.querySelector("[data-layout-track-width]").value = String(layout.trackWidth);
    document.querySelector("[data-layout-grid]").value = String(layout.grid);
    document.querySelector("[data-layout-zoom-label]").textContent = `${Math.round(layout.zoom * 100)}%`;
    document.querySelector("[data-layout-grid-status]").textContent = `${layout.grid} mm`;
    document.querySelector("[data-layout-empty]").hidden = layout.footprints.length > 0;
    document.querySelector("[data-layout-summary]").textContent =
        `${layout.footprints.length} footprints · ${layout.tracks.length} tracks · ${layout.vias.length} vias · ${connectivity.unroutedPads} airwires`;
    document.querySelectorAll("[data-layout-tool]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.layoutTool === layout.activeTool));
    });
    renderPcbLayoutLayers();
    renderPcbLayoutInspector();
    stage.dataset.tool = layout.activeTool;
}

function renderPcbLayoutLayers() {
    const list = document.querySelector("[data-layout-layer-list]");
    const layout = activePcbProject?.layout;
    if (!layout) return;
    list.replaceChildren();
    layout.layers.forEach((layer) => {
        const label = document.createElement("label");
        label.className = "pcb-layout-layer";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = layer.visible;
        checkbox.dataset.layoutLayerVisible = layer.id;
        const name = document.createElement("span");
        name.textContent = layer.name;
        label.append(checkbox, name);
        if (layer.type === "copper") {
            const side = document.createElement("small");
            side.textContent = layer.side === "inner" ? "INNER" : layer.side.toUpperCase();
            label.append(side);
        }
        list.append(label);
    });
}

function renderPcbLayoutInspector() {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    const selection = document.querySelector("[data-layout-selection]");
    const selected = layout.footprints.filter((item) => selectedPcbLayoutIds.has(item.id));
    selection.hidden = selected.length === 0;
    const selectedTrack = layout.tracks.find((track) => track.id === selectedPcbLayoutTrackId);
    const trackInspector = document.querySelector("[data-layout-track-inspector]");
    trackInspector.hidden = !selectedTrack;
    if (selectedTrack) {
        const netName = layout.nets.find((net) => net.id === selectedTrack.netId)?.name || "Net";
        const layerName = layout.layers.find((layer) => layer.id === selectedTrack.layerId)?.name || "Copper";
        document.querySelector("[data-layout-track-name]").textContent = `${netName} · ${layerName}`;
        document.querySelector("[data-layout-selected-track-width]").value = String(selectedTrack.width);
        const layerSelect = document.querySelector("[data-layout-selected-track-layer]");
        layerSelect.replaceChildren(...layout.layers.filter((layer) => layer.type === "copper")
            .map((layer) => new Option(layer.name, layer.id)));
        layerSelect.value = selectedTrack.layerId;
    }
    document.querySelector("[data-layout-rotate]").disabled = selected.length !== 1;
    if (selected.length === 1) {
        const footprint = selected[0];
        document.querySelector("[data-layout-selected-name]").textContent = getPcbPartDefinition(footprint.type).name;
        document.querySelector("[data-layout-selected-reference]").textContent = footprint.reference;
        document.querySelector("[data-layout-selected-pads]").textContent =
            footprint.pads.map((pad) => `${pad.number} ${pad.name}${pad.netId ? ` · ${layout.nets.find((net) => net.id === pad.netId)?.name || "net"}` : ""}`).join(" · ");
    }
    document.querySelector("[data-layout-net-summary]").textContent = layout.nets.length
        ? layout.nets.map((net) => `${net.name} (${net.nodes.length} pads)`).join(" · ")
        : "No schematic nets are synchronized.";
    const connectivity = getPcbConnectivityAnalysis(layout);
    const assignedPads = [...connectivity.netPadEntries.values()].reduce((sum, pads) => sum + pads.length, 0);
    const connectedPads = [...connectivity.padStates.values()].filter((state) => state === "connected").length;
    const conflicts = connectivity.clearanceConflicts.length;
    document.querySelector("[data-layout-connectivity]").textContent =
        `${connectedPads}/${assignedPads} pads connected · ${connectivity.unroutedPads} airwires · ` +
        `${connectivity.unassignedPins} unassigned pins · ${conflicts} clearance warnings.`;
    const suggestionList = document.querySelector("[data-layout-suggestions]");
    suggestionList.replaceChildren();
    pcbRouteSuggestions.forEach((suggestion, index) => {
        const item = document.createElement("li");
        const description = document.createElement("span");
        const start = layout.footprints.find((footprint) => footprint.id === suggestion.startPad.footprintId);
        const end = layout.footprints.find((footprint) => footprint.id === suggestion.endPad.footprintId);
        description.textContent = `${suggestion.netName}: ${start?.reference || "?"}.${suggestion.startPad.number} → ${end?.reference || "?"}.${suggestion.endPad.number}` +
            (suggestion.conflicts.length ? ` · ${suggestion.conflicts.length} clearance warning(s)` : "");
        const routeButton = document.createElement("button");
        routeButton.type = "button";
        routeButton.dataset.layoutUseSuggestion = String(index);
        routeButton.textContent = suggestion.conflicts.length ? "Review" : "Route";
        routeButton.disabled = suggestion.conflicts.length > 0;
        item.append(description, routeButton);
        suggestionList.append(item);
    });
    document.querySelector("[data-layout-add-layer]").disabled =
        layout.layers.filter((layer) => layer.type === "copper" && layer.side === "inner").length >= 6;
}

function findLayoutNetIdForPad(pad) {
    const footprint = activePcbProject?.layout.footprints.find((item) => item.id === pad.footprintId);
    return footprint?.pads.find((item) => item.number === pad.number)?.netId || null;
}

function completePcbLayoutTrack(endPad) {
    const layout = activePcbProject?.layout;
    if (!layout || pcbLayoutDraft?.type !== "track") return;
    const draft = pcbLayoutDraft;
    const startNet = findLayoutNetIdForPad(draft.startPad);
    const endNet = findLayoutNetIdForPad(endPad);
    const netId = draft.netId || startNet || endNet;
    if (!netId || startNet !== netId || endNet !== netId) {
        document.querySelector("[data-layout-status]").textContent = "Track endpoints must belong to the same synchronized schematic net.";
        return;
    }
    if (draft.startPad.footprintId === endPad.footprintId && draft.startPad.number === endPad.number) return;
    const startFootprint = layout.footprints.find((item) => item.id === draft.startPad.footprintId);
    const endFootprint = layout.footprints.find((item) => item.id === endPad.footprintId);
    const start = startFootprint && getLayoutPadPosition(startFootprint,
        startFootprint.pads.find((pad) => pad.number === draft.startPad.number));
    const end = endFootprint && getLayoutPadPosition(endFootprint,
        endFootprint.pads.find((pad) => pad.number === endPad.number));
    if (!start || !end) return;
    const route = {
        id: "",
        netId,
        layerId: layout.activeLayerId,
        width: layout.trackWidth,
        points: [start, ...draft.waypoints, end]
    };
    const conflicts = getPcbLayoutClearanceConflicts(layout, route);
    if (conflicts.length) {
        document.querySelector("[data-layout-status]").textContent =
            `Route blocked by ${conflicts.length} clearance conflict(s): ${conflicts.slice(0, 3).join(", ")}.`;
        return;
    }
    recordPcbHistory();
    layout.tracks.push({
        id: `track-${layout.nextTrackId++}`,
        netId,
        layerId: layout.activeLayerId,
        width: layout.trackWidth,
        points: [start, ...draft.waypoints, end],
        startPad: { footprintId: draft.startPad.footprintId, number: draft.startPad.number },
        endPad: { footprintId: endPad.footprintId, number: endPad.number }
    });
    pcbLayoutDraft = null;
    schedulePcbSave();
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = `Routed ${layout.nets.find((net) => net.id === netId)?.name || "net"} on ${layout.layers.find((layer) => layer.id === layout.activeLayerId)?.name}.`;
}

function addPcbLayoutFootprint(type) {
    const layout = activePcbProject?.layout;
    const definition = getPcbPartDefinition(type);
    if (!layout || !definition) return;
    if (layout.footprints.length >= 200) {
        document.querySelector("[data-layout-status]").textContent = "The layout supports up to 200 footprints.";
        return;
    }
    const used = layout.footprints.filter((item) => item.reference.startsWith(definition.prefix))
        .map((item) => Number(item.reference.slice(definition.prefix.length)) || 0);
    const reference = `${definition.prefix}${Math.max(0, ...used) + 1}`;
    const position = layoutSnapPoint(definition.boardModel
        ? { x: activePcbProject.width / 2, y: activePcbProject.height / 2 }
        : {
            x: Math.min(activePcbProject.width - 6, 8 + (layout.footprints.length % 4) * 14),
            y: Math.min(activePcbProject.height - 6, 8 + Math.floor(layout.footprints.length / 4) * 12)
        });
    const footprint = createPcbLayoutFootprint(type, reference,
        definition.electrical.resistance || definition.electrical.capacitance || definition.name,
        position.x, position.y);
    if (!footprint) return;
    recordPcbHistory();
    layout.footprints.push(footprint);
    selectedPcbLayoutIds = new Set([footprint.id]);
    selectedPcbLayoutTrackId = null;
    schedulePcbSave();
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = `${definition.name} ${reference} added to layout.`;
}

function createPcbSchematicSheet(name) {
    return {
        id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        components: [],
        wires: [],
        labels: []
    };
}

function createPcbSchematic() {
    const firstSheet = createPcbSchematicSheet("Sheet 1");
    return {
        activeSheetId: firstSheet.id,
        sheets: [firstSheet],
        view: { zoom: 1, panX: 0, panY: 0 },
        nextComponentId: 1,
        nextWireId: 1,
        nextLabelId: 1
    };
}

function normalizePcbSchematicSheet(sheet) {
    if (!sheet || typeof sheet !== "object") return createPcbSchematicSheet("Sheet");
    const components = Array.isArray(sheet.components) ? sheet.components.filter((component) =>
        component && typeof component.id === "string" && Boolean(getPcbPartDefinition(component.type)) &&
        Number.isFinite(component.x) && Number.isFinite(component.y) &&
        Number.isFinite(component.rotation) && typeof component.reference === "string"
    ).map((component) => ({
        id: component.id,
        type: component.type,
        reference: component.reference,
        value: String(component.value || ""),
        x: component.x,
        y: component.y,
        rotation: ((component.rotation % 360) + 360) % 360
    })) : [];
    const componentById = new Map(components.map((component) => [component.id, component]));
    const hasValidPin = (componentId, pinIndex) => {
        const component = componentById.get(componentId);
        const definition = component && getPcbPartDefinition(component.type);
        return Boolean(definition && Number.isInteger(pinIndex) && pinIndex >= 0 && pinIndex < definition.pins);
    };
    const wires = Array.isArray(sheet.wires) ? sheet.wires.filter((wire) =>
        wire && typeof wire.id === "string" &&
        wire.start && wire.end &&
        hasValidPin(wire.start.componentId, wire.start.pinIndex) && hasValidPin(wire.end.componentId, wire.end.pinIndex) &&
        Array.isArray(wire.waypoints) &&
        wire.waypoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    ).map((wire) => ({
        id: wire.id,
        start: { componentId: wire.start.componentId, pinIndex: wire.start.pinIndex },
        end: { componentId: wire.end.componentId, pinIndex: wire.end.pinIndex },
        waypoints: wire.waypoints.slice(0, 100).map((point) => ({ x: point.x, y: point.y }))
    })) : [];
    const labels = Array.isArray(sheet.labels) ? sheet.labels.filter((label) =>
        label && typeof label.id === "string" && typeof label.name === "string" &&
        Number.isFinite(label.x) && Number.isFinite(label.y) &&
        (!label.pin || hasValidPin(label.pin.componentId, label.pin.pinIndex))
    ).map((label) => ({
        id: label.id,
        name: label.name.trim().slice(0, 32),
        x: label.x,
        y: label.y,
        pin: label.pin ? { componentId: label.pin.componentId, pinIndex: label.pin.pinIndex } : null,
        kind: ["ground", "power"].includes(label.kind) ? label.kind : "net"
    })) : [];
    return {
        id: typeof sheet.id === "string" ? sheet.id : createPcbSchematicSheet("Sheet").id,
        name: String(sheet.name || "Sheet").slice(0, 40),
        components,
        wires,
        labels
    };
}

function activePcbSchematic() {
    const schematic = activePcbProject?.schematic;
    return schematic?.sheets.find((sheet) => sheet.id === schematic.activeSheetId) || null;
}

function getSchematicPinPosition(component, pinIndex) {
    const definition = getPcbPartDefinition(component.type);
    if (!definition || pinIndex < 0 || pinIndex >= definition.pins) return null;
    const leftCount = Math.ceil(definition.pins / 2);
    const side = pinIndex < leftCount ? -1 : 1;
    const sideIndex = pinIndex < leftCount ? pinIndex : pinIndex - leftCount;
    const sideCount = side < 0 ? leftCount : definition.pins - leftCount;
    let localX = side * 72;
    let localY = (sideIndex - (sideCount - 1) / 2) * 20;
    if (definition.pins === 1) {
        localX = 0;
        localY = 48;
    }
    const angle = component.rotation * Math.PI / 180;
    return {
        x: component.x + localX * Math.cos(angle) - localY * Math.sin(angle),
        y: component.y + localX * Math.sin(angle) + localY * Math.cos(angle)
    };
}

function getSchematicSvgPoint(event) {
    const svg = document.querySelector("[data-schematic-svg]");
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const world = point.matrixTransform(matrix.inverse());
    return { x: world.x, y: world.y };
}

function snapSchematicPoint(point) {
    return { x: Math.round(point.x / 20) * 20, y: Math.round(point.y / 20) * 20 };
}

function getSchematicWirePoints(sheet, wire) {
    const startComponent = sheet.components.find((component) => component.id === wire.start.componentId);
    const endComponent = sheet.components.find((component) => component.id === wire.end.componentId);
    const start = startComponent && getSchematicPinPosition(startComponent, wire.start.pinIndex);
    const end = endComponent && getSchematicPinPosition(endComponent, wire.end.pinIndex);
    return start && end ? [start, ...wire.waypoints, end] : [];
}

function renderSchematicSymbol(component, definition) {
    const pins = definition.pinNames.map((name, index) => {
        const leftCount = Math.ceil(definition.pins / 2);
        const side = definition.pins === 1 ? 0 : index < leftCount ? -1 : 1;
        const sideIndex = side === 0 ? 0 : index < leftCount ? index : index - leftCount;
        const sideCount = side === 0 ? 1 : side < 0 ? leftCount : definition.pins - leftCount;
        const pinX = side * 72;
        const pinY = side === 0 ? 48 : (sideIndex - (sideCount - 1) / 2) * 20;
        const labelX = side === 0 ? 10 : side < 0 ? -62 : 62;
        const labelAnchor = side === 0 ? "start" : side < 0 ? "end" : "start";
        const lineEnd = side === 0 ? 0 : side * 42;
        const lineStart = side === 0 ? 0 : pinX;
        const validationTarget = pcbValidationHighlight?.area === "schematic" &&
            pcbValidationHighlight.componentId === component.id && pcbValidationHighlight.pinIndex === index
            ? " is-validation-target"
            : "";
        return `<g class="pcb-schematic-pin${validationTarget}" data-schematic-pin data-component-id="${escapePcbMarkup(component.id)}" data-pin-index="${index}" data-pin-name="${escapePcbMarkup(name)}"><line x1="${lineStart}" y1="${pinY}" x2="${lineEnd}" y2="${pinY}"/><circle class="pcb-schematic-pin-hit" cx="${pinX}" cy="${pinY}" r="10"/><circle class="pcb-schematic-pin-visible" cx="${pinX}" cy="${pinY}" r="5"/><text x="${labelX}" y="${pinY - 5}" text-anchor="${labelAnchor}">${escapePcbMarkup(name)}</text></g>`;
    }).join("");
    const body = component.type === "resistor"
        ? '<path class="schematic-symbol-body" d="M-34-18h12l8-10 14 20 14-20 14 20 8-10h12v36h-82z"/>'
        : component.type === "capacitor"
            ? '<path class="schematic-symbol-body" d="M-42-20h84v40h-84z"/><path d="M-8-13v26m16-26v26" fill="none" stroke="#557760" stroke-width="2"/>'
            : component.type === "led"
                ? '<path class="schematic-symbol-body" d="M-20-20 16 0-20 20zM18-20v40" />'
                : component.type === "diode"
                    ? '<path class="schematic-symbol-body" d="M-20-20 16 0-20 20zM18-20v40" />'
                    : component.type === "ground"
                        ? '<path class="schematic-symbol-body" d="M0-28v20m-20 0h40m-14 8h28m-22 8h16" fill="none"/>'
                        : component.type === "power"
                            ? '<path class="schematic-symbol-body" d="M-30-24h60v48h-60z"/><path d="M-8-8v16m-8-8h16m12 0h16" fill="none" stroke="#557760" stroke-width="2"/>'
                            : component.type === "transistor" || component.type === "mosfet"
                                ? '<circle class="schematic-symbol-body" cx="0" cy="0" r="26"/><path d="M-10-18v36m10-26 20-12m-20 38 20 12m-40-12 20-12" fill="none" stroke="#557760" stroke-width="2"/>'
                                : '<rect class="schematic-symbol-body" x="-42" y="-30" width="84" height="60" rx="3"/>';
    const netText = component.type === "ground" ? '<text x="0" y="58" text-anchor="middle" class="schematic-value">GND</text>' : "";
    return `<g class="pcb-schematic-component${selectedSchematicComponentIds.has(component.id) ? " is-selected" : ""}" data-schematic-component="${escapePcbMarkup(component.id)}" transform="translate(${component.x} ${component.y}) rotate(${component.rotation})">${body}${pins}<text class="schematic-ref" x="0" y="-42" text-anchor="middle">${escapePcbMarkup(component.reference)}</text><text class="schematic-value" x="0" y="48" text-anchor="middle">${escapePcbMarkup(component.value)}</text>${netText}</g>`;
}

function getPcbSchematicConnectivity(sheet) {
    const parent = new Map();
    const make = (key) => { if (!parent.has(key)) parent.set(key, key); };
    const find = (key) => {
        make(key);
        if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
        return parent.get(key);
    };
    const union = (first, second) => {
        if (!first || !second) return;
        const rootA = find(first);
        const rootB = find(second);
        if (rootA !== rootB) parent.set(rootB, rootA);
    };
    const pinKey = (componentId, pinIndex) => `${componentId}:${pinIndex}`;
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        for (let pinIndex = 0; pinIndex < definition.pins; pinIndex += 1) make(pinKey(component.id, pinIndex));
    });
    sheet.wires.forEach((wire) => union(
        pinKey(wire.start.componentId, wire.start.pinIndex),
        pinKey(wire.end.componentId, wire.end.pinIndex)
    ));
    const netGroups = new Map();
    sheet.labels.forEach((label) => {
        if (!label.pin) return;
        const key = pinKey(label.pin.componentId, label.pin.pinIndex);
        const existing = netGroups.get(label.name.toUpperCase());
        if (existing) union(existing, key);
        else netGroups.set(label.name.toUpperCase(), key);
    });
    const globalNets = new Map();
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        definition.pinNames.forEach((pinName, pinIndex) => {
            const name = component.type === "ground"
                ? "GND"
                : component.type === "power"
                    ? pinIndex === 0 ? (component.value || "VCC") : "GND"
                    : pinName.toUpperCase() === "GND" ? "GND" : null;
            if (!name) return;
            const key = pinKey(component.id, pinIndex);
            const existing = globalNets.get(name);
            if (existing) union(existing, key);
            else globalNets.set(name, key);
        });
    });
    const groups = new Map();
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        definition.pinNames.forEach((pinName, pinIndex) => {
            const key = pinKey(component.id, pinIndex);
            const root = find(key);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push({ component, pinIndex, pinName });
        });
    });
    const namedNets = new Map();
    sheet.labels.forEach((label) => {
        if (!label.pin) return;
        const root = find(pinKey(label.pin.componentId, label.pin.pinIndex));
        if (!namedNets.has(root) || label.kind !== "net") namedNets.set(root, label.name);
    });
    globalNets.forEach((key, name) => namedNets.set(find(key), name));
    return [...groups.entries()].filter(([, nodes]) => nodes.length > 1 || namedNets.has(find(nodes[0] && pinKey(nodes[0].component.id, nodes[0].pinIndex))))
        .map(([root, nodes], index) => ({
            name: namedNets.get(find(root)) || `Net-${index + 1}`,
            nodes: nodes.map(({ component, pinIndex, pinName }) => ({ reference: component.reference, pin: String(pinIndex + 1), name: pinName }))
        }));
}

function updateSchematicNetSummary() {
    const sheet = activePcbSchematic();
    const nets = sheet ? getPcbSchematicConnectivity(sheet) : [];
    document.querySelector("[data-schematic-net-summary]").textContent =
        `${nets.length} nets · ${sheet?.wires.length || 0} connections`;
}

function renderPcbSchematic() {
    if (!activePcbProject) return;
    const schematic = activePcbProject.schematic;
    const sheet = activePcbSchematic();
    const sheetSelect = document.querySelector("[data-pcb-sheet-select]");
    sheetSelect.replaceChildren(...schematic.sheets.map((item) => new Option(item.name, item.id)));
    sheetSelect.value = sheet.id;
    const stage = document.querySelector("[data-schematic-stage]");
    const svg = document.querySelector("[data-schematic-svg]");
    const width = Math.max(100, stage.clientWidth);
    const height = Math.max(100, stage.clientHeight);
    const view = schematic.view;
    const viewWidth = width / view.zoom;
    const viewHeight = height / view.zoom;
    svg.setAttribute("viewBox", `${view.panX - viewWidth / 2} ${view.panY - viewHeight / 2} ${viewWidth} ${viewHeight}`);
    const wireGroup = document.querySelector("[data-schematic-wires]");
    const labelGroup = document.querySelector("[data-schematic-labels]");
    const componentGroup = document.querySelector("[data-schematic-components]");
    const interaction = document.querySelector("[data-schematic-interaction]");
    wireGroup.replaceChildren();
    labelGroup.replaceChildren();
    componentGroup.replaceChildren();
    interaction.replaceChildren();
    sheet.wires.forEach((wire) => {
        const points = getSchematicWirePoints(sheet, wire);
        if (points.length < 2) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("pcb-schematic-wire");
        if (wire.id === selectedSchematicPin?.wireId) path.classList.add("is-selected");
        if (pcbValidationHighlight?.area === "schematic" && pcbValidationHighlight.wireId === wire.id) {
            path.classList.add("is-validation-target");
        }
        path.dataset.schematicWire = wire.id;
        const routed = [points[0]];
        points.slice(1).forEach((point, index) => {
            const previous = routed[routed.length - 1];
            if (index < points.length - 2 && previous.x !== point.x && previous.y !== point.y) {
                routed.push({ x: point.x, y: previous.y });
            }
            routed.push(point);
        });
        path.setAttribute("d", routed.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "));
        wireGroup.append(path);
    });
    sheet.labels.forEach((label) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.classList.add("pcb-schematic-label");
        group.dataset.schematicLabel = label.id;
        const attachedComponent = label.pin && sheet.components.find((component) => component.id === label.pin.componentId);
        const point = attachedComponent
            ? getSchematicPinPosition(attachedComponent, label.pin.pinIndex)
            : { x: label.x, y: label.y };
        group.innerHTML = `<line x1="${point.x}" y1="${point.y}" x2="${point.x + 14}" y2="${point.y - 14}"/><text x="${point.x + 18}" y="${point.y - 16}">${escapePcbMarkup(label.name)}</text>`;
        labelGroup.append(group);
    });
    sheet.components.forEach((component) => {
        const definition = getPcbPartDefinition(component.type);
        const holder = document.createElementNS("http://www.w3.org/2000/svg", "g");
        holder.innerHTML = renderSchematicSymbol(component, definition);
        componentGroup.append(holder.firstElementChild);
    });
    renderSchematicDraftOnly();
    document.querySelector("[data-schematic-empty]").hidden = sheet.components.length > 0;
    document.querySelectorAll("[data-schematic-tool]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.schematicTool === activeSchematicTool));
    });
    document.querySelector("[data-schematic-label-field]").hidden = activeSchematicTool !== "label";
    document.querySelector("[data-schematic-rotate]").disabled = selectedSchematicComponentIds.size !== 1;
    stage.dataset.tool = activeSchematicTool;
    updateSchematicInspector();
    updateSchematicNetSummary();
}

function renderSchematicDraftOnly() {
    const interaction = document.querySelector("[data-schematic-interaction]");
    interaction.replaceChildren();
    const sheet = activePcbSchematic();
    if (!sheet || !schematicWireDraft?.cursor) return;
    const startComponent = sheet.components.find((component) => component.id === schematicWireDraft.start.componentId);
    const start = startComponent && getSchematicPinPosition(startComponent, schematicWireDraft.start.pinIndex);
    if (!start) return;
    const points = [start, ...schematicWireDraft.waypoints, snapSchematicPoint(schematicWireDraft.cursor)];
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("pcb-schematic-interaction");
    path.setAttribute("d", points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "));
    interaction.append(path);
}

function updateSchematicInspector() {
    const sheet = activePcbSchematic();
    const selected = sheet?.components.find((component) => selectedSchematicComponentIds.has(component.id));
    const definition = selected && getPcbPartDefinition(selected.type);
    const selectedPanel = document.querySelector("[data-schematic-selected-panel]");
    const pinPanel = document.querySelector("[data-schematic-pin-panel]");
    selectedPanel.hidden = !selected;
    pinPanel.hidden = !selectedSchematicPin || selectedSchematicPin.kind !== "pin";
    document.querySelector("[data-schematic-inspector-tip]").hidden = Boolean(selected || selectedSchematicPin);
    if (selected) {
        document.querySelector("[data-schematic-selected-name]").textContent = definition.name;
        document.querySelector("[data-schematic-reference]").value = selected.reference;
        document.querySelector("[data-schematic-value]").value = selected.value;
        document.querySelector("[data-schematic-component-specs]").textContent =
            Object.entries(definition.electrical).map(([key, value]) => `${key}: ${value}`).join(" · ");
        document.querySelector("[data-schematic-component-pins]").textContent =
            `Pins: ${definition.pinNames.map((name, index) => `${index + 1} ${name}`).join(" · ")}`;
    }
    if (selectedSchematicPin?.kind === "pin") {
        const component = sheet?.components.find((item) => item.id === selectedSchematicPin.componentId);
        const pinName = component && getPcbPartDefinition(component.type).pinNames[selectedSchematicPin.pinIndex];
        document.querySelector("[data-schematic-pin-name]").textContent = `${component?.reference || ""} · ${pinName || ""}`;
        document.querySelector("[data-schematic-pin-details]").textContent =
            `Pin ${selectedSchematicPin.pinIndex + 1} of ${getPcbPartDefinition(component.type).pins}`;
    }
}

function setPcbWorkspaceMode(mode) {
    pcbWorkspaceMode = ["schematic", "layout"].includes(mode) ? mode : "board";
    pcbEditor.dataset.pcbWorkspaceMode = pcbWorkspaceMode;
    document.querySelector("[data-pcb-schematic-toggle]").setAttribute("aria-pressed", String(pcbWorkspaceMode === "schematic"));
    document.querySelector("[data-pcb-schematic-toggle]").textContent = pcbWorkspaceMode === "schematic" ? "Board" : "Schematic";
    document.querySelector("[data-pcb-layout-toggle]").setAttribute("aria-pressed", String(pcbWorkspaceMode === "layout"));
    document.querySelector("[data-pcb-layout-toggle]").textContent = pcbWorkspaceMode === "layout" ? "3D Board" : "2D Layout";
    document.querySelector(".pcb-viewport").hidden = pcbWorkspaceMode === "schematic";
    document.querySelector(".pcb-viewport").hidden = pcbWorkspaceMode !== "board";
    document.querySelector("[data-pcb-schematic]").hidden = pcbWorkspaceMode !== "schematic";
    document.querySelector("[data-pcb-layout]").hidden = pcbWorkspaceMode !== "layout";
    document.querySelector("[data-pcb-schematic-inspector]").hidden = pcbWorkspaceMode !== "schematic";
    document.querySelector("[data-pcb-layout-inspector]").hidden = pcbWorkspaceMode !== "layout";
    renderPcbLibraryDetail();
    renderPcbRoboticsPlanner();
    if (pcbWorkspaceMode === "schematic") {
        activeSchematicTool = "select";
        renderPcbSchematic();
    } else if (pcbWorkspaceMode === "layout") {
        renderPcbLayout();
    } else {
        renderPcbBoard();
    }
}

function addSchematicComponent(type) {
    const sheet = activePcbSchematic();
    const definition = getPcbPartDefinition(type);
    if (!sheet || !definition) return;
    if (sheet.components.length >= 100) {
        document.querySelector("[data-schematic-status]").textContent = "This starter schematic supports up to 100 components per sheet.";
        return;
    }
    const usedNumbers = activePcbProject.schematic.sheets.flatMap((item) => item.components)
        .filter((component) => component.reference.startsWith(definition.prefix))
        .map((component) => Number(component.reference.slice(definition.prefix.length)) || 0);
    const center = snapSchematicPoint({
        x: activePcbProject.schematic.view.panX,
        y: activePcbProject.schematic.view.panY
    });
    const placementIndex = sheet.components.length;
    const component = {
        id: `schematic-${activePcbProject.schematic.nextComponentId++}`,
        type,
        reference: `${definition.prefix}${Math.max(0, ...usedNumbers) + 1}`,
        value: type === "power" ? "5V" : type === "ground" ? "GND" :
            definition.electrical.resistance || definition.electrical.capacitance || definition.name,
        x: center.x + placementIndex % 3 * 180,
        y: center.y + Math.floor(placementIndex / 3) * 140,
        rotation: 0
    };
    recordPcbHistory();
    sheet.components.push(component);
    autoMapRoboticsPins(activePcbProject);
    selectedSchematicComponentIds = new Set([component.id]);
    document.querySelector("[data-schematic-status]").textContent = `${definition.name} ${component.reference} placed. Drag to move; select Wire to connect pins.`;
    renderPcbSchematic();
    schedulePcbSave();
}

function setSchematicTool(tool) {
    if (!["select", "wire", "label"].includes(tool)) return;
    activeSchematicTool = tool;
    schematicWireDraft = null;
    renderPcbSchematic();
    if (tool === "label") document.querySelector("[data-schematic-label-input]").focus();
}

function getSchematicPinTarget(target) {
    const pin = target.closest("[data-schematic-pin]");
    return pin ? {
        componentId: pin.dataset.componentId,
        pinIndex: Number(pin.dataset.pinIndex),
        pinName: pin.dataset.pinName
    } : null;
}

function finishSchematicWire(endPin) {
    const sheet = activePcbSchematic();
    if (!sheet || !schematicWireDraft || !endPin) return;
    const start = schematicWireDraft.start;
    if (start.componentId === endPin.componentId && start.pinIndex === endPin.pinIndex) {
        schematicWireDraft = null;
        selectedSchematicPin = null;
        renderPcbSchematic();
        return;
    }
    const startComponent = sheet.components.find((component) => component.id === start.componentId);
    const endComponent = sheet.components.find((component) => component.id === endPin.componentId);
    if (!startComponent || !endComponent) return;
    const startPoint = getSchematicPinPosition(startComponent, start.pinIndex);
    const endPoint = getSchematicPinPosition(endComponent, endPin.pinIndex);
    const waypoints = [...schematicWireDraft.waypoints];
    if (!waypoints.length && startPoint.x !== endPoint.x && startPoint.y !== endPoint.y) {
        waypoints.push(snapSchematicPoint({ x: endPoint.x, y: startPoint.y }));
    }
    recordPcbHistory();
    sheet.wires.push({
        id: `wire-${activePcbProject.schematic.nextWireId++}`,
        start: { componentId: start.componentId, pinIndex: start.pinIndex },
        end: { componentId: endPin.componentId, pinIndex: endPin.pinIndex },
        waypoints
    });
    schematicWireDraft = null;
    selectedSchematicPin = null;
    document.querySelector("[data-schematic-status]").textContent =
        `Connected ${startComponent.reference}.${getPcbPartDefinition(startComponent.type).pinNames[start.pinIndex]} to ${endComponent.reference}.${getPcbPartDefinition(endComponent.type).pinNames[endPin.pinIndex]}.`;
    renderPcbSchematic();
    schedulePcbSave();
}

function addSchematicLabel(name, point, pin = null, kind = "net") {
    const sheet = activePcbSchematic();
    if (!sheet || !pin) {
        document.querySelector("[data-schematic-status]").textContent = "Net labels must be attached to a component pin.";
        return;
    }
    const cleanName = name.trim().slice(0, 32);
    if (!cleanName) return;
    recordPcbHistory();
    sheet.labels.push({
        id: `label-${activePcbProject.schematic.nextLabelId++}`,
        name: cleanName,
        x: point.x,
        y: point.y,
        pin: pin ? { componentId: pin.componentId, pinIndex: pin.pinIndex } : null,
        kind
    });
    const component = sheet.components.find((item) => item.id === pin.componentId);
    const pinName = component && getPcbPartDefinition(component.type).pinNames[pin.pinIndex];
    document.querySelector("[data-schematic-status]").textContent =
        `Net label ${cleanName} attached to ${component?.reference || "pin"}${pinName ? ` · ${pinName}` : ""}.`;
    renderPcbSchematic();
    schedulePcbSave();
}

function deleteSelectedSchematicComponents() {
    const sheet = activePcbSchematic();
    if (!sheet || !selectedSchematicComponentIds.size) return;
    recordPcbHistory();
    const removed = selectedSchematicComponentIds;
    sheet.components = sheet.components.filter((component) => !removed.has(component.id));
    sheet.wires = sheet.wires.filter((wire) =>
        !removed.has(wire.start.componentId) && !removed.has(wire.end.componentId));
    sheet.labels = sheet.labels.filter((label) => !label.pin || !removed.has(label.pin.componentId));
    selectedSchematicComponentIds = new Set();
    selectedSchematicPin = null;
    schematicWireDraft = null;
    document.querySelector("[data-schematic-status]").textContent = "Selected component(s) and their attached wires were deleted.";
    renderPcbSchematic();
    schedulePcbSave();
}

function generatePcbNetlist() {
    const sheet = activePcbSchematic();
    if (!sheet) return "";
    const nets = getPcbSchematicConnectivity(sheet);
    const quote = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ");
    const nodes = nets.map((net, index) => `    (net (code "${index + 1}") (name "${quote(net.name)}")\n${net.nodes.map((node) =>
        `      (node (ref "${quote(node.reference)}") (pin "${node.pin}") (pinfunction "${quote(node.name)}"))`
    ).join("\n")}\n    )`).join("\n");
    const components = sheet.components.map((component) =>
        `    (comp (ref "${quote(component.reference)}") (value "${quote(component.value)}") (type "${quote(component.type)}"))`
    ).join("\n");
    return `(export (version "Aqua PCB Studio 1")\n  (sheet "${quote(sheet.name)}")\n  (components\n${components}\n  )\n  (nets\n${nodes}\n  )\n)`;
}

function readSavedPcbProjects() {
    try {
        const collection = localStorage.getItem(pcbProjectsStorageKey);
        if (collection) {
            const parsed = JSON.parse(collection);
            if (parsed?.version !== 1 || !Array.isArray(parsed.projects)) {
                throw new Error("The saved PCB project collection has an unsupported format.");
            }
            return parsed.projects.map(normalizePcbProject);
        }
        const legacy = localStorage.getItem(pcbProjectStorageKey);
        return legacy ? [normalizePcbProject(JSON.parse(legacy))] : [];
    } catch (error) {
        console.warn("Unable to read saved PCB projects.", error);
        document.querySelector("[data-pcb-setup-status]").textContent =
            error instanceof DOMException && error.name === "SecurityError"
                ? "Saved project storage is unavailable in this browser."
                : "Saved projects could not be loaded. You can still start a new project.";
        return [];
    }
}

function readSavedPcbProject() {
    return pcbProjects[pcbProjects.length - 1] || null;
}

function savePcbProject() {
    if (!activePcbProject) return;
    const saveState = document.querySelector("[data-pcb-save-state]");
    window.clearTimeout(pcbSaveTimer);
    saveState.textContent = "SAVING...";
    try {
        activePcbProject.updatedAt = new Date().toISOString();
        const savedProject = normalizePcbProject(activePcbProject);
        const existingIndex = pcbProjects.findIndex((project) => project.id === savedProject.id);
        if (existingIndex < 0) pcbProjects.push(savedProject);
        else pcbProjects[existingIndex] = savedProject;
        localStorage.setItem(pcbProjectsStorageKey, JSON.stringify({ version: 1, projects: pcbProjects }));
        localStorage.setItem(pcbProjectStorageKey, JSON.stringify(savedProject));
        saveState.textContent = "ALL CHANGES SAVED";
    } catch (error) {
        console.warn("Unable to save the PCB project.", error);
        saveState.textContent = "SAVE FAILED";
        document.querySelector("[data-pcb-placement-status]").textContent =
            "Could not save this project on this device. Export it to keep a copy.";
    }
}

function schedulePcbSave() {
    pcbConnectivityAnalysis = null;
    pcbConnectivityLayout = null;
    renderPcbRoboticsPlanner();
    if (pcbValidationIssues) {
        pcbValidationDirty = true;
        renderPcbValidationPanel();
    }
    const saveState = document.querySelector("[data-pcb-save-state]");
    saveState.textContent = "UNSAVED CHANGES";
    window.clearTimeout(pcbSaveTimer);
    pcbSaveTimer = window.setTimeout(savePcbProject, 350);
}

function updatePcbHistoryControls() {
    document.querySelector("[data-pcb-undo]").disabled = pcbUndoStack.length === 0;
    document.querySelector("[data-pcb-redo]").disabled = pcbRedoStack.length === 0;
}

function recordPcbHistory() {
    if (!activePcbProject) return;
    pcbUndoStack.push(JSON.stringify(activePcbProject));
    if (pcbUndoStack.length > 50) pcbUndoStack.shift();
    pcbRedoStack = [];
    updatePcbHistoryControls();
}

function restorePcbHistory(fromStack, toStack) {
    if (!activePcbProject || fromStack.length === 0) return;
    toStack.push(JSON.stringify(activePcbProject));
    activePcbProject = normalizePcbProject(JSON.parse(fromStack.pop()));
    selectedSchematicComponentIds = new Set(
        selectedSchematicComponentIds.size
            ? activePcbSchematic()?.components.filter((component) => selectedSchematicComponentIds.has(component.id)).map((component) => component.id) || []
            : []
    );
    if (selectedSchematicPin?.kind === "pin" &&
        !activePcbSchematic()?.components.some((component) => component.id === selectedSchematicPin.componentId)) {
        selectedSchematicPin = null;
    }
    selectedPcbPartId = activePcbProject.components.some((part) => part.id === selectedPcbPartId)
        ? selectedPcbPartId
        : null;
    document.querySelector("[data-pcb-project-name]").textContent = activePcbProject.name;
    document.querySelector("[data-pcb-project-name-input]").value = activePcbProject.name;
    document.querySelector("[data-pcb-theme]").value = activePcbProject.theme;
    for (const [dimension, value] of Object.entries({
        width: activePcbProject.width,
        height: activePcbProject.height,
        thickness: activePcbProject.thickness
    })) {
        document.querySelector(`[data-pcb-dimension="${dimension}"]`).value = String(value);
    }
    renderPcbBoard();
    if (pcbWorkspaceMode === "schematic") renderPcbSchematic();
    if (pcbWorkspaceMode === "layout") renderPcbLayout();
    updatePcbHistoryControls();
    schedulePcbSave();
}

function renderPcbProjectManager() {
    const list = document.querySelector("[data-pcb-project-list]");
    list.replaceChildren();
    if (pcbProjects.length === 0) {
        const empty = document.createElement("p");
        empty.className = "pcb-project-empty";
        empty.textContent = "No saved projects yet. Create a project or import a JSON file.";
        list.append(empty);
        return;
    }
    [...pcbProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).forEach((project) => {
        const card = document.createElement("article");
        card.className = "pcb-project-card";
        const copy = document.createElement("div");
        copy.className = "pcb-project-card-copy";
        const name = document.createElement("strong");
        name.textContent = project.name;
        const details = document.createElement("small");
        details.textContent = `${project.width} × ${project.height} mm · ${project.components.length} parts · Saved ${new Date(project.updatedAt).toLocaleDateString()}`;
        copy.append(name, details);
        const actions = document.createElement("div");
        actions.className = "pcb-project-card-actions";
        for (const [action, label] of [["open", "Open"], ["export", "Export"], ["delete", "Delete"]]) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.pcbProjectAction = action;
            button.dataset.projectId = project.id;
            button.textContent = label;
            actions.append(button);
        }
        card.append(copy, actions);
        list.append(card);
    });
}

function openPcbProjectManager() {
    if (pcbProjects.length === 0) pcbProjects = readSavedPcbProjects();
    document.querySelector("[data-pcb-project-dialog-status]").textContent = "";
    renderPcbProjectManager();
    document.querySelector("[data-pcb-project-dialog]").showModal();
}

function downloadPcbProject(project) {
    const safeName = project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "pcb-project";
    const referencedCustomParts = Object.fromEntries(
        [...new Set(project.components.map((part) => part.type))]
            .filter((type) => Object.hasOwn(customPcbParts, type))
            .map((type) => [type, customPcbParts[type]])
    );
    downloadCadFile(`${safeName}.json`, JSON.stringify({ ...project, customComponents: referencedCustomParts }, null, 2), "application/json");
}

function getPcbManufacturingProjectData(project) {
    const referencedTypes = new Set([
        ...project.components.map((part) => part.type),
        ...project.layout.footprints.map((footprint) => footprint.type),
        ...project.schematic.sheets.flatMap((sheet) => sheet.components.map((component) => component.type))
    ]);
    const referencedCustomParts = Object.fromEntries(
        [...referencedTypes]
            .filter((type) => Object.hasOwn(customPcbParts, type))
            .map((type) => [type, customPcbParts[type]])
    );
    return { ...project, customComponents: referencedCustomParts };
}

function renderPcbManufacturingLayers() {
    const list = document.querySelector("[data-pcb-manufacturing-layers]");
    const layout = activePcbProject?.layout;
    if (!layout) return;
    list.replaceChildren();
    layout.layers.forEach((layer) => {
        const supported = layer.type === "copper" || layer.type === "outline";
        const label = document.createElement("label");
        label.className = "pcb-manufacturing-layer";
        if (!supported) label.classList.add("is-unsupported");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.mfgLayer = layer.id;
        checkbox.checked = supported && activePcbProject.manufacturing.selectedLayers.includes(layer.id);
        checkbox.disabled = !supported;
        const name = document.createElement("span");
        name.textContent = layer.name;
        const type = document.createElement("small");
        type.textContent = supported ? layer.type.toUpperCase() : "UNSUPPORTED";
        label.append(checkbox, name, type);
        list.append(label);
    });
}

function readPcbManufacturingConfiguration() {
    const project = activePcbProject;
    if (!project) return null;
    const config = project.manufacturing;
    config.selectedLayers = [...document.querySelectorAll("[data-mfg-layer]:checked")]
        .map((checkbox) => checkbox.dataset.mfgLayer);
    for (const [key, selector] of [
        ["throughHoleDrillMm", "[data-mfg-th-drill]"],
        ["viaDrillMm", "[data-mfg-via-drill]"],
        ["throughHolePadDiameterMm", "[data-mfg-th-land]"],
        ["smdPadWidthMm", "[data-mfg-smd-width]"],
        ["smdPadHeightMm", "[data-mfg-smd-height]"]
    ]) config[key] = Number(document.querySelector(selector).value);
    config.outputs = Object.fromEntries([...document.querySelectorAll("[data-mfg-output]")].map((checkbox) =>
        [checkbox.dataset.mfgOutput, checkbox.checked]));
    return config;
}

function renderPcbManufacturingFindings(errors, warnings) {
    const list = document.querySelector("[data-mfg-findings]");
    const status = document.querySelector("[data-mfg-status]");
    list.replaceChildren();
    const entries = [
        ...errors.map((message) => ({ severity: "error", message })),
        ...warnings.map((message) => ({ severity: "warning", message }))
    ];
    if (!entries.length) entries.push({ severity: "ready", message: "No issues detected by Aqua's available preparation checks." });
    entries.forEach(({ severity, message }) => {
        const item = document.createElement("li");
        item.className = `pcb-manufacturing-finding is-${severity}`;
        item.textContent = `${severity === "ready" ? "READY" : severity.toUpperCase()} · ${message}`;
        list.append(item);
    });
    status.textContent = errors.length
        ? `${errors.length} blocking issue(s) · ${warnings.length} warning(s)`
        : warnings.length
            ? `Basic checks completed with ${warnings.length} warning(s); review before fabrication.`
            : "Basic checks passed. This is not a manufacturing or electrical safety guarantee.";
}

function invalidatePcbManufacturingPreview() {
    pcbManufacturingFiles = [];
    pcbManufacturingWarnings = [];
    pcbManufacturingSelectedFile = "";
    document.querySelector("[data-mfg-files]").replaceChildren();
    document.querySelector("[data-mfg-file-preview]").textContent =
        "Settings changed. Generate a new preview to inspect the updated output.";
    document.querySelector("[data-mfg-package]").disabled = true;
    document.querySelector("[data-mfg-preview-status]").textContent = "";
}

function checkPcbManufacturingReadiness(config = readPcbManufacturingConfiguration()) {
    if (!activePcbProject || !config) return { errors: ["Open a PCB project first."], warnings: [] };
    const report = validatePcbManufacturingProject(activePcbProject, config, getPcbPartDefinition);
    const warnings = [...report.warnings];
    if (config.selectedLayers.length === 0 && config.outputs.gerber) {
        report.errors.push("Select at least one copper or board-outline layer for Gerber output.");
    }
    const connectivity = analyzePcbConnectivity(activePcbProject.layout);
    if (connectivity.unroutedPads) warnings.push(`${connectivity.unroutedPads} connected pad(s) remain unrouted.`);
    if (connectivity.unassignedPins) warnings.push(`${connectivity.unassignedPins} footprint pad(s) have no synchronized schematic net.`);
    if (connectivity.clearanceConflicts.length) warnings.push(`${connectivity.clearanceConflicts.length} internal copper clearance warning(s) remain.`);
    const netSignature = (nets) => JSON.stringify(nets.map((net) => [
        net.name,
        net.nodes.map((node) => `${node.reference}:${node.pin}`).sort()
    ]).sort((first, second) => first[0].localeCompare(second[0])));
    const schematicNets = getProjectPcbNets();
    if (schematicNets.length && netSignature(schematicNets) !== netSignature(activePcbProject.layout.nets)) {
        warnings.push("PCB net data differs from the current schematic. Use Sync schematic before exporting the PCB netlist.");
    }
    validatePcbProject(activePcbProject).filter((issue) => issue.severity === "error" || issue.severity === "warning")
        .forEach((issue) => {
            const estimate = issue.kind === "estimate" ? " estimate" : "";
            warnings.push(`Aqua ${issue.severity.toUpperCase()} ${issue.domain}${estimate}: ${issue.title}`);
        });
    const uniqueWarnings = [...new Set(warnings)];
    renderPcbManufacturingFindings(report.errors, uniqueWarnings);
    return { errors: report.errors, warnings: uniqueWarnings };
}

function openPcbManufacturingDialog() {
    if (!activePcbProject) return;
    const config = activePcbProject.manufacturing;
    renderPcbManufacturingLayers();
    for (const [key, selector] of [
        ["throughHoleDrillMm", "[data-mfg-th-drill]"],
        ["viaDrillMm", "[data-mfg-via-drill]"],
        ["throughHolePadDiameterMm", "[data-mfg-th-land]"],
        ["smdPadWidthMm", "[data-mfg-smd-width]"],
        ["smdPadHeightMm", "[data-mfg-smd-height]"]
    ]) document.querySelector(selector).value = String(config[key]);
    document.querySelectorAll("[data-mfg-output]").forEach((checkbox) => {
        checkbox.checked = config.outputs[checkbox.dataset.mfgOutput] !== false;
    });
    pcbManufacturingFiles = [];
    pcbManufacturingWarnings = [];
    pcbManufacturingSelectedFile = "";
    document.querySelector("[data-mfg-files]").replaceChildren();
    document.querySelector("[data-mfg-file-preview]").textContent =
        "Generate a preview to inspect the actual manufacturing file contents.";
    document.querySelector("[data-mfg-preview-status]").textContent = "";
    document.querySelector("[data-mfg-package]").disabled = true;
    document.querySelector("[data-mfg-findings]").replaceChildren();
    document.querySelector("[data-mfg-status]").textContent = "Run the board checks before generating files.";
    renderPcbManufacturingHistory();
    document.querySelector("[data-pcb-manufacturing-dialog]").showModal();
}

function renderPcbManufacturingHistory() {
    const list = document.querySelector("[data-mfg-history]");
    list.replaceChildren();
    const history = activePcbProject?.manufacturing.history || [];
    if (!history.length) {
        const empty = document.createElement("li");
        empty.textContent = "No manufacturing exports prepared for this project yet.";
        list.append(empty);
        return;
    }
    [...history].reverse().forEach((entry) => {
        const item = document.createElement("li");
        const when = new Date(entry.createdAt);
        const files = entry.files.join(", ");
        item.textContent = `${when.toLocaleString()} · ${entry.action || "Export prepared"} · ${files}` +
            (entry.warningCount ? ` · ${entry.warningCount} warning(s)` : "");
        list.append(item);
    });
}

function recordPcbManufacturingExport(action, files, warningCount) {
    if (!activePcbProject) return;
    activePcbProject.manufacturing.history.push({
        createdAt: new Date().toISOString(),
        action,
        files: files.map((file) => file.path).slice(0, 40),
        warningCount
    });
    activePcbProject.manufacturing.history = activePcbProject.manufacturing.history.slice(-20);
    renderPcbManufacturingHistory();
    schedulePcbSave();
}

function renderPcbManufacturingPreview() {
    const list = document.querySelector("[data-mfg-files]");
    list.replaceChildren();
    pcbManufacturingFiles.forEach((file) => {
        const item = document.createElement("div");
        item.className = "pcb-manufacturing-file";
        const name = document.createElement("span");
        name.textContent = `${file.path} · ${file.format}`;
        const preview = document.createElement("button");
        preview.type = "button";
        preview.dataset.mfgPreviewFile = file.path;
        preview.textContent = "View";
        const download = document.createElement("button");
        download.type = "button";
        download.dataset.mfgDownloadFile = file.path;
        download.textContent = "Download";
        item.append(name, preview, download);
        list.append(item);
    });
    const selected = pcbManufacturingFiles.find((file) => file.path === pcbManufacturingSelectedFile) ||
        pcbManufacturingFiles[0];
    if (!selected) {
        document.querySelector("[data-mfg-file-preview]").textContent = "No files were generated.";
        return;
    }
    pcbManufacturingSelectedFile = selected.path;
    const limit = 30000;
    document.querySelector("[data-mfg-file-preview]").textContent = selected.content.length > limit
        ? `${selected.content.slice(0, limit)}\n\n[Preview truncated; downloaded file contains the complete output.]`
        : selected.content;
}

function preparePcbManufacturingPreview() {
    if (!activePcbProject) return;
    const config = readPcbManufacturingConfiguration();
    const readiness = checkPcbManufacturingReadiness(config);
    if (readiness.errors.length) {
        pcbManufacturingFiles = [];
        document.querySelector("[data-mfg-files]").replaceChildren();
        document.querySelector("[data-mfg-package]").disabled = true;
        document.querySelector("[data-mfg-preview-status]").textContent = "Resolve blocking errors before generating files.";
        return;
    }
    try {
        const generated = generatePcbManufacturingFiles(
            getPcbManufacturingProjectData(activePcbProject),
            { ...config, warnings: readiness.warnings, generatedAt: new Date().toISOString() },
            getPcbPartDefinition
        );
        pcbManufacturingFiles = generated.files;
        pcbManufacturingWarnings = [...new Set([...readiness.warnings, ...generated.warnings])];
        pcbManufacturingSelectedFile = pcbManufacturingFiles[0]?.path || "";
        renderPcbManufacturingPreview();
        document.querySelector("[data-mfg-package]").disabled = false;
        document.querySelector("[data-mfg-preview-status]").textContent =
            `${generated.files.length} file(s) generated from the current PCB model · ${pcbManufacturingWarnings.length} warning(s).`;
        recordPcbManufacturingExport("Preview prepared", generated.files, pcbManufacturingWarnings.length);
    } catch (error) {
        console.warn("Unable to prepare PCB manufacturing outputs.", error);
        pcbManufacturingFiles = [];
        document.querySelector("[data-mfg-files]").replaceChildren();
        document.querySelector("[data-mfg-package]").disabled = true;
        document.querySelector("[data-mfg-preview-status]").textContent = error.message || "Manufacturing export failed.";
    }
}

function persistPcbProjectCollection(projects) {
    localStorage.setItem(pcbProjectsStorageKey, JSON.stringify({ version: 1, projects }));
    if (projects.length) localStorage.setItem(pcbProjectStorageKey, JSON.stringify(projects[projects.length - 1]));
    else localStorage.removeItem(pcbProjectStorageKey);
}

function normalizeCustomPcbPart(type, definition) {
    if (!/^custom-[a-z0-9-]{1,48}$/.test(type) || !definition || typeof definition !== "object" || Array.isArray(definition)) {
        throw new Error("Custom component has an invalid identifier or format.");
    }
    const name = String(definition.name || "").trim().slice(0, 48);
    const category = pcbComponentCategories.includes(definition.category) ? definition.category : "Modules";
    const prefix = String(definition.prefix || "").trim().toUpperCase();
    const pins = Math.round(Number(definition.pins));
    const width = Number(definition.width);
    const height = Number(definition.height);
    if (!name || !/^[A-Z]{1,3}$/.test(prefix) || !Number.isInteger(pins) || pins < 1 || pins > 40 ||
        !Number.isFinite(width) || width < 2 || width > 50 || !Number.isFinite(height) || height < 2 || height > 50) {
        throw new Error("Custom component dimensions, pins, name, or reference prefix are invalid.");
    }
    const pinNames = Array.isArray(definition.pinNames) ? definition.pinNames : [];
    return {
        name, category, prefix, width, height, pins, color: /^#[0-9a-f]{6}$/i.test(definition.color) ? definition.color : "#587866",
        description: String(definition.description || "Custom user component.").slice(0, 140),
        pinNames: Array.from({ length: pins }, (_, index) => String(pinNames[index] || `PIN${index + 1}`).trim().slice(0, 16)),
        electrical: definition.electrical && typeof definition.electrical === "object"
            ? Object.fromEntries(Object.entries(definition.electrical).slice(0, 8).map(([key, value]) => [String(key).slice(0, 24), String(value).slice(0, 120)]))
            : {},
        symbol: "custom",
        footprint: { type: String(definition.footprint?.type || "custom-through-hole").slice(0, 48), width, height, pads: pins, pitch: Number(definition.footprint?.pitch) || 2.54 }
    };
}

function loadCustomPcbParts() {
    let loaded = true;
    try {
        const saved = localStorage.getItem(pcbComponentLibraryStorageKey);
        const parsed = saved ? JSON.parse(saved) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("The saved custom component library has an invalid format.");
        }
        customPcbParts = Object.fromEntries(Object.entries(parsed).map(([type, definition]) => [
            type, normalizeCustomPcbPart(type, definition)
        ]));
    } catch (error) {
        console.warn("Unable to load custom PCB components.", error);
        document.querySelector("[data-pcb-setup-status]").textContent =
            "Custom components could not be loaded. Projects that use them may not open until storage is available.";
        customPcbParts = {};
        loaded = false;
    }
    renderPcbComponentCategories();
    renderPcbComponentLibrary();
    return loaded;
}

function renderPcbComponentCategories() {
    const categorySelect = document.querySelector("[data-pcb-category]");
    const customCategorySelect = document.querySelector("[data-pcb-custom-category]");
    const selectedCategory = categorySelect.value || "all";
    categorySelect.replaceChildren(new Option("All categories", "all"));
    customCategorySelect.replaceChildren(...pcbComponentCategories.map((category) => new Option(category, category)));
    pcbComponentCategories.forEach((category) => categorySelect.add(new Option(category, category)));
    categorySelect.value = [...categorySelect.options].some((option) => option.value === selectedCategory)
        ? selectedCategory
        : "all";
}

function renderPcbComponentLibrary() {
    const list = document.querySelector("[data-pcb-component-list]");
    if (!list) return;
    const query = document.querySelector("[data-pcb-search]").value.trim().toLowerCase();
    const category = document.querySelector("[data-pcb-category]").value;
    const definitions = Object.entries({ ...pcbParts, ...customPcbParts })
        .filter(([type, definition]) => matchesPcbComponentCategory(type, definition, category))
        .filter(([type, definition]) => [
            definition.name,
            definition.category,
            definition.description,
            type,
            definition.pinNames.join(" "),
            Object.values(definition.electrical).join(" "),
            definition.footprint.type
        ].join(" ").toLowerCase().includes(query));
    list.replaceChildren();
    definitions.forEach(([type, definition]) => {
        const button = document.createElement("button");
        button.className = `pcb-component-option${type === selectedPcbLibraryType ? " is-library-selected" : ""}`;
        button.type = "button";
        button.setAttribute("data-pcb-library-type", type);
        const icon = document.createElement("span");
        icon.className = "pcb-part-icon";
        icon.textContent = definition.prefix.slice(0, 2);
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = definition.name;
        const details = document.createElement("small");
        details.textContent = `${getPcbRoboticsCategory(type) || definition.category} · ${definition.pins} pins`;
        copy.append(name, details);
        const add = document.createElement("span");
        add.className = "pcb-add-symbol";
        add.textContent = "+";
        button.append(icon, copy, add);
        list.append(button);
    });
    if (!definitions.length) {
        const empty = document.createElement("p");
        empty.className = "pcb-library-empty";
        empty.textContent = "No components match your search.";
        list.append(empty);
    }
    renderPcbLibraryDetail();
}

function renderPcbLibraryDetail() {
    const detail = document.querySelector("[data-pcb-library-detail]");
    const definition = getPcbPartDefinition(selectedPcbLibraryType);
    detail.replaceChildren();
    if (!definition) {
        const empty = document.createElement("div");
        empty.className = "pcb-library-detail-empty";
        empty.textContent = "Select a component to inspect its specifications.";
        detail.append(empty);
        return;
    }
    const heading = document.createElement("div");
    heading.className = "pcb-library-detail-heading";
    const name = document.createElement("strong");
    name.textContent = definition.name;
    const category = document.createElement("span");
    category.textContent = definition.category;
    heading.append(name, category);
    const description = document.createElement("p");
    description.textContent = definition.description;
    const technical = document.createElement("div");
    technical.className = "pcb-library-technical";
    const symbol = document.createElement("div");
    symbol.className = "pcb-preview-card";
    symbol.innerHTML = `<span>SCHEMATIC SYMBOL</span>${renderPcbSchematicSymbol(definition.symbol)}<small>${escapePcbMarkup(definition.symbol)} symbol</small>`;
    const footprint = document.createElement("div");
    footprint.className = "pcb-preview-card";
    footprint.innerHTML = `<span>PCB FOOTPRINT</span>${renderPcbFootprintPreview(definition)}<small>${definition.footprint.width} × ${definition.footprint.height} mm · ${definition.footprint.pads} pads · ${definition.footprint.pitch} mm pitch</small>`;
    technical.append(symbol, footprint);
    const specs = document.createElement("dl");
    specs.className = "pcb-component-specs";
    Object.entries(definition.electrical).forEach(([key, value]) => {
        const term = document.createElement("dt");
        term.textContent = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
        const descriptionValue = document.createElement("dd");
        descriptionValue.textContent = String(value);
        specs.append(term, descriptionValue);
    });
    const pins = document.createElement("div");
    pins.className = "pcb-component-pins";
    const pinTitle = document.createElement("strong");
    pinTitle.textContent = `Pins (${definition.pins})`;
    const pinList = document.createElement("p");
    pinList.textContent = definition.pinNames.map((pin, index) => `${index + 1}: ${pin}`).join(" · ");
    pins.append(pinTitle, pinList);
    const actions = document.createElement("div");
    actions.className = "pcb-library-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "studio-primary-button";
    add.setAttribute("data-pcb-library-add", selectedPcbLibraryType);
    add.textContent = pcbWorkspaceMode === "schematic" ? "Add to schematic" : "Add to board";
    actions.append(add);
    if (Object.hasOwn(customPcbParts, selectedPcbLibraryType)) {
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "canvas-action-button";
        edit.setAttribute("data-pcb-library-edit", selectedPcbLibraryType);
        edit.textContent = "Edit";
        actions.append(edit);
    }
    detail.append(heading, description, technical, specs, pins, actions);
}

function renderPcbFootprintPreview(definition) {
    if (definition.boardModel && definition.layoutPads) {
        const scale = Math.min(64 / definition.width, 40 / definition.height);
        const pads = definition.layoutPads.map((pad, index) =>
            `<circle class="pcb-preview-module-pad" cx="${pad.x}" cy="${pad.y}" r="0.88"><title>${escapePcbMarkup(`${index + 1}: ${pad.name}`)}</title></circle>`
        ).join("");
        return `<svg viewBox="0 0 90 54" role="img" aria-label="${escapePcbMarkup(`${definition.name} board footprint with named headers`)}">
            <g transform="translate(45 27) scale(${scale})">
                <rect class="pcb-preview-module-board" x="${-definition.width / 2}" y="${-definition.height / 2}" width="${definition.width}" height="${definition.height}" rx="1.2"/>
                ${renderPcbBoardArtwork(definition.boardModel)}
                <g>${pads}</g>
            </g>
        </svg>`;
    }
    const coordinates = [];
    const perSide = Math.ceil(definition.pins / 4);
    for (let index = 0; index < perSide && coordinates.length < definition.pins; index += 1) {
        const x = 25 + (index + 1) * 40 / (perSide + 1);
        coordinates.push([x, 10], [x, 44]);
    }
    for (let index = 0; index < perSide && coordinates.length < definition.pins; index += 1) {
        const y = 15 + (index + 1) * 24 / (perSide + 1);
        coordinates.push([18, y], [72, y]);
    }
    const pads = coordinates.slice(0, definition.pins)
        .map(([x, y], index) => `<circle data-pad="${index + 1}" cx="${x}" cy="${y}" r="2" fill="#c6a567" stroke="#927b4d"/>`).join("");
    return `<svg viewBox="0 0 90 54" role="img" aria-label="${escapePcbMarkup(definition.footprint.type)} footprint"><rect x="18" y="12" width="54" height="30" rx="4" fill="#eef5ef" stroke="#71947d" stroke-width="1.5"/><text x="45" y="30" text-anchor="middle" dominant-baseline="middle" fill="#526b59" font-size="7">${escapePcbMarkup(definition.footprint.type)}</text>${pads}</svg>`;
}

function renderPcbSchematicSymbol(kind) {
    const graphics = {
        resistor: '<path d="M8 28h10l5-10 8 20 8-20 8 20 8-20 5 10h10"/>',
        capacitor: '<path d="M8 28h28M36 15v26M44 15v26M44 28h28"/>',
        led: '<path d="M8 28h18m12 0h24M26 14l16 14-16 14zM48 13l8-8m-3 13 8-8"/>',
        diode: '<path d="M8 28h18m12 0h24M26 14l16 14-16 14zM42 14v28"/>',
        transistor: '<circle cx="40" cy="28" r="20"/><path d="M8 28h18m14-12v24m0-16 18-14m-18 30 18 14m-3-7-8-2 2 8"/>',
        mosfet: '<path d="M8 28h24m-8-18v36m12-30v24m0-18 24-12m-24 30 24 12M48 9v38"/>',
        regulator: '<rect x="28" y="12" width="28" height="32" rx="2"/><path d="M8 20h20m28 0h16M8 36h20"/>',
        connector: '<path d="M8 28h15m0-13v26m0-26h12m-12 13h12m-12 13h12m0-26v26m0-26h20m-20 13h20m-20 13h20"/>',
        switch: '<path d="M8 28h18m30 0h16M26 28l26-15"/>',
        source: '<circle cx="40" cy="28" r="20"/><path d="M8 28h12m40 0h12M40 17v12m-6-6h12m-6 10v10"/>',
        ground: '<path d="M40 8v22m-20 0h40M26 37h28m-22 7h16"/>',
        ic: '<rect x="25" y="10" width="30" height="36" rx="2"/><path d="M8 17h17m-17 9h17m-17 9h17m30-18h17m-17 9h17m-17 9h17"/>',
        module: '<rect x="22" y="10" width="36" height="36" rx="3"/><path d="M8 16h14m-14 8h14m-14 8h14m-14 8h14m36-24h14m-14 8h14m-14 8h14m-14 8h14"/>',
        custom: '<rect x="24" y="12" width="32" height="32" rx="3"/><path d="M8 20h16m-16 8h16m-16 8h16m32-16h16m-16 8h16m-16 8h16"/>'
    };
    const markup = graphics[kind] || graphics.custom;
    return `<svg viewBox="0 0 80 56" role="img" aria-label="${escapePcbMarkup(kind)} schematic">${markup}</svg>`;
}

function setPcbSelection(partId) {
    selectedPcbPartId = partId;
    const part = activePcbProject?.components.find((item) => item.id === partId);
    const selectedPanel = document.querySelector("[data-pcb-selected-panel]");
    const inspectorTip = document.querySelector("[data-pcb-inspector-tip]");
    selectedPanel.hidden = !part;
    inspectorTip.hidden = Boolean(part);
    if (part) {
        const definition = getPcbPartDefinition(part.type);
        document.querySelector("[data-pcb-selected-name]").textContent = definition.name;
        document.querySelector("[data-pcb-selected-reference]").textContent = part.reference;
        document.querySelector("[data-pcb-instance-reference]").value = part.reference;
        document.querySelector("[data-pcb-instance-value]").value = part.value ||
            definition.electrical.resistance || definition.electrical.capacitance ||
            definition.electrical.output || definition.name;
        document.querySelector("[data-pcb-position='x']").value = String(Math.round(part.x * 10) / 10);
        document.querySelector("[data-pcb-position='y']").value = String(Math.round(part.y * 10) / 10);
        document.querySelector("[data-pcb-instance-electrical]").textContent =
            Object.entries(definition.electrical).map(([key, value]) => `${key}: ${value}`).join(" · ");
        document.querySelector("[data-pcb-instance-pins]").textContent =
            `Pins: ${definition.pinNames.map((pin, index) => `${index + 1} ${pin}`).join(" · ")}`;
    }
}

function updatePcbViewControls() {
    if (!activePcbProject) return;
    const camera = activePcbProject.camera;
    const pitch = Math.abs(camera.pitch);
    const view = pitch >= 110 ? "bottom" : pitch >= 60 ? "side" : "top";
    document.querySelectorAll("[data-pcb-view]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.pcbView === view));
    });
    document.querySelector("[data-pcb-zoom-label]").textContent = `${Math.round(camera.zoom * 100)}%`;
}

function updatePcbExtrusionTransforms() {
    if (!activePcbProject || !pcbRenderedCamera) return;
    const viewMode = activePcbProject.viewMode || "3d";
    pcbBoard.querySelectorAll("[data-pcb-component]").forEach((component) => {
        const topFace = component.querySelector(".pcb-part-top");
        if (!topFace) return;
        if (viewMode !== "3d") {
            topFace.setAttribute("transform", "translate(0 0)");
            component.querySelector(".pcb-part-side-wall")?.setAttribute("d", "");
            return;
        }
        const height = Number(component.dataset.pcbHeight);
        const rotation = Number(component.dataset.pcbRotation);
        const pitchRadians = pcbRenderedCamera.pitch * Math.PI / 180;
        const offsetY = Math.max(-30, Math.min(30, -height * Math.tan(pitchRadians)));
        const angle = (pcbRenderedCamera.yaw + rotation) * Math.PI / 180;
        const offsetX = Math.sin(angle) * offsetY;
        const localOffsetY = Math.cos(angle) * offsetY;
        topFace.setAttribute("transform", `translate(${offsetX} ${localOffsetY})`);
        const definition = getPcbPartDefinition(component.dataset.pcbType);
        const sideWall = component.querySelector(".pcb-part-side-wall");
        if (!definition || !sideWall) return;
        const outline = component.dataset.pcbType === "led"
            ? Array.from({ length: 24 }, (_, index) => {
                const angle = index * Math.PI / 12;
                const radius = Math.min(definition.width, definition.height) * 0.37;
                return [Math.cos(angle) * radius, Math.sin(angle) * radius];
            })
            : [
                [-definition.width / 2, -definition.height / 2],
                [definition.width / 2, -definition.height / 2],
                [definition.width / 2, definition.height / 2],
                [-definition.width / 2, definition.height / 2]
            ];
        const walls = outline.map(([x1, y1], index) => {
            const [x2, y2] = outline[(index + 1) % outline.length];
            return `M ${x1} ${y1} L ${x2} ${y2} L ${x2 + offsetX} ${y2 + localOffsetY} L ${x1 + offsetX} ${y1 + localOffsetY} Z`;
        }).join(" ");
        sideWall.setAttribute("d", walls);
    });
}

function applyPcbCameraTransform() {
    if (!activePcbProject || !pcbRenderedCamera) return;
    const mode = activePcbProject.viewMode || "3d";
    pcbBoard.parentElement.style.transform = `rotateX(${mode === "3d" ? pcbRenderedCamera.pitch : 0}deg) rotateZ(${mode === "3d" ? pcbRenderedCamera.yaw : pcbRenderedCamera.flatYaw}deg) scale(${pcbRenderedCamera.zoom})`;
    updatePcbExtrusionTransforms();
}

function animatePcbCamera() {
    if (!activePcbProject || pcbCameraFrame) return;
    if (!pcbRenderedCamera) {
        const camera = activePcbProject.camera;
        pcbRenderedCamera = { ...camera, flatYaw: camera.yaw + (Math.abs(camera.pitch) >= 90 ? 180 : 0) };
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const camera = activePcbProject.camera;
        pcbRenderedCamera = { ...camera, flatYaw: camera.yaw + (Math.abs(camera.pitch) >= 90 ? 180 : 0) };
        applyPcbCameraTransform();
        return;
    }
    const step = () => {
        if (!activePcbProject || pcbEditor.hidden) {
            pcbCameraFrame = 0;
            return;
        }
        const target = activePcbProject.camera;
        const targetFlatYaw = target.yaw + (Math.abs(target.pitch) >= 90 ? 180 : 0);
        const easing = 0.24;
        pcbRenderedCamera.yaw += (target.yaw - pcbRenderedCamera.yaw) * easing;
        pcbRenderedCamera.pitch += (target.pitch - pcbRenderedCamera.pitch) * easing;
        pcbRenderedCamera.zoom += (target.zoom - pcbRenderedCamera.zoom) * easing;
        pcbRenderedCamera.flatYaw += (targetFlatYaw - pcbRenderedCamera.flatYaw) * easing;
        const settled = Math.abs(target.yaw - pcbRenderedCamera.yaw) < 0.08 &&
            Math.abs(target.pitch - pcbRenderedCamera.pitch) < 0.08 &&
            Math.abs(target.zoom - pcbRenderedCamera.zoom) < 0.002 &&
            Math.abs(targetFlatYaw - pcbRenderedCamera.flatYaw) < 0.08;
        if (settled) pcbRenderedCamera = { ...target, flatYaw: targetFlatYaw };
        applyPcbCameraTransform();
        if (settled) pcbCameraFrame = 0;
        else pcbCameraFrame = window.requestAnimationFrame(step);
    };
    pcbCameraFrame = window.requestAnimationFrame(step);
}

function renderPcbBoard(smoothCamera = false) {
    if (!activePcbProject) return;
    const project = activePcbProject;
    const width = project.width;
    const height = project.height;
    const viewMode = project.viewMode || "3d";
    const themeColors = {
        forest: { board: "#286b50", edge: "#174a3a", copper: "#cda86d", silkscreen: "#eff3d7" },
        ocean: { board: "#246d83", edge: "#16485d", copper: "#dbbb78", silkscreen: "#e5f4f4" },
        midnight: { board: "#303a48", edge: "#1d2733", copper: "#d0a962", silkscreen: "#e8edf0" },
        amber: { board: "#98623a", edge: "#684024", copper: "#e4c684", silkscreen: "#fff1d2" }
    };
    const colors = viewMode === "mono"
        ? { board: "#262626", edge: "#111111", copper: "#f5f5f5", silkscreen: "#ffffff" }
        : themeColors[project.theme];
    pcbEditor.dataset.boardTheme = project.theme;
    pcbEditor.dataset.viewMode = viewMode;
    document.querySelector("[data-pcb-mode-label]").innerHTML = `<span aria-hidden="true">${viewMode === "3d" ? "◈" : viewMode === "color" ? "▧" : "◐"}</span> ${viewMode === "3d" ? "3D VIEW" : viewMode === "color" ? "2D COLOUR" : "BLACK & WHITE"}`;
    document.querySelectorAll("[data-pcb-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.pcbMode === viewMode));
    });
    document.querySelector("[data-pcb-view-hint]").textContent = viewMode === "3d"
        ? "Drag board to rotate · drag parts to arrange"
        : "Drag to rotate · scroll or use + / − to zoom";
    const camera = project.camera || (project.camera = { yaw: -28, pitch: 53, zoom: 1 });
    updatePcbViewControls();
    const boardWrap = pcbBoard.parentElement;
    const flatYaw = camera.yaw + (Math.abs(camera.pitch) >= 90 ? 180 : 0);
    if (!pcbRenderedCamera) pcbRenderedCamera = { ...camera, flatYaw };
    if (smoothCamera) {
        animatePcbCamera();
    } else {
        pcbRenderedCamera = { ...camera, flatYaw };
        applyPcbCameraTransform();
    }
    boardWrap.style.aspectRatio = `${width} / ${height}`;
    pcbBoard.setAttribute("viewBox", `-6 -6 ${width + 12} ${height + 12}`);
    pcbBoard.setAttribute("aria-label", `${project.name}, ${width} by ${height} millimetre PCB with ${project.components.length} components`);
    pcbBoard.style.setProperty("--pcb-thickness", `${Math.max(3, Math.min(20, project.thickness * 4))}px`);

    const tracePaths = [
        `M ${width * 0.15} ${height * 0.22} H ${width * 0.42} V ${height * 0.39} H ${width * 0.68}`,
        `M ${width * 0.24} ${height * 0.76} H ${width * 0.52} V ${height * 0.58} H ${width * 0.82}`,
        `M ${width * 0.74} ${height * 0.2} V ${height * 0.42} H ${width * 0.88}`,
        `M ${width * 0.12} ${height * 0.48} H ${width * 0.31} V ${height * 0.66}`
    ].map((path) => `<path class="pcb-trace" d="${path}"/>`).join("");
    const holeInsetX = Math.min(5, width * 0.1);
    const holeInsetY = Math.min(5, height * 0.12);
    const holes = [
        [holeInsetX, holeInsetY],
        [width - holeInsetX, holeInsetY],
        [holeInsetX, height - holeInsetY],
        [width - holeInsetX, height - holeInsetY]
    ].map(([x, y]) => `<circle class="pcb-hole-ring" cx="${x}" cy="${y}" r="2.1"/><circle class="pcb-hole" cx="${x}" cy="${y}" r="1.3"/>`).join("");
    const parts = project.components.map(renderPcbPart).join("");
    const boardLegend = viewMode === "mono"
        ? ""
        : `<g class="pcb-silkscreen" fill="${colors.silkscreen}">
            <text x="${width * 0.07}" y="${height * 0.13}" font-size="2.4">${escapePcbMarkup(project.name.slice(0, 20).toUpperCase())}</text>
            <text x="${width * 0.73}" y="${height * 0.9}" font-size="2">PCB · ${width} × ${height} MM</text>
        </g>`;
    pcbBoard.innerHTML = `<defs><pattern id="pcb-grid-dots" width="2.54" height="2.54" patternUnits="userSpaceOnUse"><circle cx="1.27" cy="1.27" r=".13" fill="${colors.silkscreen}" opacity=".22"/></pattern></defs>
        <rect class="pcb-board-surface" x="0" y="0" width="${width}" height="${height}" rx="2.1" fill="${colors.board}"/>
        <rect x="0" y="0" width="${width}" height="${height}" rx="2.1" fill="url(#pcb-grid-dots)" opacity=".8"/>
        <g class="pcb-copper-layer" fill="none" stroke="${colors.copper}">${tracePaths}</g>
        ${boardLegend}
        <g>${holes}</g>${parts}`;
    updatePcbExtrusionTransforms();
    document.querySelector("[data-pcb-component-count]").textContent = String(project.components.length).padStart(2, "0");
    document.querySelector("[data-pcb-board-dimensions]").textContent = `${width} × ${height} mm`;
    document.querySelector("[data-pcb-board-size]").textContent = `${width} × ${height} × ${project.thickness} mm`;
    document.querySelector("[data-pcb-empty-hint]").hidden = project.components.length > 0;
    setPcbSelection(selectedPcbPartId);
}

function renderPcbPart(part) {
    const definition = getPcbPartDefinition(part.type);
    const viewMode = activePcbProject.viewMode || "3d";
    const partColor = viewMode === "mono" ? "#777777" : definition.color;
    const sideDepth = definition.boardThickness || { mcu: 6.8, resistor: 2.8, capacitor: 4.8, led: 6.5, connector: 3.2, ic: 3.2, sensor: 5.2, switch: 4.5 }[part.type] || 4;
    const sideColor = viewMode === "mono"
        ? "#111111"
        : { mcu: "#161d1b", resistor: "#76502d", capacitor: "#626e75", led: "#8e393a", connector: "#101817", ic: "#171d1c", sensor: "#1d2831", switch: "#20282b" }[part.type] || "#35443b";
    const pads = [];
    if (definition.boardModel && definition.layoutPads) {
        definition.layoutPads.forEach((pad) => {
            pads.push(`<g class="pcb-module-pad" aria-label="${escapePcbMarkup(pad.name)}"><rect class="pcb-pad" x="${pad.x - 0.9}" y="${pad.y - 0.9}" width="1.8" height="1.8" rx="0.2"/><circle class="pcb-module-pad-drill" cx="${pad.x}" cy="${pad.y}" r="0.68"/></g>`);
        });
    } else if (definition.pins <= 2) {
        const padWidth = Math.max(1.2, definition.width * 0.15);
        pads.push(`<rect class="pcb-pad" x="${-definition.width / 2 - padWidth * 0.65}" y="-0.8" width="${padWidth}" height="1.6" rx=".35"/>`);
        pads.push(`<rect class="pcb-pad" x="${definition.width / 2 - padWidth * 0.35}" y="-0.8" width="${padWidth}" height="1.6" rx=".35"/>`);
    } else {
        const padsPerSide = Math.ceil(definition.pins / 2);
        for (let index = 0; index < padsPerSide; index += 1) {
            const y = (index + 1) * definition.height / (padsPerSide + 1) - definition.height / 2;
            pads.push(`<rect class="pcb-pad" x="${-definition.width / 2 - 1.8}" y="${y - 0.55}" width="2.2" height="1.1" rx=".25"/>`);
            if (pads.length < definition.pins) pads.push(`<rect class="pcb-pad" x="${definition.width / 2 - 0.4}" y="${y - 0.55}" width="2.2" height="1.1" rx=".25"/>`);
        }
    }
    const shapeMarkup = (className, fill) => part.type === "led"
        ? `<circle class="${className}" cx="0" cy="0" r="${Math.min(definition.width, definition.height) * 0.37}" fill="${fill}"/>`
        : `<rect class="${className}" x="${-definition.width / 2}" y="${-definition.height / 2}" width="${definition.width}" height="${definition.height}" rx="${part.type === "resistor" ? 1.6 : 1}" fill="${fill}"/>`;
    const raisedSide = `<g class="pcb-part-side">${shapeMarkup("pcb-part-side-shape", sideColor)}<path class="pcb-part-side-shape pcb-part-side-wall" fill="${sideColor}"/></g>`;
    const topHighlight = viewMode === "3d"
        ? part.type === "led"
            ? `<circle class="pcb-part-highlight" cx="${-definition.width * 0.1}" cy="${-definition.height * 0.12}" r="${Math.min(definition.width, definition.height) * 0.18}"/>`
            : `<path class="pcb-part-highlight" d="M ${-definition.width * 0.34} ${-definition.height * 0.28} H ${definition.width * 0.34}"/>`
        : "";
    const boardArtwork = definition.boardModel ? renderPcbBoardArtwork(definition.boardModel, part.reference) : "";
    const markings = definition.boardModel ? boardArtwork : `
        <text class="pcb-part-mark" x="0" y="${Math.max(1.9, Math.min(3.2, definition.height * 0.28)) * 0.2}" text-anchor="middle" font-size="${Math.max(1.9, Math.min(3.2, definition.height * 0.28))}">${escapePcbMarkup(part.reference)}</text>
        <text class="pcb-part-name" x="0" y="${definition.height / 2 + Math.max(1.5, Math.min(2.5, definition.height * 0.19)) + 1.2}" text-anchor="middle" font-size="${Math.max(1.5, Math.min(2.5, definition.height * 0.19))}">${escapePcbMarkup(definition.name)}</text>`;
    const shape = `${raisedSide}<g class="pcb-part-top">${shapeMarkup("pcb-part-body", partColor)}${topHighlight}${markings}
    </g>`;
    return `<g class="pcb-component ${part.id === selectedPcbPartId ? "is-selected" : ""}" data-pcb-type="${part.type}" data-pcb-height="${sideDepth}" data-pcb-rotation="${part.rotation}" data-pcb-component="${escapePcbMarkup(part.id)}" role="button" tabindex="0" aria-label="${escapePcbMarkup(`${definition.name} ${part.reference}`)}" transform="translate(${part.x} ${part.y}) rotate(${part.rotation})">
        ${pads.join("")}${shape}
    </g>`;
}

function addPcbPart(type) {
    if (!activePcbProject || !getPcbPartDefinition(type)) return;
    if (pcbWorkspaceMode === "schematic") {
        addSchematicComponent(type);
        return;
    }
    if (pcbWorkspaceMode === "layout") {
        addPcbLayoutFootprint(type);
        return;
    }
    if (activePcbProject.components.length >= 100) {
        document.querySelector("[data-pcb-placement-status]").textContent = "This starter studio supports up to 100 placed parts.";
        return;
    }
    const definition = getPcbPartDefinition(type);
    const usedReferences = activePcbProject.components
        .filter((part) => part.reference.startsWith(definition.prefix))
        .map((part) => Number(part.reference.slice(definition.prefix.length)) || 0);
    const reference = `${definition.prefix}${Math.max(0, ...usedReferences) + 1}`;
    const index = activePcbProject.components.length;
    const part = {
        id: `pcb-part-${++nextPcbPartId}`,
        type,
        reference,
        x: definition.boardModel ? activePcbProject.width / 2 :
            Math.min(activePcbProject.width - definition.width / 2, Math.max(definition.width / 2, activePcbProject.width * (0.32 + (index % 4) * 0.13))),
        y: definition.boardModel ? activePcbProject.height / 2 :
            Math.min(activePcbProject.height - definition.height / 2, Math.max(definition.height / 2, activePcbProject.height * (0.33 + (index % 3) * 0.14))),
        rotation: 0
    };
    recordPcbHistory();
    activePcbProject.components.push(part);
    document.querySelector("[data-pcb-placement-status]").textContent = `${definition.name} ${reference} added · drag it to arrange`;
    setPcbSelection(part.id);
    renderPcbBoard();
    schedulePcbSave();
}

function openPcbSetup() {
    isOpeningBlankScreen = false;
    blankScreen.classList.remove("flowing");
    blankScreen.classList.add("open");
    blankScreen.setAttribute("aria-hidden", "false");
    blankScreen.setAttribute("aria-label", "New PCB project");
    roboticsStudio.hidden = true;
    newDesignScreen.hidden = true;
    document.querySelector("#canvasSetup").hidden = true;
    document.querySelector("#canvasEditor").hidden = true;
    pcbEditor.hidden = true;
    modelEditor.hidden = true;
    pcbSetup.hidden = false;
    const form = document.querySelector("[data-pcb-project-form]");
    form.reset();
    document.querySelector("#pcbProjectName").value = "";
    document.querySelector("#pcbProjectTheme").value = "";
    document.querySelector("[data-pcb-setup-status]").textContent = "";
    const componentLibraryLoaded = loadCustomPcbParts();
    pcbProjects = readSavedPcbProjects();
    const savedProject = readSavedPcbProject();
    const resumeButton = document.querySelector("[data-pcb-resume]");
    resumeButton.hidden = !savedProject;
    if (savedProject && componentLibraryLoaded) document.querySelector("[data-pcb-setup-status]").textContent = "";
    document.querySelector("#pcbProjectName").focus();
}

function startPcbWaterTransition(project) {
    isOpeningBlankScreen = true;
    pcbSetup.hidden = true;
    blankScreen.classList.remove("open");
    blankScreen.classList.add("flowing");
    blankScreen.setAttribute("aria-hidden", "false");
    blankScreen.setAttribute("aria-label", "Opening PCB studio");
    window.clearTimeout(blankScreenTimer);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 1200;
    blankScreenTimer = window.setTimeout(() => {
        blankScreen.classList.remove("flowing");
        blankScreen.classList.add("open");
        blankScreen.setAttribute("aria-label", "PCB building studio");
        openPcbEditor(project);
    }, duration);
}

function openPcbEditor(project) {
    activePcbProject = normalizePcbProject(project);
    project = activePcbProject;
    selectedPcbLayoutIds.clear();
    selectedPcbLayoutTrackId = null;
    pcbRouteSuggestions = [];
    pcbConnectivityAnalysis = null;
    pcbConnectivityLayout = null;
    pcbValidationIssues = null;
    pcbValidationDirty = false;
    pcbValidationHighlight = null;
    renderPcbValidationPanel();
    const roboticsStatus = document.querySelector("[data-robotics-status]");
    roboticsStatus.dataset.userMessage = "";
    roboticsStatus.textContent = "";
    project.camera.pitch = clampPcbPitch(project.camera.pitch);
    if (pcbCameraFrame) window.cancelAnimationFrame(pcbCameraFrame);
    pcbCameraFrame = 0;
    pcbRenderedCamera = {
        ...project.camera,
        flatYaw: project.camera.yaw + (Math.abs(project.camera.pitch) >= 90 ? 180 : 0)
    };
    selectedPcbPartId = null;
    nextPcbPartId = project.components.reduce((max, part) => {
        const match = part.id.match(/^pcb-part-(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    pcbUndoStack = [];
    pcbRedoStack = [];
    selectedSchematicComponentIds.clear();
    selectedSchematicPin = null;
    schematicWireDraft = null;
    pcbSetup.hidden = true;
    pcbEditor.hidden = false;
    document.querySelector("[data-pcb-project-name]").textContent = project.name;
    document.querySelector("[data-pcb-project-name-input]").value = project.name;
    document.querySelector("[data-pcb-theme]").value = project.theme;
    for (const [dimension, value] of Object.entries({
        width: project.width,
        height: project.height,
        thickness: project.thickness
    })) {
        document.querySelector(`[data-pcb-dimension="${dimension}"]`).value = String(value);
    }
    document.querySelector("[data-pcb-save-state]").textContent = "ALL CHANGES SAVED";
    document.querySelector("[data-pcb-placement-status]").textContent = "Click a component to add it";
    updatePcbHistoryControls();
    renderPcbBoard();
    setPcbWorkspaceMode("board");
    savePcbProject();
    renderPcbComponentLibrary();
}

document.querySelector("[data-pcb-project-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const theme = String(formData.get("theme") || "");
    if (!name || !pcbThemes.includes(theme)) {
        document.querySelector("#pcbProjectName").reportValidity();
        if (name && !pcbThemes.includes(theme)) document.querySelector("#pcbProjectTheme").reportValidity();
        return;
    }
    startPcbWaterTransition({
        schemaVersion: 1,
        id: `pcb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: name.slice(0, 80),
        theme,
        width: 90,
        height: 60,
        thickness: 1.6,
        viewMode: "3d",
        camera: { yaw: -28, pitch: 53, zoom: 1 },
        components: [],
        robotics: createPcbRoboticsPlan(document.querySelector("#pcbRoboticsTemplate").value || "custom")
    });
});

document.querySelector("[data-pcb-resume]").addEventListener("click", () => {
    const savedProject = readSavedPcbProject();
    if (savedProject) startPcbWaterTransition(savedProject);
});

document.querySelector("[data-pcb-search]").addEventListener("input", renderPcbComponentLibrary);
document.querySelector("[data-pcb-category]").addEventListener("change", renderPcbComponentLibrary);
document.querySelector("[data-pcb-create-component]").addEventListener("click", () => openPcbComponentEditor());
document.querySelector("[data-pcb-component-list]").addEventListener("click", (event) => {
    const option = event.target.closest("[data-pcb-library-type]");
    if (!option) return;
    selectedPcbLibraryType = option.dataset.pcbLibraryType;
    renderPcbComponentLibrary();
});
document.querySelector("[data-pcb-library-detail]").addEventListener("click", (event) => {
    const add = event.target.closest("[data-pcb-library-add]");
    if (add) {
        addPcbPart(add.dataset.pcbLibraryAdd);
        return;
    }
    const edit = event.target.closest("[data-pcb-library-edit]");
    if (edit) openPcbComponentEditor(edit.dataset.pcbLibraryEdit);
});
const pcbRoboticsPanel = document.querySelector(".pcb-robotics-panel");
pcbRoboticsPanel.addEventListener("click", (event) => {
    if (event.target.closest("[data-robotics-apply-template]")) {
        if (!activePcbProject) return;
        const templateId = pcbRoboticsPanel.querySelector("[data-robotics-template]").value;
        recordPcbHistory();
        activePcbProject.robotics = createPcbRoboticsPlan(templateId);
        autoMapRoboticsPins(activePcbProject);
        const status = pcbRoboticsPanel.querySelector("[data-robotics-status]");
        status.dataset.userMessage = "true";
        status.textContent = `${getPcbRoboticsTemplate(templateId).name} plan applied. Add recommended parts, then review the GPIO and power plan.`;
        renderPcbRoboticsPlanner();
        schedulePcbSave();
        return;
    }
    if (event.target.closest("[data-robotics-add-parts]")) {
        addRoboticsRecommendedParts();
        return;
    }
    if (event.target.closest("[data-robotics-add-connection]")) {
        if (!activePcbProject) return;
        const nameInput = pcbRoboticsPanel.querySelector("[data-robotics-custom-name]");
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.setCustomValidity("Enter a signal name.");
            nameInput.reportValidity();
            return;
        }
        nameInput.setCustomValidity("");
        const robotics = activePcbProject.robotics;
        if (robotics.functions.length >= 100) {
            pcbRoboticsPanel.querySelector("[data-robotics-status]").textContent =
                "The robotics plan supports up to 100 signals.";
            return;
        }
        recordPcbHistory();
        robotics.functions.push({
            id: `robot-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: name.slice(0, 40),
            group: pcbRoboticsPanel.querySelector("[data-robotics-custom-group]").value,
            preferredPins: [],
            requiresPin: true
        });
        nameInput.value = "";
        autoMapRoboticsPins(activePcbProject);
        renderPcbRoboticsPlanner();
        schedulePcbSave();
        return;
    }
    if (event.target.closest("[data-robotics-export]")) {
        if (!activePcbProject) return;
        const handoff = createRoboticsHandoff(activePcbProject);
        window.dispatchEvent(new CustomEvent("aqua:robotics-electronics-ready", { detail: handoff }));
        downloadCadFile(
            `${activePcbProject.name}-robotics-electronics.json`,
            JSON.stringify(handoff, null, 2),
            "application/json"
        );
        const status = pcbRoboticsPanel.querySelector("[data-robotics-status]");
        status.dataset.userMessage = "true";
        status.textContent = "Simulator handoff exported using aqua.robotics-electronics/v1. Aqua does not claim a live simulator connection.";
    }
});
pcbRoboticsPanel.addEventListener("change", (event) => {
    if (!activePcbProject) return;
    const signalSelect = event.target.closest("[data-robotics-signal]");
    if (signalSelect) {
        recordPcbHistory();
        if (!signalSelect.value) {
            delete activePcbProject.robotics.assignments[signalSelect.dataset.roboticsSignal];
        } else {
            const separator = signalSelect.value.lastIndexOf("|");
            const componentId = signalSelect.value.slice(0, separator);
            const pinIndex = Number(signalSelect.value.slice(separator + 1));
            if (!Number.isInteger(pinIndex) || !getRoboticsControllers(activePcbProject)
                .some((component) => component.id === componentId &&
                    getRoboticsControllerPins(component).some((pin) => pin.pinIndex === pinIndex))) return;
            activePcbProject.robotics.assignments[signalSelect.dataset.roboticsSignal] = { componentId, pinIndex };
        }
        autoMapRoboticsPins(activePcbProject);
        renderPcbRoboticsPlanner();
        schedulePcbSave();
        return;
    }
    const railInput = event.target.closest("[data-robotics-rail]");
    if (railInput) {
        const voltage = Number(railInput.value);
        if (!Number.isFinite(voltage) || voltage < 0 || voltage > 60) {
            railInput.setCustomValidity("Enter a voltage between 0 and 60 V.");
            railInput.reportValidity();
            return;
        }
        railInput.setCustomValidity("");
        recordPcbHistory();
        const rail = activePcbProject.robotics.rails.find((item) => item.id === railInput.dataset.roboticsRail);
        if (!rail) return;
        rail.voltage = voltage;
        renderPcbRoboticsPlanner();
        schedulePcbSave();
    }
});
window.addEventListener("aqua:robotics-architecture", (event) => {
    const architecture = event.detail;
    if (!architecture || architecture.schema !== "aqua.robotics-architecture" || architecture.version !== 1 ||
        !architecture.robot || !Array.isArray(architecture.connections)) {
        console.warn("Ignored an unsupported robotics architecture handoff.");
        const status = document.querySelector("[data-pcb-setup-status]");
        if (!activePcbProject && status) status.textContent = "Aqua received an unsupported robotics architecture format.";
        return;
    }
    if (!activePcbProject) {
        const status = document.querySelector("[data-pcb-setup-status]");
        if (status) status.textContent = "Open or create a PCB project before transferring a robot architecture.";
        return;
    }
    recordPcbHistory();
    const plan = createPcbRoboticsPlan("custom");
    plan.source = "simulator";
    plan.sourceRobot = {
        id: String(architecture.robot.id || "").slice(0, 80),
        name: String(architecture.robot.name || "Robot").slice(0, 80)
    };
    plan.controllerType = ["esp32", "arduinoUno", "mcu"].includes(architecture.controllerType)
        ? architecture.controllerType
        : "";
    plan.requiredParts = Array.isArray(architecture.requiredParts)
        ? [...new Set(architecture.requiredParts.filter((type) => Boolean(getPcbPartDefinition(type))))].slice(0, 40)
        : [];
    plan.functions = architecture.connections.slice(0, 100).map((connection, index) => ({
        id: `sim-${index + 1}-${String(connection.id || "").replace(/[^\w-]/g, "").slice(0, 24)}`,
        name: String(connection.name || `Signal ${index + 1}`).trim().slice(0, 40),
        group: String(connection.group || "Simulator connection").trim().slice(0, 32),
        preferredPins: Array.isArray(connection.preferredPins)
            ? connection.preferredPins.filter((pin) => typeof pin === "string").slice(0, 20)
            : [],
        requiresPin: connection.requiresPin !== false
    }));
    plan.rails = Array.isArray(architecture.rails)
        ? architecture.rails.slice(0, 20).map((rail, index) => ({
            id: `sim-rail-${index + 1}`,
            name: String(rail.name || `Rail ${index + 1}`).slice(0, 40),
            voltage: Math.min(60, Math.max(0, Number(rail.voltage) || 0)),
            minimum: Math.min(60, Math.max(0, Number(rail.minimum) || 0)),
            maximum: Math.min(60, Math.max(0, Number(rail.maximum) || 60))
        }))
        : [];
    activePcbProject.robotics = normalizePcbRobotics(plan);
    autoMapRoboticsPins(activePcbProject);
    const status = pcbRoboticsPanel.querySelector("[data-robotics-status]");
    status.dataset.userMessage = "true";
    status.textContent = `Imported ${activePcbProject.robotics.functions.length} connection(s) from ${activePcbProject.robotics.sourceRobot.name}. Review and verify every assignment.`;
    renderPcbRoboticsPlanner();
    schedulePcbSave();
});
document.querySelector("[data-pcb-schematic-toggle]").addEventListener("click", () => {
    setPcbWorkspaceMode(pcbWorkspaceMode === "schematic" ? "board" : "schematic");
});
document.querySelector("[data-pcb-layout-toggle]").addEventListener("click", () => {
    setPcbWorkspaceMode(pcbWorkspaceMode === "layout" ? "board" : "layout");
});
document.querySelector("[data-pcb-sheet-select]").addEventListener("change", (event) => {
    if (!activePcbProject) return;
    activePcbProject.schematic.activeSheetId = event.currentTarget.value;
    selectedSchematicComponentIds.clear();
    selectedSchematicPin = null;
    schematicWireDraft = null;
    renderPcbSchematic();
    schedulePcbSave();
});
document.querySelector("[data-pcb-sheet-add]").addEventListener("click", () => {
    if (!activePcbProject) return;
    let sequence = activePcbProject.schematic.sheets.length + 1;
    let name = `Sheet ${sequence}`;
    while (activePcbProject.schematic.sheets.some((sheet) => sheet.name.toLowerCase() === name.toLowerCase())) {
        name = `Sheet ${++sequence}`;
    }
    recordPcbHistory();
    const sheet = createPcbSchematicSheet(name);
    activePcbProject.schematic.sheets.push(sheet);
    activePcbProject.schematic.activeSheetId = sheet.id;
    selectedSchematicComponentIds.clear();
    selectedSchematicPin = null;
    renderPcbSchematic();
    document.querySelector("[data-schematic-status]").textContent = `${name} created.`;
    schedulePcbSave();
});
document.querySelectorAll("[data-schematic-tool]").forEach((button) => {
    button.addEventListener("click", () => setSchematicTool(button.dataset.schematicTool));
});
document.querySelector("[data-schematic-rotate]").addEventListener("click", () => {
    const sheet = activePcbSchematic();
    const component = sheet?.components.find((item) => selectedSchematicComponentIds.has(item.id));
    if (!component) return;
    recordPcbHistory();
    component.rotation = (component.rotation + 90) % 360;
    renderPcbSchematic();
    schedulePcbSave();
});
document.querySelectorAll("[data-schematic-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!activePcbProject) return;
        const view = activePcbProject.schematic.view;
        let nextZoom = view.zoom;
        let nextPanX = view.panX;
        let nextPanY = view.panY;
        if (button.dataset.schematicZoom === "fit") {
            const sheet = activePcbSchematic();
            if (!sheet?.components.length) {
                nextZoom = 1;
                nextPanX = 0;
                nextPanY = 0;
            } else {
                const bounds = sheet.components.reduce((result, component) => ({
                    minX: Math.min(result.minX, component.x),
                    maxX: Math.max(result.maxX, component.x),
                    minY: Math.min(result.minY, component.y),
                    maxY: Math.max(result.maxY, component.y)
                }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
                const stage = document.querySelector("[data-schematic-stage]");
                nextZoom = Math.max(0.35, Math.min(1.5,
                    Math.min(stage.clientWidth / Math.max(400, bounds.maxX - bounds.minX + 300),
                        stage.clientHeight / Math.max(300, bounds.maxY - bounds.minY + 240))));
                nextPanX = (bounds.minX + bounds.maxX) / 2;
                nextPanY = (bounds.minY + bounds.maxY) / 2;
            }
        } else {
            nextZoom = Math.max(0.35, Math.min(2.5, view.zoom + (button.dataset.schematicZoom === "in" ? 0.1 : -0.1)));
        }
        if (nextZoom === view.zoom && nextPanX === view.panX && nextPanY === view.panY) return;
        view.zoom = nextZoom;
        view.panX = nextPanX;
        view.panY = nextPanY;
        renderPcbSchematic();
        schedulePcbSave();
    });
});
document.querySelector("[data-schematic-netlist]").addEventListener("click", () => {
    document.querySelector("[data-pcb-netlist-output]").textContent = generatePcbNetlist();
    document.querySelector("[data-pcb-netlist-dialog]").showModal();
});
document.querySelector("[data-close-netlist]").addEventListener("click", () => {
    document.querySelector("[data-pcb-netlist-dialog]").close();
});
document.querySelector("[data-pcb-netlist-dialog]").addEventListener("click", (event) => event.stopPropagation());
document.querySelector("[data-pcb-netlist-dialog]").addEventListener("cancel", (event) => {
    event.preventDefault();
    event.currentTarget.close();
});
document.querySelector("[data-copy-netlist]").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(document.querySelector("[data-pcb-netlist-output]").textContent);
        document.querySelector("[data-schematic-status]").textContent = "Netlist copied to clipboard.";
    } catch (error) {
        console.warn("Unable to copy the schematic netlist.", error);
        document.querySelector("[data-schematic-status]").textContent = "Clipboard access is unavailable. Select and copy the netlist text.";
    }
});
document.querySelector("[data-download-netlist]").addEventListener("click", () => {
    const sheet = activePcbSchematic();
    if (!sheet) return;
    const safeName = sheet.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
    downloadCadFile(`${safeName}-netlist.net`, generatePcbNetlist(), "text/plain");
});
document.querySelector("[data-schematic-reference]").addEventListener("change", (event) => {
    const sheet = activePcbSchematic();
    const component = sheet?.components.find((item) => selectedSchematicComponentIds.has(item.id));
    const reference = event.currentTarget.value.trim().toUpperCase();
    if (!component || !/^[A-Z0-9-]{1,8}$/.test(reference) ||
        activePcbProject.schematic.sheets.some((item) =>
            item.components.some((entry) => entry.id !== component.id && entry.reference === reference))) {
        event.currentTarget.value = component?.reference || "";
        document.querySelector("[data-schematic-status]").textContent = "Use a unique reference with up to 8 letters, numbers, or hyphens.";
        return;
    }
    if (reference === component.reference) return;
    recordPcbHistory();
    component.reference = reference;
    renderPcbSchematic();
    schedulePcbSave();
});
document.querySelector("[data-schematic-value]").addEventListener("change", (event) => {
    const sheet = activePcbSchematic();
    const component = sheet?.components.find((item) => selectedSchematicComponentIds.has(item.id));
    if (!component) return;
    const value = event.currentTarget.value.trim().slice(0, 32);
    if (value === component.value) return;
    recordPcbHistory();
    component.value = value;
    renderPcbSchematic();
    schedulePcbSave();
});
document.querySelector("[data-schematic-delete]").addEventListener("click", () => deleteSelectedSchematicComponents());
document.querySelector("[data-schematic-deselect]").addEventListener("click", () => {
    selectedSchematicComponentIds.clear();
    selectedSchematicPin = null;
    renderPcbSchematic();
});
document.querySelector("[data-schematic-wire-from-pin]").addEventListener("click", () => {
    if (!selectedSchematicPin || selectedSchematicPin.kind !== "pin") return;
    setSchematicTool("wire");
    schematicWireDraft = { start: selectedSchematicPin, waypoints: [], cursor: null };
    document.querySelector("[data-schematic-status]").textContent = "Select another pin to finish this wire; click the canvas to add a bend.";
    renderPcbSchematic();
});
document.querySelector("[data-schematic-stage]").addEventListener("pointerdown", (event) => {
    if (!activePcbProject || event.button > 1) return;
    const stage = event.currentTarget;
    const point = getSchematicSvgPoint(event);
    if (!point) return;
    const pin = getSchematicPinTarget(event.target);
    const componentTarget = event.target.closest("[data-schematic-component]");
    if (event.button === 1 || schematicSpacePressed) {
        event.preventDefault();
        schematicPointer = { mode: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            panX: activePcbProject.schematic.view.panX, panY: activePcbProject.schematic.view.panY };
        stage.setPointerCapture(event.pointerId);
        return;
    }
    if (activeSchematicTool === "wire") {
        event.preventDefault();
        if (pin) {
            if (!schematicWireDraft) {
                schematicWireDraft = { start: pin, waypoints: [], cursor: point };
                selectedSchematicPin = { ...pin, kind: "pin" };
                document.querySelector("[data-schematic-status]").textContent = "Select a destination pin. Click empty grid points to add wire bends.";
            } else {
                finishSchematicWire(pin);
            }
        } else if (schematicWireDraft) {
            schematicWireDraft.waypoints.push(snapSchematicPoint(point));
        }
        renderPcbSchematic();
        return;
    }
    if (activeSchematicTool === "label") {
        event.preventDefault();
        if (!pin) {
            document.querySelector("[data-schematic-status]").textContent = "Click a component pin to attach a net label.";
            return;
        }
        const name = document.querySelector("[data-schematic-label-input]").value.trim();
        if (!name) {
            document.querySelector("[data-schematic-status]").textContent = "Enter a net name in the toolbar first.";
            document.querySelector("[data-schematic-label-input]").focus();
            return;
        }
        const component = activePcbSchematic()?.components.find((item) => item.id === pin.componentId);
        const position = component && getSchematicPinPosition(component, pin.pinIndex);
        if (position) addSchematicLabel(name, position, pin);
        return;
    }
    if (pin) {
        selectedSchematicPin = { ...pin, kind: "pin" };
        if (!selectedSchematicComponentIds.has(pin.componentId)) {
            selectedSchematicComponentIds = new Set([pin.componentId]);
        }
        renderPcbSchematic();
        return;
    }
    if (componentTarget) {
        const componentId = componentTarget.dataset.schematicComponent;
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            if (selectedSchematicComponentIds.has(componentId)) selectedSchematicComponentIds.delete(componentId);
            else selectedSchematicComponentIds.add(componentId);
        } else if (!selectedSchematicComponentIds.has(componentId)) {
            selectedSchematicComponentIds = new Set([componentId]);
        }
        selectedSchematicPin = null;
        const sheet = activePcbSchematic();
        const selected = sheet.components.filter((component) => selectedSchematicComponentIds.has(component.id));
        if (selected.length && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            schematicPointer = {
                mode: "move",
                pointerId: event.pointerId,
                start: point,
                origins: selected.map((component) => ({ id: component.id, x: component.x, y: component.y })),
                moved: false
            };
            stage.setPointerCapture(event.pointerId);
        }
        if (selected.length) stage.setPointerCapture(event.pointerId);
        renderPcbSchematic();
        return;
    }
    if (event.target.closest("[data-schematic-wire]")) return;
    selectedSchematicComponentIds.clear();
    selectedSchematicPin = null;
    renderPcbSchematic();
});
document.querySelector("[data-schematic-stage]").addEventListener("pointermove", (event) => {
    const point = getSchematicSvgPoint(event);
    if (!point) return;
    if (schematicWireDraft) {
        schematicWireDraft.cursor = point;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-schematic-pin]");
        schematicSnapTarget = target ? `${target.dataset.componentId}:${target.dataset.pinIndex}` : null;
        document.querySelectorAll("[data-schematic-pin]").forEach((pin) => {
            pin.classList.toggle("is-snap-target", `${pin.dataset.componentId}:${pin.dataset.pinIndex}` === schematicSnapTarget);
        });
        renderSchematicDraftOnly();
    }
    if (!schematicPointer || schematicPointer.pointerId !== event.pointerId) return;
    if (schematicPointer.mode === "pan") {
        const view = activePcbProject.schematic.view;
        const scale = view.zoom;
        view.panX = schematicPointer.panX - (event.clientX - schematicPointer.startX) / scale;
        view.panY = schematicPointer.panY - (event.clientY - schematicPointer.startY) / scale;
        renderPcbSchematic();
    } else if (schematicPointer.mode === "move") {
        const sheet = activePcbSchematic();
        const dx = point.x - schematicPointer.start.x;
        const dy = point.y - schematicPointer.start.y;
        if (!schematicPointer.moved && Math.abs(dx) + Math.abs(dy) >= 2) {
            recordPcbHistory();
            schematicPointer.moved = true;
        }
        if (!schematicPointer.moved) return;
        schematicPointer.origins.forEach((origin) => {
            const component = sheet.components.find((item) => item.id === origin.id);
            if (!component) return;
            const snapped = snapSchematicPoint({ x: origin.x + dx, y: origin.y + dy });
            component.x = snapped.x;
            component.y = snapped.y;
        });
        renderPcbSchematic();
    }
});
document.querySelector("[data-schematic-stage]").addEventListener("pointerup", (event) => {
    if (schematicPointer?.pointerId !== event.pointerId) return;
    if (schematicPointer.mode === "move" && schematicPointer.moved) schedulePcbSave();
    if (schematicPointer.mode === "pan") schedulePcbSave();
    schematicPointer = null;
});
document.querySelector("[data-schematic-stage]").addEventListener("pointercancel", () => {
    schematicPointer = null;
});
document.querySelector("[data-schematic-stage]").addEventListener("wheel", (event) => {
    if (!activePcbProject) return;
    event.preventDefault();
    const view = activePcbProject.schematic.view;
    const nextZoom = Math.max(0.35, Math.min(2.5, view.zoom + (event.deltaY < 0 ? 0.08 : -0.08)));
    if (nextZoom === view.zoom) return;
    const stage = document.querySelector("[data-schematic-stage]");
    const rect = stage.getBoundingClientRect();
    const centerX = view.panX - stage.clientWidth / (2 * view.zoom);
    const centerY = view.panY - stage.clientHeight / (2 * view.zoom);
    const worldX = centerX + (event.clientX - rect.left) / view.zoom;
    const worldY = centerY + (event.clientY - rect.top) / view.zoom;
    view.zoom = nextZoom;
    view.panX = worldX - (event.clientX - rect.left - stage.clientWidth / 2) / nextZoom;
    view.panY = worldY - (event.clientY - rect.top - stage.clientHeight / 2) / nextZoom;
    renderPcbSchematic();
    schedulePcbSave();
}, { passive: false });
document.querySelector("[data-schematic-stage]").addEventListener("keydown", (event) => {
    if (event.code === "Space") schematicSpacePressed = true;
    if ((event.key === "Delete" || event.key === "Backspace") && selectedSchematicComponentIds.size) {
        event.preventDefault();
        deleteSelectedSchematicComponents();
    }
    if ((event.key === "r" || event.key === "R") && selectedSchematicComponentIds.size === 1) {
        document.querySelector("[data-schematic-rotate]").click();
    }
    if (event.key === "Escape" && schematicWireDraft) {
        schematicWireDraft = null;
        setSchematicTool("select");
        document.querySelector("[data-schematic-status]").textContent = "Wire drawing cancelled.";
    }
});
document.querySelector("[data-schematic-stage]").addEventListener("keyup", (event) => {
    if (event.code === "Space") schematicSpacePressed = false;
});
window.addEventListener("keyup", (event) => {
    if (event.code === "Space") schematicSpacePressed = false;
});
document.querySelectorAll("[data-layout-tool]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!activePcbProject) return;
        const layout = activePcbProject.layout;
        const tool = button.dataset.layoutTool;
        if (layout.activeTool === tool) return;
        layout.activeTool = tool;
        pcbLayoutDraft = null;
        schedulePcbSave();
        renderPcbLayout();
        document.querySelector("[data-layout-status]").textContent = tool === "track"
            ? "Select a connected pad, add route bends, then select the matching net's destination pad."
            : `${button.textContent.trim()} tool active.`;
        document.querySelector("[data-layout-stage]").focus();
    });
});
document.querySelector("[data-layout-active-layer]").addEventListener("change", (event) => {
    const layout = activePcbProject?.layout;
    if (!layout || !layout.layers.some((layer) => layer.id === event.currentTarget.value && layer.type === "copper")) return;
    layout.activeLayerId = event.currentTarget.value;
    renderPcbLayout();
    schedulePcbSave();
});
document.querySelector("[data-layout-active-net]").addEventListener("change", () => {
    document.querySelector("[data-layout-status]").textContent = "Active net selected for track routing, vias, and copper zones.";
    renderPcbLayout();
});
document.querySelector("[data-layout-track-width]").addEventListener("change", (event) => {
    const width = Number(event.currentTarget.value);
    if (!activePcbProject || !Number.isFinite(width) || width < 0.1 || width > 5) return;
    recordPcbHistory();
    activePcbProject.layout.trackWidth = width;
    renderPcbLayout();
    schedulePcbSave();
});
pcbEditor.addEventListener("click", (event) => {
    if (event.target.closest("[data-run-pcb-validation]")) {
        if (!activePcbProject) return;
        pcbValidationHighlight = null;
        pcbValidationIssues = validatePcbProject(activePcbProject);
        pcbValidationDirty = false;
        renderPcbValidationPanel();
        return;
    }
    const issueButton = event.target.closest("[data-validation-issue]");
    if (issueButton) focusPcbValidationIssue(issueButton.dataset.validationIssue);
});
document.querySelector("[data-layout-check]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    pcbConnectivityLayout = layout;
    pcbConnectivityAnalysis = analyzePcbConnectivity(layout);
    const result = pcbConnectivityAnalysis;
    const assigned = [...result.netPadEntries.values()].reduce((sum, pads) => sum + pads.length, 0);
    document.querySelector("[data-layout-status]").textContent =
        `Connectivity checked: ${result.unroutedPads} airwires, ${result.unassignedPins} unassigned pins, ` +
        `${result.clearanceConflicts.length} clearance warning(s).`;
    document.querySelector("[data-layout-connectivity]").textContent =
        `${[...result.padStates.values()].filter((state) => state === "connected").length}/${assigned} pads connected · ` +
        `${result.unroutedPads} airwires · ${result.unassignedPins} unassigned pins · ` +
        `${result.clearanceConflicts.length} clearance warnings.`;
    renderPcbLayout();
});
document.querySelector("[data-layout-suggest]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    pcbRouteSuggestions = suggestPcbLayoutRoutes(layout);
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = pcbRouteSuggestions.length
        ? `${pcbRouteSuggestions.length} route suggestion(s) shown. Choose a conflict-free route from the inspector.`
        : "No unrouted pads on synchronized multi-pin nets need a suggestion.";
});
document.querySelector("[data-layout-performance]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    recordPcbHistory();
    layout.performanceMode = !layout.performanceMode;
    schedulePcbSave();
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = layout.performanceMode
        ? "Low-end mode is on: the grid texture and decorative details are reduced."
        : "Full layout rendering restored.";
});
document.querySelector("[data-layout-suggestions]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-layout-use-suggestion]");
    const layout = activePcbProject?.layout;
    const suggestion = pcbRouteSuggestions[Number(button?.dataset.layoutUseSuggestion)];
    if (!layout || !suggestion || suggestion.conflicts.length) return;
    const conflicts = getPcbLayoutClearanceConflicts(layout, suggestion.route);
    if (conflicts.length) {
        document.querySelector("[data-layout-status]").textContent =
            `Suggested route is no longer clear (${conflicts.length} clearance conflict(s)).`;
        return;
    }
    recordPcbHistory();
    layout.tracks.push({
        id: `track-${layout.nextTrackId++}`,
        netId: suggestion.route.netId,
        layerId: suggestion.route.layerId,
        width: suggestion.route.width,
        points: suggestion.route.points.map((point) => ({ ...point })),
        startPad: { ...suggestion.startPad },
        endPad: { ...suggestion.endPad }
    });
    pcbRouteSuggestions = [];
    schedulePcbSave();
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = `Suggested ${suggestion.netName} route added.`;
});
document.querySelector("[data-layout-selected-track-width]").addEventListener("change", (event) => {
    const layout = activePcbProject?.layout;
    const track = layout?.tracks.find((item) => item.id === selectedPcbLayoutTrackId);
    const width = Number(event.currentTarget.value);
    if (!layout || !track || !Number.isFinite(width) || width < 0.1 || width > 5) return;
    if (track.width === width) return;
    recordPcbHistory();
    track.width = width;
    schedulePcbSave();
    renderPcbLayout();
});
document.querySelector("[data-layout-selected-track-layer]").addEventListener("change", (event) => {
    const layout = activePcbProject?.layout;
    const track = layout?.tracks.find((item) => item.id === selectedPcbLayoutTrackId);
    const layer = layout?.layers.find((item) => item.id === event.currentTarget.value && item.type === "copper");
    if (!layout || !track || !layer || track.layerId === layer.id) return;
    recordPcbHistory();
    track.layerId = layer.id;
    schedulePcbSave();
    renderPcbLayout();
});
document.querySelector("[data-layout-track-delete]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout || !layout.tracks.some((track) => track.id === selectedPcbLayoutTrackId)) return;
    recordPcbHistory();
    layout.tracks = layout.tracks.filter((track) => track.id !== selectedPcbLayoutTrackId);
    selectedPcbLayoutTrackId = null;
    schedulePcbSave();
    renderPcbLayout();
});
document.querySelector("[data-layout-grid]").addEventListener("change", (event) => {
    const grid = Number(event.currentTarget.value);
    if (!activePcbProject || !Number.isFinite(grid) || grid < 0.1 || grid > 10) return;
    activePcbProject.layout.grid = grid;
    renderPcbLayout();
    schedulePcbSave();
});
document.querySelector("[data-layout-sync]").addEventListener("click", () => {
    if (!activePcbProject) return;
    recordPcbHistory();
    syncPcbLayoutFromSchematic();
});
document.querySelector("[data-layout-add-layer]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    const innerLayers = layout.layers.filter((layer) => layer.type === "copper" && layer.side === "inner");
    if (innerLayers.length >= 6) return;
    recordPcbHistory();
    const index = innerLayers.length + 1;
    const layer = {
        id: `inner-custom-${layout.nextLayerId++}`,
        name: `Inner ${index}`,
        type: "copper",
        side: "inner",
        visible: true
    };
    layout.layers.splice(layout.layers.findIndex((item) => item.id === "bottom-copper"), 0, layer);
    layout.activeLayerId = layer.id;
    renderPcbLayout();
    document.querySelector("[data-layout-status]").textContent = `${layer.name} copper layer added.`;
    schedulePcbSave();
});
document.querySelector("[data-layout-layer-list]").addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-layout-layer-visible]");
    if (!checkbox || !activePcbProject) return;
    const layer = activePcbProject.layout.layers.find((item) => item.id === checkbox.dataset.layoutLayerVisible);
    if (!layer) return;
    recordPcbHistory();
    layer.visible = checkbox.checked;
    renderPcbLayout();
    schedulePcbSave();
});
document.querySelectorAll("[data-layout-align]").forEach((button) => {
    button.addEventListener("click", () => {
        const layout = activePcbProject?.layout;
        const selected = layout?.footprints.filter((item) => selectedPcbLayoutIds.has(item.id));
        if (!layout || !selected?.length) {
            document.querySelector("[data-layout-status]").textContent = "Select one or more footprints to align.";
            return;
        }
        recordPcbHistory();
        if (button.dataset.layoutAlign === "grid") {
            selected.forEach((item) => {
                const point = layoutSnapPoint(item);
                item.x = point.x;
                item.y = point.y;
            });
        } else if (selected.length > 1) {
            const axis = button.dataset.layoutAlign === "horizontal" ? "y" : "x";
            const value = selected[0][axis];
            selected.forEach((item) => { item[axis] = value; });
        }
        renderPcbLayout();
        schedulePcbSave();
    });
});
document.querySelector("[data-layout-rotate]").addEventListener("click", () => {
    const footprint = activePcbProject?.layout.footprints.find((item) => selectedPcbLayoutIds.has(item.id));
    if (!footprint) return;
    recordPcbHistory();
    footprint.rotation = (footprint.rotation + 90) % 360;
    updatePcbLayoutTrackEndpoints(activePcbProject.layout, new Set([footprint.id]));
    schedulePcbSave();
    renderPcbLayout();
});
document.querySelector("[data-layout-delete]").addEventListener("click", () => {
    const layout = activePcbProject?.layout;
    if (!layout || !selectedPcbLayoutIds.size) return;
    recordPcbHistory();
    layout.footprints = layout.footprints.filter((item) => !selectedPcbLayoutIds.has(item.id));
    layout.tracks = layout.tracks.filter((track) =>
        !selectedPcbLayoutIds.has(track.startPad?.footprintId) && !selectedPcbLayoutIds.has(track.endPad?.footprintId));
    selectedPcbLayoutIds.clear();
    selectedPcbLayoutTrackId = null;
    schedulePcbSave();
    renderPcbLayout();
});
document.querySelectorAll("[data-layout-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
        const layout = activePcbProject?.layout;
        if (!layout) return;
        if (button.dataset.layoutZoom === "fit") {
            layout.zoom = 1;
            layout.panX = activePcbProject.width / 2;
            layout.panY = activePcbProject.height / 2;
        } else {
            layout.zoom = Math.max(0.4, Math.min(4, layout.zoom + (button.dataset.layoutZoom === "in" ? 0.15 : -0.15)));
        }
        renderPcbLayout();
        schedulePcbSave();
    });
});
document.querySelector("[data-layout-stage]").addEventListener("pointerdown", (event) => {
    if (!activePcbProject || event.button > 1) return;
    const stage = event.currentTarget;
    const point = getLayoutSvgPoint(event);
    if (!point) return;
    const layout = activePcbProject.layout;
    const pad = getLayoutPadTarget(event.target) ||
        (layout.activeTool === "track" || layout.activeTool === "via" ? findNearestLayoutPad(point, layout) : null);
    const footprintTarget = event.target.closest("[data-layout-footprint]");
    const trackHandle = event.target.closest("[data-layout-track-handle]");
    const trackTarget = event.target.closest("[data-layout-track]");
    if (event.button === 1 || pcbLayoutSpacePressed) {
        event.preventDefault();
        pcbLayoutPointer = {
            mode: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            panX: layout.panX, panY: layout.panY
        };
        stage.setPointerCapture(event.pointerId);
        return;
    }
    if (trackHandle && layout.activeTool === "select") {
        const trackId = trackHandle.dataset.layoutTrackHandle;
        const pointIndex = Number(trackHandle.dataset.trackPointIndex);
        const track = layout.tracks.find((item) => item.id === trackId);
        if (!track || !Number.isInteger(pointIndex)) return;
        selectedPcbLayoutTrackId = trackId;
        selectedPcbLayoutIds.clear();
        recordPcbHistory();
        pcbLayoutPointer = { mode: "edit-track-point", pointerId: event.pointerId, trackId, pointIndex };
        stage.setPointerCapture(event.pointerId);
        renderPcbLayout();
        return;
    }
    if (layout.activeTool === "track") {
        event.preventDefault();
        if (pad) {
            if (!pcbLayoutDraft) {
                const netId = pad.netId;
                if (!netId) {
                    document.querySelector("[data-layout-status]").textContent = "This pad has no schematic net. Connect it in the schematic and sync before routing.";
                    return;
                }
                const footprint = layout.footprints.find((item) => item.id === pad.footprintId);
                const padData = footprint?.pads.find((item) => item.number === pad.number);
                if (!footprint || !padData) return;
                pcbLayoutDraft = {
                    type: "track",
                    startPad: pad,
                    netId,
                    points: [getLayoutPadPosition(footprint, padData)],
                    waypoints: [],
                    cursor: point
                };
            } else {
                completePcbLayoutTrack(pad);
            }
        } else if (pcbLayoutDraft?.type === "track") {
            const waypoint = layoutSnapPoint(point);
            const points = [...pcbLayoutDraft.waypoints];
            if (!points.length || points[points.length - 1].x !== waypoint.x || points[points.length - 1].y !== waypoint.y) {
                pcbLayoutDraft.waypoints.push(waypoint);
            }
        }
        renderPcbLayout();
        return;
    }
    if (layout.activeTool === "via") {
        const netId = pad?.netId || document.querySelector("[data-layout-active-net]").value;
        if (!netId) {
            document.querySelector("[data-layout-status]").textContent = "Select a schematic net before placing a via.";
            return;
        }
        const via = {
            id: `via-${layout.nextViaId++}`,
            ...layoutSnapPoint(pad ? (() => {
                const footprint = layout.footprints.find((item) => item.id === pad.footprintId);
                return getLayoutPadPosition(footprint, footprint.pads.find((item) => item.number === pad.number));
            })() : point),
            diameter: layout.viaDiameter,
            netId,
            layers: layout.layers.filter((layer) => layer.type === "copper").map((layer) => layer.id)
        };
        const conflicts = getPcbLayoutViaClearanceConflicts(layout, via);
        if (conflicts.length) {
            document.querySelector("[data-layout-status]").textContent =
                `Via placement blocked by ${conflicts.length} clearance conflict(s).`;
            return;
        }
        recordPcbHistory();
        layout.vias.push(via);
        schedulePcbSave();
        renderPcbLayout();
        document.querySelector("[data-layout-status]").textContent = "Through-via added across copper layers.";
        return;
    }
    if (layout.activeTool === "zone") {
        if (!document.querySelector("[data-layout-active-net]").value) {
            document.querySelector("[data-layout-status]").textContent = "Select a schematic net before drawing a copper zone.";
            return;
        }
        if (!pcbLayoutDraft) {
            pcbLayoutDraft = { type: "zone", start: layoutSnapPoint(point), cursor: point };
        } else {
            const end = layoutSnapPoint(point);
            const start = pcbLayoutDraft.start;
            const points = [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }];
            if (Math.abs(end.x - start.x) < layout.grid || Math.abs(end.y - start.y) < layout.grid) return;
            const zone = {
                id: `zone-${layout.nextZoneId}`,
                netId: document.querySelector("[data-layout-active-net]").value,
                layerId: layout.activeLayerId,
                points
            };
            const conflicts = getPcbLayoutZoneClearanceConflicts(layout, zone);
            if (conflicts.length) {
                document.querySelector("[data-layout-status]").textContent =
                    `Copper zone overlaps ${conflicts.length} foreign-net object(s): ${conflicts.slice(0, 3).join(", ")}.`;
                return;
            }
            recordPcbHistory();
            layout.nextZoneId += 1;
            layout.zones.push(zone);
            pcbLayoutDraft = null;
            schedulePcbSave();
            renderPcbLayout();
            document.querySelector("[data-layout-status]").textContent = "Copper zone added. Refill it after moving parts or editing tracks.";
        }
        renderPcbLayout();
        return;
    }
    if (layout.activeTool === "outline") {
        if (!pcbLayoutDraft) {
            pcbLayoutDraft = { type: "outline", start: layoutSnapPoint(point), cursor: point };
        } else {
            const end = layoutSnapPoint(point);
            const start = pcbLayoutDraft.start;
            if (Math.abs(end.x - start.x) < 5 || Math.abs(end.y - start.y) < 5) return;
            recordPcbHistory();
            layout.outline = [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }];
            layout.outlineMode = "custom";
            pcbLayoutDraft = null;
            renderPcbLayout();
            document.querySelector("[data-layout-status]").textContent = "Board outline updated.";
            schedulePcbSave();
        }
        renderPcbLayout();
        return;
    }
    if (layout.activeTool === "measure") {
        if (!pcbLayoutDraft) pcbLayoutDraft = { type: "measure", start: layoutSnapPoint(point), cursor: point };
        else {
            recordPcbHistory();
            layout.measurements.push({
                id: `measure-${layout.nextMeasurementId++}`,
                start: pcbLayoutDraft.start,
                end: layoutSnapPoint(point)
            });
            pcbLayoutDraft = null;
            document.querySelector("[data-layout-status]").textContent = "Measurement added in millimetres.";
            schedulePcbSave();
        }
        renderPcbLayout();
        return;
    }
    if (footprintTarget) {
        const id = footprintTarget.dataset.layoutFootprint;
        selectedPcbLayoutTrackId = null;
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            if (selectedPcbLayoutIds.has(id)) selectedPcbLayoutIds.delete(id);
            else selectedPcbLayoutIds.add(id);
        } else if (!selectedPcbLayoutIds.has(id)) selectedPcbLayoutIds = new Set([id]);
        const selected = layout.footprints.filter((item) => selectedPcbLayoutIds.has(item.id));
        if (selected.length) {
            pcbLayoutPointer = {
                mode: "move", pointerId: event.pointerId, start: point, moved: false,
                origins: selected.map((item) => ({ id: item.id, x: item.x, y: item.y }))
            };
            stage.setPointerCapture(event.pointerId);
        }
        renderPcbLayout();
        return;
    }
    if (trackTarget && layout.activeTool === "select") {
        selectedPcbLayoutTrackId = trackTarget.dataset.layoutTrack;
        selectedPcbLayoutIds.clear();
        renderPcbLayout();
        return;
    }
    selectedPcbLayoutIds.clear();
    selectedPcbLayoutTrackId = null;
    renderPcbLayout();
});
document.querySelector("[data-layout-stage]").addEventListener("pointermove", (event) => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    const point = getLayoutSvgPoint(event);
    if (!point) return;
    if (pcbLayoutDraft) {
        pcbLayoutDraft.cursor = point;
        renderPcbLayout();
    }
    if (!pcbLayoutPointer || pcbLayoutPointer.pointerId !== event.pointerId) return;
    if (pcbLayoutPointer.mode === "pan") {
        const widthPx = Math.max(100, event.currentTarget.clientWidth);
        const scale = widthPx / (activePcbProject.width + 12) * layout.zoom;
        layout.panX = pcbLayoutPointer.panX - (event.clientX - pcbLayoutPointer.startX) / scale;
        layout.panY = pcbLayoutPointer.panY - (event.clientY - pcbLayoutPointer.startY) / scale;
        renderPcbLayout();
    } else if (pcbLayoutPointer.mode === "move") {
        const dx = point.x - pcbLayoutPointer.start.x;
        const dy = point.y - pcbLayoutPointer.start.y;
        if (!pcbLayoutPointer.moved && Math.abs(dx) + Math.abs(dy) >= layout.grid / 2) {
            recordPcbHistory();
            pcbLayoutPointer.moved = true;
        }
        if (!pcbLayoutPointer.moved) return;
        pcbLayoutPointer.origins.forEach((origin) => {
            const footprint = layout.footprints.find((item) => item.id === origin.id);
            if (!footprint) return;
            const definition = getPcbPartDefinition(footprint.type);
            const snapped = layoutSnapPoint({ x: origin.x + dx, y: origin.y + dy });
            footprint.x = Math.max(definition.width / 2, Math.min(activePcbProject.width - definition.width / 2, snapped.x));
            footprint.y = Math.max(definition.height / 2, Math.min(activePcbProject.height - definition.height / 2, snapped.y));
        });
        updatePcbLayoutTrackEndpoints(layout, new Set(pcbLayoutPointer.origins.map((origin) => origin.id)));
        renderPcbLayout();
    } else if (pcbLayoutPointer.mode === "edit-track-point") {
        const track = layout.tracks.find((item) => item.id === pcbLayoutPointer.trackId);
        if (!track || !track.points[pcbLayoutPointer.pointIndex]) return;
        track.points[pcbLayoutPointer.pointIndex] = layoutSnapPoint(point);
        renderPcbLayout();
    }
});
document.querySelector("[data-layout-stage]").addEventListener("pointerup", (event) => {
    if (!pcbLayoutPointer || pcbLayoutPointer.pointerId !== event.pointerId) return;
    const changed = pcbLayoutPointer.moved || pcbLayoutPointer.mode === "edit-track-point";
    if (changed) {
        schedulePcbSave();
        renderPcbLayout();
    }
    pcbLayoutPointer = null;
});
document.querySelector("[data-layout-stage]").addEventListener("pointercancel", () => { pcbLayoutPointer = null; });
document.querySelector("[data-layout-stage]").addEventListener("wheel", (event) => {
    const layout = activePcbProject?.layout;
    if (!layout) return;
    event.preventDefault();
    const point = getLayoutSvgPoint(event);
    if (!point) return;
    const stage = event.currentTarget;
    const oldZoom = layout.zoom;
    const nextZoom = Math.max(0.4, Math.min(4, oldZoom + (event.deltaY < 0 ? 0.12 : -0.12)));
    if (nextZoom === oldZoom) return;
    const rect = stage.getBoundingClientRect();
    const scale = Math.min(stage.clientWidth / (activePcbProject.width + 12),
        stage.clientHeight / (activePcbProject.height + 12));
    const worldX = point.x;
    const worldY = point.y;
    const nextScale = scale * nextZoom;
    layout.zoom = nextZoom;
    layout.panX = worldX - (event.clientX - rect.left - stage.clientWidth / 2) / nextScale;
    layout.panY = worldY - (event.clientY - rect.top - stage.clientHeight / 2) / nextScale;
    renderPcbLayout();
    schedulePcbSave();
}, { passive: false });
document.querySelector("[data-layout-stage]").addEventListener("keydown", (event) => {
    if (event.code === "Space") pcbLayoutSpacePressed = true;
    if ((event.key === "Delete" || event.key === "Backspace") && selectedPcbLayoutIds.size) {
        event.preventDefault();
        document.querySelector("[data-layout-delete]").click();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedPcbLayoutTrackId) {
        event.preventDefault();
        document.querySelector("[data-layout-track-delete]").click();
    }
    if ((event.key === "r" || event.key === "R") && selectedPcbLayoutIds.size === 1) {
        document.querySelector("[data-layout-rotate]").click();
    }
    if (event.key === "Escape" && pcbLayoutDraft) {
        pcbLayoutDraft = null;
        renderPcbLayout();
        document.querySelector("[data-layout-status]").textContent = "Current layout operation cancelled.";
    }
});
document.querySelector("[data-layout-stage]").addEventListener("keyup", (event) => {
    if (event.code === "Space") pcbLayoutSpacePressed = false;
});
window.addEventListener("keyup", (event) => {
    if (event.code === "Space") pcbLayoutSpacePressed = false;
});
document.querySelector("[data-pcb-instance-reference]").addEventListener("change", (event) => {
    const part = activePcbProject?.components.find((item) => item.id === selectedPcbPartId);
    const reference = event.currentTarget.value.trim().toUpperCase();
    if (!part || !/^[A-Z0-9-]{1,8}$/.test(reference) ||
        activePcbProject.components.some((item) => item.id !== part.id && item.reference === reference)) {
        event.currentTarget.value = part?.reference || "";
        document.querySelector("[data-pcb-placement-status]").textContent = "Reference must be unique and use up to 8 letters, numbers, or hyphens.";
        return;
    }
    if (reference === part.reference) return;
    recordPcbHistory();
    part.reference = reference;
    renderPcbBoard();
    schedulePcbSave();
});
document.querySelector("[data-pcb-instance-value]").addEventListener("change", (event) => {
    const part = activePcbProject?.components.find((item) => item.id === selectedPcbPartId);
    if (!part) return;
    const value = event.currentTarget.value.trim().slice(0, 32);
    if (value === (part.value || "")) return;
    recordPcbHistory();
    part.value = value;
    renderPcbBoard();
    schedulePcbSave();
});
document.querySelector("[data-pcb-component-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const type = editingPcbCustomType || `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const pinCount = Number(formData.get("pins"));
    const definition = {
        name: String(formData.get("name")).trim(),
        category: String(formData.get("category")),
        prefix: String(formData.get("prefix")).trim().toUpperCase(),
        pins: pinCount,
        width: Number(formData.get("width")),
        height: Number(formData.get("height")),
        color: customPcbParts[type]?.color || "#587866",
        description: String(formData.get("description")).trim(),
        pinNames: String(formData.get("pinNames")).split(",").map((pin) => pin.trim()).filter(Boolean),
        electrical: String(formData.get("specs")).trim() ? { specification: String(formData.get("specs")).trim() } : {},
        footprint: { type: customPcbParts[type]?.footprint.type || "custom-through-hole", pitch: 2.54 }
    };
    if (definition.pinNames.length > pinCount) {
        document.querySelector("[data-pcb-component-status]").textContent = `Enter no more than ${pinCount} pin names.`;
        return;
    }
    try {
        const savedDefinition = normalizeCustomPcbPart(type, definition);
        const updatedCustomParts = { ...customPcbParts, [type]: savedDefinition };
        localStorage.setItem(pcbComponentLibraryStorageKey, JSON.stringify(updatedCustomParts));
        customPcbParts = updatedCustomParts;
        selectedPcbLibraryType = type;
        editingPcbCustomType = null;
        document.querySelector("[data-pcb-component-dialog]").close();
        renderPcbComponentCategories();
        renderPcbComponentLibrary();
        if (activePcbProject) {
            renderPcbBoard();
            schedulePcbSave();
        }
    } catch (error) {
        console.warn("Unable to save the custom PCB component.", error);
        document.querySelector("[data-pcb-component-status]").textContent =
            "Could not save this component in browser storage. Check available storage and try again.";
    }
});
function openPcbComponentEditor(type = null) {
    const dialog = document.querySelector("[data-pcb-component-dialog]");
    const form = document.querySelector("[data-pcb-component-form]");
    const definition = type ? getPcbPartDefinition(type) : null;
    if (type && !Object.hasOwn(customPcbParts, type)) return;
    editingPcbCustomType = type;
    form.reset();
    document.querySelector("[data-pcb-component-dialog] h2").textContent = type ? "Edit component" : "Create component";
    document.querySelector("[data-pcb-component-status]").textContent = "";
    if (definition) {
        for (const [field, value] of Object.entries({
            name: definition.name,
            category: definition.category,
            prefix: definition.prefix,
            pins: definition.pins,
            width: definition.width,
            height: definition.height,
            specs: Object.values(definition.electrical).join(" · "),
            pinNames: definition.pinNames.join(", "),
            description: definition.description
        })) form.elements[field].value = String(value);
    } else {
        form.elements.category.value = "Modules";
    }
    dialog.showModal();
}
document.querySelector("[data-pcb-close-component]").addEventListener("click", () => {
    document.querySelector("[data-pcb-component-dialog]").close();
});
document.querySelector("[data-pcb-cancel-component]").addEventListener("click", () => {
    document.querySelector("[data-pcb-component-dialog]").close();
});
document.querySelector("[data-pcb-component-dialog]").addEventListener("click", (event) => event.stopPropagation());
document.querySelector("[data-pcb-component-dialog]").addEventListener("cancel", (event) => {
    event.preventDefault();
    event.currentTarget.close();
});
document.addEventListener("keydown", (event) => {
    const dialog = document.querySelector("[data-pcb-component-dialog]");
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
}, true);
document.querySelector("[data-pcb-save]").addEventListener("click", savePcbProject);
document.querySelector("[data-pcb-open]").addEventListener("click", openPcbProjectManager);
document.querySelector("[data-pcb-manufacture]").addEventListener("click", openPcbManufacturingDialog);
document.querySelector("[data-pcb-manufacturing-close]").addEventListener("click", () => {
    document.querySelector("[data-pcb-manufacturing-dialog]").close();
});
document.querySelector("[data-pcb-manufacturing-dialog]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("[data-pcb-manufacturing-dialog]").addEventListener("cancel", (event) => {
    event.preventDefault();
    event.currentTarget.close();
});
document.querySelector("[data-pcb-manufacturing-layers]").addEventListener("change", () => {
    const config = readPcbManufacturingConfiguration();
    invalidatePcbManufacturingPreview();
    schedulePcbSave();
    checkPcbManufacturingReadiness(config);
});
document.querySelectorAll("[data-mfg-output], [data-pcb-manufacturing-dialog] input[type='number']")
    .forEach((input) => input.addEventListener("change", () => {
        const config = readPcbManufacturingConfiguration();
        invalidatePcbManufacturingPreview();
        checkPcbManufacturingReadiness(config);
        schedulePcbSave();
    }));
document.querySelector("[data-mfg-validate]").addEventListener("click", () => {
    const config = readPcbManufacturingConfiguration();
    const report = checkPcbManufacturingReadiness(config);
    schedulePcbSave();
    if (!report.errors.length) document.querySelector("[data-mfg-preview-status]").textContent =
        "Board dimensions, outline, and basic connectivity checks completed.";
});
document.querySelector("[data-mfg-preview]").addEventListener("click", preparePcbManufacturingPreview);
document.querySelector("[data-mfg-files]").addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-mfg-preview-file]");
    if (previewButton) {
        pcbManufacturingSelectedFile = previewButton.dataset.mfgPreviewFile;
        renderPcbManufacturingPreview();
        return;
    }
    const downloadButton = event.target.closest("[data-mfg-download-file]");
    if (!downloadButton) return;
    const file = pcbManufacturingFiles.find((item) => item.path === downloadButton.dataset.mfgDownloadFile);
    if (!file) return;
    downloadCadFile(file.path, file.content, file.path.endsWith(".json") ? "application/json" : "text/plain");
    recordPcbManufacturingExport("File downloaded", [file], pcbManufacturingWarnings.length);
});
document.querySelector("[data-mfg-package]").addEventListener("click", () => {
    if (!activePcbProject || !pcbManufacturingFiles.length) return;
    try {
        const archive = createPcbManufacturingZip(pcbManufacturingFiles);
        const safeName = activePcbProject.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "pcb-project";
        downloadCadFile(`${safeName}-manufacturing.zip`, archive, "application/zip");
        recordPcbManufacturingExport("Project package downloaded", pcbManufacturingFiles, pcbManufacturingWarnings.length);
        document.querySelector("[data-mfg-preview-status]").textContent =
            `Packaged ${pcbManufacturingFiles.length} generated file(s) with the export warnings documented.`;
    } catch (error) {
        console.warn("Unable to package PCB manufacturing outputs.", error);
        document.querySelector("[data-mfg-preview-status]").textContent = error.message || "Project packaging failed.";
    }
});
document.querySelector("[data-pcb-project-dialog]").addEventListener("click", (event) => {
    event.stopPropagation();
});
document.querySelector("[data-pcb-project-dialog]").addEventListener("cancel", (event) => {
    event.preventDefault();
    event.currentTarget.close();
});
document.addEventListener("keydown", (event) => {
    const dialog = document.querySelector("[data-pcb-project-dialog]");
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
}, true);
document.querySelector("[data-pcb-close-projects]").addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelector("[data-pcb-project-dialog]").close();
});
document.querySelector("[data-pcb-new-project]").addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelector("[data-pcb-project-dialog]").close();
    if (activePcbProject) savePcbProject();
    openPcbSetup();
});
document.querySelector("[data-pcb-import]").addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelector("[data-pcb-project-file]").click();
});
document.querySelector("[data-pcb-project-file]").addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const status = document.querySelector("[data-pcb-project-dialog-status]");
    try {
        const importedData = JSON.parse(await file.text());
        const projectData = importedData.project || importedData;
        const importedCustomParts = projectData.customComponents || importedData.customComponents || {};
        if (!importedCustomParts || typeof importedCustomParts !== "object" || Array.isArray(importedCustomParts)) {
            throw new Error("The project custom components are invalid.");
        }
        const previousCustomParts = customPcbParts;
        const normalizedCustomParts = Object.fromEntries(Object.entries(importedCustomParts).map(([type, definition]) => [
            type, normalizeCustomPcbPart(type, definition)
        ]));
        customPcbParts = { ...customPcbParts, ...normalizedCustomParts };
        let project;
        try {
            project = normalizePcbProject(projectData);
        } catch (error) {
            customPcbParts = previousCustomParts;
            throw error;
        }
        delete project.customComponents;
        try {
            localStorage.setItem(pcbComponentLibraryStorageKey, JSON.stringify(customPcbParts));
        } catch (error) {
            customPcbParts = previousCustomParts;
            throw error;
        }
        project.id = `pcb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        project.createdAt = new Date().toISOString();
        project.updatedAt = project.createdAt;
        const updatedProjects = [...pcbProjects, project];
        persistPcbProjectCollection(updatedProjects);
        pcbProjects = updatedProjects;
        renderPcbComponentCategories();
        renderPcbComponentLibrary();
        status.textContent = `Imported "${project.name}". Open it from the project list.`;
        renderPcbProjectManager();
    } catch (error) {
        console.warn("Unable to import the PCB project.", error);
        status.textContent = "Import failed. Choose a valid PCB Studio project JSON file.";
    } finally {
        event.currentTarget.value = "";
    }
});
document.querySelector("[data-pcb-project-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pcb-project-action]");
    if (!button) return;
    const project = pcbProjects.find((item) => item.id === button.dataset.projectId);
    if (!project) return;
    event.stopPropagation();
    const action = button.dataset.pcbProjectAction;
    const status = document.querySelector("[data-pcb-project-dialog-status]");
    if (action === "open") {
        if (activePcbProject) savePcbProject();
        document.querySelector("[data-pcb-project-dialog]").close();
        startPcbWaterTransition(project);
    } else if (action === "export") {
        downloadPcbProject(project);
        status.textContent = `Exported "${project.name}" as a JSON project file.`;
    } else if (action === "delete") {
        if (!window.confirm(`Delete "${project.name}" from this device? This cannot be undone.`)) return;
        const updatedProjects = pcbProjects.filter((item) => item.id !== project.id);
        try {
            persistPcbProjectCollection(updatedProjects);
            pcbProjects = updatedProjects;
            if (activePcbProject?.id === project.id) {
                activePcbProject = null;
                pcbUndoStack = [];
                pcbRedoStack = [];
                if (updatedProjects.length) {
                    document.querySelector("[data-pcb-project-dialog]").close();
                    startPcbWaterTransition(updatedProjects[updatedProjects.length - 1]);
                    return;
                }
                document.querySelector("[data-pcb-project-dialog]").close();
                pcbEditor.hidden = true;
                openPcbSetup();
                return;
            }
            status.textContent = `Deleted "${project.name}".`;
            renderPcbProjectManager();
        } catch (error) {
            console.warn("Unable to delete the PCB project.", error);
            status.textContent = "Could not delete the project from this device.";
        }
    }
});
document.querySelector("[data-pcb-undo]").addEventListener("click", () => restorePcbHistory(pcbUndoStack, pcbRedoStack));
document.querySelector("[data-pcb-redo]").addEventListener("click", () => restorePcbHistory(pcbRedoStack, pcbUndoStack));
document.querySelectorAll("[data-pcb-mode]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!activePcbProject) return;
        const mode = button.dataset.pcbMode;
        if (!pcbViewModes.includes(mode)) return;
        if (activePcbProject.viewMode === mode) return;
        recordPcbHistory();
        activePcbProject.viewMode = mode;
        renderPcbBoard(true);
        schedulePcbSave();
    });
});
document.querySelectorAll("[data-pcb-view]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!activePcbProject) return;
        const camera = activePcbProject.camera;
        const nextPitch = button.dataset.pcbView === "bottom" ? 180 : button.dataset.pcbView === "side" ? 76 : 0;
        const nextMode = button.dataset.pcbView === "side" ? "3d" : activePcbProject.viewMode;
        if (camera.pitch === nextPitch && activePcbProject.viewMode === nextMode) return;
        recordPcbHistory();
        if (button.dataset.pcbView === "side") activePcbProject.viewMode = "3d";
        camera.pitch = nextPitch;
        renderPcbBoard(true);
        schedulePcbSave();
    });
});
function setPcbZoom(zoom) {
    if (!activePcbProject) return;
    const nextZoom = Math.max(0.6, Math.min(2, zoom));
    if (nextZoom === activePcbProject.camera.zoom) return;
    recordPcbHistory();
    activePcbProject.camera.zoom = nextZoom;
    renderPcbBoard(true);
    schedulePcbSave();
}
document.querySelectorAll("[data-pcb-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!activePcbProject) return;
        const zoom = activePcbProject.camera.zoom;
        if (button.dataset.pcbZoom === "in") setPcbZoom(zoom + 0.1);
        else if (button.dataset.pcbZoom === "out") setPcbZoom(zoom - 0.1);
        else setPcbZoom(1);
    });
});
const pcbBoardStage = document.querySelector(".pcb-board-stage");
pcbBoardStage.addEventListener("pointerdown", (event) => {
    if (!activePcbProject || event.button !== 0 || event.target.closest("button, [data-pcb-component]")) return;
    event.preventDefault();
    pcbPointer = {
        mode: "rotate-board",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        yaw: activePcbProject.camera.yaw,
        pitch: activePcbProject.camera.pitch,
        moved: false
    };
    pcbBoardStage.setPointerCapture(event.pointerId);
    pcbBoardStage.classList.add("is-rotating");
});
pcbBoardStage.addEventListener("pointermove", (event) => {
    if (!pcbPointer || pcbPointer.mode !== "rotate-board" || !activePcbProject) return;
    const deltaX = event.clientX - pcbPointer.startX;
    const deltaY = event.clientY - pcbPointer.startY;
    if (!pcbPointer.moved && (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) recordPcbHistory();
    if (Math.abs(deltaX) <= 1 && Math.abs(deltaY) <= 1) return;
    const camera = activePcbProject.camera;
    camera.yaw = pcbPointer.yaw + deltaX * 0.65;
    if (activePcbProject.viewMode === "3d") {
        camera.pitch = clampPcbPitch(pcbPointer.pitch - deltaY * 0.55);
    }
    animatePcbCamera();
    pcbPointer.moved = true;
});
pcbBoardStage.addEventListener("pointerup", (event) => {
    if (!pcbPointer || pcbPointer.mode !== "rotate-board" || pcbPointer.pointerId !== event.pointerId) return;
    if (pcbPointer.moved) {
        document.querySelector("[data-pcb-placement-status]").textContent = "Board view updated";
        updatePcbViewControls();
        schedulePcbSave();
    }
    pcbPointer = null;
    pcbBoardStage.classList.remove("is-rotating");
});
pcbBoardStage.addEventListener("pointercancel", () => {
    if (pcbPointer?.mode === "rotate-board") {
        pcbPointer = null;
        pcbBoardStage.classList.remove("is-rotating");
    }
});
pcbBoardStage.addEventListener("wheel", (event) => {
    if (!activePcbProject) return;
    event.preventDefault();
    setPcbZoom(activePcbProject.camera.zoom + (event.deltaY < 0 ? 0.08 : -0.08));
}, { passive: false });
pcbBoardStage.addEventListener("keydown", (event) => {
    if (!activePcbProject || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "+" || event.key === "=") setPcbZoom(activePcbProject.camera.zoom + 0.1);
    else if (event.key === "-") setPcbZoom(activePcbProject.camera.zoom - 0.1);
    else {
        recordPcbHistory();
        activePcbProject.camera.yaw += event.key === "ArrowLeft" ? -10 : event.key === "ArrowRight" ? 10 : 0;
        if (activePcbProject.viewMode === "3d") {
            activePcbProject.camera.pitch += event.key === "ArrowUp" ? 10 : event.key === "ArrowDown" ? -10 : 0;
            activePcbProject.camera.pitch = clampPcbPitch(activePcbProject.camera.pitch);
        }
        renderPcbBoard(true);
        schedulePcbSave();
    }
});
document.querySelector("[data-pcb-project-name-input]").addEventListener("change", (event) => {
    if (!activePcbProject) return;
    const name = event.currentTarget.value.trim().slice(0, 80);
    if (!name) {
        event.currentTarget.value = activePcbProject.name;
        event.currentTarget.reportValidity();
        return;
    }
    if (name === activePcbProject.name) return;
    recordPcbHistory();
    activePcbProject.name = name;
    event.currentTarget.value = name;
    document.querySelector("[data-pcb-project-name]").textContent = name;
    renderPcbBoard();
    schedulePcbSave();
});
document.querySelector("[data-pcb-theme]").addEventListener("change", (event) => {
    if (!activePcbProject || !pcbThemes.includes(event.currentTarget.value)) return;
    if (activePcbProject.theme === event.currentTarget.value) return;
    recordPcbHistory();
    activePcbProject.theme = event.currentTarget.value;
    renderPcbBoard();
    schedulePcbSave();
});
document.addEventListener("keydown", (event) => {
    if (pcbEditor.hidden || !activePcbProject || document.querySelector("[data-pcb-project-dialog]").open) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
        target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    )) return;
    const key = event.key.toLowerCase();
    if (key === "z" && event.shiftKey) {
        event.preventDefault();
        restorePcbHistory(pcbRedoStack, pcbUndoStack);
    } else if (key === "z") {
        event.preventDefault();
        restorePcbHistory(pcbUndoStack, pcbRedoStack);
    } else if (key === "y") {
        event.preventDefault();
        restorePcbHistory(pcbRedoStack, pcbUndoStack);
    } else if (key === "s") {
        event.preventDefault();
        savePcbProject();
    }
});
document.querySelectorAll("[data-pcb-dimension]").forEach((input) => {
    input.addEventListener("change", () => {
        if (!activePcbProject || !input.reportValidity()) return;
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        if (activePcbProject[input.dataset.pcbDimension] === value) return;
        recordPcbHistory();
        activePcbProject[input.dataset.pcbDimension] = value;
        if (input.dataset.pcbDimension === "width" || input.dataset.pcbDimension === "height") {
            const layout = activePcbProject.layout;
            if (layout.outlineMode === "rectangle") {
                layout.outline = [
                    { x: 0, y: 0 },
                    { x: activePcbProject.width, y: 0 },
                    { x: activePcbProject.width, y: activePcbProject.height },
                    { x: 0, y: activePcbProject.height }
                ];
            }
            layout.footprints.forEach((footprint) => {
                const definition = getPcbPartDefinition(footprint.type);
                const quarterTurn = Math.abs(Math.round(footprint.rotation / 90)) % 2 === 1;
                const halfWidth = (quarterTurn ? definition.height : definition.width) / 2;
                const halfHeight = (quarterTurn ? definition.width : definition.height) / 2;
                footprint.x = Math.min(activePcbProject.width - halfWidth, Math.max(halfWidth, footprint.x));
                footprint.y = Math.min(activePcbProject.height - halfHeight, Math.max(halfHeight, footprint.y));
            });
            updatePcbLayoutTrackEndpoints(layout);
        }
        for (const part of activePcbProject.components) {
            const definition = getPcbPartDefinition(part.type);
            part.x = Math.min(activePcbProject.width - definition.width / 2, Math.max(definition.width / 2, part.x));
            part.y = Math.min(activePcbProject.height - definition.height / 2, Math.max(definition.height / 2, part.y));
        }
        renderPcbBoard();
        schedulePcbSave();
        if (pcbWorkspaceMode === "layout") renderPcbLayout();
    });
});
document.querySelectorAll("[data-pcb-position]").forEach((input) => {
    input.addEventListener("change", () => {
        if (!activePcbProject || !input.reportValidity()) return;
        const part = activePcbProject.components.find((item) => item.id === selectedPcbPartId);
        if (!part || !Number.isFinite(input.valueAsNumber)) return;
        const definition = getPcbPartDefinition(part.type);
        const axis = input.dataset.pcbPosition;
        const limit = axis === "x" ? activePcbProject.width : activePcbProject.height;
        const size = axis === "x" ? definition.width : definition.height;
        const nextPosition = Math.min(limit - size / 2, Math.max(size / 2, input.valueAsNumber));
        if (part[axis] === nextPosition) return;
        recordPcbHistory();
        part[axis] = nextPosition;
        renderPcbBoard();
        schedulePcbSave();
    });
});
document.querySelector("[data-pcb-rotate]").addEventListener("click", () => {
    const part = activePcbProject?.components.find((item) => item.id === selectedPcbPartId);
    if (!part) return;
    recordPcbHistory();
    part.rotation = (part.rotation + 90) % 360;
    renderPcbBoard();
    schedulePcbSave();
});
document.querySelector("[data-pcb-delete]").addEventListener("click", () => {
    if (!activePcbProject || !selectedPcbPartId) return;
    recordPcbHistory();
    activePcbProject.components = activePcbProject.components.filter((part) => part.id !== selectedPcbPartId);
    selectedPcbPartId = null;
    document.querySelector("[data-pcb-placement-status]").textContent = "Component removed";
    renderPcbBoard();
    schedulePcbSave();
});
pcbBoard.addEventListener("pointerdown", (event) => {
    const component = event.target.closest("[data-pcb-component]");
    if (!component || !activePcbProject) {
        if (activePcbProject && event.target === pcbBoard) {
            setPcbSelection(null);
            renderPcbBoard();
        }
        return;
    }
    event.preventDefault();
    setPcbSelection(component.dataset.pcbComponent);
    const part = activePcbProject.components.find((item) => item.id === selectedPcbPartId);
    pcbPointer = part ? { id: part.id, moved: false } : null;
    renderPcbBoard();
    if (pcbPointer) pcbBoard.setPointerCapture(event.pointerId);
});
pcbBoard.addEventListener("pointermove", (event) => {
    if (!pcbPointer || !activePcbProject) return;
    const part = activePcbProject.components.find((item) => item.id === pcbPointer.id);
    if (!part) return;
    const point = pcbBoard.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = pcbBoard.getScreenCTM();
    if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse());
    const definition = getPcbPartDefinition(part.type);
    const nextX = Math.min(activePcbProject.width - definition.width / 2, Math.max(definition.width / 2, local.x + 6));
    const nextY = Math.min(activePcbProject.height - definition.height / 2, Math.max(definition.height / 2, local.y + 6));
    if (!pcbPointer.moved && (Math.abs(part.x - nextX) > 0.01 || Math.abs(part.y - nextY) > 0.01)) recordPcbHistory();
    if (Math.abs(part.x - nextX) <= 0.01 && Math.abs(part.y - nextY) <= 0.01) return;
    part.x = nextX;
    part.y = nextY;
    pcbPointer.moved = true;
    renderPcbBoard();
});
pcbBoard.addEventListener("pointerup", () => {
    if (pcbPointer?.moved) {
        document.querySelector("[data-pcb-placement-status]").textContent = "Part position updated";
        schedulePcbSave();
    }
    pcbPointer = null;
});
pcbBoard.addEventListener("pointercancel", () => {
    pcbPointer = null;
});
pcbBoard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const component = event.target.closest("[data-pcb-component]");
    if (!component) return;
    event.preventDefault();
    setPcbSelection(component.dataset.pcbComponent);
    renderPcbBoard();
});

document.querySelector("[data-new-design]").addEventListener("click", openNewDesignScreen);
document.querySelector("[data-close-design]").addEventListener("click", resetBubbles);
document.querySelector("[data-close-editor]").addEventListener("click", resetBubbles);
document.querySelectorAll("[data-close-pcb]").forEach((button) => {
    button.addEventListener("click", resetBubbles);
});
newDesignScreen.addEventListener("click", (event) => event.stopPropagation());
document.querySelector("#canvasSetup").addEventListener("click", (event) => event.stopPropagation());
pcbSetup.addEventListener("click", (event) => event.stopPropagation());
pcbEditor.addEventListener("click", (event) => event.stopPropagation());
modelEditor.addEventListener("click", (event) => event.stopPropagation());
modelEditor.addEventListener("contextmenu", (event) => event.preventDefault());

document.querySelector("[data-project-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    if (!name) {
        document.querySelector("#projectName").reportValidity();
        return;
    }
    const project = makeDesignProject(name, String(formData.get("description") || ""));
    startProjectWaterTransition(project);
});

document.querySelectorAll("[data-add-shape]").forEach((button) => {
    button.addEventListener("click", () => {
        createModelObject(button.dataset.addShape);
        document.querySelector("[data-primitive-menu]").hidden = true;
    });
});

document.querySelector("[data-add-menu-toggle]").addEventListener("click", () => {
    const menu = document.querySelector("[data-primitive-menu]");
    menu.hidden = !menu.hidden;
});

document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => selectEditorTool(button.dataset.tool));
});

document.querySelector("[data-reset-view]").addEventListener("click", () => {
    if (!cadCamera || !cadControls) return;
    cadControls.target.set(0, 30, 0);
    setStandardCadView("iso");
    fitCadView(false);
});
document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setStandardCadView(button.dataset.view));
});
document.querySelector("[data-projection-toggle]").addEventListener("click", () => {
    replaceCadCamera(cadProjection === "perspective" ? "orthographic" : "perspective");
});
document.querySelector("[data-fit-view]").addEventListener("click", () => fitCadView(false));
document.querySelector("[data-fit-selection]").addEventListener("click", () => fitCadView(true));

document.querySelector("[data-isolate-selection]").addEventListener("click", () => {
    const selected = selectedModelObject();
    if (!selected || !activeProject) return;
    recordProjectChange();
    for (const object of activeProject.objects) object.visible = object.id === selected.id;
    updateSceneInterface();
    scheduleProjectSave();
});

document.querySelector("[data-show-all]").addEventListener("click", () => {
    if (!activeProject || activeProject.objects.every((object) => object.visible !== false)) return;
    recordProjectChange();
    for (const object of activeProject.objects) object.visible = true;
    updateSceneInterface();
    scheduleProjectSave();
});

document.querySelector("[data-create-assembly]").addEventListener("click", createFixedAssembly);
document.querySelector("[data-break-assembly]").addEventListener("click", releaseFixedAssembly);

document.querySelector("[data-measure-toggle]").addEventListener("click", (event) => {
    measureMode = !measureMode;
    event.currentTarget.setAttribute("aria-pressed", String(measureMode));
    document.querySelector("[data-viewport-hint]").textContent = measureMode
        ? measurementPoints.length
            ? "Select a second surface point to measure · Click Measure again to exit"
            : "Select two points on visible surfaces · Click Measure again to exit"
        : "Drag bodies to move · Right-drag to orbit · Scroll to zoom";
    modelCanvas.style.cursor = measureMode ? "crosshair" : "grab";
});

document.querySelector("[data-section-toggle]").addEventListener("click", (event) => {
    sectionEnabled = !sectionEnabled;
    event.currentTarget.setAttribute("aria-pressed", String(sectionEnabled));
    document.querySelector("[data-section-control]").hidden = !sectionEnabled;
    renderModel();
});

document.querySelector("[data-section-position]").addEventListener("input", (event) => {
    sectionPlane.constant = Number(event.currentTarget.value);
    document.querySelector("[data-section-value]").value = `${event.currentTarget.value} mm`;
    renderCadFrame();
});

document.querySelector("[data-save-project]").addEventListener("click", () => persistProject(true));
document.querySelector("[data-export-project-json]").addEventListener("click", downloadProjectJson);
document.querySelector("[data-export-stl]").addEventListener("click", exportModelStl);
document.querySelector("[data-export-obj]").addEventListener("click", exportModelObj);
document.querySelector("[data-mesh-check]").addEventListener("click", runMeshPreflight);
document.querySelectorAll("[data-close-mesh-check]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector("[data-mesh-check-dialog]").close());
});
const slicerDialog = document.querySelector("[data-slicer-dialog]");
const slicerForm = document.querySelector("[data-slicer-form]");
const slicerResult = document.querySelector("[data-slicer-result]");
const slicerProfileNote = document.querySelector("[data-slicer-profile-note]");
const slicerQualityPreset = slicerForm.elements.qualityPreset;
const slicerMaterialPreset = slicerForm.elements.materialPreset;
const qualityPresets = {
    draft: { layerHeight: 0.28, infillPercent: 15, topLayers: 3, bottomLayers: 3, perimeterSpeed: 40, infillSpeed: 60 },
    balanced: { layerHeight: 0.2, infillPercent: 20, topLayers: 3, bottomLayers: 3, perimeterSpeed: 30, infillSpeed: 45 },
    detail: { layerHeight: 0.12, infillPercent: 20, topLayers: 4, bottomLayers: 4, perimeterSpeed: 22, infillSpeed: 32 }
};
const materialPresets = {
    pla: { nozzleTemperature: 205, bedTemperature: 60 },
    petg: { nozzleTemperature: 240, bedTemperature: 80 },
    abs: { nozzleTemperature: 250, bedTemperature: 100 }
};
function applySlicerPreset(values) {
    for (const [name, value] of Object.entries(values)) {
        slicerForm.elements[name].value = String(value);
    }
}
slicerQualityPreset.addEventListener("change", () => {
    applySlicerPreset(qualityPresets[slicerQualityPreset.value]);
});
slicerMaterialPreset.addEventListener("change", () => {
    applySlicerPreset(materialPresets[slicerMaterialPreset.value]);
    slicerProfileNote.textContent = slicerMaterialPreset.value === "abs"
        ? "Generic ABS starting temperatures applied. Use only with a suitable enclosed, ventilated printer and verify the filament maker’s recommendations."
        : "Generic temperatures applied as a starting point only. Verify the filament maker’s recommendations and your printer’s limits.";
});
document.querySelector("[data-open-slicer]").addEventListener("click", () => {
    slicerResult.textContent = "";
    slicerProfileNote.textContent = slicerMaterialPreset.value === "abs"
        ? "Generic ABS starting temperatures shown. Use only with a suitable enclosed, ventilated printer and verify the filament maker’s recommendations."
        : "Generic profiles are starting points only. Check your filament maker’s recommendations; ABS generally needs an enclosure and ventilation.";
    slicerDialog.showModal();
});
const transformDialog = document.querySelector("[data-transform-dialog]");
const transformForm = document.querySelector("[data-transform-form]");
document.querySelector("[data-open-align]").addEventListener("click", () => openTransformDialog("align"));
document.querySelector("[data-open-distribute]").addEventListener("click", () => openTransformDialog("distribute"));
document.querySelectorAll("[data-close-transform]").forEach((button) => {
    button.addEventListener("click", () => transformDialog.close());
});
transformForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const operation = transformDialog.dataset.operation;
    applyTransformSelection(operation, transformForm.elements.axis.value, transformForm.elements.mode.value);
    if (!document.querySelector("[data-save-status]").classList.contains("error")) {
        transformDialog.close();
    }
});
document.querySelectorAll("[data-close-slicer]").forEach((button) => {
    button.addEventListener("click", () => slicerDialog.close());
});
slicerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!slicerForm.reportValidity()) return;
    slicerResult.textContent = "Checking meshes and generating toolpaths…";
    try {
        const result = runCadSlicer(new FormData(slicerForm));
        slicerResult.textContent =
            `G-code exported: ${result.layerCount.toLocaleString()} layers, ` +
            `${result.perimeterSegments.toLocaleString()} boundary segments, ` +
            `${result.infillSegments.toLocaleString()} infill lines, ` +
            `${(result.filamentMm / 1000).toFixed(2)} m filament. ` +
            "No print-time estimate is provided.";
        setSaveStatus("Experimental G-code exported. Verify it with your printer profile before use.");
    } catch (error) {
        console.error("CAD slicer failed to generate G-code.", error);
        slicerResult.textContent = error.message || "Slicing failed; no G-code was exported.";
        setSaveStatus("Slicing failed; no G-code was exported", true);
    }
});
document.querySelector("[data-undo]").addEventListener("click", undoProjectChange);
document.querySelector("[data-redo]").addEventListener("click", redoProjectChange);
document.querySelectorAll("[data-boolean]").forEach((button) => {
    button.addEventListener("click", () => applyBooleanOperation(button.dataset.boolean));
});
const cadFeatureDialog = document.querySelector("[data-cad-feature-dialog]");
const cadFeatureForm = document.querySelector("[data-cad-feature-form]");
cadFeatureDialog.addEventListener("close", () => {
    delete cadFeatureForm.dataset.editObjectId;
    document.querySelector("[data-feature-submit]").textContent = "Create feature →";
});
document.querySelector("[data-sketch-feature]").addEventListener("click", () => {
    delete cadFeatureForm.dataset.editObjectId;
    cadFeatureForm.reset();
    document.querySelector("[data-feature-submit]").textContent = "Create feature →";
    updateSketchFeatureNote();
    cadFeatureDialog.showModal();
    cadFeatureForm.elements.featureName.focus();
});
const cadPatternDialog = document.querySelector("[data-pattern-dialog]");
const cadPatternForm = document.querySelector("[data-pattern-form]");
document.querySelector("[data-linear-pattern]").addEventListener("click", () => {
    const object = selectedModelObject();
    if (!object || object.type === "mesh" || object.instanceOf) return;
    if (!object.patternConfig) {
        cadPatternForm.elements.featureName.value = `${object.name} pattern`;
        cadPatternForm.elements.axis.value = "x";
        cadPatternForm.elements.count.value = "3";
        cadPatternForm.elements.spacing.value = String(Math.max(object.width, 10));
    }
    cadPatternDialog.showModal();
    cadPatternForm.elements.featureName.focus();
});
document.querySelectorAll("[data-close-pattern-dialog]").forEach((button) => {
    button.addEventListener("click", () => cadPatternDialog.close());
});
document.querySelector("[data-remove-pattern]").addEventListener("click", () => {
    const source = selectedModelObject();
    if (!source?.patternConfig || !activeProject) return;
    recordProjectChange();
    delete source.patternConfig;
    activeProject.objects = activeProject.objects.filter((object) => object.instanceOf !== source.id);
    selectedObjectId = source.id;
    selectedObjectIds = [source.id];
    updateSceneInterface();
    scheduleProjectSave();
    cadPatternDialog.close();
});
const cadMirrorDialog = document.querySelector("[data-mirror-dialog]");
const cadMirrorForm = document.querySelector("[data-mirror-form]");
document.querySelector("[data-mirror-feature]").addEventListener("click", () => {
    const object = selectedModelObject();
    if (!object || object.instanceOf || object.mirrorOf) return;
    if (!object.mirrorConfig) {
        cadMirrorForm.elements.featureName.value = `${object.name} mirror`;
        cadMirrorForm.elements.axis.value = "x";
        cadMirrorForm.elements.offset.value = "0";
    }
    cadMirrorDialog.showModal();
    cadMirrorForm.elements.featureName.focus();
});
document.querySelectorAll("[data-close-mirror-dialog]").forEach((button) => {
    button.addEventListener("click", () => cadMirrorDialog.close());
});
document.querySelector("[data-remove-mirror]").addEventListener("click", () => {
    const source = selectedModelObject();
    if (!source?.mirrorConfig || !activeProject) return;
    recordProjectChange();
    delete source.mirrorConfig;
    activeProject.objects = activeProject.objects.filter((object) => object.mirrorOf !== source.id);
    selectedObjectId = source.id;
    selectedObjectIds = [source.id];
    updateSceneInterface();
    scheduleProjectSave();
    cadMirrorDialog.close();
});
cadMirrorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cadMirrorForm.reportValidity()) return;
    createMirrorFeature(new FormData(cadMirrorForm));
    cadMirrorDialog.close();
});
cadPatternForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cadPatternForm.reportValidity()) return;
    createLinearPattern(new FormData(cadPatternForm));
    cadPatternDialog.close();
});
document.querySelectorAll("[data-close-feature-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
        delete cadFeatureForm.dataset.editObjectId;
        document.querySelector("[data-feature-submit]").textContent = "Create feature →";
        cadFeatureDialog.close();
    });
});
cadFeatureForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cadFeatureForm.reportValidity()) return;
    createSketchFeature(new FormData(cadFeatureForm));
    cadFeatureDialog.close();
});
function updateSketchFeatureNote() {
    const isRevolve = cadFeatureForm.elements.operation.value === "revolve";
    const equalAxes = cadFeatureForm.elements.equalAxes.checked && !isRevolve;
    cadFeatureForm.elements.depth.min = isRevolve ? "0" : "1";
    cadFeatureForm.elements.depth.readOnly = equalAxes;
    if (equalAxes) cadFeatureForm.elements.depth.value = cadFeatureForm.elements.width.value;
    cadFeatureForm.elements.bevel.disabled = isRevolve;
    cadFeatureForm.elements.edgeStyle.disabled = isRevolve;
    document.querySelector("[data-feature-note]").textContent = isRevolve
        ? "Depth is the bore diameter; use 0 for a solid turned body. Edge treatment is only used by extrusions."
        : equalAxes
            ? "Equal profile axes constrain width and depth to the same value. The profile stays centered on the sketch origin."
        : `The ${cadFeatureForm.elements.edgeStyle.value} treatment softens the edges of this extrusion. Dimensions remain editable in the inspector.`;
}
cadFeatureForm.elements.operation.addEventListener("change", () => {
    cadFeatureForm.elements.depth.value =
        cadFeatureForm.elements.operation.value === "revolve" ? "0" : "30";
    updateSketchFeatureNote();
});
cadFeatureForm.elements.equalAxes.addEventListener("change", updateSketchFeatureNote);
cadFeatureForm.elements.width.addEventListener("input", updateSketchFeatureNote);
cadFeatureForm.elements.edgeStyle.addEventListener("change", updateSketchFeatureNote);
document.querySelector("[data-inspector-toggle]").addEventListener("click", (event) => {
    const isOpen = modelEditor.classList.toggle("show-inspector");
    event.currentTarget.setAttribute("aria-pressed", String(isOpen));
});
document.querySelector("[data-import-project]").addEventListener("click", () => {
    document.querySelector("[data-project-file]").click();
});
document.querySelector("[data-import-model]").addEventListener("click", () => {
    document.querySelector("[data-model-file]").click();
});
document.querySelector("[data-model-file]").addEventListener("change", (event) => {
    const [file] = event.currentTarget.files;
    if (file) importModelFile(file);
    event.currentTarget.value = "";
});
document.querySelector("[data-project-file]").addEventListener("change", (event) => {
    const [file] = event.currentTarget.files;
    if (file) importProjectFile(file);
    event.currentTarget.value = "";
});
document.querySelector("[data-import-3mf]").addEventListener("click", () => {
    document.querySelector("[data-3mf-file]").click();
});
document.querySelector("[data-3mf-file]").addEventListener("change", async (event) => {
    const [file] = event.currentTarget.files;
    event.currentTarget.value = "";
    if (!file || !activeProject) return;
    try {
        if (file.size > 40 * 1024 * 1024) throw new Error("3MF files must be smaller than 40 MB.");
        const records = await import3mf(file);
        addImportedMeshRecords(records, file.name.replace(/\.3mf$/i, "") || "3MF body");
    } catch (error) {
        console.error("Unable to import the selected 3MF model.", error);
        setSaveStatus(`3MF import failed: ${error.message}`, true);
    }
});
document.querySelector("[data-export-3mf]").addEventListener("click", exportModel3mf);
document.querySelector("[data-import-step]").addEventListener("click", () => {
    document.querySelector("[data-step-file]").click();
});
document.querySelector("[data-step-file]").addEventListener("change", async (event) => {
    const [file] = event.currentTarget.files;
    event.currentTarget.value = "";
    if (!file || !activeProject) return;
    try {
        if (file.size > 40 * 1024 * 1024) throw new Error("STEP files must be smaller than 40 MB.");
        const records = importFacetedStep(await file.text());
        addImportedMeshRecords(records, file.name.replace(/\.(step|stp)$/i, "") || "STEP body");
    } catch (error) {
        console.error("Unable to import the selected STEP model.", error);
        setSaveStatus(`STEP import failed: ${error.message}`, true);
    }
});
document.querySelector("[data-export-step]").addEventListener("click", exportModelStep);

document.querySelector("[data-object-name]").addEventListener("focus", recordProjectChange);
document.querySelector("[data-object-name]").addEventListener("input", (event) => {
    const object = selectedModelObject();
    if (!object) return;
    object.name = event.currentTarget.value.slice(0, 48) || "Object";
    editorProjectName.textContent = activeProject.name;
    document.querySelector("[data-selection-status]").textContent = `${object.name}  ·  ${object.width} × ${object.depth} × ${object.height} mm`;
    scheduleProjectSave();
});
document.querySelector("[data-object-name]").addEventListener("change", updateSceneInterface);

function syncInspectorAssemblyTransform(object, input) {
    if (!object.assemblyId || !input.dataset.assemblyState) return;
    const start = JSON.parse(input.dataset.assemblyState);
    const primaryStart = start.find((member) => member.id === object.id);
    if (!primaryStart) return;
    const property = input.dataset.property;
    const translation = ["x", "y", "z"].includes(property);
    const delta = {
        x: translation ? object.x - primaryStart.x : 0,
        y: translation ? object.y - primaryStart.y : 0,
        z: translation ? object.z - primaryStart.z : 0,
        rotationX: property === "rotationX" ? object.rotationX - primaryStart.rotationX : 0,
        rotationY: property === "rotationY" ? object.rotationY - primaryStart.rotationY : 0,
        rotationZ: property === "rotationZ" ? object.rotationZ - primaryStart.rotationZ : 0
    };
    const rotation = new THREE.Euler(
        THREE.MathUtils.degToRad(delta.rotationX),
        THREE.MathUtils.degToRad(delta.rotationY),
        THREE.MathUtils.degToRad(delta.rotationZ),
        "XYZ"
    );
    const pivot = new THREE.Vector3(primaryStart.x, primaryStart.y, primaryStart.z);
    for (const memberStart of start) {
        const member = activeProject.objects.find((item) => item.id === memberStart.id);
        if (!member) continue;
        if (translation) {
            member.x = Math.max(-110, Math.min(110, memberStart.x + delta.x));
            member.y = Math.max(0, Math.min(220, memberStart.y + delta.y));
            member.z = Math.max(-110, Math.min(110, memberStart.z + delta.z));
            continue;
        }
        const position = new THREE.Vector3(memberStart.x, memberStart.y, memberStart.z)
            .sub(pivot).applyEuler(rotation).add(pivot);
        member.x = Math.max(-110, Math.min(110, position.x));
        member.y = Math.max(0, Math.min(220, position.y));
        member.z = Math.max(-110, Math.min(110, position.z));
        member.rotationX = memberStart.rotationX + delta.rotationX;
        member.rotationY = memberStart.rotationY + delta.rotationY;
        member.rotationZ = memberStart.rotationZ + delta.rotationZ;
    }
}

document.querySelectorAll("[data-property]").forEach((input) => {
    input.addEventListener("focus", () => {
        recordProjectChange();
        const object = selectedModelObject();
        if (object?.assemblyId) {
            input.dataset.assemblyState = JSON.stringify(activeProject.objects
                .filter((member) => member.assemblyId === object.assemblyId)
                .map((member) => ({
                    id: member.id,
                    x: member.x, y: member.y, z: member.z,
                    rotationX: member.rotationX || 0,
                    rotationY: member.rotationY || 0,
                    rotationZ: member.rotationZ || 0
                })));
        } else {
            delete input.dataset.assemblyState;
        }
    });
    input.addEventListener("input", () => {
        const object = selectedModelObject();
        if (!object) return;
        const property = input.dataset.property;
        if (property === "color") {
            object.color = input.value;
            renderModel();
            scheduleProjectSave();
            return;
        }
        let value = Number(input.value);
        if (!Number.isFinite(value)) return;
        if (["width", "depth", "height"].includes(property)) {
            value = Math.min(220, Math.max(1, value));
            if (uniformDimensions) {
                const previous = object[property];
                const ratio = value / previous;
                for (const dimension of ["width", "depth", "height"]) {
                    object[dimension] = Math.min(220, Math.max(1, Math.round(object[dimension] * ratio * 100) / 100));
                }
            } else {
                object[property] = value;
            }
        } else if (["x", "y", "z"].includes(property)) {
            object[property] = property === "y"
                ? Math.max(0, Math.min(220, value))
                : Math.max(-110, Math.min(110, value));
        } else {
            object[property] = ((value % 360) + 360) % 360;
        }
        syncInspectorAssemblyTransform(object, input);
        syncInspector(object);
        document.querySelector("[data-selection-status]").textContent = `${object.name}  ·  ${object.width} × ${object.depth} × ${object.height} mm`;
        renderModel();
        scheduleProjectSave();
    });
});

document.querySelector("[data-uniform-scale]").addEventListener("change", (event) => {
    uniformDimensions = event.currentTarget.checked;
});

document.querySelector("[data-grid-snap]").addEventListener("change", (event) => {
    snapToGrid = event.currentTarget.checked;
    document.querySelector("[data-viewport-hint]").textContent = snapToGrid
        ? "Drag bodies to move · Snap 10 mm · Right-drag to orbit · Scroll to zoom"
        : "Drag bodies to move · Ctrl-click two bodies for Booleans · Right-drag to orbit";
});

document.querySelector("[data-duplicate-object]").addEventListener("click", () => {
    const object = selectedModelObject();
    if (!object || !activeProject) return;
    if (isLinkedFeatureObject(object)) {
        setSaveStatus("Duplicate the source feature to create another linked feature", true);
        return;
    }
    if (activeProject.objects.length >= 500) {
        setSaveStatus("This project has reached the 500-body limit", true);
        return;
    }
    recordProjectChange();
    const duplicate = { ...object, id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `${object.name} copy`, x: Math.min(110, object.x + 12), z: Math.min(110, object.z + 12) };
    activeProject.objects.push(duplicate);
    selectedObjectId = duplicate.id;
    selectedObjectIds = [duplicate.id];
    updateSceneInterface();
    scheduleProjectSave();
});

document.querySelector("[data-delete-object]").addEventListener("click", () => {
    if (!activeProject || !selectedObjectId) return;
    const selected = selectedModelObject();
    if (selected?.instanceOf || selected?.mirrorOf) return;
    recordProjectChange();
    if (selected?.assemblyId) {
        activeProject.objects
            .filter((object) => object.assemblyId === selected.assemblyId && object.id !== selected.id)
            .forEach((object) => { delete object.assemblyId; });
    }
    activeProject.objects = activeProject.objects.filter((object) =>
        object.id !== selectedObjectId &&
        object.instanceOf !== selectedObjectId &&
        object.mirrorOf !== selectedObjectId
    );
    selectedObjectId = activeProject.objects[0]?.id || null;
    selectedObjectIds = selectedObjectId ? [selectedObjectId] : [];
    updateSceneInterface();
    scheduleProjectSave();
});

modelCanvas.addEventListener("pointerdown", handleModelPointerDown);
modelCanvas.addEventListener("pointermove", handleModelPointerMove);
modelCanvas.addEventListener("pointerup", handleModelPointerUp);
modelCanvas.addEventListener("pointercancel", handleModelPointerUp);
modelCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
if (window.ResizeObserver) {
    canvasResizeObserver = new ResizeObserver(resizeModelCanvas);
    canvasResizeObserver.observe(modelCanvas);
} else {
    window.addEventListener("resize", resizeModelCanvas);
}

document.addEventListener("keydown", (event) => {
    const canvasEditor = document.querySelector("#canvasEditor");
    if (!canvasEditor.hidden) {
        if (event.target.matches("input, textarea, select")) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            persistCanvasProject();
        } else if (event.key === "Escape") {
            resetBubbles();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            if (event.shiftKey) restoreCanvasHistory(canvasRedoStack, canvasUndoStack);
            else restoreCanvasHistory(canvasUndoStack, canvasRedoStack);
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
            event.preventDefault();
            restoreCanvasHistory(canvasRedoStack, canvasUndoStack);
        } else if (!event.ctrlKey && !event.metaKey) {
            const tools = { b: "brush", e: "eraser", l: "line", r: "rectangle", o: "ellipse", t: "text" };
            if (tools[event.key.toLowerCase()]) setCanvasTool(tools[event.key.toLowerCase()]);
        }
        return;
    }
    if (modelEditor.hidden || event.target.matches("input, textarea, select")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        persistProject(true);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoProjectChange();
        else undoProjectChange();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoProjectChange();
    } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "v") {
        selectEditorTool("select");
    } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "g") {
        selectEditorTool("move");
    } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "r") {
        selectEditorTool("rotate");
    } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedObjectId) document.querySelector("[data-delete-object]").click();
    }
});

// 2. CENTRAL WATER ORB
let diwaliFinaleTimer = 0;

function launchDiwaliFireworks() {
    const fireworks = document.querySelector(".diwali-fireworks");
    const bursts = [
        { kind: "rocket", x: 23, y: 29, delay: 0 },
        { kind: "chakra", x: 38, y: 19, delay: 120 },
        { kind: "flowerpot", x: 50, y: 37, delay: 220 },
        { kind: "chakra", x: 63, y: 22, delay: 340 },
        { kind: "rocket", x: 77, y: 31, delay: 470 },
        { kind: "flowerpot", x: 32, y: 58, delay: 620 },
        { kind: "chakra", x: 70, y: 57, delay: 760 }
    ];

    window.clearTimeout(diwaliFinaleTimer);
    fireworks.replaceChildren();
    document.querySelectorAll(".diwali-rocket-launch, .diwali-finale").forEach((effect) => effect.remove());

    bursts.forEach(({ kind, x, y, delay }) => {
        const burst = document.createElement("span");
        burst.className = `diwali-firework diwali-firework-${kind}`;
        burst.style.left = `${x}%`;
        burst.style.top = `${y}%`;
        burst.style.animationDelay = `${delay}ms`;
        burst.addEventListener("animationend", () => burst.remove(), { once: true });
        fireworks.append(burst);
    });

    diwaliFinaleTimer = window.setTimeout(() => {
        if (!diwaliThemeEnabled) {
            return;
        }

        const rocket = document.createElement("span");
        rocket.className = "diwali-rocket-launch";
        rocket.addEventListener("animationend", () => {
            rocket.remove();
            if (!diwaliThemeEnabled) {
                return;
            }

            const finale = document.createElement("div");
            finale.className = "diwali-finale";
            const message = document.createElement("h1");
            message.className = "diwali-finale-message";
            message.textContent = "Happy Diwali";
            finale.append(message);

            const rule = document.createElement("div");
            rule.className = "diwali-finale-rule";
            rule.setAttribute("aria-hidden", "true");
            const ornament = document.createElement("span");
            ornament.textContent = "✦";
            rule.append(ornament);
            finale.append(rule);

            const subtitle = document.createElement("p");
            subtitle.className = "diwali-finale-subtitle";
            subtitle.textContent = "MAY YOUR HOME BE FILLED WITH LIGHT";
            finale.append(subtitle);

            for (let index = 0; index < 32; index += 1) {
                const spark = document.createElement("span");
                const angle = (index / 32) * Math.PI * 2;
                const distance = 90 + ((index * 47) % 135);
                spark.className = "diwali-finale-spark";
                spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
                spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
                spark.style.setProperty("--spark-delay", `${(index % 5) * 45}ms`);
                spark.style.setProperty("--spark-size", `${index % 4 === 0 ? 6 : 4}px`);
                finale.append(spark);
            }

            finale.addEventListener("animationend", () => finale.remove(), { once: true });
            fireworks.append(finale);
        }, { once: true });
        fireworks.append(rocket);
    }, 1400);
}

assistantBubble.addEventListener("click", () => {
    if (isOpeningBlankScreen) {
        return;
    }

    const isOpen = bubbleUniverse.classList.toggle("open");

    if (diwaliThemeEnabled && isOpen) {
        launchDiwaliFireworks();
    } else if (diwaliThemeEnabled) {
        window.clearTimeout(diwaliFinaleTimer);
        document.querySelectorAll(".diwali-rocket-launch, .diwali-finale").forEach((effect) => effect.remove());
    }

    assistantBubble.setAttribute(
        "aria-expanded",
        String(isOpen)
    );

    orbitBubbles.setAttribute(
        "aria-hidden",
        String(!isOpen)
    );
});

function resetBubbles() {
    const canvasSetup = document.querySelector("#canvasSetup");
    const canvasEditor = document.querySelector("#canvasEditor");
    const studioWasOpen = !newDesignScreen.hidden || !modelEditor.hidden || !canvasSetup.hidden || !canvasEditor.hidden || !pcbSetup.hidden || !pcbEditor.hidden || !roboticsStudio.hidden;
    if (!canvasEditor.hidden && activeCanvasProject) {
        window.clearTimeout(canvasSaveTimer);
        persistCanvasProject();
    }
    if (!pcbEditor.hidden && activePcbProject) {
        window.clearTimeout(pcbSaveTimer);
        savePcbProject();
    }
    const pcbProjectDialog = document.querySelector("[data-pcb-project-dialog]");
    if (pcbProjectDialog.open) pcbProjectDialog.close();
    window.clearTimeout(blankScreenTimer);
    blankScreen.classList.remove("flowing");
    blankScreen.classList.remove("open");
    blankScreen.setAttribute("aria-hidden", "true");
    blankScreen.setAttribute("aria-label", "Blank screen");
    newDesignScreen.hidden = true;
    canvasSetup.hidden = true;
    canvasEditor.hidden = true;
    pcbSetup.hidden = true;
    pcbEditor.hidden = true;
    roboticsStudio.hidden = true;
    modelEditor.hidden = true;
    if (cadAnimationFrame) {
        window.cancelAnimationFrame(cadAnimationFrame);
        cadAnimationFrame = 0;
    }
    if (pcbCameraFrame) {
        window.cancelAnimationFrame(pcbCameraFrame);
        pcbCameraFrame = 0;
    }
    modelEditor.classList.remove("show-inspector");
    isOpeningBlankScreen = false;
    bubbleUniverse.classList.remove("open");
    assistantBubble.setAttribute("aria-expanded", "false");
    orbitBubbles.setAttribute("aria-hidden", "true");
    orbitBubbles.querySelectorAll(".popping").forEach((bubble) => {
        bubble.classList.remove("popping");
    });
    if (studioWasOpen) assistantBubble.focus();
    window.dispatchEvent(new Event("smartdesk:robotics-close"));
}

window.addEventListener("smartdesk:close-studios", resetBubbles);

orbitBubbles.addEventListener("click", (event) => {
    const selectedBubble = event.target.closest(".orbit-bubble");
    if (!selectedBubble || isOpeningBlankScreen) {
        return;
    }

    isOpeningBlankScreen = true;
    selectedBubble.classList.add("popping");
    blankScreen.classList.add("flowing");
    blankScreen.setAttribute("aria-hidden", "false");
    const isNewDesign = selectedBubble.hasAttribute("data-new-design");
    const isCanvasDesign = selectedBubble.hasAttribute("data-canvas-design");
    const isPcbDesign = selectedBubble.hasAttribute("data-pcb-design");
    const isRoboticsDesign = selectedBubble.hasAttribute("data-robotics-design");
    newDesignScreen.hidden = true;
    document.querySelector("#canvasSetup").hidden = true;
    document.querySelector("#canvasEditor").hidden = true;
    pcbSetup.hidden = true;
    pcbEditor.hidden = true;
    modelEditor.hidden = true;
    blankScreen.setAttribute("aria-label", isRoboticsDesign ? "Robotics studio" : isPcbDesign ? "New PCB project" : isCanvasDesign ? "New 2D canvas" : isNewDesign ? "New 3D design" : "Blank screen");
    blankScreen.focus();

    const flowDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 50
        : 1200;
    blankScreenTimer = window.setTimeout(() => {
        blankScreen.classList.remove("flowing");
        if (selectedBubble.hasAttribute("data-new-design")) {
            openNewDesignScreen();
        } else if (selectedBubble.hasAttribute("data-canvas-design")) {
            openCanvasSetup();
        } else if (selectedBubble.hasAttribute("data-pcb-design")) {
            openPcbSetup();
        } else if (selectedBubble.hasAttribute("data-robotics-design")) {
            isOpeningBlankScreen = false;
            blankScreen.classList.remove("flowing");
            blankScreen.classList.add("open");
            blankScreen.setAttribute("aria-hidden", "false");
            newDesignScreen.hidden = true;
            document.querySelector("#canvasSetup").hidden = true;
            document.querySelector("#canvasEditor").hidden = true;
            pcbSetup.hidden = true;
            pcbEditor.hidden = true;
            modelEditor.hidden = true;
            roboticsStudio.hidden = false;
            window.dispatchEvent(new Event("smartdesk:robotics-open"));
        } else {
            blankScreen.classList.add("open");
        }
    }, flowDuration);
});

blankScreen.addEventListener("click", resetBubbles);


// 3. SIDEBAR CONTROLS
function setSidebarOpen(sidebar, trigger, isOpen) {
    sidebar.classList.toggle("open", isOpen);
    sidebar.setAttribute("aria-hidden", String(!isOpen));
    trigger.setAttribute("aria-expanded", String(isOpen));
}

function toggleSidebar(side) {
    const isOpening = !side.sidebar.classList.contains("open");

    setSidebarOpen(leftSidebar, leftTrigger, false);
    setSidebarOpen(rightSidebar, rightTrigger, false);

    if (isOpening) {
        setSidebarOpen(side.sidebar, side.trigger, true);
    }

    overlay.classList.toggle("visible", isOpening);
}

leftTrigger.addEventListener("click", () => {
    toggleSidebar({ sidebar: leftSidebar, trigger: leftTrigger });
});
rightTrigger.addEventListener("click", () => {
    toggleSidebar({ sidebar: rightSidebar, trigger: rightTrigger });
});

document.querySelectorAll(".sidebar .close-button").forEach((button) => {
    button.addEventListener("click", () => {
        const sidebar = button.closest(".sidebar");
        const trigger = sidebar === leftSidebar ? leftTrigger : rightTrigger;
        setSidebarOpen(sidebar, trigger, false);
        overlay.classList.toggle(
            "visible",
            leftSidebar.classList.contains("open") ||
                rightSidebar.classList.contains("open")
        );
    });
});

function closeSidebars() {
    setSidebarOpen(leftSidebar, leftTrigger, false);
    setSidebarOpen(rightSidebar, rightTrigger, false);
    overlay.classList.remove("visible");
}

overlay.addEventListener("click", closeSidebars);

// Close the sidebar using Escape
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (document.querySelector("[data-pcb-project-dialog]").open) return;
        if (blankScreen.classList.contains("open") || isOpeningBlankScreen) {
            resetBubbles();
            return;
        }

        closeSidebars();

        if (bubbleUniverse.classList.contains("open")) {
            bubbleUniverse.classList.remove("open");
            assistantBubble.setAttribute("aria-expanded", "false");
            orbitBubbles.setAttribute("aria-hidden", "true");
        }
    }
});

console.log("Smart Desk OS: Core systems online.");
