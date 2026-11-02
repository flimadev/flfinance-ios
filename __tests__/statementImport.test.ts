import { strToU8, zipSync } from 'fflate';

import {
  inferStatementMapping,
  mapStatementRows,
  parseCsvTable,
  parseOfx,
  parseStatementFile,
} from '../src/domain/statementImport';

describe('statement import parsing', () => {
  it('parses quoted CSV and converts Brazilian decimal amounts to integer cents', () => {
    const table = parseStatementFile(
      'extrato.csv',
      '\uFEFFData;Descrição;Tipo;Valor\r\n01/07/2026;"Mercado; central";Despesa;1.234,56\r\n',
    );
    if (table.format === 'ofx') {
      throw new Error('Expected a delimited statement.');
    }

    expect(table.headers).toEqual(['Data', 'Descrição', 'Tipo', 'Valor']);
    expect(mapStatementRows(table.rows, table.mapping)).toEqual([
      {
        date: '2026-07-01',
        description: 'Mercado; central',
        kind: 'expense',
        amountCents: 123_456,
      },
    ]);
  });

  it('parses OFX transactions as signed integer-cent income and expenses', () => {
    const rows = parseOfx(
      `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260710120000.000[-3:BRT]
<TRNAMT>-58.90
<FITID>stable-1
<NAME>Supermercado &amp; feira
</STMTTRN><STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260711
<TRNAMT>1500.00
<MEMO>Salário
</STMTTRN></OFX>`,
    );

    expect(rows).toEqual([
      {
        date: '2026-07-10',
        description: 'Supermercado & feira',
        kind: 'expense',
        amountCents: 5_890,
      },
      {
        date: '2026-07-11',
        description: 'Salário',
        kind: 'income',
        amountCents: 150_000,
      },
    ]);
  });

  it('reads the first worksheet from an XLSX archive', () => {
    const archive = zipSync({
      'xl/workbook.xml': strToU8(
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extrato" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>data</t></is></c><c r="B1" t="inlineStr"><is><t>descricao</t></is></c><c r="C1" t="inlineStr"><is><t>valor_centavos</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2026-07-01</t></is></c><c r="B2" t="inlineStr"><is><t>Mercado &amp; feira</t></is></c><c r="C2" t="n"><v>-2599</v></c></row></sheetData></worksheet>',
      ),
    });

    const table = parseStatementFile('extrato.xlsx', archive);
    if (table.format === 'ofx') {
      throw new Error('Expected a spreadsheet statement.');
    }

    expect(table.headers).toEqual(['data', 'descricao', 'valor_centavos']);
    expect(table.mapping.amountInCents).toBe(true);
    expect(mapStatementRows(table.rows, table.mapping)).toEqual([
      {
        date: '2026-07-01',
        description: 'Mercado & feira',
        kind: 'expense',
        amountCents: 2_599,
      },
    ]);
  });

  it('rejects invalid CSV rows, dates, and amounts', () => {
    expect(() => parseCsvTable('data,descricao,valor\n')).toThrow('invalid-statement-file');
    expect(() => {
      const rows = [['data', 'descricao', 'valor'], ['31/02/2026', 'Compra', '12,00']];
      mapStatementRows(rows, inferStatementMapping(rows[0] ?? []));
    }).toThrow('invalid-statement-date');
    expect(() => {
      const rows = [['data', 'descricao', 'valor'], ['2026-07-01', 'Compra', '12,345']];
      mapStatementRows(rows, inferStatementMapping(rows[0] ?? []));
    }).toThrow('invalid-statement-amount');
  });
});
