import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { MaterialDto } from '@/modules/lessons/dto/lesson-response.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { MaterialsService } from './materials.service';

@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post('lessons/:lessonId/materials')
  create(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMaterialDto,
  ): Promise<MaterialDto> {
    return this.materials.create(lessonId, user, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Delete('materials/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.materials.remove(id, user);
  }
}
