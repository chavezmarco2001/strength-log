# Strength Log

Registro personal de entrenamientos de fuerza. Es una PWA: una página web que se instala en Android como una app y funciona sin internet. No tiene servidor, cuentas ni publicidad. Los datos quedan solo en el celular (IndexedDB).

## Instalarla en el celular (Android + Chrome)

1. Abre la dirección de la app en **Chrome** (por ejemplo `https://chavezmarco2001.github.io/strength-log/`).
2. Toca el menú **⋮** → **Instalar app** (o **Agregar a la pantalla principal**).
3. Ábrela desde su ícono. Desde ahí funciona sin internet.
4. En la app: **Más › Idioma** para cambiar a Español.

> Usa siempre la app instalada (o el mismo Chrome). Cada navegador guarda sus datos por separado.

## Respaldos (importante)

Los datos viven **solo en tu celular**. Si borras los datos de Chrome, desinstalas Chrome o pierdes el teléfono, se pierden.

- **Más › Guardar respaldo (JSON)**: guarda un archivo en *Descargas*. Contiene todo: series, ejercicios, rutinas, preguntas post-sesión y ajustes.
- **Más › Compartir respaldo…**: envía el archivo a Google Drive, correo, etc. Así queda una copia **fuera** del celular. Es la opción recomendada.
- **Más › Restaurar desde respaldo…**: reemplaza todos los datos por los del archivo.
- **CSV de series / CSV de preguntas**: para abrir en Excel o Sheets. El CSV de series usa las mismas columnas que FitNotes y se puede volver a importar.
- Si pasan 7 días sin respaldo, la pantalla de entrenamiento muestra un aviso (con ✕ se pospone 1 día).

## Importar desde FitNotes

1. En FitNotes, exporta tu historial como CSV (Ajustes › exportar hoja de cálculo).
2. Pasa el archivo al celular donde está la app.
3. En la app: **Más › Importar CSV de FitNotes…**
4. Lee el resumen y confirma. Al final aparece un informe con:
   - las filas que no se pudieron leer (número de línea y motivo),
   - los nombres que se unieron porque eran el mismo con distinta escritura,
   - los ejercicios que se unieron a la biblioteca y los que se crearon.

Importar el mismo archivo dos veces no duplica series.

## Cómo seguir editándola (con Claude)

Abre una sesión de Claude Code en la carpeta del proyecto y pide el cambio. Por ejemplo: *"agrega un campo de RPE a cada serie"*. El archivo `CLAUDE.md` le explica a Claude cómo está organizado el código y qué revisar antes de publicar.

Para publicar una versión nueva:
1. Sube el número `VERSION` en `sw.js`. Sin esto, los celulares siguen usando la copia guardada.
2. Haz commit y push a GitHub. Pages se actualiza en 1–2 minutos.
3. En el celular, abre la app: aparece "Hay una versión nueva lista" → **Recargar**.

Para probarla en el computador:

```bash
node tools/serve.js
```

Luego abre http://localhost:5173. Para correr las pruebas:

```bash
node --test "tests/*.test.js"
```
