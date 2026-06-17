# Qase Repo Checker (Tampermonkey)

This script adds a **Check Score** button on Qase pages and validates top-level suites using the Qase suite API.

## Current Behavior

- Reads project code from URLs like `https://app.qase.io/project/<projectcode>`.
- Calls Qase suite endpoint only: `GET /v1/suite/{projectcode}` (paged).
- Requires both top-level suite rules to pass:
  - Current State (accepted: Current State or Current Production State)
  - Future State (accepted: Future State or Upcoming Initiatives)
- Shows accepted substitution details in the results.
- Shows API errors only when they occur.

## File Layout

- `tampermonkey/qase-repo-rubric.user.js`: Stable bootstrap/loader script.
- `tampermonkey/qase-repo-rubric.core.js`: Main logic file.

## Why Split Bootstrap + Core

The loader script stays mostly unchanged. You can update logic in `qase-repo-rubric.core.js` and publish that file without editing the installed userscript each time.

## Setup

1. Install Tampermonkey.
2. Install `tampermonkey/qase-repo-rubric.user.js` into Tampermonkey.
3. In `tampermonkey/qase-repo-rubric.user.js`, set:
   - `CONFIG.qaseApiToken`
   - `CONFIG.coreLogicUrl` (URL where `qase-repo-rubric.core.js` is hosted)
4. Open a Qase project page and click **Check Score**.

## Notes

- The loader uses `GM_xmlhttpRequest` to download core logic from `CONFIG.coreLogicUrl`.
- Add a value to `CONFIG.cacheBust` when you want to force refresh cached core logic.
