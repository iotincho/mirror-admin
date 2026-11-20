import type { JournalAdjustment, JournalConfiguration, JournalPrompt, JournalStage } from '../../../providers/journals-contracts';

export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type Draft = {
  base: JournalConfiguration;
  stages: JournalStage[];
  purpose: string;
  instructions: string;
  prompts: Record<string, JournalPrompt[]>;
  approvals: Record<string, string>;
};
export const clone = <T,>(value: T): T => structuredClone(value);
export const signature = (draft: Draft, stage: JournalStage) => JSON.stringify([draft.purpose, draft.instructions, stage.objective, stage.instructions, draft.prompts[stage.key]]);
export function createDraft(base: JournalConfiguration): Draft {
  return { base: clone(base), stages: base.stages.map(s => clone(s.definition)), purpose: base.run.purpose, instructions: base.instructions, prompts: Object.fromEntries(base.catalogs.map(c => [c.stage_key, clone(c.prompts)])), approvals: {} };
}
export function currentIndex(configuration: JournalConfiguration): number {
  return configuration.stages.findIndex(s => s.id === configuration.editable_stage_id);
}
export function adjustment(draft: Draft): JournalAdjustment {
  const first = currentIndex(draft.base);
  if (first < 0) throw new Error('Este recorrido ya no tiene una etapa editable.');
  const remaining = draft.stages.slice(first);
  return { expected_revision: draft.base.run.revision, purpose: draft.purpose, instructions: draft.instructions, remaining_stages: clone(remaining), reviewed_catalogs: remaining.filter(s => draft.approvals[s.key] === signature(draft, s)).map(s => ({ stage_key: s.key, prompts: clone(draft.prompts[s.key]) })) };
}
export function edited(draft: Draft): boolean {
  return draft.purpose !== draft.base.run.purpose || draft.instructions !== draft.base.instructions || JSON.stringify(draft.stages) !== JSON.stringify(draft.base.stages.map(s => s.definition)) || Object.values(draft.approvals).length > 0 || draft.base.catalogs.some(c => JSON.stringify(draft.prompts[c.stage_key]) !== JSON.stringify(c.prompts));
}
export function validPrompts(prompts: JournalPrompt[]): boolean {
  return prompts.length > 0 && prompts.length <= 12 && new Set(prompts.map(p => p.key)).size === prompts.length && prompts.every(p => {
    const texts = [p.gentle, p.middle, p.deep];
    return new Set(texts).size === 3 && texts.every(t => t.trim() === t && t.length <= 240 && t.length > 0 && !/[\r\n]/.test(t) && (t.match(/\?/g) || []).length === 1);
  });
}
export function blankPrompt(): JournalPrompt { return { key: `topic-${newKey()}`, gentle: '', middle: '', deep: '' }; }

export type Change = { id: string; label: string; before: unknown; after: unknown };
export function changes(draft: Draft): Change[] {
  const result: Change[] = [];
  for (const [key, label] of [['purpose', 'Propósito general'], ['instructions', 'Indicaciones generales']] as const) {
    const before = key === 'purpose' ? draft.base.run.purpose : draft.base.instructions;
    if (draft[key] !== before) result.push({ id: key, label, before, after: draft[key] });
  }
  draft.stages.forEach(stage => {
    const old = draft.base.stages.find(s => s.definition.key === stage.key)?.definition;
    if (!old) { result.push({ id: stage.key, label: 'Etapa nueva', before: 'No estaba en el recorrido', after: stage.name }); return; }
    for (const [key, label] of [['name', 'Nombre'], ['objective', 'Objetivo'], ['instructions', 'Indicaciones'], ['duration_days', 'Duración en días']] as const) {
      if (stage[key] !== old[key]) result.push({ id: `${stage.key}.${key}`, label: `${stage.name} · ${label}`, before: old[key], after: stage[key] });
    }
  });
  draft.base.stages.filter(s => !draft.stages.some(d => d.key === s.definition.key)).forEach(s => result.push({ id: s.definition.key, label: 'Etapa futura quitada', before: s.definition.name, after: 'Se conserva en la historia.' }));
  const oldOrder = draft.base.stages.map(s => s.definition.key), order = draft.stages.map(s => s.key);
  if (JSON.stringify(oldOrder) !== JSON.stringify(order)) result.push({ id: 'order', label: 'Orden del recorrido', before: draft.base.stages.map(s => s.definition.name).join(' → '), after: draft.stages.map(s => s.name).join(' → ') });
  Object.keys(draft.approvals).filter(key => draft.stages.some(s => s.key === key && draft.approvals[key] === signature(draft, s))).forEach(key => result.push({ id: `review.${key}`, label: 'Respaldo revisado', before: 'Configuración anterior', after: draft.stages.find(s => s.key === key)!.name }));
  return result;
}

