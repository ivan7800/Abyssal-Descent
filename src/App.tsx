import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { DungeonScene, type GameSnapshot } from './game/DungeonScene'
import { ARCHETYPES } from './game/content'
import type { ArchetypeId } from './game/types'

const initial: GameSnapshot = {
  mode: 'title', hp: 1, maxHp: 1, sanity: 1, maxSanity: 1, sanityState: 'Stable', level: 1, xp: 0, nextXp: 34,
  archetype: null, archetypeName: '', abilityName: '', abilityReady: true, passiveName: '', passiveDescription: '', guarded: false,
  log: ['Choose an expedition profile to begin.'], enemy: null, dead: false,
  seed: '', floor: 1, floorName: 'The Drowned Observatory', objective: 'Begin an expedition.', steps: 0, position: '-', inventory: [],
  equippedWeaponId: null, equippedCharmId: null, hasSave: false, interaction: null,
  endingTitle: '', endingText: '', choices: [], journal: [], discovered: 0, totalWalkable: 0,
  audioEnabled: true, reducedMotion: false, secretCount: 0,
  runStats: { kills: 0, bossesDefeated: 0, elitesDefeated: 0, damageDealt: 0, damageTaken: 0, itemsUsed: 0, retreats: 0, rests: 0 },
}

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null)
  const phaserRef = useRef<Phaser.Game | null>(null)
  const [state, setState] = useState<GameSnapshot>(initial)
  const [seed, setSeed] = useState('')
  const [archetype, setArchetype] = useState<ArchetypeId>('surveyor')
  const [tab, setTab] = useState<'inventory' | 'journal'>('inventory')

  useEffect(() => {
    if (!gameRef.current || phaserRef.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: 800,
      height: 500,
      backgroundColor: '#070a08',
      pixelArt: true,
      scene: [DungeonScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    game.events.on('snapshot', (snapshot: GameSnapshot) => {
      setState(snapshot)
      if (snapshot.seed) setSeed(snapshot.seed)
      if (snapshot.archetype) setArchetype(snapshot.archetype)
    })
    phaserRef.current = game
    return () => { game.destroy(true); phaserRef.current = null }
  }, [])

  const send = (action: string) => phaserRef.current?.events.emit('ui-action', action)
  const start = () => send(`start:${archetype}:${encodeURIComponent(seed.trim() || `ABYSS-${Date.now().toString(36).toUpperCase()}`)}`)
  const equippedWeapon = state.inventory.find(i => i.instanceId === state.equippedWeaponId)
  const equippedCharm = state.inventory.find(i => i.instanceId === state.equippedCharmId)
  const explored = state.totalWalkable ? Math.round(state.discovered / state.totalWalkable * 100) : 0

  return (
    <main className="shell">
      <header>
        <div>
          <p className="eyebrow">OPEN-SOURCE COSMIC DUNGEON CRAWLER</p>
          <h1>Abyssal Descent</h1>
        </div>
        <span className="badge">FINAL · v1.0.1</span>
      </header>

      <section className="runbar">
        <div className="run-status">
          <span>{state.floorName}</span>
          <strong>{state.mode === 'title' ? 'Awaiting expedition' : `Seed ${state.seed}`}</strong>
        </div>
        <button aria-pressed={state.audioEnabled} onClick={() => send('toggle-audio')}>{state.audioEnabled ? 'Audio on' : 'Audio off'}</button>
        <button aria-pressed={state.reducedMotion} onClick={() => send('toggle-motion')}>{state.reducedMotion ? 'Motion reduced' : 'Motion full'}</button>
        {state.mode !== 'title' && <button onClick={() => send('save')} disabled={state.dead} title={state.dead ? 'A lost expedition cannot overwrite the last valid checkpoint.' : undefined}>Save</button>}
        <button onClick={() => send('load')} disabled={!state.hasSave}>Load</button>
        {state.mode !== 'title' && <button onClick={() => send('title')}>Main menu</button>}
      </section>

      <section className="game-grid">
        <div className="viewport-card">
          <div ref={gameRef} className="game" role="img" aria-label="First-person dungeon view with minimap and encounter visuals" />

          {state.mode === 'title' ? (
            <section className="start-panel">
              <div className="start-copy">
                <span className="kicker">EXPEDITION PROFILE</span>
                <h2>Four acts. One descent. The map may stop telling the truth.</h2>
                <p>Choose a specialist and a reproducible seed. Explore handcrafted anomalies inside procedural dungeons, survive phased guardians, and decide what waits beyond the Great Abyss.</p>
              </div>
              <div className="archetypes">
                {(Object.entries(ARCHETYPES) as [ArchetypeId, typeof ARCHETYPES[ArchetypeId]][]).map(([id, a]) => (
                  <button className={`archetype-card ${archetype === id ? 'selected' : ''}`} aria-pressed={archetype === id} key={id} onClick={() => setArchetype(id)}>
                    <strong>{a.name}</strong>
                    <span>{a.blurb}</span>
                    <small><b>{a.abilityName}</b> — {a.abilityDescription}</small>
                    <small><b>{a.passiveName}</b> — {a.passiveDescription}</small>
                  </button>
                ))}
              </div>
              <div className="seed-row">
                <label><span>Seed</span><input value={seed} onChange={e => setSeed(e.target.value)} maxLength={48} placeholder="Leave blank for a random expedition" /></label>
                <button className="primary" onClick={start}>Begin descent</button>
              </div>
              {state.hasSave && <button className="resume" onClick={() => send('load')}>Resume local expedition</button>}
            </section>
          ) : (
            <div className="controls">
              <button onClick={() => send('left')} disabled={!!state.enemy || state.dead || state.mode === 'ending'}>↶ Turn</button>
              <button onClick={() => send('forward')} disabled={!!state.enemy || state.dead || state.mode === 'ending'}>↑ Forward</button>
              <button onClick={() => send('right')} disabled={!!state.enemy || state.dead || state.mode === 'ending'}>Turn ↷</button>
              <button onClick={() => send('back')} disabled={!!state.enemy || state.dead || state.mode === 'ending'}>↓ Back</button>
              <button className="interact" onClick={() => send('interact')} disabled={!state.interaction || !!state.enemy || state.dead || state.mode === 'ending'}>
                {state.interaction ? `E · ${state.interaction.label}` : 'E · Interact'}
              </button>
            </div>
          )}
        </div>

        <aside>
          {state.mode !== 'title' && (
            <>
              <section className="panel objective-panel">
                <div className="panel-title"><h2>Objective</h2><span>ACT {state.floor}</span></div>
                <p className="objective">{state.objective}</p>
                {state.interaction && <div className="context-hint"><strong>{state.interaction.label}</strong><span>{state.interaction.hint}</span></div>}
              </section>

              <section className="panel stats">
                <div className="panel-title"><h2>{state.archetypeName} · Lv {state.level}</h2><span>{state.steps} steps · {explored}% mapped</span></div>
                <Stat label="Vitality" value={state.hp} max={state.maxHp} />
                <Stat label={`Sanity · ${state.sanityState}`} value={state.sanity} max={state.maxSanity} />
                <Stat label="Experience" value={state.xp} max={state.nextXp} />
                <div className={`sanity-readout ${state.sanityState.toLowerCase()}`}>
                  <strong>{state.sanityState}</strong>
                  <span>{sanityCopy(state.sanityState)}</span>
                </div>
                <dl className="loadout">
                  <div><dt>Weapon</dt><dd>{equippedWeapon?.name ?? 'None'}</dd></div>
                  <div><dt>Charm</dt><dd>{equippedCharm?.name ?? 'None'}</dd></div>
                  <div><dt>Ability</dt><dd>{state.abilityName} {state.abilityReady ? '✓' : '…'}</dd></div>
                  <div><dt>Passive</dt><dd title={state.passiveDescription}>{state.passiveName}</dd></div>
                  <div><dt>Secrets</dt><dd>{state.secretCount}</dd></div>
                </dl>
              </section>

              <section className={`panel enemy-panel ${state.enemy?.boss ? 'boss-panel' : ''}`}>
                <div className="panel-title">
                  <h2>{state.enemy ? state.enemy.name : state.dead ? 'Expedition lost' : 'The corridor'}</h2>
                  {state.enemy?.boss && <span>PHASE {state.enemy.phase}/{state.enemy.maxPhase}</span>}
                </div>
                {state.dead ? (
                  <div className="dead-actions"><p>Your last valid checkpoint remains available.</p><button onClick={() => send('load')} disabled={!state.hasSave}>Load save</button><button onClick={() => send('title')}>New expedition</button></div>
                ) : state.enemy ? (
                  <>
                    <p>{state.enemy.description}</p>
                    <p className="intent">Intent: {state.enemy.intent}.</p>
                    <Stat label={state.enemy.boss ? 'Guardian' : 'Enemy'} value={state.enemy.hp} max={state.enemy.maxHp} />
                    <div className="combat-actions">
                      <button onClick={() => send('attack')}>F · Attack</button>
                      <button onClick={() => send('guard')}>G · Guard</button>
                      <button onClick={() => send('focus')}>R · Focus</button>
                      <button className="ability" onClick={() => send('ability')} disabled={!state.abilityReady}>Q · {state.abilityName}</button>
                      <button onClick={() => send('flee')} disabled={state.enemy.boss}>X · Flee</button>
                    </div>
                  </>
                ) : (
                  <p>WASD / arrows move. E interacts. In combat: F attack, G guard, R focus, Q ability, X flee. M toggles audio.</p>
                )}
              </section>

              {state.mode === 'ending' && (
                <section className="panel ending-panel">
                  <span className="kicker">FINAL DECISION</span>
                  <h2>{state.endingTitle}</h2>
                  <p>{state.endingText}</p>
                  {!!state.choices.length && <div className="ending-choices">{state.choices.map(choice => (
                    <button key={choice.id} disabled={choice.disabled} onClick={() => send(`ending:${choice.id}`)}>
                      <strong>{choice.label}</strong><span>{choice.description}</span>
                    </button>
                  ))}</div>}
                  {!state.choices.length && (
                    <>
                      <div className="run-summary">
                        <div><span>Level</span><strong>{state.level}</strong></div>
                        <div><span>Steps</span><strong>{state.steps}</strong></div>
                        <div><span>Kills</span><strong>{state.runStats.kills}</strong></div>
                        <div><span>Guardians</span><strong>{state.runStats.bossesDefeated}/4</strong></div>
                        <div><span>Secrets</span><strong>{state.secretCount}</strong></div>
                        <div><span>Act IV mapped</span><strong>{explored}%</strong></div>
                        <div><span>Elites</span><strong>{state.runStats.elitesDefeated}</strong></div>
                        <div><span>Items used</span><strong>{state.runStats.itemsUsed}</strong></div>
                        <div><span>Retreats</span><strong>{state.runStats.retreats}</strong></div>
                        <div><span>Refuges used</span><strong>{state.runStats.rests}</strong></div>
                        <div><span>Damage dealt</span><strong>{state.runStats.damageDealt}</strong></div>
                        <div><span>Damage taken</span><strong>{state.runStats.damageTaken}</strong></div>
                      </div>
                      <button className="primary" onClick={() => send('title')}>Return to main menu</button>
                    </>
                  )}
                </section>
              )}

              <section className="panel collection-panel">
                <div className="tabs">
                  <button className={tab === 'inventory' ? 'active' : ''} aria-pressed={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventory</button>
                  <button className={tab === 'journal' ? 'active' : ''} aria-pressed={tab === 'journal'} onClick={() => setTab('journal')}>Journal · {state.journal.length}</button>
                </div>
                {tab === 'inventory' ? (
                  <div className="inventory">
                    {!state.inventory.length && <p className="empty">Your pack is empty.</p>}
                    {state.inventory.map(item => {
                      const equipped = item.instanceId === state.equippedWeaponId || item.instanceId === state.equippedCharmId
                      return (
                        <article className={`item ${item.kind === 'quest' ? 'quest-item' : ''} ${item.unique ? 'unique-item' : ''}`} key={item.instanceId}>
                          <div><strong>{item.name}{item.kind === 'consumable' && (item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ''}</strong><small>{item.description}</small>{itemStats(item) && <em className="item-stats">{itemStats(item)}</em>}</div>
                          {equipped ? <span className="equipped">equipped</span> : item.kind === 'quest' ? <span className="quest-tag">key item</span> : (
                            <button
                              onClick={() => send(`${item.kind === 'consumable' ? 'use' : 'equip'}:${item.instanceId}`)}
                              disabled={state.dead || state.mode === 'ending' || (item.kind !== 'consumable' && !!state.enemy) || (item.kind === 'consumable' && !consumableUseful(item, state))}
                              title={state.dead ? 'A lost expedition cannot use or change inventory.' : state.mode === 'ending' ? 'The expedition is already at its final decision.' : item.kind !== 'consumable' && state.enemy ? 'Equipment is locked during combat.' : item.kind === 'consumable' && !consumableUseful(item, state) ? 'This consumable would provide no benefit right now.' : undefined}
                            >
                              {state.dead || state.mode === 'ending' ? 'Locked' : item.kind === 'consumable' ? (consumableUseful(item, state) ? 'Use' : 'Full') : state.enemy ? 'Locked' : 'Equip'}
                            </button>
                          )}
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="journal">
                    {[...state.journal].reverse().map((entry, i) => <article key={`${entry}-${i}`}>{entry}</article>)}
                  </div>
                )}
              </section>

              <section className="panel log-panel" aria-live="polite">
                <div className="panel-title"><h2>Field notes</h2><span>latest first</span></div>
                <ol>{state.log.slice(-10).reverse().map((line, i) => <li key={`${line}-${i}`}>{line}</li>)}</ol>
              </section>
            </>
          )}
        </aside>
      </section>

      <footer>
        Original open-source cosmic-horror dungeon crawler. Inspired by classic grid RPGs; no Cyclopean assets, text, code, characters or maps are used.
      </footer>
    </main>
  )
}

function Stat({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  return <div className="stat"><div className="stat-row"><span>{label}</span><strong>{value}/{max}</strong></div><div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${pct}%` }} /></div></div>
}

function consumableUseful(item: GameSnapshot['inventory'][number], state: GameSnapshot) {
  if (item.kind !== 'consumable') return true
  const hpUseful = !!item.heal && state.hp < state.maxHp
  const sanityUseful = !!item.restoreSanity && item.restoreSanity > 0 && state.sanity < state.maxSanity
  return hpUseful || sanityUseful
}

function itemStats(item: GameSnapshot['inventory'][number]) {
  const out: string[] = []
  if (item.attackBonus) out.push(`ATK +${item.attackBonus}`)
  if (item.defenseBonus) out.push(`DEF +${item.defenseBonus}`)
  if (item.maxSanityBonus) out.push(`SAN MAX +${item.maxSanityBonus}`)
  if (item.critBonus) out.push(`CRIT +${Math.round(item.critBonus * 100)}%`)
  if (item.sanityResist) out.push(`SAN RES ${Math.round(item.sanityResist * 100)}%`)
  if (item.healOnKill) out.push(`KILL HEAL +${item.healOnKill}`)
  if (item.heal) out.push(`HEAL ${item.heal}`)
  if (item.restoreSanity) out.push(`SAN ${item.restoreSanity > 0 ? '+' : ''}${item.restoreSanity}`)
  return out.join(' · ')
}

function sanityCopy(state: GameSnapshot['sanityState']) {
  if (state === 'Stable') return 'The map, corridor and your senses broadly agree.'
  if (state === 'Uneasy') return 'Peripheral movement and distant sounds may not be trustworthy.'
  if (state === 'Distorted') return 'The dungeon can lie visually. Check assumptions before acting.'
  if (state === 'Delirious') return 'The minimap and silhouettes may be false.'
  return 'Certainty is gone. Zero sanity is dangerous, but not immediate death.'
}
