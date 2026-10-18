// Local browser controls -> original ticcmd_t. No movement or collision is simulated here.
import { mouseSensitivity } from '../linuxdoom-1.10/m_menu';
import type { ticcmd_t } from '../linuxdoom-1.10/d_ticcmd.h';
import { buttoncode_t as BT } from '../linuxdoom-1.10/d_event.h';
import { KEY_UPARROW,KEY_DOWNARROW,KEY_LEFTARROW,KEY_RIGHTARROW,KEY_RSHIFT,KEY_RCTRL,KEY_RALT } from '../linuxdoom-1.10/doomdef.h';
export function buildGameCommand(keys:ReadonlySet<number>):ticcmd_t {
    const key=(text:string)=>keys.has(text.charCodeAt(0)),run=keys.has(KEY_RSHIFT),speed=run?50:25,side=run?40:24;
    let buttons=keys.has(KEY_RCTRL)||key(' ')?BT.BT_ATTACK:0;
    if(key('f'))buttons|=BT.BT_USE;
    for(let i=1;i<=7;i++)if(key(String(i))){buttons|=BT.BT_CHANGE|((i-1)<<BT.BT_WEAPONSHIFT);break;}
    return {forwardmove:(Number(key('w')||keys.has(KEY_UPARROW))-Number(key('s')||keys.has(KEY_DOWNARROW)))*speed,
        sidemove:(Number(key('e'))-Number(key('q')))*side,
        angleturn:(Number(key('a')||keys.has(KEY_LEFTARROW))-Number(key('d')||keys.has(KEY_RIGHTARROW)))*640,
        buttons,consistancy:0,chatchar:0};
}
// Preserve a short press until at least one simulation tic has consumed it.
export class GameInput {
    private held=new Set<number>();private pressed=new Set<number>();
    private mouseButtons=0;private mousePressed=0;private mousex=0;private mousey=0;
    mouse(buttons:number,x:number,y:number):void {this.mouseButtons=buttons;this.mousePressed|=buttons;this.mousex+=Math.trunc(x*(mouseSensitivity+5)/10);this.mousey+=Math.trunc(y*(mouseSensitivity+5)/10);}
    keyDown(key:number):void {this.held.add(key);this.pressed.add(key);}
    keyUp(key:number):void {this.held.delete(key);}
    clear():void {this.held.clear();this.pressed.clear();this.mouseButtons=this.mousePressed=this.mousex=this.mousey=0;}
    command():ticcmd_t {const result=buildGameCommand(new Set([...this.held,...this.pressed]));this.pressed.clear();
        // G_Responder/G_BuildTiccmd mouse scaling and default button bindings.
        // Relative DOM events accumulate until a 35 Hz tic; no movement is lost between frames.
        const mouse=this.mouseButtons|this.mousePressed,strafe=!!(mouse&2)||this.held.has(KEY_RALT);
        if(mouse&1)result.buttons|=BT.BT_ATTACK;
        result.forwardmove=Math.max(-50,Math.min(50,result.forwardmove+this.mousey+(mouse&4?(this.held.has(KEY_RSHIFT)?50:25):0)));
        if(strafe)result.sidemove=Math.max(-50,Math.min(50,result.sidemove+this.mousex*2));else result.angleturn-=this.mousex*8;
        result.angleturn=(result.angleturn<<16)>>16;
        this.mousePressed=this.mousex=this.mousey=0;return result;}
}
