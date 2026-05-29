(() => {
  const endpoint = "https://pelu-pageviews.xhdwrjf72c.workers.dev/api/pageview";
  const allowedHosts = new Set(["pelu.wutoby.com"]);

  if (!allowedHosts.has(window.location.hostname)) return;
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  const normalizedPath = window.location.pathname === "/"
    ? "/"
    : window.location.pathname.replace(/\/+$/, "");
  const payload = JSON.stringify({ path: normalizedPath || "/" });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch(endpoint, {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json" },
    keepalive: true
  }).catch(() => {});
})();
