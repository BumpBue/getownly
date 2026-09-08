export interface Bank {
  code: string;
  name: string;
  abbreviation: string;
  initials: string;
  brandColor: string;
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
    code: '071',
    name: 'ธนาคารไทยเครดิต',
    abbreviation: 'TCRB',
    initials: 'ทค',
    brandColor: '#0C4E9E',
    logoFile: '071.jpg',
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

export function bankDisplayName(code: string, fallbackName?: string | null): string {
  return findBank(code)?.name ?? fallbackName ?? code;
}

/** Public path of a bank's logo, or null when there is no file to load. */
export function bankLogoPath(code: string): string | null {
  const file = findBank(code)?.logoFile;
  return file ? `/banks/${file}` : null;
}
