import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, Loader2, Package } from 'lucide-react';

export default function ProductSearch({ apiUrl, trackedProductIds, onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
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
      try {
        const res = await fetch(`${apiUrl}/api/catalog/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.products || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Catalog search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, apiUrl]);

  const handleTrack = async (product) => {
    setTrackingId(product.id);
    try {
      const res = await fetch(`${apiUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      const data = await res.json();
      if (data.success) {
        onProductTracked(data.product);
      }
    } catch (err) {
      console.error('Track product error:', err);
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
                        Track Product
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

