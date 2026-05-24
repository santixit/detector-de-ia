import { createIcons, icons } from "lucide";
import mammoth from "mammoth/mammoth.browser";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const state = {
  activeView: "rewrite",
  sourceText: "",
  outputText: "",
  extractedText: "",
  extractedFileName: "",
  detection: null,
  languageMatches: [],
  health: {
    saplingConfigured: false,
    languageToolAvailable: false,
  },
  settings: {
    mode: "natural",
    tone: "cercano",
    intensity: 2,
    preserveCitations: true,
    keepFacts: true,
  },
};

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true">AC</div>
        <div>
          <h1>Autor Claro</h1>
          <p>Reescritura responsable, revision de estilo y analisis orientativo de documentos.</p>
        </div>
      </div>
      <div class="status-strip" aria-live="polite">
        <span class="status-pill" id="saplingStatus">Sapling: revisando</span>
        <span class="status-pill good" id="localStatus">Modo local activo</span>
      </div>
    </header>

    <nav class="view-tabs" aria-label="Vistas de la herramienta">
      <button class="tab-button active" type="button" data-view="rewrite">
        <i data-lucide="wand-2"></i>
        Reescribir
      </button>
      <button class="tab-button" type="button" data-view="documents">
        <i data-lucide="file-search"></i>
        Documentos
      </button>
      <button class="tab-button" type="button" data-view="prompts">
        <i data-lucide="clipboard-check"></i>
        Prompts
      </button>
    </nav>

    <section class="view-panel" id="rewriteView">
      <div class="workspace-grid">
        <section class="tool-pane input-pane">
          <div class="pane-head">
            <div>
              <p class="eyebrow">Texto base</p>
              <h2>Editor de reescritura</h2>
            </div>
            <button class="icon-button" type="button" id="clearSource" aria-label="Limpiar texto" title="Limpiar texto">
              <i data-lucide="eraser"></i>
            </button>
          </div>
          <textarea id="sourceText" spellcheck="true" placeholder="Pega aqui el texto que quieres mejorar sin cambiar el sentido."></textarea>
          <div class="counter-row">
            <span id="sourceStats">0 palabras</span>
            <button class="ghost-button" type="button" id="pasteExample">
              <i data-lucide="text-cursor-input"></i>
              Ejemplo
            </button>
          </div>

          <div class="control-grid">
            <label>
              Modo
              <select id="modeSelect">
                <option value="natural">Natural</option>
                <option value="clarity">Claro y breve</option>
                <option value="academic">Academico</option>
                <option value="professional">Profesional</option>
              </select>
            </label>
            <label>
              Tono
              <select id="toneSelect">
                <option value="cercano">Cercano</option>
                <option value="neutral">Neutral</option>
                <option value="formal">Formal</option>
                <option value="editorial">Editorial</option>
              </select>
            </label>
            <label class="slider-label">
              Intensidad
              <input id="intensityRange" type="range" min="1" max="3" step="1" value="2" />
            </label>
          </div>

          <div class="toggle-row">
            <label>
              <input id="preserveCitations" type="checkbox" checked />
              Conservar citas, URLs y numeros
            </label>
            <label>
              <input id="keepFacts" type="checkbox" checked />
              No inventar datos ni ejemplos
            </label>
          </div>

          <div class="button-row">
            <button class="primary-button" type="button" id="rewriteButton">
              <i data-lucide="sparkles"></i>
              Reescribir
            </button>
            <button class="secondary-button" type="button" id="grammarButton">
              <i data-lucide="spell-check"></i>
              Revisar estilo
            </button>
          </div>
        </section>

        <section class="tool-pane output-pane">
          <div class="pane-head">
            <div>
              <p class="eyebrow">Resultado</p>
              <h2>Version editada</h2>
            </div>
            <div class="mini-actions">
              <button class="icon-button" type="button" id="copyOutput" aria-label="Copiar resultado" title="Copiar resultado">
                <i data-lucide="copy"></i>
              </button>
              <button class="icon-button" type="button" id="downloadOutput" aria-label="Descargar resultado" title="Descargar resultado">
                <i data-lucide="download"></i>
              </button>
            </div>
          </div>
          <div class="output-box" id="outputText" aria-live="polite">
            <span class="muted">El resultado aparecera aqui.</span>
          </div>
          <div class="analysis-strip" id="rewriteNotes"></div>
          <div class="suggestion-list" id="languageMatches"></div>
        </section>
      </div>
    </section>

    <section class="view-panel hidden" id="documentsView">
      <div class="document-layout">
        <section class="tool-pane document-pane">
          <div class="pane-head">
            <div>
              <p class="eyebrow">Archivos</p>
              <h2>Extraer y analizar documento</h2>
            </div>
            <button class="icon-button" type="button" id="clearDocument" aria-label="Limpiar documento" title="Limpiar documento">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
          <label class="drop-zone" id="dropZone">
            <input id="fileInput" type="file" accept=".txt,.md,.pdf,.docx,.rtf,.html,.csv,.json,.doc" />
            <i data-lucide="upload-cloud"></i>
            <strong>Arrastra un archivo o haz clic para elegirlo</strong>
            <span>PDF, DOCX, TXT, RTF, HTML, CSV, JSON. Los DOC antiguos pueden requerir conversion a DOCX.</span>
          </label>
          <div class="document-meta" id="documentMeta">No hay documento cargado.</div>
          <textarea id="documentText" spellcheck="false" placeholder="Tambien puedes pegar aqui texto extraido de cualquier documento."></textarea>
          <div class="button-row">
            <button class="primary-button" type="button" id="detectButton">
              <i data-lucide="radar"></i>
              Analizar IA
            </button>
            <button class="secondary-button" type="button" id="sendToRewrite">
              <i data-lucide="send"></i>
              Pasar al editor
            </button>
          </div>
        </section>

        <section class="tool-pane result-pane">
          <div class="pane-head">
            <div>
              <p class="eyebrow">Lectura critica</p>
              <h2>Resultado del analisis</h2>
            </div>
            <span class="status-pill" id="detectorProvider">Sin analisis</span>
          </div>
          <div class="detector-summary" id="detectorSummary">
            <div class="score-ring" style="--score: 0">
              <span>0%</span>
            </div>
            <div>
              <p class="verdict-title">Carga texto para empezar.</p>
              <p class="muted">Los detectores no prueban autoria. Sirven para revisar patrones y decidir si conviene editar, citar o pedir evidencia adicional.</p>
            </div>
          </div>
          <div class="metric-grid" id="metricGrid"></div>
          <div class="reason-list" id="reasonList"></div>
          <div class="sentence-panel" id="sentencePanel"></div>
        </section>
      </div>
    </section>

    <section class="view-panel hidden" id="promptsView">
      <div class="prompt-layout">
        <section class="tool-pane">
          <div class="pane-head">
            <div>
              <p class="eyebrow">Plantillas</p>
              <h2>Prompts responsables</h2>
            </div>
            <button class="icon-button" type="button" id="copyPrompt" aria-label="Copiar prompt" title="Copiar prompt">
              <i data-lucide="copy"></i>
            </button>
          </div>
          <div class="prompt-box" id="promptBox"></div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-prompt="editor">
              <i data-lucide="pen-line"></i>
              Editor
            </button>
            <button class="secondary-button" type="button" data-prompt="academic">
              <i data-lucide="graduation-cap"></i>
              Academico
            </button>
            <button class="secondary-button" type="button" data-prompt="verification">
              <i data-lucide="shield-check"></i>
              Verificacion
            </button>
          </div>
        </section>
        <aside class="tool-pane note-pane">
          <p class="eyebrow">Uso recomendado</p>
          <h2>Que hace esta pagina</h2>
          <p>Mejora claridad, naturalidad y coherencia sin prometer que un detector deje de marcar un texto. La autoria real se sostiene con fuentes, notas propias, trazabilidad y criterio editorial.</p>
          <p>Para deteccion externa puedes configurar Sapling en <code>.env</code>. Sin clave, la app usa un analisis local de patrones y muestra sus limites.</p>
        </aside>
      </div>
    </section>
  </main>
