import { AccountRepository } from '@/src/repositories/AccountRepository';
import { BudgetRepository } from '@/src/repositories/BudgetRepository';
import { CategoryRepository } from '@/src/repositories/CategoryRepository';
import { TransactionRepository } from '@/src/repositories/TransactionRepository';
import { AccountService } from '@/src/services/AccountService';
import { BudgetService } from '@/src/services/BudgetService';
import { CategoryService } from '@/src/services/CategoryService';
import { TransactionService } from '@/src/services/TransactionService';
import { getDatabase } from '@/src/db/client';

export async function getTransactionServices() {
  const db = await getDatabase();
  const accounts = new AccountRepository(db);
  const budgets = new BudgetRepository(db);
  const categories = new CategoryRepository(db);
  const transactions = new TransactionRepository(db);

  return {
    accountService: new AccountService(accounts),
    budgetService: new BudgetService(budgets, categories),
    categoryService: new CategoryService(categories),
    transactionService: new TransactionService(transactions, accounts, categories),
  };
}
