export const ptBR = {
  database: {
    loading: 'Preparando seus dados…',
    errorTitle: 'Não foi possível abrir seus dados',
    errorDescription:
      'O banco local não pôde ser preparado. Seus dados continuam no dispositivo. Tente novamente.',
    retry: 'Tentar novamente',
  },
  errors: {
    validation: 'Confira os dados informados.',
    notFound: 'O registro não foi encontrado ou já foi removido.',
    accountUnavailable: 'A conta informada não está disponível.',
    categoryUnavailable: 'A categoria informada não está disponível.',
    categoryKindMismatch: 'A categoria precisa ser do mesmo tipo da transação.',
    invalidTransfer: 'Informe uma conta de destino diferente para a transferência.',
    categoryParentMismatch: 'A categoria pai precisa ter o mesmo tipo.',
    categoryParentCycle: 'Uma categoria não pode ser pai dela mesma.',
  },
} as const;
