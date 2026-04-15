def create_alert(tipo, messaggio, data=None, riferimento=None):
    return {
        "tipo": tipo,
        "messaggio": messaggio,
        "data": data,
        "riferimento": riferimento
    }
