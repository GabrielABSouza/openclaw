import type { ErrorCode } from './types.ts';
import {
  PRIORITIES, SOURCE_TYPES, FREQUENCIES, CONTENT_TYPES, CATEGORIES,
  ARTICLE_STATUSES, REC_STATUSES, REC_FORMATS, REC_PRIORITIES, PLATFORMS,
} from './types.ts';

type ValidationResult = { valid: true } | { valid: false; code: ErrorCode; message: string };

export function ok(): ValidationResult { return { valid: true }; }
export function fail(code: ErrorCode, message: string): ValidationResult { return { valid: false, code, message }; }

export function required(value: unknown, name: string): ValidationResult {
  if (value === undefined || value === null || value === '') return fail('MISSING_REQUIRED', `${name} is required`);
  return ok();
}

export function validRelevance(value: unknown): ValidationResult {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10) return fail('INVALID_RELEVANCE', `relevance must be integer 0-10, got: ${value}`);
  return ok();
}

export function validPriority(value: unknown): ValidationResult {
  if (!PRIORITIES.includes(value as any)) return fail('INVALID_PRIORITY', `priority must be one of: ${PRIORITIES.join(', ')}, got: ${value}`);
  return ok();
}

export function validSourceType(value: unknown): ValidationResult {
  if (!SOURCE_TYPES.includes(value as any)) return fail('INVALID_TYPE', `type must be one of: ${SOURCE_TYPES.join(', ')}, got: ${value}`);
  return ok();
}

export function validFrequency(value: unknown): ValidationResult {
  if (!FREQUENCIES.includes(value as any)) return fail('INVALID_FREQUENCY', `frequency must be one of: ${FREQUENCIES.join(', ')}, got: ${value}`);
  return ok();
}

export function validContentType(value: unknown): ValidationResult {
  if (!CONTENT_TYPES.includes(value as any)) return fail('INVALID_CONTENT_TYPE', `content-type must be one of: ${CONTENT_TYPES.join(', ')}, got: ${value}`);
  return ok();
}

export function validCategory(value: unknown): ValidationResult {
  if (!CATEGORIES.includes(value as any)) return fail('INVALID_TYPE', `category must be one of: ${CATEGORIES.join(', ')}, got: ${value}`);
  return ok();
}

export function validArticleStatus(value: unknown): ValidationResult {
  if (!ARTICLE_STATUSES.includes(value as any)) return fail('INVALID_STATUS', `status must be one of: ${ARTICLE_STATUSES.join(', ')}, got: ${value}`);
  return ok();
}

export function validRecStatus(value: unknown): ValidationResult {
  if (!REC_STATUSES.includes(value as any)) return fail('INVALID_STATUS', `status must be one of: ${REC_STATUSES.join(', ')}, got: ${value}`);
  return ok();
}

export function validRecFormat(value: unknown): ValidationResult {
  if (!REC_FORMATS.includes(value as any)) return fail('INVALID_FORMAT', `format must be one of: ${REC_FORMATS.join(', ')}, got: ${value}`);
  return ok();
}

export function validRecPriority(value: unknown): ValidationResult {
  if (!REC_PRIORITIES.includes(value as any)) return fail('INVALID_PRIORITY', `priority must be one of: ${REC_PRIORITIES.join(', ')}, got: ${value}`);
  return ok();
}

export function validPlatform(value: unknown): ValidationResult {
  if (!PLATFORMS.includes(value as any)) return fail('INVALID_PLATFORM', `platform must be one of: ${PLATFORMS.join(', ')}, got: ${value}`);
  return ok();
}

export function validDate(value: unknown): ValidationResult {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return fail('INVALID_DATE', `date must be ISO format (YYYY-MM-DD), got: ${value}`);
  }
  return ok();
}

export function validJsonArray(value: unknown, name: string): ValidationResult {
  if (typeof value !== 'string') return fail('INVALID_JSON', `${name} must be a JSON string`);
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fail('INVALID_JSON', `${name} must be a JSON array`);
    return ok();
  } catch {
    return fail('INVALID_JSON', `${name} is not valid JSON`);
  }
}

export function validJson(value: unknown, name: string): ValidationResult {
  if (typeof value !== 'string') return fail('INVALID_JSON', `${name} must be a JSON string`);
  try {
    JSON.parse(value);
    return ok();
  } catch {
    return fail('INVALID_JSON', `${name} is not valid JSON`);
  }
}

export function check(result: ValidationResult): asserts result is { valid: true } {
  if (!result.valid) throw result;
}
