import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3.5}>
    <Box minWidth={0}><Typography color="secondary" fontSize={10} letterSpacing={2} mb={1}>{eyebrow}</Typography><Typography component="h1" variant="h1" mb={1} sx={{ fontSize: { xs: 31, md: 38 } }}>{title}</Typography><Typography color="text.secondary" variant="body2">{description}</Typography></Box>{actions}
  </Stack>;
}
