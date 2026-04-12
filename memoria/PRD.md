# PRD — Ceraldi ERP
> Product Requirements Document | Aprile 2026 | DB: Gestionale

---

## Identità
- **Azienda**: Ceraldi Group S.R.L. — Bar/Pasticceria, Napoli
- **P.IVA**: 04523831214 | **Regime**: Ordinario
- **Stack**: React 18 + FastAPI + MongoDB Atlas (DB: `Gestionale`)
- **Utenti**: uso interno staff amministrativo (no multi-tenant)

---

## Stato Implementazione

### ✅ Funzionante
| Modulo | Dettagli |
|--------|----------|
| **Fatture** | 1.405 fatture SDI, 29 NC (TD04) con segno negativo, DatiFattureCollegate |
| **Prima Nota** | Cassa (136) + Banca (4.365), Provvisori con Cassa/Banca/Sospesa |
| **Corrispettivi** | 54 record, import XML registratore |
| **Fornitori** | 245 in `fornitori`, aggiornamento OpenAPI Camera Commercio |
| **HR** | 30 dipendenti, 301 cedolini (vista Mese/Dipendente), 290 presenze |
| **Presenze** | Calendario giornaliero, import PDF Libro Unico, giustificativi |
| **Magazzino** | 496 prodotti in warehouse_stocks, catalogo da fatture XML |
| **Noleggio** | 4 veicoli, 165 verbali, estrazione targa da PDF, riconciliazione |
| **Assegni** | 220 assegni, modal fatture per fornitore, NC con netting |
| **Banca** | 8.839 movimenti EC, riconciliazione automatica |
| **Verifica** | Coerenza IVA, saldi, discrepanze |
| **Email** | PEC Aruba (fatture SDI) + Gmail (cedolini, F24, verbali) |

### 🔴 Da Implementare (Backlog)
| Priorità | Cosa | Note |
|----------|------|------|
| P1 | Prima Nota automatica senza conferma | Trigger da matching EC ≥90% confidenza |
| P1 | Scarica posta verbali da PEC | Endpoint `/scarica-posta` ancora stub |
| P2 | Scheda fornitore completa | Fatturato, scadenze, pattern pagamento |
| P2 | Fascicolo dipendente | Storico cedolini + TFR + presenze + bonifici |
| P2 | Cleanup DB | `suppliers` (15) → merge in `fornitori` (245) |
| P3 | TFR automatico da cedolino | Parser estrae quota ma manca trigger |
| P3 | Controllo IVA mensile automatico | Logica definita, non implementata |
| P3 | WhatsApp notifiche | Token Meta configurato, endpoint da creare |

---

## Collections MongoDB (DB: Gestionale)

```
HR:           dipendenti (30), cedolini (301), presenze (290)
CONTABILITA:  prima_nota_banca (4.365), prima_nota_cassa (136), corrispettivi (54)
              invoices (1.405), piano_conti (30)
FORNITORI:    fornitori (245), scadenziario_fornitori (185)
BANCA:        estratto_conto_movimenti (8.839), assegni (220)
NOLEGGIO:     veicoli_noleggio (4), verbali_noleggio (165)
MAGAZZINO:    warehouse_stocks (496), dizionario_prodotti (680)
EMAIL:        mittenti_attendibili (11), documents_inbox (32)
FISCALE:      f24_unificato (1)
```

---

## Regole Contabili (Art. 2425 c.c.)

### Conto Economico
| Voce CE | Categoria | Deducibilità IRES | IVA |
|---------|-----------|-------------------|-----|
| A1 | Ricavi (corrispettivi) | 100% | debito |
| B6 | Materie prime/merci | 100% | 100% credito |
| B7 | Energia | 100% | 100% |
| B7 | **Telefonia** | **80%** | **50%** |
| B7 | **Carburante** | **20%** | **40%** |
| B8 | **Noleggio auto** | **20% max €3.615/anno** | **40%** |
| B9a | Salari netti | 100% | N/A |
| B9b | INPS azienda | 100% | N/A |
| B9c | TFR | 100% | N/A |

### IVA
```
Debito  = SUM(corrispettivi.totale_iva)
Credito = SUM(invoices.iva_detraibile)
Saldo   = Debito − Credito → F24 codice 6001
```

### Calendario Fiscale
| Giorno | Adempimento |
|--------|-------------|
| 16/mese | F24 (IRPEF 1001, INPS 1301/1303, Addizionali 1030/3802) |
| 16/mar | Saldo IVA anno precedente (6099) |
| 30/giu | Dichiarazione redditi IRES/IRAP |
| 30/nov | Acconto imposte |

### Codici Pagamento FE
| Codice | Metodo | Prima Nota |
|--------|--------|------------|
| MP01 | Contanti | Cassa |
| MP02 | Assegno | Banca |
| MP05 | Bonifico | Banca |
| MP08 | Carta credito | Banca |

### Tipi Documento FE
| Codice | Tipo | Note |
|--------|------|------|
| TD01 | Fattura | acquisto → uscita |
| TD04 | Nota credito | **importo negativo** |
| TD24/25 | Fattura differita | vendita |

---

## Struttura Cedolino
| Campo | Voce CE |
|-------|---------|
| `lordo` (spesso 0 nel DB) | B9a |
| `netto` / `netto_mese` | — |
| `inps_azienda` | B9b |
| `tfr_mese` | B9c |
| `nome_dipendente` | Display name (COGNOME NOME) |

---

*Aggiornato: Aprile 2026*