`;

createIcons({ icons });

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  views: {
    rewrite: document.querySelector("#rewriteView"),
    documents: document.querySelector("#documentsView"),
    prompts: document.querySelector("#promptsView"),
  },
  sourceText: document.querySelector("#sourceText"),
  outputText: document.querySelector("#outputText"),
  sourceStats: document.querySelector("#sourceStats"),
  rewriteNotes: document.querySelector("#rewriteNotes"),
  languageMatches: document.querySelector("#languageMatches"),
  modeSelect: document.querySelector("#modeSelect"),
  toneSelect: document.querySelector("#toneSelect"),
  intensityRange: document.querySelector("#intensityRange"),
  preserveCitations: document.querySelector("#preserveCitations"),
  keepFacts: document.querySelector("#keepFacts"),
  documentText: document.querySelector("#documentText"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  documentMeta: document.querySelector("#documentMeta"),
  detectorProvider: document.querySelector("#detectorProvider"),
  detectorSummary: document.querySelector("#detectorSummary"),
  metricGrid: document.querySelector("#metricGrid"),
  reasonList: document.querySelector("#reasonList"),
  sentencePanel: document.querySelector("#sentencePanel"),
  saplingStatus: document.querySelector("#saplingStatus"),
  promptBox: document.querySelector("#promptBox"),
};

wireEvents();
refreshPrompt("editor");
loadHealth();
updateStats();

function wireEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  elements.sourceText.addEventListener("input", (event) => {
    state.sourceText = event.target.value;
    updateStats();
  });
  elements.documentText.addEventListener("input", (event) => {
    state.extractedText = event.target.value;
    state.extractedFileName = state.extractedFileName || "Texto pegado";
    updateDocumentMeta();
  });

  elements.modeSelect.addEventListener("change", (event) => {
    state.settings.mode = event.target.value;
    refreshPrompt("editor");
  });
  elements.toneSelect.addEventListener("change", (event) => {
    state.settings.tone = event.target.value;
    refreshPrompt("editor");
  });
  elements.intensityRange.addEventListener("input", (event) => {
    state.settings.intensity = Number(event.target.value);
    refreshPrompt("editor");
  });
  elements.preserveCitations.addEventListener("change", (event) => {
    state.settings.preserveCitations = event.target.checked;
  });
  elements.keepFacts.addEventListener("change", (event) => {
    state.settings.keepFacts = event.target.checked;
  });

  document.querySelector("#rewriteButton").addEventListener("click", rewriteSourceText);
  document.querySelector("#grammarButton").addEventListener("click", checkGrammar);
  document.querySelector("#clearSource").addEventListener("click", clearSource);
  document.querySelector("#pasteExample").addEventListener("click", pasteExample);
  document.querySelector("#copyOutput").addEventListener("click", () => copyText(state.outputText));
  document.querySelector("#downloadOutput").addEventListener("click", downloadOutput);
  document.querySelector("#detectButton").addEventListener("click", detectDocumentText);
  document.querySelector("#sendToRewrite").addEventListener("click", sendDocumentToRewrite);
  document.querySelector("#clearDocument").addEventListener("click", clearDocument);
  document.querySelector("#copyPrompt").addEventListener("click", () => copyText(elements.promptBox.innerText));

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => refreshPrompt(button.dataset.prompt));
  });

  elements.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) readFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragging");
    });
  });

  elements.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) readFile(file);
  });
}

function switchView(view) {
  state.activeView = view;
  elements.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  Object.entries(elements.views).forEach(([key, section]) => {
    section.classList.toggle("hidden", key !== view);
  });
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    state.health = await response.json();
    elements.saplingStatus.textContent = state.health.saplingConfigured
      ? "Sapling: conectado"
      : "Sapling: sin key";
    elements.saplingStatus.classList.toggle("good", state.health.saplingConfigured);
  } catch {
    elements.saplingStatus.textContent = "API local: desconectada";
    elements.saplingStatus.classList.add("danger");
  }
}

function rewriteSourceText() {
  const text = elements.sourceText.value.trim();
  if (!text) {
    flash(elements.outputText, "Pega un texto para reescribirlo.");
    return;
  }

  const result = rewriteText(text, state.settings);
  state.outputText = result.text;
  elements.outputText.textContent = result.text;
  renderRewriteNotes(result);
  state.languageMatches = [];
  elements.languageMatches.innerHTML = "";
}

async function checkGrammar() {
  const text = (state.outputText || elements.sourceText.value).trim();
  if (!text) {
    flash(elements.languageMatches, "Primero agrega texto para revisar.");
    return;
  }

  elements.languageMatches.innerHTML = `<div class="loading-line">Consultando LanguageTool...</div>`;

  try {
    const response = await fetch("/api/language-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "auto" }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "No se pudo revisar el texto.");

    state.languageMatches = data.matches || [];
    renderLanguageMatches(text);
  } catch (error) {
    elements.languageMatches.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`;
  }
}

