import type { ZodIssue } from 'zod';

import { ptBR } from '@/src/i18n/pt-BR';

export class ValidationError extends Error {
  constructor(readonly issues: ZodIssue[]) {
    super(ptBR.errors.validation);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor() {
    super(ptBR.errors.notFound);
    this.name = 'NotFoundError';
  }
}

export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleError';
  }
}
