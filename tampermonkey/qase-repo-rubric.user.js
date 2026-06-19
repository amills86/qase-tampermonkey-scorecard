// ==UserScript==
// @name         Qase Repo Checker
// @namespace    https://example.internal/qase-repo-checker
// @version      0.9.0
// @description  Single-file Qase Repo Checker (no remote core fetch).
// @author       Your Team
// @match        https://app.qase.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.qase.io
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    standardsName: "Standards",
    qaseApiBase: "https://api.qase.io/v1",
    qaseApiToken: ""
  };

  const QaseRepoCheckerCore = (function () {
    const DEFAULTS = {
      standardsName: "Standards",
      qaseApiBase: "https://api.qase.io/v1",
      qaseApiToken: ""
    };

    const REQUIRED_TOP_LEVEL_SUITE_RULES = Object.freeze([
      Object.freeze({
        label: "Current State",
        anyOf: Object.freeze(["Current State", "Current Production State"])
      }),
      Object.freeze({
        label: "Future State",
        anyOf: Object.freeze(["Future State", "Upcoming Initiatives"])
      })
    ]);

    const REQUIRED_ENVIRONMENT_NAMES = Object.freeze([
      "Tin",
      "Bronze",
      "DrProd",
      "Corp",
      "Demo",
      "Prod",
      "Carbon"
    ]);

    let runtimeConfig = { ...DEFAULTS };

    const state = {
      initialized: false,
      buttonMounted: false,
      modalMounted: false,
      evaluating: false
    };

    function init(userConfig) {
      if (state.initialized) {
        return;
      }

      runtimeConfig = { ...DEFAULTS, ...(userConfig || {}) };
      state.initialized = true;

      injectStyles();
      mountButton();
      observeDomForRemount();
    }

    function injectStyles() {
      const css = `
        .qrc-overlay {
          --qrc-bg: #fff;
          --qrc-text: #15202b;
          --qrc-border: #dce4ec;
          --qrc-table-border: #d6e0ea;
          --qrc-score-bg: #f2f8ff;
          --qrc-score-border: #cfe4ff;
          --qrc-banner-bg: #f6fbff;
          --qrc-banner-border: #d7e3ee;
          --qrc-banner-text: #1e3d5a;
          --qrc-secondary-bg: #e9f0f7;
          --qrc-secondary-text: #1d3348;
          --qrc-input-bg: #fff;
          --qrc-input-border: #b7c7d7;
          --qrc-th-bg: #eef3f8;
          --qrc-details-bg: #f0f4f8;
          --qrc-details-hover: #e4eaf2;
        }
        @media (prefers-color-scheme: dark) {
          .qrc-overlay {
            --qrc-bg: #1c2533;
            --qrc-text: #dce8f5;
            --qrc-border: #2d3e54;
            --qrc-table-border: #2d3e54;
            --qrc-score-bg: #172840;
            --qrc-score-border: #1e3d5a;
            --qrc-banner-bg: #142034;
            --qrc-banner-border: #1e3550;
            --qrc-banner-text: #88b4d4;
            --qrc-secondary-bg: #1a2d42;
            --qrc-secondary-text: #90b8d8;
            --qrc-input-bg: #162030;
            --qrc-input-border: #2a3f58;
            --qrc-th-bg: #162030;
            --qrc-details-bg: #182538;
            --qrc-details-hover: #1e2e44;
          }
        }
        .qrc-button {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 99999;
          border: 0;
          border-radius: 999px;
          padding: 10px 16px;
          background: #005ea6;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
        }
        .qrc-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .qrc-overlay {
          position: fixed;
          inset: 0;
          z-index: 100000;
          background: rgba(10, 22, 34, 0.6);
          display: none;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .qrc-overlay.open {
          display: flex;
        }
        .qrc-modal {
          width: min(840px, 96vw);
          max-height: 92vh;
          overflow: auto;
          border-radius: 14px;
          background: var(--qrc-bg);
          color: var(--qrc-text);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
        .qrc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--qrc-border);
        }
        .qrc-title {
          margin: 0;
          font-size: 18px;
        }
        .qrc-close {
          border: 0;
          background: transparent;
          color: var(--qrc-text);
          font-size: 18px;
          cursor: pointer;
        }
        .qrc-body {
          padding: 16px;
        }
        .qrc-banner {
          border: 1px solid var(--qrc-banner-border);
          border-radius: 10px;
          background: var(--qrc-banner-bg);
          padding: 12px;
          font-size: 13px;
          color: var(--qrc-banner-text);
        }
        .qrc-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .qrc-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .qrc-field label {
          font-weight: 600;
          font-size: 12px;
        }
        .qrc-field input {
          border: 1px solid var(--qrc-input-border);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          background: var(--qrc-input-bg);
          color: var(--qrc-text);
        }
        .qrc-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
        .qrc-actions button {
          border: 0;
          border-radius: 8px;
          padding: 9px 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .qrc-primary {
          background: #0c7a3d;
          color: #fff;
        }
        .qrc-secondary {
          background: var(--qrc-secondary-bg);
          color: var(--qrc-secondary-text);
        }
        .qrc-status {
          margin-top: 12px;
          font-size: 13px;
        }
        .qrc-score {
          margin-top: 16px;
          padding: 12px;
          border-radius: 10px;
          background: var(--qrc-score-bg);
          border: 1px solid var(--qrc-score-border);
          font-weight: 700;
        }
        .qrc-details {
          margin-top: 12px;
          border: 1px solid var(--qrc-table-border);
          border-radius: 8px;
          overflow: hidden;
        }
        .qrc-summary {
          cursor: pointer;
          list-style: none;
          padding: 8px 12px;
          background: var(--qrc-details-bg);
          font-weight: 600;
          font-size: 13px;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .qrc-summary::-webkit-details-marker {
          display: none;
        }
        .qrc-summary::before {
          content: "▶";
          font-size: 10px;
        }
        details[open] > .qrc-summary::before {
          content: "▼";
        }
        .qrc-summary:hover {
          background: var(--qrc-details-hover);
        }
        .qrc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .qrc-table th,
        .qrc-table td {
          border: 1px solid var(--qrc-table-border);
          border-left: 0;
          border-right: 0;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        .qrc-table th {
          background: var(--qrc-th-bg);
          border-top: 0;
        }
        .qrc-table tr:last-child td {
          border-bottom: 0;
        }
        .qrc-pass {
          color: #0f7a41;
          font-weight: 700;
        }
        .qrc-fail {
          color: #b21f1f;
          font-weight: 700;
        }
      `;

      if (typeof GM_addStyle === "function") {
        GM_addStyle(css);
        return;
      }

      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }

    function mountButton() {
      if (state.buttonMounted) {
        return;
      }

      const button = document.createElement("button");
      button.className = "qrc-button";
      button.type = "button";
      button.textContent = "Check Score";
      button.addEventListener("click", openModal);
      document.body.appendChild(button);

      state.buttonMounted = true;
    }

    function observeDomForRemount() {
      const observer = new MutationObserver(() => {
        if (!document.querySelector(".qrc-button")) {
          state.buttonMounted = false;
          mountButton();
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function openModal() {
      if (!state.modalMounted) {
        mountModal();
        state.modalMounted = true;
      }

      const overlay = document.querySelector(".qrc-overlay");
      if (overlay) {
        overlay.classList.add("open");
      }

      hydrateFormDefaults();
    }

    function closeModal() {
      const overlay = document.querySelector(".qrc-overlay");
      if (overlay) {
        overlay.classList.remove("open");
      }
    }

    function mountModal() {
      const overlay = document.createElement("div");
      overlay.className = "qrc-overlay";

      overlay.innerHTML = `
        <div class="qrc-modal" role="dialog" aria-modal="true" aria-label="Qase Repo Checker">
          <div class="qrc-head">
            <h2 class="qrc-title">Qase Repo Checker</h2>
            <button class="qrc-close" type="button" aria-label="Close">X</button>
          </div>
          <div class="qrc-body">
            <div class="qrc-banner">
              Evaluate your test repository organization against ${escapeHtml(runtimeConfig.standardsName)}.
            </div>

            <div class="qrc-grid">
              <div class="qrc-field">
                <label for="qrc-project">Project Code (from URL: app.qase.io/project/&lt;projectcode&gt;)</label>
                <input id="qrc-project" type="text" disabled />
              </div>
            </div>

            <div class="qrc-actions">
              <button class="qrc-primary" id="qrc-evaluate" type="button">Check Score</button>
              <button class="qrc-secondary" id="qrc-clear" type="button">Clear Results</button>
            </div>

            <div class="qrc-status" id="qrc-status">Ready.</div>
            <div id="qrc-results"></div>
          </div>
        </div>
      `;

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closeModal();
        }
      });

      document.body.appendChild(overlay);

      overlay.querySelector(".qrc-close").addEventListener("click", closeModal);
      overlay.querySelector("#qrc-clear").addEventListener("click", clearResults);
      overlay.querySelector("#qrc-evaluate").addEventListener("click", onEvaluate);
    }

    function hydrateFormDefaults() {
      const projectInput = document.querySelector("#qrc-project");
      projectInput.value = detectQaseProjectCode() || "Unknown";
      setStatus("Ready.");
    }

    function clearResults() {
      const results = document.querySelector("#qrc-results");
      if (results) {
        results.innerHTML = "";
      }
      setStatus("Cleared.");
    }

    async function onEvaluate() {
      if (state.evaluating) {
        return;
      }

      state.evaluating = true;
      setEvaluateButtonBusy(true);

      try {
        const projectCode = ((document.querySelector("#qrc-project").value || "").trim() || "").toUpperCase();
        const token = String(runtimeConfig.qaseApiToken || "").trim();

        if (!projectCode || projectCode === "UNKNOWN") {
          setStatus("Cannot detect project code from URL. Open app.qase.io/project/<projectcode>.", true);
          return;
        }

        if (!token) {
          setStatus("Set CONFIG.qaseApiToken in the userscript before evaluating.", true);
          return;
        }

        clearResults();
        setStatus("Checking score...");

        const evaluation = await evaluateProjectWithQaseApis(projectCode, token);
        renderEvaluation(evaluation, projectCode);

        setStatus(
          `Evaluation complete (${evaluation.overallPassed ? "PASS" : "FAIL"} overall; suites: ${evaluation.suiteCheck.passed ? "PASS" : "FAIL"}, test plans: ${evaluation.planCheck.passed ? "PASS" : "FAIL"}, environments: ${evaluation.environmentCheck.passed ? "PASS" : "FAIL"}).`
        );
      } catch (error) {
        setStatus(`Error: ${error.message}`, true);
      } finally {
        state.evaluating = false;
        setEvaluateButtonBusy(false);
      }
    }

    async function evaluateProjectWithQaseApis(projectCode, token) {
      const suiteFetch = await fetchAllSuites(projectCode, token);
      const planFetch = await fetchAllPlans(projectCode, token);
      const environmentFetch = await fetchAllEnvironments(projectCode, token);
      const suiteResponse = suiteFetch.lastResponse;
      const planResponse = planFetch.lastResponse;
      const environmentResponse = environmentFetch.lastResponse;

      const suites = suiteFetch.suites;
      const plans = planFetch.plans;
      const environments = environmentFetch.environments;
      const environmentNames = uniqueStrings(environments.map((environment) => environment.title));
      const topLevelSuites = uniqueStrings(
        suites
          .filter((suite) => suite.position === 1 || suite.position === 2)
          .map((suite) => suite.name)
      );

      const requiredRules = getRequiredSuiteRules();
      const missingRules = requiredRules.filter((rule) => !hasTopLevelMatch(topLevelSuites, rule));
      const missing = missingRules.map((rule) => rule.label);
      const required = requiredRules.map((rule) => rule.label);
      const requirementResults = requiredRules.map((rule) => ({
        label: rule.label,
        passed: hasTopLevelMatch(topLevelSuites, rule),
        matchedTitle: getTopLevelMatchName(topLevelSuites, rule)
      }));
      const passed = requiredRules.every((rule) => hasTopLevelMatch(topLevelSuites, rule));
      const zeroCasePlans = plans.filter((plan) => plan.casesCount === 0);
      const planRequirementResults = [
        {
          label: "At least 1 test plan",
          passed: plans.length > 0,
          details: plans.length > 0 ? `${plans.length} test plan(s) found.` : "No test plans returned by plan endpoint."
        },
        {
          label: "No test plans with 0 cases_count",
          passed: zeroCasePlans.length === 0,
          details:
            zeroCasePlans.length === 0
              ? "All test plans have at least 1 case."
              : `Plans with 0 cases_count: ${zeroCasePlans.map((plan) => plan.title).join(", ")}`
        }
      ];
      const planPassed = planRequirementResults.every((result) => result.passed);

      const environmentRequirementResults = getRequiredEnvironmentResults(environmentNames);
      const missingEnvironments = environmentRequirementResults
        .filter((result) => !result.passed)
        .map((result) => result.label);
      const environmentPassed = environmentRequirementResults.every((result) => result.passed);

      return {
        endpoints: [...suiteFetch.responses, ...planFetch.responses, ...environmentFetch.responses],
        overallPassed: passed && planPassed && environmentPassed,
        suiteCheck: {
          endpoint: suiteResponse ? suiteResponse.url : `${runtimeConfig.qaseApiBase}/suite/${encodeURIComponent(projectCode)}`,
          topLevelSuites,
          required,
          requiredRules,
          requirementResults,
          missing,
          passed
        },
        planCheck: {
          endpoint: planResponse ? planResponse.url : `${runtimeConfig.qaseApiBase}/plan/${encodeURIComponent(projectCode)}`,
          plans,
          zeroCasePlans,
          requirementResults: planRequirementResults,
          passed: planPassed
        },
        environmentCheck: {
          endpoint: environmentResponse ? environmentResponse.url : `${runtimeConfig.qaseApiBase}/environment/${encodeURIComponent(projectCode)}`,
          required: REQUIRED_ENVIRONMENT_NAMES,
          environmentNames,
          environments,
          missing: missingEnvironments,
          requirementResults: environmentRequirementResults,
          passed: environmentPassed
        }
      };
    }

    function getRequiredEnvironmentResults(environmentNames) {
      const remaining = [...environmentNames];

      return REQUIRED_ENVIRONMENT_NAMES.map((requiredName) => {
        const bestMatchIndex = getBestCloseEnvironmentIndex(requiredName, remaining);

        if (bestMatchIndex < 0) {
          return {
            label: requiredName,
            passed: false,
            matchedTitle: "",
            usedCloseMatch: false,
            details: "Not found"
          };
        }

        const matchedTitle = remaining[bestMatchIndex];
        remaining.splice(bestMatchIndex, 1);

        const usedCloseMatch = normalizeName(matchedTitle) !== normalizeName(requiredName);
        const details = usedCloseMatch
          ? `Close match used: ${matchedTitle}`
          : `Matched standard environment: ${requiredName}`;

        return {
          label: requiredName,
          passed: true,
          matchedTitle,
          usedCloseMatch,
          details
        };
      });
    }

    function getBestCloseEnvironmentIndex(requiredName, candidates) {
      let bestIndex = -1;
      let bestSimilarity = -1;

      for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const similarity = getEnvironmentNameSimilarity(requiredName, candidate);
        if (!isCloseEnvironmentName(requiredName, candidate, similarity)) {
          continue;
        }

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestIndex = i;
        }
      }

      return bestIndex;
    }

    function isCloseEnvironmentName(requiredName, candidateName, similarity) {
      const requiredCompact = normalizeCompactName(requiredName);
      const candidateCompact = normalizeCompactName(candidateName);

      if (!requiredCompact || !candidateCompact) {
        return false;
      }

      if (isSpecialEnvironmentMatch(requiredCompact, candidateCompact)) {
        return true;
      }

      if (requiredCompact === candidateCompact) {
        return true;
      }

      const distance = levenshteinDistance(requiredCompact, candidateCompact);
      const minLength = Math.min(requiredCompact.length, candidateCompact.length);
      const maxLength = Math.max(requiredCompact.length, candidateCompact.length);

      if (minLength <= 3) {
        return distance <= 1;
      }

      const allowedDistance = maxLength <= 6 ? 2 : 3;
      return distance <= allowedDistance && similarity >= 0.7;
    }

    function isSpecialEnvironmentMatch(requiredCompact, candidateCompact) {
      if (requiredCompact === "corp") {
        return candidateCompact === "dc1corp" || candidateCompact === "corp2000";
      }

      if (requiredCompact === "demo") {
        return candidateCompact.includes("dc1");
      }

      return false;
    }

    function getEnvironmentNameSimilarity(requiredName, candidateName) {
      const requiredCompact = normalizeCompactName(requiredName);
      const candidateCompact = normalizeCompactName(candidateName);

      if (!requiredCompact || !candidateCompact) {
        return 0;
      }

      if (requiredCompact === candidateCompact) {
        return 1;
      }

      const distance = levenshteinDistance(requiredCompact, candidateCompact);
      const maxLength = Math.max(requiredCompact.length, candidateCompact.length);
      return maxLength > 0 ? 1 - distance / maxLength : 0;
    }

    async function fetchAllSuites(projectCode, token) {
      const limit = 100;
      let offset = 0;
      const maxPages = 20;
      const responses = [];
      const suites = [];
      let lastResponse = null;

      for (let page = 0; page < maxPages; page += 1) {
        const url = `${runtimeConfig.qaseApiBase}/suite/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`;
        const response = await requestQase(url, token);
        responses.push(response);
        lastResponse = response;

        if (!response.ok) {
          break;
        }

        const pageSuites = extractQaseSuiteEntities(response.payload);
        suites.push(...pageSuites);

        const filtered = Number(response.payload?.result?.filtered || 0);
        if (pageSuites.length < limit) {
          break;
        }
        if (filtered > 0 && suites.length >= filtered) {
          break;
        }

        offset += limit;
      }

      return {
        responses,
        suites,
        lastResponse
      };
    }

    async function fetchAllPlans(projectCode, token) {
      const limit = 100;
      let offset = 0;
      const maxPages = 20;
      const responses = [];
      const plans = [];
      let lastResponse = null;

      for (let page = 0; page < maxPages; page += 1) {
        const url = `${runtimeConfig.qaseApiBase}/plan/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`;
        const response = await requestQase(url, token);
        responses.push(response);
        lastResponse = response;

        if (!response.ok) {
          break;
        }

        const pagePlans = extractQasePlanEntities(response.payload);
        plans.push(...pagePlans);

        const filtered = Number(response.payload?.result?.filtered || 0);
        if (pagePlans.length < limit) {
          break;
        }
        if (filtered > 0 && plans.length >= filtered) {
          break;
        }

        offset += limit;
      }

      return {
        responses,
        plans,
        lastResponse
      };
    }

    async function fetchAllEnvironments(projectCode, token) {
      const url = `${runtimeConfig.qaseApiBase}/environment/${encodeURIComponent(projectCode)}`;
      const response = await requestQase(url, token);
      const environments = response.ok ? extractQaseEnvironmentEntities(response.payload) : [];

      return {
        responses: [response],
        environments,
        lastResponse: response
      };
    }

    function getRequiredSuiteRules() {
      return REQUIRED_TOP_LEVEL_SUITE_RULES.map((entry) => {
        if (typeof entry === "string") {
          return {
            label: entry,
            anyOf: [entry]
          };
        }

        const label = String(entry?.label || "").trim();
        const options = Array.isArray(entry?.anyOf) ? entry.anyOf : [];
        const anyOf = uniqueStrings(options.length > 0 ? options : [label]);

        return {
          label: label || (anyOf[0] || "Required Suite"),
          anyOf
        };
      });
    }

    function hasTopLevelMatch(topLevelSuites, rule) {
      const normalizedTopLevel = new Set(topLevelSuites.map(normalizeName));
      return rule.anyOf.some((name) => normalizedTopLevel.has(normalizeName(name)));
    }

    function getTopLevelMatchName(topLevelSuites, rule) {
      const normalizedToActual = new Map(topLevelSuites.map((name) => [normalizeName(name), name]));
      for (const acceptedName of rule.anyOf) {
        const matched = normalizedToActual.get(normalizeName(acceptedName));
        if (matched) {
          return matched;
        }
      }
      return "";
    }

    function requestQase(url, token) {
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== "function") {
          reject(new Error("GM_xmlhttpRequest is unavailable. Verify Tampermonkey grants are enabled."));
          return;
        }

        GM_xmlhttpRequest({
          method: "GET",
          url,
          headers: buildQaseHeaders(token),
          onload: (response) => {
            let payload = null;

            try {
              payload = JSON.parse(response.responseText || "{}");
            } catch (error) {
              // Keep payload null to report parse errors.
            }

            if (response.status < 200 || response.status >= 300) {
              const payloadMessage =
                (payload && (payload.errorMessage || payload.message || payload.error)) || "";
              resolve({
                url,
                status: response.status,
                ok: false,
                payload,
                error: payloadMessage ? `HTTP ${response.status}: ${payloadMessage}` : `HTTP ${response.status}`
              });
              return;
            }

            resolve({
              url,
              status: response.status,
              ok: true,
              payload,
              error: ""
            });
          },
          onerror: () => {
            resolve({
              url,
              status: 0,
              ok: false,
              payload: null,
              error: "Network error"
            });
          }
        });
      });
    }

    function buildQaseHeaders(token) {
      return {
        accept: "application/json",
        Token: token
      };
    }

    function extractQaseSuiteEntities(payload) {
      const rawEntities =
        payload?.result?.entities ||
        payload?.result?.suites ||
        payload?.result ||
        payload?.data?.entities ||
        payload?.data?.suites ||
        payload?.data ||
        [];
      const list = Array.isArray(rawEntities) ? rawEntities : [];

      return list
        .map((item) => {
          const name = item.title || item.name || "";
          const parent = item.parent_id ?? item.parentId ?? item.parent ?? item.parent_suite_id ?? item.parentSuiteId;
          const level = item.depth ?? item.level;
          const isRoot = item.is_root ?? item.isRoot;
          const position = item.position ?? null;
          return {
            name: String(name).trim(),
            parent,
            level,
            isRoot,
            position
          };
        })
        .filter((entry) => !!entry.name);
    }

    function extractQasePlanEntities(payload) {
      const rawEntities =
        payload?.result?.entities ||
        payload?.result?.plans ||
        payload?.result ||
        payload?.data?.entities ||
        payload?.data?.plans ||
        payload?.data ||
        [];
      const list = Array.isArray(rawEntities) ? rawEntities : [];

      return list
        .map((item) => {
          const title = String(item?.title || item?.name || "").trim();
          const casesCount = Number(item?.cases_count ?? item?.casesCount ?? 0);

          return {
            title,
            casesCount: Number.isFinite(casesCount) ? casesCount : 0
          };
        })
        .filter((entry) => !!entry.title);
    }

    function extractQaseEnvironmentEntities(payload) {
      const rawEntities =
        payload?.result?.entities ||
        payload?.result?.environments ||
        payload?.result ||
        payload?.data?.entities ||
        payload?.data?.environments ||
        payload?.data ||
        [];
      const list = Array.isArray(rawEntities) ? rawEntities : [];

      return list
        .map((item) => {
          const title = String(item?.title || item?.name || "").trim();
          const slug = String(item?.slug || "").trim();
          const type = String(item?.type || "").trim();
          const host = item?.host == null ? "" : String(item.host).trim();

          return {
            title,
            slug,
            type,
            host
          };
        })
        .filter((entry) => !!entry.title);
    }

    function isTopLevelSuite(suite) {
      if (!suite || typeof suite !== "object") {
        return false;
      }

      if (suite.isRoot === true) {
        return true;
      }

      if (suite.level === 0 || suite.level === "0") {
        return true;
      }

      return suite.parent === null || suite.parent === undefined || suite.parent === 0 || suite.parent === "0";
    }

    function uniqueStrings(values) {
      const seen = new Set();
      const unique = [];

      for (const value of values) {
        const text = String(value || "").trim();
        if (!text) {
          continue;
        }

        const key = normalizeName(text);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(text);
        }
      }

      return unique;
    }

    function normalizeName(value) {
      return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function normalizeCompactName(value) {
      return normalizeName(value).replace(/[^a-z0-9]/g, "");
    }

    function levenshteinDistance(left, right) {
      const a = String(left || "");
      const b = String(right || "");

      if (!a) {
        return b.length;
      }
      if (!b) {
        return a.length;
      }

      const rows = a.length + 1;
      const cols = b.length + 1;
      const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

      for (let i = 0; i < rows; i += 1) {
        matrix[i][0] = i;
      }
      for (let j = 0; j < cols; j += 1) {
        matrix[0][j] = j;
      }

      for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }

      return matrix[a.length][b.length];
    }

    function setStatus(message, isError) {
      const statusEl = document.querySelector("#qrc-status");
      if (!statusEl) {
        return;
      }

      statusEl.textContent = message;
      statusEl.style.color = isError ? "#b21f1f" : "#294560";
    }

    function setEvaluateButtonBusy(isBusy) {
      const button = document.querySelector("#qrc-evaluate");
      if (!button) {
        return;
      }

      button.disabled = !!isBusy;
      button.textContent = isBusy ? "Checking..." : "Check Score";
    }

    function renderEvaluation(evaluation, projectCode) {
      const results = document.querySelector("#qrc-results");
      if (!results) {
        return;
      }

      const errorRows = (evaluation.endpoints || [])
        .filter((endpoint) => !endpoint.ok)
        .map((endpoint) => {
          return `
            <tr>
              <td>${endpoint.status || "n/a"}</td>
              <td>${escapeHtml(endpoint.error || "Request failed")}</td>
            </tr>
          `;
        })
        .join("");

      const suiteRows = evaluation.suiteCheck.topLevelSuites
        .map((suiteName) => {
          const isRequired = evaluation.suiteCheck.required.some(
            (requiredName) => normalizeName(requiredName) === normalizeName(suiteName)
          );
          return `
            <tr>
              <td>${escapeHtml(suiteName)}</td>
              <td>${isRequired ? "Required" : "Optional"}</td>
            </tr>
          `;
        })
        .join("");

      const missingText = evaluation.suiteCheck.missing.length > 0 ? evaluation.suiteCheck.missing.join(", ") : "None";
      const missingEnvironmentText = evaluation.environmentCheck.missing.length > 0
        ? evaluation.environmentCheck.missing.join(", ")
        : "None";
      const requirementRows = (evaluation.suiteCheck.requirementResults || [])
        .map((result) => {
          const normalizedLabel = normalizeName(result.label);
          const normalizedMatched = normalizeName(result.matchedTitle || "");
          const usedSubstitution = !!result.passed && !!result.matchedTitle && normalizedMatched !== normalizedLabel;
          const detailText = !result.passed
            ? "Not found"
            : usedSubstitution
              ? `Accepted substitution used: ${result.matchedTitle}`
              : `Matched required title: ${result.label}`;

          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td class="${result.passed ? "qrc-pass" : "qrc-fail"}">${result.passed ? "PASS" : "FAIL"}</td>
              <td>${escapeHtml(detailText)}</td>
            </tr>
          `;
        })
        .join("");

      const planRequirementRows = (evaluation.planCheck.requirementResults || [])
        .map((result) => {
          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td class="${result.passed ? "qrc-pass" : "qrc-fail"}">${result.passed ? "PASS" : "FAIL"}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      const planRows = (evaluation.planCheck.plans || [])
        .map((plan) => {
          return `
            <tr>
              <td>${escapeHtml(plan.title)}</td>
              <td>${escapeHtml(String(plan.casesCount))}</td>
              <td class="${plan.casesCount === 0 ? "qrc-fail" : "qrc-pass"}">${plan.casesCount === 0 ? "FAIL" : "PASS"}</td>
            </tr>
          `;
        })
        .join("");

      const environmentRequirementRows = (evaluation.environmentCheck.requirementResults || [])
        .map((result) => {
          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td class="${result.passed ? "qrc-pass" : "qrc-fail"}">${result.passed ? "PASS" : "FAIL"}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      const environmentRows = (evaluation.environmentCheck.environments || [])
        .map((environment) => {
          return `
            <tr>
              <td>${escapeHtml(environment.title)}</td>
              <td>${escapeHtml(environment.slug || "-")}</td>
              <td>${escapeHtml(environment.type || "-")}</td>
              <td>${escapeHtml(environment.host || "-")}</td>
            </tr>
          `;
        })
        .join("");

      results.innerHTML = `
        <div class="qrc-score">
          Project: ${escapeHtml(projectCode)} | Overall: <span class="${evaluation.overallPassed ? "qrc-pass" : "qrc-fail"}">${evaluation.overallPassed ? "PASS" : "FAIL"}</span>
          <div>Required Suite Check: <span class="${evaluation.suiteCheck.passed ? "qrc-pass" : "qrc-fail"}">${evaluation.suiteCheck.passed ? "PASS" : "FAIL"}</span></div>
          <div>Test Plan Check: <span class="${evaluation.planCheck.passed ? "qrc-pass" : "qrc-fail"}">${evaluation.planCheck.passed ? "PASS" : "FAIL"}</span></div>
          <div>Environment Check: <span class="${evaluation.environmentCheck.passed ? "qrc-pass" : "qrc-fail"}">${evaluation.environmentCheck.passed ? "PASS" : "FAIL"}</span></div>
          <div>Required Suites (position 1–2): ${escapeHtml(evaluation.suiteCheck.required.join(", "))}</div>
          <div>Missing Suites: ${escapeHtml(missingText)}</div>
          <div>Required Environments: ${escapeHtml(evaluation.environmentCheck.required.join(", "))}</div>
          <div>Missing Environments: ${escapeHtml(missingEnvironmentText)}</div>
        </div>

        <details class="qrc-details">
          <summary class="qrc-summary">Suite Rules</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Required Suite Rule</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${requirementRows}
            </tbody>
          </table>
        </details>

        <details class="qrc-details">
          <summary class="qrc-summary">Test Plan Rules</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Test Plan Rule</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${planRequirementRows}
            </tbody>
          </table>
        </details>

        <details class="qrc-details">
          <summary class="qrc-summary">Test Plans</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Test Plan</th>
                <th>cases_count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${planRows || '<tr><td colspan="3">No test plans returned by plan endpoint.</td></tr>'}
            </tbody>
          </table>
        </details>

        <details class="qrc-details">
          <summary class="qrc-summary">Environment Rules</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Environment Rule</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${environmentRequirementRows}
            </tbody>
          </table>
        </details>

        <details class="qrc-details">
          <summary class="qrc-summary">Environments</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Environment</th>
                <th>Slug</th>
                <th>Type</th>
                <th>Host</th>
              </tr>
            </thead>
            <tbody>
              ${environmentRows || '<tr><td colspan="4">No environments returned by environment endpoint.</td></tr>'}
            </tbody>
          </table>
        </details>

        <details class="qrc-details">
          <summary class="qrc-summary">Suites (position 1–2)</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Suite</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              ${suiteRows || '<tr><td colspan="2">No suites at position 1 or 2 found.</td></tr>'}
            </tbody>
          </table>
        </details>

        ${errorRows ? `
        <details class="qrc-details" open>
          <summary class="qrc-summary">API Errors</summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>API Status</th>
                <th>API Error</th>
              </tr>
            </thead>
            <tbody>
              ${errorRows}
            </tbody>
          </table>
        </details>
        ` : ""}
      `;
    }

    function detectQaseProjectCode() {
      const match = window.location.pathname.match(/\/project\/([A-Za-z0-9_-]+)/i);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
      return "";
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    return {
      init
    };
  })();

  QaseRepoCheckerCore.init(CONFIG);
})();
