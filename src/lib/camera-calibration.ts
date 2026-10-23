import {z} from 'zod';
export const gateInput=z.object({xMin:z.number().min(0).max(1),xMax:z.number().min(0).max(1),entryY:z.number().min(0).max(1),exitY:z.number().min(0).max(1),confirmations:z.number().int().min(2).max(5).default(2),confidence:z.number().min(.15).max(.9).default(.2)}).refine(g=>g.xMin<g.xMax&&g.exitY+.03<=g.entryY,'INVALID_GATE_GEOMETRY');
export const cameraCalibrationInput=z.object({rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]).default(0),gate:gateInput});
