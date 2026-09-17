import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: '◉' },
  { path: '/live-traffic', label: 'Live Traffic', icon: '⟁' },
  { path: '/alerts', label: 'Alerts', icon: '⚠' },
  { path: '/investigation', label: 'Investigation', icon: '🔍' },
  {
    path: '/threat-analytics',
    label: 'Threat Analytics',
    icon: '⬡',
    children: [
      { path: '/threat-analytics/ddos', label: 'DDoS / Flooding', icon: '' },
      { path: '/threat-analytics/port-scan', label: 'Port Scanning', icon: '' },
      { path: '/threat-analytics/dns-dga', label: 'DNS / DGA', icon: '' },
      { path: '/threat-analytics/c2', label: 'C2 Beaconing', icon: '' },
      { path: '/threat-analytics/exfiltration', label: 'Data Exfiltration', icon: '' },
      { path: '/threat-analytics/encrypted', label: 'Encrypted Traffic', icon: '' },
    ],
  },
  { path: '/flows', label: 'Flows', icon: '⇄' },
  { path: '/models', label: 'Models', icon: '◈' },
  { path: '/reports', label: 'Reports', icon: '⊞' },
  { path: '/system', label: 'System', icon: '⚙' },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['/threat-analytics'])
  );

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ||
    location.pathname.startsWith(item.path);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">⬡</span>
          <div className="sidebar-brand-text">
            <div className="sidebar-product-name">DARTNet</div>
            <div className="sidebar-product-sub">Passive Network Threat Detection</div>
          </div>
          <div className="sidebar-live-badge">
            <span className="sidebar-live-dot" />
            LIVE
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <div key={item.path}>
            {item.children ? (
              <>
                <button
                  className={`sidebar-nav-group ${isGroupActive(item) ? 'active' : ''}`}
                  onClick={() => toggleGroup(item.path)}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  <span className="sidebar-nav-expand">
                    {expandedGroups.has(item.path) ? '▾' : '▸'}
                  </span>
                </button>
                {expandedGroups.has(item.path) && (
                  <div className="sidebar-nav-children">
                    {item.children.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `sidebar-nav-child ${isActive ? 'active' : ''}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      {/* Passive monitoring indicator - NON-NEGOTIABLE */}
      <div className="sidebar-passive">
        <div className="sidebar-passive-title">PASSIVE MONITORING</div>
        <div className="sidebar-passive-items">
          <div className="sidebar-passive-item">
            <span className="sidebar-passive-check">✓</span>
            One-way / Read Only
          </div>
          <div className="sidebar-passive-item">
            <span className="sidebar-passive-check">✓</span>
            No Active Probing
          </div>
          <div className="sidebar-passive-item">
            <span className="sidebar-passive-check">✓</span>
            No Payload Decryption
          </div>
          <div className="sidebar-passive-item">
            <span className="sidebar-passive-check">✓</span>
            No Mitigation Commands
          </div>
        </div>
        <div className="sidebar-footer-meta">
          <div>SIH26145</div>
          <div>NTRO</div>
          <div>Smart India Hackathon 2026</div>
        </div>
      </div>
    </aside>
  );
};
