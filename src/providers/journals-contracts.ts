import { HttpError } from 'react-admin';
import { z } from 'zod';

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const revision = z.number().int().positive();
const key = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const JournalStageSchema = z.object({ key, name: z.string().min(1).max(120), objective: z.string().min(1).max(2000), instructions: z.string().max(4000), duration_days: z.number().int().min(1).max(365) }).strict();
export const JournalPromptSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/), gentle: z.string().min(1).max(240), middle: z.string().min(1).max(240), deep: z.string().min(1).max(240) }).strict();
const ReviewedCatalogSchema = z.object({ stage_key: key, prompts: z.array(JournalPromptSchema).min(1).max(12) }).strict();
const CatalogSchema = ReviewedCatalogSchema.extend({ goal_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const JournalTemplateSchema = z.object({ id: uuid, version: revision, name: z.string(), purpose: z.string(), instructions: z.string(), stages: z.array(JournalStageSchema).min(1).max(52), catalogs: z.array(CatalogSchema).max(52) }).strict();
const ScheduledSchema = z.object({ id: uuid, definition: JournalStageSchema, starts_at: instant, ends_at: instant }).strict();
const StageViewSchema = z.object({ id: uuid, name: z.string(), objective: z.string(), duration_days: revision, starts_at: instant, ends_at: instant }).strict();
const RunSchema = z.object({ id: uuid, template_id: uuid, template_version: revision, revision, name: z.string(), purpose: z.string(), timezone: z.string(), status: z.enum(['active', 'paused', 'completed', 'closed']), stages: z.array(StageViewSchema), current_stage_id: uuid.nullable() }).strict();
const ChangeSchema = z.enum(['activation', 'adjustment', 'pause', 'resume', 'advance', 'completion', 'close', 'intention']);
const OriginSchema = z.enum(['administration', 'user', 'calendar']);
export const JournalConfigurationSchema = z.object({ run: RunSchema, instructions: z.string(), stages: z.array(ScheduledSchema), catalogs: z.array(CatalogSchema), catalog_review_required: z.array(key), started_at: instant, updated_at: instant, paused_at: instant.nullable(), ended_at: instant.nullable(), change: ChangeSchema, origin: OriginSchema, editable_stage_id: uuid.nullable() }).strict();
export const JournalAccountSchema = z.object({ enabled: z.boolean(), account_active: z.boolean(), workspace_active: z.boolean(), server_now: instant, items: z.array(JournalConfigurationSchema), total: z.number().int().nonnegative() }).strict();
export const JournalTemplatesSchema = z.object({ items: z.array(JournalTemplateSchema) }).strict();
export const JournalHistorySchema = z.object({ items: z.array(z.object({ revision, updated_at: instant, change: ChangeSchema, origin: OriginSchema }).strict()), total: z.number().int().nonnegative() }).strict();
export const JournalReceiptSchema = z.object({ key: uuid, run_id: uuid, revision, operation: z.enum(['activate', 'adjust', 'pause', 'resume', 'advance', 'close']), recorded_at: instant }).strict();
export const JournalActivationSchema = z.object({ template_id: uuid, template_version: revision, timezone: z.string().min(1).max(100) }).strict();
export const JournalAdjustmentSchema = z.object({ expected_revision: revision, remaining_stages: z.array(JournalStageSchema).min(1).max(52), purpose: z.string().min(1).max(2000).nullable().optional(), instructions: z.string().max(4000).nullable().optional(), reviewed_catalogs: z.array(ReviewedCatalogSchema).max(52) }).strict();
export const JournalLifecycleSchema = z.object({ expected_revision: revision, action: z.enum(['pause', 'resume', 'advance', 'close']) }).strict();

export type JournalStage = z.infer<typeof JournalStageSchema>;
export type JournalPrompt = z.infer<typeof JournalPromptSchema>;
export type JournalTemplate = z.infer<typeof JournalTemplateSchema>;
export type JournalConfiguration = z.infer<typeof JournalConfigurationSchema>;
export type JournalAccount = z.infer<typeof JournalAccountSchema>;
export type JournalHistory = z.infer<typeof JournalHistorySchema>;
export type JournalReceipt = z.infer<typeof JournalReceiptSchema>;
export type JournalActivation = z.infer<typeof JournalActivationSchema>;
export type JournalAdjustment = z.infer<typeof JournalAdjustmentSchema>;
export type JournalLifecycle = z.infer<typeof JournalLifecycleSchema>;
export type JournalService = {
  templates(signal?: AbortSignal): Promise<JournalTemplate[]>;
  account(owner: string, offset?: number, signal?: AbortSignal): Promise<JournalAccount>;
  detail(owner: string, run: string, revision?: number, signal?: AbortSignal): Promise<JournalConfiguration>;
  history(owner: string, run: string, offset?: number, signal?: AbortSignal): Promise<JournalHistory>;
  previewActivation(owner: string, command: JournalActivation, signal?: AbortSignal): Promise<JournalConfiguration>;
  preview(owner: string, run: string, command: JournalAdjustment, signal?: AbortSignal): Promise<JournalConfiguration>;
  activate(owner: string, command: JournalActivation, key: string, signal?: AbortSignal): Promise<JournalReceipt>;
  adjust(owner: string, run: string, command: JournalAdjustment, key: string, signal?: AbortSignal): Promise<JournalReceipt>;
  lifecycle(owner: string, run: string, command: JournalLifecycle, key: string, signal?: AbortSignal): Promise<JournalReceipt>;
};

const messages: Record<string, string> = {
  journal_revision_conflict: 'El recorrido cambió mientras estabas editando. Tu borrador se conserva.',
  journal_active_conflict: 'Esta cuenta ya tiene un recorrido activo. Revisá su estado antes de continuar.',
  journal_idempotency_conflict: 'La solicitud pendiente tiene otro contenido. Comprobá su resultado antes de crear un cambio nuevo.',
  journal_not_found: 'El recorrido o la revisión ya no está disponible.',
  journal_owner_not_found: 'La cuenta no existe o ya no está disponible.',
  journal_template_not_found: 'El template seleccionado ya no está disponible.',
  journals_disabled: 'Journals está deshabilitado en la plataforma. La configuración se conserva.',
  journal_workspace_unavailable: 'La cuenta o su espacio no está habilitado para modificar el recorrido.',
  journal_explicit_advance_required: 'La duración haría terminar la etapa actual. Conservá tiempo restante o usá Avanzar etapa.',
  journal_current_stage_required: 'La etapa actual cambió. Actualizá el recorrido para recuperar tu borrador.',
  journal_not_active: 'El recorrido ya no está activo. Actualizá su estado antes de continuar.',
  journal_catalog_review_required: 'Revisá las preguntas de respaldo para el objetivo vigente.',
  journal_catalog_topic_identity_changed: 'Los temas de respaldo deben conservar su identidad y los límites del usuario.',
  journal_invalid_configuration: 'Revisá los campos de la configuración y las tres profundidades de las preguntas.',
  journal_storage_unavailable: 'No se pudo confirmar el guardado. Conservamos la solicitud para comprobar su resultado.',
  journal_demo_unavailable: 'Journals se administra en el modo API. El prototipo independiente permite revisar el diseño con datos ficticios.',
};
export class JournalRequestError extends HttpError {
  readonly code: string;
  constructor(status: number, code: unknown) {
    const safe = typeof code === 'string' && Object.hasOwn(messages, code) ? code : 'journal_request_failed';
    super(messages[safe] || `No se pudo completar la solicitud de Journals (${status}).`, status);
    Object.setPrototypeOf(this, new.target.prototype);
    this.code = safe;
  }
}
