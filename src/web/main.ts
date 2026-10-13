import './style.css';
import { V_Init, V_DrawPatch, V_PatchHeader, V_SetGamma, usegamma, screens } from '../linuxdoom-1.10/v_video';
import { I_InitGraphics, I_SetPalette, I_FinishUpdate, I_ShutdownGraphics } from '../linuxdoom-1.10/i_video';
import { W_InitMultipleFiles, W_CacheLumpName, W_CheckNumForName, W_NumLumps } from '../linuxdoom-1.10/w_wad';
import { wipe_StartScreen, wipe_EndScreen, wipe_ScreenWipe } from '../linuxdoom-1.10/f_wipe';
import { listMaps, loadMapPreview, drawMapPreview } from './map-preview';
import { demoWad } from './demo';
import { R_InitData, R_GetColumn, texturestate } from '../linuxdoom-1.10/r_data';
import { P_LoadMapData } from '../linuxdoom-1.10/p_setup';
import { R_PointInSubsector } from '../linuxdoom-1.10/r_main';
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
let resourcesReady = false;
let loaded = false, animating = false, loadGeneration = 0;
let lastView = new Uint8Array(320 * 200), animation = 0;
V_Init(); I_InitGraphics(canvas);
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
}
function render(): void {
    stopWipe();
    if (!loaded) return;
    if (viewSelect.value === 'map' || viewSelect.value === 'level') {
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
    stopWipe();
    W_InitMultipleFiles(files);
    resourcesReady = false; textureSelect.disabled = true; textureSelect.replaceChildren(new Option('Selecciona la vista de texturas',''));
    loaded = true;
    if (W_CheckNumForName('PLAYPAL') < 0) {
        const gray = new Uint8Array(768); for (let i = 0; i < 256; i++) gray.fill(i, i * 3, i * 3 + 3);
        I_SetPalette(gray);
    } else I_SetPalette(W_CacheLumpName('PLAYPAL', 1));
    const maps = listMaps();
    mapSelect.replaceChildren(...maps.map(map => new Option(map.name, String(map.index))));
    mapSelect.disabled = maps.length === 0;
    if (!maps.length) mapSelect.add(new Option('Sin mapas', ''));
    viewSelect.value = W_CheckNumForName('TITLEPIC') >= 0 || !maps.length ? 'title' : 'map';
    report(`${synthetic ? 'Datos sintéticos de prueba' : files.map(f => f.name).join(' + ')} · ${W_NumLumps().toLocaleString('es')} recursos · ${maps.length} ${maps.length === 1 ? 'mapa' : 'mapas'}`);
    render();
    if (synthetic) { label.textContent = 'PRUEBA DE VÍDEO / SIN DATOS COMERCIALES'; }
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
demoButton.addEventListener('click', () => safely(() => { loadGeneration++; load([{ name: 'test.wad', data: demoWad() }], true); }));
viewSelect.addEventListener('change', () => safely(render)); mapSelect.addEventListener('change', () => safely(render));
textureSelect.addEventListener('change', () => safely(render));
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
window.addEventListener('pagehide', () => { stopWipe(); I_ShutdownGraphics(); });
safely(() => load([{ name: 'test.wad', data: demoWad() }], true));
