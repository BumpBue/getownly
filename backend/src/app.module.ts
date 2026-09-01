import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { buildThrottlerOptions } from './config/throttler.config';
import { PrismaModule } from './infra/prisma.module';
import { MailModule } from './infra/mail/mail.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ContentReportsModule } from './modules/content-reports/content-reports.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { LearnModule } from './modules/learn/learn.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { QnaModule } from './modules/qna/qna.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StatsModule } from './modules/stats/stats.module';
import { TopupsModule } from './modules/topups/topups.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
    // Global because JwtAuthGuard runs as an APP_GUARD, outside AuthModule.
    // Secrets are passed per sign/verify call: access and refresh use different ones.
    JwtModule.register({ global: true }),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    CategoriesModule,
    CoursesModule,
    LessonsModule,
    MaterialsModule,
    UploadsModule,
    LedgerModule,
    TopupsModule,
    EnrollmentsModule,
    LearnModule,
    QuizzesModule,
    QnaModule,
    UsersModule,
    ReportsModule,
    StatsModule,
    ContentReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: rate limiting first, then authentication, then the role
    // check that depends on the authenticated user.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
