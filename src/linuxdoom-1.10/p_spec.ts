// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Sector specials, events, animations and setup. See PORTING.md for platform boundaries.
import { mapstate as m } from './r_state.h';
import type { line_t,sector_t,side_t,degenmobj_t } from './r_defs.h';
import type { mobj_t } from './p_mobj.h';
import type { thinker_t } from './d_think.h';
import { P_AddThinker,leveltime } from './p_tick';
import { ML_TWOSIDED } from './doomdata.h';
import { FRACUNIT as F } from './m_fixed.h';
import type { sfxenum_t } from './sounds.h';
import { GameMode_t,powertype_t as PW } from './doomdef.h';
import { cheat_t as CF,type player_t } from './d_player.h';
import { mobjtype_t as MT } from './info.h';
import { P_DamageMobj } from './p_inter';
import { P_Random } from './m_random';
import { EV_DoDoor,P_SpawnDoorCloseIn30,P_SpawnDoorRaiseIn5Mins } from './p_doors';
import { EV_DoFloor,EV_BuildStairs,T_MoveFloor } from './p_floor';
import { EV_DoCeiling,EV_CeilingCrushStop,activeceilings } from './p_ceilng';
import { EV_DoPlat,EV_StopPlat,activeplats } from './p_plats';
import { EV_LightTurnOn,EV_StartLightStrobing,EV_TurnTagLightsOff,P_SpawnFireFlicker,P_SpawnLightFlash,P_SpawnStrobeFlash,P_SpawnGlowingLight } from './p_lights';
import { EV_Teleport } from './p_telept';
import { P_ChangeSwitchTexture,buttonlist } from './p_switch';
import { floor_e as FT,vldoor_e as DT,ceiling_e as CT,plattype_e as PT,stair_e as ST,FLOORSPEED,type floormove_t,bwhere_e as BW,FASTDARK,SLOWDARK } from './p_spec.h';
import { texturestate,R_CheckTextureNumForName,R_TextureNumForName,R_FlatNumForName } from './r_data';
import { W_CheckNumForName } from './w_wad';
import { M_CheckParm,myargv } from './m_argv';
import { sfxenum_t as SFX } from './sounds.h';
export interface specials_game_t {gamemode:GameMode_t;deathmatch:number;totalsecret:number;G_ExitLevel():void;G_SecretExitLevel():void}
export interface sector_context_t {S_StartSound(origin:mobj_t|degenmobj_t|null,sound:sfxenum_t):void;gameplay?:specials_game_t}
export function P_SpecialsGame():specials_game_t {if(!context?.gameplay)throw new Error('Sector gameplay is not linked');return context.gameplay;}
let context:sector_context_t|null=null;
export function P_InitSectorContext(game:sector_context_t):void {context=game;}
export function P_SectorSound(origin:mobj_t|degenmobj_t|null,sound:sfxenum_t):void {if(!context)throw new Error('Sector sound is not linked');context.S_StartSound(origin,sound);}
const owners=new WeakMap<thinker_t,{thinker:thinker_t}>();
export function P_AddSpecialThinker<T extends {thinker:thinker_t}>(effect:T,action:(argument:unknown)=>void):T {owners.set(effect.thinker,effect);P_AddThinker(effect.thinker);effect.thinker.function=action;return effect;}
export function P_SpecialForThinker<T extends {thinker:thinker_t}>(argument:unknown):T {
    const effect=owners.get(argument as thinker_t)??(argument&&typeof argument==='object'&&'thinker' in argument?argument as T:null);
    if(!effect)throw new Error('Special thinker has no owner');return effect as T;
}
export function getSide(sector:number,line:number,side:number):side_t {return m.sides[m.sectors[sector].lines[line].sidenum[side]];}
export function getSector(sector:number,line:number,side:number):sector_t {return getSide(sector,line,side).sector;}
export function twoSided(sector:number,line:number):number {return m.sectors[sector].lines[line].flags&ML_TWOSIDED;}
export function getNextSector(line:line_t,sec:sector_t):sector_t|null {if(!(line.flags&ML_TWOSIDED))return null;return line.frontsector===sec?line.backsector:line.frontsector;}
export function P_FindLowestFloorSurrounding(sec:sector_t):number {let height=sec.floorheight;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.min(height,other.floorheight);}return height;}
export function P_FindHighestFloorSurrounding(sec:sector_t):number {let height=-500*F;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.max(height,other.floorheight);}return height;}
export function P_FindNextHighestFloor(sec:sector_t,currentheight:number):number {
    const heights:number[]=[];for(const l of sec.lines){const other=getNextSector(l,sec);if(other&&other.floorheight>currentheight)heights.push(other.floorheight);if(heights.length>=20)break;}
    return heights.length?Math.min(...heights):currentheight;
}
export function P_FindLowestCeilingSurrounding(sec:sector_t):number {let height=0x7fffffff;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.min(height,other.ceilingheight);}return height;}
export function P_FindHighestCeilingSurrounding(sec:sector_t):number {let height=0;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)height=Math.max(height,other.ceilingheight);}return height;}
export function P_FindSectorFromLineTag(line:Pick<line_t,'tag'>,start:number):number {for(let i=start+1;i<m.numsectors;i++)if(m.sectors[i].tag===line.tag)return i;return -1;}
export function P_FindMinSurroundingLight(sec:sector_t,max:number):number {let min=max;for(const l of sec.lines){const other=getNextSector(l,sec);if(other)min=Math.min(min,other.lightlevel);}return min;}

