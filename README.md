# DOOM → TypeScript

Conversión progresiva de [id-Software/DOOM](https://github.com/id-Software/DOOM) a TypeScript nativo para navegador, conservando los nombres de módulos, funciones y tablas. **Vista 3D del mundo implementada con rutinas del renderer original; todavía no es DOOM jugable ni una conversión completa.** No se utiliza WebAssembly ni se ejecuta el código C para la aplicación.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+ y npm.

```sh
npm install
npm run dev
```

Abrir la URL que muestra Vite, normalmente `http://127.0.0.1:5173/`. La web arranca con un WAD sintético de prueba con textura 0 reservada como NoTexture y paredes orientadas hacia el interior y permite seleccionar archivos WAD locales. No sube los archivos a ningún servidor.

- **Imagen de título**: lee `PLAYPAL` y `TITLEPIC` (o `INTERPIC`/`CREDIT`), dibujando los posts originales sobre el framebuffer.
- **Geometría del mapa**: inspecciona vértices, líneas y posición inicial. Es una utilidad de desarrollo, no el automapa original ni un modo jugable.
- **Vista 3D del nivel**: recorre el BSP y dibuja paredes opacas, suelos, techos y cielo con las rutinas convertidas. Haz clic en el Canvas: W/S mueve la cámara, A/D gira y Q/E desplaza de lado. Hay botones equivalentes para girar/avanzar y volver al inicio. Es una cámara libre de inspección, sin colisiones, actores, armas ni texturas transparentes.
- **Diagnóstico del nivel**: ejecuta los lectores de `p_setup.c`, enlaza sectores/líneas/segs/subsectors, valida BSP/REJECT/BLOCKMAP y consulta el sector del inicio mediante `R_PointInSubsector`. No genera actores.
- **Texturas de pared**: interpreta PNAMES/TEXTURE1/TEXTURE2 y muestra columnas obtenidas por `R_GetColumn` y dibujadas por `R_DrawColumn`. El muestreo vertical de esta vista conserva la repetición clásica a 128 píxeles.
- **Gamma**: usa las cinco tablas literales del original.
- **Efecto melt**: aplica la transición original a la vista seleccionada, a 35 tics/s.

Para PWAD que dependan del juego base, seleccionar también el IWAD. La web coloca el IWAD primero; los PWAD posteriores pueden sobrescribir recursos. Mapas Hexen/UDMF, patches altos extendidos y formatos de source ports modernos no forman parte de esta etapa.

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

Implementados: punto fijo 16.16, RNG original con dos streams, tablas trigonométricas, tipos internos de actores/jugadores/mapas, intercambio de bytes, argumentos, cheats, datos de armas, WAD, vídeo de 8 bits, primitivas de columnas/spans, texturas compuestas, flats, cabeceras de sprites, iluminación y transiciones. Se han convertido los lectores geométricos de `p_setup.c`, la geometría/proyección/iluminación de `r_main.c`, la visibilidad de `r_bsp.c`, las paredes opacas de `r_segs.c` y los visplanes de `r_plane.c`. La interfaz de plataforma es parcial.

**Pendientes:** render completo de sprites y superficies transparentes, enlazado del renderer con el ciclo de juego, sprites del mundo, arranque completo del nivel con actores y acciones especiales, colisiones, jugadores, enemigos, armas en funcionamiento, menús, HUD, sonido, partidas, demos y red. Los datos de armas convertidos no implementan sus acciones.

Consultar [PORT_STATUS.md](PORT_STATUS.md) para el estado exacto. El conteo de archivos no representa un porcentaje de funcionalidad.

## Validación

```sh
npm run verify
```

Ejecuta inventario, comprobación estricta de TypeScript, pruebas y build para navegador. `npm run build` genera `dist/`, que puede servirse desde un alojamiento estático.

Las pruebas generales funcionan sin un compilador de C y comprueban todas las tablas literales contra la fuente original. Las seis pruebas adicionales de `original-parity.test.ts` compilan un pequeño oráculo a partir de los módulos C originales cuando está disponible `clang`. Si no existe un compilador operativo, se indican explícitamente como omitidas. `tests/c-compat/values.h` aporta únicamente las constantes de la cabecera histórica que falta en macOS; no modifica los algoritmos.

Los scripts `generate-tables.py`, `generate-runtime-types.py` y `generate-items.py` requieren Python 3 solo para regenerar las tablas. No se ejecutan durante el build normal.

## Fuente y licencia

Fuente fijada al commit `a77dfb96cb91780ca334d0d4cfd86957558007e0` de id-Software/DOOM. Se conserva la fuente y su copyright. La copia raíz de `LICENSE.TXT` procede del repositorio original y contiene GPL-2.0. Los encabezados antiguos se retienen para trazabilidad; debe consultarse la licencia raíz del repositorio.

DOOM es software publicado bajo GPL-2.0, no dominio público. El repositorio no incluye los datos comerciales del juego. Para visualizar sus recursos, proporciona un WAD que tengas derecho a utilizar. Los datos sintéticos incluidos son únicamente una fixture de pruebas y no contienen recursos comerciales de DOOM.
