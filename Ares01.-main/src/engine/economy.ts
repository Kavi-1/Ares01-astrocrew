export interface AgencyEconomy { turn:number; funding:number; rp:number; reputation:number; staffResearch:number; staffOps:number; facilityLevel:number; }
export function staffCap(reputation:number) { return Math.min(10, 4 + Math.floor(reputation / 15)); }
export function endQuarter(a:AgencyEconomy) {
  const income = 20 + Math.round(0.3 * a.reputation);
  const salaries = a.staffResearch + a.staffOps;
  const research = 2 + 3 * a.staffResearch + a.facilityLevel * 2;
  return { ...a, turn:a.turn+1, funding:a.funding + income - salaries, rp:a.rp + research, income, salaries, research };
}
