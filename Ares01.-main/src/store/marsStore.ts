import { create } from 'zustand';
import { useGameStore } from './gameStore';
const savedProgress=useGameStore.getState().missionProgress;

export type GamePhase = 'briefing' | 'active' | 'paused' | 'complete';
type Telemetry = { battery: number; sol: number; speed: number; distance: number; warning: string };
type MarsState = {
  phase: GamePhase;
  battery: number;
  sol: number;
  science: number;
  scanned: boolean;
  scannedTargets: string[];
  nearbyTargetId: string | null;
  scanningTargetId: string | null;
  scanRequestId: number;
  scanProgress: number;
  scanMessage: string;
  lastDiscovery: string;
  speed: number;
  distance: number;
  warning: string;
  begin: () => void;
  togglePause: () => void;
  updateTelemetry: (data: Partial<Telemetry>) => void;
  requestScan: () => void;
  beginScan: (targetId: string) => void;
  cancelScan: (message?: string) => void;
  updateScanStatus: (nearbyTargetId: string | null, progress: number, message: string) => void;
  completeScan: (targetId: string, energyCost: number, reward: number, discovery: string, currentBattery?: number, energyWh?:number) => boolean;
  resetMission:()=>void;
};

export const useMarsStore = create<MarsState>((set,get) => ({
  phase: 'briefing', battery: savedProgress.battery, sol: savedProgress.sol, science: savedProgress.science, scanned: savedProgress.scannedTargets.length>0,
  scannedTargets: savedProgress.scannedTargets, nearbyTargetId: null, scanningTargetId: null, scanRequestId: 0,
  scanProgress: 0, scanMessage: '', lastDiscovery: '',
  speed: 0, distance: 0, warning: '',
  begin: () => set({ phase: 'active' }),
  resetMission:()=>{useGameStore.getState().setMissionProgress({x:-18,z:12,heading:0,distance:0,battery:100,sol:1,scannedTargets:[],science:0});set({phase:'active',battery:100,sol:1,science:0,scanned:false,scannedTargets:[],nearbyTargetId:null,scanningTargetId:null,scanProgress:0,scanMessage:'',lastDiscovery:'',speed:0,distance:0,warning:''})},
  togglePause: () => set((s) => ({ phase: s.phase === 'active' ? 'paused' : s.phase === 'paused' ? 'active' : s.phase })),
  updateTelemetry: (data) => set(data),
  requestScan: () => set((s) => ({ scanRequestId: s.scanRequestId + 1 })),
  beginScan: (targetId) => set({ scanningTargetId: targetId, scanProgress: 0, scanMessage: 'SPECTROMETER CALIBRATING' }),
  cancelScan: (message = '') => set({ scanningTargetId: null, scanProgress: 0, scanMessage: message }),
  updateScanStatus: (nearbyTargetId, scanProgress, scanMessage) => set((s) => (
    s.nearbyTargetId === nearbyTargetId && s.scanProgress === scanProgress && s.scanMessage === scanMessage
      ? s
      : { nearbyTargetId, scanProgress, scanMessage }
  )),
  completeScan: (targetId, energyCost, reward, discovery, currentBattery, energyWh) => {
    let completed = false;
    set((s) => {
      const availableBattery = currentBattery === undefined ? s.battery : Math.min(s.battery, currentBattery);
      if (s.scannedTargets.includes(targetId) || availableBattery < energyCost) return s;
      completed = true;
      const scannedTargets = [...s.scannedTargets, targetId];
      return {
        battery: Math.max(0, availableBattery - energyCost),
        science: s.science + reward,
        scannedTargets,
        scanned: targetId === 'ancient-outcrop' || s.scanned,
        scanningTargetId: null,
        scanProgress: 0,
        scanMessage: `DISCOVERY · ${discovery} · +${reward} RP · −${energyWh===undefined?`${energyCost}% POWER`:`${energyWh.toFixed(1)} Wh`}`,
        lastDiscovery: discovery,
      };
    });
    if(completed){const mission=get();useGameStore.getState().setMissionProgress({battery:mission.battery,scannedTargets:mission.scannedTargets,science:mission.science})}
    return completed;
  },
}));

// Campaign routing owns the lifetime of surface controls. Reset transient rover
// state as well as saved campaign state when starting over from the report.
useGameStore.subscribe((state, previous) => {
  if (state.missionPhase === previous.missionPhase) return;
  if (state.missionPhase === 'briefing') {
    const progress = state.missionProgress;
    useMarsStore.setState({
      phase: 'briefing', battery: progress.battery, sol: progress.sol,
      science: progress.science, scanned: progress.scannedTargets.length > 0,
      scannedTargets: [...progress.scannedTargets], nearbyTargetId: null,
      scanningTargetId: null, scanRequestId: 0, scanProgress: 0,
      scanMessage: '', lastDiscovery: '', speed: 0,
      distance: progress.distance, warning: '',
    });
  } else if (state.missionPhase === 'report') {
    useMarsStore.setState({ phase: 'complete', speed: 0, scanningTargetId: null, scanProgress: 0 });
  }
});
