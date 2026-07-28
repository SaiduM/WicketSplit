"use client";

import { useEffect, useState } from "react";

export default function PwaClient() {
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const isiPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isiPhone && !standalone && localStorage.getItem("wicketsplit-install-hint") !== "dismissed") setShowInstall(true);
  }, []);

  if (!showInstall) return null;
  return <aside className="install-hint" aria-label="Install WicketSplit">
    <img src="/app-icon-192.png" alt="" />
    <div><strong>Add WicketSplit to your iPhone</strong><span>Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span></div>
    <button aria-label="Dismiss install instructions" onClick={()=>{localStorage.setItem("wicketsplit-install-hint","dismissed");setShowInstall(false)}}>×</button>
  </aside>;
}
