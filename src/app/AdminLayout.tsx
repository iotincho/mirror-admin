import { AppBar, Layout, Menu, useSidebarState } from 'react-admin';
import type { AppBarProps, LayoutProps } from 'react-admin';
import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { settings } from '../config/settings';

function AdminAppBar(props: AppBarProps) {
  return <AppBar {...props} userMenu={false} toolbar={false} color="default" sx={{ boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', '& .RaAppBar-toolbar': { minHeight: 70 } }}>
    <Typography fontSize={13} color="text.secondary" sx={{ flex: 1 }}>El Espejo <Box component="span" sx={{ mx: 1.5, color: 'divider' }}>/</Box> Administración</Typography>
    <Chip size="small" variant="outlined" color={settings.dataMode === 'demo' ? 'warning' : 'default'} label={settings.dataMode === 'demo' ? 'Demo · Datos ficticios' : 'Solo lectura'} sx={{ fontSize: { xs: 10, sm: 11 } }} />
  </AppBar>;
}

function AdminMenu() {
  const [open] = useSidebarState();
  return <Box sx={{ px: open ? 2 : 0, pt: 3, minWidth: 0, width: '100%'  }}>
    <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: open ? 1 : 2, mb: 4 }}>
      <Box component="span" aria-hidden="true" sx={{ color: 'primary.main', fontSize: 34 }}>◒</Box>
      {open && <Box><Typography fontFamily="Georgia, serif" fontSize={27} lineHeight={1.2}>el espejo</Typography><Typography fontSize={8} letterSpacing={2.2} color="text.secondary" mt={1}>ADMINISTRACIÓN</Typography></Box>}
    </Stack>
    {open && <Typography fontSize={10} letterSpacing={1.8} color="text.secondary" sx={{ px: 1.5, mb: 1 }}>GENERAL</Typography>}
    <Menu sx={{ width: '100%', '&.RaMenu-open': { width: '100%' }, '&.RaMenu-closed': { width: '100%' }, mt: 0, '& .RaMenuItemLink-root': { borderRadius: 1, minHeight: 46, my: .6, color: 'text.secondary' }, '& .RaMenuItemLink-root.RaMenuItemLink-active': { bgcolor: '#29413e', color: 'primary.main' } }}>
      <Menu.Item to="/" primaryText="Dashboard" leftIcon={<DashboardOutlinedIcon />} />
      <Menu.Item to="/users" primaryText="Usuarios" leftIcon={<PeopleOutlineIcon />} />
    </Menu>
    {open && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2, mt: 6 }}><ShieldOutlinedIcon color="secondary" sx={{ mb: 1 }} /><Typography fontSize={12} mb={1}>Una mirada a la plataforma</Typography><Typography fontSize={11} color="text.secondary" lineHeight={1.8}>Métricas de uso, sin acceder al contenido de las notas.</Typography><Divider sx={{ my: 1.5 }} /><Typography fontSize={10} color="text.secondary">Dashboard y cuentas · Solo lectura</Typography></Box>}
  </Box>;
}

export function AdminLayout(props: LayoutProps) {
  return <Layout {...props} appBar={AdminAppBar} menu={AdminMenu} sx={{
    '& .RaLayout-appFrame': { marginTop: '70px' },
    '& .RaLayout-content': { px: { xs: 2, sm: 3, lg: 5 }, pt: { xs: 3, md: 4 }, pb: 4, minWidth: 0 },
    '& .RaSidebar-docked .RaSidebar-fixed': { borderRight: '1px solid', borderColor: 'divider', bgcolor: '#142124', width: 'inherit', height: 'calc(100dvh - 70px)', overflowY: 'auto' },
  }} />;
}
