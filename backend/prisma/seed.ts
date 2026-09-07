/**
 * Development seed for getownly.
 *
 * Wipes every table and rebuilds a realistic Thai dataset: one admin, three
 * instructors on different commission rates, five students, four categories and
 * eight courses centred on Autodesk Maya.
 *
 * Run with:  pnpm db:seed        (or pnpm seed from the workspace root)
 *
 * NOTE: videoKey / fileKey values point at object keys that do not exist in
 * MinIO yet. They exist so list screens look real; actual uploads arrive in
 * phase 3.
 */
import {
  COURSE_MAX_STORAGE_BYTES,
  UPLOAD_MAX_MB,
  formatBytesThai,
  mbToBytes,
} from '@getownly/shared';
import { CourseStatus, PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcrypt';

/** Must match BCRYPT_COST in .env, or seeded accounts cannot sign in. */
const BCRYPT_COST = Number(process.env.BCRYPT_COST ?? 12);

const prisma = new PrismaClient();

/**
 * Seeded lessons have no real file behind them, so a size has to be invented.
 * 40 KB/s (~320 kbps) is what a talking-head lecture at 720p actually costs,
 * and it keeps every seeded clip well under the per-file ceiling.
 */
const SEED_VIDEO_BYTES_PER_SECOND = 40_000;

function seedVideoSize(durationSec: number): number {
  const size = durationSec * SEED_VIDEO_BYTES_PER_SECOND;
  if (size > mbToBytes(UPLOAD_MAX_MB.video)) {
    throw new Error(
      `ข้อมูลตัวอย่างมีวิดีโอขนาด ${formatBytesThai(size)} ซึ่งเกินเพดานต่อคลิป ` +
        `${UPLOAD_MAX_MB.video} MB — ลด durationSec หรือ SEED_VIDEO_BYTES_PER_SECOND`,
    );
  }
  return size;
}

/** Demo data must obey the rule the demo is about to explain. */
function assertSeedStorageWithinQuota(courseTitle: string, usedBytes: number): void {
  if (usedBytes > COURSE_MAX_STORAGE_BYTES) {
    throw new Error(
      `คอร์สตัวอย่าง "${courseTitle}" ใช้พื้นที่ ${formatBytesThai(usedBytes)} ` +
        `เกินโควตา ${formatBytesThai(COURSE_MAX_STORAGE_BYTES)}`,
    );
  }
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@getownly.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@1234';
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Password@1234';

// ---------------------------------------------------------------------------
// Content definitions
// ---------------------------------------------------------------------------

interface MaterialSeed {
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
}

interface QuizSeed {
  title: string;
  passScore: number;
  questions: {
    questionText: string;
    /** The first choice listed is the correct one; order is shuffled below. */
    correct: string;
    wrong: string[];
  }[];
}

interface LessonSeed {
  title: string;
  durationSec: number;
  isPreview?: boolean;
  materials?: MaterialSeed[];
  quiz?: QuizSeed;
}

interface CourseSeed {
  key: string;
  title: string;
  description: string;
  categorySlug: string;
  instructorUsername: string;
  price: string;
  status: CourseStatus;
  rejectReason?: string;
  lessons: LessonSeed[];
}

const CATEGORIES = [
  { name: 'แอนิเมชัน 3 มิติ', slug: 'animation-3d' },
  { name: 'กราฟิกดีไซน์', slug: 'graphic-design' },
  { name: 'โปรแกรมมิ่ง', slug: 'programming' },
  { name: 'ภาษา', slug: 'language' },
];

const INSTRUCTORS = [
  {
    username: 'thanakrit.w',
    email: 'thanakrit@getownly.local',
    displayName: 'ธนกฤต วงศ์อนันต์',
    commissionRate: '0.3000',
    expertise: 'การปั้นโมเดลและแอนิเมชันตัวละครด้วย Autodesk Maya',
    bio: 'นักแอนิเมชันอิสระ ประสบการณ์ 9 ปีในสตูดิโอโฆษณาและเกม เคยดูแลงานตัวละครให้โปรเจกต์แอนิเมชันซีรีส์สองเรื่อง ปัจจุบันสอนการใช้งาน Maya ให้นักศึกษาและผู้เริ่มต้นทำงานจริง',
  },
  {
    username: 'piyada.s',
    email: 'piyada@getownly.local',
    displayName: 'ปิยะดา ศรีสุวรรณ',
    commissionRate: '0.2500',
    expertise: 'การจัดแสง การเรนเดอร์ และการทำพื้นผิววัสดุ',
    bio: 'Lighting Artist ที่ทำงานกับ Arnold และ Substance Painter มากว่า 7 ปี เชื่อว่าการจัดแสงที่ดีเปลี่ยนงานธรรมดาให้ดูมีราคาได้ทันที',
  },
  {
    username: 'natthaphong.c',
    email: 'natthaphong@getownly.local',
    displayName: 'ณัฐพงษ์ เจริญทรัพย์',
    commissionRate: '0.2000',
    expertise: 'การทำ Rigging และการเขียนสคริปต์ Python สำหรับงาน 3 มิติ',
    bio: 'Technical Artist ดูแลระบบ Rig และเครื่องมือภายในให้ทีมโปรดักชัน ชอบทำงานที่ลดงานซ้ำซากของเพื่อนร่วมทีมให้เหลือคลิกเดียว',
  },
];

const STUDENTS = [
  {
    username: 'teerapat.s',
    email: 'teerapat@getownly.local',
    displayName: 'ธีรภัทร สุขเจริญ',
    bio: 'นักศึกษาชั้นปีที่ 3 สาขาดิจิทัลอาร์ต กำลังเก็บผลงานเพื่อยื่นฝึกงาน',
  },
  {
    username: 'kamonchanok.p',
    email: 'kamonchanok@getownly.local',
    displayName: 'กมลชนก พรมมา',
    bio: 'กราฟิกดีไซเนอร์ที่อยากขยับมาทำงาน 3 มิติ',
  },
  {
    username: 'siriporn.k',
    email: 'siriporn@getownly.local',
    displayName: 'ศิริพร คำแก้ว',
    bio: 'ครูสอนศิลปะระดับมัธยม สนใจนำงาน 3 มิติไปใช้ในห้องเรียน',
  },
  {
    username: 'anon.t',
    email: 'anon@getownly.local',
    displayName: 'อานนท์ ตันติวงศ์',
    bio: 'ฟรีแลนซ์รับทำภาพประกอบ กำลังหัดทำโมเดลไว้ใช้ในงานตัวเอง',
  },
  {
    username: 'paweena.r',
    email: 'paweena@getownly.local',
    displayName: 'ปวีณา รัตนโชติ',
    bio: 'พนักงานประจำที่เรียนออนไลน์ช่วงเย็นเพื่อเปลี่ยนสายงาน',
  },
];

const COURSES: CourseSeed[] = [
  {
    key: 'maya-basics',
    title: 'พื้นฐานการใช้งาน Autodesk Maya สำหรับผู้เริ่มต้น',
    description:
      'เริ่มต้นใช้งาน Autodesk Maya ตั้งแต่เปิดโปรแกรมครั้งแรก เรียนรู้การตั้งค่าโปรเจกต์ การควบคุมมุมมอง การสร้างวัตถุพื้นฐาน และการจัดการไฟล์อย่างเป็นระบบ คอร์สนี้เปิดให้เรียนฟรีเพื่อให้ผู้เริ่มต้นมีพื้นฐานที่มั่นคงก่อนเรียนคอร์สอื่นต่อ',
    categorySlug: 'animation-3d',
    instructorUsername: 'thanakrit.w',
    price: '0.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'รู้จักหน้าต่างทำงานและการตั้งค่าโปรเจกต์',
        durationSec: 760,
        isPreview: true,
        materials: [
          {
            fileName: 'คู่มือติดตั้งและตั้งค่า Maya.pdf',
            fileKey: 'material/maya-basics/01-setup-guide.pdf',
            fileSize: 2_451_200,
            mimeType: 'application/pdf',
          },
        ],
      },
      { title: 'การควบคุมมุมมองและการนำทางใน Viewport', durationSec: 890, isPreview: true },
      { title: 'การสร้างวัตถุพื้นฐานและการใช้ Channel Box', durationSec: 1120 },
      { title: 'ระบบพิกัดและการจัดวางวัตถุด้วย Snap', durationSec: 980 },
      { title: 'การจัดการ Outliner และการตั้งชื่อวัตถุอย่างเป็นระบบ', durationSec: 840 },
      {
        title: 'บันทึกไฟล์ ส่งออกงาน และการจัดการ Scene',
        durationSec: 1050,
        quiz: {
          title: 'แบบทดสอบท้ายคอร์ส: พื้นฐานการใช้งาน Maya',
          passScore: 70,
          questions: [
            {
              questionText: 'หน้าต่างใดใช้ดูรายชื่อวัตถุทั้งหมดที่อยู่ในฉาก',
              correct: 'Outliner',
              wrong: ['Channel Box', 'Hypershade', 'Render View'],
            },
            {
              questionText: 'การตั้งค่าโปรเจกต์ (Set Project) มีประโยชน์อย่างไร',
              correct: 'ช่วยให้ Maya ค้นหาไฟล์อ้างอิงและพื้นผิวได้อัตโนมัติ',
              wrong: [
                'ทำให้โปรแกรมทำงานเร็วขึ้นสองเท่า',
                'บีบอัดไฟล์ให้มีขนาดเล็กลง',
                'เปลี่ยนหน่วยวัดของฉากเป็นเมตร',
              ],
            },
            {
              questionText: 'ปุ่มลัดใดใช้หมุนมุมกล้องใน Viewport',
              correct: 'Alt พร้อมกับคลิกเมาส์ปุ่มซ้าย',
              wrong: [
                'Ctrl พร้อมกับคลิกเมาส์ปุ่มขวา',
                'Shift พร้อมกับกดลูกกลิ้ง',
                'Tab พร้อมกับคลิกเมาส์ปุ่มกลาง',
              ],
            },
            {
              questionText: 'ไฟล์นามสกุลใดคือไฟล์ฉากมาตรฐานของ Maya ที่อ่านด้วยข้อความได้',
              correct: '.ma',
              wrong: ['.fbx', '.obj', '.abc'],
            },
          ],
        },
      },
    ],
  },
  {
    key: 'polygon-modeling',
    title: 'การปั้นโมเดล Polygon เบื้องต้น',
    description:
      'เรียนรู้การปั้นโมเดลด้วยระบบ Polygon ตั้งแต่การเข้าใจโครงสร้าง Vertex Edge และ Face ไปจนถึงเครื่องมือที่ใช้จริงในงานประจำวัน จบคอร์สแล้วผู้เรียนจะปั้นโมเดลของใช้ในบ้านได้ด้วยตัวเองพร้อม Topology ที่สะอาดพอจะนำไปทำแอนิเมชันต่อได้',
    categorySlug: 'animation-3d',
    instructorUsername: 'thanakrit.w',
    price: '1290.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'ทำความเข้าใจโครงสร้าง Vertex Edge และ Face',
        durationSec: 920,
        isPreview: true,
      },
      { title: 'เครื่องมือ Extrude และ Bevel ที่ใช้บ่อยที่สุด', durationSec: 1340 },
      { title: 'การใช้ Insert Edge Loop เพื่อควบคุมรูปทรง', durationSec: 1080 },
      { title: 'เทคนิค Bridge และ Merge สำหรับปิดผิวโมเดล', durationSec: 990 },
      {
        title: 'การรักษา Topology ให้เป็นสี่เหลี่ยมทั้งหมด',
        durationSec: 1210,
        quiz: {
          title: 'แบบทดสอบ: Topology ที่ดีสำหรับงานแอนิเมชัน',
          passScore: 70,
          questions: [
            {
              questionText: 'Topology ที่เหมาะกับงานแอนิเมชันควรประกอบด้วยหน้าแบบใดเป็นหลัก',
              correct: 'หน้าสี่เหลี่ยม (Quad)',
              wrong: [
                'หน้าสามเหลี่ยม (Triangle)',
                'หน้าที่มีมากกว่าสี่ด้าน (N-gon)',
                'ผสมกันโดยไม่ต้องคำนึงถึงรูปแบบ',
              ],
            },
            {
              questionText: 'N-gon คืออะไร',
              correct: 'หน้าที่ประกอบด้วยขอบมากกว่าสี่ด้าน',
              wrong: [
                'จุดที่มีเส้นขอบมาบรรจบกันห้าเส้น',
                'เส้นขอบที่ไม่ได้เชื่อมกับหน้าใดเลย',
                'กลุ่มวัตถุที่ถูกรวมเข้าด้วยกัน',
              ],
            },
            {
              questionText: 'เครื่องมือใดใช้เพิ่มเส้นขอบรอบโมเดลเพื่อควบคุมความคมของรูปทรง',
              correct: 'Insert Edge Loop',
              wrong: ['Combine', 'Smooth Preview', 'Freeze Transformations'],
            },
          ],
        },
      },
      {
        title: 'ปั้นโมเดลถ้วยกาแฟตั้งแต่ต้นจนจบ',
        durationSec: 2140,
        materials: [
          {
            fileName: 'ไฟล์ภาพอ้างอิงถ้วยกาแฟ.zip',
            fileKey: 'material/polygon-modeling/06-reference-images.zip',
            fileSize: 8_930_000,
            mimeType: 'application/zip',
          },
          {
            fileName: 'ใบงานฝึกปั้นโมเดล.pdf',
            fileKey: 'material/polygon-modeling/06-worksheet.pdf',
            fileSize: 1_180_000,
            mimeType: 'application/pdf',
          },
        ],
      },
      { title: 'ตรวจสอบและแก้ไขข้อผิดพลาดของโมเดลก่อนส่งงาน', durationSec: 1020 },
    ],
  },
  {
    key: 'lighting-camera',
    title: 'การจัดแสงและมุมกล้องใน Maya',
    description:
      'แสงคือสิ่งที่ทำให้งาน 3 มิติดูแพงหรือดูราคาถูก คอร์สนี้พาไปตั้งแต่หลักการจัดแสงสามจุด การเลือกชนิดของแสง การตั้งค่ากล้องให้เหมือนกล้องจริง จนถึงการเรนเดอร์ภาพนิ่งด้วย Arnold ให้ได้คุณภาพระดับใช้งานได้จริง',
    categorySlug: 'animation-3d',
    instructorUsername: 'piyada.s',
    price: '1590.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      {
        title: 'หลักการจัดแสงสามจุดสำหรับงาน 3 มิติ',
        durationSec: 1040,
        isPreview: true,
      },
      {
        title: 'ชนิดของแสงใน Maya และการเลือกใช้ให้เหมาะกับฉาก',
        durationSec: 1260,
        quiz: {
          title: 'แบบทดสอบ: พื้นฐานการจัดแสง',
          passScore: 70,
          questions: [
            {
              questionText: 'แสงชนิดใดจำลองแสงอาทิตย์ที่ส่องมาเป็นแนวขนาน',
              correct: 'Directional Light',
              wrong: ['Point Light', 'Spot Light', 'Ambient Light'],
            },
            {
              questionText: 'ในการจัดแสงสามจุด แสงหลักที่กำหนดทิศทางของเงาเรียกว่าอะไร',
              correct: 'Key Light',
              wrong: ['Fill Light', 'Rim Light', 'Bounce Light'],
            },
            {
              questionText: 'สิ่งใดมีผลต่อความนุ่มของขอบเงามากที่สุด',
              correct: 'ขนาดของแหล่งกำเนิดแสง',
              wrong: ['จำนวนวัตถุในฉาก', 'ความละเอียดของภาพที่เรนเดอร์', 'สีของพื้นหลังในฉาก'],
            },
          ],
        },
      },
      { title: 'ตั้งค่ากล้องและระยะชัดลึกให้เหมือนกล้องจริง', durationSec: 1150 },
      { title: 'การใช้ Arnold Render View และการปรับค่า Sampling', durationSec: 1380 },
      {
        title: 'จัดแสงฉากภายในห้องให้ดูสมจริง',
        durationSec: 1890,
        materials: [
          {
            fileName: 'ไฟล์ฉากตัวอย่างสำหรับฝึกจัดแสง.zip',
            fileKey: 'material/lighting-camera/05-practice-scene.zip',
            fileSize: 24_600_000,
            mimeType: 'application/zip',
          },
        ],
      },
      { title: 'เรนเดอร์ภาพนิ่งความละเอียดสูงและการตั้งค่า Output', durationSec: 970 },
    ],
  },
  {
    key: 'character-animation',
    title: 'สร้างแอนิเมชันตัวละครด้วย Maya',
    description:
      'คอร์สแอนิเมชันตัวละครที่เน้นการลงมือทำ เริ่มจากคีย์เฟรมและ Graph Editor แล้วไล่ไปทำท่าเดิน ท่าวิ่ง และการกระโดดให้ครบวงจร พร้อมเทคนิคการแสดงอารมณ์ผ่านสีหน้าและมือ จบคอร์สจะมีผลงานแอนิเมชันสั้นไว้ในพอร์ตอย่างน้อยหนึ่งชิ้น',
    categorySlug: 'animation-3d',
    instructorUsername: 'thanakrit.w',
    price: '2490.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      { title: 'พื้นฐานคีย์เฟรมและเส้นกราฟการเคลื่อนไหว', durationSec: 1080, isPreview: true },
      {
        title: 'หลัก 12 ข้อของแอนิเมชันที่นำมาใช้ได้จริง',
        durationSec: 1620,
        materials: [
          {
            fileName: 'สรุปหลัก 12 ข้อของแอนิเมชัน.pdf',
            fileKey: 'material/character-animation/02-12-principles.pdf',
            fileSize: 3_240_000,
            mimeType: 'application/pdf',
          },
        ],
      },
      {
        title: 'การใช้ Graph Editor ปรับจังหวะการเคลื่อนไหว',
        durationSec: 1440,
        quiz: {
          title: 'แบบทดสอบ: การควบคุมจังหวะด้วย Graph Editor',
          passScore: 75,
          questions: [
            {
              questionText: 'Graph Editor ใช้ทำอะไรเป็นหลัก',
              correct: 'ปรับเส้นกราฟการเคลื่อนไหวระหว่างคีย์เฟรม',
              wrong: [
                'จัดกลุ่มวัตถุในฉากให้เป็นลำดับชั้น',
                'ตั้งค่าคุณภาพของการเรนเดอร์',
                'แก้ไขพื้นผิวและวัสดุของโมเดล',
              ],
            },
            {
              questionText: 'การตั้งค่า Ease In และ Ease Out ให้ผลอย่างไรกับการเคลื่อนไหว',
              correct: 'ทำให้เริ่มต้นและหยุดอย่างนุ่มนวลแทนที่จะกระชาก',
              wrong: [
                'ทำให้การเคลื่อนไหวเร็วขึ้นตลอดทั้งช่วง',
                'ลบคีย์เฟรมที่ซ้ำซ้อนออกโดยอัตโนมัติ',
                'เปลี่ยนจำนวนเฟรมต่อวินาทีของฉาก',
              ],
            },
            {
              questionText: 'คีย์เฟรมแบบ Stepped เหมาะกับขั้นตอนใดของงานมากที่สุด',
              correct: 'ขั้นตอนวางท่าหลัก (Blocking)',
              wrong: [
                'ขั้นตอนเก็บรายละเอียดขั้นสุดท้าย',
                'ขั้นตอนเรนเดอร์ภาพ',
                'ขั้นตอนทำพื้นผิววัสดุ',
              ],
            },
          ],
        },
      },
      { title: 'ทำท่าเดินให้ตัวละครแบบวนซ้ำได้', durationSec: 2020 },
      { title: 'ทำท่าวิ่งและการถ่ายน้ำหนักตัว', durationSec: 1880 },
      { title: 'แอนิเมชันการกระโดดและการลงพื้น', durationSec: 1710 },
      { title: 'การแสดงอารมณ์ผ่านสีหน้าและการใช้มือ', durationSec: 1520 },
      { title: 'จัดทำ Playblast และการส่งงานให้ผู้ตรวจ', durationSec: 880 },
    ],
  },
  {
    key: 'character-rigging',
    title: 'การทำ Rigging ตัวละครสำหรับงานแอนิเมชัน',
    description:
      'Rig ที่ดีทำให้ทีมแอนิเมชันทำงานได้เร็วขึ้นหลายเท่า คอร์สนี้อธิบายกระบวนการ Rigging ทั้งระบบ ตั้งแต่การวาง Joint ตามมาตรฐาน ความต่างของ IK กับ FK การทำ Skin Weight ไปจนถึงการสร้าง Controller ที่ผู้ใช้งานเข้าใจได้ทันทีโดยไม่ต้องถาม',
    categorySlug: 'animation-3d',
    instructorUsername: 'natthaphong.c',
    price: '2890.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      { title: 'ภาพรวมของกระบวนการ Rigging ตั้งแต่ต้นจนจบ', durationSec: 1020, isPreview: true },
      {
        title: 'การวาง Joint และการตั้งชื่อตามมาตรฐานทีม',
        durationSec: 1460,
        materials: [
          {
            fileName: 'แผนภาพโครงกระดูกตัวละครมาตรฐาน.pdf',
            fileKey: 'material/character-rigging/02-skeleton-diagram.pdf',
            fileSize: 4_120_000,
            mimeType: 'application/pdf',
          },
        ],
      },
      { title: 'IK และ FK ต่างกันอย่างไรและควรใช้เมื่อไหร่', durationSec: 1240 },
      {
        title: 'การทำ Skin Weight ให้ผิวเคลื่อนตามกระดูกอย่างถูกต้อง',
        durationSec: 1950,
        quiz: {
          title: 'แบบทดสอบ: พื้นฐาน Skinning',
          passScore: 70,
          questions: [
            {
              questionText: 'ค่า Skin Weight ของแต่ละจุดมีค่าอยู่ในช่วงใด',
              correct: '0 ถึง 1',
              wrong: ['0 ถึง 100', '-1 ถึง 1', 'ไม่มีขอบเขตจำกัด'],
            },
            {
              questionText: 'ผิวบิดผิดรูปบริเวณข้อพับมักเกิดจากสาเหตุใด',
              correct: 'การกระจายน้ำหนักระหว่างกระดูกสองท่อนไม่เหมาะสม',
              wrong: [
                'ความละเอียดของพื้นผิววัสดุต่ำเกินไป',
                'ตั้งค่าแสงในฉากผิดพลาด',
                'จำนวนเฟรมต่อวินาทีไม่พอ',
              ],
            },
          ],
        },
      },
      { title: 'สร้าง Controller ให้ผู้ทำแอนิเมชันใช้งานง่าย', durationSec: 1680 },
      { title: 'ระบบ Rig ใบหน้าเบื้องต้นด้วย Blend Shape', durationSec: 1790 },
      { title: 'ตรวจสอบ Rig ก่อนส่งต่อให้ทีมแอนิเมชัน', durationSec: 1130 },
    ],
  },
  {
    key: 'uv-texturing',
    title: 'UV Mapping และการทำ Texture ด้วย Substance Painter',
    description:
      'โมเดลสวยแค่ไหนก็ยังดูไม่จริงถ้าพื้นผิวไม่ดี คอร์สนี้พาไปทำ UV ให้เรียบร้อยตั้งแต่การตัด Seam การจัดเรียง UV Shell แล้วต่อด้วยการทำพื้นผิวใน Substance Painter จนถึงการส่ง Texture Map กลับเข้ามาเรนเดอร์ใน Maya',
    categorySlug: 'graphic-design',
    instructorUsername: 'piyada.s',
    price: '1790.00',
    status: CourseStatus.PUBLISHED,
    lessons: [
      { title: 'ทำไม UV จึงสำคัญกับงาน 3 มิติ', durationSec: 780, isPreview: true },
      {
        title: 'การตัด Seam และคลี่ UV ให้บิดเบี้ยวน้อยที่สุด',
        durationSec: 1520,
        quiz: {
          title: 'แบบทดสอบ: พื้นฐาน UV Mapping',
          passScore: 70,
          questions: [
            {
              questionText: 'Seam ในการทำ UV หมายถึงอะไร',
              correct: 'แนวรอยตัดที่ใช้คลี่ผิวโมเดลออกเป็นแผ่นแบน',
              wrong: [
                'เส้นขอบที่เชื่อมสองวัตถุเข้าด้วยกัน',
                'จุดศูนย์กลางของวัตถุ',
                'ระยะห่างระหว่างกล้องกับโมเดล',
              ],
            },
            {
              questionText: 'ลายตารางหมากรุกที่นำมาทาบบนโมเดลใช้ตรวจสอบสิ่งใด',
              correct: 'ความบิดเบี้ยวและความสม่ำเสมอของขนาด UV',
              wrong: ['ความสว่างของแสงในฉาก', 'จำนวนหน้าของโมเดล', 'ความเร็วในการเรนเดอร์'],
            },
          ],
        },
      },
      { title: 'จัดเรียง UV Shell และการใช้พื้นที่อย่างคุ้มค่า', durationSec: 1310 },
      { title: 'ส่งโมเดลเข้า Substance Painter และการ Bake', durationSec: 1440 },
      {
        title: 'สร้างวัสดุโลหะและไม้ให้ดูสมจริง',
        durationSec: 1860,
        materials: [
          {
            fileName: 'ชุดวัสดุตัวอย่างสำหรับฝึกทำพื้นผิว.zip',
            fileKey: 'material/uv-texturing/05-material-pack.zip',
            fileSize: 41_300_000,
            mimeType: 'application/zip',
          },
        ],
      },
      { title: 'ส่งออก Texture Map กลับเข้า Maya และตรวจงาน', durationSec: 1020 },
    ],
  },
  {
    key: 'maya-python',
    title: 'เขียน Python สคริปต์เพื่อทำงานอัตโนมัติใน Maya',
    description:
      'งานซ้ำ ๆ ที่เสียเวลาวันละหลายชั่วโมงสามารถย่อให้เหลือคลิกเดียวได้ คอร์สนี้สอนเขียน Python ใน Maya ตั้งแต่คำสั่งพื้นฐานของ maya.cmds การสร้างหน้าต่างเครื่องมือด้วย PySide ไปจนถึงการติดตั้งสคริปต์เป็น Shelf ให้ทั้งทีมใช้ร่วมกัน',
    categorySlug: 'programming',
    instructorUsername: 'natthaphong.c',
    price: '2190.00',
    status: CourseStatus.PENDING_REVIEW,
    lessons: [
      {
        title: 'เริ่มต้นกับ Script Editor และคำสั่งของ maya.cmds',
        durationSec: 1140,
        isPreview: true,
      },
      {
        title: 'เขียนสคริปต์เปลี่ยนชื่อวัตถุจำนวนมากในครั้งเดียว',
        durationSec: 1380,
        quiz: {
          title: 'แบบทดสอบ: พื้นฐาน Python ใน Maya',
          passScore: 70,
          questions: [
            {
              questionText: 'โมดูลใดใช้เรียกคำสั่งของ Maya ผ่าน Python',
              correct: 'maya.cmds',
              wrong: ['maya.render', 'maya.scene', 'maya.viewport'],
            },
            {
              questionText: 'คำสั่งใดใช้ดึงรายชื่อวัตถุที่ถูกเลือกอยู่ในฉาก',
              correct: 'cmds.ls(selection=True)',
              wrong: ['cmds.select(all=True)', 'cmds.listAll(scene=True)', 'cmds.getObjects()'],
            },
          ],
        },
      },
      {
        title: 'สร้างหน้าต่างเครื่องมือของตัวเองด้วย PySide',
        durationSec: 1720,
        materials: [
          {
            fileName: 'ชุดสคริปต์ตัวอย่างประกอบคอร์ส.zip',
            fileKey: 'material/maya-python/03-sample-scripts.zip',
            fileSize: 620_000,
            mimeType: 'application/zip',
          },
        ],
      },
      { title: 'อ่านและเขียนไฟล์เพื่อบันทึกค่าที่ผู้ใช้ตั้งไว้', durationSec: 1150 },
      { title: 'ทำสคริปต์ตรวจสอบไฟล์ก่อนส่งงานให้ลูกค้า', durationSec: 1490 },
      { title: 'ติดตั้งสคริปต์เป็น Shelf ให้ทีมใช้ร่วมกัน', durationSec: 930 },
    ],
  },
  {
    key: 'english-for-3d',
    title: 'ภาษาอังกฤษสำหรับสายงาน 3 มิติ และแอนิเมชัน',
    description:
      'คนทำงาน 3 มิติต้องอ่านคู่มือ ดูทูทอเรียล และคุยกับทีมต่างชาติเกือบทุกวัน คอร์สนี้รวบรวมคำศัพท์และรูปประโยคที่ใช้จริงในสายงาน ตั้งแต่ชื่อเครื่องมือในโปรแกรม การเขียนอีเมลส่งงาน ไปจนถึงการประชุมออนไลน์กับทีมต่างประเทศ',
    categorySlug: 'language',
    instructorUsername: 'piyada.s',
    price: '990.00',
    status: CourseStatus.DRAFT,
    lessons: [
      { title: 'คำศัพท์เครื่องมือและเมนูที่พบบ่อยในโปรแกรม 3 มิติ', durationSec: 940 },
      { title: 'อ่านเอกสารและคู่มือภาษาอังกฤษให้เข้าใจเร็วขึ้น', durationSec: 1080 },
      { title: 'เขียนอีเมลส่งงานและตอบกลับลูกค้าต่างชาติ', durationSec: 1210 },
      { title: 'ประชุมออนไลน์กับทีมต่างประเทศอย่างมั่นใจ', durationSec: 1340 },
      { title: 'เขียนโปรไฟล์และคำอธิบายผลงานเป็นภาษาอังกฤษ', durationSec: 1160 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic shuffle so repeated seeds produce the same choice order. */
function rotate<T>(items: T[], by: number): T[] {
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

async function clearDatabase(): Promise<void> {
  // Children first so foreign keys never block the delete.
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.topupRequest.deleteMany();
  await prisma.qnaReply.deleteMany();
  await prisma.qnaThread.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.quizAttemptAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizChoice.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.material.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('ล้างข้อมูลเดิมทั้งหมด...');
  await clearDatabase();

  // Hash once per distinct password: bcrypt at cost 12 is intentionally slow.
  const adminHash = await hash(ADMIN_PASSWORD, BCRYPT_COST);
  const defaultHash = await hash(DEFAULT_PASSWORD, BCRYPT_COST);

  console.log('สร้างผู้ใช้...');
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      username: 'admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      displayName: 'ผู้ดูแลระบบ getownly',
      bio: 'บัญชีผู้ดูแลระบบสำหรับตรวจสอบสลิปเติมเงินและอนุมัติคอร์ส',
    },
  });

  const instructors = new Map<string, string>();
  for (const instructor of INSTRUCTORS) {
    const created = await prisma.user.create({
      data: {
        email: instructor.email,
        username: instructor.username,
        passwordHash: defaultHash,
        role: Role.INSTRUCTOR,
        displayName: instructor.displayName,
        bio: instructor.bio,
        expertise: instructor.expertise,
        commissionRate: instructor.commissionRate,
      },
    });
    instructors.set(instructor.username, created.id);
  }

  const studentIds: string[] = [];
  for (const student of STUDENTS) {
    const created = await prisma.user.create({
      data: {
        email: student.email,
        username: student.username,
        passwordHash: defaultHash,
        role: Role.STUDENT,
        displayName: student.displayName,
        bio: student.bio,
      },
    });
    studentIds.push(created.id);
  }

  console.log('สร้างหมวดหมู่...');
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({ data: category });
    categories.set(category.slug, created.id);
  }

  console.log('สร้างคอร์สและบทเรียน...');
  let lessonCount = 0;
  let materialCount = 0;
  let quizCount = 0;

  for (const course of COURSES) {
    const instructorId = instructors.get(course.instructorUsername);
    const categoryId = categories.get(course.categorySlug);
    if (!instructorId || !categoryId) {
      throw new Error(`ข้อมูลคอร์ส ${course.key} อ้างถึงผู้สอนหรือหมวดหมู่ที่ไม่มีอยู่`);
    }

    const createdCourse = await prisma.course.create({
      data: {
        instructorId,
        categoryId,
        title: course.title,
        description: course.description,
        coverKey: `cover/${course.key}/cover.jpg`,
        price: course.price,
        status: course.status,
        rejectReason: course.rejectReason ?? null,
        publishedAt: course.status === CourseStatus.PUBLISHED ? new Date() : null,
      },
    });

    let courseStorageBytes = 0;

    for (const [index, lesson] of course.lessons.entries()) {
      const orderIndex = index + 1;
      const videoSize = seedVideoSize(lesson.durationSec);
      courseStorageBytes += videoSize;

      const createdLesson = await prisma.lesson.create({
        data: {
          courseId: createdCourse.id,
          title: lesson.title,
          orderIndex,
          videoKey: `video/${course.key}/${String(orderIndex).padStart(2, '0')}.mp4`,
          videoSize,
          durationSec: lesson.durationSec,
          isPreview: lesson.isPreview ?? false,
        },
      });
      lessonCount += 1;

      for (const material of lesson.materials ?? []) {
        await prisma.material.create({
          data: { lessonId: createdLesson.id, ...material },
        });
        courseStorageBytes += material.fileSize;
        materialCount += 1;
      }

      if (lesson.quiz) {
        const createdQuiz = await prisma.quiz.create({
          data: {
            lessonId: createdLesson.id,
            title: lesson.quiz.title,
            passScore: lesson.quiz.passScore,
          },
        });
        quizCount += 1;

        for (const [questionIndex, question] of lesson.quiz.questions.entries()) {
          const createdQuestion = await prisma.quizQuestion.create({
            data: {
              quizId: createdQuiz.id,
              questionText: question.questionText,
              orderIndex: questionIndex + 1,
            },
          });

          const choices = rotate(
            [
              { choiceText: question.correct, isCorrect: true },
              ...question.wrong.map((text) => ({ choiceText: text, isCorrect: false })),
            ],
            questionIndex,
          );

          await prisma.quizChoice.createMany({
            data: choices.map((choice, choiceIndex) => ({
              questionId: createdQuestion.id,
              choiceText: choice.choiceText,
              isCorrect: choice.isCorrect,
              orderIndex: choiceIndex + 1,
            })),
          });
        }
      }
    }

    // The quota the instructor screen shows has to be the truth about the
    // files that exist, or the very first thing a demo shows about ทก.01 A6
    // is a progress bar reading 0 next to six videos.
    assertSeedStorageWithinQuota(course.title, courseStorageBytes);
    await prisma.course.update({
      where: { id: createdCourse.id },
      data: { storageUsedBytes: BigInt(courseStorageBytes) },
    });
  }

  console.log('สร้างบัญชีในระบบบัญชีคู่...');
  const allUserIds = [admin.id, ...instructors.values(), ...studentIds];
  await prisma.account.createMany({
    data: allUserIds.map((ownerId) => ({ ownerId, kind: 'USER_WALLET' as const })),
  });
  // Platform-level accounts have no owner. Exactly one of each must exist.
  await prisma.account.createMany({
    data: [{ kind: 'PLATFORM_REVENUE' as const }, { kind: 'EXTERNAL_BANK' as const }],
  });

  const accountCount = await prisma.account.count();

  console.log('');
  console.log('เสร็จสิ้น สรุปข้อมูลที่สร้าง');
  console.log(`  ผู้ใช้           ${allUserIds.length} คน (admin 1, instructor 3, student 5)`);
  console.log(`  หมวดหมู่         ${CATEGORIES.length} หมวด`);
  console.log(`  คอร์ส            ${COURSES.length} คอร์ส`);
  console.log(`  บทเรียน          ${lessonCount} บท`);
  console.log(`  เอกสารแนบ        ${materialCount} ไฟล์`);
  console.log(`  แบบทดสอบ         ${quizCount} ชุด`);
  console.log(`  บัญชีในระบบบัญชีคู่ ${accountCount} บัญชี`);
  console.log('');
  console.log('บัญชีสำหรับเข้าสู่ระบบ (เฉพาะเครื่อง dev)');
  console.log(`  ADMIN       ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  INSTRUCTOR  ${INSTRUCTORS[0]?.email} / ${DEFAULT_PASSWORD}`);
  console.log(`  STUDENT     ${STUDENTS[0]?.email} / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('seed ล้มเหลว:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
