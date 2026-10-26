# Scratch browser baseline

- Source: https://github.com/scratchfoundation/scratch-editor
- Commit: cf59b9d0a4de6d79b961e5bd56806edd31d11840
- Version: 15.3.0
- Node: 24.22.1
- Source folder: scratch-editor/
- Website: web/dist/
- Local library assets: web/library-assets/ (1,347 verified files)
- Launcher: Launch-Scratch-Web.cmd
- URL: http://localhost:8601
- Provenance: research/scratch-provenance.json

The website uses the official editor with a separate browser integration. Electron and its desktop distribution have been removed. Original LICENSE, TRADEMARK and component notices remain in scratch-editor.

See README.md for startup, build and verification commands. scripts/build-scratch.cjs rebuilds the dependent Scratch packages and the website; scripts/build-scratch-web.cjs rebuilds the website integration alone. scripts/cache-scratch-library.cjs verifies or downloads the standard assets. Browser tests use Playwright from scratch-editor/node_modules and installed Google Chrome.

The browser validation covers variables, lists, custom-block dialog, sprite library, costume/sound editors, program execution and SB3 save/load/new. It does not verify every upstream feature or hardware extension. Accounts, community services, backpack and cloud-variable infrastructure are not included.
