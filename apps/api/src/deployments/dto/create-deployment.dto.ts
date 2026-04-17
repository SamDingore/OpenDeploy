import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDeploymentDto {
  @IsString()
  @MinLength(1)
  environmentId!: string;

  @IsOptional()
  @IsString()
  gitRef?: string;

  @IsOptional()
  @IsString()
  framework?: string;

  @IsOptional()
  @IsString()
  installCommand?: string;

  @IsOptional()
  @IsString()
  buildCommand?: string;

  @IsOptional()
  @IsString()
  startCommand?: string;

  @IsOptional()
  @IsString()
  rootDirectory?: string;

  // Phase 2: real builds only (no simulation flags)
}
