import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

export default function ScrapeLogsTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
        No scrape logs available yet for this product.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Success
          </span>
        );
      case 'retried':
        return (
          <span className="badge badge-warning">
            <AlertTriangle size={12} style={{ marginRight: '4px' }} /> Retried
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-danger">
            <XCircle size={12} style={{ marginRight: '4px' }} /> Failed
          </span>
        );
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Attempt</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Extracted Data / Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={log.id || index}>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td>#{log.attempt || 1}</td>
              <td>{getStatusBadge(log.status)}</td>
              <td style={{ color: 'var(--text-muted)' }}>
                {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
              </td>
              <td>
                {log.status === 'success' ? (
                  <div>
                    <span style={{ fontWeight: 600, color: '#fff' }}>
                      ₹{Number(log.price_found).toLocaleString('en-IN')}
                    </span>{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      ({log.stock_found || 'In stock'})
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--danger)', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                    {log.error_message || 'Timeout / Store error'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