async function readFile(file) {
  state.extractedFileName = file.name;
  elements.documentMeta.textContent = `Leyendo ${file.name}...`;

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    let text = "";

    if (extension === "pdf") {
      text = await extractPdfText(file);
    } else if (extension === "docx") {
      text = await extractDocxText(file);
    } else if (extension === "doc") {
      throw new Error(
        "El formato DOC antiguo no se puede leer de forma fiable en el navegador. Convierte el archivo a DOCX, PDF o TXT.",
      );
    } else {
      text = await extractPlainText(file, extension);
    }

    state.extractedText = normalizeExtractedText(text);
    elements.documentText.value = state.extractedText;
    updateDocumentMeta(file);
  } catch (error) {
    state.extractedText = "";
    elements.documentText.value = "";
    elements.documentMeta.innerHTML = `<span class="danger-text">${escapeHtml(error.message)}</span>`;
  }
}

async function extractPdfText(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractPlainText(file, extension) {
  const raw = await file.text();

  if (extension === "rtf") {
    return raw
      .replace(/\\'[0-9a-fA-F]{2}/g, " ")
      .replace(/[{}]/g, " ")
      .replace(/\\[a-z]+\d* ?/gi, " ");
  }

  if (extension === "html" || extension === "htm") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    return doc.body?.innerText || raw;
  }

  if (extension === "json") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  return raw;
}

async function detectDocumentText() {
  const text = elements.documentText.value.trim();
  if (text.length < 80) {
    flash(elements.reasonList, "Agrega al menos 80 caracteres para analizar.");
    return;
  }

  elements.detectorProvider.textContent = "Analizando";
  elements.detectorSummary.classList.add("loading");

  try {
    const response = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();

    if (!response.ok && response.status !== 207) {
      throw new Error(data.error || "No pude analizar el texto.");
    }

    state.detection = data;
    renderDetection(data);
  } catch (error) {
    elements.reasonList.innerHTML = `<div class="notice danger">${escapeHtml(error.message)}</div>`;
  } finally {
    elements.detectorSummary.classList.remove("loading");
  }
}

function sendDocumentToRewrite() {
  const text = elements.documentText.value.trim();
  if (!text) {
    flash(elements.documentMeta, "Primero carga o pega un documento.");
    return;
  }
  elements.sourceText.value = text;
  state.sourceText = text;
  updateStats();
  switchView("rewrite");
}

function renderDetection(data) {
  const percent = Math.round((data.score || 0) * 100);
  const label = detectionLabel(data.verdict);
  elements.detectorProvider.textContent =
    data.provider === "sapling" ? "Sapling API" : "Analisis local";
  elements.detectorProvider.classList.toggle("good", data.provider === "sapling");

  elements.detectorSummary.innerHTML = `
    <div class="score-ring" style="--score: ${percent}">
      <span>${percent}%</span>
    </div>
    <div>
      <p class="verdict-title">${label}</p>
      <p class="muted">${escapeHtml(data.caveat || data.warning || "Resultado orientativo.")}</p>
    </div>
  `;

  const metrics = data.metrics || {};
  elements.metricGrid.innerHTML = [
    ["Palabras", metrics.wordCount],
    ["Oraciones", metrics.sentenceCount],
    ["Promedio/oracion", metrics.avgSentenceLength],
    ["Diversidad lexica", metrics.lexicalDiversity],
    ["Varianza", metrics.sentenceVariance],
    ["Frases genericas", metrics.aiPhraseHits],
  ]
    .map(([labelText, value]) => `<div class="metric"><span>${labelText}</span><strong>${value ?? "-"}</strong></div>`)
    .join("");

  elements.reasonList.innerHTML = `
    ${(data.warning ? `<div class="notice">${escapeHtml(data.warning)}</div>` : "")}
    ${(data.reasons || [])
      .map((reason) => `<div class="reason-item"><i data-lucide="alert-circle"></i><span>${escapeHtml(reason)}</span></div>`)
      .join("")}
  `;

  elements.sentencePanel.innerHTML = `
    <h3>Oraciones marcadas</h3>
    <div class="sentence-list">
      ${(data.sentences || [])
        .slice(0, 18)
        .map((sentence) => {
          const score = Math.round((sentence.score || 0) * 100);
          return `
            <article class="sentence-row">
              <span class="sentence-score" style="--heat: ${score}">${score}%</span>
              <p>${escapeHtml(sentence.text)}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
  createIcons({ icons });
}

function renderRewriteNotes(result) {
  elements.rewriteNotes.innerHTML = `
    <div class="note-chip">${result.metrics.beforeWords} -> ${result.metrics.afterWords} palabras</div>
    <div class="note-chip">${result.metrics.sentenceCount} oraciones revisadas</div>
    <div class="note-chip">${result.changes.length} ajustes aplicados</div>
  `;

  if (result.changes.length) {
    elements.rewriteNotes.innerHTML += `
      <details class="change-details">
        <summary>Ver cambios principales</summary>
        <ul>
          ${result.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}
        </ul>
      </details>
    `;
  }
}

function renderLanguageMatches(baseText) {
  if (!state.languageMatches.length) {
    elements.languageMatches.innerHTML = `<div class="notice good">LanguageTool no encontro correcciones relevantes.</div>`;
    return;
  }

  const corrected = applyMatches(baseText, state.languageMatches);

  elements.languageMatches.innerHTML = `
    <div class="grammar-head">
      <strong>${state.languageMatches.length} sugerencias de estilo y gramatica</strong>
      <button class="ghost-button" type="button" id="applyGrammar">
        <i data-lucide="check"></i>
        Aplicar sugerencias
      </button>
    </div>
    ${state.languageMatches
      .slice(0, 12)
      .map((match) => {
        const replacement = match.replacements?.[0]?.value || "Sin reemplazo automatico";
        return `
          <article class="suggestion-item">
            <div>
              <strong>${escapeHtml(match.shortMessage || match.rule?.category || "Sugerencia")}</strong>
              <p>${escapeHtml(match.message)}</p>
            </div>
            <span>${escapeHtml(replacement)}</span>
          </article>
        `;
      })
      .join("")}
  `;

  document.querySelector("#applyGrammar").addEventListener("click", () => {
    state.outputText = corrected;
    elements.outputText.textContent = corrected;
  });
  createIcons({ icons });
}

function rewriteText(text, settings) {
  const protectedText = settings.preserveCitations ? protectSensitiveFragments(text) : { text, fragments: [] };
  const paragraphs = protectedText.text.split(/\n{2,}/).map((paragraph) => paragraph.trim());
  const changes = [];
  const output = paragraphs
    .map((paragraph) => rewriteParagraph(paragraph, settings, changes))
    .join("\n\n");
  const restored = restoreSensitiveFragments(output, protectedText.fragments);
  const beforeWords = countWords(text);
  const afterWords = countWords(restored);

  return {
    text: restored,
    changes: [...new Set(changes)].slice(0, 12),
    metrics: {
      beforeWords,
      afterWords,
      sentenceCount: splitSentences(restored).length,
    },
  };
}

function rewriteParagraph(paragraph, settings, changes) {
  let current = paragraph.replace(/\s+/g, " ").trim();
  if (!current) return current;

  current = replacePhrases(current, settings, changes);
  current = trimFiller(current, changes);

  if (settings.intensity >= 2) {
    current = splitLongSentences(current, changes);
  }

  if (settings.mode === "clarity") {
    current = simplifyConnectors(current, changes);
  }

  if (settings.mode === "academic") {
    current = academicPolish(current, changes);
  }

  if (settings.tone === "cercano") {
    current = softenFormalTone(current, changes);
  }

  if (settings.tone === "editorial") {
    current = sharpenVoice(current, changes);
  }

  return ensureCapitalization(current);
}

function replacePhrases(text, settings, changes) {
  const replacements = [
    [/En el mundo actual,?\s*/gi, "Hoy, "],
    [/Es importante destacar que\s*/gi, "Conviene señalar que "],
    [/Cabe destacar que\s*/gi, "Vale la pena señalar que "],
    [/En este sentido,?\s*/gi, "Desde esa perspectiva, "],
    [/Por otro lado,?\s*/gi, "A su vez, "],
    [/Sin embargo,?\s*/gi, settings.tone === "cercano" ? "Aun así, " : "Sin embargo, "],
    [/No obstante,?\s*/gi, "Con todo, "],
    [/Por lo tanto,?\s*/gi, settings.tone === "formal" ? "Por tanto, " : "Así que, "],
    [/En conclusión,?\s*/gi, "Para cerrar, "],
    [/En resumen,?\s*/gi, "En síntesis, "],
    [/juega un papel fundamental/gi, "cumple una función importante"],
    [/desempena un papel crucial/gi, "resulta clave"],
    [/desempeña un papel crucial/gi, "resulta clave"],
    [/una amplia gama de/gi, "varios"],
    [/un amplio abanico de/gi, "varios"],
    [/amplia gama de/gi, "diversos"],
    [/de manera eficiente/gi, "con eficiencia"],
    [/de forma significativa/gi, "de manera notable"],
  ];

  let updated = text;
  replacements.forEach(([pattern, replacement]) => {
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, replacement);
      changes.push("Se reemplazaron frases genericas por expresiones mas concretas.");
    }
  });
  return updated;
}

