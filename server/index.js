import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    saplingConfigured: Boolean(process.env.SAPLING_API_KEY),
    languageToolAvailable: true,
  });
});

app.post("/api/detect", async (req, res) => {
  const text = sanitizeText(req.body?.text);

  if (!text || text.length < 80) {
    return res.status(400).json({
      error: "Necesito al menos 80 caracteres para un analisis minimamente util.",
    });
  }

  if (process.env.SAPLING_API_KEY) {
    try {
      const result = await runSaplingDetection(text);
      return res.json({
        provider: "sapling",
        mode: "external",
        caveat:
          "Resultado orientativo. Los detectores de IA pueden tener falsos positivos y falsos negativos.",
        ...result,
      });
    } catch (error) {
      const fallback = runLocalDetection(text);
      return res.status(207).json({
        provider: "local",
        mode: "fallback",
        warning:
          "Sapling no respondio correctamente; se uso el analisis local de respaldo.",
        externalError: error.message,
        ...fallback,
      });
    }
  }

  res.json({
    provider: "local",
    mode: "fallback",
    warning:
      "No hay SAPLING_API_KEY configurada. Este resultado usa senales heuristicas locales.",
    ...runLocalDetection(text),
  });
});

app.post("/api/language-check", async (req, res) => {
  const text = sanitizeText(req.body?.text);
  const language = String(req.body?.language || "auto");

  if (!text || text.length < 20) {
    return res.status(400).json({
      error: "Agrega mas texto para revisar gramatica y estilo.",
    });
  }

  try {
    const body = new URLSearchParams({
      text: text.slice(0, 20000),
      language,
    });

    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "AutorClaro/0.1",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`LanguageTool respondio ${response.status}`);
    }

    const data = await response.json();
    res.json({
      provider: "languagetool",
      matches: (data.matches || []).slice(0, 40).map((match) => ({
        message: match.message,
        shortMessage: match.shortMessage,
        offset: match.offset,
        length: match.length,
        replacements: (match.replacements || []).slice(0, 5),
        context: match.context,
        rule: {
          id: match.rule?.id,
          category: match.rule?.category?.name,
        },
      })),
    });
  } catch (error) {
    res.status(502).json({
      error: "No pude consultar LanguageTool en este momento.",
      details: error.message,
    });
  }
});

