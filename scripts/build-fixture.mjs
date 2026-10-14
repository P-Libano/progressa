// Gera src/data/__fixtures__/exercises-index.json: índice compacto do dataset
// (sem instruções) usado pelos testes, que assim rodam sem rede.
// Uso: node scripts/build-fixture.mjs
import { mkdir, writeFile } from 'node:fs/promises'

const DATASET_URL = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/data/exercises.json'
const res = await fetch(DATASET_URL)
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const raw = await res.json()
const index = raw.map((e) => ({
  id: e.id,
  name: e.name,
  body_part: e.body_part,
  equipment: e.equipment,
  target: e.target,
  muscle_group: e.muscle_group,
  secondary_muscles: e.secondary_muscles,
}))
const dir = new URL('../src/data/__fixtures__/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('exercises-index.json', dir), JSON.stringify(index))
console.log(`${index.length} exercícios gravados`)
