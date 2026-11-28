import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CircularProgress, Collapse, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AiUsageService, AiUsageSummary, UsageAmounts } from '../../providers/ai-usage';
import type { Period } from '../../providers/contracts';
import { services } from '../../providers';
import { formatCount, formatDay } from '../dashboard/format';

const COVERAGE = { complete: 'Medido', partial: 'Cobertura parcial', unavailable: 'Sin datos' };
const FEATURES: Record<string, string> = {
  document_title: 'Títulos',
  emotions: 'Emociones',
  embedding_segmentation: 'Segmentación',
  document_embeddings: 'Embeddings',
  transcription: 'Transcripciones',
  axis_criterion: 'Criterios de ejes',
  personal_axis: 'Extracciones de ejes',
  daily_question: 'Pregunta diaria',
  journal_question: 'Preguntas de Journals',
  daily_question_evaluation: 'Evaluación de pregunta diaria',
};
const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const columns = ['Tokens registrados', 'Tokens de entrada', 'Tokens de salida', 'Minutos de audio', 'Intentos sin medición completa'];

function formatMinutes(seconds: number | null) {
  if (seconds === null) return 'Sin datos';
  const minutes = seconds / 60;
  return minutes > 0 && minutes < 0.01 ? '<0,01' : numberFormat.format(minutes);
}

function values(amounts: UsageAmounts) {
  return [
    formatCount(amounts.total_tokens), formatCount(amounts.input_tokens), formatCount(amounts.output_tokens),
    formatMinutes(amounts.duration_seconds), formatCount(amounts.unmeasured_attempts),
  ];
}

type UsageRow = { id: string; label: ReactNode; amounts: UsageAmounts };

function UsageTable({ label, first, rows }: { label: string; first: string; rows: UsageRow[] }) {
  return <Box tabIndex={0} role="region" aria-label={label} sx={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
    <Table size="small" aria-label={label} sx={{ minWidth: 560 }}>
      <TableHead><TableRow><TableCell>{first}</TableCell>{columns.map(column => <TableCell key={column} align="right">{column}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id}>
        <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>{row.label}</TableCell>
        {values(row.amounts).map((value, index) => <TableCell key={columns[index]} align="right" sx={{ whiteSpace: 'nowrap' }}>{value}</TableCell>)}
      </TableRow>)}</TableBody>
    </Table>
  </Box>;
}

