/**
 * Alberta Pulse Check — Embeddable Chart Widget
 *
 * Usage:
 *   <div data-ap-chart="macro-policy-rate"></div>
 *   <script src="https://albertapulse.com/embed/widget.js"></script>
 *
 * Options (data attributes):
 *   data-ap-chart   — Chart ID (required)
 *   data-ap-height  — Initial height in px (default: 420)
 *   data-ap-theme   — "dark" | "light" (default: auto-detect)
 */
(function () {
  "use strict";

  var ORIGIN =
    document.currentScript &&
    document.currentScript.src &&
    new URL(document.currentScript.src).origin;
  if (!ORIGIN) ORIGIN = "https://albertapulse.com";

  function createWidget(el) {
    var chartId = el.getAttribute("data-ap-chart");
    if (!chartId) return;

    var height = parseInt(el.getAttribute("data-ap-height") || "420", 10);
    var theme = el.getAttribute("data-ap-theme") || "";

    var src = ORIGIN + "/embed/" + encodeURIComponent(chartId);
    if (theme) src += "?theme=" + theme;

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.style.width = "100%";
    iframe.style.height = height + "px";
    iframe.style.border = "1px solid #27272a";
    iframe.style.borderRadius = "12px";
    iframe.style.colorScheme = "normal";
    iframe.style.display = "block";
    iframe.title = "Alberta Pulse Check — " + chartId;
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allowtransparency", "true");

    el.innerHTML = "";
    el.style.position = "relative";
    el.appendChild(iframe);
  }

  // Auto-resize via postMessage
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var data;
    try {
      data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch (_) {
      return;
    }
    if (data.type !== "ap-resize" || !data.chartId) return;

    var els = document.querySelectorAll(
      '[data-ap-chart="' + data.chartId + '"]'
    );
    for (var i = 0; i < els.length; i++) {
      var iframe = els[i].querySelector("iframe");
      if (iframe) iframe.style.height = data.height + "px";
    }
  });

  // Init all widgets on the page
  function init() {
    var els = document.querySelectorAll("[data-ap-chart]");
    for (var i = 0; i < els.length; i++) {
      if (!els[i].querySelector("iframe")) {
        createWidget(els[i]);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Observe for dynamically added widgets
  if (window.MutationObserver) {
    new MutationObserver(function () {
      init();
    }).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
