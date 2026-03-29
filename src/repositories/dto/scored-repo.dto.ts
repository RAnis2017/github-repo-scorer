import { ApiProperty } from '@nestjs/swagger';

export class ScoredRepoDto {
  @ApiProperty()
  declare id: number;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare full_name: string;

  @ApiProperty()
  declare html_url: string;

  @ApiProperty({ nullable: true })
  declare description: string | null;

  @ApiProperty()
  declare stargazers_count: number;

  @ApiProperty()
  declare forks_count: number;

  @ApiProperty({ nullable: true })
  declare language: string | null;

  @ApiProperty()
  declare created_at: string;

  @ApiProperty()
  declare updated_at: string;

  @ApiProperty()
  declare pushed_at: string;

  @ApiProperty({ description: '0-100 popularity score' })
  declare score: number;
}
