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

La siguiente etapa debe completar tablas de actores/estados, el render de sprites y superficies transparentes (`r_things` y R_RenderMaskedSegRange), además del ciclo de juego.

## Tercera etapa: renderer del mundo y cámara de inspección

- `r_main.c` incorpora R_AddPointToBox, R_PointToAngle/2, R_PointToDist, R_ScaleFromGlobalAngle, las tablas de proyección, zlight/scalelight, cambios diferidos de vista y R_SetupFrame. Los ángulos se reducen a BAM unsigned de 32 bits en cada frontera; las divisiones enteras conservan truncamiento de C.
- R_PointToDist devuelve 0 para el mismo punto, donde la fuente original intenta acceder fuera de tantoangle tras FixedDiv(0,0). Los demás cálculos conservan LUTs y punto fijo.
- `r_bsp.c` conserva backface culling, clipangle, columnas visibles, unión de solidsegs, portales, pruebas de BBox y recorrido front-to-back. Un stack explícito evita desbordar la pila de JS, y los rangos sólidos son dinámicos en lugar de permitir overflow del array fijo de 32 entradas. R_Subsector no recoge sprites todavía.
- `r_segs.c` conserva la distancia/escala de pared, offset y pegging de texturas, contraste horizontal/vertical, marcado de visplanes, tiers superior/inferior, reserva de openings y siluetas para sprites. Los spans guardados se representan mediante buffer/base. El step de una columna aislada se inicializa a 0 en vez de reutilizar un valor residual. R_RenderMaskedSegRange todavía no está implementado.
- `r_plane.c` implementa el dibujo de flats y cielo con R_MapPlane/R_MakeSpans, visplanes compartidos/divididos y sus caches. Los pads de C se modelan mediante 322 bytes por top/bottom; x lógico se accede en x+1. R_CheckPlane también comprueba MAXVISPLANES para evitar overflow.
- R_InitPointToAngle/R_InitTables/R_InitPlanes son vacíos porque también lo son en la versión C con los bloques deshabilitados; no sustituyen funciones pendientes.
- `R_RenderWorldView` es una frontera de inspección nueva: configura una cámara, limpia clipping, recorre BSP y dibuja planes. No se presenta como R_RenderPlayerView completo, y omite sprites, psprites, transparencias y NetUpdate.
- `src/web/world-preview.ts` mueve una cámara libre a 35 pasos/s mediante I_StartTic y los LUTs de seno/coseno. No sustituye P_PlayerThink ni implementa colisiones. Se limpia el framebuffer antes de cada vista para que salir fuera de la geometría no conserve píxeles del frame anterior.
- La vista web usa detalle alto y pantalla completa. El bug documentado de R_DrawSpanLow sigue pendiente de decidir antes de habilitar detalle bajo al usuario.
- El WAD sintético se ha corregido para usar pared visible en textura 1 (0 es NoTexture) y orientar lines/segs hacia el interior. Mantiene la misma geometría de cuatro vértices y un sector.
- Se prueba render repetible en varios octantes, luz fija, clipping contra un mapa independiente de cobertura, visplanes con padding y tiers de un portal. No se ha comprobado todavía equivalencia de framebuffer con un binario C ni con un WAD comercial.

El motor completo sigue pendiente. El siguiente trabajo debe incorporar tablas de estados/actores, sprites y superficies transparentes antes de comenzar la simulación del jugador y enemigos.

## Cuarta etapa: sprites, texturas transparentes y tablas de actores

