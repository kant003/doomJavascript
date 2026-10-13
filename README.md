# DOOM → TypeScript

Conversión progresiva de [id-Software/DOOM](https://github.com/id-Software/DOOM) a TypeScript nativo para navegador, conservando los nombres de módulos, funciones y tablas. **Vista 3D del mundo y objetos estáticos implementada con rutinas del renderer original; todavía no es DOOM jugable ni una conversión completa.** No se utiliza WebAssembly ni se ejecuta el código C para la aplicación.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+ y npm.

```sh
npm install
npm run dev
```

Abrir la URL que muestra Vite, normalmente `http://127.0.0.1:5173/`. La web abre por defecto la vista 3D del nivel cuando hay mapas disponibles y arranca con un WAD sintético de prueba con textura 0 reservada como NoTexture y paredes orientadas hacia el interior y permite seleccionar archivos WAD locales. No sube los archivos a ningún servidor.

- **Imagen de título**: lee `PLAYPAL` y `TITLEPIC` (o `INTERPIC`/`CREDIT`), dibujando los posts originales sobre el framebuffer.
- **Geometría del mapa**: inspecciona vértices, líneas y posición inicial. Es una utilidad de desarrollo, no el automapa original ni un modo jugable.
- **Vista 3D del nivel**: recorre el BSP y dibuja paredes opacas, suelos, techos y cielo con las rutinas convertidas. Haz clic en el Canvas: W/S mueve la cámara, A/D gira y Q/E desplaza de lado. Hay botones equivalentes para girar/avanzar y volver al inicio. Es una cámara libre de inspección, sin colisiones ni simulación. Muestra objetos estáticos mediante el spawnstate original, con sprites, transparencias, rotaciones, iluminación y recorte contra paredes; no ejecuta acciones ni representa una partida jugable.
- **Diagnóstico del nivel**: ejecuta los lectores de `p_setup.c`, enlaza sectores/líneas/segs/subsectors, valida BSP/REJECT/BLOCKMAP y consulta el sector del inicio mediante `R_PointInSubsector`. No genera actores.
- **Texturas de pared**: interpreta PNAMES/TEXTURE1/TEXTURE2 y muestra columnas obtenidas por `R_GetColumn` y dibujadas por `R_DrawColumn`. El muestreo vertical de esta vista conserva la repetición clásica a 128 píxeles.
- **Gamma**: usa las cinco tablas literales del original.
- **Efecto melt**: aplica la transición original a la vista seleccionada, a 35 tics/s.

Para PWAD que dependan del juego base, seleccionar también el IWAD. La web coloca el IWAD primero; los PWAD posteriores pueden sobrescribir recursos. Mapas Hexen/UDMF, patches altos extendidos y formatos de source ports modernos no forman parte de esta etapa. Las columnas de texturas transparentes que requieren composición de varios patches no están representadas como posts en la cache opaca original; se rechazan explícitamente.

## Publicación en GitHub Pages

La web se publica en https://kant003.github.io/doomJavascript/ desde la rama `master` mediante `.github/workflows/pages.yml`. Cada push instala dependencias con `npm ci`, ejecuta `npm run verify` y publica únicamente `dist/`. Los pull requests ejecutan las comprobaciones sin desplegar. También se puede lanzar el workflow manualmente desde Actions.

GitHub Pages debe tener **GitHub Actions** seleccionado como fuente en Settings → Pages. Vite genera rutas relativas para servir los recursos bajo el directorio del repositorio. No se requieren secretos de despliegue adicionales: el workflow usa los permisos de Pages y el token temporal de GitHub.

## Estructura

```text
original/                    Fuente original íntegra, sin modificaciones
  linuxdoom-1.10/             Motor C
  ipx/                       Herramientas de red originales
  sersrc/                    Herramientas serie originales
  sndserv/                   Servidor de sonido original
src/
  linuxdoom-1.10/             Conversiones reales a TypeScript
    m_fixed.ts               m_fixed.c → m_fixed.ts
    m_fixed.h.ts             m_fixed.h → m_fixed.h.ts
    ...
  web/                       Interfaz y utilidades de validación del navegador
scripts/                     Generación de tablas e inventario
public/port-status.json       Correspondencias, estados y hashes del original
tests/                       Pruebas de recursos, aritmética y vídeo
PORT_STATUS.md               Inventario de cada fichero C/H
PORTING.md                   Convenciones y pasos para completar el motor
```

Se distingue `.h.ts` de `.ts` para mantener una correspondencia inequívoca con cabeceras e implementaciones que comparten nombre. No se han creado módulos vacíos para aparentar que todos los archivos estén convertidos.

## Estado

Implementados: punto fijo 16.16, RNG original con dos streams, tablas trigonométricas, tipos internos de actores/jugadores/mapas, intercambio de bytes, argumentos, cheats, datos de armas, WAD, vídeo de 8 bits, primitivas de columnas/spans, texturas compuestas, flats, cabeceras de sprites, iluminación y transiciones. Se han convertido los lectores geométricos de `p_setup.c`, la geometría/proyección/iluminación de `r_main.c`, la visibilidad de `r_bsp.c`, las paredes/transparentes de `r_segs.c`, los visplanes de `r_plane.c` y el renderer de sprites/psprites de `r_things.c`. Se conservan las tablas de `info.c` con 967 estados y 137 tipos de actor. La interfaz de plataforma es parcial.

También se han trasladado la lista de thinkers y el ticker (`p_tick.c`), las utilidades espaciales y trazas (`p_maputl.c`) y el ciclo de vida de actores (`p_mobj.c`): estados, movimiento XY/Z, spawn, proyectiles y respawn. `p_user.c` incorpora las rutinas de control y actualización del jugador: movimiento, altura/bob, muerte, selección de arma y poderes. `p_pspr.c` incorpora animación, munición, selección y acciones de armas, incluyendo proyectiles, melee, hitscan y spray BFG. `p_enemy.c` aporta propagación del ruido y tres acciones de recarga; el resto del comportamiento de enemigos sigue pendiente. `p_map.c` incorpora colisiones, sliding, teletransporte, alturas, apuntado y trazas de impactos, uso de líneas y explosiones; `p_sight.c` incorpora línea de visión con BSP/REJECT. Los módulos de simulación requieren dependencias explícitas de gameplay todavía pendientes; la vista web sigue usando objetos estáticos y cámara libre.

**Pendientes:** enlazado del renderer con el ciclo de juego, acciones de actores, arranque completo del nivel con actores y acciones especiales, integración de colisiones y control del jugador, enemigos, armas en funcionamiento, menús, HUD, sonido, partidas, demos y red. Los datos de armas/actores y estados convertidos no implementan sus acciones. Hay 23 acciones de armas/recarga convertidas de los 74 símbolos originales. Su enlace es explícito; las otras 51 siguen pendientes y fallan si se ejecutan sin una implementación. El apuntado y las colisiones ya están convertidos; falta integrar daño, recogidas, acciones especiales y sonido para completar el combate.

Consultar [PORT_STATUS.md](PORT_STATUS.md) para el estado exacto. El conteo de archivos no representa un porcentaje de funcionalidad.

## Validación

```sh
npm run verify
```

Ejecuta inventario, comprobación estricta de TypeScript, pruebas y build para navegador. `npm run build` genera `dist/`, que puede servirse desde un alojamiento estático.

Las pruebas generales funcionan sin un compilador de C y comprueban todas las tablas literales contra la fuente original. Las seis pruebas adicionales de `original-parity.test.ts` compilan un pequeño oráculo a partir de los módulos C originales cuando está disponible `clang`. Si no existe un compilador operativo, se indican explícitamente como omitidas. `tests/c-compat/values.h` aporta únicamente las constantes de la cabecera histórica que falta en macOS; no modifica los algoritmos.

Los scripts `generate-tables.py`, `generate-runtime-types.py`, `generate-info.py` y `generate-items.py` requieren Python 3 solo para regenerar las tablas. No se ejecutan durante el build normal.

## Fuente y licencia

Fuente fijada al commit `a77dfb96cb91780ca334d0d4cfd86957558007e0` de id-Software/DOOM. Se conserva la fuente y su copyright. La copia raíz de `LICENSE.TXT` procede del repositorio original y contiene GPL-2.0. Los encabezados antiguos se retienen para trazabilidad; debe consultarse la licencia raíz del repositorio.

DOOM es software publicado bajo GPL-2.0, no dominio público. El repositorio no incluye los datos comerciales del juego. Para visualizar sus recursos, proporciona un WAD que tengas derecho a utilizar. Los datos sintéticos incluidos son únicamente una fixture de pruebas y no contienen recursos comerciales de DOOM.
