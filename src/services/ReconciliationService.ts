import { z } from 'zod';

import { NotFoundError } from '@/src/domain/errors';
import type { Transaction } from '@/src/db/schema';
import type { TransactionRepositoryContract } from '@/src/repositories/TransactionRepository';
import { getServiceTimestamp, parseInput, type ServiceOptions } from './serviceUtils';

const setReconciledSchema = z.object({
  transactionId: z.string().trim().min(1).max(100),
  reconciled: z.boolean(),
});

export class ReconciliationService {
  constructor(
    private readonly repository: TransactionRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async setReconciled(input: {
    transactionId: string;
    reconciled: boolean;
  }): Promise<Transaction> {
    const values = parseInput(setReconciledSchema, input);
    const current = await this.repository.findById(values.transactionId);
    if (!current || current.deletedAt !== null) {
      throw new NotFoundError();
    }

    const now = getServiceTimestamp(this.options);
    const updated = await this.repository.update(values.transactionId, {
      reconciledAt: values.reconciled ? now : null,
      updatedAt: now,
    });
    if (!updated) {
      throw new NotFoundError();
    }
    return updated;
  }
}
