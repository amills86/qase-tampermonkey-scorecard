// ==UserScript==
// @name         Qase Repo Checker
// @namespace    https://example.internal/qase-repo-checker
// @version      0.4.0
// @description  Bootstrap loader for Qase Repo Checker core logic.
// @author       Your Team
// @match        https://app.qase.io/*
// @grant        GM_xmlhttpRequest
// @connect      api.qase.io
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    standardsName: "Paylocity standards",
    qaseApiBase: "https://api.qase.io/v1",
    qaseApiToken: "",
    // Host this core file somewhere reachable by the browser (e.g. raw GitHub URL).
    coreLogicUrl: "https://raw.githubusercontent.com/your-org/qase-repo-checker/main/tampermonkey/qase-repo-rubric.core.js",
    cacheBust: ""
  };

  loadAndStartCore();

  function loadAndStartCore() {
    const url = withCacheBust(CONFIG.coreLogicUrl, CONFIG.cacheBust);

    fetchText(url)
      .then((source) => {
        eval(source);

        if (!window.QaseRepoCheckerCore || typeof window.QaseRepoCheckerCore.init !== "function") {
          throw new Error("Core script loaded but init() was not found.");
        }

        window.QaseRepoCheckerCore.init({
          standardsName: CONFIG.standardsName,
          qaseApiBase: CONFIG.qaseApiBase,
          qaseApiToken: CONFIG.qaseApiToken
        });
      })
      .catch((error) => {
        console.error("Qase Repo Checker bootstrap failed:", error);
      });
  }

  function withCacheBust(url, cacheBust) {
    const value = String(cacheBust || "").trim();
    if (!value) {
      return url;
    }
    return url.includes("?") ? `${url}&v=${encodeURIComponent(value)}` : `${url}?v=${encodeURIComponent(value)}`;
  }

  function fetchText(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest is unavailable in this userscript context."));
        return;
      }

      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`Failed to load core logic (HTTP ${response.status}).`));
            return;
          }

          resolve(response.responseText || "");
        },
        onerror: () => {
          reject(new Error("Network error while loading core logic."));
        }
      });
    });
  }
})();
