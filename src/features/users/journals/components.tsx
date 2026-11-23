import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { ReactNode } from 'react';
import type { JournalConfiguration } from '../../../providers/journals-contracts';
import { formatDate } from './editor';

export function RunState({ status }: { status: JournalConfiguration['run']['status'] }) {
  return <Chip size="small" variant="outlined" color={status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'default'} label={{ active: 'Activo', paused: 'Pausado', completed: 'Completado', closed: 'Cerrado' }[status]} />;
}
export function Calendar({ configuration, before }: { configuration: JournalConfiguration; before?: JournalConfiguration }) {
  return <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
    {configuration.stages.map((stage, i) => <Stack component="li" key={stage.id} direction="row" gap={1.5} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography color="secondary" fontSize={12} width={20}>{i + 1}</Typography>
      <Box flex={1} minWidth={0}><Typography fontSize={13}>{stage.definition.name}</Typography><Typography color="text.secondary" fontSize={11}>{formatDate(stage.starts_at, configuration.run.timezone)} → {formatDate(stage.ends_at, configuration.run.timezone)}{before && stage.ends_at !== before.stages.find(s => s.id === stage.id)?.ends_at && <Box component="span" color="secondary.main"> · Nueva fecha</Box>}</Typography></Box>
      <Typography color="text.secondary" fontSize={11}>{stage.definition.duration_days} d</Typography>
    </Stack>)}
  </Box>;
}
export function Panel({ title, subtitle, children, actions, onClose, busy = false }: { title: string; subtitle?: string; children: ReactNode; actions: ReactNode; onClose: () => void; busy?: boolean }) {
  return <Drawer anchor="right" open onClose={busy ? undefined : onClose} slotProps={{ paper: { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'journal-panel-title', sx: { width: { xs: '100%', sm: 640 }, maxWidth: '100%', display: 'flex', borderTopLeftRadius: { sm: 14 }, borderBottomLeftRadius: { sm: 14 } } } }}>
    <Stack direction="row" alignItems="flex-start" gap={1} sx={{ px: { xs: 2.5, sm: 3.5 }, py: 3 }}>
      <Box flex={1} minWidth={0}><Typography color="secondary" fontSize={10} letterSpacing={1.8} mb={1}>RECORRIDO PERSONAL</Typography><Typography id="journal-panel-title" component="h2" fontFamily="Georgia, serif" fontSize={28}>{title}</Typography>{subtitle && <Typography color="text.secondary" fontSize={12} mt={1}>{subtitle}</Typography>}</Box><IconButton aria-label="Cerrar panel" disabled={busy} onClick={onClose}><CloseIcon /></IconButton>
    </Stack><Divider /><Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 3, overflowY: 'auto', minHeight: 0, flex: 1 }}>{children}</Box><Divider />
    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2, '& .MuiButton-root': { minWidth: 100 } }}>{actions}</Stack>
  </Drawer>;
}
export function Confirmation({ title, text, label, onConfirm, onClose, busy = false, danger = false, error }: { title: string; text: string; label: string; onConfirm: () => void; onClose: () => void; busy?: boolean; danger?: boolean; error?: string }) {
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="journal-confirm-title"><DialogTitle id="journal-confirm-title" sx={{ fontFamily: 'Georgia, serif', fontSize: 27 }}>{title}</DialogTitle><DialogContent><Typography color="text.secondary" fontSize={13} lineHeight={1.9}>{text}</Typography>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}</DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={onClose} disabled={busy}>Cancelar</Button><Button variant={danger ? 'outlined' : 'contained'} color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Guardando…' : label}</Button></DialogActions></Dialog>;
}
export function message(error: unknown): string {
  return error instanceof Error && error.name !== 'ZodError' ? error.message : 'Revisá los campos de la configuración. No se confirmó ningún cambio.';
}
