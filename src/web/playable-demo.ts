// Authored test assets only. Gameplay comes from the original actor/state definitions.
import { demoWad,makeWad,maskedPatch } from './demo';
import { alphSwitchList } from '../linuxdoom-1.10/p_switch';
import { states,sprnames } from '../linuxdoom-1.10/info';
export function playableDemoWad():Uint8Array {
    const bytes=demoWad(),v=new DataView(bytes.buffer),dir=v.getInt32(8,true);
    const lumps:{name:string;data:Uint8Array}[]=Array.from({length:v.getInt32(4,true)},(_,i)=>{
        const p=dir+i*16,start=v.getInt32(p,true),length=v.getInt32(p+4,true);
        return {name:new TextDecoder().decode(bytes.subarray(p+8,p+16)).split('\0')[0],data:bytes.slice(start,start+length)};
    });
    const names=['DUMMY','TESTWALL',...alphSwitchList.filter(s=>s.episode===1).flatMap(s=>[s.name1,s.name2])];
    const textures=new Uint8Array(4+names.length*36),tv=new DataView(textures.buffer);tv.setInt32(0,names.length,true);
    names.forEach((name,i)=>{const offset=4+names.length*4+i*32;tv.setInt32(4+i*4,offset,true);textures.set(new TextEncoder().encode(name),offset);tv.setInt16(offset+12,128,true);tv.setInt16(offset+14,128,true);tv.setInt16(offset+20,1,true);});
    lumps.find(l=>l.name==='TEXTURE1')!.data=textures;
    const things=[[-64,0,0,1],[80,48,180,3001],[0,-64,0,2007],[96,-80,0,2028]],data=new Uint8Array(things.length*10),th=new DataView(data.buffer);
    things.forEach(([x,y,angle,type],i)=>[x,y,angle,type,7].forEach((value,j)=>th.setInt16(i*10+j*2,value,true)));lumps.find(l=>l.name==='THINGS')!.data=data;
    const patches:{name:string;data:Uint8Array}[]=[];
    for(const name of ['PLAY','PISG','PISF','PUNG','PUFF','BLUD','TROO','BAL1','CLIP']){
        const id=sprnames.indexOf(name),frames=1+Math.max(...states.filter(s=>s.sprite===id).map(s=>s.frame&0x7fff));
        for(let frame=0;frame<frames;frame++){
            const weapon=['PISG','PUNG'].includes(name),flash=name==='PISF',body=['PLAY','TROO'].includes(name);
            const w=weapon?48:body?24:16,h=weapon?64:body?48:16;
            const patch=maskedPatch(w,h,(x,y)=>{
                if(weapon)return x>15&&x<33&&y>8?128+((x+y+frame*8)&31):null;
                const r=body?Math.abs(x-w/2)<(y<12?7:10):Math.abs(x-w/2)+Math.abs(y-h/2)<8;
                return r?(flash?240:name==='TROO'?160+frame%16:name==='BLUD'?192:80+frame%16):null;
            },weapon?-136:flash?-148:w/2,weapon?-104:flash?-112:h);
            patches.push({name:`${name}${String.fromCharCode(65+frame)}0`,data:patch});
        }
    }
    lumps.splice(lumps.findIndex(l=>l.name==='S_END'),0,...patches);return makeWad(lumps);
}
