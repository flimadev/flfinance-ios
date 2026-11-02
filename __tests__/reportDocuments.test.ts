import { strFromU8, unzipSync } from 'fflate';

import type { FinancialReport } from '../src/domain/reports';
import {
  createReportPdfHtml,
  createReportXlsx,
  type ReportDocumentLabels,
} from '../src/domain/reportDocuments';
import type { Transaction } from '../src/db/schema';

const transaction: Transaction = {
  id: 'transaction-1',
  accountId: 'account-1',
  categoryId: null,
  kind: 'expense',
  amountCents: 2_500,
  date: '2026-07-10',
  description: '<script>alert("x")</script> & café',
  notes: null,
  paymentMethod: null,
  transferAccountId: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentTotal: null,
  invoiceId: null,
  recurringId: null,
  isPaid: false,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const report: FinancialReport = {
  period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
  incomeCents: 10_000,
  expenseCents: 2_500,
  netCents: 7_500,
  projectedBalanceCents: 17_500,
  months: [{ month: '2026-07', incomeCents: 10_000, expenseCents: 2_500, netCents: 7_500 }],
  categories: [
    {
      categoryId: null,
      kind: 'expense',
      name: 'Alimentação & café',
      color: null,
      amountCents: 2_500,
    },
  ],
  transactions: [
    {
      transaction,
      accountName: 'Conta <principal>',
      transferAccountName: null,
      categoryName: null,
      tagNames: ['Essencial & mensal'],
    },
  ],
};

const labels: ReportDocumentLabels = {
  title: 'Relatório FlFinance',
  periodLabel: 'Período',
  period: '01/07/2026 – 31/07/2026',
  filtersLabel: 'Filtros',
  filters: 'Todas as contas',
  summary: 'Resumo',
  income: 'Receitas',
  expense: 'Despesas',
  net: 'Saldo',
  projectedBalance: 'Saldo projetado',
  monthlyEvolution: 'Evolução mensal',
  month: 'Mês',
  categoryBreakdown: 'Categorias',
  category: 'Categoria',
  kind: 'Tipo',
  expenseKind: 'Despesa',
  incomeKind: 'Receita',
  transactions: 'Lançamentos',
  date: 'Data',
  description: 'Descrição',
  account: 'Conta',
  destinationAccount: 'Conta de destino',
  tags: 'Tags',
  amount: 'Valor',
  amountCents: 'Valor em centavos',
  status: 'Status',
  paid: 'Pago',
  pending: 'Pendente',
  transfer: 'Transferência',
  uncategorized: 'Sem categoria',
  workbookSummary: 'Resumo',
  workbookMonthly: 'Fluxo mensal',
  workbookCategories: 'Categorias',
  workbookTransactions: 'Lançamentos',
};

describe('report documents', () => {
  it('escapes user-provided HTML values in PDF output', () => {
    const html = createReportPdfHtml(report, labels);

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; café');
    expect(html).toContain('Conta &lt;principal&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('creates a valid workbook with localized sheets and integer cent amounts', () => {
    const workbookFiles = unzipSync(createReportXlsx(report, labels));
    const workbook = strFromU8(workbookFiles['xl/workbook.xml'] ?? new Uint8Array());
    const transactionSheet = strFromU8(
      workbookFiles['xl/worksheets/sheet4.xml'] ?? new Uint8Array(),
    );

    expect(workbook).toContain('name="Fluxo mensal"');
    expect(workbook).toContain('name="Lançamentos"');
    expect(transactionSheet).toContain('<v>-2500</v>');
    expect(transactionSheet).toContain('&lt;script&gt;');
    expect(transactionSheet).toContain('Conta &lt;principal&gt;');
  });
});
