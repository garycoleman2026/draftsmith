'use client';

import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import {
  BINGO_PROOF_SOURCES, BINGO_TASK_IMAGE_KINDS, BINGO_TASK_SCOPES, BINGO_VERIFIERS, bingoRuleSummary,
  expectedIndividualHours, expectedTeamHours, formatExpectedHours,
  sanitizeBingoEventRules, sanitizeBingoTaskRule, validateBingoBoard, verificationModeFromRule,
  type BingoEventRules, type BingoProofSource, type BingoTaskRule,
} from '../lib/bingo-rules';
import {
  OSRS_BINGO_PRESETS, parseBingoTaskImport, serializeBingoTaskImport, type BingoTaskDefinition,
} from '../lib/bingo-types';
import { copyText } from '../lib/client';
import type { BingoMode } from '../lib/types';
import { BingoPlanningSummary } from './BingoPlanningSummary';
import { BingoTaskArtwork } from './BingoTaskArtwork';

type Props = {
  initialTasks: BingoTaskDefinition[];
  initialRules: BingoEventRules;
  mode: BingoMode;
  disabled: boolean;
  saving: boolean;
  teamSize?: number;
  startAt?: string | null;
  endAt?: string | null;
  saveLabel?: string;
  onSave: (tasks: BingoTaskDefinition[], rules: BingoEventRules) => Promise<void>;
};

const LABELS: Record<string, string> = {
  manual: 'Manual challenge', item_acquired: 'Item acquired', pet_obtained: 'Pet obtained',
  collection_log: 'Collection-log unlock', xp_gain: 'XP gained', level_reached: 'Level reached',
  boss_kc: 'Boss kill count', raid_complete: 'Raid completed', raid_time: 'Raid time under target',
  combat_achievement: 'Combat achievement', clue_complete: 'Clue completed', team_challenge: 'Team challenge',
  any_member: 'Any member', single_member: 'One named member', team_total: 'Team total',
  exact_party: 'Exact party size', all_members: 'Every team member',
  organizer: 'Organizer review', screenshot: 'Screenshot', runelite: 'RuneLite', wise_old_man: 'Wise Old Man',
  none: 'No artwork', item: 'Show item', boss: 'Show boss',
};

