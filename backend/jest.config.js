/**
 * Jest para el Backend de FastExpress (Google Apps Script).
 *
 * Los archivos de src/ son idénticos a los de Apps Script, que no usa módulos.
 * Para probarlos SIN modificarlos, el transformador `cargadorAppsScript` les
 * añade un `module.exports` al final solo durante las pruebas (no cambia los
 * números de línea, así que el reporte de cobertura apunta a las líneas reales).
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/globalesAppsScript.js'],
  transform: {
    '[\\\\/]src[\\\\/].*\\.js$':'<rootDir>/tests/helpers/cargadorAppsScript.js',
  },
  collectCoverageFrom: ['src/Codigo.js'],
  coverageDirectory: '<rootDir>/../pruebas/cobertura/reporte',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // Mínimo exigido por el enunciado: 85 % de líneas y de ramas.
  coverageThreshold: { global: { lines: 85, branches: 85 } },
};