export function P_CrossSpecialLine(linenum:number,side:number,thing:mobj_t):void {

    let ok:number;

    const line = m.lines[linenum];

    //	Triggers that other things can activate
    if (!thing.player)
    {
	// Things that should NOT trigger specials...
	switch(thing.type)
	{
	  case MT.MT_ROCKET:
	  case MT.MT_PLASMA:
	  case MT.MT_BFG:
	  case MT.MT_TROOPSHOT:
	  case MT.MT_HEADSHOT:
	  case MT.MT_BRUISERSHOT:
	    return;
	    break;

	  default: break;
	}

	ok = 0;
	switch(line.special)
	{
	  case 39:	// TELEPORT TRIGGER
	  case 97:	// TELEPORT RETRIGGER
	  case 125:	// TELEPORT MONSTERONLY TRIGGER
	  case 126:	// TELEPORT MONSTERONLY RETRIGGER
	  case 4:	// RAISE DOOR
	  case 10:	// PLAT DOWN-WAIT-UP-STAY TRIGGER
	  case 88:	// PLAT DOWN-WAIT-UP-STAY RETRIGGER
	    ok = 1;
	    break;
	}
	if (!ok)
	    return;
    }


    // Note: could use some const's here.
    switch (line.special)
    {
	// TRIGGERS.
	// All from here to RETRIGGERS.
      case 2:
	// Open Door
	EV_DoDoor(line,DT.open);
	line.special = 0;
	break;

      case 3:
	// Close Door
	EV_DoDoor(line,DT.close);
	line.special = 0;
	break;

      case 4:
	// Raise Door
	EV_DoDoor(line,DT.normal);
	line.special = 0;
	break;

      case 5:
	// Raise Floor
	EV_DoFloor(line,FT.raiseFloor);
	line.special = 0;
	break;

      case 6:
	// Fast Ceiling Crush & Raise
	EV_DoCeiling(line,CT.fastCrushAndRaise);
	line.special = 0;
	break;

      case 8:
	// Build Stairs
	EV_BuildStairs(line,ST.build8);
	line.special = 0;
	break;

      case 10:
	// PlatDownWaitUp
	EV_DoPlat(line,PT.downWaitUpStay,0);
	line.special = 0;
	break;

      case 12:
	// Light Turn On - brightest near
	EV_LightTurnOn(line,0);
	line.special = 0;
	break;

      case 13:
	// Light Turn On 255
	EV_LightTurnOn(line,255);
	line.special = 0;
	break;

      case 16:
	// Close Door 30
	EV_DoDoor(line,DT.close30ThenOpen);
	line.special = 0;
	break;

      case 17:
	// Start Light Strobing
	EV_StartLightStrobing(line);
	line.special = 0;
	break;

      case 19:
	// Lower Floor
	EV_DoFloor(line,FT.lowerFloor);
	line.special = 0;
	break;

      case 22:
	// Raise floor to nearest height and change texture
	EV_DoPlat(line,PT.raiseToNearestAndChange,0);
	line.special = 0;
	break;

      case 25:
	// Ceiling Crush and Raise
	EV_DoCeiling(line,CT.crushAndRaise);
	line.special = 0;
	break;

      case 30:
	// Raise floor to shortest texture height
	//  on either side of lines.
	EV_DoFloor(line,FT.raiseToTexture);
	line.special = 0;
	break;

      case 35:
	// Lights Very Dark
	EV_LightTurnOn(line,35);
	line.special = 0;
	break;

      case 36:
	// Lower Floor (TURBO)
	EV_DoFloor(line,FT.turboLower);
	line.special = 0;
	break;

      case 37:
	// LowerAndChange
	EV_DoFloor(line,FT.lowerAndChange);
	line.special = 0;
	break;

      case 38:
	// Lower Floor To Lowest
	EV_DoFloor( line, FT.lowerFloorToLowest );
	line.special = 0;
	break;

      case 39:
	// TELEPORT!
	EV_Teleport( line, side, thing );
	line.special = 0;
	break;

      case 40:
	// RaiseCeilingLowerFloor
	EV_DoCeiling( line, CT.raiseToHighest );
	EV_DoFloor( line, FT.lowerFloorToLowest );
	line.special = 0;
	break;

      case 44:
	// Ceiling Crush
	EV_DoCeiling( line, CT.lowerAndCrush );
	line.special = 0;
	break;

      case 52:
	// EXIT!
	P_SpecialsGame().G_ExitLevel();
	break;

      case 53:
	// Perpetual Platform Raise
	EV_DoPlat(line,PT.perpetualRaise,0);
	line.special = 0;
	break;

      case 54:
	// Platform Stop
	EV_StopPlat(line);
	line.special = 0;
	break;

      case 56:
	// Raise Floor Crush
	EV_DoFloor(line,FT.raiseFloorCrush);
	line.special = 0;
	break;

      case 57:
	// Ceiling Crush Stop
	EV_CeilingCrushStop(line);
	line.special = 0;
	break;

      case 58:
	// Raise Floor 24
	EV_DoFloor(line,FT.raiseFloor24);
	line.special = 0;
	break;

      case 59:
	// Raise Floor 24 And Change
	EV_DoFloor(line,FT.raiseFloor24AndChange);
	line.special = 0;
	break;

      case 104:
	// Turn lights off in sector(tag)
	EV_TurnTagLightsOff(line);
	line.special = 0;
	break;

      case 108:
	// Blazing Door Raise (faster than TURBO!)
	EV_DoDoor (line,DT.blazeRaise);
	line.special = 0;
	break;

      case 109:
	// Blazing Door Open (faster than TURBO!)
	EV_DoDoor (line,DT.blazeOpen);
	line.special = 0;
	break;

      case 100:
	// Build Stairs Turbo 16
	EV_BuildStairs(line,ST.turbo16);
	line.special = 0;
	break;

      case 110:
	// Blazing Door Close (faster than TURBO!)
	EV_DoDoor (line,DT.blazeClose);
	line.special = 0;
	break;

      case 119:
	// Raise floor to nearest surr. floor
	EV_DoFloor(line,FT.raiseFloorToNearest);
	line.special = 0;
	break;

      case 121:
	// Blazing PlatDownWaitUpStay
	EV_DoPlat(line,PT.blazeDWUS,0);
	line.special = 0;
	break;

      case 124:
	// Secret EXIT
	P_SpecialsGame().G_SecretExitLevel();
	break;

      case 125:
	// TELEPORT MonsterONLY
	if (!thing.player)
	{
	    EV_Teleport( line, side, thing );
	    line.special = 0;
	}
	break;

      case 130:
	// Raise Floor Turbo
	EV_DoFloor(line,FT.raiseFloorTurbo);
	line.special = 0;
	break;

      case 141:
	// Silent Ceiling Crush & Raise
	EV_DoCeiling(line,CT.silentCrushAndRaise);
	line.special = 0;
	break;

	// RETRIGGERS.  All from here till end.
      case 72:
	// Ceiling Crush
	EV_DoCeiling( line, CT.lowerAndCrush );
	break;

      case 73:
	// Ceiling Crush and Raise
	EV_DoCeiling(line,CT.crushAndRaise);
	break;

      case 74:
	// Ceiling Crush Stop
	EV_CeilingCrushStop(line);
	break;

      case 75:
	// Close Door
	EV_DoDoor(line,DT.close);
	break;

      case 76:
	// Close Door 30
	EV_DoDoor(line,DT.close30ThenOpen);
	break;

      case 77:
	// Fast Ceiling Crush & Raise
	EV_DoCeiling(line,CT.fastCrushAndRaise);
	break;

      case 79:
	// Lights Very Dark
	EV_LightTurnOn(line,35);
	break;

      case 80:
	// Light Turn On - brightest near
	EV_LightTurnOn(line,0);
	break;

      case 81:
	// Light Turn On 255
	EV_LightTurnOn(line,255);
	break;

      case 82:
	// Lower Floor To Lowest
	EV_DoFloor( line, FT.lowerFloorToLowest );
	break;

      case 83:
	// Lower Floor
	EV_DoFloor(line,FT.lowerFloor);
	break;

      case 84:
	// LowerAndChange
	EV_DoFloor(line,FT.lowerAndChange);
	break;

      case 86:
	// Open Door
	EV_DoDoor(line,DT.open);
	break;

      case 87:
	// Perpetual Platform Raise
	EV_DoPlat(line,PT.perpetualRaise,0);
	break;

      case 88:
	// PlatDownWaitUp
	EV_DoPlat(line,PT.downWaitUpStay,0);
	break;

      case 89:
	// Platform Stop
	EV_StopPlat(line);
	break;

      case 90:
	// Raise Door
	EV_DoDoor(line,DT.normal);
	break;

      case 91:
	// Raise Floor
	EV_DoFloor(line,FT.raiseFloor);
	break;

      case 92:
	// Raise Floor 24
	EV_DoFloor(line,FT.raiseFloor24);
	break;

      case 93:
	// Raise Floor 24 And Change
	EV_DoFloor(line,FT.raiseFloor24AndChange);
	break;

      case 94:
	// Raise Floor Crush
	EV_DoFloor(line,FT.raiseFloorCrush);
	break;

      case 95:
	// Raise floor to nearest height
	// and change texture.
	EV_DoPlat(line,PT.raiseToNearestAndChange,0);
	break;

      case 96:
	// Raise floor to shortest texture height
	// on either side of lines.
	EV_DoFloor(line,FT.raiseToTexture);
	break;

      case 97:
	// TELEPORT!
	EV_Teleport( line, side, thing );
	break;

      case 98:
	// Lower Floor (TURBO)
	EV_DoFloor(line,FT.turboLower);
	break;

      case 105:
	// Blazing Door Raise (faster than TURBO!)
	EV_DoDoor (line,DT.blazeRaise);
	break;

      case 106:
	// Blazing Door Open (faster than TURBO!)
	EV_DoDoor (line,DT.blazeOpen);
	break;

      case 107:
	// Blazing Door Close (faster than TURBO!)
	EV_DoDoor (line,DT.blazeClose);
	break;

      case 120:
	// Blazing PlatDownWaitUpStay.
	EV_DoPlat(line,PT.blazeDWUS,0);
	break;

      case 126:
	// TELEPORT MonsterONLY.
	if (!thing.player)
	    EV_Teleport( line, side, thing );
	break;

      case 128:
	// Raise To Nearest Floor
	EV_DoFloor(line,FT.raiseFloorToNearest);
	break;

      case 129:
	// Raise Floor Turbo
	EV_DoFloor(line,FT.raiseFloorTurbo);
	break;
    }
}
export function P_ShootSpecialLine(thing:mobj_t,line:line_t):void {

    let ok:number;

    //	Impacts that other things can activate.
    if (!thing.player)
    {
	ok = 0;
	switch(line.special)
	{
	  case 46:
	    // OPEN DOOR IMPACT
	    ok = 1;
	    break;
	}
	if (!ok)
	    return;
    }

    switch(line.special)
    {
      case 24:
	// RAISE FLOOR
	EV_DoFloor(line,FT.raiseFloor);
	P_ChangeSwitchTexture(line,0);
	break;

      case 46:
	// OPEN DOOR
	EV_DoDoor(line,DT.open);
	P_ChangeSwitchTexture(line,1);
	break;

      case 47:
	// RAISE FLOOR NEAR AND CHANGE
	EV_DoPlat(line,PT.raiseToNearestAndChange,0);
	P_ChangeSwitchTexture(line,0);
	break;
    }
}
export function P_PlayerInSpecialSector(player:player_t):void {



    const sector = player.mo!.subsector!.sector!;

    // Falling, not all the way down yet?
    if (player.mo!.z != sector.floorheight)
	return;

    // Has hitten ground.
    switch (sector.special)
    {
      case 5:
	// HELLSLIME DAMAGE
	if (!player.powers[PW.pw_ironfeet])
	    if (!(leveltime&0x1f))
		P_DamageMobj (player.mo!, null, null, 10);
	break;

      case 7:
	// NUKAGE DAMAGE
	if (!player.powers[PW.pw_ironfeet])
	    if (!(leveltime&0x1f))
		P_DamageMobj (player.mo!, null, null, 5);
	break;

      case 16:
	// SUPER HELLSLIME DAMAGE
      case 4:
	// STROBE HURT
	if (!player.powers[PW.pw_ironfeet]
	    || (P_Random()<5) )
	{
	    if (!(leveltime&0x1f))
		P_DamageMobj (player.mo!, null, null, 20);
	}
	break;

      case 9:
	// SECRET SECTOR
	player.secretcount++;
	sector.special = 0;
	break;

      case 11:
	// EXIT SUPER DAMAGE! (for E1M8 finale)
	player.cheats &= ~CF.CF_GODMODE;

	if (!(leveltime&0x1f))
	    P_DamageMobj (player.mo!, null, null, 20);

	if (player.health <= 10)
	    P_SpecialsGame().G_ExitLevel();
	break;

      default:
	throw new Error(`P_PlayerInSpecialSector: unknown special ${sector.special}`);
	break;
    };
}

