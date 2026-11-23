import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Card, Checkbox, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { JournalAdjustmentSchema, JournalRequestError } from '../../../providers/journals-contracts';
import type { JournalAdjustment, JournalConfiguration, JournalService, JournalStage } from '../../../providers/journals-contracts';
import { Calendar, Confirmation, message, Panel } from './components';
import { adjustment, blankPrompt, changes, clone, conflictingFields, createDraft, currentIndex, edited, mergeDraft, newKey, signature, validPrompts } from './editor';
import type { Draft } from './editor';

type Mode = 'edit' | 'purpose' | 'review' | 'catalog' | 'conflict';
const conflictCode = (error: unknown) => error instanceof JournalRequestError && ['journal_revision_conflict', 'journal_current_stage_required', 'journal_not_active'].includes(error.code);
const describe = (value: unknown) => typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? 'Ya no está en el recorrido');

export function JournalEditor({ owner, configuration, initialIndex, initialMode = 'edit', service, writable, busy, uncertain, onSave, onRecover, onClose }: { owner: string; configuration: JournalConfiguration; initialIndex: number; initialMode?: 'edit' | 'purpose' | 'catalog'; service: JournalService; writable: boolean; busy: boolean; uncertain: boolean; onSave: (command: JournalAdjustment) => Promise<unknown>; onRecover: () => Promise<unknown>; onClose: () => void }) {
  const [draft, setDraft] = useState(() => createDraft(configuration));
  const [index, setIndex] = useState(Math.max(0, initialIndex)), [mode, setMode] = useState<Mode>(initialMode);
  const [preview, setPreview] = useState<JournalConfiguration>(), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [depth, setDepth] = useState<'gentle' | 'middle' | 'deep'>('middle'), [checked, setChecked] = useState(false), [defer, setDefer] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'remove' | null>(null);
  const [latest, setLatest] = useState<JournalConfiguration>(), [choices, setChoices] = useState<Record<string, 'current' | 'local'>>({});
  const controller = useRef<AbortController | null>(null), alive = useRef(true);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const first = currentIndex(draft.base), stage = draft.stages[index];
  const readonly = !writable || first < 0 || (mode === 'edit' && index < first) || uncertain;
  let command: JournalAdjustment | undefined;
  try { const candidate = adjustment(draft); if (JournalAdjustmentSchema.safeParse(candidate).success) command = candidate; } catch { /* A historical configuration is read-only. */ }
  const commandKey = command ? JSON.stringify(command) : '';
  const commandRef = useRef(command); commandRef.current = command;
  const conflicts = latest ? conflictingFields(draft, latest) : [];
  const unreviewedPrompts = draft.stages.filter(s => {
    const old = draft.base.catalogs.find(c => c.stage_key === s.key)?.prompts;
    const prompts = draft.prompts[s.key] || [];
    const meaningful = old ? JSON.stringify(old) !== JSON.stringify(prompts) : prompts.some(p => p.gentle || p.middle || p.deep);
    return meaningful && draft.approvals[s.key] !== signature(draft, s);
  });
  const update = (change: (value: Draft) => void) => { setDraft(value => { const next = clone(value); change(next); return next; }); setChecked(false); setDefer(false); setError(''); };
  const updateStage = (key: keyof JournalStage, value: string | number) => update(next => Object.assign(next.stages[index], { [key]: value }));
  async function loadConflict() {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setMode('conflict'); setChoices({}); setError('');
    try { const value = await service.detail(owner, draft.base.run.id, undefined, request.signal); if (!request.signal.aborted) setLatest(value); }
    catch (e) { if (!request.signal.aborted) setError(message(e)); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  async function calculate(body: JournalAdjustment, showReview = false) {
    if (showReview && previewTimer.current) clearTimeout(previewTimer.current);
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setError(''); setPreview(undefined);
    try { const value = await service.preview(owner, draft.base.run.id, body, request.signal); if (!request.signal.aborted && JSON.stringify(body) === JSON.stringify(commandRef.current)) { setPreview(value); if (showReview) setMode('review'); } }
    catch (e) { if (!request.signal.aborted) { setError(message(e)); if (conflictCode(e)) { await loadConflict(); return; } } }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    setPreview(undefined);
    if (!commandKey || !writable || uncertain || mode === 'conflict') return;
    const timer = setTimeout(() => { if (commandRef.current) void calculate(commandRef.current); }, 500);
    previewTimer.current = timer;
    return () => { clearTimeout(timer); };
    // The serialized command is the identity of this read-only preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandKey, writable, uncertain, mode === 'conflict']);
  useEffect(() => {
    if (!edited(draft)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);
  const dismiss = () => { if (busy || loading) return; if (edited(draft) && !uncertain) setConfirm('discard'); else onClose(); };
  async function save() { if (!command) return; setError(''); try { await onSave(command); } catch (e) { if (alive.current) { setError(message(e)); if (conflictCode(e)) await loadConflict(); } } }
  async function recoverRequest() { setError(''); try { await onRecover(); } catch (e) { if (alive.current) setError(message(e)); } }
  function catalog(stageIndex: number) { setIndex(stageIndex); setDepth('middle'); setChecked(false); setMode('catalog'); setError(''); if (!draft.prompts[draft.stages[stageIndex].key]) update(next => { next.prompts[next.stages[stageIndex].key] = [blankPrompt()]; }); }
  function approve() {
    if (!validPrompts(draft.prompts[stage.key] || [])) { setError('Cada variante debe ser distinta, ocupar una línea, contener una pregunta y tener hasta 240 caracteres. Revisá las tres profundidades.'); return; }
    const next = clone(draft); next.approvals[stage.key] = signature(next, stage); setDraft(next); setMode('review'); setChecked(false); setDefer(false);
  }
  const title = uncertain ? 'Falta confirmar el guardado' : mode === 'conflict' ? 'El recorrido cambió' : mode === 'catalog' ? 'Preguntas de respaldo' : mode === 'purpose' ? 'Orientación del recorrido' : mode === 'review' ? 'Revisar el ajuste' : readonly ? 'Configuración de la etapa' : 'Ajustar etapa';
  const saveDisabled = !command || !preview || loading || busy || !edited(draft) || !!unreviewedPrompts.length || (!!preview.catalog_review_required.length && !defer);
  let actions;
  if (uncertain) actions = <><Button onClick={onClose}>Cerrar editor</Button><Button variant="contained" onClick={recoverRequest} disabled={busy}>Comprobar resultado</Button></>;
  else if (mode === 'conflict') actions = <><Button onClick={() => setConfirm('discard')} disabled={busy}>Descartar borrador</Button><Button variant="contained" disabled={!latest || loading || conflicts.some(c => !choices[c.id]) || latest.editable_stage_id !== draft.base.editable_stage_id} onClick={() => { try { setDraft(mergeDraft(draft, latest!, choices)); setMode('review'); setLatest(undefined); setPreview(undefined); setDefer(false); setError(''); } catch (e) { setError(message(e)); } }}>Recuperar borrador</Button></>;
  else if (mode === 'catalog') actions = <><Button onClick={() => setMode('review')}>Volver al ajuste</Button><Button variant="contained" onClick={approve} disabled={!checked || busy}>Confirmar revisión</Button></>;
  else if (mode === 'review') actions = <><Button onClick={() => setMode('edit')} disabled={busy}>Volver a editar</Button><Button variant="contained" onClick={save} disabled={saveDisabled}>{busy ? 'Guardando…' : 'Guardar ajuste'}</Button></>;
  else actions = <><Button onClick={dismiss} disabled={busy || loading}>{readonly ? 'Cerrar' : 'Cancelar'}</Button>{!readonly && <Button variant="contained" disabled={!command || busy || !edited(draft)} onClick={() => command && void calculate(command, true)}>{loading ? 'Calculando…' : 'Revisar cambios'}</Button>}</>;
  return <><Panel title={title} subtitle={mode === 'catalog' ? stage.name : 'Los ajustes cambian esta copia personal y las preguntas futuras.'} onClose={dismiss} busy={busy} actions={actions}>
    {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}
    {uncertain ? <Alert severity="warning">Todavía no sabemos si el cambio se guardó. Conservamos la misma solicitud para comprobar o completar su resultado sin duplicarlo. Antes de recargar o cerrar el navegador, resolvé este guardado.</Alert> : <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    {mode === 'edit' && <><TextField select fullWidth label="Etapa seleccionada" value={index} onChange={e => { setIndex(Number(e.target.value)); setError(''); }} sx={{ mb: 3 }}>{draft.stages.map((s, i) => <MenuItem key={s.key} value={i}>{String(i + 1).padStart(2, '0')} · {s.name}{i < first ? ' · Completada' : ''}</MenuItem>)}</TextField><Stack gap={2.5}>
      <TextField label="Nombre de la etapa" value={stage.name} onChange={e => updateStage('name', e.target.value)} slotProps={{ htmlInput: { maxLength: 120, readOnly: readonly } }} />
      <TextField label="Objetivo de exploración" multiline minRows={3} value={stage.objective} onChange={e => updateStage('objective', e.target.value)} helperText="Define para qué se pregunta durante esta etapa." slotProps={{ htmlInput: { maxLength: 2000, readOnly: readonly } }} />
      <TextField label="Indicaciones para las preguntas" multiline minRows={3} value={stage.instructions} onChange={e => updateStage('instructions', e.target.value)} helperText="Orientación acordada; no es un registro privado de la sesión." slotProps={{ htmlInput: { maxLength: 4000, readOnly: readonly } }} />
      <TextField label="Duración de la etapa" type="number" value={Number.isNaN(stage.duration_days) ? '' : stage.duration_days} onChange={e => updateStage('duration_days', e.target.value === '' ? NaN : Number(e.target.value))} helperText="Días de calendario desde el inicio de la etapa; el contador no vuelve a empezar al guardar." slotProps={{ htmlInput: { min: 1, max: 365, step: 1, readOnly: readonly } }} />
      {!readonly && <Alert severity="info">Cambiar el objetivo o las indicaciones requiere revisar el respaldo. Ajustar sólo la duración conserva su aprobación.</Alert>}
      <Typography variant="h3">Calendario resultante</Typography>{loading ? <Typography color="text.secondary" fontSize={12} role="status">Calculando fechas…</Typography> : preview ? <Calendar configuration={preview} before={draft.base} /> : <><Calendar configuration={draft.base} /><Typography color="text.secondary" fontSize={11}>Las fechas actuales se conservan hasta calcular un ajuste válido.</Typography></>}
      {!readonly && <><Stack direction="row" gap={1} alignItems="center" justifyContent="space-between"><Typography variant="h3">Etapas futuras</Typography><Button startIcon={<AddIcon />} disabled={draft.stages.length >= 52} onClick={() => { const next = clone(draft); const s = { key: `stage-${newKey()}`, name: 'Nueva etapa', objective: '', instructions: '', duration_days: 7 }; next.stages.push(s); next.prompts[s.key] = [blankPrompt()]; setIndex(next.stages.length - 1); setDraft(next); }}>Agregar</Button></Stack>{index > first ? <Stack direction="row" gap={1} flexWrap="wrap"><Button startIcon={<ArrowUpwardIcon />} disabled={index <= first + 1} onClick={() => { update(d => { [d.stages[index - 1], d.stages[index]] = [d.stages[index], d.stages[index - 1]]; }); setIndex(index - 1); }}>Subir</Button><Button startIcon={<ArrowDownwardIcon />} disabled={index === draft.stages.length - 1} onClick={() => { update(d => { [d.stages[index + 1], d.stages[index]] = [d.stages[index], d.stages[index + 1]]; }); setIndex(index + 1); }}>Bajar</Button><Button color="error" onClick={() => setConfirm('remove')}>Quitar etapa</Button></Stack> : <Typography color="text.secondary" fontSize={12}>Seleccioná una etapa futura para reordenarla o quitarla. Las etapas completadas se conservan.</Typography>}</>}
    </Stack></>}
    {mode === 'purpose' && <Stack gap={3}><TextField label="Propósito general" multiline minRows={3} value={draft.purpose} onChange={e => update(d => { d.purpose = e.target.value; })} slotProps={{ htmlInput: { maxLength: 2000, readOnly: readonly } }} /><TextField label="Indicaciones generales" multiline minRows={5} value={draft.instructions} onChange={e => update(d => { d.instructions = e.target.value; })} slotProps={{ htmlInput: { maxLength: 4000, readOnly: readonly } }} /><Alert severity="info">Cambiar estos campos requiere revisar el respaldo de las etapas pendientes. La intención personal se edita desde la app del usuario.</Alert></Stack>}
    {mode === 'review' && <Stack gap={2}>{changes(draft).map(item => <Card variant="outlined" key={item.id} sx={{ p: 2 }}><Typography fontSize={12} color="secondary" mb={1}>{item.label}</Typography><Typography color="text.secondary" fontSize={10}>ANTES</Typography><Typography color="text.secondary" fontSize={12} whiteSpace="pre-wrap" mb={1.5}>{describe(item.before)}</Typography><Typography color="text.secondary" fontSize={10}>DESPUÉS</Typography><Typography fontSize={12} whiteSpace="pre-wrap">{describe(item.after)}</Typography></Card>)}{loading && <Typography role="status" color="text.secondary">Comprobando el calendario y el respaldo…</Typography>}{preview && <><Typography variant="h3">Así queda el calendario</Typography><Calendar configuration={preview} before={draft.base} />{preview.catalog_review_required.length ? <><Alert severity="warning">Hay {preview.catalog_review_required.length} {preview.catalog_review_required.length === 1 ? 'etapa pendiente' : 'etapas pendientes'} de revisión del respaldo. Mientras estén pendientes, no emitirán la pregunta del journal.</Alert>{preview.catalog_review_required.map(key => { const i = draft.stages.findIndex(s => s.key === key); return i >= 0 ? <Button key={key} variant="outlined" onClick={() => catalog(i)}>Revisar · {draft.stages[i].name}</Button> : null; })}<FormControlLabel sx={{ alignItems: 'flex-start' }} control={<Checkbox checked={defer} onChange={(_, value) => setDefer(value)} />} label={<Typography fontSize={12} pt={1}>Guardaré el ajuste y revisaré el respaldo después. Entiendo que esas etapas no emitirán su pregunta mientras estén pendientes.</Typography>} /></> : <Alert severity="success">El respaldo es compatible con los objetivos pendientes. Se conservan los límites de temas del usuario.</Alert>}</>}{unreviewedPrompts.length > 0 && <Alert severity="warning">Hay textos de preguntas modificados sin aprobar. Confirmá su revisión antes de guardar; esos textos todavía no se incluirán en la solicitud.</Alert>}<Typography color="text.secondary" fontSize={12}>Las preguntas ya publicadas y sus respuestas conservan el contexto con el que se crearon.</Typography></Stack>}
    {mode === 'catalog' && <Stack gap={2}><Typography color="text.secondary" fontSize={12}>Se usan sin notas o cuando no hay una propuesta personal elegible. Revisá los temas y sus tres profundidades.</Typography><Card variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary" fontSize={11}>Objetivo a acompañar</Typography><Typography fontSize={13} mt={1}>{stage.objective}</Typography></Card><ToggleButtonGroup exclusive value={depth} onChange={(_, value) => { if (value) { setDepth(value); setChecked(false); } }} fullWidth size="small" aria-label="Profundidad de preguntas">{([['gentle', 'Suave'], ['middle', 'Intermedia'], ['deep', 'Profunda']] as const).map(([key, label]) => <ToggleButton key={key} value={key}>{label}</ToggleButton>)}</ToggleButtonGroup>{(draft.prompts[stage.key] || []).map((prompt, i) => <TextField key={prompt.key} label={`Tema ${i + 1} · ${depth === 'gentle' ? 'Suave' : depth === 'middle' ? 'Intermedia' : 'Profunda'}`} multiline minRows={2} value={prompt[depth]} onChange={e => update(d => { d.prompts[stage.key][i][depth] = e.target.value; })} slotProps={{ htmlInput: { maxLength: 240 } }} helperText={`${prompt[depth].length}/240`} />)}{!draft.base.catalogs.some(c => c.stage_key === stage.key) && <Button startIcon={<AddIcon />} disabled={(draft.prompts[stage.key]?.length || 0) >= 12} onClick={() => update(d => { d.prompts[stage.key] = [...(d.prompts[stage.key] || []), blankPrompt()]; })}>Agregar tema de respaldo</Button>}<Alert severity="info">Los temas conservan su identidad. Aprobar estas preguntas no reabre un tema cerrado por el usuario.</Alert><FormControlLabel sx={{ alignItems: 'flex-start' }} control={<Checkbox checked={checked} onChange={(_, value) => setChecked(value)} />} label={<Typography fontSize={12} pt={1}>Revisé todos los temas y sus variantes suave, intermedia y profunda. Son adecuados para este objetivo.</Typography>} /><Button onClick={() => { update(d => { d.prompts[stage.key] = clone(d.base.catalogs.find(c => c.stage_key === stage.key)?.prompts || [blankPrompt()]); delete d.approvals[stage.key]; }); }}>Restablecer los textos anteriores</Button></Stack>}
    {mode === 'conflict' && <Stack gap={2}><Alert severity="warning">Tu borrador se conserva. No sobrescribimos la revisión más reciente. Los campos distintos se combinan; elegí qué conservar si cambió un mismo campo.</Alert>{loading && <Typography role="status">Cargando la configuración actual…</Typography>}{latest && <><Typography variant="h3">Versión actual · Revisión {latest.run.revision}</Typography><Calendar configuration={latest} before={draft.base} />{latest.editable_stage_id !== draft.base.editable_stage_id && <Alert severity="warning">El calendario avanzó o cambió el estado. Conservamos tu borrador debajo para que puedas revisar los cambios antes de abrir la configuración actual.</Alert>}{conflicts.map(c => <Card variant="outlined" sx={{ p: 2 }} key={c.id}><Typography variant="h3">{c.label}</Typography><RadioGroup aria-label={c.label} value={choices[c.id] || ''} onChange={(_, value) => setChoices({ ...choices, [c.id]: value as 'current' | 'local' })}><FormControlLabel value="current" control={<Radio />} label={<Box my={1}><Typography fontSize={12}>Versión actual</Typography><Typography fontSize={11} color="text.secondary" whiteSpace="pre-wrap">{describe(c.current)}</Typography></Box>} /><FormControlLabel value="local" control={<Radio />} label={<Box my={1}><Typography fontSize={12}>Mi borrador</Typography><Typography fontSize={11} color="text.secondary" whiteSpace="pre-wrap">{describe(c.local)}</Typography></Box>} /></RadioGroup></Card>)}</>}<Typography variant="h3">Tu borrador</Typography>{changes(draft).map(c => <Box key={c.id}><Typography color="secondary" fontSize={11}>{c.label}</Typography><Typography fontSize={12} whiteSpace="pre-wrap">{describe(c.after)}</Typography></Box>)}{!latest && !loading && <Button onClick={() => void loadConflict()}>Reintentar lectura</Button>}</Stack>}
    </fieldset>}
  </Panel>{confirm && <Confirmation title={confirm === 'remove' ? '¿Quitar esta etapa futura?' : '¿Salir sin guardar el borrador?'} text={confirm === 'remove' ? `«${stage.name}» saldrá del calendario al guardar. Las revisiones anteriores se conservan.` : 'El borrador local se descartará. Los cambios confirmados del recorrido se conservan.'} label={confirm === 'remove' ? 'Quitar etapa' : 'Salir sin guardar'} danger={confirm === 'remove'} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm === 'remove') { update(d => { d.stages.splice(index, 1); }); setIndex(Math.max(first, index - 1)); setConfirm(null); } else onClose(); }} />}</>;
}
