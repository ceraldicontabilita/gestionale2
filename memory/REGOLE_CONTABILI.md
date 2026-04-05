# Regole Contabili Italiane — Ceraldi ERP
> P.IVA: 04523831214 | Aggiornato: Aprile 2026

---

## 1. FONTI DEI DATI

| Tipo | Collection | Cosa Rappresenta |
|---|---|---|
| Ricavi | `corrispettivi` | Scontrini/ricevute — UNICA fonte ricavi |
| Acquisti | `invoices` | Fatture passive ricevute dai fornitori |
| Stipendi | `cedolini` | Buste paga dipendenti |
| Banca | `estratto_conto_movimenti` | Movimenti bancari |
| Cassa | `prima_nota_cassa` | Contanti |

---

## 2. CONTO ECONOMICO (Art. 2425 c.c.)

### A — Valore della Produzione
| Voce | Fonte | Deducibilità |
|---|---|---|
| A1 — Ricavi vendite | `corrispettivi.totale_giornata` | 100% |

### B — Costi della Produzione
| Voce | Fonte | Deducibilità | IVA Detraibile |
|---|---|---|---|
| B6 — Materie prime/merci | invoices (default) | 100% | 100% |
| B7 — Energia (Enel, Edison) | invoices | 100% | 100% |
| **B7 — Telefonia** (TIM, Vodafone) | invoices | **80%** | **50%** |
| B7 — Consulenze (Studio...) | invoices | 100% | 100% |
| B7 — Trasporti (BRT, DHL) | invoices | 100% | 100% |
| **B7 — Carburante** (Q8, Esso) | invoices | **20%** | **40%** |
| **B8 — Noleggio auto** (ARVAL) | invoices | **20% su max €3.615/anno** | **40%** |
| B8 — Affitti immobili | invoices | 100% | Spesso esente |
| B9a — Salari | cedolini (lordo) | 100% | N/A |
| B9b — Oneri sociali | cedolini (inps_azienda) | 100% | N/A |
| B9c — TFR | cedolini (tfr) | 100% | N/A |

---

## 3. REGOLE FISCALI SPECIFICHE

### 3.1 Auto Aziendali (Art. 164 TUIR)
| Costo | Deducibilità | IVA |
|---|---|---|
| Noleggio | 20% su max €3.615,20/anno | 40% |
| Carburante | 20% | 40% |
| Manutenzione | 20% | 40% |
| Assicurazione | 20% | Esente |

**Se auto assegnata a dipendente**: deducibilità sale al **70%**

### 3.2 Telefonia (Art. 102 TUIR)
- Deducibilità: **80%** — IVA detraibile: **50%**

### 3.3 Interessi Passivi (Art. 96 TUIR)
- Limite ROL: **30%** del Risultato Operativo Lordo
- Eccedenza riportabile agli anni successivi

---

## 4. CALENDARIO FISCALE

| Mese | Giorno | Adempimento |
|---|---|---|
| Ogni mese | 16 | F24 (IRPEF, INPS, Addizionali) |
| Marzo | 16 | Saldo IVA anno precedente |
| Giugno | 30 | Dichiarazione redditi |
| Novembre | 30 | Acconto imposte |

---

## 5. LIQUIDAZIONE IVA

```
IVA a debito  = SUM(corrispettivi.totale_iva) per periodo
IVA a credito = SUM(invoices.iva_detraibile) per periodo
Liquidazione  = IVA a debito - IVA a credito
```
- Se positiva → versamento tramite F24
- Se negativa → credito da riportare

---

## 6. METODI DI PAGAMENTO FE (Fatturazione Elettronica)

| Codice | Metodo | Prima Nota |
|---|---|---|
| MP01 | Contanti | Cassa |
| MP05 | Bonifico bancario | Banca |
| MP08 | Carta di credito | Banca |
| MP19 | SEPA Credit Transfer | Banca |
| MP02 | Assegno | Banca |

---

## 7. TIPI DOCUMENTO FE

| Codice | Tipo | Flusso |
|---|---|---|
| TD01 | Fattura ordinaria | Acquisto → uscita |
| TD04 | Nota di credito | Rimborso → entrata |
| TD24/25 | Fattura differita | Vendita → entrata |
| TD16 | Autofattura (integrazione) | Reverse charge |

---

## 8. STRUTTURA CEDOLINO

| Campo | Descrizione |
|---|---|
| `lordo` | Retribuzione lorda (B9a CE) |
| `netto` | Retribuzione netta pagata |
| `inps_azienda` | Contributi INPS azienda (B9b CE) |
| `tfr` | Accantonamento TFR (B9c CE) |
| `costo_azienda` | Totale costo = lordo + inps_azienda + tfr |

---

## 9. MAGAZZINO — CATEGORIE BAR/PASTICCERIA

| Codice | Categoria | Centro Costo |
|---|---|---|
| BEV-CAF | Caffè e derivati | 1.1_CAFFE_BEVANDE_CALDE |
| BEV-VRS | Vini rossi | 1.2_BEVANDE_FREDDE_ALCOLICI |
| MP-FAR | Farine e amidi | 1.3_MATERIE_PRIME_PASTICCERIA |
| MP-ZUC | Zuccheri | 1.3_MATERIE_PRIME_PASTICCERIA |
| MP-LAT | Latticini | 1.3_MATERIE_PRIME_PASTICCERIA |
| GEL-BAS | Basi per gelato | 1.5_GELATI_GRANITE |
| IMB-CAR | Imballaggi carta | 13.1_IMBALLAGGI |

---

## 10. REGOLA FONDAMENTALE

> **I corrispettivi sono l'UNICA fonte di RICAVI.**
> Le fatture ricevute (invoices) sono COSTI (ciclo passivo).
> NON sommarli insieme per il volume d'affari.
