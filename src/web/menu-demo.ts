// Authored menu and view-border fixtures. No original game art is bundled.
import { demoTextPatch } from './finale-demo';
import { maskedPatch } from './demo';
export function menuDemoAssets():{name:string;data:Uint8Array}[]{
    const labels:Record<string,string>={M_DOOM:'DOOM',M_NGAME:'NEW GAME',M_OPTION:'OPTIONS',M_LOADG:'LOAD GAME',M_SAVEG:'SAVE GAME',M_RDTHIS:'READ THIS!',M_QUITG:'QUIT GAME',M_NEWG:'NEW GAME',M_SKILL:'CHOOSE SKILL LEVEL:',M_EPISOD:'WHICH EPISODE?',M_EPI1:'KNEE-DEEP IN THE DEAD',M_EPI2:'THE SHORES OF HELL',M_EPI3:'INFERNO',M_EPI4:'THY FLESH CONSUMED',M_JKILL:"I'M TOO YOUNG TO DIE.",M_ROUGH:'HEY, NOT TOO ROUGH.',M_HURT:'HURT ME PLENTY.',M_ULTRA:'ULTRA-VIOLENCE.',M_NMARE:'NIGHTMARE!',M_OPTTTL:'OPTIONS',M_ENDGAM:'END GAME',M_MESSG:'MESSAGES',M_DETAIL:'GRAPHIC DETAIL',M_SCRNSZ:'SCREEN SIZE',M_MSENS:'MOUSE SENSITIVITY',M_SVOL:'SOUND VOLUME',M_SFXVOL:'SFX VOLUME',M_MUSVOL:'MUSIC VOLUME',M_MSGON:'ON',M_MSGOFF:'OFF',M_GDHIGH:'HIGH',M_GDLOW:'LOW'};
    const assets=Object.entries(labels).map(([name,text])=>({name,data:demoTextPatch(text,name==='M_DOOM'?4:1)}));
    for(const name of ['M_SKULL1','M_SKULL2'])assets.push({name,data:maskedPatch(24,16,(x,y)=>{const eye=y>=4&&y<=6&&(x===6||x===16),jaw=y>11&&x>5&&x<18;return eye?32:(x>2&&x<21&&y>1&&y<12)||jaw?name==='M_SKULL1'?240:200:null;})});
    for(const name of ['M_THERML','M_THERMM','M_THERMR','M_THERMO'])assets.push({name,data:maskedPatch(8,8,(x,y)=>name==='M_THERMO'?(x>1&&x<6?255:null):y===3||y===4?128:null)});
    for(const name of ['BRDR_T','BRDR_B','BRDR_L','BRDR_R','BRDR_TL','BRDR_TR','BRDR_BL','BRDR_BR'])assets.push({name,data:maskedPatch(8,8,(x,y)=>64+((x+y)&7))});
    for(const name of ['FLOOR7_2','GRNROCK'])assets.push({name,data:Uint8Array.from({length:4096},(_,i)=>32+(((i&63)^(i>>6))&7))});
    assets.push({name:'HELP1',data:maskedPatch(320,200,(x,y)=>{
        const lines=['DOOM TYPESCRIPT','W/S MOVE  A/D TURN','SPACE/CTRL FIRE  F USE','TAB AUTOMAP  ESC MENU','ENTER NEXT PAGE'],line=Math.floor((y-40)/24),cy=(y-40)%24;
        if(line<0||line>=lines.length||cy<0||cy>=7)return 32;
        const text=lines[line],patch=helpLines[line],left=Math.floor((320-text.length*6)/2);
        // Decode is unnecessary: precomputed text pixels share the authored glyphs.
        return x>=left&&x<left+text.length*6&&patch[cy*text.length*6+x-left]?255:32;
    })});
    return assets;
}
import { demoGlyphPixel } from './finale-demo';
const helpLines=['DOOM TYPESCRIPT','W/S MOVE  A/D TURN','SPACE/CTRL FIRE  F USE','TAB AUTOMAP  ESC MENU','ENTER NEXT PAGE'].map(text=>Uint8Array.from({length:text.length*6*7},(_,i)=>Number(demoGlyphPixel(text[Math.floor((i%(text.length*6))/6)],i%6,Math.floor(i/(text.length*6))))));
