import type { InstrumentId } from '../nasa/data';
export type ScienceTarget = {
  id: string;
  name: string;
  discovery: string;
  description: string;
  x: number;
  z: number;
  duration: number;
  energyCost: number;
  reward: number;
  requiredInstruments: InstrumentId[];
};

export const SCIENCE_TARGETS: ScienceTarget[] = [
  {
    id: 'ancient-outcrop', name: 'Ancient Lakebed Outcrop', discovery: 'Clay mineral signature',
    description: 'Layered sediment preserves a record of ancient water.', x: -18, z: 2,
    duration: 2.6, energyCost: 8, reward: 25, requiredInstruments:['pixl','sherloc','supercam'],
  },
  {
    id: 'basalt-fracture', name: 'Basalt Fracture Zone', discovery: 'Fractured volcanic basalt',
    description: 'Dark fracture faces expose the crater floor’s volcanic past.', x: -92, z: -36,
    duration: 3.2, energyCost: 11, reward: 32, requiredInstruments:['supercam','pixl','sherloc'],
  },
  {
    id: 'iron-ejecta', name: 'Iron-Rich Ejecta', discovery: 'Iron-bearing ejecta',
    description: 'A weathered impact deposit carries an unusual iron signature.', x: 78, z: -64,
    duration: 2.9, energyCost: 10, reward: 30, requiredInstruments:['pixl','supercam','sherloc'],
  },
];
