# Third-party components

The editor is built from scratchfoundation/scratch-editor, version 15.3.0 at the commit recorded in research/scratch-provenance.json. The checkout declares AGPL-3.0-only. Original LICENSE, TRADEMARK and component notices remain in scratch-editor. This local build is not endorsed by the Scratch Foundation.

The 1,347 standard library assets in web/library-assets were downloaded from the official Scratch asset service and verified against their content identifiers. Code licensing and media redistribution terms are separate; the asset attribution and redistribution review remains outstanding.

Browser integration tests use Playwright 1.64.1 from the existing Scratch checkout dependencies and installed Google Chrome. The standalone Electron host and its distribution have been removed. Dependency versions are recorded by scratch-editor/package-lock.json.

Public-source delivery, independent branding and the complete dependency/asset notice review must be completed for a public release.
