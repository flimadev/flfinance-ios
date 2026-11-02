# Decisões de implementação

## Dívidas

- A seção de dívidas é uma visão consolidada, sem criar um cadastro financeiro
  paralelo: reúne lançamentos de despesa não pagos, faturas abertas e regras
  recorrentes mensais já existentes.
- O vencimento de lançamentos continua usando `transactions.date`, pois o modelo
  não possui uma data de vencimento separada. Lembretes são notificações locais,
  sem valores ou descrições financeiras no conteúdo visível da tela bloqueada.
- A antecedência é configurável entre 1 e 30 dias; zero desativa os avisos.
  Cada aviso é agendado às 9h no fuso local, com limite de 50 pendências para
  respeitar os limites de notificações locais do iOS. Permissões negadas são
  exibidas nos Ajustes, e compras no cartão continuam representadas pela fatura.
- Compras de cartão são representadas pelo total da fatura, não novamente pelos
  lançamentos individuais, para evitar contagem duplicada. Regras recorrentes
  futuras aparecem como previsão e não entram no saldo em aberto até serem
  geradas como lançamentos.
- O cadastro de recorrências continua usando o fluxo existente de novo
  lançamento; a seção de dívidas oferece acompanhamento e pagamento.

## Fase 10 — categorias, tags e anexos

- Categorias arquivadas preservam o histórico. Arquivar/restaurar uma categoria
  também inclui sua árvore de subcategorias; a ordenação é persistida por nível.
- Tags são opcionais, associadas por `transaction_tags` e filtráveis sem alterar
  os dados financeiros do lançamento.
- Fotos são copiadas para `documentDirectory/attachments`, limitadas a 5 MB cada.
  O backup JSON v2 incorpora o conteúdo Base64 das fotos respeitando o limite
  global de 25 MB; backups v1 continuam aceitos e são restaurados sem anexos.
- Restore cria arquivos com nomes locais novos antes de substituir o banco e só
  remove arquivos anteriores depois que a transação do banco é concluída.

## Fase 7 — segurança e backup

- O backup é JSON versionado e validado (`flfinance-backup`), incluindo
  todas as tabelas financeiras e metadados. A restauração substitui os dados
  somente depois da validação e dentro de uma única transação SQLite.
- Arquivos de backup têm limite de 25 MB; preferências de tema, início do mês e
  biometria ficam no SecureStore do aparelho e não são exportadas.
- O dia de início mensal é limitado a 1–28 para que todos os períodos tenham
  limites válidos em qualquer mês. Dashboard e orçamentos usam o ciclo escolhido.
- A ativação biométrica exige hardware e biometria cadastrada; Face ID no iOS
  precisa de development build e não é validável no Expo Go.

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
