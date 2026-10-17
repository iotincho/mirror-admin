import { Admin, Resource, memoryStore } from 'react-admin';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import { QueryClient } from '@tanstack/react-query';
import { services } from '../providers';
import { Dashboard } from '../features/dashboard/Dashboard';
import { UserList, UserShow } from '../features/users/Users';
import { theme } from '../theme/theme';
import { AdminLayout } from './AdminLayout';
import { i18nProvider } from './i18n';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } });
const store = memoryStore();

export function App() {
  return <Admin title="El Espejo · Administración" dataProvider={services.dataProvider} dashboard={Dashboard} layout={AdminLayout} theme={theme} darkTheme={theme} defaultTheme="dark" i18nProvider={i18nProvider} queryClient={queryClient} store={store} disableTelemetry>
    <Resource name="users" list={UserList} show={UserShow} icon={PeopleOutlineIcon} recordRepresentation="email" />
  </Admin>;
}
