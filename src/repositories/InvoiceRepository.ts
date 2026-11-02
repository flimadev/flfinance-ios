import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { invoices, schema, transactions, type Invoice, type Transaction } from '@/src/db/schema';

type InvoiceInsert = typeof invoices.$inferInsert;
type TransactionInsert = typeof transactions.$inferInsert;

export type InstallmentInsert = {
  invoice: Pick<
    InvoiceInsert,
    'id' | 'accountId' | 'billingMonth' | 'dueDate' | 'createdAt' | 'updatedAt'
  >;
  transaction: TransactionInsert;
};

export interface InvoiceRepositoryContract {
  listByAccount(accountId: string): Promise<Invoice[]>;
  findById(id: string): Promise<Invoice | undefined>;
  createInstallments(items: InstallmentInsert[]): Promise<Transaction[]>;
  sumForInvoice(invoiceId: string): Promise<number>;
  pay(
    invoiceId: string,
    paymentAccountId: string,
    paymentTransaction: TransactionInsert,
    paidAt: number,
  ): Promise<Invoice>;
}

export class InvoiceRepository<TResult> implements InvoiceRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async listByAccount(accountId: string): Promise<Invoice[]> {
    return this.db
      .select()
      .from(invoices)
      .where(eq(invoices.accountId, accountId))
      .orderBy(asc(invoices.dueDate));
  }

  async findById(id: string): Promise<Invoice | undefined> {
    const [invoice] = await this.db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInstallments(items: InstallmentInsert[]): Promise<Transaction[]> {
    return this.db.transaction((transaction) => {
      const created: Transaction[] = [];

      for (const item of items) {
        let invoice = transaction
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.accountId, item.invoice.accountId),
              eq(invoices.billingMonth, item.invoice.billingMonth),
            ),
          )
          .get();

        if (!invoice) {
          invoice = transaction.insert(invoices).values(item.invoice).returning().get();
        }
        if (!invoice) {
          throw new Error('O SQLite não retornou a fatura recém-criada.');
        }

        const inserted = transaction
          .insert(transactions)
          .values({ ...item.transaction, invoiceId: invoice.id })
          .returning()
          .get();
        if (!inserted) {
          throw new Error('O SQLite não retornou a parcela recém-criada.');
        }
        created.push(inserted);
      }

      return created;
    });
  }

  async sumForInvoice(invoiceId: string): Promise<number> {
    const rows = await this.db
      .select({ amountCents: transactions.amountCents })
      .from(transactions)
      .where(and(eq(transactions.invoiceId, invoiceId), isNull(transactions.deletedAt)));
    let total = 0;
    for (const row of rows) {
      total += row.amountCents;
      if (!Number.isSafeInteger(total)) {
        throw new RangeError('O total da fatura excede o limite seguro de centavos.');
      }
    }
    return total;
  }

  async pay(
    invoiceId: string,
    paymentAccountId: string,
    paymentTransaction: TransactionInsert,
    paidAt: number,
  ): Promise<Invoice> {
    return this.db.transaction((transaction) => {
      const invoice = transaction.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
      if (!invoice) {
        throw new Error('A fatura não foi encontrada.');
      }
      if (invoice.status === 'paid') {
        return invoice;
      }

      transaction
        .insert(transactions)
        .values({
          ...paymentTransaction,
          accountId: paymentAccountId,
          transferAccountId: invoice.accountId,
        })
        .run();
      transaction
        .update(transactions)
        .set({ isPaid: true, updatedAt: paidAt })
        .where(and(eq(transactions.invoiceId, invoiceId), isNull(transactions.deletedAt)))
        .run();

      const paid = transaction
        .update(invoices)
        .set({
          status: 'paid',
          paidAt,
          paymentAccountId,
          paymentTransactionId: paymentTransaction.id,
          updatedAt: paidAt,
        })
        .where(eq(invoices.id, invoiceId))
        .returning()
        .get();
      if (!paid) {
        throw new Error('O SQLite não retornou a fatura paga.');
      }
      return paid;
    });
  }
}
