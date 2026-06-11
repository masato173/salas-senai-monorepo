import React, { useMemo, useState } from 'react';
import { FileText, Clock, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { useReservationStore } from '../../store/reservationStore';
import { ReservationList } from '../../components/reservations/ReservationList';
import { ReservationForm } from '../../components/reservations/ReservationForm';
import { ReservationCalendar } from '../../components/reservations/ReservationCalendar';
import { createAppsScriptService } from '../../services/appsScript';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, SALAS, CURRENT_USER } from '../../config';

export default function ReservasPage() {
  const { reservations } = useReservationStore();
  const [showForm, setShowForm] = useState(false);
  const [sala, setSala] = useState<string>(SALAS[6]); // "603 Sala"
  const [turma, setTurma] = useState('');

  const service = useMemo(
    () => createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN }),
    [],
  );

  const pending  = reservations.filter(r => r.status === 'PENDING').length;
  const approved = reservations.filter(r => r.status === 'APPROVED').length;
  const rejected = reservations.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Gestão de reservas e aprovações</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            height: '38px', padding: '0 16px', borderRadius: 'var(--radius-s)',
            background: 'var(--color-brand)', color: '#fff', border: 'none',
            fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <Plus size={15} />
          {showForm ? 'Fechar' : 'Nova reserva'}
        </button>
      </div>

      {/* Formulário de nova reserva */}
      {showForm && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-s)',
          padding: '20px', marginBottom: '24px', maxWidth: '520px',
        }}>
          {/* Seletor de sala + turma */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="sel-sala" style={labelStyle}>Sala *</label>
              <select
                id="sel-sala"
                value={sala}
                onChange={e => setSala(e.target.value)}
                style={inputStyle}
              >
                {SALAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="sel-turma" style={labelStyle}>Turma</label>
              <input
                id="sel-turma"
                type="text"
                value={turma}
                onChange={e => setTurma(e.target.value)}
                placeholder="Ex: ADS-2A"
                style={inputStyle}
              />
            </div>
          </div>

          <ReservationForm
            key={sala}
            roomId={sala}
            salaName={sala}
            userId={CURRENT_USER.userId}
            userEmail={CURRENT_USER.userEmail}
            professor={CURRENT_USER.professor}
            turma={turma}
            service={service}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total',     value: reservations.length, color: 'var(--color-blue)',  bg: 'var(--color-blue-l)',  Icon: FileText      },
          { label: 'Pendentes', value: pending,             color: 'var(--color-amber)', bg: 'var(--color-amber-l)', Icon: Clock         },
          { label: 'Aprovadas', value: approved,            color: 'var(--color-green)', bg: 'var(--color-green-l)', Icon: CheckCircle2  },
          { label: 'Rejeitadas',value: rejected,            color: 'var(--color-red)',   bg: 'var(--color-red-l)',   Icon: XCircle       },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '14px 16px', boxShadow: 'var(--shadow-s)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon size={16} />
            </span>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1, color }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-s)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Todas as reservas</span>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'var(--color-blue-l)', color: 'var(--color-blue)' }}>
            {reservations.length} registros
          </span>
        </div>
        <ReservationList showApproval />
      </div>

      {/* Calendário (sub-etapa 4.0 — fumaça, sem eventos ainda) */}
      <ReservationCalendar />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)',
  textTransform: 'uppercase', letterSpacing: '.05em',
};

const inputStyle: React.CSSProperties = {
  height: '38px', padding: '0 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontFamily: 'inherit', fontSize: '13px',
  outline: 'none', width: '100%',
};
