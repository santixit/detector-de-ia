# Autor Claro

Herramienta web local para reescritura responsable, revision de estilo y analisis orientativo de documentos.

## Funciones

- Reescritura local para mejorar claridad, ritmo y tono sin inventar datos.
- Plantillas de prompts responsables para edicion, revision academica y verificacion.
- Extraccion de texto desde PDF, DOCX, TXT, RTF, HTML, CSV y JSON.
- Analisis de patrones asociados a IA con Sapling si configuras `SAPLING_API_KEY`.
- Analisis local de respaldo cuando no hay clave externa.
- Revision de gramatica y estilo con la API publica de LanguageTool.

## Configuracion

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Opcional: copia `.env.example` a `.env` y agrega tu clave de Sapling.

   ```bash
   SAPLING_API_KEY=tu_clave
   PORT=8787
   ```

3. Inicia la app:

   ```bash
   npm run dev
   ```

La interfaz abre en `http://127.0.0.1:5173`.

## Nota de uso

Los detectores de IA pueden equivocarse. Esta app no promete ocultar autoria ni evadir detectores; esta pensada para mejorar textos, revisar fuentes y apoyar decisiones editoriales.

## APIs y librerias usadas

- Sapling AI Detector: `https://sapling.ai/docs/api/detector/`
- LanguageTool HTTP API: `https://dev.languagetool.org/public-http-api.html`
- PDF.js: `https://mozilla.github.io/pdf.js/api/`
- Mammoth DOCX parser: `https://www.npmjs.com/package/mammoth`
