# Convenciones de conversión

## Objetivo y fidelidad

El resultado final debe ser la implementación de Linux DOOM 1.10 en TypeScript nativo, ejecutada en el navegador. Conservar nombres de archivos, funciones, constantes, tablas, orden de actualización y algoritmos. Mantener `original/` sin cambios y comparar cada módulo con la fuente fijada. IPX, serie y sndserv también están inventariados; sus APIs de plataforma necesitarán equivalentes web y no pueden copiarse literalmente.

Esta entrega implementa recursos gráficos y geometría interna del nivel. La web es un banco de pruebas de recursos y vídeo. La imagen de título o la visualización de un mapa no constituyen un motor jugable.

## Correspondencia de archivos

`original/linuxdoom-1.10/foo.c` → `src/linuxdoom-1.10/foo.ts`.

`original/linuxdoom-1.10/foo.h` → `src/linuxdoom-1.10/foo.h.ts`.

En imports usar `./foo` y `./foo.h`, respectivamente. Conservar declaraciones en la cabecera y funciones en la implementación, con reexports cuando corresponda. `v_gamma.ts` es una extracción auxiliar de las tablas de `v_video.c`; no representa otro módulo original.

Las cabeceras C no son directamente utilizables en TS: typedefs se convierten a tipos/interfaces, enums a enums o constantes y macros a funciones/constantes. Los arrays no inicializados en C comienzan a cero también en TS.

## Enteros y punteros

- `fixed_t` es un entero firmado de 32 bits 16.16. Normalizar con `| 0` en fronteras y acumuladores. `number` por sí solo no conserva el overflow de C.
- `FixedMul` utiliza `BigInt` para el producto de 64 bits, desplazamiento aritmético y reducción a 32 bits. No sustituirlo por una multiplicación flotante.
- División a enteros con `Math.trunc`; desplazamientos aritméticos con `>>`; valores sin signo con `>>> 0`. `SlopeDiv` conserva el overflow unsigned del desplazamiento antes de dividir.
- `abs(INT_MIN)` y otros comportamientos indefinidos de C necesitan una decisión documentada. `FixedDiv` satura de forma determinista; `FixedDiv2` rechaza resultados no finitos, incluido 0/0.
- Punteros a recursos binarios se convierten a `Uint8Array` y offsets. `DataView(..., true)` lee little-endian independientemente del host.
- Punteros a estructuras deberán conservar identidad de objetos y listas enlazadas; no reemplazarlos por copias.
- Variables globales que otros módulos necesitan modificar: objetos con campos nombrados como los originales (`draw`, `sky`), porque los bindings importados de ES modules no son asignables.
- Tablas trigonométricas/RNG/gamma se copian literalmente. No regenerarlas con funciones matemáticas aproximadas.

## Adaptaciones ya introducidas

- `W_InitMultipleFiles` recibe objetos `WadFile` con nombre y bytes. `File.arrayBuffer()` se espera en `src/web/main.ts` antes de arrancar los lectores sincrónicos del motor.
- `W_AddFile` conserva el orden de directorio y `W_CheckNumForName` busca desde el final. Los PWAD posteriores prevalecen. Los recursos cargados se copian para aislarlos de mutaciones del llamador.
- `W_Reload` recibe bytes nuevos, valida que los nombres/tamaño del directorio no hayan cambiado e invalida la caché correspondiente. No implementa la ruta Linux con prefijo `~`.
- `W_Profile` devuelve un informe de texto; no replica el historial de diez perfiles ni escribe `waddump.txt` en un sistema de archivos Linux.
- Caché WAD y buffers temporales usan GC de JavaScript. `z_zone.c` sigue pendiente: los tags de WAD se guardan para el perfil, pero todavía no existe el purgado de memoria de Z_Zone.
- `V_DrawPatch` conserva las columnas/posts y offsets del formato clásico, con validación adicional para datos truncados. `V_Init` mantiene cuatro pantallas contiguas y provisiona la quinta pantalla por separado.
- `R_DrawSpanLow` conserva el bucle original que duplica el conteo, incluida la anomalía del modo de baja resolución; no se usa en la web de pruebas. Debe compararse y decidirse antes de activar ese modo en el motor.
- `R_InitBuffer` configura también dimensiones/centro para poder probar el módulo aisladamente. En el original parte de este estado procede de `r_main.c`.
- Wipes limitados explícitamente a pantalla completa. El caso original siempre utilizado es 320 × 200. Se mantienen pares de píxeles y el RNG de retraso de columnas.
- `i_video.ts` sustituye X11 por Canvas, paleta RGBA y una cola de teclado. Las teclas se capturan solo cuando el Canvas tiene foco y se liberan al perderlo. Ratón/joystick pendientes.
- `I_GetTime` usa el reloj monótono `performance.now()` a 35 tics/s. `I_WaitVBL` es asíncrono para no bloquear la pestaña. Ciclo de vida con sonido/red/guardados pendiente.
- `DoomBoolean` sustituye al typedef `boolean`, porque ese nombre está reservado en TypeScript.
- `src/web/map-preview.ts` y `demo.ts` son herramientas nuevas. No deben marcarse como conversiones de `p_setup.c` o `am_map.c`.

## Orden para completar el motor

