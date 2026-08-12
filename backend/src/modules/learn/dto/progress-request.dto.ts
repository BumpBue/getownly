import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Ten hours, the same ceiling a lesson's own duration is held to. */
const MAX_POSITION_SECONDS = 36_000;

export class UpdateProgressDto {
  /**
   * Where the player currently is, in whole seconds.
   *
   * Sent every ten seconds while a video plays, so it must stay cheap: one
   * integer, upserted onto one row.
   */
  @Type(() => Number)
  @IsInt({ message: 'ตำแหน่งการเล่นไม่ถูกต้อง' })
  @Min(0, { message: 'ตำแหน่งการเล่นต้องไม่ติดลบ' })
  @Max(MAX_POSITION_SECONDS, { message: 'ตำแหน่งการเล่นเกินกว่าที่ระบบรองรับ' })
  lastPositionSec!: number;
}
