import { FIXED } from '../nasa/data';
import { nominalBatteryWh } from '../nasa/engineering';

/** NASA_ENGINEERING §5.5 EQ-8/8b. Voltage and efficiencies retain the documented assumptions. */
export type EnergyInterval = { hours: number; generationW: number; loadW: number; extraLoadWh?: number };
export type EnergyResult = {
  storedWh: number; generatedWh: number; requestedWh: number; servedWh: number;
  conversionLossWh: number; curtailedWh: number; unservedWh: number;
};
const nonnegative = (n: number, name: string) => { if (!Number.isFinite(n) || n < 0) throw new RangeError(`${name} must be finite and nonnegative.`); return n; };
export function integrateEnergy(storedWh: number, interval: EnergyInterval): EnergyResult {
  const capacity = nominalBatteryWh(), eta = Math.sqrt(FIXED.roundTripEfficiency);
  nonnegative(storedWh, 'Stored energy');
  if (storedWh > capacity) throw new RangeError('Stored energy exceeds nominal capacity.');
  const hours = nonnegative(interval.hours, 'Duration');
  const generatedWh = nonnegative(interval.generationW, 'Generation') * hours;
  const requestedWh = nonnegative(interval.loadW, 'Load') * hours + nonnegative(interval.extraLoadWh ?? 0, 'Additional load');
  const netWh = generatedWh - requestedWh;
  if (netWh >= 0) {
    const accepted = Math.min(capacity - storedWh, netWh * eta);
    const usedSurplus = accepted / eta;
    return { storedWh: storedWh + accepted, generatedWh, requestedWh, servedWh: requestedWh,
      conversionLossWh: usedSurplus - accepted, curtailedWh: netWh - usedSurplus, unservedWh: 0 };
  }
  const withdrawn = Math.min(storedWh, -netWh / eta);
  const delivered = withdrawn * eta;
  return { storedWh: Math.max(0, storedWh - withdrawn), generatedWh, requestedWh,
    servedWh: generatedWh + delivered, conversionLossWh: withdrawn - delivered,
    curtailedWh: 0, unservedWh: Math.max(0, -netWh - delivered) };
}
export const batteryPercent = (storedWh: number) => storedWh / nominalBatteryWh() * 100;
export function belowReserve(storedWh: number, reserve: number) {
  if (![.2, .3, .4].includes(reserve)) throw new RangeError('Reserve must be 20%, 30%, or 40%.');
  return storedWh < nominalBatteryWh() * reserve - 1e-9;
}
/** GAMEPLAY §2/§5: only committed end-sol zeros count; a positive sol resets the streak. */
export function zeroEnergyStreak(previous: number, endWh: number) {
  nonnegative(endWh, 'End-sol energy');
  if (!Number.isSafeInteger(previous) || previous < 0) throw new RangeError('Invalid zero-energy streak.');
  return endWh === 0 ? previous + 1 : 0;
}
