import { IsString, MinLength } from 'class-validator';

export class AddCustomDomainDto {
  @IsString()
  @MinLength(4)
  hostname!: string;
}
