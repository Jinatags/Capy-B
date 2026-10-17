import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dialogueSrc = readFileSync(join(root, 'src/shared/dialogue.ts'), 'utf8')

describe('Phase 3 water dialogue copy', () => {
  it('uses the required water prompt and buttons', () => {
    assert.match(dialogueSrc, /it is time to pay tax/)
    assert.match(dialogueSrc, /label:\s*'okay'/)
    assert.match(dialogueSrc, /label:\s*"i don't wanna"/)
    assert.match(dialogueSrc, /good girl/)
    assert.match(dialogueSrc, /you have to pay tax/)
    assert.match(dialogueSrc, /persistPrompt:\s*true/)
  })

  it('keeps morning greeting text', () => {
    assert.match(dialogueSrc, /good morning princess/)
  })
})
