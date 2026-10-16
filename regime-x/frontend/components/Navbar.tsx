'use client';

export default function Navbar() {
  return (
    <nav style={{
      background: 'rgba(5, 13, 26, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px',
          boxShadow: '0 0 20px rgba(59,130,246,0.4)',
        }}>
          ◈
        </div>
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px',
          }}>
            REGIME-X
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1.5px' }}>
            ADAPTIVE QUANT INTELLIGENCE
          </div>
        </div>
      </div>

      {/* Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span className="pulse-dot" style={{ background: 'var(--green)' }} />
          <span>Engine Online</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span className="pulse-dot" style={{ background: 'var(--blue)' }} />
          <span>ML Active</span>
        </div>
        <div style={{
          padding: '4px 12px',
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid var(--green)',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--green)',
          letterSpacing: '0.5px',
        }}>
          PAPER TRADING
        </div>
      </div>
    </nav>
  );
}
