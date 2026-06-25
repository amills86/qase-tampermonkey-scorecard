// ==UserScript==
// @name         Qase Repo Checker
// @namespace    https://example.internal/qase-repo-checker
// @version      1.0.0
// @description  Qase Repo Checker — thin loader. Core logic is loaded from GitHub via @require.
// @author       Your Team
// @match        https://app.qase.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.qase.io
// @require      https://raw.githubusercontent.com/amills86/qase-tampermonkey-scorecard/refs/heads/main/tampermonkey/qase-scorecard.core.js
// ==/UserScript==

// ---------------------------------------------------------------------------
// This userscript is intentionally tiny: it only holds your configuration and
// boots the core module. All of the real logic lives in qase-scorecard.core.js,
// pulled in by the @require line above.
//
// Setup:
//   1. Replace OWNER/REPO/BRANCH in the @require URL with your raw GitHub path,
//      e.g. https://raw.githubusercontent.com/my-org/qase-tampermonkey-scorecard/main/tampermonkey/qase-scorecard.core.js
//   2. Put your Qase API token in CONFIG.qaseApiToken below.
//
// Note: Tampermonkey caches @require scripts. After changing core.js, bump the
// @version above (or reinstall) so Tampermonkey re-fetches the latest core.
// ---------------------------------------------------------------------------

(function () {
  "use strict";

  const CONFIG = {
    standardsName: "Standards",
    qaseApiBase: "https://api.qase.io/v1",
    qaseApiToken: ""
  };

  const core =
    (typeof window !== "undefined" && window.QaseScorecardCore) ||
    (typeof QaseScorecardCore !== "undefined" ? QaseScorecardCore : null);

  if (core && typeof core.init === "function") {
    core.init(CONFIG);
  } else {
    console.error(
      "[Qase Repo Checker] Core module failed to load. Check the @require URL in the userscript header."
    );
  }
})();
