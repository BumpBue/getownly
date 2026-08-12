import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { CategoriesService, type AdminCategoryDto } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category-request.dto';

/**
 * Category administration.
 *
 * The public `GET /categories` stays where it is: the catalog sidebar needs it
 * without signing in, and this controller is behind ADMIN in its entirety.
 */
@Roles(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(): Promise<AdminCategoryDto[]> {
    return this.categories.listForAdmin();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<AdminCategoryDto> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.categories.remove(id);
  }
}
