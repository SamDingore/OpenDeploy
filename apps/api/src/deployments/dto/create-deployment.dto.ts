import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeploymentDto {
  @IsUUID()
  environmentId!: string;

  @IsOptional()
  @IsString()
  gitRef?: string;

  // Phase 2: real builds only (no simulation flags)
}