export function EV_DoDonut(line:Pick<line_t,'tag'>):number {
    let secnum=-1,rtn=0;
    while((secnum=P_FindSectorFromLineTag(line,secnum))>=0){
        const s1=m.sectors[secnum];if(s1.specialdata)continue;
        rtn=1;
        const first=s1.lines[0],s2=first?getNextSector(first,s1):null;
        if(!s2)throw new Error('EV_DoDonut: missing surrounding sector');
        for(const edge of s2.lines){
            // C's (!flags & ML_TWOSIDED) is always zero; preserve that precedence.
            if(edge.backsector===s1)continue;
            const s3=edge.backsector;
            if(!s3)throw new Error('EV_DoDonut: missing outer back sector');
            function spawn(sector:sector_t,type:FT,direction:number):floormove_t {
                const effect:floormove_t={thinker:{prev:null,next:null,function:null},sector,type,direction,crush:false,
                    speed:FLOORSPEED/2,texture:0,newspecial:0,floordestheight:s3!.floorheight};
                sector.specialdata=effect;return P_AddSpecialThinker(effect,T_MoveFloor);
            }
            const ring=spawn(s2,FT.donutRaise,1);ring.texture=s3.floorpic;
            spawn(s1,FT.lowerFloor,-1);break;
        }
    }
    return rtn;
}

