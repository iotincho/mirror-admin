import polyglotI18nProvider from 'ra-i18n-polyglot';
import englishMessages from 'ra-language-english';

// Base del framework para claves futuras; todos los controles usados aquí se traducen.
export const i18nProvider = polyglotI18nProvider(() => ({
  ...englishMessages,
  ra: {
    ...englishMessages.ra,
    action: {
      ...englishMessages.ra.action,
      add_filter: 'Agregar filtro', back: 'Volver', cancel: 'Cancelar', clear_input_value: 'Limpiar valor',
      confirm: 'Confirmar', export: 'Exportar', list: 'Listar', refresh: 'Actualizar',
      remove_filter: 'Quitar filtro', remove_all_filters: 'Quitar todos los filtros', reset: 'Restablecer',
      search: 'Buscar', show: 'Ver cuenta', sort: 'Ordenar', expand: 'Expandir', close: 'Cerrar',
      open_menu: 'Abrir menú', close_menu: 'Cerrar menú', update_application: 'Actualizar aplicación',
      select_columns: 'Columnas', select_all: 'Seleccionar todo', select_row: 'Seleccionar fila',
    },
    boolean: { true: 'Sí', false: 'No', null: 'Sin datos' },
    page: {
      ...englishMessages.ra.page,
      dashboard: 'Dashboard', list: '%{name}', show: '%{recordRepresentation}',
      error: 'No se pudo mostrar la página', not_found: 'Página no encontrada', loading: 'Cargando',
      empty: 'Todavía no hay %{name}.', invite: '', access_denied: 'Acceso denegado',
    },
    message: {
      ...englishMessages.ra.message,
      error: 'Ocurrió un error al cargar la página.', loading: 'Cargando…',
      not_found: 'La dirección no corresponde a una página disponible.',
      details: 'Detalles', placeholder_data_warning: 'No se pudieron actualizar los datos.',
    },
    navigation: {
      ...englishMessages.ra.navigation,
      clear_filters: 'Limpiar filtros', no_filtered_results: 'No hay cuentas que coincidan con los filtros.',
      no_results: 'No hay resultados', no_more_results: 'No hay más páginas.',
      page_out_of_boundaries: 'La página %{page} está fuera del rango.',
      page_out_from_end: 'No hay más páginas', page_out_from_begin: 'Esta es la primera página',
      page_range_info: '%{offsetBegin}–%{offsetEnd} de %{total}',
      partial_page_range_info: '%{offsetBegin}–%{offsetEnd} de más de %{offsetEnd}',
      current_page: 'Página %{page}', page: 'Ir a la página %{page}', first: 'Primera página',
      last: 'Última página', next: 'Página siguiente', previous: 'Página anterior',
      page_rows_per_page: 'Filas por página:', skip_nav: 'Ir al contenido',
    },
    sort: { sort_by: 'Ordenar por %{field_lower_first} %{order}', ASC: 'ascendente', DESC: 'descendente' },
    notification: {
      ...englishMessages.ra.notification,
      http_error: 'No se pudo conectar con el servidor.', item_doesnt_exist: 'La cuenta no existe.',
      data_provider_error: 'No se pudieron cargar los datos.', offline: 'No hay conexión con la API.',
      i18n_error: 'No se pudieron cargar las traducciones.',
    },
    validation: { ...englishMessages.ra.validation, required: 'Requerido' },
  },
  resources: { users: { name: 'Usuario |||| Usuarios', fields: { email: 'Correo electrónico', id: 'Identificador', is_active: 'Cuenta habilitada', created_at: 'Fecha de alta', last_activity_at: 'Última actividad', notes_count: 'Notas existentes' } } },
}), 'es');
