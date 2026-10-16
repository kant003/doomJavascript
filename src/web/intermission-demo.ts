// Authored test patches using the original engine resource names, not game art.
import { maskedPatch } from './demo';
import { demoTextPatch } from './finale-demo';
export function intermissionDemoAssets():{name:string;data:Uint8Array}[]{
    const nodes=[[185,164],[148,143],[69,122],[209,102],[116,89],[166,55],[71,56],[135,29],[71,24]];
    const pixels=Uint8Array.from({length:320*200},(_,i)=>(((i%320)>>4)^((Math.floor(i/320))>>4))&1?32:40);
    for(let i=1;i<nodes.length;i++){
        let [x,y]=nodes[i-1];const [endx,endy]=nodes[i],dx=Math.abs(endx-x),dy=-Math.abs(endy-y),sx=x<endx?1:-1,sy=y<endy?1:-1;let error=dx+dy;
        while(true){pixels[y*320+x]=96;if(x===endx&&y===endy)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
    }
    for(const [cx,cy] of nodes)for(let y=cy-3;y<=cy+3;y++)for(let x=cx-3;x<=cx+3;x++)if(Math.abs(x-cx)+Math.abs(y-cy)<=3)pixels[y*320+x]=128;
    const result=[{name:'WIMAP0',data:maskedPatch(320,200,(x,y)=>pixels[y*320+x])}];
    for(let i=0;i<9;i++)result.push({name:`WILV0${i}`,data:demoTextPatch(`MAPA DE PRUEBA ${i+1}`,2)});
    for(let i=0;i<10;i++)result.push({name:`WINUM${i}`,data:demoTextPatch(String(i),2)});
    for(const [name,text,scale] of [['WIPCNT','%',2],['WIF','FINALIZADO',2],['WIENTER','ENTRANDO',2],['WIOSTK','BAJAS',2],['WISCRT2','SECRETOS',2],['WIOSTI','OBJETOS',2],['WITIME','TIEMPO',1],['WIPAR','PAR',1],['WISUCKS','DEMASIADO',1]] as const)result.push({name,data:demoTextPatch(text,scale)});
    result.push({name:'WIMINUS',data:maskedPatch(8,14,(x,y)=>x>0&&x<7&&y===7?255:null)},{name:'WICOLON',data:maskedPatch(4,14,(x,y)=>x===1&&(y===4||y===10)?255:null)});
    for(let i=0;i<2;i++)result.push({name:`WIURH${i}`,data:maskedPatch(18,10,(x,y)=>Math.abs(x-8)<=y?240:null,9,10)});
    result.push({name:'WISPLAT',data:maskedPatch(10,10,(x,y)=>x===y||x+y===9?200:null,5,5)});
    for(let j=0;j<10;j++)for(let i=0;i<3;i++)result.push({name:`WIA0${String(j).padStart(2,'0')}${String(i).padStart(2,'0')}`,data:maskedPatch(3,3,()=>100+i*10)});
    return result;
}
