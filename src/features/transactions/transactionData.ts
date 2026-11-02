import { AccountRepository } from '@/src/repositories/AccountRepository';
import { BudgetRepository } from '@/src/repositories/BudgetRepository';
import { InvoiceRepository } from '@/src/repositories/InvoiceRepository';
import { RecurringRuleRepository } from '@/src/repositories/RecurringRuleRepository';
import { CategoryRepository } from '@/src/repositories/CategoryRepository';
import { TransactionRepository } from '@/src/repositories/TransactionRepository';
import { AccountService } from '@/src/services/AccountService';
import { BudgetService } from '@/src/services/BudgetService';
import { CardService } from '@/src/services/CardService';
import { CategoryService } from '@/src/services/CategoryService';
import { TransactionService } from '@/src/services/TransactionService';
import { InvoiceService } from '@/src/services/InvoiceService';
import { RecurringService } from '@/src/services/RecurringService';
import { getDatabase } from '@/src/db/client';

export async function getTransactionServices() {
  const db = await getDatabase();
  const accounts = new AccountRepository(db);
  const budgets = new BudgetRepository(db);
  const categories = new CategoryRepository(db);
  const invoices = new InvoiceRepository(db);
  const recurringRules = new RecurringRuleRepository(db);
  const transactions = new TransactionRepository(db);

  return {
    accountService: new AccountService(accounts),
    budgetService: new BudgetService(budgets, categories),
    cardService: new CardService(invoices, accounts, categories),
    categoryService: new CategoryService(categories),
    invoiceService: new InvoiceService(invoices, accounts, transactions),
    recurringService: new RecurringService(recurringRules, accounts, categories),
    transactionService: new TransactionService(transactions, accounts, categories),
  };
}
