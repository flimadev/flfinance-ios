# Decisões de implementação

## Fase 5 — orçamentos

- Existe um orçamento por categoria de despesa e mês (`YYYY-MM`); salvar novamente
  o mesmo par atualiza o limite existente. Metas de economia foram omitidas por
  serem opcionais no roadmap.
- O gasto mensal inclui todas as despesas categorizadas não excluídas, inclusive
  pendentes; transferências, receitas, despesas excluídas e despesas sem categoria
  não consomem um orçamento.
- No iOS, mudanças nas tabelas de orçamentos, categorias e transações notificam a
  tela por `addDatabaseChangeListener`; na web, a lista é atualizada ao focar a
  tela, pois o listener do SQLite é nativo.

## Fase 4 — dashboard

- O saldo atual soma os saldos iniciais das contas não excluídas e somente
  receitas/despesas pagas até hoje; transferências não alteram o total geral.
- Receitas e despesas do período incluem lançamentos pendentes para representar
  os compromissos daquele intervalo. O gráfico agrupa categorias além das cinco
  maiores em “Outras categorias”; lançamentos sem categoria aparecem à parte.

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
