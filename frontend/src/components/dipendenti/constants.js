/**
 * Costanti per la gestione dipendenti
 */

export const MANSIONI = [
  "Barista", "Cameriere", "Camerieri di ristorante", "aiuto cameriere", "aiuto cameriere di ristorante",
  "Cuoco", "Aiuto Cuoco", "Chef", "Aiuto Barista", "Pizzaiolo", 
  "Lavapiatti", "cassiera", "Banconiera Pasticceria", "PASTICCIERE",
  "Responsabile Sala", "Sommelier", "Resp.Amministrativo", "Resp. Amministrativo",
  "TIROCINANTE", "Stage/Tirocinio"
];

export const TIPI_CONTRATTO = [
  { id: "determinato", name: "Tempo Determinato" },
  { id: "indeterminato", name: "Tempo Indeterminato" },
  { id: "part_time_det", name: "Part-Time Determinato" },
  { id: "part_time_ind", name: "Part-Time Indeterminato" },
  { id: "apprendistato", name: "Apprendistato" },
  { id: "tirocinio", name: "Stage/Tirocinio" }
];

export const DEFAULT_DIPENDENTE = {
  nome: '', cognome: '', nome_completo: '', codice_fiscale: '',
  data_nascita: '', luogo_nascita: '', indirizzo: '',
  email: '', telefono: '', iban: '', mansione: '',
  tipo_contratto: 'indeterminato', livello: '', stipendio_orario: ''
};
