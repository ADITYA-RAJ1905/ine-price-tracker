import React, { useState } from 'react';
import { RefreshCw, Trash2, ExternalLink, BarChart2, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function TrackedProductList({ products, apiUrl, onSelectProduct, onRefreshList }) {
  const [scrapingId, setScrapingId] = useState(null);

  const handleScrape = async (e, productId) => {
    e.stopPropagation();
    setScrapingId(productId);
    try {
      const res = await fetch(`${apiUrl}/api/products/${productId}/scrape`, {
        method: 'POST'
      });
      const data = await res.json();
      onRefreshList();
    } catch (err) {
      console.error('Scrape error:', err);
    } finally {
      setScrapingId(null);
    }
  };

  const handleUntrack = async (e, productId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to stop tracking this product?')) {
      return;
    }

    try {
      await fetch(`${apiUrl}/api/products/${productId}`, {
        method: 'DELETE'
      });
      onRefreshList();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getStatusPill = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="badge badge-success" title="Last scrape succeeded">
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Active
          </span>
        );
      case 'retried':
        return (
          <span className="badge badge-warning" title="Last scrape succeeded after retries">
            Retried
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-danger" title="Last scrape failed">
            <AlertCircle size={12} style={{ marginRight: '4px' }} /> Failed
          </span>
        );
      default:
        return (
          <span className="badge badge-gray" title="Pending first scrape">
            Pending
          </span>
        );
    }
  };

  if (!products || products.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600, marginBottom: '0.5rem' }}>
          No Products Tracked Yet
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto' }}>
          Use the search bar above to search INE's hosted mock store and click "Track Product" to begin tracking prices and stock levels.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
          Tracked Products ({products.length})
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Fixed schedule: Scrapes once every 2 hours
        </span>
      </div>

      <div className="product-grid">
        {products.map((product) => {
          const isCurrentlyScraping = scrapingId === product.id;

          return (
            <div
              key={product.id}
              className="product-card"
              onClick={() => onSelectProduct(product)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <div className="product-card-header">
                  <span className="product-brand">{product.brand || 'Brand'}</span>
                  {getStatusPill(product.last_status)}
                </div>

                <h4 className="product-name">{product.name}</h4>

                <div className="product-meta">
                  <span>{product.category || 'General'}</span>
                  <span>•</span>
                  <span>SKU: {product.sku || 'N/A'}</span>
                </div>

                <div className="product-price-section">
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                      Current Price
                    </span>
                    <span className="current-price">
                      {product.current_price ? `₹${Number(product.current_price).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>

                  <div>
                    {product.current_stock ? (
                      <span className={`badge ${product.is_in_stock ? 'badge-success' : 'badge-danger'}`}>
                        {product.current_stock}
                      </span>
                    ) : (
                      <span className="badge badge-gray">Not scraped</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>
                    {product.last_scraped_at
                      ? `Last scraped: ${new Date(product.last_scraped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Waiting for first scrape...'}
                  </span>
                </div>
              </div>

              <div className="product-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                  onClick={() => onSelectProduct(product)}
                >
                  <BarChart2 size={14} /> History & Logs
                </button>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                    disabled={isCurrentlyScraping}
                    onClick={(e) => handleScrape(e, product.id)}
                    title="Run scraper now"
                  >
                    <RefreshCw size={13} className={isCurrentlyScraping ? 'spin' : ''} />
                    {isCurrentlyScraping ? 'Scraping...' : 'Scrape'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.4rem 0.6rem' }}
                    onClick={(e) => handleUntrack(e, product.id)}
                    title="Stop tracking"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

