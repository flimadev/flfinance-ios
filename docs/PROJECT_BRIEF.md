# PROJECT BRIEF — App de Finanças Pessoais (Expo + iOS, 100% local)

> Cole este arquivo na raiz do repo (ex.: `docs/PROJECT_BRIEF.md`) e copie a seção **"Regras para o agente"** para `.github/copilot-instructions.md`.
> Trabalhe **uma fase por vez** (seção "Roadmap"). Ao terminar cada fase: rode lint, typecheck e testes, resuma o que foi feito e **pare** para validação.

---

## 1. Visão do produto

App iOS para gerenciar finanças pessoais, **offline-first e privado**: todos os dados ficam no iPhone do usuário (sem backend, sem conta, sem nuvem). Foco em:

- Registro de gastos/receitas em poucos toques (menos de 5 segundos).
- Visão clara: quanto tenho, quanto gastei, quanto posso gastar.
- Interface premium, fluida e animada (nível app de fintech).
- Contexto brasileiro: BRL, parcelamentos, fatura de cartão (fechamento/vencimento), Pix como forma de pagamento, locale `pt-BR`.

**Usuário único**, um dispositivo. Sem login. Proteção opcional por Face ID.

## 2. Stack

| Camada           | Escolha                                                                        | Observação                                                              |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Framework        | **Expo** (SDK estável mais recente) + **React Native** + **TypeScript strict** | Use `npx expo install` para versões compatíveis com o SDK               |
| Navegação        | **expo-router** (file-based)                                                   | Tabs + stack + modais nativos                                           |
| Banco local      | **expo-sqlite**                                                                | SQLite no dispositivo                                                   |
| ORM / migrations | **Drizzle ORM** (`drizzle-orm/expo-sqlite`) + `drizzle-kit`                    | Migrations versionadas, queries tipadas, `useLiveQuery` para UI reativa |
| "API local"      | **Camada de serviços + repositórios** (ver seção 4)                            | Não é servidor HTTP                                                     |
| Estado de UI     | **Zustand**                                                                    | Só estado de UI/preferências; dados vêm do SQLite                       |
| Formulários      | **react-hook-form** + **zod**                                                  | Validação compartilhada com a camada de serviço                         |
| Animações        | **react-native-reanimated** + **react-native-gesture-handler**                 | Base de tudo                                                            |
| Gráficos         | **@shopify/react-native-skia** + **victory-native** (XL)                       | Gráficos 60fps, com scrub por gesto                                     |
| Listas           | **@shopify/flash-list**                                                        | Performance em históricos longos                                        |
| Sheets           | **@gorhom/bottom-sheet**                                                       | Adicionar transação, filtros                                            |
| Feedback         | **expo-haptics**, **expo-blur**, **expo-linear-gradient**                      | Sensação nativa                                                         |
| Ícones           | **expo-symbols** (SF Symbols) ou **lucide-react-native**                       | Consistência                                                            |
| Segurança        | **expo-local-authentication**, **expo-secure-store**                           | Face ID, preferências sensíveis                                         |
| Backup           | **expo-file-system**, **expo-sharing**, **expo-document-picker**               | Exportar/importar `.db`/JSON/CSV                                        |
| Datas            | **date-fns** (locale `ptBR`)                                                   |                                                                         |
| Testes           | **jest-expo**, **@testing-library/react-native**                               | Prioridade: domínio e repositórios                                      |
| Build            | **EAS Build** + development build (`expo-dev-client`)                          | Skia/Reanimated pedem dev build, não só Expo Go                         |

### Sobre React Bits

**React Bits é web-only** (React DOM, CSS, WebGL/GSAP) e **não roda em React Native**. Use como _referência visual_ e recrie os efeitos com Reanimated + Skia. Equivalentes úteis no mundo RN:

- **Moti** (API declarativa sobre Reanimated) — transições, skeletons, entradas.
- **Reanimated** — layout animations, shared values, `withSpring`, `withTiming`, gestos.
- **Skia** — gradientes animados, shaders, blur, gráficos customizados, glow.
- **lottie-react-native** — animações pré-prontas (sucesso, empty states) quando fizer sentido.

## 3. Princípios de arquitetura

