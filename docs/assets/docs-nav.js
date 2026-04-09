"use strict";

function normalizeParts(parts) {
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (out.length > 0) {
        out.pop();
      }
      continue;
    }
    out.push(part);
  }
  return out;
}

function relHref(fromDir, targetRelPath) {
  const fromParts = normalizeParts(fromDir.split("/"));
  const targetParts = normalizeParts(targetRelPath.split("/"));

  let i = 0;
  while (i < fromParts.length && i < targetParts.length && fromParts[i] === targetParts[i]) {
    i += 1;
  }

  const up = new Array(fromParts.length - i).fill("..");
  const down = targetParts.slice(i);
  const joined = [...up, ...down].join("/");
  return joined || ".";
}

function currentDocsRelPath() {
  const path = window.location.pathname.replace(/\\/g, "/");
  const marker = "/docs/";
  const idx = path.lastIndexOf(marker);
  if (idx >= 0) {
    return path.slice(idx + marker.length);
  }
  const parts = path.split("/");
  return parts[parts.length - 1] || "system-analysis.html";
}

function activeTarget(relPath) {
  if (relPath.startsWith("adr/")) {
    return "adr/README.html";
  }
  if (relPath.startsWith("developer/")) {
    return "developer/README.html";
  }
  if (relPath.startsWith("backlog/")) {
    return "backlog/README.html";
  }
  if (relPath.startsWith("runbooks/")) {
    return "runbooks/README.html";
  }
  if (relPath === "engineering-practices.html") {
    return "engineering-practices.html";
  }
  return "system-analysis.html";
}

function renderTopNav() {
  const host = document.getElementById("docs-top-nav");
  if (!host) {
    return;
  }

  const relPath = currentDocsRelPath();
  const fromDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
  const active = activeTarget(relPath);
  const items = [
    { label: "System Analysis", target: "system-analysis.html" },
    { label: "Engineering Practices", target: "engineering-practices.html" },
    { label: "Developer Docs", target: "developer/README.html" },
    { label: "Backlog", target: "backlog/README.html" },
    { label: "ADR", target: "adr/README.html" },
    { label: "Runbooks", target: "runbooks/README.html" },
  ];

  const nav = document.createElement("nav");
  nav.className = "top-nav";
  nav.setAttribute("aria-label", "Documentation navigation");

  for (const item of items) {
    const link = document.createElement("a");
    link.textContent = item.label;
    link.href = relHref(fromDir, item.target);
    if (item.target === active) {
      link.className = "is-active";
      link.setAttribute("aria-current", "page");
    }
    nav.appendChild(link);
  }

  host.replaceWith(nav);
}

document.addEventListener("DOMContentLoaded", renderTopNav);
