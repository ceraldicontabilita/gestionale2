import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { PageLayout } from '../components/PageLayout';
import { STYLES, COLORS } from '../lib/utils';
import { 
  Settings, Mail, Plus, Trash2, Save, RefreshCw, Play, 
  Clock, CheckCircle, AlertCircle, Loader2, Tag
} from 'lucide-react';
import api from '../api';

const TIPI_MITTENTE = [
  { value: 'commercialista', label: 'Commercialista' },
  { value: 'consulente_lavoro', label: 'Consulente Lavoro' },
  { value: 'altro', label: 'Altro' }
];

const CATEGORIE_F24 = [
  { value: 'fiscale', label: 'Fiscale (IRPEF, IVA, IRAP)' },
  { value: 'contributivo', label: 'Contributivo (INPS, INAIL)' },
  { value: 'altro', label: 'Altro' }
];

// ===== COMPONENTE GMAIL SETTINGS =====
function GmailSettingsSection() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ imap_user: '', gmail_app_password: '', imap_host: 'imap.gmail.com' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    api.get('/api/settings/gmail')
      .then(r => {
        setCfg(r.data);
        setForm(f => ({ ...f, imap_user: r.data.imap_user || '', imap_host: r.data.imap_host || 'imap.gmail.com' }));
      })
      .catch(() => {});
  }, []);

  const salva = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/api/settings/gmail', form);
      setMsg({ ok: res.data.status === 'ok', testo: res.data.messaggio });
      if (res.data.status === 'ok') setCfg(c => ({ ...c, has_password: true, sorgente: 'database', imap_user: form.imap_user }));
    } catch (e) {
      setMsg({ ok: false, testo: e.response?.data?.detail || 'Errore durante il salvataggio' });
    } finally {
      setSaving(false);
    }
  };

  const testConnessione = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.post('/api/settings/gmail/test');
      setMsg({ ok: res.data.ok, testo: res.data.messaggio || res.data.error });
    } catch {
      setMsg({ ok: false, testo: 'Errore durante il test' });
    } finally {
      setTesting(false);
    }
  };

  const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 };
  const cardHeaderStyle = { borderBottom: '1px solid #f1f5f9', padding: '12px 20px', background: '#f8fafc', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <Mail size={16} color="#2563eb" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Credenziali Gmail IMAP</h3>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            Inserisci la Gmail App Password per permettere al sistema di scaricare automaticamente
            le email con le fatture. Vai su <strong>Account Google → Sicurezza → Verifica in 2 passaggi → App Password</strong> per generare una nuova password.
            La password viene salvata nel database (non nel codice).
          </p>

          {cfg && (
            <div style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: cfg.has_password ? '#f0fdf4' : '#fff7ed', border: `1px solid ${cfg.has_password ? '#bbf7d0' : '#fed7aa'}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: cfg.has_password ? '#16a34a' : '#d97706' }}>
                {cfg.has_password
                  ? `Credenziali presenti — Sorgente: ${cfg.sorgente} — Utente: ${cfg.imap_user}`
                  : 'Nessuna credenziale configurata — il download email è disattivato'}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email Gmail</label>
              <Input
                value={form.imap_user}
                onChange={e => setForm(f => ({ ...f, imap_user: e.target.value }))}
                placeholder="ceraldigroupsrl@gmail.com"
                type="email"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>App Password Gmail (16 caratteri)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={form.gmail_app_password}
                  onChange={e => setForm(f => ({ ...f, gmail_app_password: e.target.value.replace(/\s/g, '') }))}
                  placeholder="abcdabcdabcdabcd"
                  type={showPass ? 'text' : 'password'}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <Button variant="outline" size="sm" onClick={() => setShowPass(s => !s)} style={{ flexShrink: 0 }}>
                  {showPass ? 'Nascondi' : 'Mostra'}
                </Button>
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>
                Incolla la App Password senza spazi. Es: <code>abcdabcdabcdabcd</code>
              </p>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Server IMAP</label>
              <Input
                value={form.imap_host}
                onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))}
                placeholder="imap.gmail.com"
              />
            </div>
          </div>

          {msg && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: msg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, fontSize: 13, color: msg.ok ? '#16a34a' : '#dc2626' }}>
              {msg.ok ? '✓ ' : '✗ '}{msg.testo}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button onClick={salva} disabled={saving || !form.imap_user || !form.gmail_app_password} style={{ background: '#1e3a5f', color: '#fff' }}>
              {saving ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> : <Save size={14} style={{ marginRight: 6 }} />}
              Salva credenziali
            </Button>
            <Button variant="outline" onClick={testConnessione} disabled={testing || saving}>
              {testing ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> : <RefreshCw size={14} style={{ marginRight: 6 }} />}
              Testa connessione
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



export default function ImpostazioniF24Email() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [settings, setSettings] = useState(null);
  const [stato, setStato] = useState(null);
  const [logs, setLogs] = useState([]);
  const [newKeyword, setNewKeyword] = useState({});
  const [showAddMittente, setShowAddMittente] = useState(false);
  const [newMittente, setNewMittente] = useState({
    email: '',
    nome: '',
    tipo: 'commercialista',
    categoria_f24: 'fiscale',
    parole_chiave: [],
    attivo: true
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statoRes, logsRes] = await Promise.all([
        api.get('/api/f24-email-settings/impostazioni'),
        api.get('/api/f24-email-settings/stato-sistema'),
        api.get('/api/f24-email-settings/log-scansioni?limit=10')
      ]);
      // Normalizza mittenti: se sono stringhe, convertili in oggetti
      const rawSettings = settingsRes.data;
      if (rawSettings && Array.isArray(rawSettings.mittenti)) {
        rawSettings.mittenti = rawSettings.mittenti.map(m =>
          typeof m === 'string'
            ? { email: m, nome: m, tipo: 'altro', categoria_f24: 'generico', attivo: true, parole_chiave: [] }
            : m
        );
      }
      setSettings(rawSettings);
      setStato(statoRes.data);
      setLogs(logsRes.data.logs || []);
    } catch (err) {
      console.error('Errore caricamento impostazioni:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.post('/api/f24-email-settings/impostazioni', {
        mittenti: settings.mittenti,
        scan_interval_minuti: settings.scan_interval_minuti,
        giorni_indietro: settings.giorni_indietro,
        auto_scan_attivo: settings.auto_scan_attivo
      });
      alert('Impostazioni salvate!');
      fetchData();
    } catch (err) {
      console.error('Errore salvataggio:', err);
      alert('Errore salvataggio: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoScan = async (attivo) => {
    try {
      await api.post(`/api/f24-email-settings/toggle-auto-scan?attivo=${attivo}`);
      setSettings(prev => ({ ...prev, auto_scan_attivo: attivo }));
      fetchData();
    } catch (err) {
      console.error('Errore toggle auto-scan:', err);
    }
  };

  const runManualScan = async () => {
    setScanning(true);
    try {
      const res = await api.post('/api/f24-email-settings/scan-manuale');
      const d = res.data;
      alert(`Scansione completata!\n\nEmail trovate: ${d.download?.email_trovate || 0}\nAllegati scaricati: ${d.download?.allegati_scaricati || 0}\nF24 inseriti: ${d.processamento?.f24_inseriti || 0}`);
      fetchData();
    } catch (err) {
      console.error('Errore scansione:', err);
      alert('Errore scansione: ' + (err.response?.data?.detail || err.message));
    } finally {
      setScanning(false);
    }
  };

  const addMittente = async () => {
    if (!newMittente.email || !newMittente.nome) {
      alert('Inserisci email e nome');
      return;
    }
    try {
      await api.post('/api/f24-email-settings/aggiungi-mittente', newMittente);
      setShowAddMittente(false);
      setNewMittente({
        email: '',
        nome: '',
        tipo: 'commercialista',
        categoria_f24: 'fiscale',
        parole_chiave: [],
        attivo: true
      });
      fetchData();
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message));
    }
  };

  const removeMittente = async (email) => {
    if (!window.confirm(`Rimuovere ${email}?`)) return;
    try {
      await api.delete(`/api/f24-email-settings/rimuovi-mittente/${encodeURIComponent(email)}`);
      fetchData();
    } catch (err) {
      alert('Errore: ' + (err.response?.data?.detail || err.message));
    }
  };

  const updateMittente = (index, field, value) => {
    setSettings(prev => {
      const newMittenti = [...prev.mittenti];
      newMittenti[index] = { ...newMittenti[index], [field]: value };
      return { ...prev, mittenti: newMittenti };
    });
  };

  const addKeywordToMittente = (index) => {
    const keyword = newKeyword[index]?.trim();
    if (!keyword) return;
    
    setSettings(prev => {
      const newMittenti = [...prev.mittenti];
      const parole = newMittenti[index].parole_chiave || [];
      if (!parole.includes(keyword)) {
        newMittenti[index].parole_chiave = [...parole, keyword];
      }
      return { ...prev, mittenti: newMittenti };
    });
    setNewKeyword(prev => ({ ...prev, [index]: '' }));
  };

  const removeKeyword = (mittenteIndex, keyword) => {
    setSettings(prev => {
      const newMittenti = [...prev.mittenti];
      newMittenti[mittenteIndex].parole_chiave = 
        (newMittenti[mittenteIndex].parole_chiave || []).filter(k => k !== keyword);
      return { ...prev, mittenti: newMittenti };
    });
  };

  if (loading) {
    return (
      <PageLayout title="Impostazioni Email" subtitle="Configura download automatico F24 da email">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#94a3b8' }}>
          <Loader2 size={32} className="animate-spin" />
        </div>
      </PageLayout>
    );
  }

  const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 };
  const cardHeaderStyle = { borderBottom: '1px solid #f1f5f9', padding: '12px 20px', background: '#f8fafc', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const cardBodyStyle = { padding: '20px' };
  const statBoxStyle = { padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e8ecf1' };

  return (
    <PageLayout title="Impostazioni Email" subtitle="Configura download automatico F24 da email">
      <div style={{ maxWidth: 1100 }} data-testid="f24-email-settings">
        
        {/* === STATO SISTEMA === */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
              <Settings size={16} color={COLORS.primary} /> Stato Sistema
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={fetchData} style={{ fontSize: 12 }}>
                <RefreshCw size={13} style={{ marginRight: 5 }} /> Aggiorna
              </Button>
              <Button size="sm" onClick={runManualScan} disabled={scanning} data-testid="scan-manuale-btn" style={{ background: COLORS.primary, color: '#fff', fontSize: 12 }}>
                {scanning ? <Loader2 size={13} className="animate-spin" style={{ marginRight: 5 }} /> : <Play size={13} style={{ marginRight: 5 }} />}
                Scansiona Ora
              </Button>
            </div>
          </div>
          <div style={cardBodyStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Scansione Auto</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch checked={settings?.auto_scan_attivo || false} onCheckedChange={toggleAutoScan} data-testid="auto-scan-toggle" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: settings?.auto_scan_attivo ? '#16a34a' : '#94a3b8' }}>
                    {settings?.auto_scan_attivo ? 'Attiva' : 'Disattiva'}
                  </span>
                </div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Intervallo
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{settings?.scan_interval_minuti || 10} min</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Mittenti Configurati</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{(settings?.mittenti || []).length}</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>F24 da Pagare</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>{stato?.statistiche?.f24_da_pagare || 0}</div>
              </div>
            </div>
            {stato?.ultima_scansione && (
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6' }}>
                {stato.ultima_scansione.success
                  ? <CheckCircle size={14} color="#16a34a" />
                  : <AlertCircle size={14} color="#dc2626" />}
                Ultima scansione: {new Date(stato.ultima_scansione.timestamp).toLocaleString('it-IT')} — {stato.ultima_scansione.tipo}
              </div>
            )}
          </div>
        </div>

        {/* === CONFIGURAZIONE === */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
              <Clock size={16} color={COLORS.primary} /> Configurazione Scansione
            </h3>
          </div>
          <div style={cardBodyStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Intervallo scansione (minuti)</label>
                <Input type="number" min="5" max="120" value={settings?.scan_interval_minuti || 10}
                  onChange={(e) => setSettings(prev => ({ ...prev, scan_interval_minuti: parseInt(e.target.value) || 10 }))}
                  data-testid="scan-interval-input" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Giorni indietro da cercare</label>
                <Input type="number" min="1" max="365" value={settings?.giorni_indietro || 7}
                  onChange={(e) => setSettings(prev => ({ ...prev, giorni_indietro: parseInt(e.target.value) || 7 }))}
                  data-testid="giorni-indietro-input" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button onClick={saveSettings} disabled={saving} style={{ width: '100%', background: COLORS.primary, color: '#fff' }} data-testid="save-settings-btn">
                  {saving ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> : <Save size={14} style={{ marginRight: 6 }} />}
                  Salva Impostazioni
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* === MITTENTI === */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
              <Mail size={16} color={COLORS.primary} /> Mittenti Configurati ({(settings?.mittenti || []).length})
            </h3>
            <Button size="sm" onClick={() => setShowAddMittente(true)} style={{ background: COLORS.primary, color: '#fff', fontSize: 12 }} data-testid="add-mittente-btn">
              <Plus size={13} style={{ marginRight: 5 }} /> Aggiungi Mittente
            </Button>
          </div>
          <div style={cardBodyStyle}>
            {/* Form nuovo mittente */}
            {showAddMittente && (
              <div style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#1e40af' }}>Nuovo Mittente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Input placeholder="Email mittente" value={newMittente.email}
                    onChange={(e) => setNewMittente(prev => ({ ...prev, email: e.target.value }))} data-testid="new-mittente-email" />
                  <Input placeholder="Nome (opzionale)" value={newMittente.nome}
                    onChange={(e) => setNewMittente(prev => ({ ...prev, nome: e.target.value }))} data-testid="new-mittente-nome" />
                  <Select value={newMittente.tipo} onValueChange={(v) => setNewMittente(prev => ({ ...prev, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPI_MITTENTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newMittente.categoria_f24} onValueChange={(v) => setNewMittente(prev => ({ ...prev, categoria_f24: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIE_F24.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button size="sm" onClick={addMittente} style={{ background: COLORS.primary, color: '#fff' }} data-testid="confirm-add-mittente-btn">
                    <Plus size={13} style={{ marginRight: 4 }} /> Aggiungi
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddMittente(false)}>Annulla</Button>
                </div>
              </div>
            )}

            {/* Lista mittenti */}
            <div>
              {(settings?.mittenti || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                  Nessun mittente configurato. Aggiungine uno.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f8fafc' }}>EMAIL</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f8fafc' }}>TIPO</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f8fafc' }}>PAROLE CHIAVE</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f8fafc' }}>ATTIVO</th>
                      <th style={{ padding: '8px 12px', background: '#f8fafc' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(settings?.mittenti || []).map((mittente, index) => (
                      <tr key={mittente.email || index} style={{ borderBottom: '1px solid #f1f5f9', opacity: mittente.attivo ? 1 : 0.5 }}
                        data-testid={`mittente-card-${index}`}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{mittente.email}</div>
                          {mittente.nome && mittente.nome !== mittente.email && (
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{mittente.nome}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: mittente.tipo === 'commercialista' ? '#dbeafe' : '#f1f5f9', color: mittente.tipo === 'commercialista' ? '#1d4ed8' : '#64748b', fontWeight: 500 }}>
                            {TIPI_MITTENTE.find(t => t.value === mittente.tipo)?.label || mittente.tipo || 'Altro'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {(mittente.parole_chiave || []).map(kw => (
                              <span key={kw} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {kw}
                                <button onClick={() => removeKeyword(index, kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, fontSize: 12 }}>×</button>
                              </span>
                            ))}
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Input placeholder="+ parola" style={{ width: 100, height: 26, fontSize: 11, padding: '0 8px' }}
                                value={newKeyword[index] || ''}
                                onChange={(e) => setNewKeyword(prev => ({ ...prev, [index]: e.target.value }))}
                                onKeyPress={(e) => e.key === 'Enter' && addKeywordToMittente(index)} />
                              <button onClick={() => addKeywordToMittente(index)} style={{ background: '#e8ecf1', border: 'none', borderRadius: 6, cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Switch checked={mittente.attivo} onCheckedChange={(v) => updateMittente(index, 'attivo', v)} />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button onClick={() => removeMittente(mittente.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* === LOG SCANSIONI === */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
              <RefreshCw size={16} color={COLORS.primary} /> Log Scansioni Recenti
            </h3>
          </div>
          <div style={cardBodyStyle}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>Nessuna scansione effettuata</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.map((log, index) => (
                  <div key={index} style={{ padding: '10px 14px', borderRadius: 8, background: log.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${log.success ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {log.success ? <CheckCircle size={14} color="#16a34a" /> : <AlertCircle size={14} color="#dc2626" />}
                      <span style={{ color: '#374151' }}>{new Date(log.timestamp).toLocaleString('it-IT')}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', fontSize: 11 }}>{log.tipo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, color: '#64748b' }}>
                      {log.risultato?.processamento && <span>F24: {log.risultato.processamento.f24_inseriti || 0}</span>}
                      {log.errore && <span style={{ color: '#dc2626' }}>{log.errore}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* === GMAIL SETTINGS === */}
        <GmailSettingsSection />
      </div>
    </PageLayout>
  );
}
