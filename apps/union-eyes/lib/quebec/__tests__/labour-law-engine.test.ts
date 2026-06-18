import { describe, expect, it } from 'vitest';

import {
  calculateOvertime,
  calculateTerminationNotice,
  checkAntiScabCompliance,
  checkBreakCompliance,
  checkWeeklyRestCompliance,
} from '../labour-law-engine';

describe('lib/quebec/labour-law-engine', () => {
  describe('checkBreakCompliance', () => {
    it('flags insufficient meal break on long shift', () => {
      const r = checkBreakCompliance(6, 15, false);
      expect(r.compliant).toBe(false);
      expect(r.violation).toBeTruthy();
    });
    it('flags unpaid break when employee stays at workstation', () => {
      const r = checkBreakCompliance(4, 30, false, true);
      expect(r.compliant).toBe(false);
    });
    it('passes a compliant break', () => {
      const r = checkBreakCompliance(6, 30, true);
      expect(r.compliant).toBe(true);
    });
  });

  describe('checkWeeklyRestCompliance', () => {
    it('flags excessive consecutive hours', () => {
      expect(checkWeeklyRestCompliance(140).compliant).toBe(false);
    });
    it('passes within allowed hours', () => {
      expect(checkWeeklyRestCompliance(100).compliant).toBe(true);
    });
  });

  describe('checkAntiScabCompliance', () => {
    it('is compliant when no strike or lockout', () => {
      const r = checkAntiScabCompliance(false, true, true, true);
      expect(r.compliant).toBe(true);
      expect(r.violations).toHaveLength(0);
    });
    it('reports all violations during strike', () => {
      const r = checkAntiScabCompliance(true, true, true, true);
      expect(r.compliant).toBe(false);
      expect(r.violations).toHaveLength(3);
      expect(r.violationsFr).toHaveLength(3);
    });
  });

  describe('calculateTerminationNotice', () => {
    it('maps service years to notice weeks', () => {
      expect(calculateTerminationNotice(0.1).weeks).toBe(0);
      expect(calculateTerminationNotice(0.5).weeks).toBe(1);
      expect(calculateTerminationNotice(3).weeks).toBe(2);
      expect(calculateTerminationNotice(7).weeks).toBe(4);
      expect(calculateTerminationNotice(15).weeks).toBe(8);
    });
  });

  describe('calculateOvertime', () => {
    it('splits regular and overtime pay at 40h', () => {
      const r = calculateOvertime(45, 20);
      expect(r.regularHours).toBe(40);
      expect(r.overtimeHours).toBe(5);
      expect(r.regularPay).toBe(800);
      expect(r.overtimePay).toBe(150);
      expect(r.totalPay).toBe(950);
    });
    it('has no overtime under 40h', () => {
      const r = calculateOvertime(30, 20);
      expect(r.overtimeHours).toBe(0);
      expect(r.totalPay).toBe(600);
    });
  });
});
