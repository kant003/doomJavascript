// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export let myargc = 0;
export let myargv: string[] = [];
// Browser adapter supplies arguments explicitly rather than using process.argv.
export function M_SetArgv(args: readonly string[]): void { myargv = [...args]; myargc = myargv.length; }
export function M_CheckParm(check: string): number {
    for (let i = 1; i < myargc; i++) if (check.toLowerCase() === myargv[i].toLowerCase()) return i;
    return 0;
}
