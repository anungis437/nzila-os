import { afterAll, describe, expect, it } from 'vitest';
import { dayOf, daysUntilDay, formatDay, isDayPast, recordedDay } from '../day';

// Every Canadian zone is west of Greenwich, where a day parsed as midnight UTC is the evening before; Tokyo is the other side of the line.
const ZONES = ['America/St_Johns', 'America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'UTC', 'Asia/Tokyo'] as const;

const zone = process.env.TZ;
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const inZone = (name: string, run: () => void): void => {
  process.env.TZ = name;
  run();
};

describe('a recorded day reads as that day in every time zone', () => {
  for (const name of ZONES) {
    it(`${name}: the date column shape and the stored-at-UTC-midnight shape both name 1 April`, () => {
      inZone(name, () => {
        for (const value of ['2026-04-01', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00Z', new Date('2026-04-01T00:00:00.000Z')]) {
          const day = recordedDay(value);
          expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 4, 1]);
          expect(formatDay(value, 'en-CA', 'long')).toBe('April 1, 2026');
          expect(formatDay(value, 'fr-CA', 'long')).toBe('1 avril 2026');
        }
      });
    });
  }

  it('shows the day the old reading got wrong: new Date(day) is the evening before in Toronto', () => {
    inZone('America/Toronto', () => {
      expect(new Date('2026-04-01').getDate()).toBe(31);
      expect(recordedDay('2026-04-01').getDate()).toBe(1);
      expect(formatDay('2026-04-01', 'en-US', 'numeric')).toBe('4/1/2026');
    });
  });

  it('keeps the month of the first day of a month, which a month-only format would otherwise move back', () => {
    inZone('America/Vancouver', () => {
      const month = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' });
      expect(month.format(new Date('2026-04-01'))).toBe('Mar 2026');
      expect(month.format(recordedDay('2026-04-01'))).toBe('Apr 2026');
    });
  });

  it('reads the text PostgreSQL itself writes for a day stored as UTC midnight (a raw query, not a mapped column)', () => {
    inZone('America/Toronto', () => {
      for (const value of ['2026-04-01 00:00:00+00', '2026-04-01 00:00:00.000+00', '2026-04-01 00:00:00+00:00', '2026-04-01 00:00:00', '2026-04-01T00:00:00+00:00']) {
        expect(recordedDay(value).getDate(), value).toBe(1);
      }
    });
  });

  it('reads the end-of-day marker of a period as the day it closes, in every zone', () => {
    for (const name of ZONES) {
      inZone(name, () => {
        for (const value of ['2026-05-31T23:59:59.999Z', '2026-05-31T23:59:59.000Z', '2026-05-31T23:59:59Z', '2026-05-31 23:59:59+00']) {
          expect(recordedDay(value).getDate(), `${name} ${value}`).toBe(31);
          expect(recordedDay(value).getMonth(), `${name} ${value}`).toBe(4);
        }
      });
    }
  });

  it('keeps a time of day that is not midnight UTC as the instant it is', () => {
    inZone('America/Toronto', () => {
      expect(recordedDay('2026-04-01 12:00:00+00').getDate()).toBe(1);
      expect(recordedDay('2026-04-02 01:30:00+00').getDate()).toBe(1);
      expect(recordedDay('2026-04-01T00:00:01.000Z').getDate()).toBe(31);
    });
  });

  it('is not moved by a daylight-saving change on the day itself', () => {
    inZone('America/Toronto', () => {
      expect(recordedDay('2026-03-08').getDate()).toBe(8);
      expect(recordedDay('2026-11-01').getDate()).toBe(1);
    });
  });
});

describe('an instant stays an instant', () => {
  it('is shown on the day the reader\'s clock says, not on its UTC day', () => {
    inZone('America/Vancouver', () => {
      // 03:30 UTC on 2 April is half past eight on the evening of 1 April in Vancouver.
      expect(recordedDay('2026-04-02T03:30:00.000Z').getDate()).toBe(1);
      expect(formatDay('2026-04-02T03:30:00.000Z', 'en-CA', 'long')).toBe('April 1, 2026');
    });
  });

  it('is shown as received when it is no date at all', () => {
    expect(formatDay('soon', 'en-CA')).toBe('soon');
    expect(formatDay(new Date('nope'), 'en-CA')).toBe('');
  });

  it('is shown as received when the day does not exist, instead of rolling over into the next month', () => {
    expect(formatDay('2026-02-30', 'en-CA')).toBe('2026-02-30');
    expect(formatDay('2026-13-01', 'en-CA')).toBe('2026-13-01');
    expect(Number.isNaN(recordedDay('2026-04-31').getTime())).toBe(true);
    expect(recordedDay('2028-02-29').getDate()).toBe(29);
  });
});

