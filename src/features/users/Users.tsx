import { useState } from 'react';
import { Alert, Box, Card, Chip, Divider, FormControlLabel, Stack, Switch, Typography, useMediaQuery } from '@mui/material';
import type { Theme } from '@mui/material';
import { DataTable, List, SearchInput, SelectInput, Show, ShowButton, SimpleList, useRefresh, useRecordContext, useUpdate, useNotify } from 'react-admin';
import { Link } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Button } from '@mui/material';
import type { AdminUser } from '../../providers/contracts';
import { PageHeading } from '../../app/PageHeading';
import { formatCount, formatInstant } from '../dashboard/format';

function AccountState({ user }: { user: AdminUser }) {
  return <Chip size="small" variant="outlined" color={user.is_active ? 'success' : 'default'} label={user.is_active ? 'Habilitada' : 'Deshabilitada'} sx={{ fontSize: 11 }} />;
}

const filters = [
  <SearchInput key="q" source="q" placeholder="Buscar correo o identificador" alwaysOn sx={{ minWidth: { xs: 0, sm: 280 } }} />,
  <SelectInput key="state" source="is_active" label="Estado de la cuenta" choices={[{ id: true, name: 'Habilitada' }, { id: false, name: 'Deshabilitada' }]} emptyText="Todos los estados" alwaysOn sx={{ minWidth: { xs: 0, sm: 190 } }} />,
];

export function UserList() {
  const mobile = useMediaQuery<Theme>(theme => theme.breakpoints.down('sm'));
  return <>
    <PageHeading eyebrow="CUENTAS" title="Usuarios" description="Estado de las cuentas y uso de la plataforma." />
    <List title="Usuarios" queryOptions={{ refetchInterval: 30_000 }} actions={false} filters={filters} exporter={false} perPage={10} sort={{ field: 'last_activity_at', order: 'DESC' }} error={<UserReadError />} empty={<Box p={4}><Typography>No hay cuentas disponibles.</Typography></Box>} sx={{ '& .RaList-main': { minWidth: 0 }, '& .RaList-content': { overflow: 'hidden' }, '& .RaFilterForm-form': { flexWrap: 'wrap', px: 2, pt: 1 }, '& .RaFilterForm-input': { minWidth: 0, maxWidth: '100%' } }}>
      {mobile ? <SimpleList<AdminUser> primaryText={user => user.email} secondaryText={user => <Box component="span" sx={{ display: 'block', mt: .5 }}><Box component="span" sx={{ display: 'block' }}>{user.is_active ? 'Habilitada' : 'Deshabilitada'} · {user.laboratory_enabled ? 'Laboratorio habilitado' : 'Laboratorio sin acceso'} · {user.notes_count === null ? 'Notas sin datos' : `${formatCount(user.notes_count)} notas`}</Box><Typography component="span" variant="caption" sx={{ display: 'block', mt: .5 }}>Última actividad: {formatInstant(user.last_activity_at)}</Typography></Box>} linkType="show" sx={{ '& .MuiListItemText-primary': { overflowWrap: 'anywhere' } }} /> :
        <Box sx={{ overflowX: 'auto' }}><DataTable<AdminUser> rowClick="show" bulkActionButtons={false} sx={{ minWidth: 780 }}>
          <DataTable.Col<AdminUser> source="email" label="Correo electrónico" />
          <DataTable.Col<AdminUser> source="is_active" label="Estado" render={user => <AccountState user={user} />} />
          <DataTable.Col<AdminUser> label="Laboratorio" render={user => <Chip size="small" variant="outlined" label={user.laboratory_enabled ? 'Habilitado' : 'Sin acceso'} color={user.laboratory_enabled ? 'secondary' : 'default'} />} />
          <DataTable.Col<AdminUser> source="notes_count" label="Notas existentes" align="right" render={user => formatCount(user.notes_count)} />
          <DataTable.Col<AdminUser> source="last_activity_at" label="Última actividad" render={user => formatInstant(user.last_activity_at)} />
          <DataTable.Col<AdminUser> label="Detalle"><ShowButton label="Ver cuenta" /></DataTable.Col>
        </DataTable></Box>}
    </List>
    <Typography variant="body2" color="text.secondary" mt={2}>Los datos desconocidos se muestran como «Sin datos». Podés habilitar el acceso experimental a Laboratorio desde el detalle de cada cuenta.</Typography>
  </>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <Box minWidth={0}><Typography variant="body2" color="text.secondary" mb={.8}>{label}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></Box>;
}