- `r_things.c` incorpora selección de frames/rotaciones y mirroring, proyección en punto fijo, posts transparentes, siluetas, profundidad, orden estable por escala, sombras, traducción de color y psprites. Conserva MAXVISSPRITES=128 y el objeto de overflow no añadido al conjunto visible.
- Las inicializaciones de frames mantienen un estado interno -1, separado del boolean público rotate, como el memset(-1) original. Se comprueban frames ausentes, rotaciones incompletas, duplicadas o mezcladas con rot=0.
- Los prototipos obsoletos de r_things.h que no tienen implementación en r_things.c no se añaden como funciones vacías.
- `R_RenderMaskedSegRange` utiliza los spans de clip guardados, actualiza columnas dibujadas a MAXSHORT y respeta el orden frente/detrás de sprites. `R_GetMaskedColumn` retorna el encabezado de post, equivalente al puntero R_GetColumn-3 para una columna de patch único. Composites opacos no contienen posts: este caso falla explícitamente, sin simular una composición transparente inexistente en la cache original.
- `R_Subsector` ya llama a R_AddSprites; el validcount evita duplicar sprites de un sector dividido por BSP. La cámara de inspección llama a R_DrawMasked(false), mientras que el frame real de jugador puede dibujar psprites.
- `R_Init` y `R_RenderPlayerView` se incorporan con la secuencia original. NetUpdate se inyecta como dependencia obligatoria para las cuatro llamadas del frame de jugador. El arranque y bucle D_Main/G_Game continúan pendientes.
- Los globals de r_state.h tienen una única instancia en mapstate/texturestate/spritesState/view/planes/wall. Sus reexports no duplican estado.
- `info.c` aporta 138 nombres de sprite, 967 estados y 137 tipos de actor. Cada campo escalar se comprueba contra su expresión original y los enums. `sounds.h` solo aporta los enums usados por las tablas; esto no implementa audio.
- Los 74 símbolos de acciones se mantienen explícitos. I_LinkStateActions valida nombres y requiere todas las implementaciones por defecto; la vinculación parcial debe pedirse explícitamente. Una acción no enlazada lanza error. Tras el enlace, los estados referencian las funciones reales para conservar identidad de puntero. No existen acciones de enemigos/armas vacías que aparenten simulación.
- `src/web/map-actors.ts` crea exclusivamente objetos estáticos de inspección desde doomednum/spawnstate y los enlaza a su sector. Usa el frame inicial, altura de floor/ceiling y flags originales; no ejecuta P_SpawnMapThing, acciones, think, colisiones, filtros de dificultad ni red. Objetos sin definición/frame disponible no se representan.
- El WAD sintético contiene ahora un sprite COLUA0 de una lámpara, incluido en S_START/S_END, y un objeto 2028. Sigue sin contener datos comerciales.
- Las pruebas comprueban tablas completas, enlaces de acciones, transparencia y clips de posts, variantes de rotación, estabilidad de sorting, overflow, oclusión por paredes, profundidad de masked walls respecto a sprites y psprite/frame de jugador con las cuatro llamadas de NetUpdate.

El próximo trabajo es trasladar thinkers, ticker y posicionamiento/collision helpers para comenzar la simulación real sin sustituir P_PlayerThink por la cámara de inspección.

## Quinta etapa: thinkers, ticker y utilidades espaciales

- `p_tick.c` conserva la lista circular con sentinel, inserción al final, acciones nulas y eliminación diferida mediante -1. Lee next después de cada callback: un thinker añadido durante una acción puede ejecutarse en el mismo tic. Z_Free se adapta a GC; P_AllocateThinker sigue vacío porque el original también lo está. P_InitThinkers reinicia la lista; el reset de leveltime pertenece al arranque del nivel y tiene una frontera explícita P_ResetLevelTime.
- P_Ticker conserva pausas, la excepción viewz=1 del menú, orden de cuatro jugadores, thinkers, especiales, respawn y aumento del tiempo. Recibe obligatoriamente un contexto con estado de juego y las tres dependencias de gameplay todavía pendientes. No se conecta al bucle de cámara ni se suministran acciones ficticias.
- Los callbacks de thinkers reciben su thinker_t, como en C. Las estructuras TS contienen thinker como campo; futuros actores/especiales deberán enlazar explícitamente la identidad de su propietario en vez de intentar el cast de dirección de C.
- `p_maputl.c` incorpora todas las funciones activas de distancia aproximada, lado de línea/divline/caja, intersección fija, apertura de portales, enlace/desenlace por sector y BLOCKMAP, iteradores, recogida y orden de interceptos y P_PathTraverse. Conserva el límite de 64 bloques, el ajuste de un FRACUNIT al iniciar sobre un borde y la inclusión del cero inicial de las listas BLOCKMAP como referencia a line 0.
- El estado de aperturas se agrupa en openings; el array intercepts representa intercept_p mediante su longitud. El validcount es el mismo que usa el renderer. Las trazas mantienen estado global y no son reentrantes, como el original. Sobrepasar MAXINTERCEPTS=128 lanza error en lugar de escribir fuera de memoria. P_UnsetThingPosition conserva los punteros propios residuales: hay que desenlazar antes de cambiar posición o flags.
- Los actores de inspección usan ahora P_SetThingPosition y limpian ambas listas al reconstruirse. Siguen siendo estáticos; esto no implementa filtros de spawn, movimiento, combate ni colisión del jugador.
- Pruebas nuevas: orden y mutaciones de thinkers, pausas del ticker, enlaces de cabeza/medio/cola, cambio de bloque, flags independientes, objetos fuera del mapa, deduplicación de líneas, geometría y portales, trazas en ejes/octantes, impactos de objeto/pared ordenados, early-out y overflow. La comprobación contra un ejecutable C sigue pendiente por falta del compilador disponible.

