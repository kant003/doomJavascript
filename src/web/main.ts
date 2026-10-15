import { stateenum_t as WI } from '../linuxdoom-1.10/wi_stuff.h';
import './style.css';
import { WebAudioBackend } from './audio';
import { I_InstallSoundBackend,I_InitSound,I_ShutdownSound } from '../linuxdoom-1.10/i_sound';
import { S_Init,S_StartSound,S_StopSound,S_SetSfxVolume } from '../linuxdoom-1.10/s_sound';
import { S_sfx } from '../linuxdoom-1.10/sounds';
import { V_Init, V_DrawPatch, V_PatchHeader, V_SetGamma, usegamma, screens } from '../linuxdoom-1.10/v_video';
import { I_InitGraphics, I_SetPalette, I_FinishUpdate, I_ShutdownGraphics } from '../linuxdoom-1.10/i_video';
import { W_InitMultipleFiles, W_CacheLumpName, W_CheckNumForName, W_NumLumps } from '../linuxdoom-1.10/w_wad';
import { wipe_StartScreen, wipe_EndScreen, wipe_ScreenWipe } from '../linuxdoom-1.10/f_wipe';
import { listMaps, loadMapPreview, drawMapPreview } from './map-preview';
import { playableDemoWad } from './playable-demo';
import { weaponinfo } from '../linuxdoom-1.10/d_items';
import { ammotype_t as AM } from '../linuxdoom-1.10/doomdef.h';
import { setupMapSky } from './map-sky';
import { gamestate_t as GS,GameMode_t as MODE } from '../linuxdoom-1.10/doomdef.h';
import { BrowserGame } from './game-loop';
import { R_InitData, R_GetColumn, texturestate } from '../linuxdoom-1.10/r_data';
import { P_LoadMapData } from '../linuxdoom-1.10/p_setup';
import { R_PointInSubsector, R_InitLightTables, R_SetViewSize, R_ExecuteSetViewSize } from '../linuxdoom-1.10/r_main';
import { WorldPreview } from './world-preview';
import { R_InitSprites } from '../linuxdoom-1.10/r_things';
import { sprnames } from '../linuxdoom-1.10/info';
import { createStaticMapActors } from './map-actors';
import { R_InitTranslationTables } from '../linuxdoom-1.10/r_draw';
import { sky, R_InitSkyMap } from '../linuxdoom-1.10/r_sky';
import { R_CheckTextureNumForName, R_FlatNumForName } from '../linuxdoom-1.10/r_data';
import { R_InitBuffer, R_DrawColumn, draw } from '../linuxdoom-1.10/r_draw';
import { FRACUNIT } from '../linuxdoom-1.10/m_fixed.h';
import type { WadFile } from '../linuxdoom-1.10/w_wad.h';
function element<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing element #${id}`);
    return node as T;
}
const canvas = element<HTMLCanvasElement>('screen'), input = element<HTMLInputElement>('wad');
const status = element<HTMLParagraphElement>('status'), mapSelect = element<HTMLSelectElement>('maps');
const viewSelect = element<HTMLSelectElement>('view'), label = element('display-label');
const wipeButton = element<HTMLButtonElement>('wipe'), demoButton = element<HTMLButtonElement>('demo');
const textureSelect = element<HTMLSelectElement>('textures');
const soundSelect=element<HTMLSelectElement>('sounds'),soundPlay=element<HTMLButtonElement>('sound-play');
const soundStop=element<HTMLButtonElement>('sound-stop'),soundStatus=element('sound-status'),soundVolume=element<HTMLInputElement>('sound-volume');
const audio=new WebAudioBackend();I_InstallSoundBackend(audio);
let soundGeneration=0,syntheticAudio=false;
function soundLevel():number {return Math.round(Number(soundVolume.value)*127/15);}
function loadSounds(synthetic:boolean):void {
    soundGeneration++;syntheticAudio=synthetic;I_InitSound();S_Init(soundLevel(),0);
    const available=S_sfx.map((sfx,id)=>({sfx,id})).filter(({sfx,id})=>id>0&&W_CheckNumForName(`ds${(sfx.link??sfx).name}`)>=0);
    soundSelect.replaceChildren(...available.map(({sfx,id})=>new Option(sfx.name,String(id))));
    soundSelect.disabled=soundPlay.disabled=soundStop.disabled=!available.length;
    if(!available.length)soundSelect.add(new Option('Sin efectos disponibles',''));
    soundStatus.textContent=synthetic?'Los datos de prueba incluyen un tono sintético, no el disparo original.':available.length?`${available.length} efectos disponibles. Pulsa Probar sonido para escucharlos.`:'Este WAD no contiene efectos identificados en las tablas del motor.';
}
let playing=false,gameStartGeneration=0;
let resourcesReady = false;
let loaded = false, animating = false, loadGeneration = 0;
let lastView = new Uint8Array(320 * 200), animation = 0;
V_Init(); I_InitGraphics(canvas);
const worldPreview = new WorldPreview(() => { lastView = screens[0].slice(); }, error => report(error instanceof Error ? error.message : String(error),true));