function trimFiller(text, changes) {
  const before = text;
  const updated = text
    .replace(/\brealmente\b/gi, "")
    .replace(/\bmuy importante\b/gi, "importante")
    .replace(/\ben gran medida\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (before !== updated) {
    changes.push("Se redujeron muletillas para hacer el texto mas directo.");
  }

  return updated;
}

function splitLongSentences(text, changes) {
  const sentences = splitSentences(text);
  let changed = false;

  const updated = sentences.map((sentence) => {
    const words = countWords(sentence);
    if (words < 34) return sentence;

    const splitPoint = findSplitPoint(sentence);
    if (!splitPoint) return sentence;

    changed = true;
    const first = sentence.slice(0, splitPoint).replace(/,\s*$/, "").trim();
    const second = sentence.slice(splitPoint).replace(/^(y|pero|porque|aunque|ya que|lo que)\s+/i, "").trim();
    return `${first}. ${capitalize(second)}`;
  });

  if (changed) {
    changes.push("Se dividieron oraciones largas para mejorar ritmo y lectura.");
  }

  return updated.join(" ");
}

function findSplitPoint(sentence) {
  const candidates = [", porque ", ", aunque ", ", ya que ", ", lo que ", "; ", ", pero ", ", y "];
  const midpoint = sentence.length / 2;
  let best = null;

  candidates.forEach((candidate) => {
    const index = sentence.indexOf(candidate);
    if (index > 80 && index < sentence.length - 60) {
      const distance = Math.abs(index - midpoint);
      if (!best || distance < best.distance) {
        best = { index: index + candidate.length, distance };
      }
    }
  });

  return best?.index || null;
}

function simplifyConnectors(text, changes) {
  const before = text;
  const updated = text
    .replace(/Con el objetivo de/gi, "Para")
    .replace(/debido a que/gi, "porque")
    .replace(/con el fin de/gi, "para")
    .replace(/a traves de/gi, "mediante")
    .replace(/en relacion con/gi, "sobre");

  if (before !== updated) {
    changes.push("Se simplificaron conectores y giros pesados.");
  }

  return updated;
}

function academicPolish(text, changes) {
  const before = text;
  const updated = text
    .replace(/\bcreo que\b/gi, "se puede sostener que")
    .replace(/\bpienso que\b/gi, "se plantea que")
    .replace(/\bcosas\b/gi, "aspectos")
    .replace(/\bbueno\b/gi, "adecuado");

  if (before !== updated) {
    changes.push("Se ajusto el registro para un tono academico.");
  }

  return updated;
}

function softenFormalTone(text, changes) {
  const before = text;
  const updated = text
    .replace(/resulta necesario/gi, "hace falta")
    .replace(/permite evidenciar/gi, "muestra")
    .replace(/se puede observar que/gi, "se ve que");

  if (before !== updated) {
    changes.push("Se suavizo el tono para que suene mas cercano.");
  }

  return updated;
}

function sharpenVoice(text, changes) {
  const before = text;
  const updated = text
    .replace(/puede ser considerado como/gi, "es")
    .replace(/tiene la capacidad de/gi, "puede")
    .replace(/llevar a cabo/gi, "hacer");

  if (before !== updated) {
    changes.push("Se fortalecieron frases debiles o demasiado indirectas.");
  }

  return updated;
}

function protectSensitiveFragments(text) {
  const fragments = [];
  const pattern =
    /(https?:\/\/\S+|\[[^\]]+\]|\([A-ZÁÉÍÓÚÑ][^)]+,\s*\d{4}[^)]*\)|\b\d+(?:[.,]\d+)?%?\b)/g;

  return {
    text: text.replace(pattern, (match) => {
      const token = `__KEEP_${fragments.length}__`;
      fragments.push([token, match]);
      return token;
    }),
    fragments,
  };
}

