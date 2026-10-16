import type { WadFile } from '../linuxdoom-1.10/w_wad.h';
// Original unmodified shareware data, loaded from an external archive, not bundled.
export const SHAREWARE_URL='https://raw.githubusercontent.com/Doom-Utils/shareware-collection/6591a922701e5769b32278e9c555b1bf93f5714c/Doom%201.9/doom1.wad';
export const MAX_REMOTE_WAD_BYTES=64*1024*1024;
export function wadUrl(value:string,base:string):URL {
    const url=new URL(value,base);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Usa un enlace HTTP o HTTPS sin credenciales.');
    return url;
}
export function launchOptions(href:string){
    const page=new URL(href),params=page.searchParams,values=params.getAll('wad');
    const synthetic=values.length===1&&values[0]==='demo';
    if(values.includes('demo')&&!synthetic)throw new Error('wad=demo no se combina con otros WAD.');
    const map=params.get('map');if(map&&!/^(E[1-4]M[1-9]|MAP\d\d)$/.test(map))throw new Error('Nombre de mapa inválido. Usa E1M1 o MAP01.');
    return {synthetic,embed:params.get('embed')==='1',map,urls:synthetic?[]:(values.length?values:['shareware']).map(value=>value==='shareware'?SHAREWARE_URL:wadUrl(value,page.href).href)};
}
export function validateRemoteWad(data:Uint8Array):void {
    if(data.length<12||!['IWAD','PWAD'].includes(new TextDecoder().decode(data.subarray(0,4))))throw new Error('El enlace no contiene un WAD válido; debe apuntar al archivo, no a una página HTML ni a un ZIP.');
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength),count=v.getInt32(4,true),offset=v.getInt32(8,true);
    if(count<0||offset<12||offset+count*16>data.length)throw new Error('Directorio WAD truncado o inválido.');
    for(let i=0;i<count;i++){
        const at=offset+i*16,start=v.getInt32(at,true),size=v.getInt32(at+4,true);
        if(start<0||size<0||start+size>data.length)throw new Error('Un recurso WAD está fuera del archivo.');
    }
}
export async function fetchRemoteWad(url:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<WadFile> {
    const source=wadUrl(url,url),response=await fetcher(source.href,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok){await response.body?.cancel();throw new Error(`No se pudo descargar el WAD (HTTP ${response.status}).`);}
    if(Number(response.headers.get('content-length'))>MAX_REMOTE_WAD_BYTES){await response.body?.cancel();throw new Error('El WAD supera el límite de 64 MiB.');}
    const reader=response.body?.getReader();if(!reader)throw new Error('La descarga del WAD no contiene datos.');
    const chunks:Uint8Array[]=[];let length=0;
    try {
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
            if(length>MAX_REMOTE_WAD_BYTES){await reader.cancel();throw new Error('El WAD supera el límite de 64 MiB.');}chunks.push(value);}
    }finally {reader.releaseLock();}
    const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    validateRemoteWad(data);
    const basename=decodeURIComponent(source.pathname.split('/').at(-1)??'');
    return {name:/\.wad$/i.test(basename)?basename:'remote.wad',data};
}
