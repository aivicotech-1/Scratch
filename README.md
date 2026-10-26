# Scratch website project

Run the official Scratch editor in a browser at [http://localhost:8601](http://localhost:8601).

## Run on localhost (Windows)

The working project is in **E:\PictobloxREA**. This existing workspace already contains the Node.js runtime, installed dependencies, compiled website and standard library assets. You do not need to install or rebuild anything for normal use.

### Option 1: Double-click the launcher

1. Open **E:\PictobloxREA** in File Explorer.
2. Double-click **Launch-Scratch-Web.cmd**.
3. The launcher starts the server in the background and opens your browser.
4. If the browser does not open, visit **http://localhost:8601** manually.

Use **Launch-Scratch-Web.cmd** to start the browser website. No Electron desktop application is required or included.

You can close the launcher window once startup completes. Closing the browser does not stop the background server. Run the launcher again after restarting Windows; if the server is already running, the launcher reuses it.

### Option 2: Start from PowerShell

Open PowerShell and paste:

~~~powershell
Set-Location 'E:\PictobloxREA'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Start-Scratch-Web.ps1' -OpenBrowser
~~~

To start the background server without opening another browser tab, omit `-OpenBrowser`.

### Option 3: Run in a terminal (easy to stop)

If the background server is not already running:

~~~powershell
Set-Location 'E:\PictobloxREA'
& '.\tools\node-v24.22.1\node.exe' '.\scripts\serve-scratch-web.cjs'
~~~

Open **http://localhost:8601** and leave the terminal running. Press **Ctrl+C** in that terminal to stop this server.

The server listens on **127.0.0.1:8601**, so only this computer can access it. A localhost link does not publish the website online.

## Save and reopen projects

- Use **File > New** to start a fresh project.
- Use **File > Save to your computer** to download an `.sb3` project.
- Use **File > Load from your computer** to reopen an `.sb3` project.

Save your work before closing, refreshing or starting another project. This local setup does not provide account-based online saving.

## Stop the background server

Save your project first. For the server started by the launcher, run the following in PowerShell. It checks the process command line before stopping it:

~~~powershell
Set-Location 'E:\PictobloxREA'
$scratchServerPid = [int](Get-Content -LiteralPath '.\.cache\web\server.pid')
$scratchServerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $scratchServerPid"
if ($scratchServerProcess -and
    $scratchServerProcess.Name -eq 'node.exe' -and
    $scratchServerProcess.CommandLine -like '*E:\PictobloxREA\scripts\serve-scratch-web.cjs*') {
    Stop-Process -Id $scratchServerPid
    Write-Output 'Scratch localhost server stopped.'
} else {
    Write-Output 'No matching Scratch server found for the saved process ID.'
}
~~~

For a server started directly in a terminal, use **Ctrl+C** instead.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Browser says the site cannot be reached | Run Launch-Scratch-Web.cmd, then open http://localhost:8601. You can also try http://127.0.0.1:8601. |
| The page shows an older version after a rebuild | Save your project, then refresh the page with Ctrl+F5. |
| Port 8601 is already in use / EADDRINUSE | If Scratch is already running, use its existing browser URL. Otherwise identify the application using the port and close it before starting Scratch. |
| Website build is missing | Follow the rebuild instructions below in the prepared workspace. |
| Launcher reports an error | Read .cache/web/server-error.log and .cache/web/server.log. |
| PowerShell blocks direct execution of the script | Use the .cmd launcher or the exact PowerShell command above. |

Check whether the server is responding:

~~~powershell
Invoke-RestMethod 'http://127.0.0.1:8601/healthz'
~~~

The response should contain `app: scratch-local-web` and `port: 8601`.

## Deploy to Vercel

Import **aivicotech-1/Scratch** from GitHub into Vercel and select the **main** branch. Use the repository root (do not select scratch-editor). The checked-in vercel.json supplies these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js | 24.x |
| Install command | npm ci --prefix scratch-editor --ignore-scripts --include=dev --no-audit --no-fund |
| Build command | npm run build |
| Output directory | web/dist |

No application secrets or environment variables are required for the current editor. Future server credentials belong in Vercel's Environment Variables settings, not in Git or client-side JavaScript.

Vercel fetches the public Scratch submodule. The build compiles the editor in production mode, downloads and verifies the standard assets, and copies them into the static output. The asset rewrite in vercel.json maps Scratch's asset URLs to those packaged files. No persistent Node server or Windows launcher runs on Vercel.

After deployment reaches **Ready**, open the assigned HTTPS address and test it in a signed-out/private window before sharing. Confirm production Deployment Protection permits your intended visitors. The first deployment needs network access to npm, Scratch's asset service and the generated micro:bit asset download.

Use File > Save to your computer to keep projects. Hosting the editor does not add accounts, cloud project storage or Scratch community services.

### npm commands

With Node.js 24.x installed and the project prepared:

~~~powershell
npm run dev
~~~

This starts localhost:8601 in the terminal; Ctrl+C stops it. To build the complete production site:

~~~powershell
npm run build
~~~

The production build also works on Linux and uses the running Node executable. Builds fetch missing standard assets and place deployable files under web/dist. Rebuilding only the editor clears that output, so use the full production build before deployment.


## Set up a fresh GitHub clone (Windows)

This repository tracks the official Scratch source as a **Git submodule**, pinned to the commit in research/scratch-provenance.json. Use a recursive clone so you receive both this website integration and the Scratch source:

~~~powershell
git clone --recurse-submodules https://github.com/aivicotech-1/Scratch.git scratch-website
Set-Location scratch-website
~~~

If you already cloned without submodules, run:

~~~powershell
git submodule update --init --recursive
~~~

Install Git and Node.js **24.22.1** with npm first. Then run the following from your clone's root folder. These commands download dependencies and standard library assets and build the website:

~~~powershell
$projectRoot = (Get-Location).Path
$env:TEMP = Join-Path $projectRoot '.cache\temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null

node scripts/setup-scratch-node.cjs
Push-Location scratch-editor
npm ci --ignore-scripts --no-audit --no-fund
Pop-Location
& '.\tools\node-v24.22.1\node.exe' scripts/build-scratch.cjs
& '.\tools\node-v24.22.1\node.exe' scripts/cache-scratch-library.cjs
.\Launch-Scratch-Web.cmd
~~~

Stop and resolve any command failure before continuing. The build helper runs the required GUI asset-generation step explicitly. Runtime binaries, installed dependencies, generated website files, downloaded library assets, caches and personal projects are intentionally excluded from Git.

The E:\PictobloxREA paths elsewhere in this guide describe the original development computer. Substitute your own clone location when following those examples. The launcher and server resolve their paths relative to the project folder.


## Rebuild after changing the browser integration

Run these commands from PowerShell in the prepared workspace. A rebuild is not needed each time you start the website.

~~~powershell
Set-Location 'E:\PictobloxREA'
$env:NODE_OPTIONS = '--max-old-space-size=6144'
& '.\tools\node-v24.22.1\node.exe' '.\scripts\build-scratch-web.cjs'
~~~

Wait for a successful build, then start the server if necessary and refresh your browser. This build uses the existing official Scratch checkout and its installed dependencies; these instructions are not a fresh-machine installation guide.

## Verify the website

With the localhost server running:

~~~powershell
Set-Location 'E:\PictobloxREA'
& '.\tools\node-v24.22.1\node.exe' '.\scripts\test-scratch-web-server.cjs'
& '.\tools\node-v24.22.1\node.exe' '.\scripts\test-scratch-web.cjs'
~~~

Browser verification uses installed Google Chrome. Reports and screenshots are saved under **research/validation/scratch-web.***.

Verified on 26 October 2026: 12 Chrome integration checks passed, plus server file-access checks. No unhandled page errors or server project-write requests occurred. Standard-library asset requests stayed on localhost.

## Project files and features

- **web/render-editor.js**: browser integration with local standard-library URLs.
- **web/dist/**: compiled website.
- **scripts/serve-scratch-web.cjs**: localhost website and asset server.
- **scripts/Start-Scratch-Web.ps1**: background server launcher.
- **scratch-editor/**: pinned official source, kept separate and unchanged.
- **web/library-assets/**: 1,347 verified standard library assets used by the website.
- **scratch-editor/node_modules/**: upstream build dependencies and the browser-test tools.
- **research/**: source provenance and verification evidence.

The editor includes blocks, variables, lists, custom procedures, sprites/stage, costume and sound editors, SB3 projects and the extension interface. Accounts, community sharing, backpack and cloud-variable servers are separate services. Hardware and network-dependent extensions require their external devices or services.

The retired PictoBlox research, Orbit prototype, REA tools, Electron host, desktop releases and desktop-only scripts were removed. The directory name is historical. Future features will be added only when requested.

The upstream LICENSE and TRADEMARK notices remain intact. Public release still needs appropriate branding, corresponding-source delivery and an asset/dependency license review.

## Secrets and environment files

The current localhost editor requires no API keys or application secrets. Keep any future credentials in a local .env file, never in source code. Local .env files are ignored by Git; .env.example documents required variables without real values. The current server does not automatically load .env files. GitHub authentication stays in Windows Git Credential Manager and is not part of this repository.

Production verification (26 October 2026): the full production build and all 12 browser checks passed locally using Vercel's compiled routing rules. All 1,347 library assets were packaged, asset redirects/content types worked, and private files returned 404. Build warnings concern bundle size and optional Node-only canvas support. The first actual Vercel cloud deployment remains to be performed by the account owner.
