# Estado de la conversión

Fuente: https://github.com/id-Software/DOOM, commit `a77dfb96cb91780ca334d0d4cfd86957558007e0`.

**El motor completo todavía no está convertido.** Este inventario registra 146 ficheros C/H del repositorio original, incluidos IPX, serie y el servidor de sonido. El estado es explícito; la existencia de un fichero no implica que el módulo esté terminado.

Traducido: **24** · Adaptado a web: **15** · Parcial: **14** · Pendiente: **93**

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
| `linuxdoom-1.10/d_englsh.h` | — | Pendiente |  |
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
| `linuxdoom-1.10/info.c` | — | Pendiente |  |
| `linuxdoom-1.10/info.h` | `src/linuxdoom-1.10/info.h.ts` | Parcial | Todos los enums y structs state_t/mobjinfo_t; tablas y declaraciones de info.c pendientes. |
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
| `linuxdoom-1.10/p_ceilng.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_doors.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_enemy.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_floor.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_inter.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_inter.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_lights.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_local.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_map.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_maputl.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_mobj.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_mobj.h` | `src/linuxdoom-1.10/p_mobj.h.ts` | Traducido | Flags y todos los campos de mobj_t; implementación p_mobj.c pendiente. |
| `linuxdoom-1.10/p_plats.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_pspr.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_pspr.h` | `src/linuxdoom-1.10/p_pspr.h.ts` | Traducido | Enums, flags y estructura pspdef_t. |
| `linuxdoom-1.10/p_saveg.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_saveg.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_setup.c` | `src/linuxdoom-1.10/p_setup.ts` | Parcial | Todos los lectores geométricos, P_GroupLines y carga de THINGS con callback; P_SetupLevel/P_Init y actores pendientes. |
| `linuxdoom-1.10/p_setup.h` | `src/linuxdoom-1.10/p_setup.h.ts` | Parcial | Interfaz de lectores; ciclo completo de nivel pendiente. |
| `linuxdoom-1.10/p_sight.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_spec.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_spec.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_switch.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_telept.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_tick.c` | — | Pendiente |  |
| `linuxdoom-1.10/p_tick.h` | — | Pendiente |  |
| `linuxdoom-1.10/p_user.c` | — | Pendiente |  |
| `linuxdoom-1.10/r_bsp.c` | `src/linuxdoom-1.10/r_bsp.ts` | Parcial | Recorte angular, rangos sólidos/portales, BBox y BSP front-to-back; R_Subsector aún no llama a R_AddSprites. |
| `linuxdoom-1.10/r_bsp.h` | `src/linuxdoom-1.10/r_bsp.h.ts` | Parcial | Interfaz de visibilidad del mundo; globals obsoletos sin uso y sprites pendientes. |
| `linuxdoom-1.10/r_data.c` | `src/linuxdoom-1.10/r_data.ts` | Adaptado a web | PNAMES/TEXTURE1/2, composiciones, flats, sprites, COLORMAP y precache con contexto explícito; GC sustituye Z_Zone. |
| `linuxdoom-1.10/r_data.h` | `src/linuxdoom-1.10/r_data.h.ts` | Adaptado a web | Interfaz de recursos; precache recibe contexto de juego explícito. |
| `linuxdoom-1.10/r_defs.h` | `src/linuxdoom-1.10/r_defs.h.ts` | Adaptado a web | Tipos de mapa/render; spans con base explícita y visplanes con arrays acolchados. |
| `linuxdoom-1.10/r_draw.c` | `src/linuxdoom-1.10/r_draw.ts` | Adaptado a web | Variables globales mutables agrupadas en draw; punteros a filas como offsets. Primitivas, no renderer BSP. |
| `linuxdoom-1.10/r_draw.h` | — | Pendiente |  |
| `linuxdoom-1.10/r_local.h` | — | Pendiente |  |
| `linuxdoom-1.10/r_main.c` | `src/linuxdoom-1.10/r_main.ts` | Parcial | Geometría, proyección, escalas, iluminación, tamaño diferido y R_SetupFrame; preview del mundo sin sprites/NetUpdate. R_Init/R_RenderPlayerView completos pendientes. |
| `linuxdoom-1.10/r_main.h` | `src/linuxdoom-1.10/r_main.h.ts` | Parcial | Constantes e interfaz de geometría/vista; ciclo completo de render jugable pendiente. |
| `linuxdoom-1.10/r_plane.c` | `src/linuxdoom-1.10/r_plane.ts` | Adaptado a web | Visplanes, spans de suelos/techos y cielo; buffers acolchados, límites explícitos y GC. |
| `linuxdoom-1.10/r_plane.h` | `src/linuxdoom-1.10/r_plane.h.ts` | Adaptado a web | Interfaz de visplanes/planes; globals agrupados en planes. |
| `linuxdoom-1.10/r_segs.c` | `src/linuxdoom-1.10/r_segs.ts` | Parcial | R_StoreWallRange, R_RenderSegLoop, tiers opacos y clipping de sprites guardado; R_RenderMaskedSegRange pendiente. |
| `linuxdoom-1.10/r_segs.h` | `src/linuxdoom-1.10/r_segs.h.ts` | Parcial | Interfaz de paredes; dibujo transparente pendiente de r_things.c. |
| `linuxdoom-1.10/r_sky.c` | `src/linuxdoom-1.10/r_sky.ts` | Traducido |  |
| `linuxdoom-1.10/r_sky.h` | `src/linuxdoom-1.10/r_sky.h.ts` | Traducido |  |
| `linuxdoom-1.10/r_state.h` | `src/linuxdoom-1.10/r_state.h.ts` | Parcial | Mapa compartido; vista/proyección/planes/walls definidos en módulos convertidos. Definiciones de sprites pendientes. |
| `linuxdoom-1.10/r_things.c` | — | Pendiente |  |
| `linuxdoom-1.10/r_things.h` | — | Pendiente |  |
| `linuxdoom-1.10/s_sound.c` | — | Pendiente |  |
| `linuxdoom-1.10/s_sound.h` | — | Pendiente |  |
| `linuxdoom-1.10/sounds.c` | — | Pendiente |  |
| `linuxdoom-1.10/sounds.h` | — | Pendiente |  |
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
