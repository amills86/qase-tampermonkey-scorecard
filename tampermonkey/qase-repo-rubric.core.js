(function (global) {
  "use strict";

  if (global.QaseRepoCheckerCore && typeof global.QaseRepoCheckerCore.init === "function") {
    return;
  }

  global.QaseRepoCheckerCore = (function () {
    const DEFAULTS = {
      standardsName: "Paylocity standards",
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

    let CONFIG = { ...DEFAULTS };

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

      CONFIG = { ...DEFAULTS, ...(userConfig || {}) };
      state.initialized = true;

      injectStyles();
      mountButton();
      observeDomForRemount();
    }

    function injectStyles() {
      const css = `
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
          background: #fff;
          color: #15202b;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
        .qrc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #dce4ec;
        }
        .qrc-title {
          margin: 0;
          font-size: 18px;
        }
        .qrc-close {
          border: 0;
          background: transparent;
          font-size: 18px;
          cursor: pointer;
        }
        .qrc-body {
          padding: 16px;
        }
        .qrc-banner {
          border: 1px solid #d7e3ee;
          border-radius: 10px;
          background: #f6fbff;
          padding: 12px;
          font-size: 13px;
          color: #1e3d5a;
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
          border: 1px solid #b7c7d7;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
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
          background: #e9f0f7;
          color: #1d3348;
        }
        .qrc-status {
          margin-top: 12px;
          font-size: 13px;
        }
        .qrc-score {
          margin-top: 16px;
          padding: 12px;
          border-radius: 10px;
          background: #f2f8ff;
          border: 1px solid #cfe4ff;
          font-weight: 700;
        }
        .qrc-table {
          width: 100%;
          margin-top: 12px;
          border-collapse: collapse;
          font-size: 12px;
        }
        .qrc-table th,
        .qrc-table td {
          border: 1px solid #d6e0ea;
          padding: 8px;
          text-align: left;
          vertical-align: top;
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
              Evaluate your test repository organization against ${escapeHtml(CONFIG.standardsName)}.
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
        const token = String(CONFIG.qaseApiToken || "").trim();

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

        setStatus(`Evaluation complete (${evaluation.suiteCheck.passed ? "PASS" : "FAIL"} for required suites).`);
      } catch (error) {
        setStatus(`Error: ${error.message}`, true);
      } finally {
        state.evaluating = false;
        setEvaluateButtonBusy(false);
      }
    }

    async function evaluateProjectWithQaseApis(projectCode, token) {
      const suiteFetch = await fetchAllSuites(projectCode, token);
      const suiteResponse = suiteFetch.lastResponse;

      const suites = suiteFetch.suites;
      const topLevelSuites = uniqueStrings(
        suites
          .filter((suite) => isTopLevelSuite(suite))
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

      return {
        endpoints: suiteFetch.responses,
        suiteCheck: {
          endpoint: suiteResponse ? suiteResponse.url : `${CONFIG.qaseApiBase}/suite/${encodeURIComponent(projectCode)}`,
          topLevelSuites,
          required,
          requiredRules,
          requirementResults,
          missing,
          passed
        }
      };
    }

    async function fetchAllSuites(projectCode, token) {
      const limit = 100;
      let offset = 0;
      const maxPages = 20;
      const responses = [];
      const suites = [];
      let lastResponse = null;

      for (let page = 0; page < maxPages; page += 1) {
        const url = `${CONFIG.qaseApiBase}/suite/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`;
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
          return {
            name: String(name).trim(),
            parent,
            level,
            isRoot
          };
        })
        .filter((entry) => !!entry.name);
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

      results.innerHTML = `
        <div class="qrc-score">
          Project: ${escapeHtml(projectCode)} | Required Suite Check: <span class="${evaluation.suiteCheck.passed ? "qrc-pass" : "qrc-fail"}">${evaluation.suiteCheck.passed ? "PASS" : "FAIL"}</span>
          <div>Required: ${escapeHtml(evaluation.suiteCheck.required.join(", "))}</div>
          <div>Missing: ${escapeHtml(missingText)}</div>
        </div>

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

        <table class="qrc-table">
          <thead>
            <tr>
              <th>Top-Level Suite</th>
              <th>Classification</th>
            </tr>
          </thead>
          <tbody>
            ${suiteRows || '<tr><td colspan="2">No top-level suites returned by suite endpoint.</td></tr>'}
          </tbody>
        </table>

        ${errorRows ? `
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
})(window);