describe('a value that is no day at all', () => {
  // A nullable column a screen typed as present arrives as null: `new Date(null)` is 1 January 1970, which is a date that was never recorded.
  it('is no date, instead of 1 January 1970 or a thrown error', () => {
    for (const value of [null, undefined, 0, {}] as unknown as Array<string>) {
      expect(Number.isNaN(recordedDay(value).getTime()), String(value)).toBe(true);
      expect(formatDay(value, 'en-CA')).toBe('');
      expect(isDayPast(value)).toBe(false);
      expect(Number.isNaN(daysUntilDay(value))).toBe(true);
    }
  });

  it('keeps a text that is not a date as it was received, and does not call it past', () => {
    expect(formatDay('', 'en-CA')).toBe('');
    expect(formatDay('n/a', 'en-CA')).toBe('n/a');
    expect(isDayPast('n/a')).toBe(false);
    expect(isDayPast(new Date('nope'))).toBe(false);
  });
});

describe('formatting styles', () => {
  it('matches toLocaleDateString for the numeric style, so a screen keeps the format it had', () => {
    inZone('America/Toronto', () => {
      const day = recordedDay('2026-07-09');
      expect(formatDay('2026-07-09', 'en-US', 'numeric')).toBe(day.toLocaleDateString('en-US'));
      expect(formatDay('2026-07-09', 'en-CA', 'numeric')).toBe(day.toLocaleDateString('en-CA'));
      expect(formatDay('2026-07-09', 'fr-CA', 'numeric')).toBe(day.toLocaleDateString('fr-CA'));
    });
  });

  it('keeps the two styles it always had', () => {
    inZone('America/Toronto', () => {
      expect(formatDay('2026-07-09', 'en-CA')).toBe('Jul 9, 2026');
      expect(formatDay('2026-07-09', 'en-CA', 'long')).toBe('July 9, 2026');
    });
  });
});

describe('when a day is over', () => {
  for (const name of ['America/Toronto', 'America/Vancouver', 'Asia/Tokyo']) {
    it(`${name}: a deadline on 4 March is not past on 4 March, at any hour, and is past on 5 March`, () => {
      inZone(name, () => {
        expect(isDayPast('2026-03-04', new Date(2026, 2, 4, 0, 0, 1))).toBe(false);
        expect(isDayPast('2026-03-04', new Date(2026, 2, 4, 23, 59, 59))).toBe(false);
        expect(isDayPast('2026-03-04', new Date(2026, 2, 5, 0, 0, 1))).toBe(true);
        expect(isDayPast('2026-03-04T00:00:00.000Z', new Date(2026, 2, 4, 20, 0, 0))).toBe(false);
      });
    });
  }

  it('counts calendar days to a day, not 24-hour spans', () => {
    inZone('America/Toronto', () => {
      expect(daysUntilDay('2026-03-04', new Date(2026, 2, 4, 23, 30))).toBe(0);
      expect(daysUntilDay('2026-03-04', new Date(2026, 2, 3, 0, 5))).toBe(1);
      expect(daysUntilDay('2026-03-04', new Date(2026, 2, 7, 12))).toBe(-3);
      // Across the spring clock change: still one calendar day apart.
      expect(daysUntilDay('2026-03-09', new Date(2026, 2, 8, 9))).toBe(1);
    });
  });

  it('reads an instant as reached or not', () => {
    inZone('America/Toronto', () => {
      const now = new Date('2026-03-04T15:00:00.000Z');
      expect(isDayPast('2026-03-04T14:59:59.000Z', now)).toBe(true);
      expect(isDayPast('2026-03-04T15:00:01.000Z', now)).toBe(false);
    });
  });
});

describe('the reader\'s today', () => {
  it('is the day on the reader\'s clock, not the UTC day, in the evening', () => {
    inZone('America/Toronto', () => {
      // 9:30 in the evening of 4 March in Toronto is already 5 March in UTC.
      const evening = new Date(2026, 2, 4, 21, 30);
      expect(evening.toISOString().slice(0, 10)).toBe('2026-03-05');
      expect(dayOf(evening)).toBe('2026-03-04');
    });
  });

  it('is the same day as UTC for a reader in UTC, and pads the month and the day', () => {
    inZone('UTC', () => {
      expect(dayOf(new Date('2026-01-05T23:30:00.000Z'))).toBe('2026-01-05');
    });
    inZone('America/Vancouver', () => {
      expect(dayOf(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    });
  });

  it('reads the clock when none is given', () => {
    inZone('America/Toronto', () => {
      expect(dayOf()).toBe(dayOf(new Date()));
      expect(dayOf()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
