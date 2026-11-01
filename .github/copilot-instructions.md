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
