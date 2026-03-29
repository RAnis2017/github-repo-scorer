import { ApiProperty } from '@nestjs/swagger';

export class ScoredRepoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  full_name: string;

  @ApiProperty()
  html_url: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  stargazers_count: number;

  @ApiProperty()
  forks_count: number;

  @ApiProperty({ nullable: true })
  language: string | null;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;

  @ApiProperty()
  pushed_at: string;

  @ApiProperty({ description: '0–100 popularity score' })
  score: number;
}
