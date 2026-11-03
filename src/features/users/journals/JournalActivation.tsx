import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, Checkbox, CircularProgress, FormControlLabel, MenuItem, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import type { JournalActivation, JournalConfiguration, JournalService, JournalTemplate } from '../../../providers/journals-contracts';
import { Calendar, message, Panel } from './components';
import { formatDate } from './editor';

export function JournalActivationPanel({ owner, email, service, onSave, onClose, busy, uncertain, onRecover }: { owner: string; email: string; service: JournalService; onSave: (body: JournalActivation) => Promise<unknown>; onClose: () => void; busy: boolean; uncertain: boolean; onRecover: () => Promise<unknown> }) {
  const templates = useQuery({ queryKey: ['journal-templates'], queryFn: ({ signal }) => service.templates(signal), retry: false });
  const [selected, setSelected] = useState<JournalTemplate>();
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [step, setStep] = useState(0), [preview, setPreview] = useState<JournalConfiguration>();
  const [accepted, setAccepted] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const zones = Array.from(new Set([timezone, 'America/Argentina/Buenos_Aires', 'UTC', ...Intl.supportedValuesOf('timeZone')]));
  const available = templates.data?.filter(t => !templates.data!.some(other => other.id === t.id && other.version > t.version));
  const template = selected || available?.[0];
  const body = (): JournalActivation => ({ template_id: template!.id, template_version: template!.version, timezone });
  async function calculate() {
    if (!template || loading) return;
    setError(''); setLoading(true); controller.current?.abort(); const request = new AbortController(); controller.current = request;
    try { const value = await service.previewActivation(owner, body(), request.signal); if (!request.signal.aborted) { setPreview(value); setStep(1); setAccepted(false); } }
    catch (e) { if (!request.signal.aborted) setError(message(e)); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  async function save() { setError(''); try { if (uncertain) await onRecover(); else await onSave(body()); } catch (e) { setError(message(e)); } }
  return <Panel title="Activar un journal" subtitle={`Para ${email}`} onClose={onClose} busy={busy || loading} actions={<><Button onClick={step === 0 ? onClose : () => { setStep(step - 1); setError(''); }} disabled={busy || loading}>{step === 0 ? 'Cancelar' : 'Volver'}</Button><Button variant="contained" onClick={uncertain ? save : step === 0 ? calculate : step === 1 ? () => setStep(2) : save} disabled={busy || loading || (!uncertain && (!template || (step === 2 && !accepted)))}>{busy ? 'Activando…' : uncertain ? 'Comprobar resultado' : loading ? 'Calculando…' : step === 2 ? 'Activar recorrido' : 'Continuar'}</Button></>}>
    <fieldset disabled={busy || uncertain || loading} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>{['Template', 'Calendario', 'Activación'].map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
    {uncertain && <Alert severity="warning" sx={{ mb: 2 }}>Falta confirmar la activación. Conservamos la solicitud original en esta sesión. Comprobá su resultado antes de recargar o iniciar otro recorrido.</Alert>}{error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}
    {templates.isPending && <CircularProgress aria-label="Cargando templates" size={24} />}
    {templates.error && <Alert severity="error" action={<Button onClick={() => void templates.refetch()}>Reintentar</Button>}>{message(templates.error)}</Alert>}
    {templates.data?.length === 0 && <Alert severity="info">No hay templates instalados. La instalación se realiza al iniciar la reconciliación de Journals.</Alert>}
    {step === 0 && <Stack gap={2}>{available?.map(t => <Card key={`${t.id}:${t.version}`} variant="outlined" sx={{ p: 2.5, borderColor: template?.id === t.id && template.version === t.version ? 'primary.main' : 'divider', bgcolor: 'background.default' }}><Button aria-pressed={template?.id === t.id && template.version === t.version} onClick={() => setSelected(t)} sx={{ width: '100%', textAlign: 'left', justifyContent: 'space-between', mb: 1 }}>{t.name} · v{t.version}{template?.id === t.id && template.version === t.version && <CheckIcon fontSize="small" />}</Button><Typography color="text.secondary" fontSize={12}>{t.purpose}</Typography><Typography fontSize={11} color="secondary" mt={2}>{t.stages.length} etapas · {t.stages.reduce((n, s) => n + s.duration_days, 0)} días de calendario</Typography><Box component="details" sx={{ mt: 1.5 }}><Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', minHeight: 44, py: 1 }}>Ver qué explora cada etapa</Box>{t.stages.map(s => <Box key={s.key} my={1}><Typography fontSize={12}>{s.name} · {s.duration_days} días</Typography><Typography color="text.secondary" fontSize={11}>{s.objective}</Typography></Box>)}</Box></Card>)}<Alert severity="info">Se crea una copia personal. Los ajustes posteriores no modifican el template.</Alert></Stack>}
    {step === 1 && preview && <><Typography component="h3" variant="h3">Etapas con avance automático</Typography><Calendar configuration={preview} /><TextField select fullWidth margin="normal" label="Zona horaria del recorrido" value={timezone} onChange={e => { setTimezone(e.target.value); setPreview(undefined); setStep(0); }} helperText="La zona se fija al activar. Cambiarla vuelve al inicio para calcular el calendario." SelectProps={{ native: false }}>{zones.map(z => <MenuItem key={z} value={z}>{z.replaceAll('_', ' ')}</MenuItem>)}</TextField><Alert severity="info" sx={{ mt: 2 }}>Inicio inmediato. La primera etapa termina el {formatDate(preview.stages[0].ends_at, timezone, true)}. El primer día puede ser parcial.</Alert><Typography color="text.secondary" fontSize={12} mt={2}>No hace falta confirmar el paso entre etapas. Los ajustes después de cada sesión son opcionales.</Typography></>}
    {step === 2 && preview && <><Card variant="outlined" sx={{ p: 2.5 }}><Typography fontSize={10} color="secondary" letterSpacing={1.5}>NUEVA COPIA · TEMPLATE V{template?.version}</Typography><Typography fontFamily="Georgia, serif" fontSize={26} my={1.5}>{template?.name}</Typography><Typography color="text.secondary" fontSize={12}>{template?.purpose}</Typography><Typography mt={2}>{formatDate(preview.started_at, timezone, true)} → {formatDate(preview.stages.at(-1)!.ends_at, timezone)}</Typography><Typography color="text.secondary" fontSize={11}>{timezone.replaceAll('_', ' ')} · El inicio exacto se fija al confirmar.</Typography></Card><Alert severity="info" sx={{ my: 2 }}>La próxima pregunta programada usará este recorrido. No se crea otra pregunta hoy ni se cambian el horario o los avisos del usuario.</Alert><Typography color="text.secondary" fontSize={12}>Se conservan los límites de temas y la escritura libre. Las notas anteriores no se reasignan.</Typography><FormControlLabel sx={{ mt: 2, alignItems: 'flex-start' }} control={<Checkbox checked={accepted} onChange={(_, value) => setAccepted(value)} />} label={<Typography fontSize={12} pt={1}>Revisé el template, las etapas y el calendario para esta cuenta.</Typography>} /></>}
  </fieldset></Panel>;
}
