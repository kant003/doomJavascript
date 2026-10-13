// Development utility, not a conversion of p_setup.c or am_map.c.
import { ML_VERTEXES, ML_LINEDEFS, ML_THINGS, ML_TWOSIDED, ML_DONTDRAW } from '../linuxdoom-1.10/doomdata.h';
import type { mapvertex_t, maplinedef_t, mapthing_t } from '../linuxdoom-1.10/doomdata.h';
import { lumpinfo, W_CacheLumpNum } from '../linuxdoom-1.10/w_wad';
import { screens } from '../linuxdoom-1.10/v_video';
import { SCREENWIDTH, SCREENHEIGHT } from '../linuxdoom-1.10/doomdef.h';
export function listMaps(): { name: string; index: number }[] {
    return lumpinfo.flatMap((l, index) => /^(E\dM\d|MAP\d\d)$/.test(l.name) && lumpinfo[index + 1]?.name === 'THINGS' ? [{ name: l.name, index }] : []);
}
function records<T>(index: number, offset: number, name: string, size: number, read: (view: DataView, p: number) => T): T[] {
    if (lumpinfo[index + offset]?.name !== name) throw new Error(`El mapa no tiene ${name} en el orden clásico de DOOM`);
    const bytes = W_CacheLumpNum(index + offset, 1);
    if (bytes.length % size) throw new Error(`${name}: tamaño de registro inválido`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), result: T[] = [];
    for (let p = 0; p < bytes.length; p += size) result.push(read(view, p));
    return result;
}
export interface MapPreview { vertices: mapvertex_t[]; lines: maplinedef_t[]; things: mapthing_t[] }
export function loadMapPreview(index: number): MapPreview {
    const vertices = records(index, ML_VERTEXES, 'VERTEXES', 4, (v, p) => ({ x: v.getInt16(p, true), y: v.getInt16(p + 2, true) }));
    const lines = records(index, ML_LINEDEFS, 'LINEDEFS', 14, (v, p): maplinedef_t => ({
        v1: v.getUint16(p, true), v2: v.getUint16(p + 2, true), flags: v.getInt16(p + 4, true),
        special: v.getInt16(p + 6, true), tag: v.getInt16(p + 8, true), sidenum: [v.getInt16(p + 10, true), v.getInt16(p + 12, true)]
    }));
    const things = records(index, ML_THINGS, 'THINGS', 10, (v, p) => ({ x: v.getInt16(p, true), y: v.getInt16(p + 2, true), angle: v.getInt16(p + 4, true), type: v.getInt16(p + 6, true), options: v.getInt16(p + 8, true) }));
    if (!vertices.length || lines.some(l => l.v1 >= vertices.length || l.v2 >= vertices.length)) throw new Error('Mapa sin vértices o con índices fuera de rango');
    return { vertices, lines, things };
}
export function drawMapPreview(map: MapPreview): void {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const v of map.vertices) { minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); }
    const scale = Math.min((SCREENWIDTH - 24) / Math.max(1, maxx - minx), (SCREENHEIGHT - 24) / Math.max(1, maxy - miny));
    const transform = (v: mapvertex_t): [number, number] => [Math.round(160 + (v.x - (minx + maxx) / 2) * scale), Math.round(100 - (v.y - (miny + maxy) / 2) * scale)];
    screens[0].fill(0);
    const pixel = (x: number, y: number, color: number): void => { if (x >= 0 && x < SCREENWIDTH && y >= 0 && y < SCREENHEIGHT) screens[0][y * SCREENWIDTH + x] = color; };
    for (const line of map.lines) {
        if (line.flags & ML_DONTDRAW) continue;
        let [x, y] = transform(map.vertices[line.v1]);
        const [x2, y2] = transform(map.vertices[line.v2]);
        const dx = Math.abs(x2 - x), dy = -Math.abs(y2 - y), sx = x < x2 ? 1 : -1, sy = y < y2 ? 1 : -1;
        let err = dx + dy;
        while (true) {
            pixel(x, y, line.flags & ML_TWOSIDED ? 96 : 176);
            if (x === x2 && y === y2) break;
            const e2 = err * 2;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    }
    for (const thing of map.things) if (thing.type === 1) {
        const [x, y] = transform(thing), angle = thing.angle * Math.PI / 180;
        for (let i = 0; i < 6; i++) pixel(Math.round(x + Math.cos(angle) * i), Math.round(y - Math.sin(angle) * i), 112);
        for (let i = -2; i <= 2; i++) { pixel(x + i, y, 112); pixel(x, y + i, 112); }
    }
}
