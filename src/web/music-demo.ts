// Authored MUS melody and percussion for tests; no commercial music is bundled.
import { S_music } from '../linuxdoom-1.10/sounds';
export function demoMusic():Uint8Array {
    // Controller/program, channel volume; melody notes, 35/140 sec each.
    const score=[0x40,0,24,0x40,3,100];
    for(const note of [60,64,67,72])score.push(0x90,note|128,95,35,0x80,note,0);
    score.push(0x9f,38|128,75,35,0x8f,38,35,0x60);
    const data=new Uint8Array(16+score.length),v=new DataView(data.buffer);data.set([77,85,83,26]);v.setUint16(4,score.length,true);v.setUint16(6,16,true);v.setUint16(8,1,true);data.set(score,16);return data;
}
export function demoMusicAssets(){return S_music.filter(m=>m.name).map(m=>({name:`D_${m.name!.toUpperCase()}`,data:demoMusic()}));}