El siguiente bloque debe convertir p_mobj/p_map/p_user y enlazar acciones reales de estados antes de presentar el nivel como jugable.

## Sexta etapa: ciclo de vida y movimiento de actores

- `p_mobj.c` traslada las 16 funciones activas: estados, explosión, movimiento XY/Z, thinker, creación/eliminación, respawn nightmare/items, spawn de jugador/mapa, puff/blood y proyectiles normales/de jugador. Sus nombres y algoritmos corresponden al original.
- Un contexto obligatorio proporciona estado de doomstat y dependencias de p_map, p_pspr, g_game, sonido y HUD/status. No hay callbacks de producción vacíos ni colisiones que siempre devuelvan éxito. Las pruebas inyectan spies de estas fronteras. Implementar y conectar esos subsistemas sigue pendiente; el módulo no está conectado a la cámara web como simulación completa.
- P_SpawnMobj inicializa todos los campos, usa P_Random para lastlook, aplica altura de floor/ceiling y registra el thinker sin ejecutar la acción inicial. Una WeakMap permite convertir el thinker recibido por P_RunThinkers a su actor propietario manteniendo la misma función P_MobjThinker para todos los objetos. Las acciones de estado reciben el mobj real; acciones todavía no enlazadas siguen fallando explícitamente.
- P_SetMobjState conserva cadenas de estados cero-tic y acciones durante la transición, así como eliminación por S_NULL. Un guard de 10.000 transiciones evita bloquear el navegador con una cadena infinita; no sustituye acciones. Tipos/estados inválidos fallan en vez de acceder fuera de memoria.
- Movimiento XY conserva clamp MAXMOVE, subdivisión solo de valores positivos grandes, división C hacia cero seguida de shift aritmético, fricción 0xe800, stop speed, sliding del jugador y eliminación de misiles contra cielo. Z conserva step/viewheight, gravedad inicial doble, floating hacia el objetivo, aterrizaje fuerte y el orden original del rebote skull contra piso/techo.
- La cola de items mantiene 128 slots, snapshots de mapthing por valor, reloj leveltime, pérdida del más antiguo y exclusión de dropped/invulnerability/invisibility. Respawn espera 30 segundos y solo funciona en deathmatch=2. Nightmare conserva delay de 420 tics, máscara de reloj y RNG antes de comprobar posición.
- Spawn de mapa conserva starts, filtros de skill/multiplayer/deathmatch/nomonsters, counters, ambush, ángulos BAM y aleatorización inicial de tics. Un mapthing con tipo 0 se trata como desconocido, evitando el acceso original a playerstarts[-1]. Spawn de jugador mantiene inventario y orden reborn/psprites/status/HUD. Los starts se guardan por valor y deathmatchstarts tiene máximo 10.
- Efectos y proyectiles conservan el orden de llamadas P_Random, momentum LUT, half-step inicial, difusión contra MF_SHADOW y las tres búsquedas de autoaim. P_CheckMissileSpawn mantiene el cambio de x/y previo a P_TryMove original; la lógica de relink corresponde a p_map y todavía no está convertida.
- Constantes nuevas de movimiento y spawn se incorporan en p_local.h. p_mobj se importa directamente: reexportarlo desde ese header crearía un ciclo con la inicialización de la cola que lee ITEMQUESIZE.
- Pruebas nuevas cubren la presencia de todas las funciones, spawn sin acciones iniciales, identidad de actor/thinker, cadenas de estados, eliminación, subdivisión/fricción, gravedad/floating, misiles/cielo, cola circular, tiempos de respawn, filtros de mapa, jugador y proyectiles. No prueban todavía colisiones reales ni equivalencia frente a un ejecutable C.

El siguiente trabajo debe trasladar p_map, p_user y p_pspr, y enlazar sus acciones reales antes de habilitar el juego.
