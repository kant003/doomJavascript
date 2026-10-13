// Inspection camera for the converted world renderer. This is not P_PlayerThink or game physics.
import { R_RenderWorldView } from '../linuxdoom-1.10/r_main';
import type { WorldCamera } from '../linuxdoom-1.10/r_main';
import { FixedMul } from '../linuxdoom-1.10/m_fixed';
import { FRACUNIT } from '../linuxdoom-1.10/m_fixed.h';
import { ANG45, ANG90, ANGLETOFINESHIFT } from '../linuxdoom-1.10/tables.h';
import { finesine, finecosine } from '../linuxdoom-1.10/tables';
import { screens } from '../linuxdoom-1.10/v_video';
import { I_StartTic, I_FinishUpdate } from '../linuxdoom-1.10/i_video';
import { evtype_t } from '../linuxdoom-1.10/d_event.h';
import { KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW, KEY_DOWNARROW } from '../linuxdoom-1.10/doomdef.h';
const key = (letter: string): number => letter.charCodeAt(0);
export function stepInspectionCamera(camera: WorldCamera, keys: ReadonlySet<number>): boolean {
    const forward = Number(keys.has(key('w')) || keys.has(KEY_UPARROW)) - Number(keys.has(key('s')) || keys.has(KEY_DOWNARROW));
    const turn = Number(keys.has(key('a')) || keys.has(KEY_LEFTARROW)) - Number(keys.has(key('d')) || keys.has(KEY_RIGHTARROW));
    const strafe = Number(keys.has(key('q'))) - Number(keys.has(key('e')));
    if (!forward && !turn && !strafe) return false;
    camera.angle = (camera.angle + turn * (ANG45 / 16)) >>> 0;
    const a = camera.angle >>> ANGLETOFINESHIFT, side = ((camera.angle + ANG90) >>> 0) >>> ANGLETOFINESHIFT;
    camera.x = (camera.x + FixedMul(forward * 4 * FRACUNIT,finecosine[a]) + FixedMul(strafe * 4 * FRACUNIT,finecosine[side])) | 0;
    camera.y = (camera.y + FixedMul(forward * 4 * FRACUNIT,finesine[a]) + FixedMul(strafe * 4 * FRACUNIT,finesine[side])) | 0;
    return true;
}
export class WorldPreview {
    private animation = 0;
    private generation = 0;
    private keys = new Set<number>();
    private initial: WorldCamera | null = null;
    private camera: WorldCamera | null = null;
    constructor(private present: () => void, private onError: (error: unknown) => void) {}
    stop(): void {
        this.generation++; cancelAnimationFrame(this.animation); this.animation = 0; this.keys.clear(); this.camera = null;
    }
    nudge(key: number): void {
        if (!this.camera) return;
        for (let i=0;i<4;i++) stepInspectionCamera(this.camera,new Set([key]));
        screens[0].fill(0); R_RenderWorldView(this.camera); I_FinishUpdate(); this.present();
    }
    reset(): void {
        if (!this.camera || !this.initial) return;
        Object.assign(this.camera,this.initial); screens[0].fill(0); R_RenderWorldView(this.camera); I_FinishUpdate(); this.present();
    }
    start(camera: WorldCamera): void {
        this.stop(); this.initial = {...camera}; this.camera = {...camera}; I_StartTic();
        screens[0].fill(0); R_RenderWorldView(this.camera); I_FinishUpdate(); this.present();
        let previous: number | null = null, accumulator = 0;
        const generation = this.generation;
        const loop = (now: number): void => {
            if (generation !== this.generation || !this.camera) return;
            try {
                accumulator += previous === null ? 0 : Math.min(200,now - previous); previous = now;
                let changed = false;
                for (const event of I_StartTic()) {
                    if (event.type === evtype_t.ev_keydown) this.keys.add(event.data1);
                    else if (event.type === evtype_t.ev_keyup) this.keys.delete(event.data1);
                }
                while (accumulator >= 1000/35) { accumulator -= 1000/35; changed = stepInspectionCamera(this.camera,this.keys) || changed; }
                if (changed) { screens[0].fill(0); R_RenderWorldView(this.camera); I_FinishUpdate(); this.present(); }
                this.animation = requestAnimationFrame(loop);
            } catch (error) { this.stop(); this.onError(error); }
        };
        this.animation = requestAnimationFrame(loop);
    }
}
