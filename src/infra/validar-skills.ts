import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

import { validarSkill } from '@/dominio/validacao-skill.js'

/**
 * Percorre `.claude/skills/` e valida cada SKILL.md contra a Agent Skills Spec.
 * Sai com codigo 1 se qualquer skill tiver erro, para poder rodar em CI.
 */

const DIRETORIO_SKILLS = resolve(process.cwd(), '.claude', 'skills')

function main(): number {
  if (!existsSync(DIRETORIO_SKILLS)) {
    process.stderr.write(`Diretorio de skills nao encontrado: ${DIRETORIO_SKILLS}\n`)
    return 1
  }

  const diretorios = readdirSync(DIRETORIO_SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  if (diretorios.length === 0) {
    process.stderr.write('Nenhuma skill encontrada.\n')
    return 1
  }

  let totalErros = 0
  let totalAvisos = 0

  process.stdout.write(`Validando ${diretorios.length} skill(s) em .claude/skills/\n\n`)

  for (const diretorio of diretorios) {
    const caminho = join(DIRETORIO_SKILLS, diretorio, 'SKILL.md')

    if (!existsSync(caminho)) {
      process.stdout.write(`  [ERRO] ${diretorio}: SKILL.md ausente\n`)
      totalErros += 1
      continue
    }

    const resultado = validarSkill(diretorio, readFileSync(caminho, 'utf8'))
    const erros = resultado.problemas.filter((p) => p.nivel === 'erro')
    const avisos = resultado.problemas.filter((p) => p.nivel === 'aviso')

    totalErros += erros.length
    totalAvisos += avisos.length

    const marcador = resultado.valido ? 'ok  ' : 'ERRO'
    process.stdout.write(`  [${marcador}] ${diretorio}\n`)

    for (const p of erros) {
      process.stdout.write(`         erro  ${p.campo}: ${p.mensagem}\n`)
    }
    for (const p of avisos) {
      process.stdout.write(`         aviso ${p.campo}: ${p.mensagem}\n`)
    }
  }

  process.stdout.write(`\n${totalErros} erro(s), ${totalAvisos} aviso(s).\n`)
  return totalErros > 0 ? 1 : 0
}

process.exitCode = main()
