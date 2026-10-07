/* ==========================================================
   Instagram Follow Checker
   Todo se ejecuta en el navegador. No hay peticiones de red
   ni almacenamiento (sin localStorage, cookies ni servidor).

   Estructura:
     1. Configuración
     2. PARSER      -> extrae nombres de usuario de un HTML
     3. COMPARACIÓN -> lógica pura, independiente del HTML
     4. INTERFAZ    -> manejo del DOM y validaciones
   ========================================================== */
"use strict";

// --- Diagnóstico temporal visible en la página (ver el script inline de index.html) ---
function diag(step, ok, msg) {
  try { if (typeof window !== "undefined" && window.__diag) window.__diag.set(step, ok, msg); } catch (_) { /* nunca debe romper la app */ }
}
if (typeof window !== "undefined") window.__ifcLoaded = true;
diag("script", true, "cargado");

/* ---------- 1. Configuración ---------- */

// Para activar el video tutorial, pon aquí el enlace "embed" de YouTube.
// Ejemplo: "https://www.youtube.com/embed/ID_DEL_VIDEO"
const VIDEO_URL = "";

const MAX_FILE_MB = 50;

const INSTAGRAM_HOSTS = /^(www\.|m\.)?instagram\.com$/i;

/* ---------- 2. PARSER ---------- */

/** Normaliza y valida un nombre de usuario. Devuelve null si no es válido. */
function normalizeUsername(raw) {
  if (raw == null) return null;
  const name = String(raw).trim().replace(/^@/, "").toLowerCase();
  // Instagram: letras, números, puntos y guiones bajos (máx. 30).
  if (!/^[a-z0-9._]{1,30}$/.test(name)) return null;
  if (!/[a-z0-9_]/.test(name)) return null; // descarta "." o ".."
  return name;
}

/**
 * Obtiene el usuario desde un enlace de Instagram.
 * Acepta /usuario, /usuario/, /_u/usuario y parámetros (?hl=es, #...).
 * Rechaza enlaces relativos (p. ej. "followers_2.html"), otros dominios
 * (help.instagram.com) y rutas con más de un segmento (/p/ABC, /accounts/login).
 * NO descarta nombres por coincidir con rutas de Instagram: un usuario
 * llamado "explore" o "about" es válido y se conserva.
 */
function usernameFromHref(href) {
  if (!href) return null;
  try {
    // Base ficticia: un enlace relativo nunca se interpreta como de Instagram.
    const url = new URL(String(href).trim(), "https://base.invalid/");
    if (!/^https?:$/.test(url.protocol) || !INSTAGRAM_HOSTS.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "_u") parts.shift();
    if (parts.length !== 1) return null;
    return normalizeUsername(parts[0]);
  } catch {
    return null;
  }
}

/** Estructura anonimizada de la primera entrada (para diagnóstico): el enlace y hasta 2 ancestros. */
function skeletonOf(anchor, user) {
  let node = anchor;
  for (let i = 0; i < 2 && node.parentElement && node.parentElement.tagName !== "BODY"; i++) node = node.parentElement;
  const escaped = user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return node.outerHTML.replace(new RegExp(escaped, "gi"), "USUARIO").replace(/\s+/g, " ").slice(0, 500);
}

/**
 * Analiza un texto HTML. Devuelve { users: Set, stats }.
 * Estrategia 1: enlaces <a href="...instagram.com/usuario">.
 * Estrategia 2 (solo si la 1 no encuentra nada): URLs de Instagram en el texto.
 * stats sirve para el diagnóstico (?debug=1). DOMParser crea un documento
 * inerte: no ejecuta scripts ni descarga recursos.
 */
function analyzeHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...doc.querySelectorAll("a[href]")];
  const users = new Set();
  const stats = { method: "enlaces", anchors: anchors.length, igLinks: 0, mismatches: 0,
                  h2: doc.querySelectorAll("h2").length, skeleton: "" };

  anchors.forEach((a) => {
    const user = usernameFromHref(a.getAttribute("href"));
    if (!user) return;
    stats.igLinks++;
    users.add(user);
    if (!stats.skeleton) stats.skeleton = skeletonOf(a, user);
    const text = normalizeUsername(a.textContent); // texto del enlace distinto al del href
    if (text && text !== user) stats.mismatches++;
  });

  if (users.size === 0) {
    stats.method = "texto (respaldo)";
    const urls = html.match(/(?:https?:)?\/\/(?:www\.|m\.)?instagram\.com\/[^\s"'<>)\]]*/gi) || [];
    urls.forEach((raw) => {
      const user = usernameFromHref(raw.replace(/[.,;:!?]+$/, ""));
      if (user) { stats.igLinks++; users.add(user); }
    });
  }
  stats.unique = users.size;
  stats.duplicates = stats.igLinks - users.size;
  return { users, stats };
}

/** Atajo: solo el conjunto de usuarios. */
const extractUsernames = (html) => analyzeHtml(html).users;

/* ---------- 3. COMPARACIÓN ---------- */

/**
 * seguidos − seguidores = quienes no te siguen de vuelta (ordenados A-Z).
 * Normaliza ambos lados (minúsculas, sin "@", sin duplicados) por seguridad.
 */
function findNotFollowingBack(followers, following) {
  const clean = (list) => new Set([...list].map(normalizeUsername).filter(Boolean));
  const followerSet = clean(followers);
  return [...clean(following)]
    .filter((user) => !followerSet.has(user))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/**
 * Cuentas eliminadas: Instagram las exporta con un nombre sustituto
 * "__deleted__<código>" (no son perfiles reales). Se excluyen del análisis.
 */
const isDeletedAccount = (user) => /^__deleted__/.test(user);

const profileUrl = (user) => `https://www.instagram.com/${user}/`;

/* ---------- 4. INTERFAZ ---------- */

function initUI() {
  diag("init", true, "ejecutado");
  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("compare-form"), btn: $("compare-btn"),
    followersInput: $("followers-file"), followingInput: $("following-file"),
    followersName: $("followers-name"), followingName: $("following-name"),
    status: $("status"), statusText: $("status-text"),
    error: $("error"), warning: $("warning"),
    results: $("results"), total: $("total-count"), totalLabel: $("total-label"),
    stats: $("stats"), tools: $("results-tools"), search: $("search"),
    counter: $("counter"), list: $("user-list"),
    noMatches: $("no-matches"), emptyState: $("empty-state"),
    copyBtn: $("copy-btn"), downloadBtn: $("download-btn"),
    video: $("video-container")
  };

  // Comprobación temporal: todos los elementos deben existir antes de registrar eventos.
  const extraIds = ["diagnostics", "diag-output", "diag-copy"];
  const missing = [...Object.entries(els).filter(([, el]) => !el).map(([k]) => k),
                   ...extraIds.filter((id) => !$(id))];
  if (missing.length) {
    diag("form", false, "faltan elementos en index.html: " + missing.join(", "));
    return;
  }
  diag("form", true, "encontrado");

  // Etapa actual del flujo (para saber dónde ocurre un error).
  let stage = "inicio";
  const setStage = (name) => { stage = name; diag("stage", null, name); };

  // Resultados actuales (solo en memoria; se pierden al cerrar la página).
  let allResults = [];

  // Diagnóstico temporal: se activa abriendo la página con ?debug=1 (o #debug).
  const DEBUG = /[?&]debug(=1|=true)?(&|$)/.test(location.search) || location.hash === "#debug";
  let diagLog = [];
  const diagBox = $("diagnostics"), diagOut = $("diag-output"), diagCopy = $("diag-copy");

  function diagnosticsText(totals) {
    const lines = ["=== Diagnóstico Instagram Follow Checker (sin nombres de usuario) ==="];
    diagLog.forEach((d) => {
      lines.push(`[${d.field}] ${d.name} | ${d.kb} KB | método: ${d.method} | <a> totales: ${d.anchors} | enlaces a perfiles: ${d.igLinks} | usuarios únicos: ${d.unique} | repetidos: ${d.duplicates} | texto≠href: ${d.mismatches} | <h2>: ${d.h2}`);
      if (d.skeleton) lines.push("   primera entrada (anonimizada): " + d.skeleton);
    });
    if (totals) {
      lines.push(`TOTALES | seguidores únicos: ${totals.followers} | seguidos únicos: ${totals.following} | seguidos que también te siguen: ${totals.both} | RESULTADO (seguidos − seguidores): ${totals.result} | te siguen y no sigues: ${totals.onlyFollowers} | cuentas eliminadas excluidas: ${totals.excluded}`);
    }
    return lines.join("\n");
  }
  function renderDiagnostics(totals) {
    if (!DEBUG) return;
    diagOut.textContent = diagnosticsText(totals);
    diagBox.hidden = false;
    diagBox.open = true;
  }
  if (DEBUG) {
    diagBox.hidden = false;
    diagOut.textContent = "Selecciona los archivos y pulsa «Comparar listas» para ver el diagnóstico.";
  }

  // Video tutorial opcional
  if (VIDEO_URL) {
    const iframe = document.createElement("iframe");
    iframe.src = VIDEO_URL;
    iframe.title = "Video tutorial";
    iframe.allow = "accelerometer; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    els.video.replaceChildren(iframe);
  }

  /* -- Utilidades de UI -- */
  const showError = (msg) => { els.error.textContent = msg; els.error.hidden = false; };
  const showWarning = (msg) => { els.warning.textContent = msg; els.warning.hidden = false; };
  const clearMessages = () => { els.error.hidden = true; els.warning.hidden = true; };
  const setLoading = (on, text) => {
    els.status.hidden = !on;
    if (text) els.statusText.textContent = text;
    els.btn.disabled = on;
  };
  const pause = () => new Promise((r) => setTimeout(r, 30)); // deja pintar el "cargando"
  const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;

  function showFileNames(input, nameEl) {
    const files = [...input.files];
    nameEl.textContent = files.length ? files.map((f) => f.name).join(", ") : "Ningún archivo seleccionado";
    input.closest(".file-field").classList.toggle("has-file", files.length > 0);
  }

  // Al cambiar la selección, se limpian mensajes y resultados anteriores.
  function onSelectionChange(input, nameEl) {
    showFileNames(input, nameEl);
    clearMessages();
    els.results.hidden = true;
    allResults = [];
  }
  els.followersInput.addEventListener("change", () => onSelectionChange(els.followersInput, els.followersName));
  els.followingInput.addEventListener("change", () => onSelectionChange(els.followingInput, els.followingName));

  /** Lee un archivo como texto (FileReader: compatible con todos los navegadores). */
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}". Inténtalo de nuevo.`));
      reader.readAsText(file, "utf-8");
    });
  }

  /** Valida un archivo antes de leerlo; lanza un Error con mensaje claro. */
  function validateFile(file, label) {
    if (/\.zip$/i.test(file.name)) {
      throw new Error(`"${file.name}" es un ZIP. Descomprímelo y selecciona el archivo .html de ${label}.`);
    }
    if (/\.json$/i.test(file.name)) {
      throw new Error(`"${file.name}" es JSON. Esta herramienta necesita el formato HTML: vuelve a descargar tus datos de Instagram eligiendo HTML.`);
    }
    if (!/\.html?$/i.test(file.name)) {
      throw new Error(`"${file.name}" no es un archivo HTML. Selecciona el archivo .html de ${label}.`);
    }
    if (file.size === 0) {
      throw new Error(`"${file.name}" está vacío.`);
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`"${file.name}" es demasiado grande (máximo ${MAX_FILE_MB} MB).`);
    }
  }

  /** Lee uno o varios archivos y devuelve la unión de usuarios (sin duplicados). */
  async function readUsers(files, label, field) {
    const users = new Set();
    const seen = new Set();
    for (const file of files) {
      if (seen.has(fileKey(file))) continue; // mismo archivo repetido
      seen.add(fileKey(file));
      validateFile(file, label);

      const text = await readFileText(file);
      let info;
      try { info = analyzeHtml(text); }
      catch { throw new Error(`"${file.name}" no se pudo interpretar como HTML.`); }
      diagLog.push({ field, name: file.name, kb: Math.round(file.size / 1024), ...info.stats });

      if (info.users.size === 0) {
        const extra = info.stats.h2
          ? ` El archivo tiene ${info.stats.h2} encabezados <h2> pero ningún enlace a perfiles: es un formato que aún no se soporta. Abre la página con ?debug=1 y comparte el diagnóstico.`
          : "";
        throw new Error(`No se encontraron usuarios de Instagram en "${file.name}". Verifica que sea el archivo HTML de ${label} descargado desde Instagram.${extra}`);
      }
      info.users.forEach((u) => users.add(u));
    }
    return users;
  }

  /** Avisos no bloqueantes según los nombres de archivo (p. ej. archivo equivocado o invertido). */
  function filenameWarnings(followerFiles, followingFiles) {
    const out = [];
    followerFiles.filter((f) => !/followers/i.test(f.name)).forEach((f) =>
      out.push(`"${f.name}" no parece un archivo de seguidores (normalmente followers_1.html).`));
    followingFiles.filter((f) => !/following/i.test(f.name)).forEach((f) =>
      out.push(`"${f.name}" no parece un archivo de seguidos (normalmente following.html).`));
    return out;
  }

  /* -- Render de resultados -- */
  function renderList(filter = "") {
    const q = filter.trim().toLowerCase().replace(/^@/, "");
    const visible = q ? allResults.filter((u) => u.includes(q)) : allResults;

    const frag = document.createDocumentFragment();
    visible.forEach((user) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = profileUrl(user);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "@" + user;
      li.appendChild(a);
      frag.appendChild(li);
    });
    els.list.replaceChildren(frag);

    els.counter.textContent = q
      ? `Mostrando ${visible.length} de ${allResults.length} usuarios`
      : `${allResults.length} usuarios`;
    els.noMatches.hidden = !(q && visible.length === 0);
    els.list.hidden = visible.length === 0;
  }

  function renderResults(results, followersCount, followingCount, excluded = 0) {
    allResults = results;
    els.results.hidden = false;
    els.total.textContent = results.length;
    els.totalLabel.textContent = results.length === 1
      ? "persona no te sigue de vuelta" : "personas no te siguen de vuelta";
    els.stats.textContent = `Seguidores: ${followersCount} · Seguidos: ${followingCount}` +
      (excluded ? ` · Cuentas eliminadas excluidas: ${excluded}` : "");
    els.search.value = "";

    const empty = results.length === 0;
    els.tools.hidden = empty;
    els.emptyState.hidden = !empty;
    if (!empty) renderList();
  }

  /* -- Evento principal -- */
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStage("submit recibido");
    clearMessages();
    els.results.hidden = true;
    allResults = [];
    diagLog = [];

    const followerFiles = [...els.followersInput.files];
    const followingFiles = [...els.followingInput.files];
    diag("files", followerFiles.length > 0 && followingFiles.length > 0,
      `seguidores: ${followerFiles.length} (${followerFiles.map((f) => f.name).join(", ") || "ninguno"}) · seguidos: ${followingFiles.length} (${followingFiles.map((f) => f.name).join(", ") || "ninguno"})`);
    if (!followerFiles.length || !followingFiles.length) {
      diag("stage", false, "faltan archivos");
      showError("Selecciona los dos archivos: el de seguidores y el de seguidos.");
      return;
    }

    // El mismo archivo en ambos campos daría siempre 0 resultados.
    const followerKeys = new Set(followerFiles.map(fileKey));
    if (followingFiles.some((f) => followerKeys.has(fileKey(f)))) {
      showError("Seleccionaste el mismo archivo en los dos campos. Elige followers_1.html para seguidores y following.html para seguidos.");
      return;
    }

    setLoading(true, "Analizando archivos…");
    await pause();
    try {
      setStage("leyendo archivos de seguidores");
      const followersAll = await readUsers(followerFiles, "seguidores", "seguidores");
      setStage("leyendo archivos de seguidos");
      const followingAll = await readUsers(followingFiles, "seguidos", "seguidos");
      // Se descartan las cuentas eliminadas (__deleted__...) de ambas listas.
      const followers = new Set([...followersAll].filter((u) => !isDeletedAccount(u)));
      const following = new Set([...followingAll].filter((u) => !isDeletedAccount(u)));
      const excluded = (followersAll.size - followers.size) + (followingAll.size - following.size);
      setStage("comparando listas");
      setLoading(true, "Comparando listas…");
      await pause();

      const results = findNotFollowingBack(followers, following);
      setStage("mostrando resultados");
      renderResults(results, followers.size, following.size, excluded);
      const both = following.size - results.length;
      renderDiagnostics({ followers: followers.size, following: following.size, both,
                          result: results.length, onlyFollowers: followers.size - both, excluded });

      const warnings = filenameWarnings(followerFiles, followingFiles);
      if (following.size > 0 && results.length === following.size) {
        warnings.push("Ninguna de las cuentas que sigues aparece en tus seguidores. Verifica que ambos archivos sean de la misma cuenta y que no estén intercambiados.");
      }
      if (warnings.length) {
        showWarning(warnings.join(" "));
        els.warning.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        els.results.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      diag("stage", true, `completado: ${results.length} resultado(s)`);
    } catch (err) {
      diag("stage", false, `error en la etapa «${stage}»: ${err && err.message ? err.message : err}`);
      showError(err.message || "Ocurrió un error al procesar los archivos.");
      renderDiagnostics(null);
    } finally {
      setLoading(false);
    }
  });

  if (typeof window !== "undefined") window.__ifcReady = true;
  diag("submit", true, "registrado en compare-form");

  els.search.addEventListener("input", () => renderList(els.search.value));

  /* -- Copiar y descargar (siempre la lista completa, no solo lo filtrado) -- */
  const asText = () => allResults.map(profileUrl).join("\n");

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* se prueba la alternativa */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  els.copyBtn.addEventListener("click", async () => {
    const original = "Copiar lista";
    const ok = await copyText(asText());
    els.copyBtn.textContent = ok ? "¡Copiado!" : "No se pudo copiar";
    setTimeout(() => (els.copyBtn.textContent = original), 1800);
  });

  diagCopy.addEventListener("click", async () => {
    const ok = await copyText(diagOut.textContent);
    diagCopy.textContent = ok ? "¡Copiado!" : "No se pudo copiar";
    setTimeout(() => (diagCopy.textContent = "Copiar diagnóstico"), 1800);
  });

  els.downloadBtn.addEventListener("click", () => {
    const blob = new Blob([asText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "no-me-siguen-de-vuelta.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// Arranque (solo en navegador)
function safeInit() {
  try {
    initUI();
  } catch (err) { // try/catch global temporal: el error se muestra en la página
    diag("init", false, `initUI() falló: ${err && err.message ? err.message : err}`);
  }
}
if (typeof document !== "undefined") {
  // Si el documento ya terminó de cargar, DOMContentLoaded ya no volverá a dispararse.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeInit);
  else safeInit();
}

// Exportación para pruebas en Node (no afecta al navegador)
if (typeof module !== "undefined") {
  module.exports = { isDeletedAccount, analyzeHtml, extractUsernames, findNotFollowingBack, usernameFromHref, normalizeUsername, profileUrl };
}
