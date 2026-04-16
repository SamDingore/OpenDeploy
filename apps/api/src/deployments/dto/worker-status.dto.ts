import { BuildFailureCode, DeploymentStatus } from '@opendeploy/shared';
import { RunnerClass } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @IsString()
  nodePoolName?: string;

  @IsOptional()
  @IsBoolean()
  rootlessCapable?: boolean;

  @IsOptional()
  @IsEnum(RunnerClass)
  runnerClass?: RunnerClass;

  @IsOptional()
  @IsString()
  workerIdentityFingerprint?: string;

  /** When creating a new pool, record rootless capability at the pool level. */
  @IsOptional()
  @IsBoolean()
  poolSupportsRootless?: boolean;
}

