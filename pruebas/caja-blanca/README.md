# Caja blanca (QA + Backend)

Análisis de la sección 2 del informe (`docs/informe-tecnico/02-caja-blanca.md`), sobre la función core `calcularTarifa`:

- `cfg/CFG_calcularTarifa.png` — grafo de flujo de control (19 nodos, 27 aristas).
- `cfg/calcularTarifa.mmd` — fuente editable (Mermaid).
- Complejidad ciclomática: **V(G) = 10**, calculada por tres métodos.
- 10 caminos independientes, cada uno con su caso de prueba: `backend/tests/unitarias/calcularTarifa.caminos.test.js`.

Para regenerar la imagen desde la fuente (necesita Chrome o Edge instalado):
`npx @mermaid-js/mermaid-cli -i calcularTarifa.mmd -o CFG_calcularTarifa.png -s 2 -b white`
