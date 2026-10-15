# Programação v2 — objetivo como configuração

Status: **implementado (etapa B)**. Tipos em `src/programacao/types.ts`; objetivos em `src/programacao/goals/`;
auditoria permanente em `tests/programacao/`.

## Desvios em relação aos rascunhos aprovados na etapa A
- Força e Powerbuilding: o slot principal **não** pede `massa: grande` (senão supino e desenvolvimento deixavam de ser principais).
- Gasto energético: séries/semana rebalanceadas para priorizar pernas e costas (peito 6–12, ombros 6–10, costas 14–20);
  o circuito do full body (2–3x) usa `massa: qualquer` para cobrir o corpo todo.
- Hipertrofia: isoladores em 3×8–12 com 90 s (a especificação fixa 6–12 reps e 90 s–2 min para tudo).
- `ExercisePrescription.reps` é opcional (condicionamento é por tempo, `workSec`).
- Dupla progressão: uma semana de deload zera a contagem de falhas.
- Rótulo das semanas na tela é "Sem. N" (o "S" já é usado pelos dias Superiores).

## Problema que resolve
Hoje o objetivo só troca números de séries/reps/descanso; a escolha de exercícios, a estrutura do dia e a
progressão são iguais para todos (auditoria: Força e Hipertrofia geravam a mesma lista de exercícios).

## Peças

| Peça | O que é | Quem define |
|---|---|---|
| `GoalProfile` | prescrição por **papel**, intensidade (%1RM/RPE), % de compostos, séries/semana por grupo, estrutura do dia (slots), progressão por papel, periodização, avisos, texto "por que" | 1 arquivo por objetivo em `goals/` |
| Template de divisão | quais **padrões de movimento** cada dia pede, em ordem de prioridade (ex.: Superior = empurrar horizontal, puxar horizontal, empurrar vertical, puxar vertical, braços) | gerador (já existe hoje, por split) |
| `ExerciseMeta` | papel possível, unilateral, massa muscular, `adequadoBaixasReps` | catálogo curado |
| `Program` | Program → Block → Week → Day → ExerciseGroup → ExercisePrescription | saída do gerador |

## Como o gerador combina (etapa B)
1. Escolhe a estrutura do dia: `dayStructureRules` que casar com o perfil, senão `dayStructure`. Uma regra pode forçar o split (gasto energético 2–3x → full body em circuito).
2. Para cada dia do split, percorre os slots do objetivo e preenche cada papel com o padrão de movimento de maior prioridade ainda não atendido, respeitando:
   papel (`principal` só em `principal`/`composto`), equipamento/barra, nível (`avancado`), e **`adequadoBaixasReps`**: se a faixa do papel tem mínimo < 6, só entram exercícios marcados `true` (resolve o afundo em 4–6).
3. Aplica a prescrição do papel (+ `levelOverrides`), resolvendo faixas para valores concretos.
4. Calcula séries/semana por grupo e ajusta até caber em `weeklySets` (± séries; adiciona/remove o slot `optional`), depois confere `compoundShare`. Reporta o volume final em `Program.weeklyVolume`.
5. Monta as semanas pela periodização e gera o texto "por que este treino" (template + expectativa), que passa pela varredura de promessas.

## Papéis no catálogo
- `principal`: agachamento livre/frontal, supino reto/inclinado com barra, terra (convencional, sumô, romeno, trap bar), desenvolvimento com barra, remada curvada/Pendlay. `adequadoBaixasReps: true`.
- `composto`: demais multiarticulares (halteres, máquinas, puxadas, barra fixa, leg press, hack). Bilaterais estáveis: `adequadoBaixasReps: true`; unilaterais (afundo, búlgaro, serrote, step-up, pistol): `false`.
- `isolador`: monoarticulares. `adequadoBaixasReps: false`.
- `condicionamento` (novo no catálogo): burpee, mountain climber, polichinelo (jack jump), pular corda, kettlebell swing, thruster, bike, caminhada do fazendeiro — escolhidos por equipamento.
- `massaMuscular`: grande = pernas e costas; média = peito e ombros; pequena = braços, panturrilha, abdômen.

## Progressão (uma estratégia por regra)

| Regra | Usada em | Comportamento |
|---|---|---|
| `carga_por_rpe` | Força (principal/composto), Powerbuilding (principal) | todas as reps feitas e RPE da última série ≤ 7 → sobe 2,5/5 kg; RPE até 9 → mantém; acima ou reps faltando → reduz 5%. Sem RPE informado → usa reps (topo = subir). |
| `dupla_progressao` | Hipertrofia, acessórios | regra atual (topo em todas → sobe; 2 sessões sem progresso → deload 10%) |
| `densidade` | Gasto energético | 1º reduz descanso 15 s até o piso; 2º +1 série; 3º sobe carga e volta o descanso |
| `reps_depois_carga` | Resistência | sobe reps até o topo (ex.: 25); aí sobe carga e volta ao piso (15) |

Em semana de deload, toda estratégia devolve a prescrição de deload e não conta falha.

## Periodização
- **Bloco 3+1** (Força, Powerbuilding): rampa de %1RM do principal (80 → 85 → 90) e semana 4 com 60% das séries e 85% da carga.
- **Reativo** (Hipertrofia, Gasto, Resistência): deload por estagnação (como hoje) + deload planejado a cada 6 semanas.
- O app não conhece o 1RM do usuário: o %1RM aparece como referência ao lado do RPE alvo, e a carga sugerida vem do
  histórico de sessões (estratégia de progressão). **Pendente:** converter %1RM em kg a partir do 1RM estimado (Epley)
  que o histórico já calcula.

## Sessão
- `SetLog` ganha `rpe` (opcional, 6–10 em 0,5) e `completedAt` (mede descanso real → densidade).
- `SessionV2` ganha `programId`, `weekIndex`, `weekKind` e `durationSec`.
- Superset/circuito: a tela agrupa os itens do grupo e o descanso conta depois da volta.

## Migração (etapa B)
- **Dexie v4**: nova tabela `programs`; cada `Routine` existente vira `Program` com 1 bloco de 1 semana (periodização reativa), objetivo mapeado (`forca`/`hipertrofia`), `explanation` gerada. `routines` fica só para leitura até o próximo backup.
- Sessões: `rpe: null` e `completedAt` ausente em séries antigas; `role` vem do catálogo; `groupIndex`/`groupKind` = posição/`simples`; `programId` = id migrado; `weekIndex` = 1.
- **Backup formato 2**; o import aceita formato 1 e aplica a mesma migração. Testes: v1 → import → export v2 → import → igual (ida e volta), e v2 → v2.

## Decisões em aberto (para aprovação)
1. Faixas de séries/semana de Força e Gasto: os números dos rascunhos são meus (a especificação só fixou Hipertrofia 10–20).
2. RPE é **opcional** na sessão; sem ele, `carga_por_rpe` cai para reps. Alternativa: tornar obrigatório em Força.
3. Finisher em 2 de 4 dias no upper/lower (perWeek 1–2 → o gerador usa 2 com 4+ dias, 1 com 2–3).
4. Exercícios de condicionamento entram no catálogo curado (≈10 novos itens).