1. **Tipos y datos internos:** `d_think.h`, `r_defs.h`, `r_state.h`, `p_mobj.h`, `d_player.h`, `doomstat.*`, `info.*`, `sounds.*`, strings. Conservar todas las tablas y enlazar acciones reales, sin funciones vacías.
2. **Recursos de render:** `r_data.c`, carga de PNAMES/TEXTURE1/TEXTURE2, texturas compuestas, flats y sprites. Gestionar memoria y tags de caché.
3. **Carga del nivel:** `p_setup.c`, sectores, lados, segs, subsectors, nodos, reject y blockmap. Validar índices y escalas contra el original.
4. **Render original completo:** `r_main.c`, `r_bsp.c`, `r_segs.c`, `r_plane.c`, `r_things.c`. Validación con capturas del mismo WAD, punto de vista y tic.
5. **Simulación:** thinkers/ticker, `p_maputl.c`, `p_map.c`, `p_sight.c`, `p_mobj.c`, `p_user.c`, `p_pspr.c`, `p_inter.c`, `p_enemy.c`, `p_spec.c` y módulos de sectores. Validar secuencias deterministas; mantener P_Random separado de M_Random.
6. **Bucle del juego y presentación:** `d_main.c`, `g_game.c`, `m_menu.c`, `hu_*`, `st_*`, `am_map.c`, finales e intermisión. Usar acumulador a 35 Hz con presentación por requestAnimationFrame.
7. **Audio y persistencia:** `i_sound.c`, `s_sound.c`, música, configuración, guardados y demos. APIs Web Audio y almacenamiento local solo en la frontera de plataforma.
8. **Red y herramientas auxiliares:** `d_net.c`, `i_net.c`, IPX/serie y sndserv. Definir transporte web compatible con la lógica de red; no simular soporte con stubs.

Al terminar un módulo, declarar su estado en `porting-status.json`, añadir validación relevante, ejecutar `npm run verify` y registrar diferencias respecto a C. El inventario no debe marcar un módulo terminado únicamente porque compile.

## Criterio de finalización

No considerar completado el port hasta que el navegador pueda arrancar un IWAD compatible, mostrar menús, iniciar mapas, ejecutar render y simulación originales, mover al jugador, disparar, interactuar, procesar enemigos/sectores, completar niveles y gestionar audio/guardados/demos dentro del alcance documentado. Toda diferencia de plataforma debe estar descrita y todas las partes originales deben estar convertidas o tener un equivalente explícito verificado.

## Segunda etapa: recursos y datos del nivel

- `r_data.c` conserva el lookup de columnas, composición en orden de patches, máscara de anchura original (también para anchuras que no sean potencia de dos), offsets, alturas 16.16 y tablas de traducción. Los globals se agrupan en `texturestate`.
- `R_DrawColumnInCache` conserva incluso el comportamiento original de recorte superior: reduce el conteo sin avanzar el puntero a píxeles del post. Se comprueba explícitamente con pruebas.
- Diferencias de validación: un hueco sin patch es un error explícito, no una salida con tablas parcialmente inicializadas; `R_GetColumn` admite el lump 0 (el original comprueba `> 0` y puede acceder a un composite ausente). Se rechazan offsets que no caben en los límites clásicos en lugar de truncarlos silenciosamente. `R_InitData` restaura su estado anterior si falla.
- `R_PrecacheLevel` recibe un contexto obligatorio con sectores, lados, IDs de sprites activos, definiciones de sprites, cielo y flag de demo. El recorrido de thinkers real depende todavía de `p_mobj.c`/`r_things.c`. Los contadores conservan las sumas originales, incluso cuando varias texturas referencian un mismo patch.
- `p_setup.c` implementa P_LoadVertexes/Sectors/SideDefs/LineDefs/Subsectors/Nodes/Segs/BlockMap/Things y P_GroupLines. `P_LoadMapData` es una frontera web nueva que sigue el orden de lectores de P_SetupLevel. No sustituye P_SetupLevel ni llama a actores, sonido o especiales pendientes.
- `P_LoadThings` requiere gamemode y una función de spawn suministrada por el llamador. La utilidad de inspección lee los registros sin spawn. Se conserva el `break` original al encontrar un monstruo DOOM II en modo DOOM I.
- Los lectores usan referencias compartidas: un seg apunta al mismo linedef/sidedef/sector que los demás módulos. Los arrays contiguos de C pasan a arrays de objetos, y BLOCKMAP conserva la subvista a su propio buffer.
- Validación adicional: tamaños exactos de registros, referencias dentro de rango, terminadores de BLOCKMAP, tamaño mínimo de REJECT, orden clásico de lumps y ausencia de ciclos BSP. La carga completa de datos es atómica respecto a `mapstate`.
- `r_main.c` está parcialmente convertido: clasificación de lados, clasificación respecto a segs y búsqueda de subsector. Se mantiene la lógica original de signos y FixedMul. El recorrido incorpora protección contra ciclos/índices corruptos.
- `r_defs.h` modela spans de clipping como buffer/base y acolcha los arrays de visplanes. No hay aún algoritmos de r_plane.c que utilicen estos tipos.
- Los campos de info.h, p_mobj.h y d_player.h ya están presentes; esto no implementa sus tablas de acciones ni la simulación.
- El WAD sintético incluye ahora PNAMES/TEXTURE1, una textura, un flat, COLORMAP y un mapa clásico completo de un sector. No contiene datos comerciales.

La siguiente etapa debe completar tablas de actores/estados, el estado de vista y los módulos del renderizador BSP (`r_main`, `r_bsp`, `r_segs`, `r_plane`, `r_things`) antes de presentar una vista 3D como render original.
