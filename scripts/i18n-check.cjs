const assert = require('assert')
const path = require('path')
const { pathToFileURL } = require('url')

;(async () => {
  const root = path.resolve(__dirname, '..')
  const content = await import(pathToFileURL(path.join(root, 'docs/game/content.js')).href)
  const i18n = await import(pathToFileURL(path.join(root, 'docs/i18n.js')).href)

  const { ARCHETYPES, ITEM_DEFS, ENEMY_DEFS, FLOOR_DATA, SETPIECE_TEXT } = content
  const { ui, localizeArchetype, localizeItem, localizeEnemy, localizeFloor, sanityLabel, translateText } = i18n

  for (const key of ['save','load','mainMenu','expeditionProfile','beginDescent','inventory','journal','finalDecision']) {
    const en = ui(key, 'en'), es = ui(key, 'es')
    assert(en && es && en !== key && es !== key, `Missing UI translation: ${key}`)
  }
  assert.equal(ui('save','es'), 'Guardar')
  assert.equal(ui('beginDescent','es'), 'Iniciar descenso')

  for (const id of Object.keys(ARCHETYPES)) {
    const es = localizeArchetype(id, 'es')
    assert(es?.name && es?.blurb && es?.abilityName && es?.abilityDescription && es?.passiveName && es?.passiveDescription, `Incomplete archetype ES: ${id}`)
  }
  for (const id of Object.keys(ITEM_DEFS)) {
    const es = localizeItem(id, 'es')
    assert(es?.name && es?.description, `Incomplete item ES: ${id}`)
  }
  for (const id of Object.keys(ENEMY_DEFS)) {
    const es = localizeEnemy(id, 'es')
    assert(es?.name && es?.description && es?.intent, `Incomplete enemy ES: ${id}`)
  }
  for (const floor of [1,2,3,4]) {
    const es = localizeFloor(floor, 'es')
    assert(es?.name && es?.objective && es?.journal, `Incomplete floor ES: ${floor}`)
  }
  const setpieceCount = Object.values(SETPIECE_TEXT).flat().length
  assert.equal(setpieceCount, 8)
  for (const piece of Object.values(SETPIECE_TEXT).flat()) {
    assert.notEqual(translateText(piece.title,'es'), piece.title, `Setpiece title untranslated: ${piece.title}`)
    assert.notEqual(translateText(piece.text,'es'), piece.text, `Setpiece text untranslated: ${piece.title}`)
  }

  const dynamicSamples = [
    ['You enter the drowned observatory as the Surveyor.', 'Entras en el observatorio ahogado como Topógrafo.'],
    ['Expedition seed: TEST-404.', 'Semilla de expedición: TEST-404.'],
    ['You descend into II · The City Below.', 'Desciendes a II · La Ciudad Inferior.'],
    ['Critical. You strike Pale Listener for 7.', 'Crítico. Golpeas a Oyente Pálido y causas 7 de daño.'],
    ['Pale Listener attacks. Vitality -3.', 'Oyente Pálido ataca. Vitalidad -3.'],
    ['Recovered: Field Dressing.', 'Recuperado: Vendaje de Campo.'],
    ['Wake hymn altar 2', 'Despertar altar del himno 2'],
    [' · SURVEY S 4', ' · RUMBO S 4'],
    ['Audio enabled.', 'Audio activado.'],
    ['Reduced motion disabled.', 'Movimiento reducido desactivado.'],
    ['EXPEDITION ORDER — Descend beneath the observatory and determine why the lower survey team stopped transmitting.', 'ORDEN DE EXPEDICIÓN — Desciende bajo el observatorio y averigua por qué el equipo de prospección inferior dejó de transmitir.'],
    ['THE EMPTY CELL — The lock is on the inside. Scratches in the stone count upward from a number larger than the age of the observatory.', 'LA CELDA VACÍA — La cerradura está por dentro. Los arañazos en la piedra cuentan hacia arriba desde un número mayor que la edad del observatorio.'],
  ]
  for (const [en, expected] of dynamicSamples) assert.equal(translateText(en,'es'), expected, `Dynamic ES mismatch: ${en}`)

  for (const s of ['Stable','Uneasy','Distorted','Delirious','Beyond']) assert.notEqual(sanityLabel(s,'es'), s, `Sanity state untranslated: ${s}`)

  // English must remain lossless.
  const unchanged = ['Field Dressing','IV · The Great Abyss','Choose what becomes of the abyss.']
  for (const text of unchanged) assert.equal(translateText(text,'en'), text)

  console.log(`i18n check: OK (${Object.keys(ARCHETYPES).length} classes, ${Object.keys(ITEM_DEFS).length} items, ${Object.keys(ENEMY_DEFS).length} enemies, 4 acts, ${setpieceCount} setpieces, EN/ES runtime switch)`)
})().catch(err => { console.error(err); process.exit(1) })
