// --- Enums ---

export type Priority = 'P0' | 'P1' | 'P2';
export type SourceType = 'rss' | 'blog' | 'youtube' | 'newsletter';
export type Frequency = 'daily' | '3x-week' | 'weekly';
export type ContentType = 'article' | 'video' | 'paper' | 'post' | 'newsletter-issue';
export type Category = 'ai' | 'tech' | 'negocios' | 'carreira' | 'marketing' | 'tools';
export type ArticleStatus = 'ingested' | 'cataloged' | 'analyzed' | 'recommended' | 'used' | 'skipped';
export type RecStatus = 'pending' | 'approved' | 'published' | 'rejected';
export type RecFormat = 'linkedin-post' | 'twitter-thread' | 'article' | 'newsletter' | 'video-short';
export type RecPriority = 'high' | 'medium' | 'low';
export type Platform = 'linkedin' | 'twitter' | 'newsletter' | 'blog' | 'youtube';

export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2'];
export const SOURCE_TYPES: SourceType[] = ['rss', 'blog', 'youtube', 'newsletter'];
export const FREQUENCIES: Frequency[] = ['daily', '3x-week', 'weekly'];
export const CONTENT_TYPES: ContentType[] = ['article', 'video', 'paper', 'post', 'newsletter-issue'];
export const CATEGORIES: Category[] = ['ai', 'tech', 'negocios', 'carreira', 'marketing', 'tools'];
export const ARTICLE_STATUSES: ArticleStatus[] = ['ingested', 'cataloged', 'analyzed', 'recommended', 'used', 'skipped'];
export const REC_STATUSES: RecStatus[] = ['pending', 'approved', 'published', 'rejected'];
export const REC_FORMATS: RecFormat[] = ['linkedin-post', 'twitter-thread', 'article', 'newsletter', 'video-short'];
export const REC_PRIORITIES: RecPriority[] = ['high', 'medium', 'low'];
export const PLATFORMS: Platform[] = ['linkedin', 'twitter', 'newsletter', 'blog', 'youtube'];

// --- Entities ---

export interface Source {
  id: number;
  name: string;
  type: SourceType;
  url: string | null;
  priority: Priority;
  frequency: Frequency;
  enabled: number;
  last_checked_at: string | null;
  created_at: string;
}

export interface Article {
  id: number;
  source_id: number;
  url: string;
  title: string;
  content_type: ContentType;
  category: string | null;
  tags: string | null;
  summary: string | null;
  full_summary: string | null;
  key_points: string | null;
  relevance: number;
  relevance_breakdown: string | null;
  has_tool: number;
  tool_name: string | null;
  tool_repo: string | null;
  status: ArticleStatus;
  ingested_at: string;
  published_at: string | null;
}

export interface Recommendation {
  id: number;
  article_ids: string;
  theme: string;
  title: string;
  format: RecFormat;
  hook: string;
  angle: string;
  key_points: string;
  quotes: string | null;
  target_audience: string | null;
  related_projects: string | null;
  cross_ref: string | null;
  priority: RecPriority;
  status: RecStatus;
  created_at: string;
}

export interface Publication {
  id: number;
  platform: Platform;
  title: string;
  url: string | null;
  topics: string | null;
  published_at: string;
  recommendation_id: number | null;
  created_at: string;
}

// --- Scoring ---

export interface ScoreCriterion {
  matched: string | boolean | null;
  points: number;
}

export interface RelevanceBreakdown {
  relevance: number;
  breakdown: {
    projeto_direto: ScoreCriterion;
    ferramenta_integravel: ScoreCriterion;
    provider_relevante: ScoreCriterion;
    tema_publicavel: ScoreCriterion;
    dados_concretos: ScoreCriterion;
    opiniao_qualificada: ScoreCriterion;
    tendencia_emergente: ScoreCriterion;
    conteudo_introdutorio: ScoreCriterion;
    noticia_requentada: ScoreCriterion;
    hype_sem_substancia: ScoreCriterion;
    fora_de_escopo: ScoreCriterion;
  };
}

// --- CLI Output ---

export type ErrorCode =
  | 'DUPLICATE_URL'
  | 'DUPLICATE_NAME'
  | 'NOT_FOUND'
  | 'INVALID_RELEVANCE'
  | 'INVALID_PRIORITY'
  | 'INVALID_STATUS'
  | 'INVALID_JSON'
  | 'INVALID_FORMAT'
  | 'INVALID_TYPE'
  | 'INVALID_FREQUENCY'
  | 'INVALID_PLATFORM'
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_DATE'
  | 'MISSING_REQUIRED'
  | 'UNKNOWN_COMMAND'
  | 'DB_ERROR';

export interface CLISuccess<T = unknown> {
  ok: true;
  command: string;
  count?: number;
  data: T;
}

export interface CLIError {
  ok: false;
  command: string;
  code: ErrorCode;
  error: string;
}

export type CLIResult<T = unknown> = CLISuccess<T> | CLIError;