function restoreSensitiveFragments(text, fragments) {
  return fragments.reduce((current, [token, value]) => current.replaceAll(token, value), text);
}

function applyMatches(text, matches) {
  return [...matches]
    .filter((match) => match.replacements?.[0]?.value)
    .sort((a, b) => b.offset - a.offset)
    .reduce((current, match) => {
      const replacement = match.replacements[0].value;
      return current.slice(0, match.offset) + replacement + current.slice(match.offset + match.length);
    }, text);
}

function refreshPrompt(kind) {
  const prompts = {
    editor: `Actua como editor de estilo. Reescribe el texto para que sea claro, natural y coherente, conservando el sentido original. No inventes datos, ejemplos, citas ni experiencias personales. Mantén nombres propios, cifras, referencias y enlaces. Explica al final en 4 viñetas que cambios hiciste y por que.\n\nModo deseado: ${state.settings.mode}. Tono: ${state.settings.tone}.\n\nTexto:\n[pega aqui el texto]`,
    academic: `Actua como editor academico. Mejora cohesion, precision conceptual y fluidez del texto. Conserva las citas y no agregues bibliografia falsa. Si una afirmacion necesita fuente, marcala como [requiere fuente] en lugar de inventarla. Evita frases genericas y prioriza argumentos verificables.\n\nTexto:\n[pega aqui el texto]`,
    verification: `Actua como revisor critico. Lee el texto y entrega: 1) afirmaciones que requieren evidencia, 2) partes ambiguas, 3) posibles problemas de autoria o dependencia excesiva de IA, 4) sugerencias para que el autor aporte notas, fuentes o ejemplos reales. No reescribas para ocultar autoria.\n\nTexto:\n[pega aqui el texto]`,
  };

  elements.promptBox.textContent = prompts[kind] || prompts.editor;
}