const gameHud=element('game-hud'),gameMessage=element('game-message'),summary=element('level-summary');
let focusCompletion=false;
const browserGame=new BrowserGame(session=>{
    const p=session.player,ammo=weaponinfo[p.readyweapon].ammo,text=`Salud ${p.health} · Armadura ${p.armorpoints} · ${ammo===AM.am_noammo?'Cuerpo a cuerpo':`Munición ${p.ammo[ammo]}`} · Bajas ${p.killcount}/${session.state.totalkills}${browserGame.paused?' · PAUSA':''}`;
    label.textContent=`${session.mapname} / ${session.completed?'RESUMEN':'PARTIDA'}`;
    const selected=Array.from(mapSelect.options).find(option=>option.textContent===session.mapname);if(selected&&mapSelect.value!==selected.value)mapSelect.value=selected.value;
    const result=session.result;summary.hidden=!result;
    element<HTMLButtonElement>('game-pause').disabled=session.completed;
    if(result){
        element('level-summary-title').textContent=`${result.mapname} · ${result.terminal?(session.state.gamemode===MODE.commercial?'Fin de campaña':'Fin de episodio'):result.secret?'Salida secreta':'Nivel completado'}`;
        const wi=session.intermission;
        const score=(value:number,total:number,count:number)=>`${value} / ${total} · ${count<0?'—':`${count}%`}`;
        element('result-kills').textContent=score(result.kills,result.maxkills,wi?.kills??Math.trunc(100*result.kills/Math.max(1,result.maxkills)));
        element('result-items').textContent=score(result.items,result.maxitems,wi?.items??Math.trunc(100*result.items/Math.max(1,result.maxitems)));
        element('result-secrets').textContent=score(result.secrets,result.maxsecrets,wi?.secret??Math.trunc(100*result.secrets/Math.max(1,result.maxsecrets)));
        const time=(seconds:number)=>seconds<0?'—':`${Math.trunc(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        element('result-time').textContent=time(wi?.time??Math.trunc(result.tics/35));
        element('result-par').textContent=wi?time(wi.par):'—';
        const next=session.nextMapName,finale=session.state.gamestate===GS.GS_FINALE;
        const counting=!!wi&&wi.state===WI.StatCount&&wi.sp_state!==10;
        const entering=!!wi&&wi.state!==WI.StatCount;
        element('intermission-help').textContent=counting?'F o Espacio: completar el recuento.':finale&&result.terminal?'Fin. Puedes reiniciar o elegir otro mapa.':!result.terminal&&!session.nextAvailable?'Falta el mapa de destino.':entering?(result.terminal?'Preparando el final…':'Preparando el siguiente mapa…'):'F o Espacio: avanzar.';
        element('next-map').textContent=result.terminal?'Puedes reiniciar o elegir otro mapa.':session.nextAvailable?`${finale?'Fin de tramo. ':''}Siguiente mapa: ${next}`:`El mapa ${next} no está cargado. Selecciona un WAD que lo incluya para jugarlo.`;
        const button=element<HTMLButtonElement>('next-level');button.hidden=result.terminal&&finale;
        button.disabled=(!counting&&!result.terminal&&!session.nextAvailable)||wi?.state===WI.NoState;
        button.textContent=counting?'Completar recuento':result.terminal?'Finalizar':entering?`Entrar en ${next}`:`Continuar a ${next}`;
        if(focusCompletion){focusCompletion=false;summary.scrollIntoView({block:'nearest'});summary.focus({preventScroll:true});}
    }
    if(gameHud.textContent!==text)gameHud.textContent=text;
    element('game-pause').textContent=browserGame.paused?'Continuar':'Pausa';
    if(!session.completed&&gameMessage.textContent!==(p.message??''))gameMessage.textContent=p.message??'';
    lastView=screens[0].slice();
},error=>report(error instanceof Error?error.message:String(error),true),{
    resetStatus:()=>{gameHud.textContent='Iniciando jugador…';},resetMessages:()=>{gameMessage.textContent='';},
    closeAutomap:()=>{viewSelect.value='world';},tactile:()=>{canvas.animate([{opacity:0.6},{opacity:1}],{duration:180});},
    onExit:secret=>{focusCompletion=true;gameMessage.textContent=secret?'Salida secreta.':'Nivel completado.';}
});
function report(message: string, error = false): void { status.textContent = message; status.classList.toggle('error', error); }
function safely(action: () => void): void { try { action(); } catch (error) { report(error instanceof Error ? error.message : String(error), true); } }
function stopWipe(): void {
    if (animation) cancelAnimationFrame(animation);
    if (animating) screens[0].set(lastView);
    animation = 0; animating = false; wipeButton.disabled = false;
}
function initResources(): void {
    if (resourcesReady) return;
    R_InitData(); resourcesReady = true;
    textureSelect.replaceChildren(...texturestate.textures.map((texture,i) => new Option(texture.name,String(i))));
    textureSelect.disabled = texturestate.numtextures === 0;
    if (texturestate.numtextures > 1) textureSelect.value = '1';
}
function render(): void {
    stopWipe(); worldPreview.stop();browserGame.stop();summary.hidden=true;focusCompletion=false;
    element('camera-help').hidden = playing||viewSelect.value !== 'world'; element('camera-buttons').hidden = playing||viewSelect.value !== 'world'; element('camera-reset').hidden = playing||viewSelect.value !== 'world';
    for(const id of ['game-buttons','game-help','game-hud','game-message'])element(id).hidden=!playing;
    element('game-start').textContent=playing?'Reiniciar partida':'Jugar este mapa';
    wipeButton.disabled = playing||viewSelect.value === 'world';
    if (!loaded) return;
    if (playing||viewSelect.value === 'world') {
        if (mapSelect.value === '') throw new Error('Este WAD no contiene mapas clásicos');
        initResources();
        const index = Number(mapSelect.value), level = P_LoadMapData(index);
        const player = level.things.find(thing => thing.type === 1);
        if (!player) throw new Error('No se ha encontrado el inicio del jugador 1');
        R_InitSprites(sprnames); const actors = playing?[]:createStaticMapActors(); R_InitTranslationTables();
        R_InitLightTables(); R_SetViewSize(11,0); R_ExecuteSetViewSize(); R_InitSkyMap();

        const name = mapSelect.selectedOptions[0].textContent ?? '';
        setupMapSky(name);
        const subsector = R_PointInSubsector(player.x*FRACUNIT,player.y*FRACUNIT);
        if (!subsector.sector) throw new Error('Inicio sin sector');
        const camera = {x:player.x*FRACUNIT,y:player.y*FRACUNIT,z:subsector.sector.floorheight+41*FRACUNIT,angle:Math.floor(player.angle/360*0x100000000)>>>0};
        screens[0].fill(0); 
        if(playing)browserGame.start(name);else worldPreview.start(camera);
        label.textContent = `${name} / ${playing?'PARTIDA':'VISTA 3D'}`;
        element('frame-state').textContent = playing?'Simulación nativa · un jugador · 35 tics/s':`${actors.length} ${actors.length === 1 ? 'objeto estático' : 'objetos estáticos'} · cámara libre`;
    } else if (viewSelect.value === 'map' || viewSelect.value === 'level') {
        if (mapSelect.value === '') throw new Error('Este WAD no contiene mapas clásicos de DOOM');
        const map = loadMapPreview(Number(mapSelect.value));
        let diagnostic = '';
        if (viewSelect.value === 'level') {
            initResources();
            const level = P_LoadMapData(Number(mapSelect.value));
            const player = level.things.find(thing => thing.type === 1);
            const subsector = player ? R_PointInSubsector(player.x * FRACUNIT,player.y * FRACUNIT) : null;
            const sector = subsector ? level.sectors.indexOf(subsector.sector!) : -1;
            diagnostic = `${level.numsectors} ${level.numsectors === 1 ? 'sector' : 'sectores'} · ${level.numsegs} segs · ${level.numnodes} nodos BSP${sector >= 0 ? ` · inicio en sector ${sector}` : ''}`;
        }
        drawMapPreview(map); label.textContent = `${mapSelect.selectedOptions[0].textContent} / ${viewSelect.value === 'level' ? 'DATOS DEL NIVEL' : 'GEOMETRÍA'}`;
        element('frame-state').textContent = diagnostic || `${map.vertices.length} vértices · ${map.lines.length} líneas · ${map.things.length} ${map.things.length === 1 ? 'objeto' : 'objetos'}`;
    } else if (viewSelect.value === 'texture') {
        initResources();
        const texnum = Number(textureSelect.value), texture = texturestate.textures[texnum];
        if (!texture) throw new Error('No hay texturas de pared disponibles');
        screens[0].fill(0); R_InitBuffer(320,200);
        draw.dc_colormap = texturestate.colormaps.subarray(0,256);
        draw.dc_yl = 0; draw.dc_yh = 199; draw.dc_iscale = FRACUNIT; draw.dc_texturemid = 100 * FRACUNIT;
        for (let x=0;x<320;x++) {
            draw.dc_x = x; draw.dc_source = R_GetColumn(texnum,x);
            // R_DrawColumn uses classic 128-pixel wrapping. Preview other heights by normalizing the sample column.
            if (texture.height !== 128) draw.dc_source = Uint8Array.from({length:128},(_,y)=>draw.dc_source[y % texture.height]);
            R_DrawColumn();
        }
        label.textContent = `${texture.name} / COLUMNAS ORIGINALES`;
        element('frame-state').textContent = `${texture.width} × ${texture.height} · ${texture.patchcount} ${texture.patchcount === 1 ? 'patch' : 'patches'}`;
    } else {
        const name = ['TITLEPIC', 'INTERPIC', 'CREDIT'].find(n => W_CheckNumForName(n) >= 0);
        if (!name) throw new Error('No se ha encontrado TITLEPIC, INTERPIC o CREDIT. Puedes seleccionar la vista del mapa.');
        const patch = W_CacheLumpName(name, 1), h = V_PatchHeader(patch);
        if (h.width > 320 || h.height > 200) throw new Error('La imagen supera la pantalla clásica de 320 × 200');
        screens[0].fill(0);
        V_DrawPatch(Math.floor((320 - h.width) / 2) + h.leftoffset, Math.floor((200 - h.height) / 2) + h.topoffset, 0, patch);
        label.textContent = `${name} / PALETA ORIGINAL`;
        element('frame-state').textContent = 'Framebuffer de 8 bits → Canvas';
    }
    lastView = screens[0].slice(); I_FinishUpdate();
}
function load(files: WadFile[], synthetic: boolean): void {
    stopWipe(); worldPreview.stop();browserGame.stop();
    gameStartGeneration++;playing=false;W_InitMultipleFiles(files);loadSounds(synthetic);
    resourcesReady = false; textureSelect.disabled = true; textureSelect.replaceChildren(new Option('Selecciona la vista de texturas',''));
    loaded = true;
    if (W_CheckNumForName('PLAYPAL') < 0) {
        const gray = new Uint8Array(768); for (let i = 0; i < 256; i++) gray.fill(i, i * 3, i * 3 + 3);
        I_SetPalette(gray);
    } else I_SetPalette(W_CacheLumpName('PLAYPAL', 1));
    const maps = listMaps();
    mapSelect.replaceChildren(...maps.map(map => new Option(map.name, String(map.index))));
    mapSelect.disabled = maps.length === 0;element<HTMLButtonElement>('game-start').disabled=maps.length===0;
    if (!maps.length) mapSelect.add(new Option('Sin mapas', ''));
    viewSelect.value = maps.length ? 'world' : 'title';
    report(`${synthetic ? 'Datos sintéticos de prueba' : files.map(f => f.name).join(' + ')} · ${W_NumLumps().toLocaleString('es')} recursos · ${maps.length} ${maps.length === 1 ? 'mapa' : 'mapas'}`);
    render();
    if (synthetic && viewSelect.value === 'title') { label.textContent = 'PRUEBA DE VÍDEO / SIN DATOS COMERCIALES'; }
}
input.addEventListener('change', async () => {
    const selected = Array.from(input.files ?? []);
    if (!selected.length) return;
    const generation = ++loadGeneration;
    report('Leyendo archivos…');
    try {
        const files = await Promise.all(selected.map(async file => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) })));
        if (generation !== loadGeneration) return;
        // File picker ordering is unspecified: place the IWAD first, PWADs afterwards.
        files.sort((a, b) => Number(new TextDecoder().decode(b.data.subarray(0, 4)) === 'IWAD') - Number(new TextDecoder().decode(a.data.subarray(0, 4)) === 'IWAD'));
        load(files, false);
    } catch (error) { if (generation === loadGeneration) report(error instanceof Error ? error.message : String(error), true); }
    input.value = '';
});
demoButton.addEventListener('click', () => safely(() => { loadGeneration++; load([{ name: 'test.wad', data: playableDemoWad(true) }], true); }));
viewSelect.addEventListener('change', () => safely(()=>{gameStartGeneration++;playing=false;render();})); mapSelect.addEventListener('change', () => safely(()=>{gameStartGeneration++;playing=false;render();}));
textureSelect.addEventListener('change', () => safely(()=>{gameStartGeneration++;playing=false;render();}));
element('game-start').addEventListener('click',async()=>{
    const generation=++gameStartGeneration;
    try {await audio.resume();if(generation!==gameStartGeneration)return;playing=true;render();canvas.focus();}
    catch(error){if(generation!==gameStartGeneration)return;playing=false;browserGame.stop();report(error instanceof Error?error.message:String(error),true);}
});
summary.addEventListener('keydown',event=>{if(event.target===summary&&!event.repeat&&[' ','f','F','Control'].includes(event.key)){event.preventDefault();browserGame.continueLevel();}});
element('next-level').addEventListener('click',()=>safely(()=>{browserGame.continueLevel();canvas.focus();}));
element('game-stop').addEventListener('click',()=>safely(()=>{gameStartGeneration++;playing=false;render();}));
element('game-pause').addEventListener('click',()=>{browserGame.togglePause();canvas.focus();});
element('camera-left').addEventListener('click', () => safely(() => worldPreview.nudge(97)));
element('camera-forward').addEventListener('click', () => safely(() => worldPreview.nudge(119)));
element('camera-right').addEventListener('click', () => safely(() => worldPreview.nudge(100)));
element('camera-reset').addEventListener('click', () => safely(() => worldPreview.reset()));
element<HTMLButtonElement>('gamma').addEventListener('click', () => {
    V_SetGamma(usegamma + 1); element('gamma').textContent = `Gamma: ${usegamma}`; I_FinishUpdate();
});
element('fullscreen').addEventListener('click', () => { canvas.requestFullscreen().catch(() => report('Pantalla completa no disponible en este navegador', true)); });
wipeButton.addEventListener('click', () => safely(() => {
    if (!loaded || animating) return;
    lastView = screens[0].slice();
    screens[0].fill(0); wipe_StartScreen(0, 0, 320, 200);
    screens[0].set(lastView); wipe_EndScreen(0, 0, 320, 200);
    animating = true; wipeButton.disabled = true;
    let previous: number | null = null, accumulator = 0;
    const step = (now: number): void => {
        if (!animating) return;
        accumulator += previous === null ? 1000 / 35 : Math.min(now - previous, 200);
        previous = now;
        const ticks = Math.floor(accumulator * 35 / 1000);
        if (ticks) {
            accumulator -= ticks * 1000 / 35;
            const done = wipe_ScreenWipe(1, 0, 0, 320, 200, ticks);
            I_FinishUpdate();
            if (done) { animating = false; animation = 0; wipeButton.disabled = false; return; }
        }
        animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
}));
soundPlay.addEventListener('click',async()=>{
    const generation=++soundGeneration,id=Number(soundSelect.value);
    try {
        await audio.resume();if(generation!==soundGeneration)return;
        S_SetSfxVolume(soundLevel());S_StartSound(null,id);
        soundStatus.textContent=syntheticAudio?'Tono sintético reproducido.':`Reproduciendo ${S_sfx[id].name}.`;
    }catch(error){if(generation===soundGeneration)soundStatus.textContent=error instanceof Error?error.message:String(error);}
});
soundStop.addEventListener('click',()=>{soundGeneration++;S_StopSound(null);soundStatus.textContent='Reproducción detenida.';});
soundVolume.addEventListener('input',()=>{S_SetSfxVolume(soundLevel());S_StopSound(null);});
window.addEventListener('pagehide',()=>{soundGeneration++;I_ShutdownSound();void audio.close().catch(()=>{});});
window.addEventListener('pagehide', () => { worldPreview.stop(); browserGame.stop(); stopWipe(); I_ShutdownGraphics(); });
safely(() => load([{ name: 'test.wad', data: playableDemoWad(true) }], true));