export interface anim_t {istexture:boolean;picnum:number;basepic:number;numpics:number;speed:number}
export interface animdef_t {istexture:boolean;endname:string;startname:string;speed:number}
export const MAXANIMS=32,MAXLINEANIMS=64;
export const anims:anim_t[]=[];
// lastanim is the count rather than a pointer one past the last active animation.
export let lastanim=0;
export let levelTimer=false,levelTimeCount=0,numlinespecials=0;
export const linespeciallist:line_t[]=[];
export function P_InitPicAnims():void {
    anims.length=0;lastanim=0;
    for(const def of animdefs){
        if(def.istexture?R_CheckTextureNumForName(def.startname)===-1:W_CheckNumForName(def.startname)===-1)continue;
        const lookup=def.istexture?R_TextureNumForName:R_FlatNumForName;
        const picnum=lookup(def.endname),basepic=lookup(def.startname),numpics=picnum-basepic+1;
        if(numpics<2)throw new Error(`P_InitPicAnims: bad cycle from ${def.startname} to ${def.endname}`);
        anims.push({istexture:def.istexture,picnum,basepic,numpics,speed:def.speed});lastanim++;
    }
}
export function P_UpdateSpecials():void {
    if(levelTimer){levelTimeCount=(levelTimeCount-1)|0;if(!levelTimeCount)P_SpecialsGame().G_ExitLevel();}
    for(const anim of anims)for(let i=anim.basepic;i<anim.basepic+anim.numpics;i++){
        const pic=anim.basepic+((Math.trunc(leveltime/anim.speed)+i)%anim.numpics);
        (anim.istexture?texturestate.texturetranslation:texturestate.flattranslation)[i]=pic;
    }
    for(const line of linespeciallist)if(line.special===48){const side=m.sides[line.sidenum[0]];side.textureoffset=(side.textureoffset+F)|0;}
    for(const b of buttonlist)if(b.btimer&&!--b.btimer){
        const side=m.sides[b.line!.sidenum[0]];
        switch(b.where){case BW.top:side.toptexture=b.btexture;break;case BW.middle:side.midtexture=b.btexture;break;case BW.bottom:side.bottomtexture=b.btexture;break;}
        // C casts &button.soundorg (pointer-to-pointer) to mobj_t*. Use the actual origin in TS.
        P_SectorSound(b.soundorg,SFX.sfx_swtchn);
        Object.assign(b,{line:null,where:BW.top,btexture:0,btimer:0,soundorg:null});
    }
}
export function P_SpawnSpecials():void {
    const game=P_SpecialsGame();levelTimer=false;
    let i=M_CheckParm('-avg');
    if(i&&game.deathmatch){levelTimer=true;levelTimeCount=20*60*35;}
    i=M_CheckParm('-timer');
    if(i&&game.deathmatch){
        if(myargv[i+1]===undefined)throw new Error('P_SpawnSpecials: -timer needs a value');
        // Match atoi's numeric prefix and zero for a nonnumeric argument.
        levelTimeCount=Math.imul(Number.parseInt(myargv[i+1],10)||0,60*35);levelTimer=true;
    }
    for(let index=0;index<m.numsectors;index++){
        const sector=m.sectors[index];
        switch(sector.special){
            case 1:P_SpawnLightFlash(sector);break;
            case 2:P_SpawnStrobeFlash(sector,FASTDARK,0);break;
            case 3:P_SpawnStrobeFlash(sector,SLOWDARK,0);break;
            case 4:P_SpawnStrobeFlash(sector,FASTDARK,0);sector.special=4;break;
            case 8:P_SpawnGlowingLight(sector);break;
            case 9:game.totalsecret++;break;
            case 10:P_SpawnDoorCloseIn30(sector);break;
            case 12:P_SpawnStrobeFlash(sector,SLOWDARK,1);break;
            case 13:P_SpawnStrobeFlash(sector,FASTDARK,1);break;
            case 14:P_SpawnDoorRaiseIn5Mins(sector,index);break;
            case 17:P_SpawnFireFlicker(sector);break;
        }
    }
    numlinespecials=0;linespeciallist.length=0;
    for(const line of m.lines)if(line.special===48){
        if(numlinespecials===MAXLINEANIMS)throw new Error('P_SpawnSpecials: MAXLINEANIMS exceeded');
        linespeciallist.push(line);numlinespecials++;
    }
    activeceilings.fill(null);activeplats.fill(null);
    for(const b of buttonlist)Object.assign(b,{line:null,where:BW.top,btexture:0,btimer:0,soundorg:null});
}

