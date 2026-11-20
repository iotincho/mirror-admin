import type { JournalActivation, JournalAdjustment, JournalLifecycle, JournalReceipt, JournalService } from '../../../providers/journals-contracts';
import { clone, newKey } from './editor';

export type PendingRequest = { owner: string; key: string; status: 'sending' | 'uncertain'; runId: string | null } & (
  { kind: 'activate'; command: JournalActivation } | { kind: 'adjust'; command: JournalAdjustment } | { kind: 'lifecycle'; command: JournalLifecycle }
);
// Only unresolved operations survive navigation, scoped by account. No account data on disk.
const pending = new Map<string, PendingRequest>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version++; listeners.forEach(listener => listener()); };
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const snapshot = () => version;
export const pendingFor = (owner: string) => pending.get(owner);
export function reserve(owner: string, operation: Omit<Extract<PendingRequest, { kind: 'activate' }>, 'owner' | 'key' | 'status'> | Omit<Extract<PendingRequest, { kind: 'adjust' }>, 'owner' | 'key' | 'status'> | Omit<Extract<PendingRequest, { kind: 'lifecycle' }>, 'owner' | 'key' | 'status'>): PendingRequest {
  if (pending.has(owner)) throw new Error('Comprobá el resultado de la solicitud pendiente de esta cuenta antes de iniciar otra.');
  if (pending.size >= 50) throw new Error('Hay solicitudes pendientes de confirmación. Resolvelas antes de iniciar otras.');
  const request = { ...clone(operation), owner, key: newKey(), status: 'sending' as const } as PendingRequest;
  pending.set(owner, request);
  changed();
  return request;
}
export async function send(service: JournalService, request: PendingRequest): Promise<JournalReceipt> {
  request.status = 'sending';
  changed();
  try {
    const result = request.kind === 'activate' ? await service.activate(request.owner, request.command, request.key) : request.kind === 'adjust' ? await service.adjust(request.owner, request.runId!, request.command, request.key) : await service.lifecycle(request.owner, request.runId!, request.command, request.key);
    if (result.key !== request.key || (request.runId && result.run_id !== request.runId) || result.operation !== (request.kind === 'lifecycle' ? request.command.action : request.kind)) throw new Error('No se pudo verificar la identidad del resultado.');
    pending.delete(request.owner);
    changed();
    return result;
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) pending.delete(request.owner);
    else request.status = 'uncertain';
    changed();
    throw error;
  }
}
