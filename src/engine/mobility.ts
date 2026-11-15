import { FIXED } from '../nasa/data';
import { nominalBatteryWh } from '../nasa/engineering';
import type { Campaign } from './campaign';

const driveKeys = 'WASD or arrow keys to drive; Space to brake. Release and press again after pause or sol changes.';

export type DrivePhase = 'briefing' | 'active' | 'paused' | 'complete';
export type DriveStatusCode = 'ready' | 'briefing' | 'paused' | 'finished' | 'damage' | 'safe-mode' | 'route-hazard' | 'planning' | 'sol-exhausted' | 'no-allocation' | 'drive-exhausted';
/** A current attempted approach, rather than a persistent campaign restriction. */
export type DriveContact = { code: 'obstacle' | 'slope' | 'boundary' | 'energy'; reason: string };
export type DriveStatus = {
  allowed: boolean;
  code: DriveStatusCode;
  reason: string;
  action: string;
  remainingDriveHours: number | null;
  remainingSolHours: number | null;
  reserveWh: number | null;
};

/**
 * Explains the campaign restrictions used by live driving, without advancing time,
 * spending energy or changing a plan. Terrain contact is a separate local check:
 * a blocked approach must still allow reversing or turning away from the obstacle.
 * `traverse` remains authoritative for the energy of each accepted segment.
 */
export function getDriveStatus(campaign: Campaign | null, phase: DrivePhase = 'active'): DriveStatus {
  const remainingDriveHours = campaign ? Math.max(0, campaign.plan.driveHours - campaign.driveHours) : null;
  const remainingSolHours = campaign ? Math.max(0, FIXED.solHours - campaign.elapsedHours) : null;
  const reserveWh = campaign ? nominalBatteryWh() * campaign.config.reserve : null;
  const status = (code: DriveStatusCode, reason: string, action: string): DriveStatus => ({
    allowed: code === 'ready', code, reason, action, remainingDriveHours, remainingSolHours, reserveWh,
  });

  if (campaign?.mode === 'finished' || phase === 'complete') return status('finished', 'Surface mission finished. Driving is closed.', 'Open the mission report.');
  if (phase === 'paused') return status('paused', 'Mission paused. Rover controls are suspended.', 'Resume the mission or press Escape.');
  if (phase === 'briefing') return status('briefing', 'Surface operations have not started.', 'Start the surface mission.');
  // Legacy live saves have no sol allocation. Their established safe-mode check
  // stays with the mission record; no campaign allocation is invented for them.
  if (!campaign) return status('ready', 'Rover ready to drive.', driveKeys);
  if (campaign.mobilityDisabled) return status('damage', campaign.route === 'cross'
    ? 'Mobility disabled by the accepted terrain crossing.'
    : 'Mobility disabled by the landing damage.', 'Stationary science is available when the sol plan permits it.');
  if (campaign.safe) return status('safe-mode', campaign.skipNext
    ? 'Safe mode: optional driving and science are suspended; one recovery sol follows.'
    : 'Safe-mode recovery sol: optional driving and science are suspended.', 'Wait/charge with baseline loads, then end the sol.');
  if (campaign.events.some(event => event.id === 'E1' && !event.resolved)) return status('route-hazard', 'E1 route hazard awaits a decision. Driving is suspended.', 'Choose the safe reroute or explicitly accept crossing damage.');
  if (campaign.mode === 'planning') return status('planning', `Sol ${campaign.sol} is awaiting a committed energy plan.`, 'Set a positive drive allocation and press Commit sol plan.');
  // These match traverse's numerical exhaustion boundary, not a render-frame
  // threshold. Completed science never changes the drive allocation by itself.
  if (remainingSolHours! <= 1e-12) return status('sol-exhausted', 'No modeled time remains in this sol.', 'End the sol and commit the next sol plan.');
  if (campaign.plan.driveHours <= 0) return status('no-allocation', 'The committed plan allocates 0 hours to driving.', 'Review the remaining plan, allocate drive hours and commit it.');
  if (remainingDriveHours! <= 1e-12) return status('drive-exhausted', `The ${campaign.plan.driveHours.toFixed(2)} h drive allocation is exhausted.`, 'Review the remaining plan or end the sol. Science may continue if allocated.');
  // A restored campaign can be below reserve without already being in safe mode.
  // Its signed slope and documented load are still evaluated by traverse: a
  // generation-supported segment may recover energy; a consuming one stops.
  if (campaign.energyWh < reserveWh!) return status('ready', 'Battery below reserve; each segment is checked against generation and load.', 'Wait/charge with baseline loads to recover energy; the fixed safety reserve still applies.');
  return status('ready', 'Rover ready to drive.', driveKeys);
}