function UsageTimeline({ daily }: { daily: AiUsageSummary['daily'] }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const peak = Math.max(1, ...daily.map(day => day.total_tokens ?? 0));
  const first = daily[0];
  const last = daily[daily.length - 1];
  return <Box>
    <Typography component="h3" variant="h3" mb={2}>Tokens por día</Typography>
    <Stack direction="row" gap={1.5} aria-hidden="true">
      <Stack justifyContent="space-between" alignItems="end" height={125}>
        <Typography variant="caption" color="text.secondary">{formatCount(peak)}</Typography>
        <Typography variant="caption" color="text.secondary">0</Typography>
      </Stack>
      <Box flex={1} minWidth={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))`, gap: { xs: .4, sm: .75 }, height: 125, alignItems: 'end', borderBottom: '1px solid', borderColor: 'divider' }}>
          {daily.map(day => <Box key={day.date} title={`${formatDay(day.date)} · ${formatCount(day.total_tokens)} · ${COVERAGE[day.coverage]}`} sx={{
            height: `${((day.total_tokens ?? 0) / peak) * 100}%`, minHeight: day.total_tokens === null ? 1 : 3,
            borderRadius: '3px 3px 0 0',
            bgcolor: day.total_tokens === null ? 'transparent' : day.coverage === 'partial' ? 'secondary.main' : 'primary.main',
            borderBottom: day.total_tokens === null ? '1px dashed' : 0, borderColor: 'text.disabled',
          }} />)}
        </Box>
        <Stack direction="row" justifyContent="space-between" mt={.5}>
          <Typography variant="caption" color="text.secondary">{first && formatDay(first.date)}</Typography>
          <Typography variant="caption" color="text.secondary">{last && formatDay(last.date)}</Typography>
        </Stack>
      </Box>
    </Stack>
    <Button size="small" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={id}>
      {expanded ? 'Ocultar datos diarios' : 'Ver datos diarios'}
    </Button>
    <Collapse in={expanded} id={id}>
      <UsageTable label="Consumo diario" first="Fecha" rows={daily.map(day => ({
        id: day.date, amounts: day,
        label: <>{formatDay(day.date)}<Typography variant="caption" color="text.secondary" display="block">{COVERAGE[day.coverage]}</Typography></>,
      }))} />
    </Collapse>
  </Box>;
}

function AiUsageRanking({ service, period }: { service: AiUsageService; period: Period }) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const query = useQuery({
    queryKey: ['ai-usage-ranking', period, page], refetchInterval: 30_000,
    queryFn: ({ signal }) => service.ranking(period, page, perPage, signal),
  });
  const data = query.data;
  return <Box>
    <Typography component="h3" variant="h3" mb={2}>Ranking por cuenta</Typography>
    {query.isPending && <Typography role="status" color="text.secondary">Cargando cuentas…</Typography>}
    {query.isError && <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Reintentar</Button>}>No se pudo cargar el ranking.</Alert>}
    {data && <>
      {data.items.length === 0 ? <Typography color="text.secondary">{page === 1 ? 'No hay cuentas con intentos registrados en este período.' : 'No hay cuentas en esta página.'}</Typography> :
        <UsageTable label="Ranking por tokens registrados" first="Cuenta" rows={data.items.map(user => ({
          id: user.user_id, amounts: user,
          label: <Link to={`/users/${user.user_id}/show?tab=usage&period_days=${period}`}>{user.email}</Link>,
        }))} />}
      {(page > 1 || data.total > perPage) && <Stack direction="row" alignItems="center" gap={1} mt={1} flexWrap="wrap">
        <Button size="small" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</Button>
        <Typography variant="body2" color="text.secondary">Página {page}</Typography>
        <Button size="small" disabled={page * perPage >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
      </Stack>}
    </>}
  </Box>;
}

function UsageData({ service, period, userId }: { service: AiUsageService; period: Period; userId?: string }) {
  const query = useQuery({
    queryKey: ['ai-usage', period, userId], refetchInterval: 30_000,
    queryFn: ({ signal }) => service.summary(period, userId, signal),
  });
  if (query.isPending) return <Stack direction="row" role="status" alignItems="center" gap={1.5}><CircularProgress size={20} />Cargando consumo…</Stack>;
  if (query.isError) return <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Reintentar</Button>}>No se pudo cargar el consumo de IA.</Alert>;
  const data = query.data;
  if (data.coverage === 'unavailable') return <Typography color="text.secondary">Sin datos de consumo en este período.</Typography>;
  return <Stack gap={3}>
    {data.coverage === 'partial' && <Alert severity="info">Cobertura parcial. Parte del período quedó fuera de la medición o hay intentos con uso desconocido.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 2 }}>
      {values(data.totals).map((value, index) => <Box key={columns[index]} sx={{ minWidth: 0, borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{columns[index]}</Typography>
        <Typography sx={{ overflowWrap: 'anywhere' }} fontSize={{ xs: 20, sm: 24 }} mt={.5}>{value}</Typography>
      </Box>)}
    </Box>
    <UsageTimeline daily={data.daily} />
    {data.by_model.length > 0 && <Box><Typography component="h3" variant="h3" mb={2}>Por modelo</Typography>
      <UsageTable label="Consumo por modelo" first="Modelo" rows={data.by_model.map(model => ({
        id: `${model.provider}/${model.model}`, amounts: model,
        label: <>{model.model}<Typography variant="caption" color="text.secondary" display="block">{model.provider}</Typography></>,
      }))} />
    </Box>}
    {data.by_feature.length > 0 && <Box><Typography component="h3" variant="h3" mb={2}>Por funcionalidad</Typography>
      <UsageTable label="Consumo por funcionalidad" first="Funcionalidad" rows={data.by_feature.map(feature => ({
        id: feature.feature, amounts: feature, label: FEATURES[feature.feature] ?? feature.feature,
      }))} />
    </Box>}
    {userId === undefined && <AiUsageRanking key={period} service={service} period={period} />}
  </Stack>;
}

export function AiUsagePanel({ period, userId, actions }: { period: Period; userId?: string; actions?: ReactNode }) {
  const id = useId();
  const service = services.usageService;
  return <Card component="section" aria-labelledby={id} sx={{ mt: 3, p: { xs: 2.5, md: 3 }, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} mb={2}>
      <Typography id={id} component={userId === undefined ? 'h2' : 'h3'} variant="h2">Consumo de IA</Typography>
      {actions}
    </Stack>
    {service ? <UsageData service={service} period={period} userId={userId} /> :
      <Typography color="text.secondary">El consumo de IA está disponible en modo API.</Typography>}
  </Card>;
}
