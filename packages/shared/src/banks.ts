/**
 * The banks an instructor may be paid into.
 *
 * Stored and compared by the Bank of Thailand's three-digit code, never by
 * name. A bank's registered name changes — ทหารไทย and ธนชาต became ttb, and
 * เกียรตินาคิน became เกียรตินาคินภัทร — while the code it settles under does
 * not. Free text had the same problem one keystroke at a time: "กสิกร",
 * "KBANK" and "ธ.กสิกรไทย" are one bank as far as the admin making the
 * transfer is concerned, and three as far as the database was.
 *
 * Shared rather than duplicated: the API validates against this list and the
 * web app renders from it, and a dropdown that offers a code the server would
 * refuse is worse than no dropdown at all.
 *
 * Codes verified against the Bank of Thailand three-digit scheme as published
 * in the K API documentation (June 2026) and cross-checked against two payment
 * gateway references.
 */

export interface Bank {
  /** Bank of Thailand three-digit code. The stored value. */
  code: string;
  /** Full registered name in Thai, as it should read on a transfer screen. */
  name: string;
  /** How the bank is normally referred to, used in the dropdown's search. */
  abbreviation: string;
  /**
   * Two characters for the fallback badge, drawn when no logo file exists.
   * Written out rather than sliced from `name`, because "ธนาคาร" prefixes
   * every entry and slicing would give sixteen identical badges.
   */
  initials: string;
  /**
   * The bank's own brand colour.
   *
   * The third and last place in this project allowed to hard-code a colour —
   * after the HTML emails and `chart-theme.ts` — and for the same kind of
   * reason: this is somebody else's brand, not a token in our palette
   * (CLAUDE.md, หัวข้อ 4). It is used only as the ground of a fallback badge,
   * never as page furniture.
   */
  brandColor: string;
  /**
   * File name inside `frontend/public/banks/`, extension included, or null
   * when no logo has been supplied yet.
   *
   * The whole name is written out rather than composed from `code + ".svg"`,
   * because the files are not all one format: most are GIF, two are JPEG, and
   * a composed path would silently 404 for those. A missing logo is a null
   * here and a lettered badge on screen — never a broken image.
   */
  logoFile: string | null;
}

export const BANKS: readonly Bank[] = [
  {
    code: '002',
    name: 'ธนาคารกรุงเทพ',
    abbreviation: 'BBL',
    initials: 'กท',
    brandColor: '#1E4598',
    logoFile: '002.gif',
  },
  {
    code: '004',
    name: 'ธนาคารกสิกรไทย',
    abbreviation: 'KBANK',
    initials: 'กส',
    brandColor: '#138F2D',
    logoFile: '004.gif',
  },
  {
    code: '006',
    name: 'ธนาคารกรุงไทย',
    abbreviation: 'KTB',
    initials: 'กท',
    brandColor: '#1BA5E1',
    logoFile: '006.gif',
  },
  {
    code: '011',
    name: 'ธนาคารทหารไทยธนชาต',
    abbreviation: 'ttb',
    initials: 'ทท',
    brandColor: '#1279BE',
    logoFile: '011.gif',
  },
  {
    code: '014',
    name: 'ธนาคารไทยพาณิชย์',
    abbreviation: 'SCB',
    initials: 'ทพ',
    brandColor: '#4E2E7F',
    logoFile: '014.gif',
  },
  {
    code: '022',
    name: 'ธนาคารซีไอเอ็มบี ไทย',
    abbreviation: 'CIMBT',
    initials: 'ซี',
    brandColor: '#7E2F36',
    logoFile: '022.gif',
  },
  {
    code: '024',
    name: 'ธนาคารยูโอบี',
    abbreviation: 'UOB',
    initials: 'ยู',
    brandColor: '#0B3979',
    logoFile: '024.jpg',
  },
  {
    code: '025',
    name: 'ธนาคารกรุงศรีอยุธยา',
    abbreviation: 'BAY',
    initials: 'กศ',
    brandColor: '#FEC43B',
    logoFile: '025.gif',
  },
  {
    code: '030',
    name: 'ธนาคารออมสิน',
    abbreviation: 'GSB',
    initials: 'ออ',
    brandColor: '#EB198D',
    logoFile: '030.gif',
  },
  {
    code: '033',
    name: 'ธนาคารอาคารสงเคราะห์',
    abbreviation: 'ธอส.',
    initials: 'อส',
    brandColor: '#F57F21',
    logoFile: '033.gif',
  },
  {
    code: '034',
    name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
    abbreviation: 'ธ.ก.ส.',
    initials: 'กษ',
    brandColor: '#4B9B1D',
    logoFile: '034.gif',
  },
  {
    code: '066',
    name: 'ธนาคารอิสลามแห่งประเทศไทย',
    abbreviation: 'ISBT',
    initials: 'อล',
    brandColor: '#184615',
    logoFile: '066.gif',
  },
  {
    code: '067',
    name: 'ธนาคารทิสโก้',
    abbreviation: 'TISCO',
    initials: 'ทส',
    brandColor: '#12579B',
    logoFile: '067.jpg',
  },
  {
    code: '069',
    name: 'ธนาคารเกียรตินาคินภัทร',
    abbreviation: 'KKP',
    initials: 'กน',
    brandColor: '#199CC5',
    logoFile: '069.gif',
  },
  {
    // No logo file supplied yet. Everything still works: the dropdown lists
    // it, the API accepts it, and the badge shows its initials.
    code: '071',
    name: 'ธนาคารไทยเครดิต',
    abbreviation: 'TCRB',
    initials: 'ทค',
    brandColor: '#0C4E9E',
    logoFile: null,
  },
  {
    code: '073',
    name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
    abbreviation: 'LHBANK',
    initials: 'LH',
    brandColor: '#6D6E71',
    logoFile: '073.gif',
  },
] as const;

/** Every valid code, for the API's `@IsIn` check. */
export const BANK_CODES: readonly string[] = BANKS.map((bank) => bank.code);

const BY_CODE = new Map(BANKS.map((bank) => [bank.code, bank]));

/** The bank behind a stored code, or undefined if it is not one we know. */
export function findBank(code: string): Bank | undefined {
  return BY_CODE.get(code);
}

/**
 * The name to print for a stored code.
 *
 * `fallbackName` is the name snapshotted onto a payout request when it was
 * made. A request from before a bank left this list — or from before the list
 * existed — still has to read correctly years later, which is the entire
 * reason the snapshot is kept alongside the code.
 */
export function bankDisplayName(code: string, fallbackName?: string | null): string {
  return findBank(code)?.name ?? fallbackName ?? code;
}

/** Public path of a bank's logo, or null when there is no file to load. */
export function bankLogoPath(code: string): string | null {
  const file = findBank(code)?.logoFile;
  return file ? `/banks/${file}` : null;
}