async function runSaplingDetection(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.sapling.ai/api/v1/aidetect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.SAPLING_API_KEY,
        text: text.slice(0, 200000),
        sent_scores: true,
        score_string: false,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.msg || `Sapling respondio ${response.status}`);
    }

    const score = clamp01(Number(data.score || 0));

    return {
      score,
      verdict: verdictFromScore(score),
      metrics: summarizeText(text),
      reasons: [
        "Sapling calcula una probabilidad general y puntuaciones por oracion.",
        "Usa este resultado como senal de revision, no como prueba definitiva.",
      ],
      sentences: (data.sentence_scores || []).map((item) => ({
        text: item.sentence,
        score: clamp01(Number(item.score || 0)),
        verdict: verdictFromScore(clamp01(Number(item.score || 0))),
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runLocalDetection(text) {
  const sentences = splitSentences(text);
  const words = tokenizeWords(text);
  const metrics = summarizeText(text, sentences, words);
  const reasons = [];
  let score = 0.18;

  if (metrics.lexicalDiversity < 0.38 && metrics.wordCount > 120) {
    score += 0.16;
    reasons.push("El vocabulario se repite mas de lo habitual para la longitud del texto.");
  }

  if (metrics.sentenceVariance < 28 && metrics.sentenceCount >= 6) {
    score += 0.2;
    reasons.push("Las oraciones tienen longitudes muy parecidas entre si.");
  }

  if (metrics.aiPhraseHits >= 3) {
    score += 0.18;
    reasons.push("Aparecen varias frases genericas frecuentes en respuestas de IA.");
  }

  if (metrics.transitionDensity > 0.08) {
    score += 0.1;
    reasons.push("Hay una densidad alta de conectores formales y transiciones previsibles.");
  }

  if (metrics.punctuationVariety <= 2 && metrics.sentenceCount >= 7) {
    score += 0.08;
    reasons.push("La puntuacion es poco variada en relacion con el numero de oraciones.");
  }

  if (metrics.avgSentenceLength > 28) {
    score += 0.08;
    reasons.push("La longitud media de las oraciones es alta.");
  }

  score = clamp01(score);

  if (!reasons.length) {
    reasons.push("No se encontraron senales fuertes; aun asi, el resultado no es concluyente.");
  }

  return {
    score,
    verdict: verdictFromScore(score),
    caveat:
      "Analisis local orientativo basado en patrones de estilo. No identifica autoria real.",
    metrics,
    reasons,
    sentences: sentences.map((sentence) => {
      const localScore = scoreSentence(sentence, metrics);
      return {
        text: sentence,
        score: localScore,
        verdict: verdictFromScore(localScore),
      };
    }),
  };
}

function scoreSentence(sentence, metrics) {
  const words = tokenizeWords(sentence);
  const lower = sentence.toLowerCase();
  let score = 0.2;

  if (words.length > metrics.avgSentenceLength * 1.35) score += 0.16;
  if (words.length > 34) score += 0.12;
  if (AI_PHRASES.some((phrase) => lower.includes(phrase))) score += 0.22;
  if (TRANSITIONS.some((phrase) => lower.startsWith(phrase))) score += 0.1;
  if (new Set(words.map((word) => word.toLowerCase())).size / Math.max(words.length, 1) < 0.58) {
    score += 0.08;
  }

  return clamp01(score);
}

function summarizeText(text, givenSentences, givenWords) {
  const sentences = givenSentences || splitSentences(text);
  const words = givenWords || tokenizeWords(text);
  const lengths = sentences.map((sentence) => tokenizeWords(sentence).length).filter(Boolean);
  const avgSentenceLength = lengths.length
    ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length
    : 0;
  const variance = lengths.length
    ? lengths.reduce((sum, value) => sum + (value - avgSentenceLength) ** 2, 0) / lengths.length
    : 0;
  const lower = text.toLowerCase();
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  const transitionHits = TRANSITIONS.reduce(
    (sum, phrase) => sum + countOccurrences(lower, phrase),
    0,
  );
  const aiPhraseHits = AI_PHRASES.reduce(
    (sum, phrase) => sum + countOccurrences(lower, phrase),
    0,
  );
  const punctuation = new Set((text.match(/[;:!?()"]/g) || []).map(String));

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: round(avgSentenceLength),
    sentenceVariance: round(variance),
    lexicalDiversity: round(uniqueWords.size / Math.max(words.length, 1), 3),
    transitionDensity: round(transitionHits / Math.max(sentences.length, 1), 3),
    aiPhraseHits,
    punctuationVariety: punctuation.size,
  };
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9¿¡])/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenizeWords(text) {
  return String(text || "").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)?/gu) || [];
}

function countOccurrences(text, phrase) {
  if (!phrase) return 0;
  return text.split(phrase).length - 1;
}

function verdictFromScore(score) {
  if (score >= 0.78) return "alto";
  if (score >= 0.56) return "medio";
  if (score >= 0.36) return "bajo-medio";
  return "bajo";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

const TRANSITIONS = [
  "ademas",
  "además",
  "por otro lado",
  "sin embargo",
  "no obstante",
  "por lo tanto",
  "en consecuencia",
  "en conclusion",
  "en conclusión",
  "en resumen",
  "cabe destacar",
  "es importante destacar",
  "en este sentido",
  "a continuacion",
  "a continuación",
];

const AI_PHRASES = [
  "en el mundo actual",
  "es importante destacar que",
  "cabe destacar que",
  "en este sentido",
  "en conclusion",
  "en conclusión",
  "en resumen",
  "en ultima instancia",
  "en última instancia",
  "juega un papel fundamental",
  "desempena un papel crucial",
  "desempeña un papel crucial",
  "es crucial para",
  "resulta fundamental",
  "amplia gama",
  "de manera eficiente",
  "de forma significativa",
];

app.listen(port, () => {
  console.log(`Autor Claro API escuchando en http://127.0.0.1:${port}`);
});