export type Conflict = { id: string; label: string; current: unknown; local: unknown };
export function conflictingFields(draft: Draft, latest: JournalConfiguration): Conflict[] {
  const result: Conflict[] = [];
  const compare = (id: string, label: string, base: unknown, local: unknown, current: unknown) => {
    if (JSON.stringify(base) !== JSON.stringify(local) && JSON.stringify(base) !== JSON.stringify(current) && JSON.stringify(local) !== JSON.stringify(current)) result.push({ id, label, current, local });
  };
  compare('purpose', 'Propósito general', draft.base.run.purpose, draft.purpose, latest.run.purpose);
  compare('instructions', 'Indicaciones generales', draft.base.instructions, draft.instructions, latest.instructions);
  draft.stages.forEach(stage => {
    const old = draft.base.stages.find(s => s.definition.key === stage.key)?.definition;
    const current = latest.stages.find(s => s.definition.key === stage.key)?.definition;
    if (old && current) for (const key of ['name', 'objective', 'instructions', 'duration_days'] as const) compare(`${stage.key}.${key}`, `${stage.name} · ${key === 'duration_days' ? 'Duración' : key === 'objective' ? 'Objetivo' : key === 'name' ? 'Nombre' : 'Indicaciones'}`, old[key], stage[key], current[key]);
    const oldPrompts = draft.base.catalogs.find(c => c.stage_key === stage.key)?.prompts;
    const currentPrompts = latest.catalogs.find(c => c.stage_key === stage.key)?.prompts;
    if (old && !current) compare(`${stage.key}.removed`, stage.name, { definition: old, prompts: oldPrompts }, { definition: stage, prompts: draft.prompts[stage.key] }, undefined);
    else compare(`${stage.key}.prompts`, `${stage.name} · Preguntas de respaldo`, oldPrompts, draft.prompts[stage.key], currentPrompts);
  });
  draft.base.stages.filter(s => !draft.stages.some(d => d.key === s.definition.key)).forEach(old => {
    const current = latest.stages.find(s => s.definition.key === old.definition.key)?.definition;
    if (current) compare(`${old.definition.key}.removal`, `${old.definition.name} · Quitar etapa`, { definition: old.definition, prompts: draft.base.catalogs.find(c => c.stage_key === old.definition.key)?.prompts }, null, { definition: current, prompts: latest.catalogs.find(c => c.stage_key === old.definition.key)?.prompts });
  });
  const oldOrder = draft.base.stages.map(s => s.definition.key);
  compare('order', 'Orden de etapas', oldOrder, draft.stages.map(s => s.key), latest.stages.map(s => s.definition.key));
  return result;
}
export function mergeDraft(draft: Draft, latest: JournalConfiguration, choices: Record<string, 'current' | 'local'>): Draft {
  if (latest.editable_stage_id !== draft.base.editable_stage_id) throw new Error('El calendario avanzó o cambió el estado del recorrido. Conservá el borrador y revisá las etapas actuales antes de recuperarlo.');
  const conflicts = conflictingFields(draft, latest);
  if (conflicts.some(c => !choices[c.id])) throw new Error('Elegí qué conservar en cada campo que cambió en ambas versiones.');
  const merged = createDraft(latest);
  const keepLocal = (id: string) => !conflicts.some(c => c.id === id) || choices[id] === 'local';
  if (draft.purpose !== draft.base.run.purpose && keepLocal('purpose')) merged.purpose = draft.purpose;
  if (draft.instructions !== draft.base.instructions && keepLocal('instructions')) merged.instructions = draft.instructions;
  draft.stages.forEach(stage => {
    const old = draft.base.stages.find(s => s.definition.key === stage.key)?.definition;
    const current = merged.stages.find(s => s.key === stage.key);
    if (!old) { merged.stages.push(clone(stage)); merged.prompts[stage.key] = clone(draft.prompts[stage.key] || []); }
    else if (current) {
      for (const key of ['name', 'objective', 'instructions', 'duration_days'] as const) if (stage[key] !== old[key] && keepLocal(`${stage.key}.${key}`)) Object.assign(current, { [key]: stage[key] });
      const oldPrompts = draft.base.catalogs.find(c => c.stage_key === stage.key)?.prompts;
      if (JSON.stringify(draft.prompts[stage.key]) !== JSON.stringify(oldPrompts) && keepLocal(`${stage.key}.prompts`)) merged.prompts[stage.key] = clone(draft.prompts[stage.key] || []);
    } else if ((JSON.stringify(stage) !== JSON.stringify(old) || JSON.stringify(draft.prompts[stage.key]) !== JSON.stringify(draft.base.catalogs.find(c => c.stage_key === stage.key)?.prompts)) && keepLocal(`${stage.key}.removed`)) { merged.stages.push(clone(stage)); merged.prompts[stage.key] = clone(draft.prompts[stage.key] || []); }
  });
  const reordered = JSON.stringify(draft.stages.map(s => s.key)) !== JSON.stringify(draft.base.stages.map(s => s.definition.key));
  if (reordered && keepLocal('order')) {
    merged.stages = draft.stages.map(s => merged.stages.find(m => m.key === s.key)).filter((s): s is JournalStage => !!s);
    for (const stage of latest.stages) if (!draft.base.stages.some(b => b.definition.key === stage.definition.key) && !merged.stages.some(m => m.key === stage.definition.key)) merged.stages.push(clone(stage.definition));
    for (const stage of latest.stages) if (choices[`${stage.definition.key}.removal`] === 'current' && !merged.stages.some(m => m.key === stage.definition.key)) merged.stages.splice(Math.min(latest.stages.indexOf(stage), merged.stages.length), 0, clone(stage.definition));
  }
  // Approval is bound to the complete merged goal and questions, never a stale checkbox.
  for (const stage of merged.stages) if (draft.approvals[stage.key] === signature(merged, stage)) merged.approvals[stage.key] = draft.approvals[stage.key];
  return merged;
}

export function formatDate(value: string, timezone: string, time = false): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}), timeZone: timezone }).format(new Date(value));
}
