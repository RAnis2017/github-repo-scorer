export class GitHubRepoDto {
  declare id: number;
  declare name: string;
  declare full_name: string;
  declare html_url: string;
  declare description: string | null;
  declare stargazers_count: number;
  declare forks_count: number;
  declare language: string | null;
  declare created_at: string;
  declare updated_at: string;
  declare pushed_at: string;
}
