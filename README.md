# Gestionale Odontoiatrico

Sistema di gestione per studi odontoiatrici sviluppato per il mercato italiano con minime dipendenze.

## Caratteristiche

- **Gestione Pazienti**: Anagrafica completa con consenso GDPR
- **Agenda Appuntamenti**: Sistema di prenotazione e gestione visite
- **Odontogramma**: Visualizzazione e modifica stato dentale
- **Piani di Cura**: Creazione e gestione preventivi
- **Magazzino**: Gestione materiali e scorte
- **Fatturazione**: Emissione fatture e tracking pagamenti
- **Compensi Collaboratori**: Calcolo automatico compensi per dentisti collaboratori
- **Multi-Dentista**: Supporto per studi con più professionisti

## Tecnologie

- **Backend**: Node.js (moduli nativi)
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, JavaScript vanilla (zero framework)

## Installazione

```bash
npm install
```

## Avvio

```bash
npm start
```

Il server sarà disponibile su `http://localhost:3000`

## Struttura Database

### Tabelle Principali

- `pazienti`: Anagrafica pazienti
- `dentisti`: Dentisti e collaboratori
- `appuntamenti`: Agenda visite
- `odontogrammi`: Stato dentale pazienti
- `piani_cura`: Preventivi e piani terapeutici
- `fatture`: Fatturazione
- `compensi_dentisti`: Calcolo compensi collaboratori
- `magazzino`: Articoli e materiali
- `movimenti_magazzino`: Storico movimenti

## Funzionalità GDPR

- Consenso privacy tracciato per ogni paziente
- Codice fiscale opzionale
- Note mediche e allergie con privacy garantita

## Calcolo Compensi

Ogni dentista può avere una percentuale di compenso definita. Quando viene emessa una fattura, il sistema calcola automaticamente il compenso del dentista basato sulla percentuale configurata.

## Sviluppo

Il progetto è stato sviluppato con l'obiettivo di minimizzare le dipendenze esterne:
- Una sola dipendenza npm (better-sqlite3)
- Nessun framework frontend
- Server HTTP nativo Node.js
- Design responsive con CSS puro

## Licenza

ISC