"use client";
import { BracketState } from "@/lib/types";
import React from "react";
import { BracketView } from "./bracket-view";

// The tournament's real games and results; nothing here can be picked.
export const LiveBracketView = ({ state }: { state: BracketState }) => (
  <fieldset disabled className="min-w-0 [&_button]:pointer-events-none">
    <BracketView state={state} onSelectTeam={() => {}} />
  </fieldset>
);
