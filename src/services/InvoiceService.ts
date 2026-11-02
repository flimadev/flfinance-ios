import type { Invoice, Transaction } from '@/src/db/schema';
import { DomainRuleError, NotFoundError } from '@/src/domain/errors';
import type { AccountRepositoryContract } from '@/src/repositories/AccountRepository';
import type { InvoiceRepositoryContract } from '@/src/repositories/InvoiceRepository';
import type { TransactionRepositoryContract } from '@/src/repositories/TransactionRepository';
import { getLocalDateString } from '@/src/domain/transactions';
import { createServiceId, getServiceTimestamp, type ServiceOptions } from './serviceUtils';

export type InvoiceWithTotal = Invoice & { totalCents: number };

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepositoryContract,
    private readonly accountRepository: AccountRepositoryContract,
    private readonly transactionRepository: TransactionRepositoryContract,
    private readonly options: ServiceOptions = {},
  ) {}

  async listByAccount(accountId: string): Promise<InvoiceWithTotal[]> {
    const invoices = await this.repository.listByAccount(accountId);
    return Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        totalCents: await this.repository.sumForInvoice(invoice.id),
      })),
    );
  }

  async pay(invoiceId: string, paymentAccountId: string): Promise<Invoice> {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError();
    }
    if (invoice.status === 'paid') {
      return invoice;
    }

    const [cardAccount, paymentAccount] = await Promise.all([
      this.accountRepository.findById(invoice.accountId),
      this.accountRepository.findById(paymentAccountId),
    ]);
    if (
      !cardAccount ||
      cardAccount.type !== 'credit_card' ||
      cardAccount.deletedAt !== null ||
      cardAccount.archivedAt !== null ||
      !paymentAccount ||
      paymentAccount.id === invoice.accountId ||
      paymentAccount.type === 'credit_card' ||
      paymentAccount.deletedAt !== null ||
      paymentAccount.archivedAt !== null
    ) {
      throw new DomainRuleError('Selecione uma conta disponível para pagar a fatura.');
    }

    const amountCents = await this.repository.sumForInvoice(invoiceId);
    if (amountCents <= 0) {
      throw new DomainRuleError('Não é possível pagar uma fatura sem lançamentos.');
    }

    const now = getServiceTimestamp(this.options);
    const paymentTransaction: Transaction = {
      id: createServiceId(this.options),
      accountId: paymentAccountId,
      categoryId: null,
      kind: 'transfer',
      amountCents,
      date: getLocalDateString(new Date(now)),
      description: `Pagamento da fatura ${invoice.billingMonth}`,
      notes: null,
      paymentMethod: 'transfer',
      transferAccountId: invoice.accountId,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      invoiceId: null,
      recurringId: null,
      isPaid: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.pay(invoiceId, paymentAccountId, paymentTransaction, now);
  }
}
