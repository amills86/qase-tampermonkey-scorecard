(function (global) {
  "use strict";

  if (global.QaseRepoCheckerCore && typeof global.QaseRepoCheckerCore.init === "function") {
    return;
  }

  global.QaseRepoCheckerCore = (function () {
    const DEFAULTS = {
      standardsName: "Standards",
      qaseApiBase: "https://api.qase.io/v1",
      qaseApiToken: ""
    };

    const REQUIRED_TOP_LEVEL_SUITE_RULES = Object.freeze([
      Object.freeze({
        label: "Current State",
        anyOf: Object.freeze(["Current State", "Current Production State", "Current", "Current Tests", "Production"])
      }),
      Object.freeze({
        label: "Future State",
        anyOf: Object.freeze(["Future State", "Upcoming Initiatives", "Future", "Future Tests", "Upcoming Features"])
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

    // Suite names that should NOT be used anywhere in the repository (any level).
    // Add more names here as the standard evolves.
    const DISCOURAGED_SUITE_NAMES = Object.freeze([
      "Smoke",
      "Regression",
      "Manual",
      "Automated",
      "chromium",
      "Cypress",
      "Playwright"
    ]);

    // Substrings that should never appear in a suite title (case-insensitive),
    // e.g. file extensions that indicate a suite was named after a code file.
    const FORBIDDEN_SUITE_TITLE_SUBSTRINGS = Object.freeze([
      "spec.ts",
      "spec.js",
      "cy.js",
      "cy.ts",
      ".cs",
      "pw.ts",
      "pw.js"
    ]);

    // Test case titles should describe behavior, not reference a Jira ticket.
    // Matches any Jira-style key: an uppercase project prefix + dash + number
    // (e.g. PDR-1234, CM-567, ABC-89). Global flag so we can list every match.
    const JIRA_TICKET_TITLE_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g;

    // A healthy project should have executed test runs recently. Runs started
    // within this many days satisfy the recency check.
    const RUN_RECENCY_DAYS = 14;

    // Usage-event endpoint, stored encoded to keep the literal URL out of the
    // source. Leave blank to disable usage events.
    const USAGE_ENDPOINT_B64 =
      "aHR0cHM6Ly9ob29rcy5zbGFjay5jb20vdHJpZ2dlcnMvVDAzNlZVOUQxLzExNDcwMDI0NjI2MTc5LzM0NGQxNGRjODdhZjQ2MzY1MjEyNzdmNDkwNWJkM2U4";

    function getUsageEndpoint() {
      const configured = String(runtimeConfig.usageEndpoint || "").trim();
      if (configured) {
        return configured;
      }
      if (!USAGE_ENDPOINT_B64) {
        return "";
      }
      try {
        return atob(USAGE_ENDPOINT_B64).trim();
      } catch (err) {
        return "";
      }
    }

    let runtimeConfig = { ...DEFAULTS };
    let injectedCss = "";

    const state = {
      initialized: false,
      buttonMounted: false,
      modalMounted: false,
      evaluating: false,
      renderedProjectCode: null
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
          --qrc-accent: #005ea6;
          --qrc-secondary-bg: #e9f0f7;
          --qrc-secondary-text: #1d3348;
          --qrc-input-bg: #fff;
          --qrc-input-border: #b7c7d7;
          --qrc-th-bg: #eef3f8;
          --qrc-details-bg: #f0f4f8;
          --qrc-details-hover: #e4eaf2;
          --qrc-status-text: #294560;
          --qrc-pass-text: #0f7a41;
          --qrc-fail-text: #b21f1f;
          --qrc-close-bg: #eef3f8;
          --qrc-close-text: #5a6b7b;
          --qrc-close-hover-bg: #d92d3a;
          --qrc-close-hover-text: #fff;
          --qrc-pass-solid: #0c7a3d;
          --qrc-fail-solid: #c62828;
          --qrc-pass-soft-bg: #e3f5ea;
          --qrc-pass-soft-text: #0c7a3d;
          --qrc-pass-soft-border: #b7e0c6;
          --qrc-fail-soft-bg: #fbe4e4;
          --qrc-fail-soft-text: #b21f1f;
          --qrc-fail-soft-border: #f0c2c2;
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
            --qrc-banner-text: #a9c8e2;
            --qrc-accent: #4a90d9;
            --qrc-secondary-bg: #1a2d42;
            --qrc-secondary-text: #90b8d8;
            --qrc-input-bg: #162030;
            --qrc-input-border: #2a3f58;
            --qrc-th-bg: #162030;
            --qrc-details-bg: #182538;
            --qrc-details-hover: #1e2e44;
            --qrc-status-text: #90b8d8;
            --qrc-pass-text: #4ec27e;
            --qrc-fail-text: #ff7a7a;
            --qrc-close-bg: #243348;
            --qrc-close-text: #9fb4c9;
            --qrc-close-hover-bg: #e2515e;
            --qrc-close-hover-text: #fff;
            --qrc-pass-solid: #1c9e5a;
            --qrc-fail-solid: #d64545;
            --qrc-pass-soft-bg: #173a2a;
            --qrc-pass-soft-text: #5fd28e;
            --qrc-pass-soft-border: #1f5a3c;
            --qrc-fail-soft-bg: #3a1f24;
            --qrc-fail-soft-text: #ff8a8a;
            --qrc-fail-soft-border: #5e2a30;
          }
        }
        .qrc-button {
          position: fixed;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          border: 0;
          border-radius: 999px;
          padding: 6px 14px;
          background: #e8730c;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: var(--qrc-close-bg);
          color: var(--qrc-close-text);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .qrc-close:hover,
        .qrc-close:focus-visible {
          background: var(--qrc-close-hover-bg);
          color: var(--qrc-close-hover-text);
        }
        .qrc-close:focus-visible {
          outline: 2px solid #4a90d9;
          outline-offset: 2px;
        }
        .qrc-body {
          padding: 16px;
        }
        .qrc-intro-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.5;
          color: var(--qrc-text);
        }
        .qrc-intro-list {
          margin: 10px 0 0;
          padding-left: 4px;
          list-style: none;
          font-size: 14px;
          line-height: 1.5;
          color: var(--qrc-text);
        }
        .qrc-intro-list li {
          margin-top: 6px;
          padding-left: 4px;
        }
        .qrc-intro-text + .qrc-intro-text {
          margin-top: 12px;
        }
        .qrc-intro-link {
          color: var(--qrc-accent);
          font-weight: 600;
          text-decoration: underline;
        }
        .qrc-intro-link:hover,
        .qrc-intro-link:focus-visible {
          text-decoration: none;
        }
        .qrc-project-line {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 12px 14px;
          border-left: 4px solid var(--qrc-accent);
          border-radius: 0 8px 8px 0;
          background: var(--qrc-banner-bg);
          font-size: 13px;
          color: var(--qrc-banner-text);
        }
        .qrc-project-label {
          font-weight: 600;
        }
        .qrc-project-code {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: var(--qrc-text);
        }
        .qrc-project-code.unknown {
          font-size: 13px;
          font-weight: 600;
          color: var(--qrc-fail-soft-text);
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
          background: #e8730c;
          color: #fff;
        }
        .qrc-secondary {
          background: var(--qrc-secondary-bg);
          color: var(--qrc-secondary-text);
        }
        .qrc-status {
          margin-top: 12px;
          font-size: 13px;
          color: var(--qrc-status-text);
        }
        .qrc-status.qrc-status-error {
          color: var(--qrc-fail-text);
        }
        .qrc-results-title {
          margin: 18px 0 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--qrc-text);
        }
        .qrc-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .qrc-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .qrc-pill.pass {
          background: var(--qrc-pass-soft-bg);
          color: var(--qrc-pass-soft-text);
          border-color: var(--qrc-pass-soft-border);
        }
        .qrc-pill.fail {
          background: var(--qrc-fail-soft-bg);
          color: var(--qrc-fail-soft-text);
          border-color: var(--qrc-fail-soft-border);
        }
        .qrc-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .qrc-chip.pass {
          background: var(--qrc-pass-soft-bg);
          color: var(--qrc-pass-soft-text);
        }
        .qrc-chip.fail {
          background: var(--qrc-fail-soft-bg);
          color: var(--qrc-fail-soft-text);
        }
        .qrc-details {
          margin-top: 12px;
          border: 1px solid var(--qrc-table-border);
          border-radius: 8px;
          overflow: hidden;
        }
        .qrc-details:first-of-type {
          margin-top: 18px;
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
        .qrc-section-status {
          margin-left: auto;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .qrc-section-status.pass {
          background: var(--qrc-pass-soft-bg);
          color: var(--qrc-pass-soft-text);
          border-color: var(--qrc-pass-soft-border);
        }
        .qrc-section-status.fail {
          background: var(--qrc-fail-soft-bg);
          color: var(--qrc-fail-soft-text);
          border-color: var(--qrc-fail-soft-border);
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
        .qrc-case-list-wrap {
          padding: 10px 12px;
          border-top: 1px solid var(--qrc-table-border);
        }
        .qrc-case-list-title {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--qrc-text);
        }
        .qrc-case-list {
          margin: 0;
          padding-left: 20px;
          max-height: 240px;
          overflow: auto;
          font-size: 12px;
          color: var(--qrc-text);
        }
        .qrc-case-list li {
          margin: 2px 0;
        }
        .qrc-case-id {
          color: var(--qrc-status-text);
        }
        .qrc-link {
          color: var(--qrc-accent);
          text-decoration: none;
        }
        .qrc-link:hover,
        .qrc-link:focus-visible {
          text-decoration: underline;
        }
      `;

      // Keep a copy so the "Open in New Tab" view can reuse the same styles.
      injectedCss = css;

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
      button.textContent = "Check Your Qase Score";
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
        <div class="qrc-modal" role="dialog" aria-modal="true" aria-label="Qase Scorecard Tool">
          <div class="qrc-head">
            <h2 class="qrc-title">Qase Scorecard Tool</h2>
            <button class="qrc-close" type="button" aria-label="Close" title="Close">&#10005;</button>
          </div>
          <div class="qrc-body">
            <p class="qrc-intro-text">
              📊 This tool scores your Qase project against our test repository standards and
              flags anything that needs attention. It checks that your project has:
            </p>
            <ul class="qrc-intro-list">
              <li>🗂️ The required top-level suites that indicate current vs. upcoming tests</li>
              <li>🚫 No discouraged suite names (e.g. "Smoke", "Regression", "Manual", "Automated")</li>
              <li>📋 At least one test plan and none that are empty</li>
              <li>🌐 The required environments configured</li>
              <li>🔗 All test cases assigned to a suite with no Jira/PDR ticket numbers in their titles</li>
              <li>📄 No forbidden substrings in any suite title (e.g. ".spec.ts", ".cy.js", ".cs")</li>
              <li>🏃 Recent test runs</li>
            </ul>
            <p class="qrc-intro-text">
              📖 To view our Qase standards please
              <a class="qrc-intro-link" href="https://docs.nucleus.paylocity.com/docs/standards/testing/Qase" target="_blank" rel="noopener noreferrer">visit the documentation here</a>.
            </p>


            <div class="qrc-project-line">
              <span class="qrc-project-label">Project code being evaluated:</span>
              <span class="qrc-project-code" id="qrc-project">—</span>
            </div>

            <div class="qrc-actions">
              <button class="qrc-primary" id="qrc-evaluate" type="button">Check Score</button>
              <button class="qrc-secondary" id="qrc-clear" type="button">Clear Results</button>
              <button class="qrc-secondary" id="qrc-open-tab" type="button" style="display: none;">Open in New Tab</button>
            </div>

            <div class="qrc-status" id="qrc-status" style="display: none;"></div>
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
      overlay.querySelector("#qrc-open-tab").addEventListener("click", openResultsInNewTab);
    }

    function openResultsInNewTab() {
      const results = document.querySelector("#qrc-results");
      const resultsHtml = results ? results.innerHTML.trim() : "";

      if (!resultsHtml) {
        setStatus("Run a check first, then open the results in a new tab.", true);
        return;
      }

      const headingEl = results.querySelector(".qrc-results-title");
      const pageTitle = headingEl ? headingEl.textContent.trim() : "Qase Repo Checker Results";

      const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(pageTitle)}</title>
<style>${injectedCss}</style>
</head>
<body class="qrc-overlay" style="position: static; display: block; background: var(--qrc-bg); padding: 24px;">
  <div class="qrc-modal" style="max-height: none; width: min(840px, 100%); margin: 0 auto;">
    <div class="qrc-body">${resultsHtml}</div>
  </div>
</body>
</html>`;

      const blob = new Blob([doc], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, "_blank");

      if (!newTab) {
        setStatus("Popup blocked — allow popups for app.qase.io to open results in a new tab.", true);
      }

      // Give the new tab time to load before releasing the object URL.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    function hydrateFormDefaults() {
      const projectEl = document.querySelector("#qrc-project");
      const code = detectQaseProjectCode();
      projectEl.textContent = code || "Not detected — open a project page";
      projectEl.classList.toggle("unknown", !code);

      // Drop stale results when the modal is opened on a different project.
      if (code !== state.renderedProjectCode) {
        clearResults();
      }
    }

    function clearResults() {
      const results = document.querySelector("#qrc-results");
      if (results) {
        results.innerHTML = "";
      }
      state.renderedProjectCode = null;
      setOpenTabVisible(false);
      setStatus("");
    }

    function setOpenTabVisible(visible) {
      const button = document.querySelector("#qrc-open-tab");
      if (button) {
        button.style.display = visible ? "" : "none";
      }
    }

    async function onEvaluate() {
      if (state.evaluating) {
        return;
      }

      state.evaluating = true;
      setEvaluateButtonBusy(true);

      const projectCode = (detectQaseProjectCode() || "").toUpperCase();
      // Best-effort: who is running the check. Never throws.
      const user = await fetchCurrentUserName();

      try {
        const token = String(runtimeConfig.qaseApiToken || "").trim();

        if (!projectCode) {
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
        state.renderedProjectCode = projectCode;
        setOpenTabVisible(true);
        setStatus("");

        postUsageEvent({
          projectCode,
          user,
          result: evaluation.overallPassed ? "pass" : "fail",
          summary: buildResultSummary(evaluation)
        });
      } catch (error) {
        setStatus(`Error: ${error.message}`, true);
        postUsageEvent({
          projectCode,
          user,
          result: "error",
          error: error.message
        });
      } finally {
        state.evaluating = false;
        setEvaluateButtonBusy(false);
      }
    }

    // Build a human-readable, multi-line breakdown of the evaluation:
    // one line per section with a pass/fail icon, followed by the specific
    // failing rules (and their detail text) indented beneath each section.
    function buildResultSummary(evaluation) {
      const sections = [
        { name: "Suites", check: evaluation.suiteCheck },
        { name: "Test Plans", check: evaluation.planCheck },
        { name: "Environments", check: evaluation.environmentCheck },
        { name: "Test Cases", check: evaluation.caseCheck },
        { name: "Test Runs", check: evaluation.runCheck }
      ];

      const lines = [];
      for (const { name, check } of sections) {
        if (!check) {
          continue;
        }
        lines.push(`${check.passed ? "✅" : "❌"} ${name}`);
        const failingRules = (check.requirementResults || []).filter((rule) => !rule.passed);
        for (const rule of failingRules) {
          const detail = rule.details ? ` — ${rule.details}` : "";
          lines.push(`   • ${rule.label}${detail}`);
        }
      }

      return lines.join("\n");
    }

    // Best-effort usage event. Fire-and-forget: failures here must never
    // disrupt the score check, so errors are swallowed silently.
    function postUsageEvent({ projectCode, result, error, user, summary }) {
      const endpoint = getUsageEndpoint();
      if (!endpoint) {
        return;
      }

      if (typeof GM_xmlhttpRequest !== "function") {
        return;
      }

      // Flat object of string fields.
      const payload = {
        projectCode: projectCode || "unknown",
        user: user || "unknown",
        result,
        summary: summary || "",
        error: error || ""
      };

      try {
        GM_xmlhttpRequest({
          method: "POST",
          url: endpoint,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(payload),
          onerror: () => {},
          ontimeout: () => {}
        });
      } catch (err) {
        // Swallow — usage events are non-critical.
      }
    }

    // Resolve the logged-in user via Qase's app API (app.qase.io/v1/user/profile),
    // which is authenticated by the browser session cookie — no API token needed.
    // Same-origin request, so it carries cookies automatically. Best effort:
    // resolves to "unknown" on any failure rather than rejecting.
    function fetchCurrentUserName() {
      return new Promise((resolve) => {
        if (typeof GM_xmlhttpRequest !== "function") {
          resolve("unknown");
          return;
        }

        GM_xmlhttpRequest({
          method: "GET",
          url: "https://app.qase.io/v1/user/profile",
          headers: { accept: "application/json" },
          onload: (response) => {
            try {
              const payload = JSON.parse(response.responseText || "{}");
              // first_name / last_name live at the top level of the response.
              // Tolerate a nested result/data envelope just in case.
              const profile = payload.first_name != null || payload.last_name != null
                ? payload
                : (payload.result || payload.data || payload || {});
              const firstName = String(profile.first_name || "").trim();
              const lastName = String(profile.last_name || "").trim();
              const fullName = `${firstName} ${lastName}`.trim();
              resolve(fullName || String(profile.email || "").trim() || "unknown");
            } catch (err) {
              resolve("unknown");
            }
          },
          onerror: () => resolve("unknown"),
          ontimeout: () => resolve("unknown")
        });
      });
    }

    async function evaluateProjectWithQaseApis(projectCode, token) {
      const projectFetch = await fetchProject(projectCode, token);

      // Fail fast on an auth error so a bad/expired token surfaces as a clear
      // message instead of silently producing an empty (misleading) scorecard.
      const projectResponse = projectFetch.response;
      if (!projectResponse.ok) {
        if (projectResponse.status === 401 || projectResponse.status === 403) {
          throw new Error(
            `Qase API rejected the token (HTTP ${projectResponse.status}). Check CONFIG.qaseApiToken.`
          );
        }
        throw new Error(projectResponse.error || `Qase API request failed (HTTP ${projectResponse.status}).`);
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const runWindowFromSeconds = nowSeconds - RUN_RECENCY_DAYS * 24 * 60 * 60;

      const suiteFetch = await fetchAllSuites(projectCode, token);
      const planFetch = await fetchAllPlans(projectCode, token);
      const environmentFetch = await fetchAllEnvironments(projectCode, token);
      const caseFetch = await fetchAllCases(projectCode, token);
      const runFetch = await fetchRecentRuns(projectCode, token, runWindowFromSeconds, nowSeconds);
      const projectTitle = projectFetch.title;
      const suiteResponse = suiteFetch.lastResponse;
      const planResponse = planFetch.lastResponse;
      const environmentResponse = environmentFetch.lastResponse;
      const caseResponse = caseFetch.lastResponse;
      const runResponse = runFetch.lastResponse;

      const suites = suiteFetch.suites;
      const plans = planFetch.plans;
      const environments = environmentFetch.environments;
      const cases = caseFetch.cases;
      const recentRuns = runFetch.runs;
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
      const requiredRuleResults = requiredRules.map((rule) => ({
        label: rule.label,
        passed: hasTopLevelMatch(topLevelSuites, rule),
        matchedTitle: getTopLevelMatchName(topLevelSuites, rule)
      }));

      const discouragedSuiteSet = new Set(DISCOURAGED_SUITE_NAMES.map(normalizeName));
      const discouragedSuiteObjs = suites.filter((suite) => discouragedSuiteSet.has(normalizeName(suite.name)));
      const discouragedSuitesFound = uniqueStrings(discouragedSuiteObjs.map((suite) => suite.name));
      const discouragedSuiteRule = {
        label: `No suites named: ${DISCOURAGED_SUITE_NAMES.join(", ")}`,
        passed: discouragedSuitesFound.length === 0,
        details:
          discouragedSuitesFound.length === 0
            ? "No discouraged suite names found."
            : `Discouraged suite name(s) found: ${discouragedSuitesFound.join(", ")}`
      };

      const forbiddenSubstrings = FORBIDDEN_SUITE_TITLE_SUBSTRINGS.map((substring) => substring.toLowerCase());
      const forbiddenSuiteObjs = suites.filter((suite) => {
        const lowerName = suite.name.toLowerCase();
        return forbiddenSubstrings.some((substring) => lowerName.includes(substring));
      });
      const suitesWithForbiddenSubstring = uniqueStrings(forbiddenSuiteObjs.map((suite) => suite.name));
      const forbiddenSubstringRule = {
        label: `No suite titles containing: ${FORBIDDEN_SUITE_TITLE_SUBSTRINGS.join(", ")}`,
        passed: suitesWithForbiddenSubstring.length === 0,
        details:
          suitesWithForbiddenSubstring.length === 0
            ? "No suite titles contain forbidden text."
            : `Suite(s) with forbidden text: ${suitesWithForbiddenSubstring.join(", ")}`
      };

      // Unique list of suites that broke either suite rule, kept as objects so the
      // UI can link each one back to Qase (by id when available).
      const flaggedSuites = [];
      const seenFlaggedSuiteKeys = new Set();
      for (const suite of [...discouragedSuiteObjs, ...forbiddenSuiteObjs]) {
        const key = suite.id != null ? `id:${suite.id}` : `name:${normalizeName(suite.name)}`;
        if (seenFlaggedSuiteKeys.has(key)) {
          continue;
        }
        seenFlaggedSuiteKeys.add(key);
        flaggedSuites.push(suite);
      }

      const requirementResults = [...requiredRuleResults, discouragedSuiteRule, forbiddenSubstringRule];
      const passed = requirementResults.every((result) => result.passed);
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

      const orphanCases = cases.filter((testCase) => testCase.suiteId == null);

      const casesWithJiraTicket = cases
        .map((testCase) => {
          const tickets = uniqueStrings(testCase.title.match(JIRA_TICKET_TITLE_PATTERN) || []);
          return tickets.length ? { ...testCase, tickets } : null;
        })
        .filter(Boolean);

      const caseRequirementResults = [
        {
          label: "No test cases without a suite (null suite_id)",
          passed: orphanCases.length === 0,
          details:
            orphanCases.length === 0
              ? `All ${cases.length} test case(s) are assigned to a suite.`
              : `${orphanCases.length} of ${cases.length} test case(s) have a null suite_id (listed below).`
        },
        {
          label: "No test case titles containing a Jira or PDR ticket number",
          passed: casesWithJiraTicket.length === 0,
          details:
            casesWithJiraTicket.length === 0
              ? `No test case titles reference a Jira ticket.`
              : `${casesWithJiraTicket.length} of ${cases.length} test case(s) reference a Jira ticket in the title (listed below).`
        }
      ];
      const casePassed = caseRequirementResults.every((result) => result.passed);

      const runRequirementResults = [
        {
          label: `At least 1 test run in the last ${RUN_RECENCY_DAYS} days`,
          passed: recentRuns.length > 0,
          details:
            recentRuns.length > 0
              ? `${recentRuns.length} test run(s) started in the last ${RUN_RECENCY_DAYS} days.`
              : `No test runs started in the last ${RUN_RECENCY_DAYS} days.`
        }
      ];
      const runPassed = runRequirementResults.every((result) => result.passed);

      return {
        endpoints: [projectFetch.response, ...suiteFetch.responses, ...planFetch.responses, ...environmentFetch.responses, ...caseFetch.responses, ...runFetch.responses],
        projectTitle,
        overallPassed: passed && planPassed && environmentPassed && casePassed && runPassed,
        suiteCheck: {
          endpoint: suiteResponse ? suiteResponse.url : `${runtimeConfig.qaseApiBase}/suite/${encodeURIComponent(projectCode)}`,
          topLevelSuites,
          required,
          requiredRules,
          requirementResults,
          flaggedSuites,
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
        },
        caseCheck: {
          endpoint: caseResponse ? caseResponse.url : `${runtimeConfig.qaseApiBase}/case/${encodeURIComponent(projectCode)}`,
          totalCases: cases.length,
          orphanCases,
          casesWithJiraTicket,
          requirementResults: caseRequirementResults,
          passed: casePassed
        },
        runCheck: {
          endpoint: runResponse ? runResponse.url : `${runtimeConfig.qaseApiBase}/run/${encodeURIComponent(projectCode)}`,
          recencyDays: RUN_RECENCY_DAYS,
          recentRunCount: recentRuns.length,
          requirementResults: runRequirementResults,
          passed: runPassed
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

    async function fetchProject(projectCode, token) {
      const url = `${runtimeConfig.qaseApiBase}/project/${encodeURIComponent(projectCode)}`;
      const response = await requestQase(url, token);
      const result = response.payload?.result || response.payload?.data || {};
      const title = response.ok ? String(result.title || result.name || "").trim() : "";

      return {
        response,
        title,
        lastResponse: response
      };
    }

    async function fetchAllCases(projectCode, token) {
      // Case repositories can hold thousands of records, so page through them
      // sequentially (100 per request) rather than asking for everything at once.
      const limit = 100;
      let offset = 0;
      const maxPages = 200;
      const responses = [];
      const cases = [];
      let lastResponse = null;

      for (let page = 0; page < maxPages; page += 1) {
        const url = `${runtimeConfig.qaseApiBase}/case/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`;
        const response = await requestQase(url, token);
        lastResponse = response;

        if (!response.ok) {
          // Only retain failed responses; successful payloads are large and we
          // already keep the extracted cases, so there is no need to hold them.
          responses.push(response);
          break;
        }

        const pageCases = extractQaseCaseEntities(response.payload);
        cases.push(...pageCases);

        const total = Number(
          response.payload?.result?.total ?? response.payload?.result?.filtered ?? 0
        );
        if (pageCases.length < limit) {
          break;
        }
        if (total > 0 && cases.length >= total) {
          break;
        }

        offset += limit;
      }

      return {
        responses,
        cases,
        lastResponse
      };
    }

    async function fetchRecentRuns(projectCode, token, fromSeconds, toSeconds) {
      // Qase filters runs by start time via filters[from_start_time]/[to_start_time],
      // both Unix timestamps (int64 seconds). We only need to know a run exists in
      // the window, so a single page is enough.
      const params = [
        "limit=100",
        "offset=0",
        `filters[from_start_time]=${Math.floor(fromSeconds)}`,
        `filters[to_start_time]=${Math.floor(toSeconds)}`
      ].join("&");
      const url = `${runtimeConfig.qaseApiBase}/run/${encodeURIComponent(projectCode)}?${params}`;
      const response = await requestQase(url, token);
      const runs = response.ok ? extractQaseRunEntities(response.payload) : [];

      return {
        responses: [response],
        runs,
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
          const id = item.id ?? item.suite_id ?? item.suiteId ?? null;
          const parent = item.parent_id ?? item.parentId ?? item.parent ?? item.parent_suite_id ?? item.parentSuiteId;
          const level = item.depth ?? item.level;
          const isRoot = item.is_root ?? item.isRoot;
          const position = item.position ?? null;
          return {
            id: id == null ? null : id,
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

    function extractQaseCaseEntities(payload) {
      const rawEntities =
        payload?.result?.entities ||
        payload?.result?.cases ||
        payload?.result ||
        payload?.data?.entities ||
        payload?.data?.cases ||
        payload?.data ||
        [];
      const list = Array.isArray(rawEntities) ? rawEntities : [];

      // Keep only the fields the rubric needs so large repositories stay light.
      return list.map((item) => {
        const id = item?.id ?? item?.case_id ?? item?.caseId ?? null;
        const title = String(item?.title || item?.name || "").trim();
        const rawSuiteId = item?.suite_id ?? item?.suiteId ?? null;

        return {
          id,
          title,
          suiteId: rawSuiteId == null ? null : rawSuiteId
        };
      });
    }

    function extractQaseRunEntities(payload) {
      const rawEntities =
        payload?.result?.entities ||
        payload?.result?.runs ||
        payload?.result ||
        payload?.data?.entities ||
        payload?.data?.runs ||
        payload?.data ||
        [];
      const list = Array.isArray(rawEntities) ? rawEntities : [];

      return list.map((item) => {
        const id = item?.id ?? item?.run_id ?? item?.runId ?? null;
        const title = String(item?.title || item?.name || "").trim();
        const startTimeRaw = item?.start_time ?? item?.startTime ?? null;

        return {
          id,
          title,
          startTime: startTimeRaw == null ? "" : String(startTimeRaw).trim()
        };
      });
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

      const text = message || "";
      statusEl.textContent = text;
      statusEl.classList.toggle("qrc-status-error", !!isError);
      statusEl.style.display = text ? "" : "none";
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

      const requirementRows = (evaluation.suiteCheck.requirementResults || [])
        .map((result) => {
          let detailText;
          if (result.details != null) {
            detailText = result.details;
          } else {
            const normalizedLabel = normalizeName(result.label);
            const normalizedMatched = normalizeName(result.matchedTitle || "");
            const usedSubstitution = !!result.passed && !!result.matchedTitle && normalizedMatched !== normalizedLabel;
            detailText = !result.passed
              ? "Not found"
              : usedSubstitution
                ? `Accepted substitution used: ${result.matchedTitle}`
                : `Matched required title: ${result.label}`;
          }

          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td>${statusChip(result.passed)}</td>
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
              <td>${statusChip(result.passed)}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      const environmentRequirementRows = (evaluation.environmentCheck.requirementResults || [])
        .map((result) => {
          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td>${statusChip(result.passed)}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      const caseRequirementRows = (evaluation.caseCheck.requirementResults || [])
        .map((result) => {
          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td>${statusChip(result.passed)}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      const runRequirementRows = ((evaluation.runCheck && evaluation.runCheck.requirementResults) || [])
        .map((result) => {
          return `
            <tr>
              <td>${escapeHtml(result.label)}</td>
              <td>${statusChip(result.passed)}</td>
              <td>${escapeHtml(result.details || "")}</td>
            </tr>
          `;
        })
        .join("");

      // Render a case as a list item, linking to Qase in a new tab when we have an id.
      const renderCaseItem = (testCase, extraSuffix) => {
        const label = testCase.title || `Case #${testCase.id}`;
        const suffix = extraSuffix || "";
        if (testCase.id != null) {
          const href = qaseCaseUrl(projectCode, testCase.id);
          return `<li><a class="qrc-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span class="qrc-case-id">${escapeHtml(projectCode)}-${escapeHtml(String(testCase.id))}</span></a>${suffix}</li>`;
        }
        return `<li>${escapeHtml(label)}${suffix}</li>`;
      };

      const orphanCases = evaluation.caseCheck.orphanCases || [];
      const orphanListBlock = orphanCases.length
        ? `
          <div class="qrc-case-list-wrap">
            <div class="qrc-case-list-title">Test cases with a null suite_id (${orphanCases.length})</div>
            <ul class="qrc-case-list">
              ${orphanCases.map((testCase) => renderCaseItem(testCase)).join("")}
            </ul>
          </div>
        `
        : "";

      const jiraCases = evaluation.caseCheck.casesWithJiraTicket || [];
      const jiraListBlock = jiraCases.length
        ? `
          <div class="qrc-case-list-wrap">
            <div class="qrc-case-list-title">Test cases referencing a Jira or PDR ticket (${jiraCases.length})</div>
            <ul class="qrc-case-list">
              ${jiraCases
                .map((testCase) => {
                  const ticketSuffix = (testCase.tickets || []).length
                    ? ` <span class="qrc-case-id">${escapeHtml(testCase.tickets.join(", "))}</span>`
                    : "";
                  return renderCaseItem(testCase, ticketSuffix);
                })
                .join("")}
            </ul>
          </div>
        `
        : "";

      const flaggedSuites = evaluation.suiteCheck.flaggedSuites || [];
      const flaggedSuiteListBlock = flaggedSuites.length
        ? `
          <div class="qrc-case-list-wrap">
            <div class="qrc-case-list-title">Suites breaking the rules above (${flaggedSuites.length})</div>
            <ul class="qrc-case-list">
              ${flaggedSuites
                .map((suite) => {
                  const label = suite.name || `Suite #${suite.id}`;
                  if (suite.id != null) {
                    const href = qaseSuiteUrl(projectCode, suite.id);
                    return `<li><a class="qrc-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span class="qrc-case-id">#${escapeHtml(String(suite.id))}</span></a></li>`;
                  }
                  return `<li>${escapeHtml(label)}</li>`;
                })
                .join("")}
            </ul>
          </div>
        `
        : "";

      const resultsHeading = `${evaluation.projectTitle || projectCode} Results`;

      results.innerHTML = `
        <h3 class="qrc-results-title">${escapeHtml(resultsHeading)}</h3>

        <div class="qrc-pills">
          <span class="qrc-pill ${evaluation.suiteCheck.passed ? "pass" : "fail"}">Suites ${evaluation.suiteCheck.passed ? "✓" : "✕"}</span>
          <span class="qrc-pill ${evaluation.planCheck.passed ? "pass" : "fail"}">Test Plans ${evaluation.planCheck.passed ? "✓" : "✕"}</span>
          <span class="qrc-pill ${evaluation.environmentCheck.passed ? "pass" : "fail"}">Environments ${evaluation.environmentCheck.passed ? "✓" : "✕"}</span>
          <span class="qrc-pill ${evaluation.caseCheck.passed ? "pass" : "fail"}">Test Cases ${evaluation.caseCheck.passed ? "✓" : "✕"}</span>
          <span class="qrc-pill ${evaluation.runCheck.passed ? "pass" : "fail"}">Test Runs ${evaluation.runCheck.passed ? "✓" : "✕"}</span>
        </div>

        <details class="qrc-details" ${evaluation.suiteCheck.passed ? "" : "open"}>
          <summary class="qrc-summary">Suite Rules<span class="qrc-section-status ${evaluation.suiteCheck.passed ? "pass" : "fail"}">${evaluation.suiteCheck.passed ? "✓ Passed" : "✕ Needs attention"}</span></summary>
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
          ${flaggedSuiteListBlock}
        </details>

        <details class="qrc-details" ${evaluation.planCheck.passed ? "" : "open"}>
          <summary class="qrc-summary">Test Plan Rules<span class="qrc-section-status ${evaluation.planCheck.passed ? "pass" : "fail"}">${evaluation.planCheck.passed ? "✓ Passed" : "✕ Needs attention"}</span></summary>
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

        <details class="qrc-details" ${evaluation.environmentCheck.passed ? "" : "open"}>
          <summary class="qrc-summary">Environment Rules<span class="qrc-section-status ${evaluation.environmentCheck.passed ? "pass" : "fail"}">${evaluation.environmentCheck.passed ? "✓ Passed" : "✕ Needs attention"}</span></summary>
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

        <details class="qrc-details" ${evaluation.caseCheck.passed ? "" : "open"}>
          <summary class="qrc-summary">Test Case Rules<span class="qrc-section-status ${evaluation.caseCheck.passed ? "pass" : "fail"}">${evaluation.caseCheck.passed ? "✓ Passed" : "✕ Needs attention"}</span></summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Test Case Rule</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${caseRequirementRows}
            </tbody>
          </table>
          ${orphanListBlock}
          ${jiraListBlock}
        </details>

        <details class="qrc-details" ${evaluation.runCheck.passed ? "" : "open"}>
          <summary class="qrc-summary">Test Run Rules<span class="qrc-section-status ${evaluation.runCheck.passed ? "pass" : "fail"}">${evaluation.runCheck.passed ? "✓ Passed" : "✕ Needs attention"}</span></summary>
          <table class="qrc-table">
            <thead>
              <tr>
                <th>Test Run Rule</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${runRequirementRows}
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

    function statusChip(passed) {
      return `<span class="qrc-chip ${passed ? "pass" : "fail"}">${passed ? "✓ PASS" : "✕ FAIL"}</span>`;
    }

    function qaseCaseUrl(projectCode, caseId) {
      return `https://app.qase.io/case/${encodeURIComponent(projectCode)}-${encodeURIComponent(String(caseId))}`;
    }

    function qaseSuiteUrl(projectCode, suiteId) {
      return `https://app.qase.io/project/${encodeURIComponent(projectCode)}?suite=${encodeURIComponent(String(suiteId))}`;
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
})(typeof window !== "undefined" ? window : this);
