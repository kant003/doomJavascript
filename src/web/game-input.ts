// Local browser controls -> original ticcmd_t. No movement or collision is simulated here.
import type { ticcmd_t } from '../linuxdoom-1.10/d_ticcmd.h';
import { buttoncode_t as BT } from '../linuxdoom-1.10/d_event.h';
import { KEY_UPARROW,KEY_DOWNARROW,KEY_LEFTARROW,KEY_RIGHTARROW,KEY_RSHIFT,KEY_RCTRL } from '../linuxdoom-1.10/doomdef.h';
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
    keyDown(key:number):void {this.held.add(key);this.pressed.add(key);}
    keyUp(key:number):void {this.held.delete(key);}
    clear():void {this.held.clear();this.pressed.clear();}
    command():ticcmd_t {const result=buildGameCommand(new Set([...this.held,...this.pressed]));this.pressed.clear();return result;}
}
