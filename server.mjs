import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = fileURLToPath(new URL(".", import.meta.url));
const publicFiles = new Set(["index.html", "style.css", "script.js", "robotics-studio.js", "cad-mesh-analysis.js", "cad-slicer.js", "cad-3mf.js", "cad-step.js", "pcb-manufacturing.js"]);
const publicDependencyPattern = /^node_modules\/(?:three\/build\/three\.(?:module|core)\.js|three\/examples\/jsm\/(?:controls\/OrbitControls|utils\/BufferGeometryUtils|loaders\/(?:OBJLoader|STLLoader))\.js|three-mesh-bvh\/build\/index\.module\.js|three-bvh-csg\/src\/.+\.js)$/;
const port = Number(process.env.PORT || 3000);
const baseUrl = `http://localhost:${port}`;

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
};

function sendText(response, status, message) {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(message);
}

async function serveStatic(response, pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        sendText(response, 400, "Invalid request path.");
        return;
    }

    const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
    const target = resolve(publicRoot, `.${requestedPath}`);
    const pathFromRoot = relative(publicRoot, target);
    const normalizedPathFromRoot = pathFromRoot.replace(/\\/g, "/");
    if (
        pathFromRoot.startsWith("..") ||
        isAbsolute(pathFromRoot) ||
        (!publicFiles.has(normalizedPathFromRoot) && !publicDependencyPattern.test(normalizedPathFromRoot))
    ) {
        sendText(response, 403, "Forbidden.");
        return;
    }

    let fileInfo;
    try {
        fileInfo = await stat(target);
    } catch {
        sendText(response, 404, "Not found.");
        return;
    }
    if (!fileInfo.isFile()) {
        sendText(response, 404, "Not found.");
        return;
    }

    let contents = await readFile(target);
    if (normalizedPathFromRoot === "index.html") {
        contents = Buffer.from(contents.toString("utf8").replaceAll("__CSP_NONCE__", response.cspNonce));
    }
    response.writeHead(200, {
        "Content-Type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
        "Content-Length": contents.length,
        "Cache-Control": "no-cache"
    });
    response.end(contents);
}

async function handleRequest(request, response) {
    if (request.method !== "GET") {
        sendText(response, 405, "Method not allowed.");
        return;
    }

    const requestUrl = new URL(request.url, baseUrl);
    await serveStatic(response, requestUrl.pathname);
}

const server = createServer(async (request, response) => {
    response.cspNonce = randomBytes(18).toString("base64");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; script-src 'self' 'nonce-${response.cspNonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
    );
    try {
        await handleRequest(request, response);
    } catch (error) {
        console.error("Smart Desk request failed:", error.message);
        if (!response.headersSent) sendText(response, 500, "The request could not be completed.");
        else response.end();
    }
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Smart Desk is running at ${baseUrl}`);
});
