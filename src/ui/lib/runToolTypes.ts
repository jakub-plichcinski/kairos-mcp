import type { ForwardOutput, ForwardSolution } from "../../tools/forward_schema.js";

export type RunContract = ForwardOutput["contract"];
export type RunLayer = NonNullable<ForwardOutput["current_layer"]>;
export type RunSolutionSubmission = ForwardSolution;
export type RunContractType = RunContract["type"];

export type { ForwardOutput, ForwardSolution };
