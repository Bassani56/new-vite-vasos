// utils/slug.js
function gerarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")                // remove acentos
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")     // substitui tudo por "-"
    .replace(/^-+|-+$/g, "");         // remove traços sobrando
}

module.exports = gerarSlug;
