import React from 'react';

/**
 * Clean SVG-based Price History Chart
 * Plots price over time with date labels and price points.
 */
export default function PriceChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        No price history recorded yet. Trigger a scrape to record the first price point.
      </div>
    );
  }

  // If only 1 data point, show summary card
  if (history.length === 1) {
    const pt = history[0];
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '0.5rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Initial Price Recorded</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', margin: '0.3rem 0' }}>
          ₹{Number(pt.price).toLocaleString('en-IN')}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {new Date(pt.scraped_at).toLocaleString()} • {pt.stock_status}
        </p>
      </div>
    );
  }

  const prices = history.map(h => Number(h.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  // Chart Dimensions
  const width = 700;
  const height = 220;
  const padding = 45;

  const points = history.map((item, index) => {
    const x = padding + (index / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((Number(item.price) - minPrice) / range) * (height - padding * 2);
    return { x, y, price: item.price, date: new Date(item.scraped_at) };
  });

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <span>Price Trend ({history.length} data points)</span>
        <span>Min: ₹{minPrice.toLocaleString('en-IN')} | Max: ₹{maxPrice.toLocaleString('en-IN')}</span>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#334155" strokeDasharray="3 3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#334155" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" />

          {/* Area fill */}
          <path d={areaD} fill="url(#priceGradient)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
              {/* Optional label for first and last point */}
              {(i === 0 || i === points.length - 1) && (
                <text x={pt.x} y={pt.y - 10} fill="#f8fafc" fontSize="11" textAnchor={i === 0 ? 'start' : 'end'} fontWeight="600">
                  ₹{Number(pt.price).toLocaleString('en-IN')}
                </text>
              )}
            </g>
          ))}

          {/* X Axis Labels */}
          <text x={points[0].x} y={height - 15} fill="#94a3b8" fontSize="10" textAnchor="start">
            {points[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </text>
          <text x={points[points.length - 1].x} y={height - 15} fill="#94a3b8" fontSize="10" textAnchor="end">
            {points[points.length - 1].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </text>
        </svg>
      </div>
    </div>
  );
}

