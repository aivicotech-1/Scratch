# Blocks Orbit

**Blocks Orbit** is a browser-based visual programming editor built from the official [Scratch editor](https://github.com/scratchfoundation/scratch-editor). This repository adds the browser integration, local server, asset preparation, and Vercel deployment configuration.

The Blocks Orbit presentation layer uses its own logo, favicon, and navy-and-teal interface. The pinned Scratch runtime, block behavior, media editors, and project formats remain unchanged.

The application runs in a web browser. It does not require Electron or a desktop installation.

**Source:** [aivicotech-1/Scratch](https://github.com/aivicotech-1/Scratch) · **Local URL:** [localhost:8601](http://localhost:8601) · **Runtime:** Node.js 24.x

## Contents

- [Features and scope](#features-and-scope)
- [Quick start](#quick-start)
- [Development workflow](#development-workflow)
- [Code structure](#code-structure)
- [How the application works](#how-the-application-works)
- [Deploy to Vercel](#deploy-to-vercel)
- [Testing](#testing)
- [Configuration and secrets](#configuration-and-secrets)
- [Troubleshooting](#troubleshooting)
- [Licensing and attribution](#licensing-and-attribution)

## Features and scope

| Included in the editor | Requires separate services or future work |
| --- | --- |
| Block programming, variables, lists, and custom blocks | User accounts and online project storage |
| Sprites, backdrops, and stage controls | Community publishing, comments, and sharing |
| Costume drawing and sound editing | Backpack and cloud-variable services |
| Local project import/export as Scratch 3 files (`.sb3`) | Hardware devices and services needed by hardware extensions |
| Standard sprite, costume, sound, and backdrop libraries | External services used by network-dependent extensions |

The official editor is the current foundation. Hosting it does not reproduce the entire Scratch community website.

**Project saving:** use **File → Save to your computer** and **File → Load from your computer**. Save before refreshing or closing the page; account-based saving is not implemented.

### Blocks and Python learning views

In the **Code** tab, choose **Blocks**, **Python code**, or **Both**. Python follows the selected sprite or stage and updates after block additions, edits, deletions, and undo/redo. Both shows the views side by side on wide screens and vertically on narrower screens. Below 1,024 pixels, the stage moves below the full-width editor. Scripts are fitted after layout changes; **Fit blocks** brings them back into view without moving or changing the project blocks. **Copy code** copies the preview without line numbers.

This is a **read-only teaching translation**, not an executable Python environment or a two-way converter. The green flag still runs the original blocks. Generated Python uses an illustrative `orbit` API for sprites, events, Scratch-style values, and 1-based list operations; that Python runtime is not included. Variable and list declarations reflect the current project snapshot.

The translator covers common motion, looks, sound, events, control, sensing, operators, variables, lists, and custom blocks, plus selected pen/music commands. Untranslated blocks are explicitly shown as `orbit.unsupported(...)` and listed in translation notices. Unattached stacks are labeled separately. It does not claim executable equivalence for extension/hardware behavior or Scratch scheduling.

Implementation stays outside the pinned upstream source: `web/python-workspace.js` supplies the view controls and VM subscriptions, `web/python-generator.cjs` translates the serialized block graph, and `web/python-workspace.css` handles the layout. The build substitutes the GUI's block-container import with this wrapper; the wrapper retains the original block editor.

## Quick start

### Requirements

- Git, with access to GitHub.
- Node.js **24.x** and npm on your PATH. The local baseline used **24.22.1**.
- A modern browser.
- Internet access for the initial dependency, asset, and build-resource downloads.

Run these commands in a terminal:

~~~sh
git clone --recurse-submodules https://github.com/aivicotech-1/Scratch.git
cd Scratch
npm ci --prefix scratch-editor --ignore-scripts --include=dev --no-audit --no-fund
npm run build
npm run dev
~~~

Open **[http://localhost:8601](http://localhost:8601)**. Keep the terminal open and press **Ctrl+C** to stop the server.

The first build compiles Scratch and prepares its libraries; it can take several minutes. Wait for each command to succeed before continuing. Dependencies are installed inside `scratch-editor`; installing only the root package is not sufficient.

If you cloned without `--recurse-submodules`, retrieve the pinned Scratch source first:

~~~sh
git submodule update --init --recursive
~~~

For subsequent starts, run only `npm run dev`. Rebuild when you change source code.

<details>
<summary>Optional Windows shortcut: start and stop the background server</summary>

After completing the quick start, download the launcher’s pinned Node runtime once:

~~~powershell
node scripts/setup-scratch-node.cjs
~~~

Double-click **Launch-Scratch-Web.cmd**. It starts the same website in the background and opens your default browser. It reuses an existing server and does not install a desktop app.

Closing the browser does not stop this background process. It does not automatically restart after Windows restarts. Logs and the process ID are stored in `.cache/web/`.

To stop a launcher-started server, save your project and run this from the repository root in PowerShell:

~~~powershell
$scratchServerPid = [int](Get-Content '.cache/web/server.pid')
$scratchServerScript = (Resolve-Path 'scripts/serve-scratch-web.cjs').Path
$scratchServerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $scratchServerPid"

if ($scratchServerProcess -and
    $scratchServerProcess.Name -eq 'node.exe' -and
    $scratchServerProcess.CommandLine -match [regex]::Escape($scratchServerScript)) {
    Stop-Process -Id $scratchServerPid
}
~~~

For a server started with `npm run dev`, use **Ctrl+C** in its terminal instead.

</details>

## Development workflow

| Command | Purpose |
| --- | --- |
| `npm run dev` | Serve the existing build on localhost:8601. |
| `npm start` | Same local server as `npm run dev`. |
| `npm run build` | Compile the full production site, verify/download libraries, and package deployable files. |
| `npm run build:editor` | Rebuild only the editor bundle using already-built Scratch dependencies. |
| `npm run test:server` | Check local file serving and path restrictions. |
| `npm run test:browser` | Run browser integration checks against a running website. |
| `npm run test:ui` | Check Blocks Orbit branding, desktop layouts, menus, fullscreen, and media panels. |
| `npm run test:python` | Test translation of control flow, data, custom blocks, and unsupported blocks. |
| `npm run test:python-ui` | Test live drag/drop updates, undo, modes, target changes, and block execution. |
| `npm run test:deployment-files` | Check that deployment exclusions retain required source files. |

**There is no automatic rebuild or hot reload.** After editing, rebuild and refresh the browser. The server can stay running, but save any open project before refreshing.

Use `npm run build:editor` for browser integration or GUI-only changes. Use the full `npm run build` after changes to the runtime, renderer, other dependent packages, or before deployment. An editor-only build clears `web/dist`, including previously packaged library assets.

### Working with the Scratch source

`scratch-editor/` is a Git submodule: a separate repository pinned to a specific upstream commit. Its source and license details are recorded in [research/scratch-provenance.json](research/scratch-provenance.json). The baseline is Scratch editor **15.3.0**.

- Make website integration and deployment changes in this repository.
- Make editor, runtime, or drawing-tool changes inside the appropriate Scratch package.
- Changes inside a submodule are not included automatically in a parent-repository commit. Publish modified Scratch source to a repository you control, update the submodule URL if needed, and commit the new submodule reference here.
- Do not advance the upstream revision unintentionally. Review its changes and rerun the relevant checks when updating it.

## Code structure

| Path | Responsibility |
| --- | --- |
| [web/orbit.css](web/orbit.css) | Blocks Orbit colors, typography, toolbar, tabs, panels, and modal styling. |
| [scripts/orbit-branding-loader.cjs](scripts/orbit-branding-loader.cjs) | Applies presentation-only logo labels and default project naming during the build. |
| [web/render-editor.js](web/render-editor.js) | Mounts Scratch, configures local/hosted asset URLs, and disables unsupported online services. |
| `scratch-editor/packages/scratch-gui/src/` | Editor interface, menus, panels, and project interactions. |
| `scratch-editor/packages/scratch-vm/src/blocks/` | Execution of motion, control, variables, lists, and other programming blocks. |
| `scratch-editor/packages/scratch-render/src/` | Sprite and stage rendering. |
| `scratch-editor/packages/scratch-paint/src/` | Costume/backdrop drawing tools. |
| `scratch-editor/packages/scratch-storage/src/` | Project and asset storage support. |
| [scripts/serve-scratch-web.cjs](scripts/serve-scratch-web.cjs) | Local HTTP server and asset routes. |
| [scripts/build-deployment.cjs](scripts/build-deployment.cjs) | Runs the complete production build and packaging sequence. |
| [scripts/build-scratch.cjs](scripts/build-scratch.cjs) | Builds the Scratch packages in dependency order. |
| [scripts/build-scratch-web.cjs](scripts/build-scratch-web.cjs) | Configures and builds the browser editor with webpack. |
| [scripts/cache-scratch-library.cjs](scripts/cache-scratch-library.cjs) | Downloads and verifies standard library assets. |
| [scripts/package-web-assets.cjs](scripts/package-web-assets.cjs) | Copies verified assets and notices into the deployment output. |
| [vercel.json](vercel.json) | Vercel install/build commands, output directory, and asset routing. |
| [research/](research/) | Source provenance, baseline notes, and validation evidence. |

Generated files are excluded from Git:

| Path | Contents |
| --- | --- |
| `web/dist/` | Compiled website and, after a full build, packaged libraries. **Do not edit directly.** |
| `web/library-assets/` | Downloaded standard library cache; 1,347 assets in the current baseline. |
| `scratch-editor/node_modules/` | Installed upstream dependencies. |
| `.cache/` | Build/download caches, logs, and local tools. |
| `tools/node-v*/` | Optional pinned Windows Node runtime for the shortcut. |
| `projects/` | Local user projects, if saved here. |

## How the application works

1. **Build:** the build helper prepares generated assets and compiles Scratch’s packages and browser integration.
2. **Package:** standard media assets are checked against their MD5 content identifiers and copied into `web/dist/library-assets/`. License notices and a source-code link are included.
3. **Run locally:** the Node server serves `web/dist/` and reads library assets from `web/library-assets/`. It listens only on this computer.
4. **Run on Vercel:** Vercel serves `web/dist/` as static files. The editor and Scratch runtime execute in the visitor’s browser; no persistent Node server is required.

Scratch requests assets through `/internalapi/asset/<filename>/get/`. The local server handles this route directly. Vercel normalizes the trailing slash and rewrites the request to `/library-assets/<filename>`.

## Deploy to Vercel

Import **aivicotech-1/Scratch**, choose branch **main**, and leave the Root Directory at the repository root (`./`).

The configuration is checked into [vercel.json](vercel.json):

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js | 24.x |
| Install command | `npm ci --prefix scratch-editor --ignore-scripts --include=dev --no-audit --no-fund` |
| Build command | `npm run build` |
| Output directory | `web/dist` |
| Required application environment variables | None |

The public submodule supplies the pinned Scratch source. Initial builds need network access to npm, Scratch’s asset service, and the generated micro:bit resource download.

After Vercel reports **Ready**, test its HTTPS URL in a signed-out/private browser window. Confirm that the intended visitors can access it before sharing.

**Deployment exclusions:** [.vercelignore](.vercelignore) must preserve nested source directories. Use `/tools/` to exclude the root runtime folder; an unanchored `tools/` also excludes Scratch’s paint tools and breaks the build.

## Testing

After building, start `npm run dev` in one terminal. In another terminal at the repository root:

~~~sh
npm run test:server
npm run test:deployment-files
npm run test:browser
~~~

The browser test currently expects **Windows with Google Chrome installed at its standard Program Files path**. It uses Playwright from the Scratch dependencies; the browser test itself is not yet portable to every operating system.

The 12 browser checks cover editor startup, standard assets, sprite selection, variables/lists, the custom-block dialog, costume/sound editors, program execution, and SB3 save/open/new. Hardware extensions and external services are not covered.

Reports and screenshots are in [research/validation/](research/validation/). Local production-build checks passed on **26 October 2026**. The deployment filter also has a regression check covering all six paint-tool files and 2,636 tracked upstream source files. These checks do not certify a live Vercel deployment.

To test another running URL from PowerShell:

~~~powershell
$env:SCRATCH_TEST_URL = 'https://your-project.vercel.app'
$env:SCRATCH_TEST_REPORT = 'scratch-hosted'
npm run test:browser
~~~

## Configuration and secrets

The current editor requires no application credentials.

- Keep future local secrets in `.env` files; they are excluded from Git and deployment uploads.
- Document variable names without real values in [.env.example](.env.example).
- The current server does **not** automatically load `.env` files.
- Configure future hosted server credentials in Vercel’s environment settings. Never embed secrets in browser code or static build output.
- GitHub/Vercel login credentials belong in their authentication tools, not this repository.

The local server reads `PORT` from the process environment and defaults to `8601`. The Windows shortcut always targets port `8601`.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `scratch-editor` is empty or packages are missing | Run `git submodule update --init --recursive`, then the dependency-install command from Quick start. |
| Website build is missing | Run `npm run build` before starting the server. |
| Localhost cannot be reached | Start `npm run dev`; also try `http://127.0.0.1:8601`. |
| `EADDRINUSE` / port already in use | Reuse the running Scratch server or stop the process occupying port 8601. |
| Changes do not appear | Rebuild, save your project, and hard-refresh the browser. |
| Windows shortcut fails | Run `node scripts/setup-scratch-node.cjs` if its runtime is missing; inspect `.cache/web/server-error.log`. |
| Vercel reports missing paint-tool modules | Run `npm run test:deployment-files` and deploy the latest commit containing the anchored ignore rules. |
| Library assets are missing after deployment | Use the full production build and preserve the asset rewrite in `vercel.json`. |
| Build shows dependency or bundle-size warnings | Check the final exit status. Warnings alone do not mean failure; a nonzero exit needs investigation. |

The local health endpoint is `http://127.0.0.1:8601/healthz`; it should return `app: scratch-local-web`. It is not part of the static Vercel website.

## Licensing and attribution

Read [LICENSE](LICENSE), [TRADEMARK](TRADEMARK), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The source uses **AGPL-3.0-only**; Scratch branding and media have separate considerations.

Preserve upstream notices and source availability when distributing changes. This project is not endorsed by the Scratch Foundation. Asset/dependency redistribution review and an independent public product identity remain outstanding.
