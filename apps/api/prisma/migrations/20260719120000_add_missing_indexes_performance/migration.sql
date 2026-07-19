-- F9.6 — índice composto para os hot paths que filtram Reservation por data
-- SEM roomId: AvailabilityService (GET /availability, público, uma query por
-- carregamento de tela) e DashboardService (contagens do dia). O índice
-- existente (roomId, date) não cobre consultas que começam por date.
-- O prefixo (date) também serve o filtro ?date= do GET /reservations.
-- Migration puramente aditiva: nenhuma coluna ou dado é alterado.

-- CreateIndex
CREATE INDEX "Reservation_date_status_idx" ON "Reservation"("date", "status");
