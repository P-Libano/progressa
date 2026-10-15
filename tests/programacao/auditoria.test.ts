/**
 * Auditoria de prescrição por objetivo (os 20 itens pedidos + o achado do afundo em 4–6 reps).
 * Perfil-base: intermediário, academia completa, 4x/semana, superior/inferior.
 * Imprime as 5 rotinas, a tabela comparativa e um PASS/FAIL com números por item.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { findUnfoundedClaims } from '../../src/lib/claims'
import { GOALS } from '../../src/programacao/goals'
import { META_BY_ID } from '../../src/programacao/meta'
import { allWeeks } from '../../src/programacao/program'
import { suggestNextV2 } from '../../src/programacao/progression'
import { GOAL_IDS, type ExerciseResultV2, type GoalId, type Program, type ProgressionContext } from '../../src/programacao/types'
import { BASE, equipmentOf, firstLoadWeek, fmtR, gen, isMainLift, nameOf, stats, strengthItems } from './helpers'

const programs = Object.fromEntries(GOAL_IDS.map((g) => [g, gen({ goal: g })])) as Record<GoalId, Program>
const report: string[] = []
const check = (n: string, label: string, ok: boolean, numbers: string) => {
  report.push(`[${ok ? 'PASS' : 'FAIL'}] ${n.padStart(2)}. ${label} → ${numbers}`)
  return ok
}

afterAll(() => {
  console.log('\n================ VERIFICAÇÕES ================\n' + report.join('\n'))
})

describe('rotinas e tabela comparativa', () => {
  it('imprime as 5 rotinas (dia → exercício → séries x reps → descanso → %1RM/RPE)', () => {
    for (const g of GOAL_IDS) {
      const p = programs[g]
      const lines = [`\n================ ${GOALS[g].nome} (${g}) — semanas ${allWeeks(p).map((w) => (w.kind === 'deload' ? 'D' : 'C')).join('')} ================`]
      for (const d of firstLoadWeek(p).days) {
        lines.push(`${d.key} — ${d.name}`)
        d.groups.forEach((gr, gi) => {
          const tag = gr.kind === 'simples' ? '' : ` [${gr.kind}${gr.rounds ? `, ${gr.rounds} voltas` : ''}${gr.durationMin ? `, ${gr.durationMin} min` : ''}]`
          gr.items.forEach((i, ii) => {
            const label = gr.kind === 'simples' ? '  ' : `  ${String.fromCharCode(65 + gi)}${ii + 1} `
            const pres = i.workSec ? `${i.sets}x${i.workSec}s` : `${i.sets}x${fmtR(i.reps)}`
            const intens = [i.pct1rm && `${fmtR(i.pct1rm, '%')} 1RM`, i.rpe && `RPE ${fmtR(i.rpe)}`].filter(Boolean).join(' · ') || '—'
            lines.push(`${label}${nameOf(i.exerciseId).padEnd(42)} ${pres.padEnd(9)} desc ${String(i.restSec).padStart(3)}s  ${intens.padEnd(24)} (${i.role})${ii === 0 ? tag : ''}`)
          })
        })
      }
      lines.push(`por que este treino: ${p.explanation}`)
      if (p.warnings.length) lines.push(`avisos: ${p.warnings.join(' | ')}`)
      console.log(lines.join('\n'))
    }
  })

  it('tabela comparativa', () => {
    const rows = [
      '| Objetivo | Principal | Compostos | Isoladores | Descanso médio | Séries/sem | % compostos | % compostos grande massa | Supersets/circuitos | Finisher/sem | Progressão (principal/composto) | Periodização |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ]
    for (const g of GOAL_IDS) {
      const p = programs[g]
      const s = stats(p)
      const w = strengthItems(firstLoadWeek(p))
      const by = (role: string) => w.find((i) => i.role === role)
      const cell = (role: string) => {
        const i = by(role)
        return i ? `${i.sets}x${fmtR(i.reps)} @${i.restSec}s${i.pct1rm ? ` ${fmtR(i.pct1rm, '%')}` : ''}${i.rpe ? ` RPE ${fmtR(i.rpe)}` : ''}` : '—'
      }
      const pr = GOALS[g].progression
      const per = GOALS[g].periodization
      rows.push(
        `| ${GOALS[g].nome} | ${cell('principal')} | ${cell('composto')} | ${cell('isolador')} | ${s.avgRest}s | ${s.sets} | ${s.compound}% | ${s.compoundBig}% | ${s.grouped} | ${s.finishers} | ${(pr.principal ?? pr.composto)!.rule} | ${per.kind === 'bloco' ? `bloco ${per.semanasCarga}+${per.semanasDeload}` : `reativo + deload a cada ${per.deloadPlanejadoACadaSemanas} sem.`} |`,
      )
    }
    console.log('\n================ TABELA COMPARATIVA ================\n' + rows.join('\n'))
  })
})

describe('auditoria — 20 itens', () => {
  const s = Object.fromEntries(GOAL_IDS.map((g) => [g, stats(programs[g])])) as Record<GoalId, ReturnType<typeof stats>>

  it('1. prescrições distintas entre os 5 objetivos', () => {
    const sig = (g: GoalId) =>
      JSON.stringify([...new Set(strengthItems(firstLoadWeek(programs[g])).map((i) => `${i.role}:${i.sets}x${fmtR(i.reps)}@${i.restSec}`))].sort())
    const sigs = GOAL_IDS.map(sig)
    const reps = GOAL_IDS.map((g) => fmtR(strengthItems(firstLoadWeek(programs[g]))[0].reps))
    const ok = new Set(sigs).size === 5 && new Set(GOAL_IDS.map((g) => s[g].avgRest)).size === 5
    expect(check('1', 'faixas/séries/descanso distintos entre os 5 objetivos', ok, `${new Set(sigs).size} assinaturas distintas; 1º exercício: ${GOAL_IDS.map((g, i) => `${g}=${reps[i]}`).join(', ')}; descanso médio: ${GOAL_IDS.map((g) => `${g}=${s[g].avgRest}s`).join(', ')}`)).toBe(true)
  })

  it('2. Força: ≥70% do volume em compostos', () => {
    expect(check('2', 'Força ≥70% em compostos', s.forca.compound >= 70, `${s.forca.compound}%`)).toBe(true)
  })

  it('3. Hipertrofia: 40–70% em compostos', () => {
    expect(check('3', 'Hipertrofia 40–70% em compostos', s.hipertrofia.compound >= 40 && s.hipertrofia.compound <= 70, `${s.hipertrofia.compound}%`)).toBe(true)
  })

  it('4. Gasto energético: ≥60% em compostos de grande massa', () => {
    expect(check('4', 'Gasto ≥60% em compostos de grande massa (pernas/costas)', s.gasto_energetico.compoundBig >= 60, `${s.gasto_energetico.compoundBig}%`)).toBe(true)
  })

  it('5. Força: nenhuma série acima de 6 reps nos 5 compostos principais', () => {
    const mains = strengthItems(firstLoadWeek(programs.forca)).filter(isMainLift)
    const over = mains.filter((i) => (i.reps?.max ?? 0) > 6)
    const names = [...new Set(mains.map((i) => `${nameOf(i.exerciseId)} ${i.sets}x${fmtR(i.reps)}`))]
    expect(check('5', 'Força: nenhum principal acima de 6 reps', mains.length >= 5 && over.length === 0, `${over.length} acima; ${mains.length} ocorrências: ${names.join('; ')}`)).toBe(true)
  })

  it('6. Força: descanso de 3–5 min nos principais', () => {
    const rests = [...new Set(strengthItems(firstLoadWeek(programs.forca)).filter((i) => i.role === 'principal').map((i) => i.restSec))]
    expect(check('6', 'Força: descanso 180–300s nos principais', rests.every((r) => r >= 180 && r <= 300), `${rests.join('/')}s`)).toBe(true)
  })

  it('7. Força: poucos isoladores e só no fim', () => {
    const w = firstLoadWeek(programs.forca)
    const order = w.days.every((d) => {
      const it = d.groups.flatMap((g) => g.items)
      const f = it.findIndex((i) => i.role === 'isolador')
      return f === -1 || it.slice(f).every((i) => i.role === 'isolador')
    })
    const iso = strengthItems(w).filter((i) => i.role === 'isolador')
    const isoSets = iso.reduce((a, i) => a + i.sets, 0)
    const perDay = Math.max(...w.days.map((d) => d.groups.flatMap((g) => g.items).filter((i) => i.role === 'isolador').length))
    expect(check('7', 'Força: isoladores no fim e ≤1 por dia', order && perDay <= 1, `${iso.length} isoladores (${isoSets} de ${s.forca.sets} séries), máx ${perDay}/dia, ordem ${order ? 'ok' : 'errada'}`)).toBe(true)
  })

  it('8. Força: periodização 3+1 (carga sobe nas semanas 1–3, semana 4 deload)', () => {
    const ws = allWeeks(programs.forca)
    const pct = ws.map((w) => strengthItems(w).find((i) => i.role === 'principal')?.pct1rm?.min ?? 0)
    const sets = ws.map((w) => strengthItems(w).reduce((a, i) => a + i.sets, 0))
    const ok = ws.map((w) => w.kind).join() === 'carga,carga,carga,deload' && pct[0] < pct[1] && pct[1] < pct[2] && pct[3] < pct[0] && sets[3] < sets[0]
    expect(check('8', 'Força: bloco 3+1 com rampa', ok, `semanas ${ws.map((w) => w.kind).join('/')}; %1RM principal ${pct.join(' → ')}; séries ${sets.join(' → ')}`)).toBe(true)
  })

  it('9. Gasto energético: descanso médio < 75 s', () => {
    expect(check('9', 'Gasto: descanso médio <75s', s.gasto_energetico.avgRest < 75, `${s.gasto_energetico.avgRest}s`)).toBe(true)
  })

  it('10. Gasto energético: ≥1 bloco de condicionamento por semana (e supersets/circuitos)', () => {
    const ok = s.gasto_energetico.finishers >= 1 && s.gasto_energetico.grouped >= 1
    expect(check('10', 'Gasto: finisher e supersets/circuitos', ok, `${s.gasto_energetico.finishers} finisher(s), ${s.gasto_energetico.grouped} superset(s)/circuito(s) na semana`)).toBe(true)
  })

  it('11. volume semanal por grupo dentro da faixa de cada objetivo', () => {
    const out: string[] = []
    const lines: string[] = []
    for (const g of GOAL_IDS) {
      const targets = GOALS[g].weeklySets
      const row = Object.entries(targets).map(([grp, r]) => {
        const v = s[g].volume[grp as keyof typeof targets] ?? 0
        if (v < r!.min || v > r!.max) out.push(`${g}.${grp}=${v} (${r!.min}–${r!.max})`)
        return `${grp}=${v}/${r!.min}–${r!.max}`
      })
      lines.push(`${g}: ${row.join(', ')}`)
    }
    console.log('volume por grupo (séries/semana / faixa):\n  ' + lines.join('\n  '))
    expect(check('11', 'volume por grupo dentro da faixa (5 objetivos)', out.length === 0, out.length ? `fora: ${out.join('; ')}` : 'todos dentro')).toBe(true)
  })

  const res = (weight: number, reps: number[], rpe: number | null, restSec: number, sets = reps.length): ExerciseResultV2 => ({
    date: 1,
    weekKind: 'carga',
    prescription: { exerciseId: 'x', role: 'principal', group: 'peito', sets, reps: { min: 3, max: 5 }, restSec },
    sets: reps.map((r) => ({ weight, reps: r, rpe, restBeforeSec: null })),
  })
  const ctxFor = (g: GoalId, role: ProgressionContext['role'], p: ProgressionContext['prescription'], h: ExerciseResultV2[]): ProgressionContext => ({
    goal: GOALS[g],
    role,
    group: 'peito',
    prescription: p,
    history: h,
    weekKind: 'carga',
    bodyweight: false,
  })

  it('12. regra de progressão diferente por objetivo', () => {
    const fp = { exerciseId: 'x', role: 'principal' as const, group: 'peito' as const, sets: 5, reps: { min: 3, max: 5 }, restSec: 240 }
    const forcaRpe7 = suggestNextV2(ctxFor('forca', 'principal', fp, [res(100, [5, 5, 5, 5, 5], 7, 240)]))
    const forcaRpe9 = suggestNextV2(ctxFor('forca', 'principal', fp, [res(100, [5, 5, 5, 5, 5], 9, 240)]))
    const hp = { exerciseId: 'x', role: 'composto' as const, group: 'peito' as const, sets: 4, reps: { min: 8, max: 12 }, restSec: 105 }
    const hip = suggestNextV2(ctxFor('hipertrofia', 'composto', hp, [{ ...res(60, [12, 12, 12, 12], null, 105), prescription: hp }]))
    const gp = { exerciseId: 'x', role: 'composto' as const, group: 'peito' as const, sets: 4, reps: { min: 10, max: 15 }, restSec: 60 }
    const gas = suggestNextV2(ctxFor('gasto_energetico', 'composto', gp, [{ ...res(40, [15, 15, 15, 15], null, 60), prescription: gp }]))
    const ok =
      forcaRpe7.kind === 'increase' && forcaRpe7.weight === 102.5 && forcaRpe9.kind === 'keep' && hip.kind === 'increase' && hip.weight === 62.5 && gas.kind === 'less_rest' && gas.weight === 40
    expect(
      check(
        '12',
        'progressão: Força por RPE, Hipertrofia dupla, Gasto densidade',
        ok,
        `forca RPE7 → ${forcaRpe7.kind} ${forcaRpe7.weight}kg; forca RPE9 → ${forcaRpe9.kind} ${forcaRpe9.weight}kg; hipertrofia topo → ${hip.kind} ${hip.weight}kg; gasto topo → ${gas.kind} ${gas.restSec}s @${gas.weight}kg`,
      ),
    ).toBe(true)
  })

  it('13. Gasto energético: densidade antes de carga (descanso → série → carga)', () => {
    const gp = { exerciseId: 'x', role: 'composto' as const, group: 'peito' as const, sets: 4, reps: { min: 10, max: 15 }, restSec: 75 }
    const seq: string[] = []
    let cur = { ...gp }
    for (let i = 0; i < 6; i++) {
      const sug = suggestNextV2(ctxFor('gasto_energetico', 'composto', gp, [{ ...res(40, Array(cur.sets).fill(15), null, cur.restSec), prescription: cur }]))
      seq.push(`${sug.kind}(${sug.restSec}s,${sug.sets}s,${sug.weight}kg)`)
      cur = { ...cur, restSec: sug.restSec ?? cur.restSec, sets: sug.sets ?? cur.sets }
      if (sug.kind === 'increase') break
    }
    const kinds = seq.map((x) => x.split('(')[0])
    const ok = kinds.join() === 'less_rest,less_rest,add_set,increase'
    expect(check('13', 'Gasto: menos descanso → +1 série → carga', ok, seq.join(' → '))).toBe(true)
  })

  it('14. Iniciante + Força: sem singles/doubles', () => {
    const p = gen({ goal: 'forca', level: 'iniciante' })
    const min = Math.min(...strengthItems(firstLoadWeek(p)).map((i) => i.reps?.min ?? 99))
    expect(check('14', 'Iniciante + Força: menor rep prescrita ≥ 3', min >= 3, `menor rep = ${min}`)).toBe(true)
  })

  it('15. Iniciante + Força: intensidade reduzida (≈5x5 a ~75%)', () => {
    const p = gen({ goal: 'forca', level: 'iniciante' })
    const pr = allWeeks(p)
      .filter((w) => w.kind === 'carga')
      .map((w) => strengthItems(w).find((i) => i.role === 'principal')!)
    const ok = pr.every((i) => i.sets === 5 && i.reps?.min === 5 && i.reps?.max === 5 && (i.pct1rm?.max ?? 100) <= 77 && (i.pct1rm?.min ?? 0) >= 65)
    expect(check('15', 'Iniciante + Força: 5x5 em 70–77%', ok, pr.map((i) => `${i.sets}x${fmtR(i.reps)} @${fmtR(i.pct1rm, '%')}`).join(' → '))).toBe(true)
  })

  it('16. Peso corporal + Força: avisa que força máxima é limitada', () => {
    const p = gen({ goal: 'forca', equipment: 'peso_corporal' })
    const w = p.warnings.find((x) => /limitada/.test(x))
    expect(check('16', 'Peso corporal + Força: aviso de limitação', !!w, w ? `"${w.slice(0, 90)}…"` : `avisos: ${JSON.stringify(p.warnings)}`)).toBe(true)
  })

  it('17. Peso corporal + Força: progressão por variação/lastro, não só reps', () => {
    const p = gen({ goal: 'forca', equipment: 'peso_corporal' })
    const it = strengthItems(firstLoadWeek(p)).find((i) => i.role === 'principal')!
    const sug = suggestNextV2({
      goal: p.goal,
      role: 'principal',
      group: it.group,
      prescription: it,
      history: [{ date: 1, weekKind: 'carga', prescription: it, sets: Array(it.sets).fill({ weight: 0, reps: it.reps!.max, rpe: 7, restBeforeSec: null }) }],
      weekKind: 'carga',
      bodyweight: true,
    })
    const ok = sug.kind === 'increase' && /lastro/.test(sug.reason) && /variação mais difícil/.test(sug.reason)
    expect(check('17', 'Peso corporal + Força: sugere lastro/variação', ok, `${nameOf(it.exerciseId)} ${it.sets}x${fmtR(it.reps)} → ${sug.kind}: "${sug.reason}"`)).toBe(true)
  })

  it('18. Gasto energético + 2x/semana: full body com circuito', () => {
    const p = gen({ goal: 'gasto_energetico', daysPerWeek: 2, split: 'upper_lower' })
    const w = firstLoadWeek(p)
    const circuits = w.days.filter((d) => d.groups.some((g) => g.kind === 'circuito')).length
    const ok = p.profile.split === 'full_body' && circuits === w.days.length
    expect(check('18', 'Gasto 2x: full body + circuito', ok, `divisão=${p.profile.split}, dias com circuito ${circuits}/${w.days.length}, finisher em ${stats(p).finishers}`)).toBe(true)
  })

  it('19. texto "por que este treino" cita reps, descanso, progressão e 4–8 semanas', () => {
    const miss: string[] = []
    for (const g of GOAL_IDS) {
      const t = programs[g].explanation
      const parts = { reps: /\d+(–\d+)?\s*(x\s*\d|reps)|\d+x\d/.test(t), descanso: /descanso/.test(t), progressao: /progress|carga sobe|sobe/.test(t), semanas: /4–8 semanas/.test(t) }
      for (const [k, v] of Object.entries(parts)) if (!v) miss.push(`${g}:${k}`)
      console.log(`  [${g}] ${t}`)
    }
    expect(check('19', '"por que este treino" completo nos 5 objetivos', miss.length === 0, miss.length ? `faltando ${miss.join(', ')}` : '5/5 com reps, descanso, progressão e 4–8 semanas')).toBe(true)
  })

  it('20. nenhuma promessa sem base (textos gerados e código)', () => {
    const texts = GOAL_IDS.flatMap((g) => [programs[g].explanation, ...programs[g].warnings, GOALS[g].resumo, ...GOALS[g].warnings.map((w) => w.text)])
    const hitsText = texts.flatMap((t) => findUnfoundedClaims(t))
    const files: string[] = []
    const walk = (d: string) =>
      readdirSync(d).forEach((f) => {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f) && !/claims\.ts$|\.test\.ts$/.test(f)) files.push(p)
      })
    walk('src')
    const hitsCode = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => findUnfoundedClaims(l).length).map((l) => `${f}: ${l.trim()}`))
    expect(check('20', 'sem promessas sem base', hitsText.length + hitsCode.length === 0, `${texts.length} textos e ${files.length} arquivos varridos; ocorrências: ${hitsText.length + hitsCode.length}${hitsCode.length ? ` (${hitsCode.join(' | ')})` : ''}`)).toBe(true)
  })

  it('21. afundo e outros unilaterais nunca abaixo de 6 reps (todas as combinações)', () => {
    const bad: string[] = []
    let n = 0
    for (const goal of GOAL_IDS)
      for (const split of ['AB', 'ABC', 'ABCD', 'upper_lower', 'full_body'] as const)
        for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
          for (const equipment of ['academia', 'halteres', 'peso_corporal'] as const)
            for (const level of ['iniciante', 'intermediario', 'avancado'] as const) {
              const p = gen({ ...BASE, goal, split, daysPerWeek, equipment, level })
              n++
              for (const w of allWeeks(p))
                for (const i of strengthItems(w)) {
                  const m = META_BY_ID.get(i.exerciseId)
                  if (m && !m.adequadoBaixasReps && (i.reps?.min ?? 99) < 6) bad.push(`${goal}/${split}/${daysPerWeek}x/${equipment}/${level}: ${nameOf(i.exerciseId)} ${fmtR(i.reps)}`)
                }
            }
    const lunge = strengthItems(firstLoadWeek(programs.forca)).filter((i) => META_BY_ID.get(i.exerciseId)?.unilateral)
    expect(
      check('21', 'unilateral/inadequado nunca < 6 reps', bad.length === 0, `${n} programas varridos; violações: ${bad.length}${bad.length ? ` (ex.: ${bad.slice(0, 3).join('; ')})` : ''}; unilaterais em Força base: ${lunge.map((i) => `${nameOf(i.exerciseId)} ${fmtR(i.reps)}`).join(', ') || 'nenhum'}`),
    ).toBe(true)
    void equipmentOf
  })
})
