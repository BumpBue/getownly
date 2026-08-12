import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Global for the same reason MailModule is: many domains store files, none owns storage. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