export const animdefs:animdef_t[]=[
    {"istexture": false, "endname": "NUKAGE3", "startname": "NUKAGE1", "speed": 8},
    {"istexture": false, "endname": "FWATER4", "startname": "FWATER1", "speed": 8},
    {"istexture": false, "endname": "SWATER4", "startname": "SWATER1", "speed": 8},
    {"istexture": false, "endname": "LAVA4", "startname": "LAVA1", "speed": 8},
    {"istexture": false, "endname": "BLOOD3", "startname": "BLOOD1", "speed": 8},
    {"istexture": false, "endname": "RROCK08", "startname": "RROCK05", "speed": 8},
    {"istexture": false, "endname": "SLIME04", "startname": "SLIME01", "speed": 8},
    {"istexture": false, "endname": "SLIME08", "startname": "SLIME05", "speed": 8},
    {"istexture": false, "endname": "SLIME12", "startname": "SLIME09", "speed": 8},
    {"istexture": true, "endname": "BLODGR4", "startname": "BLODGR1", "speed": 8},
    {"istexture": true, "endname": "SLADRIP3", "startname": "SLADRIP1", "speed": 8},
    {"istexture": true, "endname": "BLODRIP4", "startname": "BLODRIP1", "speed": 8},
    {"istexture": true, "endname": "FIREWALL", "startname": "FIREWALA", "speed": 8},
    {"istexture": true, "endname": "GSTFONT3", "startname": "GSTFONT1", "speed": 8},
    {"istexture": true, "endname": "FIRELAVA", "startname": "FIRELAV3", "speed": 8},
    {"istexture": true, "endname": "FIREMAG3", "startname": "FIREMAG1", "speed": 8},
    {"istexture": true, "endname": "FIREBLU2", "startname": "FIREBLU1", "speed": 8},
    {"istexture": true, "endname": "ROCKRED3", "startname": "ROCKRED1", "speed": 8},
    {"istexture": true, "endname": "BFALL4", "startname": "BFALL1", "speed": 8},
    {"istexture": true, "endname": "SFALL4", "startname": "SFALL1", "speed": 8},
    {"istexture": true, "endname": "WFALL4", "startname": "WFALL1", "speed": 8},
    {"istexture": true, "endname": "DBRAIN4", "startname": "DBRAIN1", "speed": 8},
];
