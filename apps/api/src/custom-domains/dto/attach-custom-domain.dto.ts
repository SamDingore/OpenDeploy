import { IsString, MinLength } from 'class-validator';

export class AttachCustomDomainDto {
  @IsString()
  @MinLength(8)
  releaseId!: string;
}
