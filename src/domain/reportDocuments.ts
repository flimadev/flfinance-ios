import { strToU8, zipSync } from 'fflate';

import type { FinancialReport } from '@/src/domain/reports';
import { formatCurrencyCents } from '@/src/domain/money';

export type ReportDocumentLabels = {
  title: string;
  periodLabel: string;
  period: string;
  filtersLabel: string;
  filters: string;
  summary: string;
  income: string;
  expense: string;
  net: string;
  projectedBalance: string;
  monthlyEvolution: string;
  month: string;
  categoryBreakdown: string;
  category: string;
  kind: string;
  expenseKind: string;
  incomeKind: string;
  transactions: string;
  date: string;
  description: string;
  account: string;
  destinationAccount: string;
  tags: string;
  amount: string;
  amountCents: string;
  status: string;
  paid: string;
  pending: string;
  transfer: string;
  uncategorized: string;
  workbookSummary: string;
  workbookMonthly: string;
  workbookCategories: string;
  workbookTransactions: string;
};

type WorkbookCell = string | number;

function stripXmlControls(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function escapeXml(value: string): string {
  return stripXmlControls(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeHtml(value: string): string {
  return escapeXml(value);
}

function formatSignedAmountCents(kind: string, amountCents: number): number {
  return kind === 'expense' ? -amountCents : amountCents;
}

function createTable(headers: string[], rows: string[][]): string {
  const header = headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('');
  const body =
    rows.length > 0
      ? rows
          .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
          .join('')
      : '';
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

export function createReportPdfHtml(report: FinancialReport, labels: ReportDocumentLabels): string {
  const summary = createTable(
    [labels.summary, labels.amount],
    [
      [labels.income, formatCurrencyCents(report.incomeCents)],
      [labels.expense, formatCurrencyCents(-report.expenseCents)],
      [labels.net, formatCurrencyCents(report.netCents)],
      [labels.projectedBalance, formatCurrencyCents(report.projectedBalanceCents)],
    ],
  );
  const monthly = createTable(
    [labels.month, labels.income, labels.expense, labels.net],
    report.months.map((month) => [
      month.month,
      formatCurrencyCents(month.incomeCents),
      formatCurrencyCents(-month.expenseCents),
      formatCurrencyCents(month.netCents),
    ]),
  );
  const categories = createTable(
    [labels.kind, labels.category, labels.amount],
    report.categories.map((category) => [
      category.kind === 'expense' ? labels.expenseKind : labels.incomeKind,
      category.name,
      formatCurrencyCents(category.amountCents),
    ]),
  );
  const transactions = createTable(
    [
      labels.date,
      labels.kind,
      labels.description,
      labels.account,
      labels.destinationAccount,
      labels.category,
      labels.tags,
      labels.amount,
      labels.status,
    ],
    report.transactions.map(
      ({ transaction, accountName, transferAccountName, categoryName, tagNames }) => [
        transaction.date,
        transaction.kind === 'transfer'
          ? labels.transfer
          : transaction.kind === 'expense'
            ? labels.expenseKind
            : labels.incomeKind,
        transaction.description,
        accountName,
        transferAccountName ?? '',
        categoryName ?? labels.uncategorized,
        tagNames.join(', '),
        formatCurrencyCents(formatSignedAmountCents(transaction.kind, transaction.amountCents)),
        transaction.isPaid ? labels.paid : labels.pending,
      ],
    ),
  );

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(labels.title)}</title>
  <style>
    body { color: #17231d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; margin: 28px; }
    h1 { color: #0f684b; font-size: 22px; margin: 0 0 6px; }
    h2 { border-bottom: 1px solid #d5e0da; font-size: 15px; margin: 22px 0 8px; padding-bottom: 5px; }
    p { color: #52635a; margin: 4px 0; }
    table { border-collapse: collapse; margin: 8px 0 14px; table-layout: auto; width: 100%; }
    th { background: #edf4f0; color: #294438; text-align: left; }
    th, td { border: 1px solid #d5e0da; padding: 6px; vertical-align: top; }
    tr { page-break-inside: avoid; }
    @media print { body { margin: 14mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.title)}</h1>
  <p>${escapeHtml(labels.periodLabel)}: ${escapeHtml(labels.period)}</p>
  ${labels.filters ? `<p>${escapeHtml(labels.filtersLabel)}: ${escapeHtml(labels.filters)}</p>` : ''}
  <h2>${escapeHtml(labels.summary)}</h2>
  ${summary}
  <h2>${escapeHtml(labels.monthlyEvolution)}</h2>
  ${monthly}
  <h2>${escapeHtml(labels.categoryBreakdown)}</h2>
  ${categories}
  <h2>${escapeHtml(labels.transactions)}</h2>
  ${transactions}
</body>
</html>`;
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function createWorksheet(rows: WorkbookCell[][]): string {
  const xmlRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) => {
            const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
            return typeof cell === 'number'
              ? `<c r="${reference}" t="n"><v>${cell}</v></c>`
              : `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

function validateSheetNames(sheets: { name: string }[]): void {
  const names = new Set<string>();
  for (const sheet of sheets) {
    if (
      sheet.name.length === 0 ||
      sheet.name.length > 31 ||
      /[\\/*?:\[\]]/.test(sheet.name) ||
      names.has(sheet.name)
    ) {
      throw new RangeError('O nome de uma aba do Excel é inválido ou duplicado.');
    }
    names.add(sheet.name);
  }
}

export function createReportXlsx(
  report: FinancialReport,
  labels: ReportDocumentLabels,
): Uint8Array {
  const sheets: { name: string; rows: WorkbookCell[][] }[] = [
    {
      name: labels.workbookSummary,
      rows: [
        [labels.periodLabel, labels.period],
        [labels.filtersLabel, labels.filters],
        [labels.income, labels.amountCents],
        [labels.expense, labels.amountCents],
        [labels.net, labels.amountCents],
        [labels.projectedBalance, labels.amountCents],
        [labels.income, report.incomeCents],
        [labels.expense, -report.expenseCents],
        [labels.net, report.netCents],
        [labels.projectedBalance, report.projectedBalanceCents],
      ],
    },
    {
      name: labels.workbookMonthly,
      rows: [
        [labels.month, labels.income, labels.expense, labels.net],
        ...report.months.map((month) => [
          month.month,
          month.incomeCents,
          -month.expenseCents,
          month.netCents,
        ]),
      ],
    },
    {
      name: labels.workbookCategories,
      rows: [
        [labels.kind, labels.category, labels.amountCents],
        ...report.categories.map((category) => [
          category.kind === 'expense' ? labels.expenseKind : labels.incomeKind,
          category.name,
          category.amountCents,
        ]),
      ],
    },
    {
      name: labels.workbookTransactions,
      rows: [
        [
          labels.date,
          labels.kind,
          labels.description,
          labels.account,
          labels.destinationAccount,
          labels.category,
          labels.tags,
          labels.amountCents,
          labels.status,
        ],
        ...report.transactions.map(
          ({ transaction, accountName, transferAccountName, categoryName, tagNames }) => [
            transaction.date,
            transaction.kind === 'transfer'
              ? labels.transfer
              : transaction.kind === 'expense'
                ? labels.expenseKind
                : labels.incomeKind,
            transaction.description,
            accountName,
            transferAccountName ?? '',
            categoryName ?? labels.uncategorized,
            tagNames.join(', '),
            formatSignedAmountCents(transaction.kind, transaction.amountCents),
            transaction.isPaid ? labels.paid : labels.pending,
          ],
        ),
      ],
    },
  ];
  validateSheetNames(sheets);

  const worksheetFiles: Record<string, Uint8Array> = {};
  const worksheetOverrides = sheets
    .map((sheet, index) => {
      const worksheetPath = `xl/worksheets/sheet${index + 1}.xml`;
      worksheetFiles[worksheetPath] = strToU8(createWorksheet(sheet.rows));
      return `<Override PartName="/${worksheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    })
    .join('');
  const workbookSheets = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');
  const workbookRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${worksheetOverrides}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}</Relationships>`,
    ),
    ...worksheetFiles,
  };

  return zipSync(files, { level: 6 });
}
