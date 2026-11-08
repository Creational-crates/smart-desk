# smart-desk
this is a opensource website where all the diff applications like  regarding 3d developing, aurdino ,pcb building and etc it is  focused on to creating a workispace suitable from beginer to a high end develpoer and all other developer insights and suggestion are the most prioritized so that all together can build this as a better platform
# Smart Desk OS

**A calm, customizable workspace for making things.** Smart Desk brings 3D design, 2D drawing, PCB planning, and robotics prototyping together in one browser-based desktop.

> **A work in progress:** Smart Desk is an evolving project. Some studios provide useful, test-covered workflows; others are intentionally prototypes. Please read [What works today](#what-works-today) and [Current limitations](#current-limitations) before relying on an export for fabrication or hardware.

## What is Smart Desk?

Smart Desk opens as a personal workspace: a greeting, a live clock, customizable sidebars, and a set of orbiting studio bubbles. Open a bubble to start a project, then use the studio tools to create, inspect, simulate, or export your work.

The goal is to make a welcoming place where beginners can explore and experienced makers can prototype—while being honest about what the tools do and do not verify.

## Highlights

### Make the desk yours

- Personal greeting with an optional saved display name.
- Light and dark appearance modes.
- Custom main and side colors, plus curated color palettes.
- **Diwali special edition:** a festive warm palette with decorative toran, marigold garlands, diyas, and rangoli. Opening the studio bubbles can launch celebratory fireworks. Turn it on or off from **Customisation**.
- The main screen, navigation, and editors are designed to adapt to different screen sizes. A capable desktop browser is recommended for the 3D workspaces.

### 3D Print Studio

- Build models from primitives such as boxes, cylinders, spheres, cones, toruses, capsules, pyramids, and wedges.
- Adjust dimensions, position, rotation, and color; duplicate, delete, and organize bodies.
- Use modeling operations such as sketch solids, linked patterns and mirrors, alignment and distribution, and boolean join, cut, and intersect.
- Inspect triangle meshes for boundary edges, disconnected pieces, non-manifold edges, inconsistent winding, degenerate triangles, and volume.
- Import STL and OBJ meshes. Save editable projects locally or export project JSON, STL, OBJ, 3MF, and supported faceted STEP.
- Slice suitable models into G-code with configurable infill, layer, material, and quality settings.

### 2D Canvas Studio

- Draw on a 1600 × 1000 pixel canvas with brush, shape, and text tools.
- Work with layers, paper/background color, zoom, undo, and redo.
- Resume saved canvases and export artwork as PNG.

### PCB Studio

- Create boards with adjustable dimensions, several board themes, and optional starter templates.
- Place and edit components; create custom library entries.
- Work across a schematic, a 2D layout, and a 3D board preview.
- Plan pins, signals, power rails, copper layers, footprints, tracks, vias, and zones.
- Run the built-in checks, inspect connectivity, and prepare a manufacturing archive. Supported outputs include Gerber copper/outline files, Excellon drill, BOM, pick-and-place, netlist, project data, and manufacturing notes.

### Robotics Studio

- Assemble a robot visually from a searchable parts catalog, wire components, and load starter examples such as an obstacle-avoiding rover, plant monitor, or servo scanner.
- Create block programs, inspect or edit generated Arduino-style C++, and download a sketch.
- Adjust simulated sensor inputs and run the visual simulation.
- Save projects in this browser or import/export a JSON project backup.

## Get started

### Requirements

- Node.js and npm.
- A modern browser with JavaScript modules and WebGL support for the 3D studios.

### Run locally

From the project directory:

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The local server serves the application and its approved Three.js modules. It binds to `127.0.0.1` by default; it is intended for local development, not as a public production server.

### Run checks

```bash
npm test
npm run check
```

`npm test` runs the Node.js test suite for mesh analysis, 3MF and faceted STEP interchange, slicing, and PCB manufacturing-file generation. `npm run check` performs JavaScript syntax checks on the application and supporting modules.

## Saving and privacy

Projects, appearance preferences, and the optional display name are stored in the browser on the current device. They are **not** automatically synchronized to a server or another browser. Use each studio's project export/backup when you need to move or preserve work.

Smart Desk does not currently include social-account connections or cloud project storage. The local server's job is to serve the app; do not treat it as an account service or a public hosting deployment.

## What works today

The repository includes executable tests for:

- Mesh topology and integrity analysis.
- 3MF and supported faceted STEP import/export round trips.
- Slicer toolpath/G-code generation, including validation of meshes and settings.
- PCB manufacturing outputs, packaging, and selected design-readiness checks.

The browser UI also implements the studios and local project workflows described above. The automated test suite focuses on the supporting data and export modules; it is **not** a full automated browser test of every interaction.

## Current limitations

- **Not a replacement for professional CAD or EDA.** Always inspect models, schematics, layouts, and generated files in the tools appropriate to your workflow.
- **STEP support is limited to faceted geometry.** It does not import arbitrary STEP solid/B-rep models.
- **Slicing is a project implementation, not a printer-certified slicer.** Review G-code and printer-specific settings in a trusted slicer before printing.
- **PCB checks are basic.** Trace ampacity, thermal performance, electrical safety, and manufacturer-specific fabrication limits are not fully modeled. A passing check is not a safety or manufacturing guarantee; the UI identifies additional unsupported or estimated areas.
- **Robotics simulation is software-only.** It uses artificial sensor inputs; it does not compile or execute generated C++, connect to an Arduino, simulate voltage/current, or validate real wiring. Check component datasheets, compile with the intended Arduino toolchain, and verify wiring and power before connecting hardware.
- **Browser storage is device-local.** Clearing browser data can remove saved projects. There is no built-in multi-user collaboration, cloud backup, or synchronization.
- **Production deployment is not configured.** The included server binds locally and is not designed to be exposed directly to the public internet.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `script.js` | Workspace interface, styling, and core studio interactions |
| `robotics-studio.js` | Robotics workbench, block editor, simulation, and sketch workflows |
| `cad-3mf.js`, `cad-step.js` | 3MF and supported faceted STEP interchange |
| `cad-mesh-analysis.js`, `cad-slicer.js` | Mesh checks and G-code slicing |
| `pcb-manufacturing.js` | PCB validation and manufacturing-file generation |
| `server.mjs` | Local development server and static-file allowlist |
| `*.test.js` | Node.js tests for supported geometry and manufacturing workflows |

## Developer contributions

**Developer insights, ideas, bug reports, and contributions are very welcome.** Smart Desk is meant to improve through feedback from beginners, designers, electronics makers, and developers alike.

Helpful ways to contribute:

1. Open an issue describing a bug, a confusing interaction, or a feature idea.
2. For a code change, explain the user problem it solves and keep the change focused.
3. Add or update tests when changing geometry, project formats, validation, or manufacturing exports.
4. Run `npm test` and `npm run check` before submitting a pull request.
5. Clearly document assumptions and limitations—especially for hardware, fabrication, and safety-related workflows.

If you're unsure where to start, open an issue and ask. Thoughtful feedback is just as valuable as code.

## Built with

- Vanilla JavaScript, HTML, and CSS.
- [Three.js](https://threejs.org/) for interactive 3D work.
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and [three-bvh-csg](https://github.com/looeee/three-bvh-csg) for mesh acceleration and constructive geometry.
- Node.js for the local server and test runner.

See the dependency packages and their licenses in `package-lock.json` and `node_modules`.

---

**Have an idea that could make the workspace better? Bring it to the project—developer insights and suggestions are always welcome.**
