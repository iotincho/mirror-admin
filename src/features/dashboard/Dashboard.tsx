import { Alert, Box, Button, Card, CircularProgress, Divider, LinearProgress, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Title } from 'react-admin';
import type { Period } from '../../providers/contracts';
import { services } from '../../providers';
import { settings } from '../../config/settings';
import { PageHeading } from '../../app/PageHeading';
import { ActivityChart } from './ActivityChart';
import { formatCount, formatInstant } from './format';

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return <Card sx={{ p: 2.5, minWidth: 0 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography fontSize={{ xs: 28, md: 34 }} lineHeight={1.3} my={1.5} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography><Typography variant="caption" color="text.secondary">{caption}</Typography></Card>;
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const query = useQuery({ queryKey: ['dashboard', settings.dataMode, period], refetchInterval: settings.dataMode === 'api' ? 30_000 : false, queryFn: ({ signal }) => services.dashboardService.getDashboard(period, signal) });
  const summary = query.data?.summary;
  const completed = summary ? summary.processing.completed + summary.processing.failed : 0;
  const success = summary && completed > 0 ? new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(summary.processing.completed / completed) : 'Sin datos';
  const sources = summary ? [
    { label: 'Escritura', value: summary.notes_by_source.writing, color: '#b8d6ce' },
    { label: 'Audio', value: summary.notes_by_source.audio, color: '#d5b77e' },
    { label: 'Importación', value: summary.notes_by_source.imported, color: '#799a9c' },
  ] : [];
  const sourceTotal = sources.every(item => item.value !== null) ? sources.reduce((sum, item) => sum + (item.value ?? 0), 0) : null;
  return <>
    <Title title="Dashboard" />
    <PageHeading eyebrow="VISIÓN GENERAL" title="El pulso de la plataforma" description="Una mirada al uso y al funcionamiento de El Espejo." actions={<Select value={period} onChange={event => setPeriod(Number(event.target.value) as Period)} inputProps={{ 'aria-label': 'Período del dashboard' }} size="small" sx={{ minWidth: 170, alignSelf: { xs: 'start', sm: 'center' }, minHeight: 44 }}><MenuItem value={7}>Últimos 7 días</MenuItem><MenuItem value={30}>Últimos 30 días</MenuItem></Select>} />
    {query.isPending && <Stack role="status" alignItems="center" py={8} gap={2}><CircularProgress size={28} /><Typography color="text.secondary">Cargando métricas…</Typography></Stack>}
    {query.isError && <Alert severity="error" action={<Button color="inherit" onClick={() => void query.refetch()}>Reintentar</Button>}>No se pudieron cargar las métricas. {query.error.message} {settings.dataMode === 'api' && 'Comprobá que el servicio administrativo esté disponible.'}</Alert>}
    {summary && query.data && <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 2, mb: 3 }}>
        <Stat label="Usuarios registrados" value={formatCount(summary.users_total)} caption={`${formatCount(summary.users_active)} cuentas habilitadas`} />
        <Stat label="Notas existentes" value={formatCount(summary.notes_total)} caption={summary.coverage.documents_complete ? 'Inventario de la plataforma' : 'Inventario todavía incompleto'} />
        <Stat label="Usuarios que escribieron" value={formatCount(summary.users_wrote)} caption={`Personas únicas en ${period} días`} />
        <Stat label="Procesamientos exitosos" value={success} caption={`${formatCount(summary.processing.failed)} fallidos · solo tareas finalizadas`} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.8fr) minmax(260px,1fr)' }, gap: 3, mb: 3 }}>
        <Card sx={{ p: { xs: 2.5, md: 3 }, minWidth: 0 }}><Typography component="h2" variant="h2">Actividad en el tiempo</Typography><Typography variant="body2" color="text.secondary" mt={.8} mb={2.5}>{formatCount(summary.users_accessed)} usuarios accedieron en el período</Typography><ActivityChart points={query.data.activity} /></Card>
        <Card sx={{ p: 3, minWidth: 0 }}><Typography component="h2" variant="h2">Cómo llegan las notas</Typography><Typography variant="body2" color="text.secondary" mt={.8}>Incorporaciones en los últimos {period} días</Typography>{sources.map(source => <Box key={source.label} mt={3}><Stack direction="row" justifyContent="space-between" gap={1} mb={1}><Typography variant="body2">{source.label}</Typography><Typography variant="body2">{formatCount(source.value)}</Typography></Stack>{source.value !== null && sourceTotal !== null && <LinearProgress aria-label={`${source.label}: ${source.value} notas`} variant="determinate" value={sourceTotal ? source.value / sourceTotal * 100 : 0} sx={{ height: 7, borderRadius: 8, bgcolor: '#26383b', '& .MuiLinearProgress-bar': { bgcolor: source.color, borderRadius: 8 } }} />}</Box>)}<Divider sx={{ my: 3 }} /><Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" color="text.secondary">Notas nuevas · texto y audio</Typography><Typography>{formatCount(summary.notes_created)}</Typography></Stack><Typography variant="caption" color="text.secondary" display="block" mt={1.5}>Las importaciones se muestran separadas de las notas nuevas.</Typography></Card>
      </Box>
      <Card sx={{ p: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ xs: 'start', sm: 'center' }}><Box><Typography component="h2" variant="h2">Conocé el uso de cada cuenta</Typography><Typography variant="body2" color="text.secondary" mt={1}>Estado, última actividad y cantidad de notas.</Typography></Box><Button component={Link} to="/users" variant="outlined">Ver usuarios →</Button></Stack></Card>
      {(!summary.coverage.documents_complete || summary.coverage.activity_since === null || summary.coverage.notes_complete === false) && <Alert severity="info" sx={{ mt: 3 }}>Hay métricas con cobertura incompleta o inventario desactualizado. «Sin datos» no equivale a cero.</Alert>}
      {summary.coverage.activity_since && <Typography variant="caption" color="text.secondary" display="block" mt={2}>Accesos observados desde {formatInstant(summary.coverage.activity_since)}. Los días anteriores no están medidos.</Typography>}
      {summary.coverage.inventory_synced_at && <Typography variant="caption" color="text.secondary" display="block" mt={1}>Inventario sincronizado al {formatInstant(summary.coverage.inventory_synced_at)}.</Typography>}
      <Typography variant="caption" color="text.secondary" display="block" mt={3}>{settings.dataMode === 'demo' ? 'Ejemplo ficticio actualizado al' : 'Datos actualizados al'} {formatInstant(summary.updated_at)} · Hora de Buenos Aires.</Typography>
    </>}
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mt: 3 }}><Typography variant="body2" color="text.secondary"><Box component="strong" sx={{ color: 'primary.main', fontWeight: 500 }}>Privacidad por diseño.</Box> Este panel trabaja con metadatos. El contenido de las notas y los audios permanece fuera del acceso administrativo.</Typography></Box>
  </>;
}
