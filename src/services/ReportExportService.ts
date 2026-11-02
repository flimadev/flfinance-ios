import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { FinancialReport } from '@/src/domain/reports';
import {
  createReportPdfHtml,
  createReportXlsx,
  type ReportDocumentLabels,
} from '@/src/domain/reportDocuments';

const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function ensureSharingAvailable(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('report-export-unavailable');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('share-unavailable');
  }
}

export async function exportReportPdf(
  report: FinancialReport,
  labels: ReportDocumentLabels,
): Promise<void> {
  await ensureSharingAvailable();
  const { uri } = await Print.printToFileAsync({
    html: createReportPdfHtml(report, labels),
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: labels.title,
  });
}

export async function exportReportXlsx(
  report: FinancialReport,
  labels: ReportDocumentLabels,
): Promise<void> {
  await ensureSharingAvailable();
  const file = new File(Paths.cache, `flfinance-relatorio-${Date.now()}.xlsx`);
  await file.write(createReportXlsx(report, labels));
  await Sharing.shareAsync(file.uri, {
    mimeType: xlsxMimeType,
    dialogTitle: labels.title,
  });
}
