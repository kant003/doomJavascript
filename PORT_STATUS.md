# Estado de la conversión

Fuente: https://github.com/id-Software/DOOM, commit `a77dfb96cb91780ca334d0d4cfd86957558007e0`.

**El motor completo todavía no está convertido.** Este inventario registra 146 ficheros C/H del repositorio original, incluidos IPX, serie y el servidor de sonido. El estado es explícito; la existencia de un fichero no implica que el módulo esté terminado.

Traducido: **26** · Adaptado a web: **42** · Parcial: **10** · Pendiente: **68**

El conteo es por archivos, no un porcentaje de funcionalidad ni una prueba de equivalencia. Para regenerar: `npm run inventory`. SHA-256 de cada original en `public/port-status.json`.

| Original | TypeScript | Estado | Observaciones |
|---|---|---|---|
| `ipx/DOOMNET.C` | — | Pendiente |  |
| `ipx/DOOMNET.H` | — | Pendiente |  |
| `ipx/IPXNET.C` | — | Pendiente |  |
| `ipx/IPXNET.H` | — | Pendiente |  |
| `ipx/IPXSETUP.C` | — | Pendiente |  |
| `ipx/IPXSTR.H` | — | Pendiente |  |
| `ipx/IPX_FRCH.H` | — | Pendiente |  |
| `linuxdoom-1.10/am_map.c` | — | Pendiente |  |
| `linuxdoom-1.10/am_map.h` | — | Pendiente |  |
| `linuxdoom-1.10/d_englsh.h` | `src/linuxdoom-1.10/d_englsh.h.ts` | Traducido | 285 macros originales de strings/caracteres; concatenación y caracteres enteros preservados. Regenerable con generate-strings.py. |
| `linuxdoom-1.10/d_event.h` | `src/linuxdoom-1.10/d_event.h.ts` | Parcial | Enums, flags y event_t; cola global de D_PostEvent pendiente. |
| `linuxdoom-1.10/d_french.h` | — | Pendiente |  |
| `linuxdoom-1.10/d_items.c` | `src/linuxdoom-1.10/d_items.ts` | Traducido |  |
| `linuxdoom-1.10/d_items.h` | `src/linuxdoom-1.10/d_items.h.ts` | Traducido |  |
| `linuxdoom-1.10/d_main.c` | — | Pendiente |  |
| `linuxdoom-1.10/d_main.h` | — | Pendiente |  |
| `linuxdoom-1.10/d_net.c` | — | Pendiente |  |
| `linuxdoom-1.10/d_net.h` | — | Pendiente |  |
| `linuxdoom-1.10/d_player.h` | `src/linuxdoom-1.10/d_player.h.ts` | Traducido | Todos los campos de player_t, intermisión y enums. |
| `linuxdoom-1.10/d_textur.h` | — | Pendiente |  |
| `linuxdoom-1.10/d_think.h` | `src/linuxdoom-1.10/d_think.h.ts` | Adaptado a web | Puntero de la unión actionf_t como callable único; referencias enlazadas y marcador -1. |
| `linuxdoom-1.10/d_ticcmd.h` | `src/linuxdoom-1.10/d_ticcmd.h.ts` | Traducido |  |
| `linuxdoom-1.10/doomdata.h` | `src/linuxdoom-1.10/doomdata.h.ts` | Traducido |  |
| `linuxdoom-1.10/doomdef.c` | — | Pendiente |  |
| `linuxdoom-1.10/doomdef.h` | `src/linuxdoom-1.10/doomdef.h.ts` | Traducido |  |
| `linuxdoom-1.10/doomstat.c` | — | Pendiente |  |
| `linuxdoom-1.10/doomstat.h` | — | Pendiente |  |
| `linuxdoom-1.10/doomtype.h` | `src/linuxdoom-1.10/doomtype.h.ts` | Traducido |  |
| `linuxdoom-1.10/dstrings.c` | — | Pendiente |  |
| `linuxdoom-1.10/dstrings.h` | — | Pendiente |  |
| `linuxdoom-1.10/f_finale.c` | — | Pendiente |  |
| `linuxdoom-1.10/f_finale.h` | — | Pendiente |  |
| `linuxdoom-1.10/f_wipe.c` | `src/linuxdoom-1.10/f_wipe.ts` | Adaptado a web | Algoritmo original con vistas Uint16Array; pantalla completa; memoria gestionada por GC. |
| `linuxdoom-1.10/f_wipe.h` | `src/linuxdoom-1.10/f_wipe.h.ts` | Adaptado a web | Resultado de ScreenWipe convertido a boolean. |
| `linuxdoom-1.10/g_game.c` | — | Pendiente |  |
| `linuxdoom-1.10/g_game.h` | — | Pendiente |  |
| `linuxdoom-1.10/hu_lib.c` | — | Pendiente |  |
| `linuxdoom-1.10/hu_lib.h` | — | Pendiente |  |
| `linuxdoom-1.10/hu_stuff.c` | — | Pendiente |  |
| `linuxdoom-1.10/hu_stuff.h` | — | Pendiente |  |
| `linuxdoom-1.10/i_main.c` | — | Pendiente |  |
| `linuxdoom-1.10/i_net.c` | — | Pendiente |  |
| `linuxdoom-1.10/i_net.h` | — | Pendiente |  |
| `linuxdoom-1.10/i_sound.c` | — | Pendiente |  |
| `linuxdoom-1.10/i_sound.h` | — | Pendiente |  |
| `linuxdoom-1.10/i_system.c` | `src/linuxdoom-1.10/i_system.ts` | Parcial | Tiempo, memoria, errores y BaseTiccmd; I_Init/I_Quit con audio/red/guardado pendientes. |
| `linuxdoom-1.10/i_system.h` | `src/linuxdoom-1.10/i_system.h.ts` | Parcial | Interfaz parcial de plataforma. |
| `linuxdoom-1.10/i_video.c` | `src/linuxdoom-1.10/i_video.ts` | Parcial | Canvas y teclado web. Entrada de ratón/joystick pendiente. |
| `linuxdoom-1.10/i_video.h` | `src/linuxdoom-1.10/i_video.h.ts` | Adaptado a web | Interfaz Canvas; eventos devueltos al llamador. |
| `linuxdoom-1.10/info.c` | `src/linuxdoom-1.10/info.ts` | Adaptado a web | 138 nombres, 967 estados, 137 actores literales. Las 74 acciones tienen implementación y se enlazan explícitamente con identidad y firmas de uno/dos argumentos. |
| `linuxdoom-1.10/info.h` | `src/linuxdoom-1.10/info.h.ts` | Adaptado a web | Enums y structs completos; tablas en info.ts. Reexports runtime separados para evitar ciclos de inicialización. |
| `linuxdoom-1.10/m_argv.c` | `src/linuxdoom-1.10/m_argv.ts` | Adaptado a web | Argumentos suministrados por la web. |
| `linuxdoom-1.10/m_argv.h` | `src/linuxdoom-1.10/m_argv.h.ts` | Traducido |  |
| `linuxdoom-1.10/m_bbox.c` | `src/linuxdoom-1.10/m_bbox.ts` | Traducido |  |
| `linuxdoom-1.10/m_bbox.h` | `src/linuxdoom-1.10/m_bbox.h.ts` | Traducido |  |
| `linuxdoom-1.10/m_cheat.c` | `src/linuxdoom-1.10/m_cheat.ts` | Traducido |  |
| `linuxdoom-1.10/m_cheat.h` | `src/linuxdoom-1.10/m_cheat.h.ts` | Traducido |  |
| `linuxdoom-1.10/m_fixed.c` | `src/linuxdoom-1.10/m_fixed.ts` | Traducido |  |
| `linuxdoom-1.10/m_fixed.h` | `src/linuxdoom-1.10/m_fixed.h.ts` | Traducido |  |
| `linuxdoom-1.10/m_menu.c` | — | Pendiente |  |
| `linuxdoom-1.10/m_menu.h` | — | Pendiente |  |
| `linuxdoom-1.10/m_misc.c` | — | Pendiente |  |
| `linuxdoom-1.10/m_misc.h` | — | Pendiente |  |
| `linuxdoom-1.10/m_random.c` | `src/linuxdoom-1.10/m_random.ts` | Traducido |  |
| `linuxdoom-1.10/m_random.h` | `src/linuxdoom-1.10/m_random.h.ts` | Traducido |  |
| `linuxdoom-1.10/m_swap.c` | `src/linuxdoom-1.10/m_swap.ts` | Traducido |  |
| `linuxdoom-1.10/m_swap.h` | `src/linuxdoom-1.10/m_swap.h.ts` | Traducido |  |
| `linuxdoom-1.10/p_ceilng.c` | `src/linuxdoom-1.10/p_ceilng.ts` | Adaptado a web | Seis funciones: techos/trituradoras, registro activo, pausa y reactivación. Límite/overflow silencioso original de 30 techos conservado. |
| `linuxdoom-1.10/p_doors.c` | `src/linuxdoom-1.10/p_doors.ts` | Adaptado a web | Seis funciones activas: puertas verticales, locks, activación por tag/manual y timers. Código sliding deshabilitado en C no incluido. |
| `linuxdoom-1.10/p_enemy.c` | `src/linuxdoom-1.10/p_enemy.ts` | Adaptado a web | 64 funciones originales: percepción/chase, ataques, arch-vile, mancubus, lost souls, jefes y brain. 54 acciones reales; contexto obligatorio de juego, sonido, eventos de sectores y salida. |
| `linuxdoom-1.10/p_floor.c` | `src/linuxdoom-1.10/p_floor.ts` | Adaptado a web | Cuatro funciones: movimiento de planos, suelos, tipos y escaleras. P_ChangeSector/thinkers reales; sonido mediante contexto obligatorio. |
| `linuxdoom-1.10/p_inter.c` | `src/linuxdoom-1.10/p_inter.ts` | Adaptado a web | Nueve funciones originales: ammo/weapon/body/armor/card/power, pickups, muerte y daño. Contexto obligatorio de estado, sonido, automapa y tactile. Integrado en pruebas con colisiones/armas reales; chase y audio siguen pendientes. |
| `linuxdoom-1.10/p_inter.h` | `src/linuxdoom-1.10/p_inter.h.ts` | Traducido | Declaración original de P_GivePower. |
| `linuxdoom-1.10/p_lights.c` | `src/linuxdoom-1.10/p_lights.ts` | Adaptado a web | 11 funciones originales: fuego, flashes, strobes, glow y eventos de luz por tag. Thinkers reales y RNG original; bright compartido entre sectores preservado. |
| `linuxdoom-1.10/p_local.h` | `src/linuxdoom-1.10/p_local.h.ts` | Parcial | Constantes de movimiento/spawn, tipos y utilidades espaciales, thinkers. Gameplay restante y reexports de actores pendientes; p_mobj se importa directamente para evitar ciclos de inicialización. |
| `linuxdoom-1.10/p_map.c` | `src/linuxdoom-1.10/p_map.ts` | Adaptado a web | 20 funciones: colisiones, telefrag, sliding, alturas/sectores, autoaim/hitscan, use y radius. Contexto obligatorio para daño, pickups, especiales y sonido; guard MAXSPECIALCROSS. |
| `linuxdoom-1.10/p_maputl.c` | `src/linuxdoom-1.10/p_maputl.ts` | Adaptado a web | Todas las funciones activas: geometría fija, listas sector/BLOCKMAP, interceptos y recorrido de 64 bloques. Overflow MAXINTERCEPTS lanza error; estado compartido no reentrante. |
| `linuxdoom-1.10/p_mobj.c` | `src/linuxdoom-1.10/p_mobj.ts` | Adaptado a web | 16 funciones activas: estados, XY/Z, thinkers, spawn jugador/mapa/efectos/proyectiles y respawn. Contexto obligatorio para collision/audio/armas/UI aún pendientes; guard de cadenas cero-tic y tipo inválido. |
| `linuxdoom-1.10/p_mobj.h` | `src/linuxdoom-1.10/p_mobj.h.ts` | Traducido | Flags y todos los campos de mobj_t; implementación p_mobj.c pendiente. |
| `linuxdoom-1.10/p_plats.c` | `src/linuxdoom-1.10/p_plats.ts` | Adaptado a web | Seis funciones: plataformas, espera, inversión, pausa/reactivación y registro de 30 slots con errores originales. |
| `linuxdoom-1.10/p_pspr.c` | `src/linuxdoom-1.10/p_pspr.ts` | Adaptado a web | 30 funciones originales: estados psprite, selección/munición, subida/bajada, disparos, flashes y BFG spray. 20 acciones reales enlazables; hitscan, daño y sonido mediante contexto obligatorio. |
| `linuxdoom-1.10/p_pspr.h` | `src/linuxdoom-1.10/p_pspr.h.ts` | Traducido | Enums, flags y estructura pspdef_t. |
| `linuxdoom-1.10/p_saveg.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_saveg.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_setup.c` | `src/linuxdoom-1.10/p_setup.ts` | Parcial | Todos los lectores geométricos, P_GroupLines y carga de THINGS con callback; P_SetupLevel/P_Init y actores pendientes. |
| `linuxdoom-1.10/p_setup.h` | `src/linuxdoom-1.10/p_setup.h.ts` | Parcial | Interfaz de lectores; ciclo completo de nivel pendiente. |
| `linuxdoom-1.10/p_sight.c` | `src/linuxdoom-1.10/p_sight.ts` | Adaptado a web | Cinco funciones originales de visión: REJECT, divline, intersección, subsectors y BSP. Stack explícito; topslope/bottomslope compartidos con p_map; bug horizontal original conservado. |
| `linuxdoom-1.10/p_spec.c` | `src/linuxdoom-1.10/p_spec.ts` | Parcial | 11 helpers originales de lados, adyacencia, alturas, tags y luz mínima. Dispatch de líneas, animaciones y setup/ticker de especiales pendientes; helpers explícitos de ownership/sonido. |
| `linuxdoom-1.10/p_spec.h` | `src/linuxdoom-1.10/p_spec.h.ts` | Parcial | Enums, structs y constantes originales de movers e iluminación. Botones/interruptores y demás especiales pendientes. |
| `linuxdoom-1.10/p_switch.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_telept.c` | `src/linuxdoom-1.10/p_telept.ts` | Adaptado a web | EV_Teleport completo: destino por sector/thinker, P_TeleportMove real, telefrag, niebla, ángulo y bloqueo temporal del jugador. Sonido mediante contexto de plataforma. |
| `linuxdoom-1.10/p_tick.c` | `src/linuxdoom-1.10/p_tick.ts` | Adaptado a web | Lista circular, eliminación diferida y orden original del ticker. Dependencias de doomstat/p_user/p_spec inyectadas obligatoriamente; GC sustituye Z_Free. |
| `linuxdoom-1.10/p_tick.h` | `src/linuxdoom-1.10/p_tick.h.ts` | Adaptado a web | P_Ticker con contexto explícito de juego. |
| `linuxdoom-1.10/p_user.c` | `src/linuxdoom-1.10/p_user.ts` | Adaptado a web | Cinco funciones originales: thrust, bob/altura, movimiento, muerte y ticker de jugador. Contexto obligatorio de psprites, sector especial y uso; control aún sin conectar al bucle web. |
| `linuxdoom-1.10/r_bsp.c` | `src/linuxdoom-1.10/r_bsp.ts` | Adaptado a web | Recorte angular, solidsegs/portales, BBox, BSP front-to-back y recogida de sprites por sector. |
| `linuxdoom-1.10/r_bsp.h` | `src/linuxdoom-1.10/r_bsp.h.ts` | Adaptado a web | Interfaz de visibilidad; globals compartidos como bsp/wall/planes. |
| `linuxdoom-1.10/r_data.c` | `src/linuxdoom-1.10/r_data.ts` | Adaptado a web | PNAMES/TEXTURE1/2, composiciones, flats, sprites, COLORMAP y precache con contexto explícito; GC sustituye Z_Zone. |
| `linuxdoom-1.10/r_data.h` | `src/linuxdoom-1.10/r_data.h.ts` | Adaptado a web | Interfaz de recursos; precache recibe contexto de juego explícito. |
| `linuxdoom-1.10/r_defs.h` | `src/linuxdoom-1.10/r_defs.h.ts` | Adaptado a web | Tipos de mapa/render; spans con base explícita y visplanes con arrays acolchados. |
| `linuxdoom-1.10/r_draw.c` | `src/linuxdoom-1.10/r_draw.ts` | Adaptado a web | Variables globales mutables agrupadas en draw; punteros a filas como offsets. Primitivas, no renderer BSP. |
| `linuxdoom-1.10/r_draw.h` | — | Pendiente |  |
| `linuxdoom-1.10/r_local.h` | — | Pendiente |  |
| `linuxdoom-1.10/r_main.c` | `src/linuxdoom-1.10/r_main.ts` | Adaptado a web | Geometría, proyección, luz, R_Init/R_SetupFrame/R_RenderPlayerView; NetUpdate inyectado obligatoriamente en el frame de jugador. |
| `linuxdoom-1.10/r_main.h` | `src/linuxdoom-1.10/r_main.h.ts` | Adaptado a web | Interfaz completa de geometría y render; globals como view. |
| `linuxdoom-1.10/r_plane.c` | `src/linuxdoom-1.10/r_plane.ts` | Adaptado a web | Visplanes, spans de suelos/techos y cielo; buffers acolchados, límites explícitos y GC. |
| `linuxdoom-1.10/r_plane.h` | `src/linuxdoom-1.10/r_plane.h.ts` | Adaptado a web | Interfaz de visplanes/planes; globals agrupados en planes. |
| `linuxdoom-1.10/r_segs.c` | `src/linuxdoom-1.10/r_segs.ts` | Adaptado a web | Tiers opacos y masked midtextures con recorte y orden por profundidad; composite masked fuera del formato de cache clásico se rechaza. |
| `linuxdoom-1.10/r_segs.h` | `src/linuxdoom-1.10/r_segs.h.ts` | Adaptado a web | Interfaz de paredes y R_RenderMaskedSegRange. |
| `linuxdoom-1.10/r_sky.c` | `src/linuxdoom-1.10/r_sky.ts` | Traducido |  |
| `linuxdoom-1.10/r_sky.h` | `src/linuxdoom-1.10/r_sky.h.ts` | Traducido |  |
| `linuxdoom-1.10/r_state.h` | `src/linuxdoom-1.10/r_state.h.ts` | Adaptado a web | Mapa, texturas, sprites, vista, planes y paredes exportados mediante objetos compartidos. |
| `linuxdoom-1.10/r_things.c` | `src/linuxdoom-1.10/r_things.ts` | Adaptado a web | Frames/rotaciones, proyección, posts, profundidad, sombras/traducciones y psprites; arrays y spans sustituyen punteros. |
| `linuxdoom-1.10/r_things.h` | `src/linuxdoom-1.10/r_things.h.ts` | Adaptado a web | Interfaz del renderer de sprites. Prototipos obsoletos sin implementación en C no se añaden como stubs. |
| `linuxdoom-1.10/s_sound.c` | — | Pendiente |  |
| `linuxdoom-1.10/s_sound.h` | — | Pendiente |  |
| `linuxdoom-1.10/sounds.c` | — | Pendiente |  |
| `linuxdoom-1.10/sounds.h` | `src/linuxdoom-1.10/sounds.h.ts` | Parcial | Enums de efectos/música para info.c; estructuras y tablas de audio pendientes. |
| `linuxdoom-1.10/st_lib.c` | — | Pendiente |  |
| `linuxdoom-1.10/st_lib.h` | — | Pendiente |  |
| `linuxdoom-1.10/st_stuff.c` | — | Pendiente |  |
| `linuxdoom-1.10/st_stuff.h` | — | Pendiente |  |
| `linuxdoom-1.10/tables.c` | `src/linuxdoom-1.10/tables.ts` | Traducido |  |
| `linuxdoom-1.10/tables.h` | `src/linuxdoom-1.10/tables.h.ts` | Traducido |  |
| `linuxdoom-1.10/v_video.c` | `src/linuxdoom-1.10/v_video.ts` | Adaptado a web | Punteros convertidos a offsets y Uint8Array; validación binaria adicional; gamma literal. |
| `linuxdoom-1.10/v_video.h` | `src/linuxdoom-1.10/v_video.h.ts` | Adaptado a web | Reexports y tipos de la implementación web. |
| `linuxdoom-1.10/w_wad.c` | `src/linuxdoom-1.10/w_wad.ts` | Adaptado a web | Archivos en memoria; carga asíncrona en web; reload explícito; GC en lugar de Z_Zone; perfil devuelto como texto. |
| `linuxdoom-1.10/w_wad.h` | `src/linuxdoom-1.10/w_wad.h.ts` | Adaptado a web | WadFile sustituye al nombre de archivo del sistema. |
| `linuxdoom-1.10/wi_stuff.c` | — | Pendiente |  |
| `linuxdoom-1.10/wi_stuff.h` | — | Pendiente |  |
| `linuxdoom-1.10/z_zone.c` | — | Pendiente |  |
| `linuxdoom-1.10/z_zone.h` | — | Pendiente |  |
| `sersrc/DOOMNET.C` | — | Pendiente |  |
| `sersrc/DOOMNET.H` | — | Pendiente |  |
| `sersrc/PORT.C` | — | Pendiente |  |
| `sersrc/SERSETUP.C` | — | Pendiente |  |
| `sersrc/SERSETUP.H` | — | Pendiente |  |
| `sersrc/SERSTR.H` | — | Pendiente |  |
| `sersrc/SER_FRCH.H` | — | Pendiente |  |
| `sndserv/linux.c` | — | Pendiente |  |
| `sndserv/sounds.c` | — | Pendiente |  |
| `sndserv/sounds.h` | — | Pendiente |  |
| `sndserv/soundsrv.c` | — | Pendiente |  |
| `sndserv/soundsrv.h` | — | Pendiente |  |
| `sndserv/soundst.h` | — | Pendiente |  |
| `sndserv/wadread.c` | — | Pendiente |  |
| `sndserv/wadread.h` | — | Pendiente |  |
