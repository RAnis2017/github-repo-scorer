import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchReposDto {
  @ApiProperty({ example: 'typescript' })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  createdAfter: string;

  @ApiPropertyOptional({ enum: ['score', 'stars', 'forks'], default: 'score' })
  @IsOptional()
  @IsEnum(['score', 'stars', 'forks'])
  sort: 'score' | 'stars' | 'forks' = 'score';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage: number = 10;
}
