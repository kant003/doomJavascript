// Browser event collection and WASD aliases; G_BuildTiccmd owns command semantics.
import { mouseSensitivity } from '../linuxdoom-1.10/m_menu';
import { G_CreateControls,G_InitControlsContext,G_BuildTiccmd,type controls_context_t } from '../linuxdoom-1.10/g_game';
import { HU_dequeueChatChar,HU_IsActive } from '../linuxdoom-1.10/hu_stuff';
import type { ticcmd_t } from '../linuxdoom-1.10/d_ticcmd.h';
import { KEY_UPARROW,KEY_DOWNARROW,KEY_LEFTARROW,KEY_RIGHTARROW,KEY_RCTRL } from '../linuxdoom-1.10/doomdef.h';
const aliases:Record<number,number>={119:KEY_UPARROW,115:KEY_DOWNARROW,97:KEY_LEFTARROW,100:KEY_RIGHTARROW,113:44,101:46,32:KEY_RCTRL,102:32};
function build(keys:ReadonlySet<number>,native:controls_context_t):ticcmd_t {
    native.gamekeydown.fill(0);for(const key of keys)if(key>=0&&key<256)native.gamekeydown[aliases[key]??key]=1;
    const result={} as ticcmd_t;G_InitControlsContext(native);G_BuildTiccmd(result);native.maketic++;return result;
}
export function buildGameCommand(keys:ReadonlySet<number>):ticcmd_t {return build(keys,G_CreateControls());}
export class GameInput {
    private held=new Set<number>();private pressed=new Set<number>();
    private mouseButtons=0;private mousePressed=0;private native=G_CreateControls();
    mouse(buttons:number,x:number,y:number):void {this.mouseButtons=buttons;this.mousePressed|=buttons;this.native.mousex+=Math.trunc(x*(mouseSensitivity+5)/10);this.native.mousey+=Math.trunc(y*(mouseSensitivity+5)/10);}
    joystick(buttons:number,x:number,y:number):void {this.native.joybuttons=Array.from({length:4},(_,i)=>!!(buttons&(1<<i)));this.native.joyxmove=x;this.native.joyymove=y;}
    keyDown(key:number):void {this.held.add(key);this.pressed.add(key);}
    keyUp(key:number):void {this.held.delete(key);}
    clear():void {this.held.clear();this.pressed.clear();this.mouseButtons=this.mousePressed=0;this.native=G_CreateControls();}
    command():ticcmd_t {
        this.native.mousebuttons=Array.from({length:3},(_,i)=>!!((this.mouseButtons|this.mousePressed)&(1<<i)));
        this.native.HU_dequeueChatChar=()=>HU_IsActive()?HU_dequeueChatChar():0;
        const result=build(new Set([...this.held,...this.pressed]),this.native);this.pressed.clear();this.mousePressed=0;return result;
    }
}
