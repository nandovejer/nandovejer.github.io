# Nando Muñoz · portafolio

Sitio estático: `node build.mjs` genera las páginas (`index.html` —el cassette en español—, `cassette/`, `disquetes/`, `vhs/`, `es/` y `en/`), las de cada proyecto y los ficheros para buscadores a partir de `data/site.json`, `data/projects.json` y `data/archivo.json`. GitHub Pages sirve `main` tal cual.

## SEO

- **Páginas por proyecto:** cada proyecto tiene la suya, `/proyectos/<id>/` en español y `/projects/<id>/` en inglés (el cassette solo lo muestra con un hash, que los buscadores no indexan). Título, descripción, canonical, pareja es/en y JSON-LD salen de `data/projects.json`; no se edita el HTML.
- **Para los buscadores:** `robots.txt`, `sitemap.xml` (con los alternates es/en) y `404.html` los escribe el build.
- **Tarjetas para redes** (Open Graph y Twitter): `node tools/og-images.mjs` dibuja una imagen de 1200 × 630 por página y idioma en `assets/og/` (necesita Chromium e ImageMagick, tarda unos minutos). No forma parte del build: se repite si cambian el nombre, los títulos o el diseño, y se commitean los JPG.
- **Search Console y Bing:** pega el contenido de la meta de verificación en `verification` de `data/site.json`; el build escribe las etiquetas cuando no están vacías.

## La voz del Cassette

En la versión Cassette una voz lee cada cinta: un audio para la cabecera (título, línea, cita) y uno por pista, en `assets/audio/<idioma>/`. Los genera el build con [Piper](https://github.com/OHF-Voice/piper1-gpl) y las voces [davefx](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/davefx/medium) (español de España) y [joe](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/joe/medium) (inglés), ambas CC0.

- **Instalar la voz** (una vez por máquina, en `~/.cache/tts`): `tools/voice-setup.sh`
- **Activar el hook** (una vez por clon): `git config core.hooksPath .githooks`

Cada audio se llama por el hash de lo que dice, la voz y sus ajustes. Al cambiar un texto, `node build.mjs` genera solo los audios nuevos y borra los que ya no se usan.

| Comando | Qué hace |
|---|---|
| `node build.mjs` | Páginas y audios que falten |
| `node build.mjs --check` | No cambia nada; falla si una página o un audio no está al día (hook `pre-commit` y CI) |
| `node build.mjs --no-audio` | Solo páginas (el check fallará hasta generar los audios) |
| `node build.mjs --no-audio --say` | Muestra lo que dirá cada audio |

Pronunciación de palabras que la voz lee mal: `data/pronounce.json`. Voces, ritmo y pausas: `src/speech.mjs`.
