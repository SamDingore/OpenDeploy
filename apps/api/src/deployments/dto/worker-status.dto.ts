import { BuildFailureCode, DeploymentStatus } from '@opendeploy/shared';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export class WorkerStatusDto {
  @IsEnum(DeploymentStatus)
  status!: DeploymentStatus;

  @ValidateIf((o: WorkerStatusDto) => o.status === DeploymentStatus.build_failed)
  @IsEnum(BuildFailureCode)
  failureCode?: BuildFailureCode;

  @IsOptional()
  @IsString()
  failureDetail?: string;

  @IsOptional()
  @IsString()
  logMessage?: string;

  @IsOptional()
  @IsString()
  logLevel?: string;
}

export class WorkerLogDto {
  @IsString()
  level!: string;

  @IsString()
  message!: string;
}

export class WorkerRegisterDto {
  @IsString()
  name!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