function pasteExample() {
  const example =
    "En el mundo actual, la educación desempeña un papel crucial en el desarrollo de las sociedades, ya que permite que las personas adquieran habilidades y conocimientos para enfrentar una amplia gama de desafíos. Es importante destacar que la tecnología también ha transformado la manera en que los estudiantes aprenden y los docentes enseñan.";
  elements.sourceText.value = example;
  state.sourceText = example;
  updateStats();
}

function clearSource() {
  elements.sourceText.value = "";
  state.sourceText = "";
  state.outputText = "";
  elements.outputText.innerHTML = `<span class="muted">El resultado aparecera aqui.</span>`;
  elements.rewriteNotes.innerHTML = "";
  elements.languageMatches.innerHTML = "";
  updateStats();
}

function clearDocument() {
  state.extractedText = "";
  state.extractedFileName = "";
  state.detection = null;
  elements.documentText.value = "";
  elements.fileInput.value = "";
  elements.documentMeta.textContent = "No hay documento cargado.";
  elements.detectorProvider.textContent = "Sin analisis";
  elements.detectorSummary.innerHTML = `
    <div class="score-ring" style="--score: 0"><span>0%</span></div>
    <div>
      <p class="verdict-title">Carga texto para empezar.</p>
      <p class="muted">Los detectores no prueban autoria. Sirven para revisar patrones y decidir si conviene editar, citar o pedir evidencia adicional.</p>
    </div>
  `;
  elements.metricGrid.innerHTML = "";
  elements.reasonList.innerHTML = "";
  elements.sentencePanel.innerHTML = "";
}

function downloadOutput() {
  if (!state.outputText) return;
  const blob = new Blob([state.outputText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "texto-editado.txt";
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function updateStats() {
  elements.sourceStats.textContent = `${countWords(elements.sourceText.value)} palabras`;
}

function updateDocumentMeta(file) {
  const words = countWords(elements.documentText.value);
  const size = file ? `, ${formatBytes(file.size)}` : "";
  elements.documentMeta.textContent = `${state.extractedFileName || "Texto pegado"}: ${words} palabras${size}`;
}

function normalizeExtractedText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectionLabel(verdict) {
  const labels = {
    alto: "Indicio alto de patrones asociados a IA",
    medio: "Indicio medio de patrones asociados a IA",
    "bajo-medio": "Indicio bajo a medio",
    bajo: "Indicio bajo",
  };
  return labels[verdict] || "Resultado orientativo";
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9¿¡])/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text) {
  return String(text || "").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)?/gu)?.length || 0;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function ensureCapitalization(text) {
  return text
    .replace(/(^|[.!?]\s+)([a-záéíóúñ])/g, (_, prefix, letter) => prefix + letter.toUpperCase())
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function flash(element, message) {
  element.innerHTML = `<div class="notice">${escapeHtml(message)}</div>`;
}