1. **Offline-first, local-only.** Nenhuma chamada de rede obrigatória.
2. **Dinheiro em centavos (`integer`)**, nunca `float`. Formatação só na borda da UI (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
3. **Datas**: `date` de transação como string local `YYYY-MM-DD` (evita bugs de fuso); `created_at`/`updated_at` como timestamp em ms (UTC).
4. **UI nunca fala com o Drizzle direto.** UI → hooks → services → repositories → DB.
5. **Regras de negócio em funções puras** (`domain/`), testáveis sem banco nem React.
6. **Migrations sempre versionadas**; nunca alterar migration já aplicada.
7. **Soft delete** (`deleted_at`) para transações/contas/categorias (permite desfazer e preserva histórico).
8. **Tudo tipado**, sem `any`. Schemas zod na entrada dos services.

## 4. Sobre a "API local"

Um app iOS não deve manter um servidor HTTP rodando (o sistema suspende o app em background e a complexidade não compensa). A "API local" será uma **camada interna com contrato bem definido**, que se comporta como uma API:

```
UI (screens/components)
   ↓ usa
hooks (useTransactions, useBudgets…)          ← TanStack-like, reativos (useLiveQuery)
   ↓ chama
services (TransactionService, BudgetService…)  ← "endpoints": validam com zod, aplicam regras, orquestram transações SQL
   ↓ chama
repositories (TransactionRepo…)                ← único lugar que conhece Drizzle/SQL
   ↓
SQLite (expo-sqlite)
```

- Cada service expõe métodos tipados (`create`, `update`, `remove`, `list(filters)`, `summary(period)`…) retornando `Result<T, AppError>` (ou lançando erros de domínio tipados — escolher um padrão e manter).
- Se um dia houver sync/backend, basta trocar a implementação dos repositories/services mantendo o contrato.

## 5. Modelo de dados (rascunho inicial — Drizzle)

Todos os `id` são `text` (UUID/ULID); valores monetários em `integer` (centavos).

- **accounts**: `id, name, type ('checking'|'savings'|'cash'|'credit_card'|'investment'), initial_balance_cents, color, icon, currency='BRL', archived_at, created_at`
- **credit_cards** (1:1 com account quando `type='credit_card'`): `account_id, limit_cents, closing_day, due_day, pay_from_account_id`
- **categories**: `id, name, kind ('expense'|'income'), icon, color, parent_id?, sort_order, archived_at`
- **transactions**: `id, account_id, category_id?, kind ('expense'|'income'|'transfer'), amount_cents (sempre positivo), date, description, notes?, payment_method? ('pix'|'debit'|'credit'|'cash'|'boleto'|'transfer'), transfer_account_id?, installment_group_id?, installment_number?, installment_total?, invoice_id?, recurring_id?, is_paid (bool), deleted_at, created_at, updated_at`
- **invoices** (faturas): `id, card_account_id, reference_month (YYYY-MM), closing_date, due_date, status ('open'|'closed'|'paid'), paid_at?, paid_from_account_id?`
- **budgets**: `id, category_id?, period ('monthly'), amount_cents, month (YYYY-MM)?` — orçamento por categoria/mês
- **recurring_rules**: `id, template (JSON da transação), frequency ('monthly'|'weekly'|'yearly'), day, start_date, end_date?, last_generated_date?`
- **goals**: `id, name, target_cents, saved_cents, deadline?, icon, color`
- **settings** (key/value) ou `expo-secure-store` para preferências: tema, biometria, moeda, primeiro dia do mês financeiro.

Índices: `transactions(date)`, `transactions(account_id, date)`, `transactions(category_id, date)`, `transactions(invoice_id)`.

Saldo de conta = `initial_balance_cents` + soma(receitas) − soma(despesas) ± transferências (calculado por query, não armazenado).

## 6. Funcionalidades

**MVP**

- Contas (corrente, poupança, dinheiro, cartão) e saldo total.
- Categorias padrão pt-BR pré-cadastradas (Mercado, Transporte, Moradia, Lazer, Saúde, Salário…) + CRUD.
- Transações: criar/editar/excluir (com desfazer), transferências entre contas, busca e filtros (período, categoria, conta, texto).
- Dashboard: saldo, receitas × despesas do mês, gastos por categoria, últimas transações.
- Orçamentos mensais por categoria com barra de progresso e alerta.
- Parcelamento (gera N lançamentos) e fatura de cartão (fechamento/vencimento, pagar fatura).
- Recorrências (assinaturas, aluguel, salário) geradas ao abrir o app.
- Exportar/importar backup (arquivo `.db` ou JSON) e exportar CSV.
- Face ID opcional + tela de bloqueio ao voltar do background.
- Dark/light mode automático.

**Depois do MVP**

- Metas de economia, relatórios comparativos mês a mês, widget iOS, atalhos Siri/App Intents, notificações locais (vencimento de fatura, orçamento estourado), import de OFX/CSV de banco.

## 7. Design & UX (diretrizes)

**Direção**: limpo, moderno, "fintech premium". Muito espaço em branco, tipografia forte para números, cor usada com intenção (verde = entrada, vermelho/coral = saída, acento da marca para ações).

- **Design tokens** em `src/theme/` (cores light/dark, espaçamento em grid de 4/8pt, raios, tipografia, sombras, durações/easings de animação). Nenhum valor mágico solto nos componentes.
- **Tipografia**: fonte do sistema (SF Pro) ou Inter; números **tabulares** (`fontVariant: ['tabular-nums']`); suportar **Dynamic Type**.
- **Componentes base** em `src/ui/`: `Screen`, `Text`, `Button`, `IconButton`, `Card`, `ListItem`, `Chip`, `Sheet`, `AmountText`, `Skeleton`, `EmptyState`, `ProgressBar`, `NumericKeypad`.
- **Micro-interações**:
  - Contador animado no saldo (números "rolando").
  - Entrada de listas com stagger; pressables com escala + haptic leve.
  - **Swipe actions** nas transações (excluir/editar) com haptics.
  - **Bottom sheet** para nova transação com **teclado numérico customizado** (valor em destaque, categoria em chips, data rápida "hoje/ontem").
  - FAB central na tab bar para lançamento rápido.
  - Gráficos com **scrub por gesto** (tooltip seguindo o dedo) e transição suave ao trocar período.
  - Skeletons no carregamento; empty states ilustrados com CTA.
  - Transições compartilhadas/entrada de telas fluidas; toast com "Desfazer".
- **Performance**: animações no UI thread (worklets), 60fps; `FlashList` para listas; evitar re-render (memo + seletores do Zustand).
- **Acessibilidade**: VoiceOver (labels/hints), contraste AA, alvos ≥ 44pt, respeitar **Reduce Motion** (desligar/atenuar animações).
- **Idioma**: pt-BR (strings centralizadas em `src/i18n/` para facilitar futura tradução).

## 8. Estrutura de pastas sugerida

```
app/                      # expo-router (rotas)
  (tabs)/
    index.tsx             # Dashboard
    transactions.tsx
    budgets.tsx
    more.tsx
  transaction/[id].tsx
  _layout.tsx
src/
  db/
    client.ts             # abre expo-sqlite + drizzle
    schema/               # tabelas Drizzle
    migrations/           # geradas pelo drizzle-kit
    seed.ts               # categorias/contas padrão
  domain/                 # regras puras (money, installments, invoices, budgets)
  repositories/
  services/               # "API local"
  hooks/
  stores/                 # zustand (UI/prefs)
  ui/                     # design system
  features/               # telas/componentes por feature (dashboard, transactions, budgets…)
  theme/
  i18n/
  utils/
__tests__/
docs/
```

## 9. Qualidade

- ESLint + Prettier + `tsc --noEmit` obrigatórios no CI/pre-commit (husky + lint-staged).
- Testes: `domain/` (100% das regras de dinheiro, parcelas, fatura, orçamento) e `services/` (integração com SQLite em memória/better-sqlite3 via driver de teste).
- Conventional Commits; um commit por tarefa lógica.
- Sem `console.log` em código final; usar logger simples.
- Tratamento de erros: nunca engolir exceções; mostrar mensagem amigável + log.

## 10. Roadmap em baby steps

> Cada fase = 1 PR/commit coeso. **Não avance sem cumprir o "Pronto quando".**

### Fase 0 — Fundação

- Criar projeto: `npx create-expo-app` (template TypeScript + expo-router), configurar `tsconfig` strict, alias `@/`.
- ESLint, Prettier, husky, jest-expo.
- Instalar dependências base (Reanimated, Gesture Handler, Skia, FlashList, bottom-sheet, haptics, etc.) com `npx expo install`.
- Configurar `expo-dev-client` e rodar no iPhone/simulador.
- **Pronto quando**: app abre no iOS com tab bar vazia, lint/typecheck/test passam.

### Fase 1 — Design system

- Tokens (cores, tipografia, espaçamento, raios), tema light/dark.
- Componentes base (`Screen`, `Text`, `Button`, `Card`, `AmountText`, `Skeleton`, `EmptyState`).
- Tela de catálogo (`/dev/ui`) para visualizar componentes.
- **Pronto quando**: componentes funcionam em light/dark, com Dynamic Type e feedback tátil.

### Fase 2 — Banco e camada de dados

- Schema Drizzle, migrations, `useMigrations` no boot com tela de loading/erro.
- Repositories + services (contas, categorias, transações) com validação zod.
- Seed de categorias e conta padrão (apenas no primeiro uso).
- Testes de domínio e services.
- **Pronto quando**: é possível criar/listar/editar/excluir transações via service, com testes verdes e dados persistindo após fechar o app.

### Fase 3 — Transações (core)

- Lista agrupada por dia (FlashList), busca, filtros.
- Sheet "Nova transação" com teclado numérico customizado, categorias, conta, data.
- Editar/excluir com swipe + desfazer; transferências entre contas.
- **Pronto quando**: fluxo completo de lançamento em < 5s, animado e com haptics.

### Fase 4 — Dashboard

- Saldo total com contador animado, receitas × despesas, gastos por categoria (gráfico Skia/Victory com scrub), últimas transações.
- Seletor de período (mês atual, anterior, customizado).
- **Pronto quando**: números batem com os testes de agregação e a tela renderiza a 60fps.

### Fase 5 — Orçamentos e metas

- Orçamento mensal por categoria, barra de progresso animada, estado "estourado".
- (Opcional) metas de economia.
- **Pronto quando**: orçamento reflete os lançamentos em tempo real (live query).

### Fase 6 — Cartão, parcelas e recorrências

- Cartão de crédito com fechamento/vencimento, faturas, pagar fatura.
- Compras parceladas (gera lançamentos e vincula à fatura correta).
- Recorrências geradas ao abrir o app (idempotente).
- **Pronto quando**: casos de borda cobertos por testes (compra no dia do fechamento, parcelas em virada de ano, mês com 28/29/30/31 dias).

### Fase 7 — Segurança e backup

- Face ID (`expo-local-authentication`) + bloqueio ao ir para background.
- Exportar/importar backup, exportar CSV (share sheet).
- Tela de configurações (tema, biometria, dia de início do mês).
- **Pronto quando**: restaurar um backup em instalação limpa recupera 100% dos dados.

### Fase 8 — Polimento e release

- Revisão de animações, acessibilidade (VoiceOver, Reduce Motion), ícone, splash, empty states.
- Otimização de performance (profile com Flipper/React DevTools/Instruments).
- Build com **EAS** e distribuição via **TestFlight** (requer Apple Developer Program) ou instalação direta no aparelho via Xcode (certificado gratuito expira em 7 dias).
- **Pronto quando**: build de produção estável, sem warnings, testado em aparelho real.

## 11. Regras para o agente (copiar para `.github/copilot-instructions.md`)

```markdown
# Instruções para o Copilot — App Finanças (Expo/iOS)

Você é um engenheiro sênior de React Native/Expo. Leia `docs/PROJECT_BRIEF.md` antes de qualquer tarefa.

## Como trabalhar

- Execute SOMENTE a fase pedida do roadmap. Não antecipe fases futuras.
- Antes de codar, liste um plano curto. Depois implemente em commits pequenos.
- Ao final: rode `npm run lint`, `npx tsc --noEmit` e `npm test`; corrija tudo; resuma o que mudou e o que falta; PARE e aguarde validação.
- Se algo estiver ambíguo, assuma a opção mais simples e registre a decisão em `docs/DECISIONS.md`. Pergunte apenas se for bloqueante.

## Regras de código

- TypeScript strict, sem `any`, sem `@ts-ignore` sem justificativa.
- Dinheiro SEMPRE em centavos (integer). Nunca float.
- Datas de transação como `YYYY-MM-DD` (string local); timestamps em ms UTC.
- UI → hooks → services → repositories → DB. A UI nunca importa Drizzle.
- Regras de negócio em `src/domain` (funções puras + testes).
- Validação de entrada com zod nos services.
- Migrations via drizzle-kit; nunca editar migration já aplicada.
- Instale pacotes com `npx expo install` para garantir compatibilidade com o SDK.
- Animações com Reanimated (worklets, UI thread). Respeitar Reduce Motion.
- Listas longas com FlashList. Evitar re-renders desnecessários.
- Estilos somente via tokens de `src/theme`; sem cores/tamanhos mágicos.
- Textos em pt-BR centralizados em `src/i18n`.
- Acessibilidade: labels, hints, alvos ≥ 44pt, Dynamic Type.
- NÃO usar bibliotecas web-only (ex.: React Bits, GSAP, DOM APIs). Verifique compatibilidade com React Native/Expo antes de adicionar dependência.
- NÃO criar servidor HTTP no app; a "API local" é a camada services/repositories.
- Testes para toda regra de domínio e service novo.

## Commits

- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`).
```

## 12. Primeiro prompt sugerido para o Copilot

```
Leia docs/PROJECT_BRIEF.md e .github/copilot-instructions.md.
Execute a FASE 0 (Fundação) do roadmap. Mostre primeiro o plano, depois implemente.
Ao terminar, rode lint, typecheck e testes, resuma o resultado e pare.
```

Depois de validar cada fase, use: `Fase N concluída e validada. Execute a FASE N+1.`
