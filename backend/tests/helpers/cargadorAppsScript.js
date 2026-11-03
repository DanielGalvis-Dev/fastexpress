/**
 * Transformador de Jest: expone al final del archivo todas las funciones y
 * constantes de nivel superior, para poder probarlas desde un test.
 * El archivo en disco no se modifica; la línea añadida va después de la última.
 */
module.exports = {
  process(codigo) {
    const nombres = new Set();
    for (const m of codigo.matchAll(/^(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=)/gm)) {
      nombres.add(m[1] || m[2]);
    }
    const lista = [...nombres].map((n) => `${n}: ${n}`).join(', ');
    return { code: `${codigo}\n;module.exports = { ${lista} };\n` };
  },
};
