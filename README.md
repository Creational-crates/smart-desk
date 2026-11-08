# Smart Desk OS

**An open-source, browser-based workspace for makers.** Smart Desk brings 3D modeling, 2D drawing, PCB planning, and robotics prototyping together in one place.

[**Try Smart Desk**](https://creational-crates.github.io/smart-desk/) · [Report a bug or suggest an idea](https://github.com/Creational-crates/smart-desk/issues) · [Contribute](#contributing)

> **Work in progress:** Smart Desk is evolving. Some workflows have automated tests; others are prototypes. Please review the limitations below before relying on generated designs or files.

## What you can do

- **3D Print Studio:** Create models from primitives, arrange and edit bodies, inspect meshes, import STL/OBJ, and export project JSON, STL, OBJ, 3MF, and supported faceted STEP. Slice suitable models into G-code for review.
- **PCB Studio:** Plan boards, components, schematics, and layouts; inspect connectivity; and prepare manufacturing archives with supported Gerber, Excellon, BOM, pick-and-place, and project data outputs.
- **Robotics Studio:** Assemble visual robot projects, connect parts in a planning diagram, build programs with blocks, inspect Arduino-style C++, and experiment with a software-only simulation.
- **2D Canvas Studio:** Draw with brush, shape, and text tools; work with layers; and export artwork as PNG.
- **Personal workspace:** Customize colors and appearance, and save projects locally in your browser.

## Quick start

### Requirements

- Node.js and npm
- A modern browser; WebGL is recommended for 3D workspaces

### Run locally

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

The included server is for local development. It binds to `127.0.0.1` by default and is not intended to be exposed as a public production server.

### Run checks

```bash
npm test
npm run check
```

The tests cover supporting workflows including mesh analysis, 3MF and faceted STEP interchange, slicing, and PCB manufacturing-file generation. They are not a full end-to-end test of every browser interaction.

## Saving and privacy

Projects, appearance preferences, and the optional display name are stored in the browser on the current device. They are not automatically synchronized to a server or another browser. Export project backups if you want to move or preserve your work. Clearing browser data may remove locally saved projects.

Smart Desk does not currently provide accounts, cloud storage, collaboration, or synchronization.

## Important limitations

Smart Desk is an exploratory maker workspace—not a replacement for professional CAD, EDA, slicers, or hardware validation tools.

- **3D printing:** The slicer is a project implementation, not a printer-certified slicer. Review generated G-code and printer-specific settings in a trusted slicer before printing.
- **STEP:** Support is limited to faceted geometry; arbitrary STEP solid/B-rep models are not supported.
- **PCB design:** Built-in checks are basic and do not fully model trace ampacity, thermal performance, electrical safety, or manufacturer-specific fabrication limits. A passing check is not a safety or manufacturability certification.
- **Robotics:** Simulation uses artificial inputs. It does not connect to an Arduino, compile or execute generated C++, model real electrical behavior, or validate physical wiring.
- **Deployment:** Production hosting and deployment are not configured in this repository. Do not expose the included local development server directly to the public internet.

Always inspect designs and generated files with tools appropriate to your workflow, and verify hardware against component datasheets and qualified guidance.

## Contributing

Ideas, bug reports, documentation improvements, and code contributions are welcome. To get started:

1. [Open an issue](https://github.com/Creational-crates/smart-desk/issues) with a bug report or feature idea, or check existing issues first.
2. For code changes, explain the user problem and keep the change focused.
3. Add or update tests when changing geometry, project formats, validation, or manufacturing exports.
4. Run `npm test` and `npm run check` before submitting a pull request.
5. Document assumptions and limitations, especially for hardware, fabrication, and safety-related workflows.

## Built with

- Vanilla JavaScript, HTML, and CSS
- [Three.js](https://threejs.org/) for interactive 3D work
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and [three-bvh-csg](https://github.com/looeee/three-bvh-csg) for mesh acceleration and constructive geometry
- Node.js for the local server and test runner

See `package.json` and `package-lock.json` for dependency details. Smart Desk is released under the [MIT License](LICENSE).

---

If you try Smart Desk, feedback on what was intuitive, confusing, or missing is especially helpful.
