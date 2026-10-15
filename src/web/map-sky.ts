import { sky,R_InitSkyMap } from '../linuxdoom-1.10/r_sky';
import { R_CheckTextureNumForName,R_FlatNumForName } from '../linuxdoom-1.10/r_data';
import { W_CheckNumForName } from '../linuxdoom-1.10/w_wad';
export function setupMapSky(name:string):void {
    sky.skyflatnum=W_CheckNumForName('F_SKY1')>=0?R_FlatNumForName('F_SKY1'):-1;
    const episode=/^E(\d)M/.exec(name);
    const texture=name.startsWith('MAP')?Number(name.slice(3))<12?'SKY1':Number(name.slice(3))<21?'SKY2':'SKY3':`SKY${episode?.[1]??'1'}`;
    sky.skytexture=Math.max(0,R_CheckTextureNumForName(texture));R_InitSkyMap();
}
