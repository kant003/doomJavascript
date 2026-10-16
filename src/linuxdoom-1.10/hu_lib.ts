// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// hu_lib.c. Byte buffers retain C's length/terminator; getters replace on pointers.
import { SCREENWIDTH,KEY_BACKSPACE,KEY_ENTER } from './doomdef.h';
import { V_PatchHeader,V_DrawPatchDirect } from './v_video';
import { draw,R_VideoErase } from './r_draw';
import { FG,HU_MAXLINES,HU_MAXLINELENGTH,type hu_textline_t,type hu_stext_t,type hu_itext_t } from './hu_lib.h';
let automapactive=()=>false;
export function HUlib_InitContext(automap:()=>boolean):void {automapactive=automap;}
export function HUlib_init():void { /* Empty in upstream. */ }
export function HUlib_clearTextLine(t:hu_textline_t):void {t.len=0;t.l??=new Uint8Array(HU_MAXLINELENGTH+1);t.l[0]=0;t.needsupdate=1;}
export function HUlib_initTextLine(t:hu_textline_t,x:number,y:number,f:Uint8Array[]|null,sc:number):void {Object.assign(t,{x,y,f,sc});HUlib_clearTextLine(t);}
export function HUlib_addCharToTextLine(t:hu_textline_t,ch:number):boolean {if(t.len===HU_MAXLINELENGTH)return false;t.l[t.len++]=ch;t.l[t.len]=0;t.needsupdate=4;return true;}
export function HUlib_delCharFromTextLine(t:hu_textline_t):boolean {if(!t.len)return false;t.l[--t.len]=0;t.needsupdate=4;return true;}
export function HUlib_drawTextLine(l:hu_textline_t,drawcursor:boolean):void {
    const font=l.f;if(!font)throw new Error('HU text line has no font');let x=l.x;
    for(let i=0;i<l.len;i++){const ch=l.l[i],c=ch>=97&&ch<=122?ch-32:ch;
        if(c!==32&&c>=l.sc&&c<=95){const patch=font[c-l.sc],w=V_PatchHeader(patch).width;if(x+w>SCREENWIDTH)break;V_DrawPatchDirect(x,l.y,FG,patch);x+=w;}
        else {x+=4;if(x>=SCREENWIDTH)break;}
    }
    if(drawcursor){const cursor=font[95-l.sc];if(x+V_PatchHeader(cursor).width<=SCREENWIDTH)V_DrawPatchDirect(x,l.y,FG,cursor);}
}
export function HUlib_eraseTextLine(l:hu_textline_t):void {
    if(!automapactive()&&draw.viewwindowx&&l.needsupdate){
        if(!l.f)throw new Error('HU text line has no font');const height=V_PatchHeader(l.f[0]).height+1;
        for(let y=l.y;y<l.y+height;y++){const offset=y*SCREENWIDTH;if(y<draw.viewwindowy||y>=draw.viewwindowy+draw.viewheight)R_VideoErase(offset,SCREENWIDTH);
            else {R_VideoErase(offset,draw.viewwindowx);R_VideoErase(offset+draw.viewwindowx+draw.viewwidth,draw.viewwindowx);}}
    }
    if(l.needsupdate)l.needsupdate--;
}
export function HUlib_initSText(s:hu_stext_t,x:number,y:number,h:number,font:Uint8Array[],startchar:number,on:()=>boolean):void {
    if(!Number.isInteger(h)||h<1||h>HU_MAXLINES)throw new Error('Invalid HU text window height');Object.assign(s,{h,on,laston:true,cl:0,l:[]});
    for(let i=0;i<h;i++){const line={} as hu_textline_t;HUlib_initTextLine(line,x,y-i*(V_PatchHeader(font[0]).height+1),font,startchar);s.l.push(line);}
}
export function HUlib_addLineToSText(s:hu_stext_t):void {if(++s.cl===s.h)s.cl=0;HUlib_clearTextLine(s.l[s.cl]);for(const l of s.l)l.needsupdate=4;}
export function HUlib_addMessageToSText(s:hu_stext_t,prefix:string|null,msg:string):void {HUlib_addLineToSText(s);for(const text of [prefix??'',msg])for(let i=0;i<text.length&&text.charCodeAt(i);i++)HUlib_addCharToTextLine(s.l[s.cl],text.charCodeAt(i));}
export function HUlib_drawSText(s:hu_stext_t):void {if(!s.on())return;for(let i=0;i<s.h;i++){let idx=s.cl-i;if(idx<0)idx+=s.h;HUlib_drawTextLine(s.l[idx],false);}}
export function HUlib_eraseSText(s:hu_stext_t):void {for(const line of s.l){if(s.laston&&!s.on())line.needsupdate=4;HUlib_eraseTextLine(line);}s.laston=s.on();}
export function HUlib_initIText(it:hu_itext_t,x:number,y:number,font:Uint8Array[]|null,startchar:number,on:()=>boolean):void {Object.assign(it,{lm:0,on,laston:true,l:{} as hu_textline_t});HUlib_initTextLine(it.l,x,y,font,startchar);}
export function HUlib_delCharFromIText(it:hu_itext_t):void {if(it.l.len!==it.lm)HUlib_delCharFromTextLine(it.l);}
export function HUlib_eraseLineFromIText(it:hu_itext_t):void {while(it.lm!==it.l.len)HUlib_delCharFromTextLine(it.l);}
export function HUlib_resetIText(it:hu_itext_t):void {it.lm=0;HUlib_clearTextLine(it.l);}
export function HUlib_addPrefixToIText(it:hu_itext_t,text:string):void {for(let i=0;i<text.length&&text.charCodeAt(i);i++)HUlib_addCharToTextLine(it.l,text.charCodeAt(i));it.lm=it.l.len;}
export function HUlib_keyInIText(it:hu_itext_t,ch:number):boolean {if(ch>=32&&ch<=95)HUlib_addCharToTextLine(it.l,ch);else if(ch===KEY_BACKSPACE)HUlib_delCharFromIText(it);else if(ch!==KEY_ENTER)return false;return true;}
export function HUlib_drawIText(it:hu_itext_t):void {if(it.on())HUlib_drawTextLine(it.l,true);}
export function HUlib_eraseIText(it:hu_itext_t):void {if(it.laston&&!it.on())it.l.needsupdate=4;HUlib_eraseTextLine(it.l);it.laston=it.on();}
export function HUlib_Text(line:hu_textline_t):string {return String.fromCharCode(...line.l.subarray(0,line.len));}
