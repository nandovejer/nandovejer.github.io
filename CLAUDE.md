# Reglas del repo

## Voz del Cassette: revisar los audios al cambiar textos

Cada vez que cambies la descripción de un proyecto (`data/projects.json`), la bio u otros textos que lee la cinta (`data/site.json`: `bio`, `kicker`, `deck`, `socials`) o las etiquetas de la carátula (`data/archivo.json` → `cassette`):

1. Ejecuta `node build.mjs`. Solo regenera los audios cuyo texto ha cambiado (cada clip se llama por el hash de lo que dice) y borra los que ya no usa nada; los demás no se tocan. No regeneres audios a mano ni subas `VERSION` en `src/speech.mjs` salvo que cambie cómo suena la voz.
2. Comprueba con `node build.mjs --check` que páginas y audios están al día (es lo mismo que hace el hook `pre-commit`).
3. Si el texto nuevo trae palabras que la voz puede leer mal (inglés en `es`, nombres españoles en `en`, siglas), revisa lo que dirá con `node build.mjs --no-audio --say` y añade la pronunciación en `data/pronounce.json` antes de generar.
4. Commitea juntos los textos, las páginas y los cambios en `assets/audio/` (altas y bajas).

Si el build dice que la voz no está instalada, ejecuta `tools/voice-setup.sh` (Piper y las voces en `~/.cache/tts`).
