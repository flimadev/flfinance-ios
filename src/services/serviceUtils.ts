import * as Crypto from 'expo-crypto';
import { ZodError, type ZodType } from 'zod';

import { ValidationError } from '@/src/domain/errors';

export type ServiceOptions = {
  createId?: () => string;
  now?: () => number;
};

export function parseInput<TSchema extends ZodType>(
  schema: TSchema,
  input: unknown,
): TSchema['_output'] {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.issues);
    }
    throw error;
  }
}

export function createServiceId(options: ServiceOptions): string {
  return (options.createId ?? defaultId)();
}

export function getServiceTimestamp(options: ServiceOptions): number {
  return (options.now ?? Date.now)();
}

function defaultId(): string {
  return Crypto.randomUUID();
}