function LaboratoryAccess({ user }: { user: AdminUser }) {
  const [update, { isPending }] = useUpdate<AdminUser>();
  const refresh = useRefresh();
  const notify = useNotify();
  const [error, setError] = useState(false);
  function change(enabled: boolean) {
    setError(false);
    update('users', { id: user.id, data: { laboratory_enabled: enabled }, previousData: user }, {
      mutationMode: 'pessimistic',
      onSuccess: () => {
        notify(enabled ? 'laboratory.access_enabled' : 'laboratory.access_disabled', { type: 'success' });
        refresh();
      },
      onError: () => { setError(true); refresh(); },
    });
  }
  return <Card variant="outlined" sx={{ mt: 4, p: { xs: 2, sm: 3 } }}>
    <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap" mb={1}>
      <Typography variant="h3" component="h3">Laboratorio</Typography>
      <Chip label="Experimental" size="small" variant="outlined" color="secondary" sx={{ fontSize: 10 }} />
    </Stack>
    <Typography variant="body2" color="text.secondary" mb={1}>Permite crear ejes personales y explorar sus hallazgos.</Typography>
    <FormControlLabel sx={{ minHeight: 44, ml: 0 }} label={isPending ? 'Guardando acceso…' : 'Habilitar para esta cuenta'} labelPlacement="start" control={<Switch checked={user.laboratory_enabled} disabled={isPending} onChange={(_, checked) => change(checked)} />} />
    {!user.laboratory_global_enabled && <Alert severity="info" sx={{ mt: 1 }}>Laboratorio está apagado globalmente. El permiso se conserva y tendrá efecto cuando se encienda.</Alert>}
    {!user.is_active && <Typography variant="body2" color="text.secondary" mt={1}>La cuenta está deshabilitada. El permiso no cambia su estado de acceso a la plataforma.</Typography>}
    <Typography variant="body2" color="text.secondary" mt={1}>Al quitar el acceso se conservan los ejes y sus resultados. Las tareas ya aceptadas pueden terminar.</Typography>
    {error && <Alert severity="error" sx={{ mt: 2 }}>No se pudo confirmar el cambio. Revisá el estado actualizado antes de reintentar.</Alert>}
  </Card>;
}

function UserDetails() {
  const user = useRecordContext<AdminUser>();
  if (!user) return null;
  return <Box p={{ xs: 2.5, md: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}><Box minWidth={0}><Typography variant="h2" component="h2" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography><Typography variant="body2" color="text.secondary" mt={1}>Identidad de la cuenta</Typography></Box><AccountState user={user} /></Stack>
    <Divider sx={{ mb: 3 }} /><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
      <DetailItem label="Identificador" value={user.id} /><DetailItem label="Fecha de alta" value={formatInstant(user.created_at)} /><DetailItem label="Última actividad" value={formatInstant(user.last_activity_at)} /><DetailItem label="Notas existentes" value={formatCount(user.notes_count)} />
    </Box>
    <LaboratoryAccess key={user.id} user={user} />
    <Card variant="outlined" sx={{ mt: 4, p: 2, bgcolor: 'background.default' }}><Typography variant="body2" color="text.secondary">El contenido de las notas y los audios está fuera de este panel. Una fecha desconocida no implica que la cuenta no haya tenido actividad.</Typography></Card>
  </Box>;
}

export function UserShow() {
  return <><PageHeading eyebrow="CUENTAS" title="Detalle de cuenta" description="Metadatos de uso y estado de la cuenta." actions={<Button component={Link} to="/users" startIcon={<ArrowBackIcon />} variant="outlined">Volver a Usuarios</Button>} /><Show title="Detalle de cuenta" actions={false} error={<UserReadError />}><UserDetails /></Show></>;
}

function UserReadError() {
  const refresh = useRefresh();
  return <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Reintentar</Button>}>No se pudieron cargar los datos de las cuentas. Comprobá la conexión con la API administrativa.</Alert>;
}
