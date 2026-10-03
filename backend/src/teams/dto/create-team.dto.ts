import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}