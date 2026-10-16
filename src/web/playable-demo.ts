// Authored test assets only. Gameplay comes from the original actor/state definitions.
import { finaleDemoAssets } from './finale-demo';
import { demoWad,makeWad,maskedPatch } from './demo';
import { alphSwitchList } from '../linuxdoom-1.10/p_switch';
import { states,sprnames } from '../linuxdoom-1.10/info';
export function playableDemoWad(withCampaign=false):Uint8Array {
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
    lumps.splice(lumps.findIndex(l=>l.name==='S_END'),0,...patches);
    if(withCampaign){
        const glyphs=['111100110100111','101101010101101','111010010010111','111010010010010'];
        // Readable EXIT sign made from 3x5 glyphs, without commercial patches.
        const exit=maskedPatch(128,128,(x,y)=>{
            if(x<6||x>=122||y<6||y>=122)return 240;
            const cx=Math.floor((x-20)/6),cy=Math.floor((y-48)/6),letter=Math.floor(cx/4),column=cx%4;
            return cy>=0&&cy<5&&letter>=0&&letter<4&&column<3&&column>=0&&glyphs[letter][cy*3+column]==='1'?255:64;
        });
        const pn=new Uint8Array(20);new DataView(pn.buffer).setInt32(0,2,true);pn.set(new TextEncoder().encode('WALLPAT'),4);pn.set(new TextEncoder().encode('EXITPAT'),12);lumps.find(l=>l.name==='PNAMES')!.data=pn;
        for(const name of ['SW1EXIT','SW2EXIT'])tv.setInt16(4+names.length*4+names.indexOf(name)*32+26,1,true);
        lumps.splice(lumps.findIndex(l=>l.name==='S_START'),0,{name:'EXITPAT',data:exit});
        const lines=lumps.find(l=>l.name==='LINEDEFS')!.data,lv=new DataView(lines.buffer),side=lumps.find(l=>l.name==='SIDEDEFS')!,sides=new Uint8Array(120);
        for(let i=0;i<4;i++){sides.set(side.data,i*30);lv.setInt16(i*14+10,i,true);}side.data=sides;
        sides.fill(0,30+20,30+28);sides.set(new TextEncoder().encode('SW1EXIT'),30+20);lv.setInt16(14+6,11,true);
        const starts=new DataView(lumps.find(l=>l.name==='THINGS')!.data.buffer);starts.setInt16(0,80,true);starts.setInt16(10,-64,true);starts.setInt16(12,64,true);
        const next=lumps.slice(lumps.findIndex(l=>l.name==='E1M1')).map(l=>({name:l.name,data:l.data.slice()}));next[0].name='E1M2';
        // A second map marker exercises reloading the same test geometry.
        new DataView(next.find(l=>l.name==='THINGS')!.data.buffer).setInt16(4,0,true);lumps.push(...next);
        const ending=next.map(l=>({name:l.name,data:l.data.slice()}));ending[0].name='E1M8';lumps.push(...ending,...finaleDemoAssets());
    }
    return makeWad(lumps);
}
