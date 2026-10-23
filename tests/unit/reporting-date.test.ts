import {describe,it,expect} from 'vitest';
import {reportingDay} from '../../src/lib/reporting-date';
describe('local calendar reporting boundaries',()=>{
 it('uses an exclusive next-day UTC boundary',()=>{const r=reportingDay('2026-10-19','UTC');expect(r.start.toISOString()).toBe('2026-10-19T00:00:00.000Z');expect(r.end.toISOString()).toBe('2026-10-20T00:00:00.000Z');});
 it('respects a 23-hour daylight saving day',()=>{const r=reportingDay('2026-03-08','America/New_York');expect(r.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');expect(+r.end-+r.start).toBe(23*3600000);});
 it('respects a 25-hour daylight saving day',()=>{const r=reportingDay('2026-11-01','America/New_York');expect(+r.end-+r.start).toBe(25*3600000);});
 it('accepts leap dates and rejects nonexistent dates and time zones',()=>{expect(reportingDay('2028-02-29','Africa/Cairo').start).toBeInstanceOf(Date);for(const d of ['2026-02-29','2026-13-01','19-10-2026'])expect(()=>reportingDay(d,'UTC')).toThrow();expect(()=>reportingDay('2026-10-19','Invalid/Zone')).toThrow();});
});
