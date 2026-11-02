import { AccountRepository } from '@/src/repositories/AccountRepository';
import { CategoryRepository } from '@/src/repositories/CategoryRepository';
import { TransactionRepository } from '@/src/repositories/TransactionRepository';
import { AccountService } from '@/src/services/AccountService';
import { CategoryService } from '@/src/services/CategoryService';
import { TransactionService } from '@/src/services/TransactionService';
import { getDatabase } from '@/src/db/client';

export async function getTransactionServices() {
  const db = await getDatabase();
  const accounts = new AccountRepository(db);
  const categories = new CategoryRepository(db);
  const transactions = new TransactionRepository(db);

  return {
    accountService: new AccountService(accounts),
    categoryService: new CategoryService(categories),
    transactionService: new TransactionService(transactions, accounts, categories),
  };
}
