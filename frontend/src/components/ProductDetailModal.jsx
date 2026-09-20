import React, { useState, useEffect } from 'react';
import { X, RefreshCw, ExternalLink, Activity, BarChart2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import PriceChart from './PriceChart';
import ScrapeLogsTable from './ScrapeLogsTable';

export default function ProductDetailModal({ product, apiUrl, onClose, onScraped }) {
  const [activeTab, setActiveTab] = useState('chart'); // 'chart', 'history', 'logs'
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeFeedback, setScrapeFeedback] = useState(null);

  const fetchDetails = async () => {
    try {
      setLoadingHistory(true);
      const histRes = await fetch(`${apiUrl}/api/products/${product.id}/history`);
      const histData = await histRes.json();
      if (histData.success) {
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }

    try {
      setLoadingLogs(true);
      const logRes = await fetch(`${apiUrl}/api/products/${product.id}/logs`);
      const logData = await logRes.json();
      if (logData.success) {
        setLogs(logData.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (product) {
      fetchDetails();
    }
  }, [product, apiUrl]);

  const handleManualScrape = async () => {
    setIsScraping(true);
    setScrapeFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/products/${product.id}/scrape`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.result.success) {
        setScrapeFeedback({
          type: 'success',
          message: `Scrape succeeded! Current price: ₹${data.result.price.toLocaleString('en-IN')}`
        });
        fetchDetails();
        onScraped();
      } else {
        setScrapeFeedback({
          type: 'error',
          message: `Scrape failed: ${data.result?.error || data.error || 'Check logs for details'}`
        });
        fetchDetails();
      }
    } catch (err) {
      setScrapeFeedback({
        type: 'error',
        message: `Network error triggering scrape: ${err.message}`
      });
    } finally {
      setIsScraping(false);
    }
  };

  if (!product) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
              {product.brand} • {product.category}
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0.2rem 0' }}>
              {product.name}
            </h2>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>SKU: {product.sku || 'N/A'}</span>
              <span>ID: #{product.id}</span>
              <a
                href={`https://demo.inelabteamdev.com/product/${product.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                View on Store <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Top summary card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '1rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Tracked Price</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
                  {product.current_price ? `₹${Number(product.current_price).toLocaleString('en-IN')}` : 'Not Scraped Yet'}
                </span>
                {product.current_stock && (
                  <span className={`badge ${product.is_in_stock ? 'badge-success' : 'badge-danger'}`}>
                    {product.current_stock}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleManualScrape}
                disabled={isScraping}
              >
                <RefreshCw size={14} className={isScraping ? 'spin' : ''} />
                {isScraping ? 'Scraping Store...' : 'Scrape Now'}
              </button>
            </div>
          </div>

          {/* Feedback alert */}
          {scrapeFeedback && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              backgroundColor: scrapeFeedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: scrapeFeedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${scrapeFeedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}>
              {scrapeFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {scrapeFeedback.message}
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className="btn"
              style={{
                backgroundColor: 'transparent',
                borderRadius: '0',
                borderBottom: activeTab === 'chart' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'chart' ? '#fff' : 'var(--text-secondary)',
                padding: '0.6rem 1rem'
              }}
              onClick={() => setActiveTab('chart')}
            >
              <BarChart2 size={16} /> Price Chart
            </button>
            <button
              type="button"
              className="btn"
              style={{
                backgroundColor: 'transparent',
                borderRadius: '0',
                borderBottom: activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
                padding: '0.6rem 1rem'
              }}
              onClick={() => setActiveTab('history')}
            >
              <Activity size={16} /> Price History Table ({history.length})
            </button>
            <button
              type="button"
              className="btn"
              style={{
                backgroundColor: 'transparent',
                borderRadius: '0',
                borderBottom: activeTab === 'logs' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'logs' ? '#fff' : 'var(--text-secondary)',
                padding: '0.6rem 1rem'
              }}
              onClick={() => setActiveTab('logs')}
            >
              <FileText size={16} /> Honest Scrape Logs ({logs.length})
            </button>
          </div>

          {/* Tab 1: Visual Chart */}
          {activeTab === 'chart' && (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history...</div>
              ) : (
                <PriceChart history={history} />
              )}
            </div>
          )}

          {/* Tab 2: Price History Table */}
          {activeTab === 'history' && (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No history recorded yet.</div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Recorded At</th>
                        <th>Price</th>
                        <th>Stock Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice().reverse().map((h, i) => (
                        <tr key={h.id || i}>
                          <td style={{ color: 'var(--text-secondary)' }}>{new Date(h.scraped_at).toLocaleString()}</td>
                          <td style={{ fontWeight: 600, color: '#fff' }}>₹{Number(h.price).toLocaleString('en-IN')}</td>
                          <td>
                            <span className={`badge ${h.stock_status && h.stock_status.toLowerCase().includes('out') ? 'badge-danger' : 'badge-success'}`}>
                              {h.stock_status || 'In stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Honest Scrape Logs Table */}
          {activeTab === 'logs' && (
            <div>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading logs...</div>
              ) : (
                <ScrapeLogsTable logs={logs} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

