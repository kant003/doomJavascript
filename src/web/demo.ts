// Synthetic fixture authored for this port. Contains no commercial DOOM assets.
function patch(width: number, height: number): Uint8Array {
    const stride = height + 5;
    const bytes = new Uint8Array(8 + width * 4 + width * stride), view = new DataView(bytes.buffer);
    view.setInt16(0, width, true); view.setInt16(2, height, true);
    for (let x = 0; x < width; x++) {
        const p = 8 + width * 4 + x * stride;
        view.setUint32(8 + x * 4, p, true);
        bytes[p] = 0; bytes[p + 1] = height;
        for (let y = 0; y < height; y++) {
            const grid = x % 32 === 0 || y % 25 === 0;
            bytes[p + 3 + y] = grid ? 240 : ((x >> 4) + (y >> 4) * 16) & 255;
        }
        bytes[p + height + 4] = 255;
    }
    return bytes;
}
export function makeWad(lumps: { name: string; data: Uint8Array }[], id = 'PWAD'): Uint8Array {
    const directory = 12 + lumps.reduce((n, l) => n + l.data.length, 0);
    const bytes = new Uint8Array(directory + lumps.length * 16), view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode(id)); view.setInt32(4, lumps.length, true); view.setInt32(8, directory, true);
    let offset = 12;
    lumps.forEach((l, i) => {
        bytes.set(l.data, offset);
        view.setInt32(directory + i * 16, offset, true); view.setInt32(directory + i * 16 + 4, l.data.length, true);
        bytes.set(new TextEncoder().encode(l.name.slice(0, 8)), directory + i * 16 + 8);
        offset += l.data.length;
    });
    return bytes;
}
export function demoWad(): Uint8Array {
    const palette = new Uint8Array(768);
    for (let i = 0; i < 256; i++) {
        palette[i * 3] = ((i >> 5) & 7) * 36;
        palette[i * 3 + 1] = ((i >> 2) & 7) * 36;
        palette[i * 3 + 2] = (i & 3) * 85;
    }
    const vertices = new Uint8Array(16), vv = new DataView(vertices.buffer);
    [[-128, -128], [128, -128], [128, 128], [-128, 128]].forEach(([x, y], i) => { vv.setInt16(i * 4, x, true); vv.setInt16(i * 4 + 2, y, true); });
    const lines = new Uint8Array(56), lv = new DataView(lines.buffer);
    for (let i = 0; i < 4; i++) { lv.setInt16(i * 14, i, true); lv.setInt16(i * 14 + 2, (i + 1) % 4, true); lv.setInt16(i * 14 + 4, 1, true); lv.setInt16(i * 14 + 12, -1, true); }
    const things = new Uint8Array(10); new DataView(things.buffer).setInt16(6, 1, true);
    const names = new Uint8Array(12);new DataView(names.buffer).setInt32(0,1,true);names.set(new TextEncoder().encode('WALLPAT'),4);
    const texture = new Uint8Array(40), tv = new DataView(texture.buffer);
    tv.setInt32(0,1,true);tv.setInt32(4,8,true);texture.set(new TextEncoder().encode('TESTWALL'),8);
    tv.setInt16(20,128,true);tv.setInt16(22,128,true);tv.setInt16(28,1,true);
    const flat = Uint8Array.from({length:4096},(_,i)=>((i&63)>>3)^((i>>6)>>3)?96:144);
    const colormap = Uint8Array.from({length:34*256},(_,i)=>Math.max(0,Math.round((i&255)*(1-Math.min(i>>8,31)/32))));
    const side = new Uint8Array(30);for(const p of [4,12]) side.set(new TextEncoder().encode('-'),p);
    side.set(new TextEncoder().encode('TESTWALL'),20);
    const sector = new Uint8Array(26), sv = new DataView(sector.buffer);sv.setInt16(2,128,true);
    sector.set(new TextEncoder().encode('TESTFLAT'),4);sector.set(new TextEncoder().encode('TESTFLAT'),12);sv.setInt16(20,192,true);
    const segs = new Uint8Array(48), gv = new DataView(segs.buffer);
    for(let i=0;i<4;i++){gv.setInt16(i*12,i,true);gv.setInt16(i*12+2,(i+1)%4,true);gv.setUint16(i*12+4,i*16384,true);gv.setInt16(i*12+6,i,true);}
    const subsector = new Uint8Array(4);new DataView(subsector.buffer).setInt16(0,4,true);
    // A 2×2 BLOCKMAP; all cells refer to a shared list of the four boundary lines.
    const blockmap = new Uint8Array(28), bv = new DataView(blockmap.buffer);
    [-128,-128,2,2,8,8,8,8,0,0,1,2,3,-1].forEach((word,i)=>bv.setInt16(i*2,word,true));
    return makeWad([
        { name: 'PLAYPAL', data: palette }, { name: 'TITLEPIC', data: patch(320, 200) },
        { name: 'PNAMES',data:names },{ name:'TEXTURE1',data:texture },{ name:'WALLPAT',data:patch(128,128) },
        { name:'F_START',data:new Uint8Array() },{ name:'TESTFLAT',data:flat },{ name:'F_END',data:new Uint8Array() },
        { name:'S_START',data:new Uint8Array() },{ name:'S_END',data:new Uint8Array() },{ name:'COLORMAP',data:colormap },
        { name: 'E1M1', data: new Uint8Array() },{ name: 'THINGS', data: things },
        { name: 'LINEDEFS', data: lines }, { name: 'SIDEDEFS', data: side }, { name: 'VERTEXES', data: vertices },
        { name:'SEGS',data:segs },{ name:'SSECTORS',data:subsector },{ name:'NODES',data:new Uint8Array() },
        { name:'SECTORS',data:sector },{ name:'REJECT',data:new Uint8Array(1) },{ name:'BLOCKMAP',data:blockmap }
    ]);
}
