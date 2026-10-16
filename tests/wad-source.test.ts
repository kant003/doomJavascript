import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchOptions,wadUrl,fetchRemoteWad,validateRemoteWad,SHAREWARE_URL,MAX_REMOTE_WAD_BYTES } from '../src/web/wad-source';
import { demoWad } from '../src/web/demo';
const base='https://example.org/doom/';
const signal=()=>new AbortController().signal;
const response=(data:Uint8Array)=>new Response(data as Uint8Array<ArrayBuffer>);
test('Launch URLs default to shareware, support offline fixtures, maps, embeds and ordered patches',()=>{
 assert.deepEqual(launchOptions(base),{synthetic:false,embed:false,map:null,urls:[SHAREWARE_URL]});
 assert.deepEqual(launchOptions(base+'?wad=demo&embed=1'),{synthetic:true,embed:true,map:null,urls:[]});
 assert.deepEqual(launchOptions(base+'?wad=shareware&wad=patch.wad&map=E1M2').urls,[SHAREWARE_URL,base+'patch.wad']);
 assert.equal(launchOptions(base+'?map=MAP12').map,'MAP12');
 assert.throws(()=>launchOptions(base+'?wad=demo&wad=shareware'),/no se combina/);
 assert.throws(()=>launchOptions(base+'?map=missing'),/mapa inválido/);
});
test('Remote WAD links reject executable schemes and credentials',()=>{
 for(const value of ['javascript:alert(1)','file:///tmp/test.wad','data:abc','https://user:pass@example.org/a.wad'])assert.throws(()=>wadUrl(value,base),/HTTP/);
 assert.equal(wadUrl('./data.wad',base).href,base+'data.wad');
});
test('Remote fetch preserves valid WAD bytes and omits credentials and referrer',async()=>{
 const data=demoWad(),s=signal();let options:RequestInit|undefined;
 const file=await fetchRemoteWad(base+'doom1.wad',s,async(url,init)=>{assert.equal(url,base+'doom1.wad');options=init;return response(data);});
 assert.equal(file.name,'doom1.wad');assert.deepEqual(file.data,data);assert.equal(options!.credentials,'omit');assert.equal(options!.referrerPolicy,'no-referrer');assert.strictEqual(options!.signal,s);
});
test('HTTP failures, HTML, ZIP and invalid directories fail before modifying engine resources',async()=>{
 await assert.rejects(()=>fetchRemoteWad(base+'bad.wad',signal(),async()=>new Response(null,{status:404})),/HTTP 404/);
 for(const data of [new TextEncoder().encode('<!doctype html><html></html>'),new Uint8Array([80,75,3,4])])assert.throws(()=>validateRemoteWad(data),/no contiene un WAD válido/);
 const data=demoWad();new DataView(data.buffer).setInt32(8,data.length,true);assert.throws(()=>validateRemoteWad(data),/Directorio/);
 const lump=demoWad(),v=new DataView(lump.buffer);v.setInt32(v.getInt32(8,true)+4,lump.length+1,true);assert.throws(()=>validateRemoteWad(lump),/fuera/);
});
test('Downloads enforce their size limit both with and without Content-Length',async()=>{
 await assert.rejects(()=>fetchRemoteWad(base+'huge.wad',signal(),async()=>new Response('x',{headers:{'Content-Length':String(MAX_REMOTE_WAD_BYTES+1)}})),/64 MiB/);
 let cancelled=false;const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(MAX_REMOTE_WAD_BYTES+1));},cancel(){cancelled=true;}});
 await assert.rejects(()=>fetchRemoteWad(base+'huge.wad',signal(),async()=>new Response(body)),/64 MiB/);assert.equal(cancelled,true);
});
test('Network rejection propagates and generic download endpoints retain a WAD filename',async()=>{
 await assert.rejects(()=>fetchRemoteWad(base+'a.wad',signal(),async()=>{throw new TypeError('CORS');}),/CORS/);
 assert.equal((await fetchRemoteWad(base+'download?id=1',signal(),async()=>response(demoWad()))).name,'remote.wad');
});
