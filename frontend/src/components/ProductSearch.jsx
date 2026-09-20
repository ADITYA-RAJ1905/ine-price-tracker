import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, Loader2, Package, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProductSearch({ apiUrl, trackedProductIds, onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search catalog with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch(`${apiUrl}/api/catalog/search?q=${encodeURIComponent(query.trim())}`);
        const contentType = res.headers.get('content-type') || '';
        
        if (!contentType.includes('application/json')) {
          throw new Error('API server returned non-JSON response. Check your VITE_API_URL configuration.');
        }

        const data = await res.json();
        if (data.success) {
          setResults(data.products || []);
          setIsOpen(true);
        } else {
          setFeedback({ type: 'error', message: data.error || 'Failed to search catalog' });
        }
      } catch (err) {
        console.error('Catalog search error:', err);
        setFeedback({
          type: 'error',
          message: `Connection Error: Could not reach backend at ${apiUrl || 'localhost:5000'}. Make sure the backend server is running.`
        });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, apiUrl]);

  const handleTrack = async (product) => {
    setTrackingId(product.id);
    setFeedback(null);

    try {
      const res = await fetch(`${apiUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Backend returned HTML instead of JSON. Ensure your frontend is pointing to the active backend API via VITE_API_URL.');
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error (Status ${res.status})`);
      }

      // Success
      setFeedback({
        type: 'success',
        message: `Successfully tracked "${product.name}"! An initial scrape has been queued.`
      });
      setIsOpen(false);
      setQuery('');
      onProductTracked(data.product);

    } catch (err) {
      console.error('Track product error:', err);
      setFeedback({
        type: 'error',
        message: `Failed to track product: ${err.message}`
      });
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="card" ref={dropdownRef}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Package size={18} color="#3b82f6" /> Search Mock Store Catalog
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Search INE's hosted mock store by partial or full product name, brand, or SKU, and pick items to track.
      </p>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          backgroundColor: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="search-form">
        <div className="input-group">
          <Search className="input-icon" size={18} />
          <input
            type="text"
            className="input"
            placeholder="e.g. Basecamp Motion Sensor, Domus Monitor, Headphones..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          />
        </div>
        {loading && (
          <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
            <Loader2 size={18} className="spin" color="#3b82f6" />
          </div>
        )}

        {isOpen && results.length > 0 && (
          <div className="search-results-dropdown">
            {results.map((product) => {
              const isAlreadyTracked = trackedProductIds.includes(product.id);
              const isCurrentlyTracking = trackingId === product.id;

              return (
                <div key={product.id} className="search-item">
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {product.brand || 'Brand'} • {product.category || 'General'}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', margin: '0.1rem 0' }}>
                      {product.name}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      SKU: {product.sku || 'N/A'} • ID #{product.id}
                    </span>
                  </div>

                  <div>
                    {isAlreadyTracked ? (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Tracked
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        disabled={isCurrentlyTracking}
                        onClick={() => handleTrack(product)}
                      >
                        {isCurrentlyTracking ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                        {isCurrentlyTracking ? 'Adding...' : 'Track Product'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
