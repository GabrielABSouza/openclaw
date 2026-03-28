import type { CLISuccess, CLIError, ErrorCode } from './types.ts';

export function success<T>(command: string, data: T, count?: number): CLISuccess<T> {
  return { ok: true as const, command, ...(count !== undefined && { count }), data };
}

export function error(command: string, code: ErrorCode, message: string): CLIError {
  return { ok: false as const, command, code, error: message };
}

export function print(result: CLISuccess | CLIError): void {
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.ok) process.exitCode = 1;
}
