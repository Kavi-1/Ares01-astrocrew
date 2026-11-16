import { acquireTarget } from '../engine/campaign';
import { create } from 'zustand';
import type { DriveContact } from '../engine/mobility';
import type { ScienceMethod } from '../engine/campaign';
import type { InstrumentId } from '../nasa/data';
import { useGameStore } from './gameStore';
const savedProgress=useGameStore.getState().missionProgress;

export type GamePhase = 'briefing' | 'active' | 'paused' | 'complete';
export type CameraMode = 'chase' | 'mast' | 'survey';
export type WorldAnchor = { id:string; x:number; y:number; visible:boolean; distance:number };
export type ScienceStage = { targetId:string; instrument:InstrumentId; progress:number; label:string; points:number; required:number; tip:string };
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
  cameraMode: CameraMode;
  cameraRevision: number;
  setCameraMode: (mode:CameraMode) => void;
  cycleCamera: () => void;
  resetCamera: () => void;
  scienceTool: InstrumentId | null;
  setScienceTool: (instrument:InstrumentId|null) => void;
  focusedTargetId: string | null;
  setFocusedTarget: (targetId:string|null) => void;
  scienceRequestId: number;
  scienceRequest: {id:number;targetId:string;instrument:InstrumentId;method?:ScienceMethod;sol:number} | null;
  requestScienceStep: (targetId:string,instrument:InstrumentId,method?:ScienceMethod) => void;
  activeScienceStage: ScienceStage | null;
  scienceConfirmId:number;
  confirmSciencePoint:()=>void;
  cancelScienceInteraction:()=>void;
  worldAnchors: WorldAnchor[];
  updateWorldAnchors: (anchors:WorldAnchor[]) => void;
  speed: number;
  distance: number;
  warning: string;
  driveContact: DriveContact | null;
  setDriveContact: (contact: DriveContact | null) => void;
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
  cameraMode:'chase', cameraRevision:0,
  setCameraMode: cameraMode => set(s=>({cameraMode,cameraRevision:s.cameraRevision+1})),
  cycleCamera: () => set(s=>({cameraMode:({chase:'mast',mast:'survey',survey:'chase'} as const)[s.cameraMode],cameraRevision:s.cameraRevision+1})),
  resetCamera: () => set(s=>({cameraRevision:s.cameraRevision+1})),
  scienceTool:null, setScienceTool:scienceTool=>set({scienceTool}),
  focusedTargetId:null, setFocusedTarget:focusedTargetId=>set({focusedTargetId}),
  scienceRequestId:0, scienceRequest:null,
  requestScienceStep:(targetId,instrument,method)=>set(s=>({scienceTool:instrument,focusedTargetId:targetId,scienceRequestId:s.scienceRequestId+1,scienceRequest:{id:s.scienceRequestId+1,targetId,instrument,method,sol:useGameStore.getState().campaign?.sol??0}})),
  activeScienceStage:null, scienceConfirmId:0,
  confirmSciencePoint:()=>set(s=>({scienceConfirmId:s.scienceConfirmId+1})),
  cancelScienceInteraction:()=>set({scienceRequest:null,activeScienceStage:null,scanningTargetId:null,scanProgress:0,scanMessage:'Instrument stowed. No incomplete reading was charged.'}),
  worldAnchors:[], updateWorldAnchors:worldAnchors=>set({worldAnchors}),
  speed: 0, distance: 0, warning: '', driveContact: null,
  setDriveContact: (driveContact) => set(s => s.driveContact?.code === driveContact?.code && s.driveContact?.reason === driveContact?.reason ? s : { driveContact }),
  begin: () => set({ phase: 'active' }),
  resetMission:()=>{useGameStore.getState().setMissionProgress({x:-18,z:12,heading:0,distance:0,battery:100,sol:1,scannedTargets:[],science:0});set({phase:'active',battery:100,sol:1,science:0,scanned:false,scannedTargets:[],nearbyTargetId:null,scanningTargetId:null,scanProgress:0,scanMessage:'',lastDiscovery:'',speed:0,distance:0,warning:'',cameraMode:'chase',scienceTool:null,focusedTargetId:null,scienceRequest:null,activeScienceStage:null,worldAnchors:[]})},
  togglePause: () => set((s) => ({ phase: s.phase === 'active' ? 'paused' : s.phase === 'paused' ? 'active' : s.phase, speed: 0, driveContact: null })),
  updateTelemetry: (data) => set(data),
  requestScan: () => set((s) => ({ scanRequestId: s.scanRequestId + 1 })),
  beginScan: (targetId) => set({ scanningTargetId: targetId, scanProgress: 0, scanMessage: 'SPECTROMETER CALIBRATING' }),
  cancelScan: (message = '') => set({ scanningTargetId: null, scanProgress: 0, scanMessage: message,activeScienceStage:null }),
  updateScanStatus: (nearbyTargetId, scanProgress, scanMessage) => set((s) => (
    s.nearbyTargetId === nearbyTargetId && s.scanProgress === scanProgress && s.scanMessage === scanMessage
      ? s
      : { nearbyTargetId, scanProgress, scanMessage }
  )),
  completeScan: (targetId, energyCost, reward, discovery, currentBattery, energyWh) => {
    const game=useGameStore.getState();
    if(game.campaign){const prior=game.campaign;const next=acquireTarget(prior,targetId,game.missionProgress.x,game.missionProgress.z);game.setCampaign(next);const complete=next.completed.includes(`science:${targetId}`)&&!prior.completed.includes(`science:${targetId}`);set({battery:useGameStore.getState().missionProgress.battery,scannedTargets:useGameStore.getState().missionProgress.scannedTargets,scanningTargetId:null,scanProgress:0,scanMessage:next.message,lastDiscovery:complete?discovery:get().lastDiscovery});return complete;}

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
  if(state.campaign!==previous.campaign&&state.campaign){const p=state.missionProgress;const boundary=previous.campaign?.sol!==state.campaign.sol||state.campaign.safe;const driveBoundary=boundary||previous.campaign?.mode!==state.campaign.mode;useMarsStore.setState({battery:p.battery,sol:p.sol,science:p.science,scannedTargets:[...p.scannedTargets],...(driveBoundary?{scanningTargetId:null,scanProgress:0,activeScienceStage:null,scienceRequest:null,driveContact:null,speed:0}:{} )});}
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
      scienceRequest:null,activeScienceStage:null,focusedTargetId:null,scienceTool:null,worldAnchors:[],cameraMode:'chase',
    });
  } else if (state.missionPhase === 'report') {
    useMarsStore.setState({ phase: 'complete', speed: 0, scanningTargetId: null, scanProgress: 0,activeScienceStage:null,scienceRequest:null,worldAnchors:[] });
  }
});
