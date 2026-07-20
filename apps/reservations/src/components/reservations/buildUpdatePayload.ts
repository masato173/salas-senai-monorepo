import type {
  UpdateReservationPayload,
  UpdateReservationGroupPayload,
} from '../../services/apiTypes';

// Sprint 4 D2 — função pura que monta o payload de update a partir do
// estado do ReservationForm.
//
// Crítico:
//   • edit-single (C1) inclui `data` no payload.
//   • edit-group  (C2) NÃO inclui `data` — cada linha mantém a sua.
//
// Defesa-em-profundidade contra payload inconsistente vindo da D3 (modal):
//   • edit-single sem `initialValues.id`        → error.
//   • edit-group  sem `initialValues.groupId`   → error.

export interface FormFieldsForUpdate {
  date: string; // YYYY-MM-DD (usado só em edit-single)
  start: string; // HH:MM
  end: string; // HH:MM
  reason: string;
}

export interface UpdateInitialIdentifiers {
  id?: string;
  groupId?: string;
}

export type BuildUpdateInput =
  | {
      mode: 'edit-single';
      form: FormFieldsForUpdate;
      initialValues: UpdateInitialIdentifiers;
      salaName: string;
      turma: string;
    }
  | {
      mode: 'edit-group';
      form: FormFieldsForUpdate;
      initialValues: UpdateInitialIdentifiers;
      salaName: string;
      turma: string;
    };

export type BuildUpdateResult =
  | { ok: true; mode: 'edit-single'; payload: UpdateReservationPayload }
  | { ok: true; mode: 'edit-group'; payload: UpdateReservationGroupPayload }
  | { ok: false; error: string };

export function buildUpdatePayload(input: BuildUpdateInput): BuildUpdateResult {
  if (input.mode === 'edit-single') {
    if (!input.initialValues.id) {
      return { ok: false, error: 'Inconsistência interna: id ausente.' };
    }
    return {
      ok: true,
      mode: 'edit-single',
      payload: {
        id: input.initialValues.id,
        sala: input.salaName,
        data: input.form.date,
        inicio: input.form.start,
        fim: input.form.end,
        turma: input.turma,
        observacao: input.form.reason,
      },
    };
  }

  // mode === 'edit-group'
  if (!input.initialValues.groupId) {
    return { ok: false, error: 'Inconsistência interna: groupId ausente.' };
  }
  return {
    ok: true,
    mode: 'edit-group',
    payload: {
      groupId: input.initialValues.groupId,
      sala: input.salaName,
      // NOTE: SEM data — cada linha do grupo mantém a sua data própria (C2).
      inicio: input.form.start,
      fim: input.form.end,
      turma: input.turma,
      observacao: input.form.reason,
    },
  };
}
