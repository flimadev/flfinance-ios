export function formatCurrencyCents(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents)) {
    throw new RangeError('O valor monetário deve ser um inteiro seguro em centavos.');
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountCents / 100);
}
