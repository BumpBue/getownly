import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANKS, BANK_CODES, bankDisplayName, bankLogoPath, findBank } from '@getownly/shared';

/** Where the web app serves bank logos from, relative to the repository root. */
const LOGO_DIR = join(__dirname, '../../../frontend/public/banks');

/**
 * The bank list, and its agreement with the files on disk.
 *
 * Two things can drift apart here and neither would fail anywhere else: a code
 * could be wrong, and a logo file could be deleted while the table still points
 * at it. The first is caught by writing the codes out by hand — the same reason
 * `scope-limits.spec.ts` exists — and the second by reading the folder.
 */
describe('bank list', () => {
  it('holds the sixteen banks payouts may be sent to', () => {
    expect(BANKS).toHaveLength(16);
    expect(BANK_CODES).toHaveLength(16);
  });

  /**
   * The Bank of Thailand codes, written out rather than derived.
   *
   * Every other test reads BANK_CODES, which means a typo in the table would
   * move all of them together and still pass. This is the one place the codes
   * are stated independently, so changing one has to be deliberate.
   */
  it('uses the Bank of Thailand code for each bank', () => {
    const expected: Record<string, string> = {
      '002': 'ธนาคารกรุงเทพ',
      '004': 'ธนาคารกสิกรไทย',
      '006': 'ธนาคารกรุงไทย',
      '011': 'ธนาคารทหารไทยธนชาต',
      '014': 'ธนาคารไทยพาณิชย์',
      '022': 'ธนาคารซีไอเอ็มบี ไทย',
      '024': 'ธนาคารยูโอบี',
      '025': 'ธนาคารกรุงศรีอยุธยา',
      '030': 'ธนาคารออมสิน',
      '033': 'ธนาคารอาคารสงเคราะห์',
      '034': 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
      '066': 'ธนาคารอิสลามแห่งประเทศไทย',
      '067': 'ธนาคารทิสโก้',
      '069': 'ธนาคารเกียรตินาคินภัทร',
      '071': 'ธนาคารไทยเครดิต',
      '073': 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
    };

    expect(Object.fromEntries(BANKS.map((bank) => [bank.code, bank.name]))).toEqual(expected);
  });

  it('gives every bank a distinct code', () => {
    expect(new Set(BANK_CODES).size).toBe(BANK_CODES.length);
  });

  it('describes each bank completely enough to render it without a logo', () => {
    for (const bank of BANKS) {
      expect(bank.code, `${bank.name} has a malformed code`).toMatch(/^\d{3}$/);
      expect(bank.name.length, `${bank.code} has no name`).toBeGreaterThan(0);
      expect(bank.abbreviation.length, `${bank.code} has no abbreviation`).toBeGreaterThan(0);
      // The fallback badge needs both of these and nothing else.
      expect(bank.initials.length, `${bank.code} has no initials`).toBeGreaterThan(0);
      expect(bank.brandColor, `${bank.code} has no brand colour`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  /**
   * The check that catches a deleted file.
   *
   * Reads the folder rather than trusting the table, so removing a logo without
   * setting its entry back to null fails here instead of showing a broken image
   * to whoever is about to make a bank transfer.
   */
  it('points only at logo files that actually exist', () => {
    const missing = BANKS.filter(
      (bank) => bank.logoFile !== null && !existsSync(join(LOGO_DIR, bank.logoFile)),
    );

    expect(
      missing.map((bank) => `${bank.code} -> ${bank.logoFile}`),
      'the bank list names logo files that are not in frontend/public/banks',
    ).toEqual([]);
  });

  /**
   * And the check that catches a file nobody wired up.
   *
   * Less severe than the other direction — an unused file only wastes space —
   * but it is how a logo that was supplied for a bank still marked `null`
   * gets noticed instead of sitting there unseen.
   */
  it('leaves no logo file unclaimed by the list', () => {
    const claimed = new Set(BANKS.map((bank) => bank.logoFile).filter(Boolean));
    const onDisk = readdirSync(LOGO_DIR).filter((name) => !name.endsWith('.md'));

    expect(
      onDisk.filter((name) => !claimed.has(name)),
      'frontend/public/banks holds logos no bank in the list points at',
    ).toEqual([]);
  });

  it('builds a public path only for a bank that has a file', () => {
    expect(bankLogoPath('004')).toBe('/banks/004.gif');
    // Extensions differ between banks, so the path is never composed from the
    // code plus an assumed ".svg".
    expect(bankLogoPath('024')).toBe('/banks/024.jpg');
    expect(bankLogoPath('071')).toBeNull();
    expect(bankLogoPath('999')).toBeNull();
  });

  describe('naming a stored code', () => {
    it('reads the name out of the list', () => {
      expect(bankDisplayName('004')).toBe('ธนาคารกสิกรไทย');
    });

    it('falls back to the snapshot when the code is no longer known', () => {
      // 065 was Thanachart's code before the ttb merger. A payout request made
      // back then must still say which bank it went to.
      expect(bankDisplayName('065', 'ธนาคารธนชาต')).toBe('ธนาคารธนชาต');
      expect(findBank('065')).toBeUndefined();
    });

    it('shows the raw code rather than nothing when there is no snapshot', () => {
      expect(bankDisplayName('065')).toBe('065');
    });
  });
});
