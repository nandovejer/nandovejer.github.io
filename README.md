# Nando Muñoz · portafolio

Sitio estático: `node build.mjs` genera `es/`, `en/`, `vhs/` y `cassette/` a partir de `data/site.json`, `data/projects.json` y `data/archivo.json`. GitHub Pages sirve `main` tal cual.

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
