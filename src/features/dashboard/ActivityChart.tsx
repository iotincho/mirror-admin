import { useId, useState } from 'react';
import { Box, Button, Collapse, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { ActivityPoint } from '../../providers/contracts';
import { formatCount, formatDay } from './format';

export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  if (!points.length) return <Typography color="text.secondary" py={5}>Todavía no hay actividad registrada para este período.</Typography>;
  const max = Math.max(5, ...points.flatMap(point => [point.accessed ?? 0, point.wrote ?? 0]));
  const ceiling = Math.ceil(max / 10) * 10;
  const x = (index: number) => 40 + index * 540 / Math.max(points.length - 1, 1);
  const y = (value: number) => 180 - value / ceiling * 150;
  function path(field: 'accessed' | 'wrote') {
    let gap = true;
    return points.map((point, index) => {
      if (point[field] === null) { gap = true; return ''; }
      const command = gap ? 'M' : 'L'; gap = false;
      return `${command}${x(index)} ${y(point[field])}`;
    }).join(' ');
  }
  const ticks = Array.from(new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1]));
  return <>
    <Stack direction="row" gap={2.5} mb={2} flexWrap="wrap"><Typography variant="caption" color="primary"><Box component="span" aria-hidden="true">● </Box>Accedieron</Typography><Typography variant="caption" color="secondary"><Box component="span" aria-hidden="true">● </Box>Escribieron · línea punteada</Typography></Stack>
    <Box component="svg" viewBox="0 0 610 220" role="img" aria-labelledby={`${id}-title ${id}-desc`} sx={{ width: '100%', height: 'auto', display: 'block', minHeight: 180 }}>
      <title id={`${id}-title`}>Usuarios únicos por día</title><desc id={`${id}-desc`}>Accesos y creación de notas. Los valores faltantes interrumpen la línea. La tabla de datos diarios está disponible debajo.</desc>
      {[0, .5, 1].map(ratio => <g key={ratio}><line x1="40" x2="585" y1={y(ceiling * ratio)} y2={y(ceiling * ratio)} stroke="#304044" strokeDasharray="3 5" /><text x="25" y={y(ceiling * ratio) + 4} fill="#a5b6b6" fontSize="12" textAnchor="end">{ceiling * ratio}</text></g>)}
      <path d={path('accessed')} fill="none" stroke="#b8d6ce" strokeWidth="2.5" strokeLinejoin="round" /><path d={path('wrote')} fill="none" stroke="#d5b77e" strokeWidth="2.5" strokeDasharray="6 3" strokeLinejoin="round" />
      {ticks.map(index => <text key={index} x={x(index)} y="210" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} fill="#a5b6b6" fontSize="12">{formatDay(points[index].date)}</text>)}
    </Box>
    <Button size="small" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={`${id}-table`}>{expanded ? 'Ocultar datos diarios' : 'Ver datos diarios'}</Button>
    <Collapse in={expanded}><Box id={`${id}-table`} sx={{ maxHeight: 290, overflow: 'auto' }}><Table size="small" aria-label="Datos diarios de actividad"><TableHead><TableRow><TableCell>Fecha</TableCell><TableCell align="right">Accedieron</TableCell><TableCell align="right">Escribieron</TableCell></TableRow></TableHead><TableBody>{points.map(point => <TableRow key={point.date}><TableCell>{formatDay(point.date)}</TableCell><TableCell align="right">{formatCount(point.accessed)}</TableCell><TableCell align="right">{formatCount(point.wrote)}</TableCell></TableRow>)}</TableBody></Table></Box></Collapse>
    <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>Accedieron: uso de la app autenticada. Escribieron: crearon una nota por texto o audio. Las importaciones se cuentan por separado.</Typography>
  </>;
}
