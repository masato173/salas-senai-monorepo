import { useMemo, useState } from 'react';

import { createAppsScriptService } from '../../services/appsScript';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../config';
import { useSchedule } from '../../hooks/useSchedule';
import {
  applyScheduleFilters,
  type ScheduleFilterState,
} from '../../components/dashboard/applyScheduleFilters';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { OccupancyDashboard } from '../../components/dashboard/OccupancyDashboard';
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';
import type { RegistroLegado } from '../../types';

// Sprint A3.5 — Dashboard nativo. Sobe estado pro pai e mata o iframe.
//
// O arquivo LegacyDashboard.tsx PERMANECE no projeto (rede de rollback) —
// só não é importado/renderizado aqui. Remoção física = A3.6.

export function DashboardPage(): JSX.Element {
  const service = useMemo(
    () => createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN }),
    [],
  );
  const schedule = useSchedule(service);

  const [filtros, setFiltros] = useState<ScheduleFilterState>({
    turma: '',
    data: '',
    sala: '',
    mes: '',
    turno: 'TODOS',
  });
  const [page, setPage] = useState<number>(1);

  function updateFiltro<K extends keyof ScheduleFilterState>(
    key: K,
    value: ScheduleFilterState[K],
  ): void {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const registros = useMemo<RegistroLegado[]>(
    () => schedule.data?.registros ?? [],
    [schedule.data],
  );
  const filtered = useMemo<RegistroLegado[]>(
    () => applyScheduleFilters(registros, filtros),
    [registros, filtros],
  );
  const salasUnicas = useMemo<string[]>(
    () => [...new Set(registros.map(r => r.sala))].sort((a, b) => a.localeCompare(b)),
    [registros],
  );
  const mesesUnicos = useMemo<string[]>(() => [...new Set(registros.map(r => r.mes))], [registros]);

  const hoje = todayYmd();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do controle de salas</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DashboardStats filtered={filtered} hoje={hoje} />
        <OccupancyDashboard
          filtered={filtered}
          filtros={filtros}
          onFiltroChange={updateFiltro}
          page={page}
          onPageChange={setPage}
          salasUnicas={salasUnicas}
          mesesUnicos={mesesUnicos}
          status={schedule.status}
          error={schedule.error}
          onRefetch={() => {
            void schedule.refetch();
          }}
          hoje={hoje}
        />
      </div>
    </div>
  );
}
