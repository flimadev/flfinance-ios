# Matriz de paridade funcional

Auditoria do estado do app em 2 de novembro de 2026. A referência é usada
somente para comparar funcionalidades e fluxos; a marca, os textos, os ícones
e a identidade visual permanecem próprios do FlFinance.

## Funções-alvo

| Função                                        | Situação atual | Evidência / lacuna                                                                                                                                                                              | Fase           |
| --------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Cartões de crédito e faturas                  | Parcial        | Cadastro de cartões, vencimento, parcelas, faturas e pagamento integral implementados; limite disponível, parcelas futuras consolidadas, melhor dia de compra e pagamento parcial ainda faltam. | 6, 15          |
| Orçamentos                                    | Existe         | Limite mensal por categoria, acompanhamento de gastos e estado excedido implementados.                                                                                                          | 5              |
| Metas de economia                             | Falta          | Não existe cadastro de metas de economia; eram opcionais na fase de orçamentos.                                                                                                                 | 14             |
| Objetivos financeiros com prazo e aportes     | Falta          | Não existe fluxo para criar objetivos, registrar aportes ou estimar contribuição mensal.                                                                                                        | 14             |
| Relatórios e gráficos avançados               | Parcial        | Dashboard tem saldo, receitas, despesas, período customizado e gastos por categoria; faltam relatórios combináveis, evolução, fluxo projetado e drill-down de relatórios.                       | 12             |
| Categorias                                    | Existe         | Gestão em Ajustes: criar/editar ícone e cor, reordenar por nível e arquivar/restaurar a árvore sem apagar histórico.                                                                            | 10             |
| Subcategorias                                 | Existe         | Categorias filhas são exibidas em árvore e validadas contra ciclos e tipos incompatíveis.                                                                                                       | 10             |
| Tags                                          | Existe         | Tabelas `tags`/`transaction_tags`, seleção por chips no formulário e filtro na lista de lançamentos.                                                                                            | 10             |
| Alertas e contas a pagar                      | Parcial        | A tela Dívidas consolida pendências, parcelas, faturas e recorrências e permite registrar pagamentos; faltam notificações locais configuráveis e calendário de vencimentos.                     | 11             |
| Anexos e fotos em lançamentos                 | Existe         | Biblioteca/câmera, armazenamento no diretório de documentos, visualização em tela cheia e inclusão de conteúdo no backup v2.                                                                    | 10             |
| Importação de extratos OFX                    | Falta          | Não há leitor nem fluxo de pré-visualização/importação OFX.                                                                                                                                     | 13             |
| Importação de CSV/Excel                       | Falta          | O CSV pode ser exportado, mas arquivos não são importados; não há mapeamento de colunas nem suporte a Excel.                                                                                    | 13             |
| Conciliação                                   | Falta          | Lançamentos não possuem estado conciliado nem comparação de saldos.                                                                                                                             | 13             |
| Exportação CSV                                | Existe         | Exportação de lançamentos CSV com compartilhamento está disponível nos Ajustes.                                                                                                                 | 7              |
| Exportação PDF                                | Falta          | Não há geração de relatórios ou documentos PDF.                                                                                                                                                 | 12             |
| Exportação Excel (.xlsx)                      | Falta          | Não há arquivo Excel nem decisão de compatibilidade de biblioteca com React Native/Hermes.                                                                                                      | 12             |
| Calculadora de juros compostos                | Falta          | Não há calculadoras financeiras.                                                                                                                                                                | 16             |
| Simulador de investimento                     | Falta          | Não há simulador de aportes/rentabilidade.                                                                                                                                                      | 16             |
| Calculadora de porcentagem                    | Falta          | Não há calculadoras financeiras.                                                                                                                                                                | 16             |
| Contador de dias                              | Falta          | Não há calculadoras financeiras.                                                                                                                                                                | 16             |
| Calculadora de salário líquido                | Falta          | Não há tabelas anuais de INSS/IRRF nem cálculo de salário líquido.                                                                                                                              | 16             |
| Calculadora de férias                         | Falta          | Não há cálculo de férias nem tabelas oficiais versionadas.                                                                                                                                      | 16             |
| Calculadora de rescisão                       | Falta          | Não há cálculo de rescisão nem tabelas oficiais versionadas.                                                                                                                                    | 16             |
| Calculadora de hora extra                     | Falta          | Não há calculadoras financeiras.                                                                                                                                                                | 16             |
| Integração bancária automática (Open Finance) | Fora de escopo | Exigiria backend e credenciais; importação local de OFX/CSV é a alternativa definida.                                                                                                           | Fora de escopo |
| Leitura de SMS                                | Fora de escopo | O iOS não permite que o app leia SMS de outros apps.                                                                                                                                            | Fora de escopo |
| Sincronização em nuvem / multi-dispositivo    | Fora de escopo | O produto é local e privado; backup manual existente é a alternativa.                                                                                                                           | Fora de escopo |
| Marketplace, blog e comparadores comerciais   | Fora de escopo | Conteúdo comercial, afiliados e marketplace não fazem parte do produto.                                                                                                                         | Fora de escopo |
| Consultoria financeira e planos pagos         | Fora de escopo | Serviços profissionais e monetização por planos não fazem parte do produto.                                                                                                                     | Fora de escopo |

## Prioridade aprovada para execução

O usuário autorizou executar todas as fases deste roadmap em sequência, sem
interrupção entre fases, avançando somente após concluir e validar a fase atual.
A ordem aprovada é a ordem numerada do prompt:

1. Fase 10 — categorias avançadas, tags e anexos.
2. Fase 11 — contas a pagar/receber e alertas.
3. Fase 12 — relatórios avançados e exportação.
4. Fase 13 — importação e conciliação.
5. Fase 14 — planejamento e objetivos.
6. Fase 15 — cartões avançado.
7. Fase 16 — calculadoras.
8. Fase 17 — polimento final de paridade.

O build de produção e os testes em aparelho real dependem de identidade iOS,
credenciais e equipamento do usuário e continuam sujeitos a esses requisitos.
