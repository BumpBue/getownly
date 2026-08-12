import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { CategoriesService, type CategoryDto } from './categories.service';

/**
 * Read-only for now: the catalog filter sidebar needs the list. Creating and
 * editing categories belongs to the admin screens.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categories.listAll();
  }
}
