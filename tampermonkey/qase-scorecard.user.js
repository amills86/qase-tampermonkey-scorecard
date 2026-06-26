// ==UserScript==
// @name         Qase Repo Checker
// @namespace    https://example.internal/qase-repo-checker
// @version      1.0.2
// @description  Qase Repo Checker — thin loader. Core logic is fetched from GitHub with a localStorage cache fallback.
// @author       amills86
// @match        https://app.qase.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.qase.io
// @connect      raw.githubusercontent.com
// ==/UserScript==

(async () => {
  "use strict";

  const CONFIG = {
    qaseApiBase: "https://api.qase.io/v1",
    qaseApiToken: ""
  };

  // ----------------------------------------------------
  // DO NOT UPDATE BELOW THIS LINE
  // ----------------------------------------------------
  // --- STEP 1: Try to fetch latest core from GitHub ---
  const CORE_URL =
    "https://raw.githubusercontent.com/amills86/qase-tampermonkey-scorecard/refs/heads/main/tampermonkey/qase-scorecard.core.js";
  const STORAGE_KEY = "qaseRepoChecker.cachedCode";
  const STORAGE_TIME_KEY = "qaseRepoChecker.cachedTime";

  let latestCode = null;
  try {
    const res = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: CORE_URL,
        nocache: true,
        onload: response => resolve(response),
        onerror: err => reject(err)
      });
    });
    if (res.status === 200 && res.responseText) {
      latestCode = res.responseText;
      localStorage.setItem(STORAGE_KEY, latestCode);
      localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
      console.log("[Qase Repo Checker] Core updated from GitHub:", CORE_URL);
    } else {
      throw new Error("Bad status " + res.status);
    }
  } catch (e) {
    console.warn("[Qase Repo Checker] Could not fetch core, falling back to cache:", e);
  }

  // --- STEP 2: Fallback to cached version if needed ---
  if (!latestCode) {
    const cachedCode = localStorage.getItem(STORAGE_KEY);
    const cachedTime = localStorage.getItem(STORAGE_TIME_KEY);
    if (cachedCode) {
      latestCode = cachedCode;
      console.log(
        "[Qase Repo Checker] Loaded core from cache (age: " +
          ((Date.now() - Number(cachedTime)) / 1000 / 60).toFixed(1) + " min)"
      );
    } else {
      console.error("[Qase Repo Checker] No core available (network + cache failed).");
      return;
    }
  }

  // --- STEP 3: Run core in page context ---
  // NOTE: use *direct* eval (not (0, eval)) so the core runs in this closure,
  // where Tampermonkey's GM_* functions are in scope. Indirect eval would run
  // it in global scope, where GM_xmlhttpRequest is unavailable.
  try {
    // eslint-disable-next-line no-eval
    eval(latestCode);
    console.log("[Qase Repo Checker] Core executed in Tampermonkey sandbox");
  } catch (e) {
    console.error("[Qase Repo Checker] Failed to execute core:", e);
    return;
  }

  // --- STEP 4: Initialize the core module ---
  const core =
    (typeof window !== "undefined" && window.QaseRepoCheckerCore) ||
    (typeof QaseRepoCheckerCore !== "undefined" ? QaseRepoCheckerCore : null);

  if (core && typeof core.init === "function") {
    core.init(CONFIG);
  } else {
    console.error(
      "[Qase Repo Checker] Core module loaded but QaseRepoCheckerCore.init was not found."
    );
  }
})();