// Browser single-player composition. Simulation remains in the original-named engine modules.
import { G_CreatePlayer,G_InitGameContext,G_PlayerReborn,G_InitCompletionContext,G_CreateIntermission,G_ExitLevel,G_SecretExitLevel,G_DoCompleted,G_WorldDone,G_DoWorldDone,type completion_context_t } from '../linuxdoom-1.10/g_game';
import { GameMode_t,skill_t,gamestate_t as GS } from '../linuxdoom-1.10/doomdef.h';
import { gameaction_t as GA } from '../linuxdoom-1.10/d_event.h';
import { WI_InitContext,WI_Start,WI_Ticker,WI_GetState } from '../linuxdoom-1.10/wi_stuff';
import { stateenum_t as WI } from '../linuxdoom-1.10/wi_stuff.h';
import { buttoncode_t as BT } from '../linuxdoom-1.10/d_event.h';
import { F_InitContext,F_StartFinale,F_Ticker,F_Responder,F_GetState,F_CanDraw,type finale_context_t } from '../linuxdoom-1.10/f_finale';
import type { event_t } from '../linuxdoom-1.10/d_event.h';
import { leveltime } from '../linuxdoom-1.10/p_tick';
import { playerstate_t as PST } from '../linuxdoom-1.10/d_player.h';
import type { ticcmd_t } from '../linuxdoom-1.10/d_ticcmd.h';
import { I_LinkStateActions } from '../linuxdoom-1.10/info';
import { P_InitMobjContext,P_RespawnSpecials,type mobj_context_t } from '../linuxdoom-1.10/p_mobj';
import { P_InitSetupContext,P_SetupLevel,P_Init,type setup_context_t } from '../linuxdoom-1.10/p_setup';
import { P_InitPlayerContext,P_PlayerThink } from '../linuxdoom-1.10/p_user';
import { P_InitPspriteContext,P_SetupPsprites,P_MovePsprites,weaponStateActions } from '../linuxdoom-1.10/p_pspr';
import { P_InitEnemyContext,P_NoiseAlert,enemyStateActions,type enemy_gameplay_t } from '../linuxdoom-1.10/p_enemy';
import { P_InitInteractionContext,P_DamageMobj,P_TouchSpecialThing,type interaction_context_t } from '../linuxdoom-1.10/p_inter';
import { P_InitMapContext,P_TryMove,P_CheckPosition,P_SlideMove,P_AimLineAttack,P_LineAttack,P_UseLines,mapclip } from '../linuxdoom-1.10/p_map';
import { P_InitSectorContext,P_CrossSpecialLine,P_ShootSpecialLine,P_PlayerInSpecialSector,P_UpdateSpecials,type specials_game_t } from '../linuxdoom-1.10/p_spec';
import { P_UseSpecialLine } from '../linuxdoom-1.10/p_switch';
import { EV_DoFloor } from '../linuxdoom-1.10/p_floor';
import { EV_DoDoor } from '../linuxdoom-1.10/p_doors';
import { P_Ticker } from '../linuxdoom-1.10/p_tick';
import { S_Init,S_InitSoundContext,S_StartSound,S_StopSound,S_UpdateSounds,snd_SfxVolume,snd_MusicVolume } from '../linuxdoom-1.10/s_sound';
import { M_ClearRandom } from '../linuxdoom-1.10/m_random';
import { setupMapSky } from './map-sky';
import { W_CheckNumForName } from '../linuxdoom-1.10/w_wad';
export interface level_result_t {mapname:string;secret:boolean;terminal:boolean;kills:number;maxkills:number;items:number;maxitems:number;secrets:number;maxsecrets:number;tics:number}
export interface game_presentation_t {
    resetStatus():void;resetMessages():void;closeAutomap():void;
    tactile(on:number,off:number,total:number):void;onExit(secret:boolean):void;
}
type session_state_t=mobj_context_t&setup_context_t&specials_game_t&enemy_gameplay_t&interaction_context_t&completion_context_t&finale_context_t;
export function detectGameMode(mapname:string):GameMode_t {
    return mapname.startsWith('MAP')?GameMode_t.commercial:W_CheckNumForName('E4M1')>=0?GameMode_t.retail:W_CheckNumForName('E2M1')>=0?GameMode_t.registered:GameMode_t.shareware;
}
export class GameSession {
    readonly state:session_state_t;
    result:level_result_t|null=null;
    private advanceTics=0;
    private advanceFinale=false;
    get finale(){return this.state.gamestate===GS.GS_FINALE?{...F_GetState(),drawable:F_CanDraw()}:null;}
    respond(event:event_t):boolean {return this.state.gamestate===GS.GS_FINALE&&F_Responder(event);}
    private intermissionEnded=false;
    get intermission(){return this.state.gamestate===GS.GS_INTERMISSION?WI_GetState():null;}
    get completed():boolean {return this.state.gamestate!==GS.GS_LEVEL;}
    get mapname():string {return this.state.gamemode===GameMode_t.commercial?`MAP${String(this.state.gamemap).padStart(2,'0')}`:`E${this.state.gameepisode}M${this.state.gamemap}`;}
    get nextMapName():string|null {
        if(!this.result||this.result.terminal)return null;
        return this.state.gamemode===GameMode_t.commercial?`MAP${String(this.state.wminfo.next+1).padStart(2,'0')}`:`E${this.state.gameepisode}M${this.state.wminfo.next+1}`;
    }
    get nextAvailable():boolean {const name=this.nextMapName;return !!name&&W_CheckNumForName(name)>=0;}
    constructor(mapname:string,private presentation:game_presentation_t){
        const mode=detectGameMode(mapname),match=/^E(\d)M(\d)$/.exec(mapname);
        if(!match&&!/^MAP\d\d$/.test(mapname))throw new Error('Unsupported classic map name');
        const showFinale=()=>{F_StartFinale();presentation.onExit(this.state.secretexit);};
        this.state={gamemode:mode,gameskill:skill_t.sk_medium,gameepisode:match?+match[1]:1,gamemap:match?+match[2]:Number(mapname.slice(3)),gametic:0,
            deathmatch:0,netgame:false,fastparm:false,nomonsters:false,respawnmonsters:false,players:Array.from({length:4},G_CreatePlayer),playeringame:[true,false,false,false],consoleplayer:0,
            playerstarts:[],deathmatchstarts:[],totalkills:0,totalitems:0,totalsecret:0,wminfo:G_CreateIntermission(),wipegamestate:GS.GS_LEVEL,automapactive:false,viewactive:true,secretexit:false,gameaction:GA.ga_nothing,gamestate:GS.GS_LEVEL,
            get ceilingline(){return mapclip.ceilingline;},get linetarget(){return mapclip.linetarget;},get attackrange(){return mapclip.attackrange;},
            P_TryMove,P_CheckPosition,P_SlideMove,P_AimLineAttack,S_StartSound,S_StopSound,G_PlayerReborn,P_SetupPsprites,
            ST_Start:presentation.resetStatus,HU_Start:presentation.resetMessages,AM_Stop:presentation.closeAutomap,I_Tactile:presentation.tactile,
            P_UseSpecialLine,EV_DoDoor,EV_DoFloor,G_ExitLevel,G_SecretExitLevel,
            WI_Start:info=>{WI_Start(info);presentation.onExit(this.state.secretexit);},F_StartFinale:showFinale,G_DoLoadLevel:()=>{for(let i=0;i<this.state.players.length;i++)if(this.state.playeringame[i]&&this.state.players[i].playerstate===PST.PST_DEAD)this.state.players[i].playerstate=PST.PST_REBORN;this.start(false);},
            StopLevelSounds:()=>S_Init(snd_SfxVolume,snd_MusicVolume)};
    }
    get player(){return this.state.players[0];}
    start(newGame=true):void {
        const state=this.state;state.gamestate=GS.GS_LEVEL;state.gameaction=GA.ga_nothing;state.viewactive=true;this.result=null;this.advanceTics=0;this.advanceFinale=false;this.intermissionEnded=false;
        if(newGame){state.gametic=0;state.players=Array.from({length:4},G_CreatePlayer);M_ClearRandom();}
        WI_InitContext({get gamemode(){return state.gamemode;},get netgame(){return state.netgame;},get deathmatch(){return state.deathmatch;},get players(){return state.players;},playeringame:state.playeringame,S_StartSound,
            G_WorldDone:()=>{this.intermissionEnded=true;if(this.result?.terminal||this.nextAvailable)G_WorldDone();}});
        F_InitContext(state);G_InitGameContext(state);G_InitCompletionContext(state);P_InitMobjContext(state);P_InitSetupContext(state);P_InitInteractionContext(state);
        P_InitEnemyContext({gamemode:state.gamemode,S_StartSound,S_StartGlobalSound:s=>S_StartSound(null,s),gameplay:state});
        P_InitMapContext({gamemap:state.gamemap,P_DamageMobj,P_TouchSpecialThing,P_CrossSpecialLine,P_ShootSpecialLine,P_UseSpecialLine,S_StartSound});
        P_InitPlayerContext({gamemode:state.gamemode,P_MovePsprites,P_PlayerInSpecialSector,P_UseLines});
        P_InitPspriteContext({gamemode:state.gamemode,get linetarget(){return mapclip.linetarget;},S_StartSound,P_NoiseAlert,P_AimLineAttack,P_LineAttack,P_DamageMobj});
        P_InitSectorContext({gameplay:state,S_StartSound});S_InitSoundContext({gamemap:state.gamemap,get listener(){return state.players[0].mo;}});
        I_LinkStateActions({...weaponStateActions,...enemyStateActions});P_Init();P_SetupLevel(state.gameepisode,state.gamemap,1,state.gameskill);
        setupMapSky(this.mapname);
        if(!this.player.mo)throw new Error('El mapa no tiene inicio del jugador 1');
        this.player.viewz=this.player.mo.z+this.player.viewheight;
    }
    private finishIfRequested():void {
        const s=this.state;if(s.gameaction!==GA.ga_completed)return;
        const p=this.player;
        this.result={mapname:this.mapname,secret:s.secretexit,terminal:s.gamemode===GameMode_t.commercial?s.gamemap===30:s.gamemap===8,
            kills:p.killcount,maxkills:s.totalkills,items:p.itemcount,maxitems:s.totalitems,secrets:p.secretcount,maxsecrets:s.totalsecret,tics:leveltime};
        G_DoCompleted();if((s.gameaction as GA)===GA.ga_victory)s.F_StartFinale();
    }
    continueLevel():boolean {
        if(!this.completed||!this.result)return false;
        if(this.state.gamestate===GS.GS_INTERMISSION){
            const wi=WI_GetState();
            if(wi.state===WI.StatCount&&wi.sp_state!==10){this.advanceTics=2;return true;}
            if(!this.result.terminal&&!this.nextAvailable)return false;
            if(wi.state!==WI.NoState){this.advanceTics=2;return true;}return false;
        }
        if(this.state.gamemode!==GameMode_t.commercial||F_GetState().stage===2||(!this.result.terminal&&!this.nextAvailable))return false;
        this.advanceFinale=true;return true;
    }
    step(command:ticcmd_t):void {
        this.finishIfRequested();
        if(this.state.gamestate===GS.GS_INTERMISSION){
            Object.assign(this.player.cmd,command);
            // A DOM click becomes a release/press pair on simulation tics, so it
            // observes the same native edge detection as F or Space.
            if(this.advanceTics)this.player.cmd.buttons=this.advanceTics--===2?0:BT.BT_USE;
            if(!this.intermissionEnded)WI_Ticker();
            this.state.gametic=(this.state.gametic+1)|0;
            if(this.state.gameaction===GA.ga_worlddone)G_DoWorldDone();
            S_UpdateSounds(this.player.mo!);return;
        }
        if(this.state.gamestate===GS.GS_FINALE){
            Object.assign(this.player.cmd,command);if(this.advanceFinale)this.player.cmd.buttons=BT.BT_USE;
            F_Ticker();this.state.gametic=(this.state.gametic+1)|0;
            if(F_GetState().stage===2||this.state.gameaction===GA.ga_worlddone)this.advanceFinale=false;
            if(this.state.gameaction===GA.ga_worlddone&&this.nextAvailable)G_DoWorldDone();
            S_UpdateSounds(this.player.mo!);return;
        }
        if(this.completed)return;
        if(this.player.playerstate===PST.PST_REBORN){this.start(false);return;}
        Object.assign(this.player.cmd,command);
        P_Ticker({paused:false,netgame:false,menuactive:false,demoplayback:false,players:this.state.players,consoleplayer:0,playeringame:this.state.playeringame,
            P_PlayerThink,P_UpdateSpecials,P_RespawnSpecials});
        this.state.gametic=(this.state.gametic+1)|0;this.finishIfRequested();S_UpdateSounds(this.player.mo!);
    }
}
