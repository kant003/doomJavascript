// Authored diagnostic HUD art; no original DOOM graphics are bundled.
import { maskedPatch } from './demo';
import { demoGlyphPixel } from './finale-demo';
export function statusDemoAssets():{name:string;data:Uint8Array}[]{
    const result:{name:string;data:Uint8Array}[]=[];
    const glyph=(name:string,ch:string,color:number,scale=1)=>result.push({name,data:maskedPatch(6*scale,7*scale,(x,y)=>demoGlyphPixel(ch,Math.floor(x/scale),Math.floor(y/scale))?color:null)});
    for(let i=0;i<10;i++){glyph(`STTNUM${i}`,String(i),220,2);glyph(`STYSNUM${i}`,String(i),250);}
    glyph('STTMINUS','-',220,2);glyph('STTPRCNT','%',220,2);for(let i=2;i<=7;i++)glyph(`STGNUM${i}`,String(i),100);
    for(let i=0;i<6;i++)result.push({name:`STKEYS${i}`,data:maskedPatch(8,5,(x,y)=>x<3||y===2?(i<3?160+i*20:180+i*10):null)});
    const label=(text:string,x:number,y:number,left:number,top:number)=>{const cx=x-left,cy=y-top;return cx>=0&&cx<text.length*6&&demoGlyphPixel(text[Math.floor(cx/6)],cx%6,cy);};
    result.push({name:'STBAR',data:maskedPatch(320,32,(x,y)=>label('AMMO',x,y,8,24)||label('HEALTH',x,y,48,24)||label('ARMOR',x,y,182,24)?200:y===0?120:(Math.floor(x/8)+Math.floor(y/8))%2?44:48)},
        {name:'STARMS',data:maskedPatch(40,32,(x,y)=>label('ARMS',x,y,8,24)?200:44)},{name:'STFB0',data:maskedPatch(34,32,()=>48)});
    for(let pain=0;pain<5;pain++){
        const face=(name:string,look:number,mouth:number)=>result.push({name,data:maskedPatch(24,30,(x,y)=>{
            if(x<2||x>=22||y<2||y>=28)return null;
            if(y>=9&&y<=11&&(Math.abs(x-(7+look))<2||Math.abs(x-(16+look))<2))return 0;
            if(y>=20&&y<20+mouth&&x>=7&&x<17)return 0;return 190-pain*20;
        })});
        for(let i=0;i<3;i++)face(`STFST${pain}${i}`,i-1,1);
        face(`STFTR${pain}0`,2,1);face(`STFTL${pain}0`,-2,1);face(`STFOUCH${pain}`,0,5);face(`STFEVL${pain}`,0,2);face(`STFKILL${pain}`,0,3);
    }
    for(const [name,color] of [['STFGOD0',250],['STFDEAD0',80]] as const)result.push({name,data:maskedPatch(24,30,(x,y)=>x>2&&x<22&&y>2&&y<28?color:null)});
    return result;
}
export function statusDemoPalettes(base:Uint8Array):Uint8Array {
    const data=new Uint8Array(14*768);for(let p=0;p<14;p++)for(let i=0;i<768;i++){
        const channel=i%3,target=p<9?[255,0,0][channel]:p<13?[255,210,70][channel]:[0,255,0][channel];
        const amount=p===0?0:p<9?p/12:p<13?(p-8)/8:.3;data[p*768+i]=Math.round(base[i]*(1-amount)+target*amount);
    }return data;
}
