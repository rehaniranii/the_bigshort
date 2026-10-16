'use client';

export default function LoadingOverlay({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 13, 26, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        position: 'relative',
        width: '64px',
        height: '64px',
        marginBottom: '20px',
      }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#3b82f6',
          borderRightColor: '#0ea5e9',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#10b981',
          animation: 'spin 1.5s linear infinite reverse',
        }} />
      </div>
      <div style={{
        fontSize: '15px',
        fontWeight: 600,
        color: '#f8fafc',
        letterSpacing: '0.3px',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        {message}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        marginTop: '8px',
      }}>
        Executing quantitative engine & training calibrated ML classifiers
      </div>
    </div>
  );
}
