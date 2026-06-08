import React from 'react';
import { LegacyDashboard } from './LegacyDashboard';

export function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do controle de salas</p>
        </div>
      </div>
      <LegacyDashboard />
    </div>
  );
}
