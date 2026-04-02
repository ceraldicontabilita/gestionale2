"""
Router per la gestione dei Lotti Fornitori.
Traccia lotti con scadenze estratti dalle fatture XML (SAIMA, Naturissime, GE.FI.AL., etc.)
Per fornitori senza lotto (Rondinella, Fiorentino, ecc.) usa il numero fattura come tracciabilità.
Gestisce lo scalaggio automatico delle scorte per lotto quando si usano ingredienti nelle ricette.
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from app.routers.tracciabilita.server import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lotti-fornitori", tags=["Lotti Fornitori"])


# ==================== PARSING LOTTO FROM FATTURA XML ====================

def parse_lotto_saima(riferimento_testo: str) -> dict:
    """
    Parsa il campo AltriDatiGestionali SAIMA.
    Formato: 'Id: 617435 - Scadenza: 04/04/2026 - Qt: 2'
    """
    result = {}
    
    id_match = re.search(r'Id:\s*(\w+)', riferimento_testo, re.IGNORECASE)
    scad_match = re.search(r'Scadenza:\s*(\d{2}/\d{2}/\d{4})', riferimento_testo, re.IGNORECASE)
    qt_match = re.search(r'Qt[a-z\s]*:\s*([\d.]+)', riferimento_testo, re.IGNORECASE)
    
    if id_match:
        result['lotto_id_fornitore'] = id_match.group(1)
    if scad_match:
        result['data_scadenza'] = scad_match.group(1)
    if qt_match:
        result['quantita_originale'] = float(qt_match.group(1))
    
    return result


def parse_lotto_naturissime(riferimento_testo: str, riferimento_data: str = None) -> dict:
    """
    Parsa il campo AltriDatiGestionali Naturissime.
    Formato testo: 'IT 016064 C17'
    Formato data: '09/04/2026'
    """
    result = {}
    if riferimento_testo:
        result['lotto_id_fornitore'] = riferimento_testo.strip()
    if riferimento_data:
        result['data_scadenza'] = riferimento_data.strip()
    return result


async def extract_and_save_lotti_from_fattura(fattura_data: dict, prodotti_xml: list):
    """
    Estrae i dati di lotto dai prodotti XML di una fattura e li salva in lotti_fornitori.
    
    LOGICA:
    - Se il prodotto ha _lotto_data (SAIMA, Naturissime, ecc.) → salva con lotto_id_fornitore + data_scadenza
    - Se il prodotto NON ha _lotto_data (Rondinella, Fiorentino, ecc.) → salva con 
      numero_fattura come riferimento e data_fattura come data tracciabilità
    
    Chiamato durante l'importazione XML.
    """
    fornitore = fattura_data.get('fornitore', '')
    numero_fattura = fattura_data.get('numero_fattura', '')
    data_fattura = fattura_data.get('data_fattura', '')

    saved = 0
    for prodotto in prodotti_xml:
        prezzo_unitario = float(str(prodotto.get('prezzo', 0) or 0))
        # Ignora prodotti gratuiti (sconto merce) — già gestiti dalla collection sconti_merce
        if prezzo_unitario <= 0:
            continue

        descrizione = re.sub(r'\s+', ' ', prodotto.get('descrizione', '').strip())
        # Rimuovi info lotto dalla descrizione per normalizzazione
        descrizione_pulita = re.sub(r'\s*//.*$', '', descrizione, flags=re.IGNORECASE).strip()
        nome_norm = descrizione_pulita.lower().strip()

        if not nome_norm:
            continue

        quantita = float(str(prodotto.get('quantita', 0) or 0))
        unita = prodotto.get('unita_misura', 'KG').upper()

        lotto_data = prodotto.get('_lotto_data', {})

        if lotto_data and lotto_data.get('lotto_id_fornitore'):
            # ── CASO 1: Prodotto CON lotto fornitore (SAIMA, Naturissime, ecc.) ──
            lotto_id = lotto_data.get('lotto_id_fornitore')
            data_scadenza = lotto_data.get('data_scadenza', '')

            # Controlla se lotto già esistente (stesso id + fornitore)
            existing = await db.lotti_fornitori.find_one({
                'lotto_id_fornitore': lotto_id,
                'fornitore': fornitore
            })
            if existing:
                continue

            giorni_alla_scadenza = None
            scaduto = False
            try:
                if data_scadenza and '/' in data_scadenza:
                    dt_scad = datetime.strptime(data_scadenza, '%d/%m/%Y')
                    now = datetime.now()
                    giorni_alla_scadenza = (dt_scad - now).days
                    scaduto = giorni_alla_scadenza < 0
            except Exception:
                pass

            qt_orig = lotto_data.get('quantita_originale', quantita)

            lotto_doc = {
                'id': str(uuid.uuid4()),
                'fornitore': fornitore,
                'prodotto_nome': descrizione_pulita,
                'prodotto_nome_norm': nome_norm,
                'lotto_id_fornitore': lotto_id,
                'tipo_tracciabilita': 'lotto_fornitore',  # SAIMA, Naturissime...
                'data_scadenza': data_scadenza,
                'giorni_alla_scadenza': giorni_alla_scadenza,
                'scaduto': scaduto,
                'quantita_originale': qt_orig,
                'quantita_acquistata': quantita,
                'quantita_disponibile': quantita,
                'unita_misura': unita,
                'prezzo_unitario': prezzo_unitario,
                'fattura_ref': numero_fattura,
                'data_fattura': data_fattura,
                'esaurito': False,
                'created_at': datetime.now(timezone.utc).isoformat()
            }

        else:
            # ── CASO 2: Prodotto SENZA lotto (Rondinella, Fiorentino, ecc.) ──
            # Usa numero fattura + prodotto come chiave di deduplicazione
            existing = await db.lotti_fornitori.find_one({
                'fattura_ref': numero_fattura,
                'prodotto_nome_norm': nome_norm,
                'fornitore': fornitore
            })
            if existing:
                continue

            lotto_doc = {
                'id': str(uuid.uuid4()),
                'fornitore': fornitore,
                'prodotto_nome': descrizione_pulita,
                'prodotto_nome_norm': nome_norm,
                'lotto_id_fornitore': f"FAT-{numero_fattura}",  # usa n. fattura come ID tracciabilità
                'tipo_tracciabilita': 'fattura',  # Rondinella, Fiorentino, ecc.
                'data_scadenza': '',             # non disponibile
                'giorni_alla_scadenza': None,
                'scaduto': False,
                'quantita_originale': quantita,
                'quantita_acquistata': quantita,
                'quantita_disponibile': quantita,
                'unita_misura': unita,
                'prezzo_unitario': prezzo_unitario,
                'fattura_ref': numero_fattura,
                'data_fattura': data_fattura,
                'esaurito': False,
                'created_at': datetime.now(timezone.utc).isoformat()
            }

        await db.lotti_fornitori.insert_one(lotto_doc)
        saved += 1

    return saved


# ==================== ENDPOINTS ====================

@router.get("")
async def get_lotti_fornitori(
    fornitore: Optional[str] = None,
    prodotto: Optional[str] = None,
    esaurito: Optional[bool] = None,
    in_scadenza_giorni: Optional[int] = None,  # es. 30 = scade entro 30 giorni
    limit: Optional[int] = None  # opzionale, default nessun limite
):
    """Lista lotti fornitori con stato scorte"""
    query = {}
    if fornitore:
        query['fornitore'] = {'$regex': fornitore, '$options': 'i'}
    if prodotto:
        query['prodotto_nome_norm'] = {'$regex': prodotto.lower(), '$options': 'i'}
    if esaurito is not None:
        query['esaurito'] = esaurito
    
    # Aggiorna giorni alla scadenza
    now = datetime.now()
    
    lotti = await db.lotti_fornitori.find(query, {'_id': 0}).to_list(500)
    
    # Aggiorna giorni_alla_scadenza in real-time
    result = []
    for l in lotti:
        try:
            if l.get('data_scadenza') and '/' in l['data_scadenza']:
                dt = datetime.strptime(l['data_scadenza'], '%d/%m/%Y')
                l['giorni_alla_scadenza'] = (dt - now).days
                l['scaduto'] = l['giorni_alla_scadenza'] < 0
        except:
            pass
        
        if in_scadenza_giorni is not None:
            giorni = l.get('giorni_alla_scadenza')
            if giorni is None or giorni > in_scadenza_giorni:
                continue
        
        result.append(l)
    
    # Ordina per data scadenza: più prossima prima, poi scaduti (giorni negativi) alla fine
    def sort_key(l):
        g = l.get('giorni_alla_scadenza')
        if g is None:
            return 9999
        if g < 0:  # scaduto → manda in fondo agli scaduti ma prima dei senza data
            return 5000 + abs(g)
        return g  # in scadenza/ok → ordine crescente (più vicino prima)

    result.sort(key=sort_key)
    if limit is not None:
        result = result[:limit]
    return result


@router.get("/summary")
async def get_summary_lotti():
    """Riepilogo stato scorte per ingrediente"""
    lotti = await db.lotti_fornitori.find({'esaurito': False}, {'_id': 0}).to_list(1000)
    
    # Raggruppa per prodotto_nome_norm
    prodotti = {}
    now = datetime.now()
    
    for l in lotti:
        nome = l.get('prodotto_nome_norm', '').strip()
        if not nome:
            continue
        
        try:
            if l.get('data_scadenza') and '/' in l['data_scadenza']:
                dt = datetime.strptime(l['data_scadenza'], '%d/%m/%Y')
                giorni = (dt - now).days
                l['giorni_alla_scadenza'] = giorni
                l['scaduto'] = giorni < 0
        except:
            pass
        
        if nome not in prodotti:
            prodotti[nome] = {
                'prodotto': nome,
                'quantita_totale_disponibile': 0,
                'lotti': [],
                'in_scadenza': False,
                'scaduto': False,
                'min_giorni_scadenza': 9999,
                'fornitori': set()
            }
        
        qt_disp = float(l.get('quantita_disponibile', 0) or 0)
        prodotti[nome]['quantita_totale_disponibile'] += qt_disp
        prodotti[nome]['lotti'].append({
            'id': l.get('id'),
            'lotto_id_fornitore': l.get('lotto_id_fornitore'),
            'fornitore': l.get('fornitore'),
            'quantita_disponibile': qt_disp,
            'unita': l.get('unita_misura', ''),
            'data_scadenza': l.get('data_scadenza'),
            'giorni_alla_scadenza': l.get('giorni_alla_scadenza'),
            'scaduto': l.get('scaduto', False)
        })
        prodotti[nome]['fornitori'].add(l.get('fornitore', ''))
        
        giorni = l.get('giorni_alla_scadenza', 9999)
        if giorni is not None and giorni < prodotti[nome]['min_giorni_scadenza']:
            prodotti[nome]['min_giorni_scadenza'] = giorni
        if l.get('scaduto'):
            prodotti[nome]['scaduto'] = True
        elif giorni is not None and giorni <= 30:
            prodotti[nome]['in_scadenza'] = True
    
    result = []
    for nome, data in prodotti.items():
        data['fornitori'] = list(data['fornitori'])
        data['min_giorni_scadenza'] = data['min_giorni_scadenza'] if data['min_giorni_scadenza'] < 9999 else None
        result.append(data)
    
    result.sort(key=lambda x: (x.get('min_giorni_scadenza') or 9999))
    return result


@router.get("/per-ingrediente/{nome_ingrediente}")
async def get_lotti_per_ingrediente(nome_ingrediente: str):
    """
    Trova tutti i lotti disponibili per un ingrediente, ordinati per scadenza.
    Include fornitori alternativi.
    """
    nome_norm = nome_ingrediente.lower().strip()
    
    # Cerca lotti con match parziale sul nome
    lotti = await db.lotti_fornitori.find(
        {
            'esaurito': False,
            '$or': [
                {'prodotto_nome_norm': {'$regex': nome_norm, '$options': 'i'}},
                {'prodotto_nome_norm': {'$regex': ' '.join(nome_norm.split()[:2]), '$options': 'i'}}
            ]
        },
        {'_id': 0}
    ).sort('data_scadenza', 1).to_list(50)
    
    now = datetime.now()
    for l in lotti:
        try:
            if l.get('data_scadenza') and '/' in l['data_scadenza']:
                dt = datetime.strptime(l['data_scadenza'], '%d/%m/%Y')
                l['giorni_alla_scadenza'] = (dt - now).days
                l['scaduto'] = l['giorni_alla_scadenza'] < 0
        except:
            pass
    
    return {
        'ingrediente': nome_ingrediente,
        'lotti_disponibili': len(lotti),
        'lotti': lotti
    }


@router.post("/scala-scorta")
async def scala_scorta_lotto(
    lotto_id: str = Query(...),
    quantita_usata: float = Query(...),
    ricetta_nome: str = Query(""),
    note: str = Query("")
):
    """
    Scala la quantità disponibile di un lotto fornitore.
    Se si esaurisce, marca il lotto come esaurito e notifica.
    """
    lotto = await db.lotti_fornitori.find_one({'id': lotto_id})
    if not lotto:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    
    qt_attuale = float(lotto.get('quantita_disponibile', 0) or 0)
    qt_nuova = max(0, qt_attuale - quantita_usata)
    esaurito = qt_nuova <= 0
    
    await db.lotti_fornitori.update_one(
        {'id': lotto_id},
        {'$set': {
            'quantita_disponibile': qt_nuova,
            'esaurito': esaurito,
            'ultimo_utilizzo': datetime.now(timezone.utc).isoformat(),
            'ricetta_ultimo_utilizzo': ricetta_nome
        }, '$push': {
            'storico_utilizzi': {
                'data': datetime.now(timezone.utc).isoformat(),
                'quantita_usata': quantita_usata,
                'ricetta': ricetta_nome,
                'quantita_rimasta': qt_nuova,
                'note': note
            }
        }}
    )
    
    # Se esaurito, cerca fornitori alternativi
    alternative = []
    if esaurito:
        prodotto_nome = lotto.get('prodotto_nome_norm', '')
        alt_lotti = await db.lotti_fornitori.find(
            {
                'esaurito': False,
                'prodotto_nome_norm': {'$regex': prodotto_nome[:20], '$options': 'i'},
                'id': {'$ne': lotto_id}
            },
            {'_id': 0, 'fornitore': 1, 'prodotto_nome': 1, 'quantita_disponibile': 1, 'unita_misura': 1, 'data_scadenza': 1}
        ).to_list(10)
        alternative = alt_lotti
    
    return {
        'success': True,
        'lotto_id': lotto_id,
        'prodotto': lotto.get('prodotto_nome'),
        'quantita_precedente': qt_attuale,
        'quantita_rimasta': qt_nuova,
        'esaurito': esaurito,
        'fornitori_alternativi': alternative
    }


@router.post("/importa-da-fatture")
async def importa_lotti_da_tutte_fatture():
    """
    Scansiona tutte le fatture esistenti nel DB e importa i dati di lotto.
    Cerca nel campo AltriDatiGestionali dei prodotti XML.
    """
    # Le fatture già importate hanno i prodotti ma non i dati lotto (non sono stati parsati)
    # Dobbiamo re-parsare le fatture originali - ma non abbiamo gli XML originali
    # Invece, usiamo le informazioni già estratte e i dati SAIMA noti
    
    # Per ora, importa manualmente dai file XML forniti
    return {
        "message": "Per importare i lotti, ri-importa le fatture tramite PEC o XML upload.",
        "note": "I nuovi upload XML parseranno automaticamente i dati LOTTO da AltriDatiGestionali."
    }


@router.post("/aggiungi-manuale")
async def aggiungi_lotto_manuale(dati: dict):
    """Aggiunge un lotto fornitore manualmente"""
    required = ['fornitore', 'prodotto_nome', 'quantita_disponibile', 'unita_misura']
    for f in required:
        if f not in dati:
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {f}")
    
    dati['id'] = str(uuid.uuid4())
    dati['prodotto_nome_norm'] = dati['prodotto_nome'].lower().strip()
    dati['esaurito'] = False
    dati['quantita_originale'] = dati.get('quantita_originale', dati['quantita_disponibile'])
    dati['created_at'] = datetime.now(timezone.utc).isoformat()
    dati.pop('_id', None)
    
    # Calcola giorni alla scadenza
    data_scad = dati.get('data_scadenza', '')
    try:
        if data_scad and '/' in data_scad:
            dt = datetime.strptime(data_scad, '%d/%m/%Y')
            dati['giorni_alla_scadenza'] = (dt - datetime.now()).days
            dati['scaduto'] = dati['giorni_alla_scadenza'] < 0
    except:
        pass
    
    await db.lotti_fornitori.insert_one(dati)
    dati.pop('_id', None)
    return dati


@router.delete("/pulizia-scaduti")
async def rimuovi_lotti_scaduti(giorni_grazia: int = 0):
    """
    Rimuove i lotti fornitori già scaduti (o scaduti da più di giorni_grazia giorni).
    Chiamato dopo ogni aggiornamento fatture per tenere pulita la lista.
    """
    now = datetime.now()
    lotti = await db.lotti_fornitori.find({}, {"_id": 0, "id": 1, "data_scadenza": 1, "prodotto_nome": 1}).to_list(5000)
    eliminati = []
    for l in lotti:
        ds = l.get("data_scadenza", "")
        if not ds or "/" not in ds:
            continue
        try:
            dt = datetime.strptime(ds, "%d/%m/%Y")
            giorni = (dt - now).days
            if giorni < -giorni_grazia:
                await db.lotti_fornitori.delete_one({"id": l["id"]})
                eliminati.append({"id": l["id"], "prodotto": l.get("prodotto_nome"), "scadenza": ds, "giorni": giorni})
        except Exception:
            pass
    return {"success": True, "eliminati": len(eliminati), "dettagli": eliminati}


@router.delete("/{lotto_id}")
async def elimina_lotto(lotto_id: str):
    result = await db.lotti_fornitori.delete_one({'id': lotto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lotto non trovato")
    return {"success": True}



@router.post("/reimporta-da-fatture")
async def reimporta_lotti_da_fatture(azzera: bool = False):
    """
    Re-importa tutti i lotti dalle fatture nel DB.
    Aggiunge anche gli ingredienti di fornitori senza lotto (es. Rondinella, Fiorentino)
    usando il numero fattura come riferimento di tracciabilità.
    
    Se azzera=True, svuota prima la collection lotti_fornitori.
    """
    if azzera:
        await db.lotti_fornitori.delete_many({})

    # Legge fornitori esclusi
    fornitori_esclusi_docs = await db.fornitori.find({"escluso": True}, {"_id": 0, "nome": 1}).to_list(1000)
    nomi_esclusi = {f["nome"].strip().lower() for f in fornitori_esclusi_docs if f.get("nome")}

    fatture = await db.fatture.find({}, {"_id": 0}).to_list(10000)
    totale_salvati = 0
    totale_saltati = 0
    fatture_elaborate = 0

    for fattura in fatture:
        fornitore = fattura.get("fornitore", "").strip()
        if not fornitore or fornitore.lower() in nomi_esclusi:
            continue

        prodotti_xml = fattura.get("prodotti", [])
        saved = await extract_and_save_lotti_from_fattura(fattura, prodotti_xml)
        totale_salvati += saved
        totale_saltati += len(prodotti_xml) - saved
        fatture_elaborate += 1

    return {
        "success": True,
        "fatture_elaborate": fatture_elaborate,
        "lotti_salvati": totale_salvati,
        "righe_saltate": totale_saltati,
        "totale_lotti_db": await db.lotti_fornitori.count_documents({})
    }
