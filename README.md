# Instagram Follow Checker

Herramienta web para descubrir quién no te sigue de vuelta en Instagram, comparando los archivos HTML de tu descarga de datos.

**Fórmula:** personas que sigues − personas que te siguen = personas que no te siguen de vuelta.

## Privacidad

- Todo se procesa **en el navegador**. Los archivos no se suben a ningún servidor.
- No se guardan nombres de usuario ni datos personales (sin cookies, localStorage ni analíticas).
- No hay peticiones de red: solo HTML, CSS y JavaScript puro, sin dependencias.

## Estructura

| Archivo | Función |
|---|---|
| `index.html` | Estructura de la página |
| `style.css` | Estilos responsive (claro/oscuro) |
| `script.js` | Parser, comparación e interfaz (separados en secciones) |
| `tests/` | Pruebas automáticas del parser y de la interfaz (opcional, solo desarrollo) |

## Uso local

Abre `index.html` en el navegador. No requiere servidor.

## Publicar en GitHub Pages

1. Sube los archivos a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En *Build and deployment*, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
4. Guarda. En unos minutos tendrás la URL pública.

## Cómo obtener los archivos de Instagram

Configuración → Centro de cuentas → Tu información y permisos → Descargar tu información → Descargar o transferir información → elegir cuenta → **Seguidores y seguidos** → formato **HTML** → rango **Desde el principio**. Descomprime el ZIP y busca `connections/followers_and_following/` (`followers_1.html` y `following.html`).

## Video tutorial

En `script.js`, define `VIDEO_URL` con el enlace embed de YouTube (`https://www.youtube.com/embed/ID`). El iframe se inserta solo.

## Parser

`extractUsernames(html)` busca enlaces `<a href>` a instagram.com (incluye `/_u/usuario`), exige un único segmento de ruta (`/usuario`), no descarta nombres por coincidir con rutas de Instagram y, si no encuentra enlaces, busca URLs de Instagram en el texto. La comparación (`findNotFollowingBack`) es independiente del HTML.

## Si «Comparar listas» no hace nada

La página incluye un panel **«Estado técnico (temporal)»**, oculto por defecto. Para verlo, abre la página con `?debug=1` al final de la dirección (o `#debug`). Muestra 7 pasos (script cargado, `initUI()` ejecutado, formulario encontrado, evento registrado, botón presionado, archivos recibidos, etapa/error). Si un paso aparece con ✖, el mensaje indica el motivo. El caso más común: `index.html`, `style.css` y `script.js` **deben estar juntos en la misma carpeta** (si los descargas uno por uno, el navegador puede renombrar `script.js` a `script (1).js`). Descarga el ZIP del proyecto para evitarlo.

El panel solo aparece en modo debug, así que se puede dejar publicado sin que lo vean los visitantes. Si quieres eliminarlo del todo: borra la sección `tech-status` y el bloque `<script>` de diagnóstico en `index.html`.

## Primera prueba con tus archivos reales

1. Descomprime el ZIP de Instagram y ubica `connections/followers_and_following/`.
2. Abre `index.html` con doble clic (o arrastra el archivo al navegador).
3. Para ver el diagnóstico, agrega `?debug=1` al final de la dirección (por ejemplo `file:///.../index.html?debug=1`) y recarga. Aparece el panel «Diagnóstico (temporal)».
4. Elige **todos** los `followers_N.html` en el campo de seguidores y `following.html` en el de seguidos, y pulsa «Comparar listas».
5. Compara los números del panel con los de tu perfil de Instagram (seguidores y seguidos). Pueden diferir un poco (cuentas eliminadas o exportación desactualizada), pero no mucho.
6. «Copiar diagnóstico» copia solo conteos y la estructura anonimizada de la primera entrada (sin nombres de usuario); puedes pegarlo en el chat para ajustar el parser si hace falta.

El panel solo aparece con `?debug=1`; sin eso la página se ve igual que siempre. Es temporal: se puede quitar antes de publicar.

## Pruebas automáticas (opcional, con archivos simulados)

```
npm i --no-save jsdom
node tests/parser.test.js
node tests/ui.test.js
```

Prueba en navegador real (Chromium, abriendo `index.html` por `file://`):

```
pip install playwright && playwright install chromium
python3 tests/browser_ui.py
```

Los archivos de prueba son simulados (no son exports reales). No subas `node_modules` al repositorio.

## Notas técnicas

- `index.html` incluye una política CSP que bloquea `fetch`/XHR/WebSocket (`connect-src 'none'`), como defensa adicional de privacidad.
- Se pueden seleccionar varios archivos en cada campo (`followers_1.html`, `followers_2.html`…); se unen sin duplicados.
- «Copiar lista» y «Descargar» incluyen siempre la lista completa, no solo lo filtrado en el buscador.