export function BingoMaker({
  initialTasks, initialRules, mode, disabled, saving, teamSize = 1, startAt, endAt, saveLabel, onSave,
}: Props) {
  const [tasks, setTasks] = useState(() => cloneTasks(initialTasks));
  const [rules, setRules] = useState(() => sanitizeBingoEventRules(initialRules, initialRules.layout.rows, initialRules.scoring.winCondition));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [importText, setImportText] = useState(() => serializeBingoTaskImport(initialTasks));
  const [message, setMessage] = useState('');
  const validation = useMemo(() => validateBingoBoard(tasks, rules), [tasks, rules]);
  const categories = useMemo(() => ['All', ...new Set(OSRS_BINGO_PRESETS.map((preset) => preset.category))], []);
  const visiblePresets = useMemo(() => OSRS_BINGO_PRESETS.filter((preset) =>
    (category === 'All' || preset.category === category)
    && (preset.title + ' ' + preset.category + ' ' + preset.rule.verifier.target).toLowerCase().includes(search.trim().toLowerCase())), [category, search]);
  const selected = tasks[selectedIndex] ?? tasks[0];
  const expected = rules.layout.rows * rules.layout.columns;

  function replaceTask(index: number, task: BingoTaskDefinition) {
    setTasks((current) => current.map((item, itemIndex) => itemIndex === index ? structuredClone(task) : item));
    setSelectedIndex(index);
    setMessage('Tile ' + (index + 1) + ' now uses “' + task.title + '”.');
  }

  function updateSelected(mutator: (task: BingoTaskDefinition) => BingoTaskDefinition) {
    setTasks((current) => current.map((task, index) => index === selectedIndex ? mutator(structuredClone(task)) : task));
  }

  function updateRule(mutator: (rule: BingoTaskRule) => BingoTaskRule) {
    updateSelected((task) => {
      // Keep in-progress text intact (including trailing spaces and partial URLs); sanitize once on save.
      task.rule = mutator(structuredClone(task.rule));
      task.verificationMode = verificationModeFromRule(task.rule);
      return task;
    });
  }

  function resizeBoard(size: number) {
    const count = size * size;
    setRules((current) => sanitizeBingoEventRules({
      ...current, layout: { kind: 'grid', rows: size, columns: size },
    }, size, current.scoring.winCondition));
    setTasks((current) => Array.from({ length: count }, (_, index) =>
      current[index] ? structuredClone(current[index]) : structuredClone(OSRS_BINGO_PRESETS[index % OSRS_BINGO_PRESETS.length])));
    setSelectedIndex((current) => Math.min(current, count - 1));
    setMessage('Board resized to ' + size + ' × ' + size + '. Review new or removed tiles before saving.');
  }

  function applyProgression() {
    const size = rules.layout.rows;
    setTasks((current) => current.map((task, index) => {
      const next = structuredClone(task);
      const row = Math.floor(index / size);
      next.rule.prerequisitePositions = row === 0 ? [] : [index - size];
      next.hidden = row > 0;
      return next;
    }));
    setMessage('Tier unlocks applied: each tile now depends on the tile directly above it.');
  }

  function fillWithPresets() {
    setTasks(Array.from({ length: expected }, (_, index) => structuredClone(OSRS_BINGO_PRESETS[index % OSRS_BINGO_PRESETS.length])));
    setSelectedIndex(0);
    setMessage('Filled all ' + expected + ' tiles from the OSRS preset library.');
  }

  function applyImport() {
    const imported = parseBingoTaskImport(importText);
    if (imported.length !== expected) {
      setMessage('Import found ' + imported.length + ' valid rows; this layout needs exactly ' + expected + '.');
      return;
    }
    setTasks(imported);
    setSelectedIndex(0);
    setMessage('Imported ' + imported.length + ' tasks with their rule settings.');
  }

  function onDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    const presetValue = event.dataTransfer.getData('terry/preset');
    const tileValue = event.dataTransfer.getData('terry/tile');
    if (presetValue !== '') {
      const presetIndex = Number(presetValue);
      if (Number.isInteger(presetIndex) && OSRS_BINGO_PRESETS[presetIndex]) replaceTask(targetIndex, OSRS_BINGO_PRESETS[presetIndex]);
      return;
    }
    if (tileValue !== '') {
      const tileIndex = Number(tileValue);
      if (Number.isInteger(tileIndex) && tileIndex >= 0 && tileIndex < tasks.length && tileIndex !== targetIndex) {
        setTasks((current) => {
          const next = cloneTasks(current);
          [next[tileIndex], next[targetIndex]] = [next[targetIndex], next[tileIndex]];
          return next;
        });
        setSelectedIndex(targetIndex);
        setMessage('Moved tile ' + (tileIndex + 1) + ' to position ' + (targetIndex + 1) + '.');
      }
    }
  }

  async function save() {
    if (!validation.valid) {
      setMessage(validation.errors[0] ?? 'Fix the board before saving.');
      return;
    }
    const cleaned = tasks.map((task) => ({
      ...structuredClone(task),
      rule: sanitizeBingoTaskRule(task.rule, task.verificationMode),
    }));
    setTasks(cleaned);
    await onSave(cleaned, rules);
    setImportText(serializeBingoTaskImport(cleaned));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded border border-[#8b6a32]/35 bg-[#f5e5b8]/65 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">1 · Shape the game</p>
          <label className="mt-3 block text-[10px] font-black uppercase text-[#65583f]">Board size
            <select className="realm-field mt-1 h-11 w-full px-3 text-sm" value={rules.layout.rows} disabled={disabled} onChange={(event) => resizeBoard(Number(event.target.value))}>
              {[3, 4, 5, 6, 7].map((size) => <option key={size} value={size}>{size} × {size} · {size * size} tiles</option>)}
            </select>
          </label>
          <p className="mt-3 text-xs leading-relaxed text-[#6e5e43]"><b>{modeLabel(mode)}</b><br />{modeHelp(mode)}</p>
          <div className="mt-4"><BingoPlanningSummary compact tasks={tasks} teamSize={teamSize} startAt={startAt} endAt={endAt} /></div>
          {mode === 'categories' ? <label className="mt-3 block text-[10px] font-black uppercase text-[#65583f]">Tasks needed per category<input className="realm-field mt-1 h-10 w-full px-3 text-sm" type="number" min={1} max={100} disabled={disabled} value={rules.scoring.categoryTarget} onChange={(event) => setRules((current) => ({ ...current, scoring: { ...current.scoring, categoryTarget: Math.max(1, Number(event.target.value) || 1) } }))} /></label> : null}
          {mode === 'classic' ? <label className="mt-3 block text-[10px] font-black uppercase text-[#65583f]">Lines needed to win<input className="realm-field mt-1 h-10 w-full px-3 text-sm" type="number" min={1} max={20} disabled={disabled} value={rules.scoring.targetValue || 1} onChange={(event) => setRules((current) => ({ ...current, scoring: { ...current.scoring, targetValue: Math.max(1, Number(event.target.value) || 1) } }))} /></label> : null}
          <div className="mt-4 grid gap-2">
            <button className="scroll-button px-3 py-2 text-xs" disabled={disabled} onClick={fillWithPresets}>Fill from presets</button>
            <button className="scroll-button px-3 py-2 text-xs" disabled={disabled} onClick={applyProgression}>Apply tier unlocks</button>
            <button className="scroll-button px-3 py-2 text-xs" onClick={() => { setTasks(cloneTasks(initialTasks)); setRules(sanitizeBingoEventRules(initialRules, initialRules.layout.rows, initialRules.scoring.winCondition)); setSelectedIndex(0); setMessage('Restored the last saved board.'); }}>Restore saved board</button>
          </div>
          <div className={'mt-4 rounded border p-3 text-xs ' + (validation.valid ? 'border-[#62835d]/45 bg-[#dbe6c7] text-[#355332]' : 'border-[#a75e44]/45 bg-[#efd1bd] text-[#723b2b]')}>
            <b>{validation.valid ? 'Ready to save' : validation.errors.length + ' issue' + (validation.errors.length === 1 ? '' : 's') + ' to fix'}</b>
            {validation.errors.slice(0, 3).map((error) => <p className="mt-1" key={error}>{error}</p>)}
            {validation.warnings.slice(0, 2).map((warning) => <p className="mt-1 text-[#765d27]" key={warning}>Note: {warning}</p>)}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">2 · Arrange the board</p><p className="mt-1 text-xs text-[#6e5e43]">Select a tile to edit it. Drag tiles to reorder; drag a preset onto a tile to replace it.</p></div>
            <span className="rounded bg-[#6a512b]/10 px-3 py-2 text-xs font-black text-[#5d4828]">{tasks.length} / {expected} tiles</span>
          </div>
          <div className="mt-3 overflow-x-auto pb-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(' + rules.layout.columns + ', minmax(112px, 1fr))', minWidth: Math.max(560, rules.layout.columns * 124) }}>
              {tasks.map((task, index) => (
                <button
                  className={'min-h-28 rounded border p-2 text-left shadow-[0_2px_0_#735629] transition ' + (selectedIndex === index ? 'border-[#4f7348] bg-[#dbe8c7] ring-2 ring-[#4f7348]/30' : 'border-[#9c7933] bg-[#efe0b6] hover:-translate-y-0.5')}
                  draggable={!disabled}
                  key={String(index) + '-' + task.title}
                  onClick={() => setSelectedIndex(index)}
                  onDragStart={(event) => event.dataTransfer.setData('terry/tile', String(index))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, index)}
                  type="button"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#7b643d]">#{index + 1} · {task.category}</span>
                  <BingoTaskArtwork alt="" className="mx-auto mt-1 h-10 w-10" rule={task.rule} />
                  <p className="mt-1 line-clamp-3 text-xs font-black leading-tight text-[#332616]">{task.title}</p>
                  <p className="mt-2 text-[9px] text-[#75603d]">{task.points} pts · {task.rule.verifier.type.replaceAll('_', ' ')}</p>
                  {expectedIndividualHours(task.rule) !== null ? <p className="mt-1 text-[9px] font-black text-[#315b39]">~{formatExpectedHours(expectedIndividualHours(task.rule))} solo</p> : null}
                  {task.rule.prerequisitePositions.length ? <p className="mt-1 text-[9px] font-bold text-[#805821]">Unlocks after {task.rule.prerequisitePositions.map((position) => '#' + (position + 1)).join(', ')}</p> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <TaskEditor disabled={disabled} expected={expected} selected={selected} selectedIndex={selectedIndex} teamSize={teamSize} updateRule={updateRule} updateSelected={updateSelected} />
        <aside className="rounded border border-[#8b6a32]/35 bg-[#f5e5b8]/55 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">OSRS task library · {OSRS_BINGO_PRESETS.length} presets</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_145px] gap-2">
            <input className="realm-field h-10 w-full px-3 text-xs normal-case" placeholder="Search tasks…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="realm-field h-10 w-full px-2 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="mt-3 max-h-[560px] space-y-2 overflow-auto pr-1">
            {visiblePresets.map((preset) => {
              const presetIndex = OSRS_BINGO_PRESETS.indexOf(preset);
              return <button
                className="w-full rounded border border-[#8b6a32]/30 bg-[#f0ddb0] p-3 text-left hover:border-[#5f7d4f] hover:bg-[#e6e6b7]"
                draggable={!disabled}
                disabled={disabled}
                key={preset.title + '-' + presetIndex}
                onClick={() => replaceTask(Math.min(selectedIndex, tasks.length - 1), preset)}
                onDragStart={(event) => event.dataTransfer.setData('terry/preset', String(presetIndex))}
                type="button"
              >
                <div className="flex gap-3"><BingoTaskArtwork alt="" className="h-12 w-12 shrink-0" rule={preset.rule} /><div className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#80642b]">{preset.category} · {preset.points} pts</span>
                  <p className="mt-1 text-xs font-black text-[#392b18]">{preset.title}</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-[#59472f]">{bingoRuleSummary(preset.rule)}</p>
                  {expectedIndividualHours(preset.rule) !== null ? <p className="mt-1 text-[9px] font-black text-[#315b39]">Expected {formatExpectedHours(expectedIndividualHours(preset.rule))} solo</p> : null}</div></div>
              </button>;
            })}
          </div>
        </aside>
      </div>

      <details className="rounded border border-[#8b6a32]/35 bg-[#f5e5b8]/55 p-4">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.1em] text-[#80642b]">Spreadsheet import / export</summary>
        <p className="mt-3 text-xs leading-relaxed text-[#6e5e43]">Paste rows from Sheets, CSV, or pipe text. The first five columns remain <b>title, points, category, verification, description</b>; advanced rule columns are preserved when you copy an export from Terry’s.</p>
        <textarea className="realm-field mt-3 min-h-52 w-full p-3 font-mono text-[10px] leading-relaxed normal-case" disabled={disabled} value={importText} onChange={(event) => setImportText(event.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="scroll-button px-4 py-2.5 text-xs" disabled={disabled} onClick={applyImport}>Apply {parseBingoTaskImport(importText).length} imported rows</button>
          <button className="scroll-button px-4 py-2.5 text-xs" onClick={() => { const text = serializeBingoTaskImport(tasks); setImportText(text); void copyText(text); setMessage('Copied the full board and advanced rules.'); }}>Copy current board</button>
        </div>
      </details>

      {message ? <p role="status" className="rounded border border-[#8b6a32]/35 bg-[#efe0b6] px-4 py-3 text-xs font-bold text-[#5a482d]">{message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#8b6a32]/25 pt-4">
        <p className="text-xs text-[#6e5e43]">Saving creates an immutable rule definition for the event. Existing live events stay locked.</p>
        <button className="gold-button px-6 py-3 text-sm" disabled={disabled || saving || !validation.valid} onClick={() => void save()}>{saving ? 'Saving custom board…' : saveLabel ?? 'Save ' + tasks.length + '-tile custom board'}</button>
      </div>
    </div>
  );
}

function TaskEditor({ disabled, expected, selected, selectedIndex, teamSize, updateRule, updateSelected }: {
  disabled: boolean; expected: number; selected: BingoTaskDefinition | undefined; selectedIndex: number;
  teamSize: number;
  updateRule: (mutator: (rule: BingoTaskRule) => BingoTaskRule) => void;
  updateSelected: (mutator: (task: BingoTaskDefinition) => BingoTaskDefinition) => void;
}) {
  if (!selected) return null;
  const individualHours = expectedIndividualHours(selected.rule);
  const teamHours = expectedTeamHours(selected.rule, teamSize);
  return (
    <section className="rounded border border-[#8b6a32]/35 bg-[#f5e5b8]/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">3 · Edit tile {selectedIndex + 1}</p><h3 className="fantasy-title mt-1 text-2xl font-bold">{selected.title}</h3></div>
        <span className="max-w-md text-right text-[10px] leading-relaxed text-[#6e5e43]">{bingoRuleSummary(selected.rule)}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Task title" wide><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled} value={selected.title} onChange={(event) => updateSelected((task) => ({ ...task, title: event.target.value }))} /></Field>
        <Field label="Description" wide><textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" disabled={disabled} value={selected.description} onChange={(event) => updateSelected((task) => ({ ...task, description: event.target.value }))} /></Field>
        <Field label="Points"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" type="number" min={0} max={10000} disabled={disabled || selected.freeSpace} value={selected.points} onChange={(event) => updateSelected((task) => ({ ...task, points: Number(event.target.value) }))} /></Field>
        <Field label="Category"><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} value={selected.category} onChange={(event) => updateSelected((task) => ({ ...task, category: event.target.value }))} /></Field>
        <Field label="Rule type"><select className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} value={selected.rule.verifier.type} onChange={(event) => updateRule((rule) => ({ ...rule, verifier: { ...rule.verifier, type: event.target.value as BingoTaskRule['verifier']['type'] } }))}>{BINGO_VERIFIERS.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></Field>
        <Field label="Who contributes"><select className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} value={selected.rule.scope.type} onChange={(event) => updateRule((rule) => ({ ...rule, scope: { ...rule.scope, type: event.target.value as BingoTaskRule['scope']['type'] } }))}>{BINGO_TASK_SCOPES.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></Field>
        <Field label="Target item, pet, raid or task"><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} value={selected.rule.verifier.target} onChange={(event) => updateRule((rule) => ({ ...rule, verifier: { ...rule.verifier, target: event.target.value } }))} /></Field>
        <Field label="Metric key (for XP/KC)"><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} placeholder="agility, giant_mole…" value={selected.rule.verifier.metric} onChange={(event) => updateRule((rule) => ({ ...rule, verifier: { ...rule.verifier, metric: event.target.value } }))} /></Field>
        <Field label="Numeric target"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0} placeholder="e.g. 10000000" value={selected.rule.verifier.amount ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, verifier: { ...rule.verifier, amount: event.target.value ? Number(event.target.value) : null } }))} /></Field>
        <Field label="Unit"><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} placeholder="XP, KC, seconds…" value={selected.rule.verifier.unit} onChange={(event) => updateRule((rule) => ({ ...rule, verifier: { ...rule.verifier, unit: event.target.value } }))} /></Field>
        {selected.rule.scope.type === 'exact_party' ? <Field label="Required players"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled} type="number" min={2} max={100} value={selected.rule.scope.participantCount ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, scope: { ...rule.scope, participantCount: Number(event.target.value) || null } }))} /></Field> : null}
        <div className="sm:col-span-2 mt-2 rounded border border-[#8b6a32]/30 bg-[#f7e9bd]/55 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#65583f]">Artwork & task details</p><p className="mt-1 text-xs normal-case text-[#58492f]">Choose an item or boss image from the OSRS Wiki, then add the exact edge cases players need.</p></div><BingoTaskArtwork alt="Selected task artwork" className="h-16 w-16" rule={selected.rule} /></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Tile artwork"><select className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} value={selected.rule.presentation.imageKind} onChange={(event) => updateRule((rule) => ({ ...rule, presentation: { imageKind: event.target.value as BingoTaskRule['presentation']['imageKind'], imageKey: event.target.value === 'none' ? '' : rule.presentation.imageKey || rule.verifier.target } }))}>{BINGO_TASK_IMAGE_KINDS.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}</select></Field>
            <Field label="Wiki image name"><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace || selected.rule.presentation.imageKind === 'none'} placeholder="Oathplate helm or Yama" value={selected.rule.presentation.imageKey} onChange={(event) => updateRule((rule) => ({ ...rule, presentation: { ...rule.presentation, imageKey: event.target.value } }))} /></Field>
            <Field label="Notes" wide><textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" disabled={disabled || selected.freeSpace} placeholder="What exactly must happen?" value={selected.rule.details.notes} onChange={(event) => updateRule((rule) => ({ ...rule, details: { ...rule.details, notes: event.target.value } }))} /></Field>
            <Field label="Exclusions" wide><textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" disabled={disabled || selected.freeSpace} placeholder="What does not count?" value={selected.rule.details.exclusions} onChange={(event) => updateRule((rule) => ({ ...rule, details: { ...rule.details, exclusions: event.target.value } }))} /></Field>
            <Field label="Planning source URL" wide><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} type="url" placeholder="https://oldschool.runescape.wiki/…" value={selected.rule.details.sourceUrl} onBlur={() => updateRule((rule) => rule)} onChange={(event) => updateSelected((task) => ({ ...task, rule: { ...task.rule, details: { ...task.rule.details, sourceUrl: event.target.value } } }))} /></Field>
          </div>
        </div>
        <div className="sm:col-span-2 rounded border border-[#8b6a32]/30 bg-[#e1e8c8]/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#425b35]">Expected-time planner</p><p className="mt-1 text-xs normal-case text-[#3f5035]">All rates are per individual and editable. Drop estimate = rate denominator ÷ numerator ÷ efficient kills per hour.</p></div><div className="rounded bg-[#315b39] px-3 py-2 text-right text-[10px] font-black text-white"><span className="block">{formatExpectedHours(individualHours)} solo</span><span className="block opacity-80">{formatExpectedHours(teamHours)} with {teamSize}</span></div></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Drop-rate numerator"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0.000001} step="any" placeholder="1" value={selected.rule.planning.dropRateNumerator ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, dropRateNumerator: nullableNumber(event.target.value) } }))} /></Field>
            <Field label="Drop-rate denominator"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0.000001} step="any" placeholder="3000" value={selected.rule.planning.dropRateDenominator ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, dropRateDenominator: nullableNumber(event.target.value) } }))} /></Field>
            <Field label="Quantity needed"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={1} max={100} value={selected.rule.planning.quantity} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, quantity: Number(event.target.value) || 1 } }))} /></Field>
            <Field label="Efficient kills / attempts per hour"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0.000001} step="any" placeholder="85" value={selected.rule.planning.efficientKillsPerHour ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, efficientKillsPerHour: nullableNumber(event.target.value) } }))} /></Field>
            <Field label="Efficient XP / units per hour"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0.000001} step="any" placeholder="100000" value={selected.rule.planning.efficientUnitsPerHour ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, efficientUnitsPerHour: nullableNumber(event.target.value) } }))} /></Field>
            <Field label="Fixed expected hours"><input className="realm-field mt-1 h-11 w-full px-3 text-sm" disabled={disabled || selected.freeSpace} type="number" min={0.000001} step="any" placeholder="Overrides calculated estimate" value={selected.rule.planning.fixedHours ?? ''} onChange={(event) => updateRule((rule) => ({ ...rule, planning: { ...rule.planning, fixedHours: nullableNumber(event.target.value) } }))} /></Field>
          </div>
        </div>
        <Field label="Prerequisite tile numbers" wide><input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={disabled || selected.freeSpace} placeholder="Example: 1, 6, 11" value={selected.rule.prerequisitePositions.map((position) => position + 1).join(', ')} onChange={(event) => updateRule((rule) => ({ ...rule, prerequisitePositions: parsePositions(event.target.value, expected) }))} /></Field>
        <div className="sm:col-span-2">
          <p className="text-[10px] font-black uppercase text-[#65583f]">Accepted proof</p>
          <div className="mt-2 flex flex-wrap gap-2">{BINGO_PROOF_SOURCES.map((source) => <label className="flex items-center gap-2 rounded border border-[#8b6a32]/30 bg-white/25 px-3 py-2 text-xs font-bold text-[#4e402b]" key={source}><input type="checkbox" disabled={disabled || selected.freeSpace} checked={selected.rule.proof.sources.includes(source)} onChange={() => updateRule((rule) => ({ ...rule, proof: { ...rule.proof, sources: toggleSource(rule.proof.sources, source) } }))} />{LABELS[source]}</label>)}</div>
        </div>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-xs font-bold text-[#4e402b]"><input type="checkbox" disabled={disabled} checked={selected.hidden} onChange={(event) => updateSelected((task) => ({ ...task, hidden: event.target.checked }))} />Hide until unlocked</label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#4e402b]"><input type="checkbox" disabled={disabled || selected.freeSpace} checked={selected.repeatable} onChange={(event) => updateSelected((task) => ({ ...task, repeatable: event.target.checked, maxCompletions: event.target.checked ? Math.max(2, task.maxCompletions) : 1 }))} />Repeatable</label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#4e402b]"><input type="checkbox" disabled={disabled} checked={selected.freeSpace} onChange={(event) => updateSelected((task) => event.target.checked ? { ...task, title: "Terry's free space", category: 'Free', points: 0, freeSpace: true } : { ...task, title: 'New task', category: 'General', freeSpace: false })} />Free space</label>
        </div>
      </div>
    </section>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={'text-[10px] font-black uppercase text-[#65583f] ' + (wide ? 'sm:col-span-2' : '')}>{label}{children}</label>;
}
function cloneTasks(tasks: BingoTaskDefinition[]) { return tasks.map((task) => structuredClone(task)); }
function parsePositions(value: string, maximum: number) {
  return [...new Set(value.split(/[+,;\s]+/).map((item) => Number(item) - 1)
    .filter((position) => Number.isInteger(position) && position >= 0 && position < maximum))].sort((left, right) => left - right);
}
function nullableNumber(value: string) { return value ? Number(value) : null; }
function toggleSource(current: BingoProofSource[], source: BingoProofSource) {
  const next = current.includes(source) ? current.filter((item) => item !== source) : [...current, source];
  return next.length ? next : ['organizer'] as BingoProofSource[];
}
function modeLabel(mode: BingoMode) {
  return ({ classic: 'Classic lines', points: 'Points hunt', lockout: 'Shared lockout', blackout: 'Blackout race', progression: 'Tiered expedition', categories: 'Category conquest' })[mode];
}
function modeHelp(mode: BingoMode) {
  return ({
    classic: 'Rows, columns and diagonals decide the winner.',
    points: 'Every approved task adds its points.',
    lockout: 'The first team to earn a tile owns it.',
    blackout: 'Completed tile count comes before points.',
    progression: 'Prerequisites control which tasks unlock.',
    categories: 'Breadth across task categories comes first.',
  })[mode];
}
