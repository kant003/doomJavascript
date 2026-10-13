// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export type actionf_v = () => void;
export type actionf_p1 = (arg: unknown) => void;
export type actionf_p2 = (arg1: unknown, arg2: unknown) => void;
// C union aliases share a single pointer. -1 marks lazy thinker removal.
export type actionf_t = actionf_v | actionf_p1 | actionf_p2 | null | -1;
export type think_t = actionf_t;
export interface thinker_t { prev: thinker_t | null; next: thinker_t | null; function: think_t }
