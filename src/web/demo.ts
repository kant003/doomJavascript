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
// Short authored tone encoded as the same DMX PCM format used by WAD effects.
export function demoSound(): Uint8Array {
    const rate=11025,count=2205,bytes=new Uint8Array(count+8),v=new DataView(bytes.buffer);
    v.setUint16(0,3,true);v.setUint16(2,rate,true);v.setUint32(4,count,true);
    for(let i=0;i<count;i++)bytes[i+8]=Math.round(128+65*Math.sin(2*Math.PI*660*i/rate)*(1-i/count));
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
    for (let i = 0; i < 4; i++) { lv.setInt16(i * 14, (i + 1) % 4, true); lv.setInt16(i * 14 + 2, i, true); lv.setInt16(i * 14 + 4, 1, true); lv.setInt16(i * 14 + 12, -1, true); }
    const things = new Uint8Array(20), thv = new DataView(things.buffer); thv.setInt16(6,1,true); thv.setInt16(10,72,true); thv.setInt16(12,24,true); thv.setInt16(16,2028,true); thv.setInt16(18,7,true);
    const names = new Uint8Array(12);new DataView(names.buffer).setInt32(0,1,true);names.set(new TextEncoder().encode('WALLPAT'),4);
    // Texture 0 is the original NoTexture sentinel; visible walls use texture 1.
    const texture = new Uint8Array(76), tv = new DataView(texture.buffer);
    tv.setInt32(0,2,true);
    for(let i=0;i<2;i++){
        const offset=12+i*32;tv.setInt32(4+i*4,offset,true);
        texture.set(new TextEncoder().encode(i?'TESTWALL':'DUMMY'),offset);
        tv.setInt16(offset+12,128,true);tv.setInt16(offset+14,128,true);tv.setInt16(offset+20,1,true);
    }
    const flat = Uint8Array.from({length:4096},(_,i)=>((i&63)>>3)^((i>>6)>>3)?96:144);
    const colormap = Uint8Array.from({length:34*256},(_,i)=>Math.max(0,Math.round((i&255)*(1-Math.min(i>>8,31)/32))));
    const side = new Uint8Array(30);for(const p of [4,12]) side.set(new TextEncoder().encode('-'),p);
    side.set(new TextEncoder().encode('TESTWALL'),20);
    const sector = new Uint8Array(26), sv = new DataView(sector.buffer);sv.setInt16(2,128,true);
    sector.set(new TextEncoder().encode('TESTFLAT'),4);sector.set(new TextEncoder().encode('TESTFLAT'),12);sv.setInt16(20,192,true);
    const segs = new Uint8Array(48), gv = new DataView(segs.buffer);
    for(let i=0;i<4;i++){gv.setInt16(i*12,(i+1)%4,true);gv.setInt16(i*12+2,i,true);gv.setUint16(i*12+4,((i+2)%4)*16384,true);gv.setInt16(i*12+6,i,true);}
    const subsector = new Uint8Array(4);new DataView(subsector.buffer).setInt16(0,4,true);
    // A 2×2 BLOCKMAP; all cells refer to a shared list of the four boundary lines.
    const blockmap = new Uint8Array(28), bv = new DataView(blockmap.buffer);
    [-128,-128,2,2,8,8,8,8,0,0,1,2,3,-1].forEach((word,i)=>bv.setInt16(i*2,word,true));
    return makeWad([
        {name:'DSPISTOL',data:demoSound()},
        { name: 'PLAYPAL', data: palette }, { name: 'TITLEPIC', data: patch(320, 200) },
        { name: 'PNAMES',data:names },{ name:'TEXTURE1',data:texture },{ name:'WALLPAT',data:patch(128,128) },
        { name:'F_START',data:new Uint8Array() },{ name:'TESTFLAT',data:flat },{ name:'F_END',data:new Uint8Array() },
        { name:'S_START',data:new Uint8Array() },{name:'COLUA0',data:maskedPatch(32,64,(x,y)=> {const radius=y<14?10:y<45?4:9;return Math.abs(x-16)<radius?(y<14?242:y<45?112:96):null;},16,64)},{ name:'S_END',data:new Uint8Array() },{ name:'COLORMAP',data:colormap },
        { name: 'E1M1', data: new Uint8Array() },{ name: 'THINGS', data: things },
        { name: 'LINEDEFS', data: lines }, { name: 'SIDEDEFS', data: side }, { name: 'VERTEXES', data: vertices },
        { name:'SEGS',data:segs },{ name:'SSECTORS',data:subsector },{ name:'NODES',data:new Uint8Array() },
        { name:'SECTORS',data:sector },{ name:'REJECT',data:new Uint8Array(1) },{ name:'BLOCKMAP',data:blockmap }
    ]);
}

// Encode classic transparent patch posts for synthetic sprite/texture fixtures.
export function maskedPatch(width:number,height:number,pixel:(x:number,y:number)=>number|null,leftoffset=0,topoffset=0):Uint8Array{
    if(width<1 || height<1 || height>254)throw new Error('Synthetic patch requires classic dimensions');
    const columns:Uint8Array[]=[];
    for(let x=0;x<width;x++){
        const bytes:number[]=[];let y=0;
        while(y<height){while(y<height && pixel(x,y)===null)y++;if(y===height)break;
            const start=y,run:number[]=[];while(y<height && pixel(x,y)!==null)run.push(pixel(x,y++)!);
            bytes.push(start,run.length,0,...run,0);
        }bytes.push(255);columns.push(new Uint8Array(bytes));
    }
    const header=8+width*4,data=new Uint8Array(header+columns.reduce((n,c)=>n+c.length,0)),v=new DataView(data.buffer);
    v.setInt16(0,width,true);v.setInt16(2,height,true);v.setInt16(4,leftoffset,true);v.setInt16(6,topoffset,true);
    let offset=header;columns.forEach((col,x)=>{v.setUint32(8+x*4,offset,true);data.set(col,offset);offset+=col.length;});return data;
}
