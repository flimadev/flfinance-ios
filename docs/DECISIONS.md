# Decisões de implementação

## Fase 2 — banco e camada de dados

- Services lançam `ValidationError` com issues do Zod, `NotFoundError` ou
  `DomainRuleError`; falhas inesperadas do SQLite continuam propagando sem serem
  convertidas em sucesso ou descartadas.
- A primeira execução é identificada por uma chave em `app_metadata`; a conta e
  as categorias iniciais são criadas na mesma transação e não reaparecem após
  exclusão manual dos dados iniciais.
- A Fase 2 modela contas, categorias, transações e metadados do seed. Faturas,
  cartões, orçamentos e recorrências permanecem para as fases correspondentes.
- A inicialização abre o SQLite após a montagem no cliente, aplica migrations e
  seed antes de liberar a navegação; erros permanecem visíveis e permitem nova
  tentativa.
