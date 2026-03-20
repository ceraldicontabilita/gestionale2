/**
 * MappaGestionale.jsx
 * Spiega il flusso dati reale del gestionale Ceraldi ERP:
 *  - DA DOVE arrivano i dati
 *  - COSA FA la pagina
 *  - COSA ALIMENTA / POPOLA a sua volta
 *  - COSA ASPETTA per riconciliarsi / verificarsi
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';

// ─────────────────────────────────────────────────────────────────────────────
// Struttura dati flussi ERP
// ─────────────────────────────────────────────────────────────────────────────
const FLUSSI = {
  PRIMA_NOTA_CASSA: {
    titolo: "Prima Nota Cassa",
    icona: "💵",
    colore: "#16a34a",
    sottotitolo: "Il registro del denaro fisico e degli incassi giornalieri",
    entraDA: [
      {
        label: "XML Corrispettivi RT",
        fonte: "Import Documenti (caricamento manuale)",
        dettaglio: "File XML giornalieri generati dal Registratore Telematico. Ogni giorno, dopo la chiusura, il file viene scaricato dal RT e caricato manualmente nella pagina Import Documenti. Il sistema li legge in automatico."
      }
    ],
    fa: [
      "Legge l'XML ed estrae l'Ammontare lordo (IVA inclusa) e il PagatoElettronico (POS) per ogni giornata di lavoro.",
      "DARE = Ricavi Lordi totali (PagatoContanti + PagatoElettronico) — IVA inclusa. È l'intero incasso della giornata.",
      "AVERE = Pagato Elettronico (POS) — è il denaro che fisicamente uscirà dalla cassa verso la banca tramite accredito.",
      "SALDO CASSA = rimane in cassa solo il contante fisico (DARE - AVERE)."
    ],
    alimenta: [
      {
        label: "Bilancio",
        percorso: "→ Sezione Ricavi",
        dettaglio: "I totali mensili degli incassi vengono sommati e portati nel Bilancio alla voce Ricavi. Questo valore è la base del Volume d'Affari."
      },
      {
        label: "Prima Nota Banca",
        percorso: "→ Entrata POS attesa sull'estratto conto",
        dettaglio: "L'importo POS registrato in cassa diventa un'entrata attesa sul conto corrente. Quando arriva il CSV della banca, il sistema sa già che ci deve essere un accredito corrispondente."
      }
    ],
    aspetta: [
      {
        label: "Estratto Conto Bancario (CSV Banco BPM)",
        tipo: "Riconciliazione POS",
        urgenza: "alta",
        motivo: "Verifica che l'accredito POS accreditato sul conto corrente sia UGUALE al POS nell'XML dei corrispettivi. Se c'è differenza, segnala un'anomalia: il giorno successivo bisogna recuperare o scalare l'importo discordante."
      },
      {
        label: "Chiusura Manuale POS sera (inserimento operatore)",
        tipo: "Verifica Fiscale Anti-sanzione",
        urgenza: "critica",
        motivo: "L'operatore inserisce manualmente l'importo della chiusura POS a fine giornata. Il sistema confronta questo dato con il POS dell'XML. Se sono DIVERSI: o c'è un errore nel RT (rischio sanzione), oppure il giorno dopo c'è un importo sospeso da bilanciare. Questo controllo previene le contestazioni dell'Agenzia delle Entrate."
      }
    ]
  },

  PRIMA_NOTA_BANCA: {
    titolo: "Prima Nota Banca",
    icona: "🏦",
    colore: "#1d4ed8",
    sottotitolo: "Il registro di tutto ciò che entra ed esce dal conto corrente",
    entraDA: [
      {
        label: "CSV Estratto Conto Banco BPM",
        fonte: "Import Documenti (caricamento manuale) oppure direttamente da Prima Nota",
        dettaglio: "Il file CSV si scarica dall'home banking Banco BPM. Contiene ogni singolo movimento bancario con data valuta, data operazione, importo e causale. Viene caricato dal pulsante 'Force Reimport' in Prima Nota Banca."
      }
    ],
    fa: [
      "Registra TUTTI i movimenti del conto corrente: accrediti POS, bonifici in entrata, pagamenti fornitori, F24, stipendi, commissioni bancarie.",
      "Calcola il saldo progressivo giornaliero, così in ogni momento sai esattamente quanto c'è sul conto.",
      "Le commissioni bancarie da 1€ (o altri importi fissi) sono movimenti validi e vengono inclusi — non scartati.",
      "Ogni movimento rimane 'in attesa di abbinamento' finché la Riconciliazione non lo collega a un documento."
    ],
    alimenta: [
      {
        label: "Riconciliazione",
        percorso: "→ Ogni movimento cerca il documento corrispondente",
        dettaglio: "Ogni riga dell'estratto conto entra nella coda di riconciliazione. Il sistema cerca automaticamente a quale fattura, F24, cedolino o corrispettivo appartiene."
      },
      {
        label: "Bilancio",
        percorso: "→ Voce Disponibilità Liquide",
        dettaglio: "Il saldo finale del conto corrente alimenta la sezione Attivo del Bilancio (disponibilità liquide)."
      }
    ],
    aspetta: [
      {
        label: "POS da Prima Nota Cassa",
        tipo: "Verifica Accredito POS",
        urgenza: "alta",
        motivo: "Ogni accredito POS sull'estratto conto deve corrispondere esattamente al POS registrato nell'XML dei corrispettivi di quella data. Se l'accredito arriva il giorno dopo (come spesso avviene), il sistema tiene traccia della data di riferimento per abbinarlo correttamente."
      },
      {
        label: "Fatture Fornitori (Ciclo Passivo)",
        tipo: "Verifica Pagamento Fornitori",
        urgenza: "media",
        motivo: "Ogni uscita bancaria per fornitore (bonifico SEPA) deve corrispondere a una fattura nel Ciclo Passivo. La riconciliazione abbina l'uscita alla fattura e la marca come 'pagata'."
      },
      {
        label: "Modelli F24 (Fisco)",
        tipo: "Verifica Versamenti Tributari",
        urgenza: "media",
        motivo: "I pagamenti F24 (IVA, IRPEF dipendenti, contributi) appaiono come uscite nell'estratto conto. Devono essere abbinati ai modelli F24 del modulo Fisco per confermare che il versamento è andato a buon fine."
      },
      {
        label: "Cedolini Stipendi (Prima Nota Salari)",
        tipo: "Verifica Bonifici Dipendenti",
        urgenza: "media",
        motivo: "Ogni bonifico stipendio uscito dalla banca deve corrispondere all'importo netto del cedolino del dipendente per quel mese. La differenza tra lordo e netto è già stata versata come F24 contributi."
      }
    ]
  },

  PRIMA_NOTA_SALARI: {
    titolo: "Prima Nota Salari",
    icona: "💼",
    colore: "#b45309",
    sottotitolo: "Il registro dei costi del personale e dei bonifici stipendio",
    entraDA: [
      {
        label: "Cedolini Dipendenti (PDF)",
        fonte: "Import Documenti (caricamento manuale PDF) o inserimento diretto in Paghe",
        dettaglio: "I cedolini mensili elaborati dal consulente del lavoro o dal sistema paghe. Contengono: retribuzione lorda, netta da pagare al dipendente, contributi INPS a carico azienda, IRPEF trattenuta, TFR maturato."
      }
    ],
    fa: [
      "Registra il COSTO TOTALE DEL PERSONALE come uscita contabile mensile (non solo lo stipendio netto, ma anche i contributi a carico dell'azienda).",
      "Separa: (1) il netto da pagare al dipendente tramite bonifico, (2) i contributi INPS/INAIL da versare con F24, (3) la quota TFR da accantonare.",
      "Genera automaticamente le scritture di Prima Nota per ogni dipendente del mese.",
      "Calcola il costo totale mensile del personale da portare in Bilancio."
    ],
    alimenta: [
      {
        label: "Bilancio",
        percorso: "→ Costi del Personale",
        dettaglio: "Il costo totale lordo del personale (stipendi + contributi azienda + TFR) alimenta la sezione Costi del Bilancio, voce 'Costo del Lavoro'."
      },
      {
        label: "F24 Contributi",
        percorso: "→ Versamenti INPS/INAIL da fare",
        dettaglio: "I contributi calcolati sui cedolini generano automaticamente la lista dei versamenti da inserire nel modello F24 del mese. Il sistema sa già quali codice tributo usare per ogni tipo di contributo."
      },
      {
        label: "Prima Nota Banca",
        percorso: "→ Bonifici stipendi attesi in uscita",
        dettaglio: "L'importo netto di ogni cedolino diventa un'uscita attesa sull'estratto conto (un bonifico per ogni dipendente). Quando arriva il CSV banca, questi bonifici vengono abbinati automaticamente."
      }
    ],
    aspetta: [
      {
        label: "Estratto Conto Bancario",
        tipo: "Verifica Bonifici Pagati",
        urgenza: "alta",
        motivo: "Conferma che ogni bonifico stipendio sia effettivamente uscito dalla banca e che l'importo corrisponda esattamente al netto del cedolino. Se un dipendente non risulta pagato, il sistema lo segnala come 'in sospeso'."
      },
      {
        label: "Ricevute F24 Contributi",
        tipo: "Verifica Versamento Contributi",
        urgenza: "alta",
        motivo: "I contributi calcolati devono essere versati entro il 16 del mese successivo. Il sistema aspetta che il F24 corrispondente venga riconciliato sull'estratto conto per segnare i contributi come 'versati'."
      }
    ]
  },

  CORRISPETTIVI: {
    titolo: "Corrispettivi RT",
    icona: "🧾",
    colore: "#dc2626",
    sottotitolo: "Gli incassi giornalieri dal Registratore Telematico",
    entraDA: [
      {
        label: "File XML Registratore Telematico",
        fonte: "Import Documenti (caricamento manuale) — generato automaticamente dal RT ogni giorno",
        dettaglio: "Il Registratore Telematico invia automaticamente i dati all'Agenzia delle Entrate. Il file XML locale viene scaricato dal RT o dal portale AdE e caricato nel gestionale."
      }
    ],
    fa: [
      "Legge ogni giornata lavorativa con gli importi suddivisi per aliquota IVA.",
      "Estrae PagatoContanti (incasso fisico in cassa) e PagatoElettronico (POS, carta di credito/debito).",
      "Mostra il dettaglio giornaliero e mensile degli incassi con confronto annuale.",
      "Calcola il totale IVA a debito da versare all'Erario ogni trimestre."
    ],
    alimenta: [
      {
        label: "Prima Nota Cassa",
        percorso: "→ DARE Ricavi + AVERE POS",
        dettaglio: "Ogni riga del corrispettivo diventa due righe in Prima Nota Cassa: un DARE per l'incasso totale e un AVERE per il POS (che va in banca)."
      },
      {
        label: "Fisco / IVA",
        percorso: "→ IVA a Debito trimestrale",
        dettaglio: "L'IVA calcolata sui corrispettivi va sommata all'IVA delle fatture emesse per calcolare la liquidazione trimestrale."
      },
      {
        label: "Bilancio",
        percorso: "→ Volume d'Affari (Ricavi)",
        dettaglio: "I corrispettivi sono la principale fonte dei ricavi aziendali. Il totale annuo alimenta il Volume d'Affari nella Dashboard e nel Bilancio."
      }
    ],
    aspetta: [
      {
        label: "Chiusura Manuale POS Sera",
        tipo: "Verifica Quadratura POS",
        urgenza: "critica",
        motivo: "L'importo POS nel file XML deve corrispondere all'importo reale letto sulla macchina POS a fine giornata. Discrepanze indicate dalla chiusura manuale possono segnalare anomalie da correggere prima della trasmissione."
      },
      {
        label: "Accredito POS su Estratto Conto",
        tipo: "Verifica Accredito Bancario",
        urgenza: "media",
        motivo: "L'accredito POS arriva sulla banca in genere 1-2 giorni lavorativi dopo la giornata di incasso. Il sistema aspetta di trovare sull'estratto conto un importo uguale al POS XML (data, importo)."
      }
    ]
  },

  FATTURE_RICEVUTE: {
    titolo: "Fatture Ricevute (Ciclo Passivo)",
    icona: "📥",
    colore: "#7c3aed",
    sottotitolo: "Le fatture di acquisto dai fornitori",
    entraDA: [
      {
        label: "File XML Fattura Elettronica SDI",
        fonte: "Import Documenti (caricamento manuale) oppure download automatico da email",
        dettaglio: "Le fatture arrivano via SDI (Sistema di Interscambio) dell'Agenzia delle Entrate in formato XML. Possono essere scaricate manualmente o, con l'integrazione email attiva, arrivare automaticamente dalla casella di posta."
      }
    ],
    fa: [
      "Legge l'XML SDI ed estrae: fornitore (partita IVA + ragione sociale), data, importo imponibile, IVA, totale, scadenza di pagamento.",
      "Abbina automaticamente la fattura al fornitore già presente in anagrafica (o ne crea uno nuovo).",
      "Categorizza la spesa (materie prime, utenze, servizi, beni strumentali) in base allo storico del fornitore.",
      "Identifica i beni strumentali (cespiti) e li segnala per l'iscrizione in Contabilità."
    ],
    alimenta: [
      {
        label: "Fornitori",
        percorso: "→ Storico fatture per fornitore",
        dettaglio: "Ogni fattura aggiorna automaticamente lo storico del fornitore: importi totali, scadenze aperte, frequenza degli acquisti."
      },
      {
        label: "Scadenze",
        percorso: "→ Nuova scadenza di pagamento",
        dettaglio: "La data di scadenza della fattura viene inserita nello Scadenzario per ricordare quando pagare."
      },
      {
        label: "Prima Nota Banca",
        percorso: "→ Uscita attesa (se SEPA/Bonifico)",
        dettaglio: "Se il metodo di pagamento del fornitore è SEPA o Bonifico, il sistema crea automaticamente un'uscita attesa in Prima Nota Banca che aspetta di essere riconciliata con il pagamento reale."
      },
      {
        label: "Cespiti",
        percorso: "→ Registrazione bene strumentale",
        dettaglio: "Se la fattura contiene un bene ammortizzabile (macchinario, attrezzatura), viene segnalata per essere iscritta nel registro Cespiti con inizio ammortamento."
      },
      {
        label: "Fisco / IVA",
        percorso: "→ IVA a Credito",
        dettaglio: "L'IVA sulle fatture di acquisto è detraibile. Va in compensazione con l'IVA a debito dei corrispettivi per il calcolo della liquidazione trimestrale."
      }
    ],
    aspetta: [
      {
        label: "Pagamento Effettivo (Bonifico/SEPA)",
        tipo: "Riconciliazione Pagamento",
        urgenza: "alta",
        motivo: "La fattura rimane in stato 'da pagare' finché l'uscita bancaria corrispondente non viene riconciliata con questa fattura. Solo allora viene segnata come 'saldata' e rimossa dallo Scadenzario."
      },
      {
        label: "Ricevuta SDI (per fatture emesse)",
        tipo: "Conferma Ricezione",
        urgenza: "bassa",
        motivo: "Per le fatture che passano per il canale SDI, il sistema può verificare che la fattura sia stata correttamente ricevuta e non sia in stato di scarto."
      }
    ]
  },

  FORNITORI: {
    titolo: "Fornitori",
    icona: "🏭",
    colore: "#7c3aed",
    sottotitolo: "L'anagrafica e lo storico di ogni partner commerciale",
    entraDA: [
      {
        label: "Dati estratti dalle Fatture XML",
        fonte: "Ciclo Passivo (automatico al caricamento fattura)",
        dettaglio: "Ogni volta che arriva una nuova fattura da un fornitore sconosciuto, il sistema crea automaticamente la scheda fornitore estraendo P.IVA, ragione sociale e metodo di pagamento dall'XML."
      },
      {
        label: "Inserimento manuale operatore",
        fonte: "Pagina Fornitori",
        dettaglio: "L'operatore può aggiungere o modificare manualmente i dati del fornitore: metodo di pagamento preferito (SEPA, Bonifico, Carta, Contanti), note, categoria merceologica."
      }
    ],
    fa: [
      "Raccoglie tutto lo storico acquisti di ogni fornitore in una scheda unica.",
      "Mostra il totale fatturato per fornitore per anno, le fatture ancora aperte e quelle pagate.",
      "Il metodo di pagamento salvato determina se le nuove fatture vanno automaticamente in Prima Nota Banca (SEPA/Bonifico) o restano in cassa.",
      "Confronta i prezzi storici per identificare aumenti di costo non giustificati."
    ],
    alimenta: [
      {
        label: "Ciclo Passivo",
        percorso: "→ Suggerimento categoria e metodo pagamento",
        dettaglio: "Quando arriva una nuova fattura da questo fornitore, il sistema precompila automaticamente categoria merceologica e metodo di pagamento basandosi sullo storico."
      },
      {
        label: "Prima Nota Banca",
        percorso: "→ Automatismo pagamento SEPA",
        dettaglio: "Se il fornitore ha metodo di pagamento SEPA/Bonifico, ogni sua fattura genera automaticamente un'uscita attesa in Prima Nota Banca."
      }
    ],
    aspetta: [
      {
        label: "Pagamento Fatture Scadute",
        tipo: "Sollecito Manuale",
        urgenza: "media",
        motivo: "Le fatture con scadenza passata rimangono evidenziate in rosso nello storico fornitore. Serve un'azione manuale per registrare il pagamento o richiedere una proroga."
      }
    ]
  },

  RICONCILIAZIONE: {
    titolo: "Riconciliazione",
    icona: "🔗",
    colore: "#1d4ed8",
    sottotitolo: "Il collegamento tra i movimenti bancari e i documenti contabili",
    entraDA: [
      {
        label: "Movimenti Prima Nota Banca",
        fonte: "Automatico dopo import CSV estratto conto",
        dettaglio: "Tutti i movimenti dell'estratto conto entrano in coda di riconciliazione in stato 'da abbinare'."
      },
      {
        label: "Documenti da abbinare",
        fonte: "Ciclo Passivo, Prima Nota Cassa (POS), F24, Salari",
        dettaglio: "Fatture da pagare, POS attesi, F24 da versare, stipendi da pagare: tutti questi 'documenti' aspettano di trovare un movimento bancario corrispondente."
      }
    ],
    fa: [
      "Confronta ogni movimento bancario con i documenti aperti cercando corrispondenze per importo, data e causale.",
      "Quando trova un abbinamento certo, lo conferma automaticamente.",
      "Quando ci sono più possibilità, propone le opzioni all'operatore per la scelta manuale.",
      "Gestisce anche gli assegni (emessi e ricevuti) con il loro ciclo specifico (emissione → presentazione → addebito).",
      "Traccia i bonifici SEPA ai fornitori dall'emissione all'effettivo addebito bancario."
    ],
    alimenta: [
      {
        label: "Fatture Fornitori",
        percorso: "→ Stato 'Pagata'",
        dettaglio: "Quando un'uscita bancaria viene abbinata a una fattura fornitore, questa viene marcata come pagata e rimossa dallo Scadenzario."
      },
      {
        label: "Prima Nota Cassa",
        percorso: "→ Conferma POS",
        dettaglio: "Quando l'accredito POS bancario viene trovato e abbinato, la voce AVERE della Prima Nota Cassa viene confermata come ricevuta dalla banca."
      },
      {
        label: "F24",
        percorso: "→ Stato 'Versato'",
        dettaglio: "Il versamento F24 trovato sull'estratto conto viene abbinato al modello F24 e segnato come 'versato'."
      }
    ],
    aspetta: [
      {
        label: "Tutti i documenti abbinabili",
        tipo: "Chiusura Periodo Contabile",
        urgenza: "alta",
        motivo: "Il mese si considera 'chiuso contabilmente' solo quando tutti i movimenti bancari sono stati riconciliati. Movimenti non abbinati indicano documenti mancanti o errori di importo da investigare prima di procedere al bilancio mensile."
      }
    ]
  },

  FISCO: {
    titolo: "Fisco & IVA",
    icona: "🏛️",
    colore: "#be185d",
    sottotitolo: "Il calcolo e il versamento di tutti i tributi",
    entraDA: [
      {
        label: "IVA a Debito dai Corrispettivi",
        fonte: "Corrispettivi RT (automatico)",
        dettaglio: "L'IVA sugli incassi giornalieri viene sommata automaticamente mese per mese."
      },
      {
        label: "IVA a Credito dalle Fatture",
        fonte: "Ciclo Passivo — Fatture Ricevute (automatico)",
        dettaglio: "L'IVA pagata ai fornitori è detraibile. Viene sommata mese per mese per la compensazione."
      },
      {
        label: "Contributi IRPEF/INPS da Cedolini",
        fonte: "Prima Nota Salari (automatico)",
        dettaglio: "Le ritenute d'acconto IRPEF e i contributi INPS calcolati sui cedolini diventano debiti tributari da versare."
      }
    ],
    fa: [
      "Calcola ogni trimestre la liquidazione IVA: IVA a Debito - IVA a Credito = importo da versare (o credito IVA da riportare).",
      "Genera i modelli F24 con i codici tributo corretti per ogni versamento: IVA, IRPEF dipendenti, INPS, INAIL.",
      "Tiene il calendario delle scadenze fiscali aggiornato: 16 del mese per ritenute, trimestrali per IVA.",
      "Raccoglie i dati necessari per la dichiarazione annuale IVA e il 770."
    ],
    alimenta: [
      {
        label: "Scadenze",
        percorso: "→ Nuove scadenze fiscali",
        dettaglio: "Ogni adempimento tributario genera una scadenza nello Scadenzario con data limite e importo."
      },
      {
        label: "Prima Nota Banca",
        percorso: "→ Uscita F24 attesa",
        dettaglio: "Una volta creato il modello F24, il sistema sa che ci sarà un'uscita bancaria di quell'importo entro la scadenza. La aspetta sull'estratto conto per la riconciliazione."
      }
    ],
    aspetta: [
      {
        label: "Pagamento F24 su Estratto Conto",
        tipo: "Conferma Versamento",
        urgenza: "critica",
        motivo: "Il versamento deve risultare sull'estratto conto entro la data di scadenza. In caso contrario il sistema segnala il tributo come 'potenzialmente non versato' e il commercialista deve essere avvisato immediatamente per evitare sanzioni e interessi."
      }
    ]
  },

  BILANCIO: {
    titolo: "Bilancio & Analisi",
    icona: "⚖️",
    colore: "#0f766e",
    sottotitolo: "La fotografia economica e patrimoniale dell'azienda",
    entraDA: [
      {
        label: "Prima Nota Cassa",
        fonte: "Ricavi giornalieri → totali mensili",
        dettaglio: "Gli incassi totali (contanti + POS) alimentano la voce Ricavi del Conto Economico."
      },
      {
        label: "Prima Nota Banca",
        fonte: "Saldo finale conto corrente",
        dettaglio: "Il saldo del conto corrente alimenta la voce Disponibilità Liquide nello Stato Patrimoniale."
      },
      {
        label: "Fatture Fornitori",
        fonte: "Costi di acquisto per categoria",
        dettaglio: "Tutti i costi sostenuti per forniture, utenze, servizi entrano nel Conto Economico come costi d'esercizio."
      },
      {
        label: "Prima Nota Salari",
        fonte: "Costo totale del personale mensile",
        dettaglio: "Stipendi lordi, contributi a carico azienda e accantonamento TFR vanno nella voce 'Costo del Lavoro'."
      },
      {
        label: "Cespiti",
        fonte: "Quote di ammortamento annue",
        dettaglio: "Ogni anno una quota del costo dei beni strumentali viene 'spesata' come ammortamento nel Conto Economico."
      }
    ],
    fa: [
      "Calcola il Conto Economico: Ricavi - Costi = Risultato Operativo → Utile/Perdita d'Esercizio.",
      "Costruisce lo Stato Patrimoniale: cosa possiede l'azienda (Attivo) vs cosa deve (Passivo + Patrimonio Netto).",
      "Mostra il Budget Previsionale confrontato con i dati reali per capire gli scostamenti.",
      "Analizza i trend mensili e annuali per identificare stagionalità e anomalie."
    ],
    alimenta: [
      {
        label: "Commercialista",
        percorso: "→ Dati per dichiarazione dei redditi",
        dettaglio: "Il Bilancio, una volta approvato, è il documento base che il commercialista usa per la dichiarazione fiscale annuale (IRES, IRAP)."
      },
      {
        label: "Chiusura Esercizio",
        percorso: "→ Riapertura conti anno successivo",
        dettaglio: "A fine anno i saldi patrimoniali vengono portati avanti come saldi di apertura dell'anno successivo."
      }
    ],
    aspetta: [
      {
        label: "Chiusura di tutti i mesi contabili",
        tipo: "Completezza Dati",
        urgenza: "alta",
        motivo: "Il Bilancio è attendibile solo se tutti i mesi sono stati riconciliati (Prima Nota Banca, Cassa, Salari). Mesi con movimenti non abbinati producono un Bilancio provvisorio e potenzialmente errato."
      },
      {
        label: "Approvazione Commercialista",
        tipo: "Validazione Finale",
        urgenza: "bassa",
        motivo: "Prima di presentare il Bilancio alle autorità, deve essere revisionato e approvato dal commercialista che può richiedere rettifiche o scritture di assestamento."
      }
    ]
  },

  CESPITI: {
    titolo: "Cespiti & Ammortamenti",
    icona: "🏗️",
    colore: "#475569",
    sottotitolo: "I beni strumentali acquistati e il loro valore residuo nel tempo",
    entraDA: [
      {
        label: "Fatture Acquisto Beni Strumentali",
        fonte: "Ciclo Passivo — Fatture Ricevute (con pulsante Scansiona Cespiti)",
        dettaglio: "Il sistema scansiona le fatture importate alla ricerca di beni ammortizzabili (macchinari, attrezzature, arredi, veicoli). Quando li trova, li propone per la registrazione come Cespite."
      }
    ],
    fa: [
      "Registra ogni bene con: descrizione, costo di acquisto, data acquisto, categoria ATECO, aliquota di ammortamento.",
      "Calcola automaticamente la quota di ammortamento annua (solitamente 20-25% per attrezzature, 11% per veicoli, ecc.).",
      "Mostra il valore residuo contabile netto per ogni anno.",
      "Al completamento dell'ammortamento, il bene rimane iscritto a valore zero fino alla dismissione."
    ],
    alimenta: [
      {
        label: "Bilancio",
        percorso: "→ Immobilizzazioni (Attivo) + Quote Ammortamento (Costi)",
        dettaglio: "Il valore netto dei cespiti va nell'Attivo Immobilizzato dello Stato Patrimoniale. Le quote di ammortamento annue vanno nel Conto Economico come costi non monetari."
      }
    ],
    aspetta: [
      {
        label: "Fine Anno Contabile",
        tipo: "Calcolo Quote Annuali",
        urgenza: "bassa",
        motivo: "Le quote di ammortamento vengono calcolate una volta all'anno al momento della chiusura dell'esercizio. Il sistema le calcola automaticamente per tutti i cespiti attivi."
      }
    ]
  },

  DIPENDENTI: {
    titolo: "Dipendenti & HR",
    icona: "👥",
    colore: "#0369a1",
    sottotitolo: "La gestione del personale, delle presenze e delle ferie",
    entraDA: [
      {
        label: "Anagrafica dipendente",
        fonte: "Inserimento manuale operatore (HR)",
        dettaglio: "Nome, contratto, data assunzione, qualifica, retribuzione contrattuale. Il flag 'In Carico' indica se il dipendente è attualmente attivo in azienda."
      },
      {
        label: "Timbrature / Presenze",
        fonte: "Inserimento manuale o import da badge",
        dettaglio: "Le ore di presenza giornaliere di ogni dipendente vengono registrate nella sezione Presenze. Sono la base per il calcolo del cedolino."
      }
    ],
    fa: [
      "Tiene traccia dello stato di ogni dipendente: in carico, in ferie, in malattia, dimesso.",
      "Gestisce le richieste di ferie e permessi con approvazione/rifiuto.",
      "Mantiene il saldo ferie residuo aggiornato per ogni dipendente.",
      "Registra le presenze mensili come base per il calcolo della busta paga."
    ],
    alimenta: [
      {
        label: "Cedolini / Paghe",
        percorso: "→ Dati presenze per calcolo busta paga",
        dettaglio: "Le ore lavorate, le ferie godute e le assenze vengono passate al modulo Paghe per calcolare la retribuzione del mese."
      },
      {
        label: "Prima Nota Salari",
        percorso: "→ Lista dipendenti attivi del mese",
        dettaglio: "Solo i dipendenti 'in carico' nel periodo vengono inclusi nella Prima Nota Salari del mese."
      }
    ],
    aspetta: [
      {
        label: "Inserimento presenze mensili",
        tipo: "Completamento Dati",
        urgenza: "alta",
        motivo: "Le presenze devono essere inserite/confermate prima della chiusura del cedolino. Presenze mancanti impediscono il calcolo corretto della busta paga e devono essere completate entro i primi giorni del mese successivo."
      }
    ]
  },

  CEDOLINI: {
    titolo: "Cedolini & Paghe",
    icona: "💰",
    colore: "#b45309",
    sottotitolo: "Le buste paga mensili di tutti i dipendenti",
    entraDA: [
      {
        label: "PDF Cedolini (consulente del lavoro)",
        fonte: "Import Documenti (caricamento manuale PDF)",
        dettaglio: "I cedolini elaborati mensilmente dal consulente del lavoro vengono caricati in PDF. Il sistema li associa al dipendente per nome e competenza (mese/anno)."
      },
      {
        label: "Dati presenze da HR",
        fonte: "Modulo Dipendenti (automatico)",
        dettaglio: "Le presenze registrate nel modulo HR alimentano il calcolo se il cedolino viene calcolato internamente."
      }
    ],
    fa: [
      "Archivia il cedolino di ogni dipendente per mese/anno, anche per ex-dipendenti non più in servizio.",
      "Mostra il dettaglio: retribuzione lorda, detrazioni IRPEF, contributi lavoratore, netto da pagare, TFR maturato.",
      "Permette di ricercare per nome dipendente, anno, mese.",
      "Calcola il TFR (Trattamento Fine Rapporto) accantonato nel corso degli anni."
    ],
    alimenta: [
      {
        label: "Prima Nota Salari",
        percorso: "→ Costo totale personale del mese",
        dettaglio: "Il totale mensile di tutti i cedolini (lordi + contributi azienda) alimenta la Prima Nota Salari come uscita contabile."
      },
      {
        label: "F24 Contributi",
        percorso: "→ IRPEF e contributi da versare",
        dettaglio: "Le trattenute IRPEF e i contributi INPS/INAIL risultanti dai cedolini alimentano i codici tributo del modello F24 mensile."
      }
    ],
    aspetta: [
      {
        label: "Caricamento cedolino dal consulente",
        tipo: "Ricezione Documento",
        urgenza: "alta",
        motivo: "Il ciclo di pagamento stipendi dipende dalla ricezione dei cedolini dal consulente del lavoro. Senza di essi non è possibile calcolare né i bonifici né i versamenti F24."
      }
    ]
  },

  DASHBOARD: {
    titolo: "Dashboard — Cruscotto Aziendale",
    icona: "📊",
    colore: "#1a40b5",
    sottotitolo: "La vista d'insieme sull'andamento dell'azienda",
    entraDA: [
      {
        label: "Tutti i moduli del gestionale",
        fonte: "Aggregazione automatica in tempo reale",
        dettaglio: "La Dashboard non inserisce dati, li aggrega. Prende i totali da: Corrispettivi (ricavi), Fatture (costi), Dipendenti (n. personale), Prima Nota Banca (liquidità)."
      }
    ],
    fa: [
      "Mostra il Volume d'Affari dell'anno corrente (basato sui Corrispettivi).",
      "Confronta ricavi e costi mese per mese con grafici.",
      "Segnala eventuali anomalie o scostamenti rispetto al Budget Previsionale.",
      "Visualizza quanti dipendenti sono attivamente in carico."
    ],
    alimenta: [
      {
        label: "Nessun modulo a valle",
        percorso: "→ È un aggregatore, non genera dati",
        dettaglio: "La Dashboard è in sola lettura: mostra ciò che gli altri moduli producono, non crea nuovi dati."
      }
    ],
    aspetta: [
      {
        label: "Aggiornamento dati dagli altri moduli",
        tipo: "Refresh On-Demand",
        urgenza: "bassa",
        motivo: "I KPI sono aggiornati all'ultimo import/caricamento. Se non sono stati caricati i corrispettivi del mese corrente, il Volume d'Affari risulterà incompleto."
      }
    ]
  },

  SCADENZE: {
    titolo: "Scadenzario",
    icona: "📅",
    colore: "#dc2626",
    sottotitolo: "Il calendario di tutti gli impegni finanziari e fiscali",
    entraDA: [
      {
        label: "Fatture Fornitori non pagate",
        fonte: "Ciclo Passivo (automatico)",
        dettaglio: "La data di scadenza di ogni fattura fornitore viene inserita automaticamente."
      },
      {
        label: "Modelli F24",
        fonte: "Fisco (automatico)",
        dettaglio: "Le scadenze tributarie trimestrali e mensili vengono aggiunte automaticamente al calendario."
      },
      {
        label: "Scadenze contrattuali",
        fonte: "Inserimento manuale",
        dettaglio: "Rinnovi contratti, scadenze assicurative, permessi, licenze."
      }
    ],
    fa: [
      "Mostra tutte le scadenze imminenti in ordine cronologico con importo e tipo.",
      "Evidenzia in rosso le scadenze scadute o prossime (entro 7 giorni).",
      "Permette di filtrare per tipo (fiscale, fornitore, contrattuale) e mese."
    ],
    alimenta: [
      {
        label: "Operatore / Titolare",
        percorso: "→ Azione manuale richiesta",
        dettaglio: "Lo Scadenzario è un pannello di azione: ogni scadenza richiede che qualcuno la 'soddisfi' (paghi, rinnovi, verifichi)."
      }
    ],
    aspetta: [
      {
        label: "Riconciliazione pagamento",
        tipo: "Chiusura Scadenza",
        urgenza: "alta",
        motivo: "Una scadenza viene rimossa dallo Scadenzario solo quando il pagamento corrispondente è stato riconciliato sull'estratto conto. Questo garantisce che 'chiuso' significhi davvero 'pagato'."
      }
    ]
  },

  IMPORT_DOCUMENTI: {
    titolo: "Import Documenti",
    icona: "📤",
    colore: "#0891b2",
    sottotitolo: "Il punto di ingresso di tutti i dati nel gestionale",
    entraDA: [
      {
        label: "File XML (fatture, corrispettivi)",
        fonte: "Utente — upload manuale",
        dettaglio: "Trascina o seleziona i file XML dall'SDI (fatture) o dal Registratore Telematico (corrispettivi)."
      },
      {
        label: "CSV Estratto Conto",
        fonte: "Utente — download da home banking",
        dettaglio: "File CSV scaricato dall'home banking Banco BPM contenente tutti i movimenti del periodo."
      },
      {
        label: "PDF Cedolini",
        fonte: "Consulente del lavoro",
        dettaglio: "Le buste paga mensili in formato PDF ricevute dal consulente."
      }
    ],
    fa: [
      "Riceve i file e li smista al modulo corretto in base al tipo riconosciuto.",
      "Il parser AI legge i PDF e tenta di estrarne i dati strutturati.",
      "Mostra l'anteprima dei dati estratti prima della conferma di import.",
      "Permette la correzione manuale dei dati prima di importare definitivamente."
    ],
    alimenta: [
      {
        label: "Tutti i moduli del gestionale",
        percorso: "→ È il gateway di ingresso dati",
        dettaglio: "XML fatture → Ciclo Passivo. XML corrispettivi → Prima Nota Cassa. CSV banca → Prima Nota Banca. PDF cedolini → Paghe."
      }
    ],
    aspetta: [
      {
        label: "Conferma operatore",
        tipo: "Validazione Umana",
        urgenza: "media",
        motivo: "L'import viene finalizzato solo dopo che l'operatore ha verificato l'anteprima e confermato. Questo evita importazioni errate che andrebbero poi corrette nei moduli a valle."
      }
    ]
  },

  STRUMENTI: {
    titolo: "Strumenti & Commercialista",
    icona: "🔧",
    colore: "#374151",
    sottotitolo: "Utility di supporto e preparazione dati per il consulente",
    entraDA: [
      {
        label: "Dati da tutti i moduli",
        fonte: "Aggregazione su richiesta",
        dettaglio: "Il 'Pacchetto Commercialista' raccoglie i dati da Prima Nota, Fatture, Salari, IVA del periodo selezionato."
      }
    ],
    fa: [
      "Genera il 'Pacchetto Commercialista': un file Excel/ZIP con tutti i dati del periodo da consegnare al consulente.",
      "Verifica Coerenza: controlla che i dati tra i moduli siano allineati (es. IVA Prima Nota vs IVA Fatture).",
      "Pianificazione: aiuta a prevedere le spese future e l'impatto fiscale.",
      "Visure camerali: accesso a informazioni su aziende terze."
    ],
    alimenta: [
      {
        label: "Commercialista",
        percorso: "→ Pacchetto dati per dichiarazione",
        dettaglio: "Il file prodotto dagli Strumenti è la base su cui il commercialista lavora per la dichiarazione fiscale annuale."
      }
    ],
    aspetta: [
      {
        label: "Completamento chiusure mensili",
        tipo: "Dati Completi",
        urgenza: "alta",
        motivo: "Il pacchetto commercialista è significativo solo se tutti i mesi del periodo sono stati riconciliati. Genera un avviso se ci sono mesi ancora aperti."
      }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Diagramma Mermaid del flusso dati
// ─────────────────────────────────────────────────────────────────────────────
const DIAGRAMMA_DEFAULT = `flowchart TD
    subgraph INPUT["📤 IMPORT DOCUMENTI — Punto di Ingresso"]
        XML_C[XML Corrispettivi RT]
        XML_F[XML Fatture Fornitori]
        CSV_B[CSV Estratto Conto]
        PDF_P[PDF Cedolini]
    end

    subgraph CASSA["💵 PRIMA NOTA CASSA"]
        PC[DARE: Ricavi Lordi\\nAVERE: POS → Banca\\nSALDO: Contante Fisico]
    end

    subgraph BANCA["🏦 PRIMA NOTA BANCA"]
        PB[Tutti i movimenti\\ndel conto corrente\\nSaldo Progressivo]
    end

    subgraph RICONC["🔗 RICONCILIAZIONE"]
        RC[Movimenti Banca\\n↔ Documenti]
    end

    XML_C -->|Legge incassi giornalieri| CASSA
    CASSA -->|POS atteso in banca| BANCA
    CSV_B -->|Import estratto conto| BANCA
    BANCA --> RICONC

    XML_F -->|Legge fattura XML| CP[📥 CICLO PASSIVO\\nFatture Ricevute]
    CP -->|Storico acquisti| FO[🏭 FORNITORI]
    CP -->|Scadenza di pagamento| SC[📅 SCADENZE]
    CP -->|Se SEPA/Bonifico| BANCA
    CP -->|Se bene strumentale| CE[🏗️ CESPITI]
    CP -->|IVA a credito| FI[🏛️ FISCO & IVA]

    PDF_P -->|Buste paga| SAL[💼 PRIMA NOTA SALARI]
    SAL -->|Bonifici stipendi| BANCA
    SAL -->|Contributi da versare| F24[📋 F24]
    F24 --> BANCA
    F24 --> SC

    CASSA -->|Ricavi mensili| BI[⚖️ BILANCIO]
    BANCA -->|Liquidità| BI
    CP -->|Costi acquisti| BI
    SAL -->|Costo personale| BI
    CE -->|Quote ammortamento| BI

    XML_C -->|IVA a debito| FI
    FI -->|Versamento trimestrale| F24

    BI -->|Dati consolidati| STR[🔧 STRUMENTI\\nPacchetto Commercialista]

    style INPUT fill:#0891b2,color:#fff
    style CASSA fill:#16a34a,color:#fff
    style BANCA fill:#1d4ed8,color:#fff
    style RICONC fill:#1d4ed8,color:#fff
    style CP fill:#7c3aed,color:#fff
    style FO fill:#7c3aed,color:#fff
    style SAL fill:#b45309,color:#fff
    style F24 fill:#be185d,color:#fff
    style FI fill:#be185d,color:#fff
    style BI fill:#0f766e,color:#fff
    style CE fill:#475569,color:#fff
    style SC fill:#dc2626,color:#fff
    style STR fill:#374151,color:#fff`;

// ─────────────────────────────────────────────────────────────────────────────
// Parsing nodi diagramma
// ─────────────────────────────────────────────────────────────────────────────
const KEYWORD_MAP = {
  'CASSA': 'PRIMA_NOTA_CASSA',
  'PRIMA NOTA CASSA': 'PRIMA_NOTA_CASSA',
  'PRIMA_NOTA_CASSA': 'PRIMA_NOTA_CASSA',
  'BANCA': 'PRIMA_NOTA_BANCA',
  'PRIMA NOTA BANCA': 'PRIMA_NOTA_BANCA',
  'SALARI': 'PRIMA_NOTA_SALARI',
  'PRIMA NOTA SALARI': 'PRIMA_NOTA_SALARI',
  'SAL': 'PRIMA_NOTA_SALARI',
  'CORRISPETTIVI': 'CORRISPETTIVI',
  'CORR': 'CORRISPETTIVI',
  'XML_C': 'CORRISPETTIVI',
  'CICLO PASSIVO': 'FATTURE_RICEVUTE',
  'FATTURE': 'FATTURE_RICEVUTE',
  'CP': 'FATTURE_RICEVUTE',
  'FORNITORI': 'FORNITORI',
  'FO': 'FORNITORI',
  'RICONCILIAZIONE': 'RICONCILIAZIONE',
  'RICONC': 'RICONCILIAZIONE',
  'FISCO': 'FISCO',
  'IVA': 'FISCO',
  'FI': 'FISCO',
  'BILANCIO': 'BILANCIO',
  'BI': 'BILANCIO',
  'CESPITI': 'CESPITI',
  'CE': 'CESPITI',
  'DIPENDENTI': 'DIPENDENTI',
  'HR': 'DIPENDENTI',
  'CEDOLINI': 'CEDOLINI',
  'PAGHE': 'CEDOLINI',
  'PDF_P': 'CEDOLINI',
  'SCADENZE': 'SCADENZE',
  'SC': 'SCADENZE',
  'IMPORT': 'IMPORT_DOCUMENTI',
  'DASHBOARD': 'DASHBOARD',
  'STRUMENTI': 'STRUMENTI',
  'STR': 'STRUMENTI',
};

function parseNodiDiagramma(mermaidText) {
  const lines = mermaidText.split('\n');
  const sezioni = new Set();
  lines.forEach(line => {
    const upper = line.toUpperCase();
    Object.entries(KEYWORD_MAP).forEach(([keyword, key]) => {
      if (upper.includes(keyword) && FLUSSI[key]) {
        sezioni.add(key);
      }
    });
  });
  return Array.from(sezioni);
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Card Flusso
// ─────────────────────────────────────────────────────────────────────────────
function FlowCard({ sezioneKey, isActive, onClick }) {
  const s = FLUSSI[sezioneKey];
  if (!s) return null;

  const urgenzaColore = (u) => {
    if (u === 'critica') return '#dc2626';
    if (u === 'alta') return '#f97316';
    if (u === 'media') return '#eab308';
    return '#64748b';
  };
  const urgenzaLabel = (u) => {
    if (u === 'critica') return 'CRITICO';
    if (u === 'alta') return 'PRIORITÀ ALTA';
    if (u === 'media') return 'MEDIA';
    return 'BASSA';
  };

  return (
    <div
      onClick={onClick}
      data-testid={`flusso-card-${sezioneKey}`}
      style={{
        background: 'white',
        borderRadius: 16,
        border: `2px solid ${isActive ? s.colore : '#e2e8f0'}`,
        boxShadow: isActive ? `0 8px 32px ${s.colore}25` : '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        transition: 'all 0.25s',
        cursor: 'pointer',
        marginBottom: 20
      }}
    >
      {/* Header sezione */}
      <div style={{
        background: s.colore,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <span style={{ fontSize: 26 }}>{s.icona}</span>
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{s.titolo}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>{s.sottotitolo}</div>
        </div>
      </div>

      {/* Blocchi flusso */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* DA DOVE ARRIVA */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 11, fontWeight: 700,
            color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.8
          }}>
            <span style={{
              background: '#dbeafe', borderRadius: 4, padding: '2px 6px',
              fontSize: 10
            }}>📥 ENTRA DA</span>
          </div>
          {s.entraDA.map((item, i) => (
            <div key={i} style={{
              background: '#f0f9ff', borderLeft: '3px solid #0369a1',
              borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 6
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0c4a6e' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#0369a1', marginTop: 2 }}>
                Fonte: {item.fonte}
              </div>
              {isActive && (
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                  {item.dettaglio}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* COSA FA */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 11, fontWeight: 700,
            color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8
          }}>
            <span style={{
              background: '#f1f5f9', borderRadius: 4, padding: '2px 6px',
              fontSize: 10
            }}>⚙️ COSA FA</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {s.fa.map((punto, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '6px 10px',
                background: '#f8fafc', borderRadius: 6
              }}>
                <span style={{ color: s.colore, fontWeight: 800, flexShrink: 0, fontSize: 14 }}>→</span>
                <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{punto}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ALIMENTA */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 11, fontWeight: 700,
            color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.8
          }}>
            <span style={{
              background: '#dcfce7', borderRadius: 4, padding: '2px 6px',
              fontSize: 10
            }}>📤 ALIMENTA / POPOLA</span>
          </div>
          {s.alimenta.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#f0fdf4', borderLeft: '3px solid #16a34a',
              borderRadius: '0 8px 8px 0', padding: '8px 12px', marginBottom: 6
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#14532d' }}>{item.label}</span>
                <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 6 }}>{item.percorso}</span>
                {isActive && (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                    {item.dettaglio}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ASPETTA / RICONCILIA */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 11, fontWeight: 700,
            color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.8
          }}>
            <span style={{
              background: '#fef3c7', borderRadius: 4, padding: '2px 6px',
              fontSize: 10
            }}>⏳ ASPETTA / RICONCILIA CON</span>
          </div>
          {s.aspetta.map((item, i) => (
            <div key={i} style={{
              background: '#fffbeb',
              borderLeft: `3px solid ${urgenzaColore(item.urgenza)}`,
              borderRadius: '0 8px 8px 0',
              padding: '8px 12px', marginBottom: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>{item.label}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px',
                  background: urgenzaColore(item.urgenza),
                  color: 'white', borderRadius: 4, letterSpacing: 0.5
                }}>
                  {urgenzaLabel(item.urgenza)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#b45309', fontStyle: 'italic', marginBottom: 4 }}>
                Tipo: {item.tipo}
              </div>
              {isActive && (
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  {item.motivo}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────────────────────────────────────
let mermaidInitialized = false;

export default function MappaGestionale() {
  const [codice, setCodice] = useState(DIAGRAMMA_DEFAULT);
  const [codiceInput, setCodiceInput] = useState(DIAGRAMMA_DEFAULT);
  const [errore, setErrore] = useState(null);
  const [sezioniAttive, setSezioniAttive] = useState([]);
  const [activeSezione, setActiveSezione] = useState('PRIMA_NOTA_CASSA');
  const [showEditor, setShowEditor] = useState(false);
  const diagramRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: '#1a40b5',
          primaryTextColor: '#fff',
          primaryBorderColor: '#1a40b5',
          lineColor: '#64748b',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#f8fafc',
          background: '#ffffff',
          mainBkg: '#1a40b5',
          fontSize: '13px'
        },
        flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
        securityLevel: 'loose'
      });
      mermaidInitialized = true;
    }
  }, []);

  const renderDiagram = useCallback(async (code) => {
    if (!diagramRef.current) return;
    try {
      setErrore(null);
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, code);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = svg;
        const svgEl = diagramRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        }
      }
      setSezioniAttive(parseNodiDiagramma(code));
    } catch (e) {
      setErrore('Errore nel diagramma: ' + (e.message?.substring(0, 120) || 'sintassi non valida'));
    }
  }, []);

  useEffect(() => {
    renderDiagram(codice);
  }, [codice]);

  // Inizializza sezioni attive dal diagramma default
  useEffect(() => {
    setSezioniAttive(parseNodiDiagramma(DIAGRAMMA_DEFAULT));
  }, []);

  const handleCodiceChange = (val) => {
    setCodiceInput(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCodice(val), 900);
  };

  const handleApplica = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCodice(codiceInput);
  };

  const handleReset = () => {
    setCodiceInput(DIAGRAMMA_DEFAULT);
    setCodice(DIAGRAMMA_DEFAULT);
    setActiveSezione('PRIMA_NOTA_CASSA');
  };

  // Ordine di visualizzazione delle sezioni
  const ORDINE_SEZIONI = [
    'PRIMA_NOTA_CASSA', 'PRIMA_NOTA_BANCA', 'PRIMA_NOTA_SALARI',
    'CORRISPETTIVI', 'FATTURE_RICEVUTE', 'FORNITORI',
    'RICONCILIAZIONE', 'FISCO', 'BILANCIO',
    'CESPITI', 'DIPENDENTI', 'CEDOLINI',
    'SCADENZE', 'IMPORT_DOCUMENTI', 'STRUMENTI', 'DASHBOARD'
  ];

  const sezioniOrdiante = ORDINE_SEZIONI.filter(k => sezioniAttive.includes(k) || FLUSSI[k]);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1a40b5 100%)',
        padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>
            Come funziona il Gestionale Ceraldi ERP
          </h1>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            Per ogni modulo: da dove arrivano i dati • cosa fa • cosa alimenta • cosa aspetta per riconciliarsi
          </p>
        </div>
        <button
          onClick={() => setShowEditor(e => !e)}
          data-testid="toggle-editor-btn"
          style={{
            padding: '8px 16px', background: showEditor ? '#dc2626' : 'rgba(255,255,255,0.15)',
            color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          {showEditor ? '✕ Chiudi Editor' : '✏️ Modifica Diagramma'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Editor Mermaid (collassabile) */}
        {showEditor && (
          <div style={{
            width: 320, flexShrink: 0, background: '#1e293b',
            padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
            minHeight: 'calc(100vh - 80px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Editor Mermaid
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleApplica} style={{
                  padding: '4px 10px', background: '#22c55e', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600
                }}>▶ Applica</button>
                <button onClick={handleReset} style={{
                  padding: '4px 8px', background: '#475569', color: '#94a3b8',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11
                }}>Reset</button>
              </div>
            </div>
            <textarea
              value={codiceInput}
              onChange={e => handleCodiceChange(e.target.value)}
              style={{
                flex: 1, minHeight: 500, background: '#0f172a', color: '#e2e8f0',
                border: '1px solid #334155', borderRadius: 8, padding: 12,
                fontFamily: "'Fira Code', monospace", fontSize: 11, lineHeight: 1.6,
                resize: 'vertical', outline: 'none'
              }}
              spellCheck={false}
              data-testid="mermaid-editor"
            />
            {errore && (
              <div style={{
                background: '#450a0a', border: '1px solid #dc2626', borderRadius: 6,
                padding: '8px 12px', color: '#fca5a5', fontSize: 11
              }}>⚠️ {errore}</div>
            )}
          </div>
        )}

        {/* Contenuto principale */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Diagramma di flusso */}
          <div style={{
            background: 'white', padding: 20,
            borderBottom: '1px solid #e2e8f0'
          }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Diagramma del Flusso Dati
            </h2>
            <div
              ref={diagramRef}
              data-testid="mermaid-diagram"
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                minHeight: 180, overflowX: 'auto'
              }}
            />
          </div>

          {/* Tabs navigazione sezioni */}
          <div style={{
            background: 'white', borderBottom: '1px solid #e2e8f0',
            padding: '12px 20px',
            display: 'flex', gap: 6, flexWrap: 'wrap'
          }}>
            {sezioniOrdiante.map(k => {
              const s = FLUSSI[k];
              if (!s) return null;
              return (
                <button
                  key={k}
                  onClick={() => setActiveSezione(k)}
                  data-testid={`tab-sezione-${k}`}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    background: activeSezione === k ? s.colore : '#f1f5f9',
                    color: activeSezione === k ? 'white' : '#475569',
                    border: `1px solid ${activeSezione === k ? s.colore : '#e2e8f0'}`,
                    borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: activeSezione === k ? `0 3px 10px ${s.colore}40` : 'none'
                  }}
                >
                  {s.icona} {s.titolo.split(' ')[0]} {s.titolo.split(' ')[1] || ''}
                </button>
              );
            })}
          </div>

          {/* Sezione attiva + riepilogo */}
          <div style={{ padding: 24 }}>
            {/* Card sezione selezionata — espansa */}
            {activeSezione && FLUSSI[activeSezione] && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  Dettaglio: {FLUSSI[activeSezione].titolo}
                </h2>
                <FlowCard sezioneKey={activeSezione} isActive={true} onClick={() => {}} />
              </div>
            )}

            {/* Griglia tutte le sezioni — compatta */}
            <div>
              <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                Tutti i Moduli — Vista Rapida
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                Clicca su un modulo per vedere il dettaglio completo del flusso dati.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16
              }}>
                {sezioniOrdiante.filter(k => k !== activeSezione).map(k => (
                  <FlowCard
                    key={k}
                    sezioneKey={k}
                    isActive={false}
                    onClick={() => setActiveSezione(k)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
