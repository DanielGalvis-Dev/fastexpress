/** Convierte la salida de responderJSON() (ContentService) en un objeto. */
const leer = (salida) => JSON.parse(salida.getContent());

/** Respuesta simulada de UrlFetchApp.fetch. */
const respuestaHttp = (codigo, cuerpo) => ({
  getResponseCode: () => codigo,
  getContentText: () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
});

/** Respuesta 200 de Gemini con un candidato que trae `texto`. */
const gemini200 = (texto, extra = {}) =>
  respuestaHttp(200, { candidates: [{ content: { parts: [{ text: texto }] }, ...extra }] });

module.exports = { leer, respuestaHttp, gemini200 };
