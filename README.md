## Mini Juego de Naves (HTML5 Canvas)

### Cómo ejecutar el proyecto
1. Asegúrate de tener Node.js 18 o superior instalado.
2. Lanza el servidor local con `npm run dev`. Puedes añadir argumentos como `npm run dev -- --port=5000` para cambiar el puerto.
3. Abre la URL mostrada en la consola (por defecto http://localhost:4173) para jugar.
4. También puedes abrir directamente `index.html` en el navegador si prefieres no usar el servidor.

### Controles y mecánicas
1. El canvas lógico es 1920×1080 y se adapta al tamaño de la ventana/HiDPI.
2. Mueve la nave con el cursor; sigue el mouse suavemente dentro del canvas.
3. Mantén pulsado el clic izquierdo para disparar en ráfagas continuas o usa la barra espaciadora.
4. P pausa/reanuda, R reinicia, F o el botón “Pantalla” alterna fullscreen.
5. Oleadas crecientes: drones rápidos desde 45 s, kamikaze desde 90 s, mini-jefes cada 60 s.
6. Power-ups (6–9% de drop) otorgan vida extra, disparo doble temporal (x2) o misiles teledirigidos durante unos segundos.
7. La puntuación máxima se guarda en localStorage; la dificultad se adapta si estás en apuros.
