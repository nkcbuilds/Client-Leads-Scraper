import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
];

export default function Layout({ children, title }) {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        background: '#1e293b',
        color: '#fff',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
      }}>
        <Link href="/" style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none' }}>
          LegalReach
        </Link>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: router.pathname === item.href ? '#93c5fd' : '#cbd5e1',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: router.pathname === item.href ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        {title && <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>{title}</h1>}
        {children}
      </main>
    </div>
  );
}

export const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  marginBottom: '1.5rem',
};

export const inputStyle = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.95rem',
  width: '100%',
};

export const buttonStyle = {
  padding: '0.6rem 1rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

export const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#fff',
  color: '#334155',
  border: '1px solid #cbd5e1',
};

export const thStyle = { padding: '0.5rem 0.75rem' };
export const tdStyle = { padding: '0.5rem 0.75rem' };