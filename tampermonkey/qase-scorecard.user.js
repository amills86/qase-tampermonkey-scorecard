// ==UserScript==
// @name         Qase Scorecard
// @namespace    https://example.internal/qase-scorecard
// @version      1.0.0
// @description  Qase Scorecard
// @match        https://app.qase.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.qase.io
// @require      https://raw.githubusercontent.com/amills86/qase-tampermonkey-scorecard/refs/heads/main/tampermonkey/qase-scorecard.core.js
// ==/UserScript==

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
      "[Qase Scorecard] Core module failed to load. Check the @require URL in the userscript header."
    );
  }
})();
