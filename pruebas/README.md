# Pruebas — FastExpress

Documentos y evidencias de QA que alimentan el informe técnico (`docs/informe-tecnico/`).
El código de las pruebas automatizadas vive junto a cada stack:

| Qué | Dónde |
|---|---|
| Pruebas unitarias del Frontend (Vitest) | `frontend/src/**/*.test.ts(x)` |
| Pruebas unitarias y de API del Backend | `backend/tests/` |
| Matriz y diseño de caja negra | `pruebas/caja-negra/` |
| CFG, V(G) y caminos de caja blanca | `pruebas/caja-blanca/` |
| Pruebas Frontend ↔ API | `pruebas/integracion/` |
| Reporte de cobertura (mínimo 85 % líneas y ramas) | `pruebas/cobertura/` |
