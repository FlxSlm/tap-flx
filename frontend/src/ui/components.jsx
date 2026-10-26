import React from 'react';
import Icon from './Icon';
import { availability, money, number } from './format';

export function Badge({ status = 'NOT_AVAILABLE', children, tone }) {
  const [label, color] = availability[status] ?? [status, 'neutral'];
  return <span className={`status-badge tone-${tone ?? color}`}><span className="status-dot"/>{children ?? label}</span>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-action">{action}</div>}</div>;
}

export function Panel({ title, subtitle, action, className = '', children }) {
  return <section className={`panel ${className}`}><header className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

export function EmptyState({ icon = 'document', title, children, action, compact = false }) {
  return <div className={`empty-state ${compact ? 'compact' : ''}`}><span className="empty-icon"><Icon name={icon} size={24}/></span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Notice({ children, tone = 'info', role = 'status' }) {
  return <div className={`notice tone-${tone}`} role={role}><Icon name="info" size={18}/><div>{children}</div></div>;
}

export function LoadingState({ label = 'Data sedang dimuat' }) {
  return <div className="loading-state" role="status" aria-label={label}><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/><span className="sr-only">{label}</span></div>;
}

export function Metric({ label, value = null, note, currency = 'IDR', status = 'NOT_AVAILABLE', primary = false, kind = 'money' }) {
  const display = value == null ? 'Belum tersedia' : kind === 'money' ? money(value, currency) : kind === 'percent' ? `${number(value, 2)}%` : number(value);
  return <div className={`metric ${primary ? 'metric-primary' : ''}`}><p className="metric-label">{label}</p><p className={`metric-value ${value == null ? 'is-unavailable' : ''}`}>{display}</p><div className="metric-note">{value == null && <span className="availability-code">{status}</span>}{note && <span>{note}</span>}</div></div>;
}

export function TableRegion({ label, children, className = '' }) {
  return <div className={`table-scroll ${className}`} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
