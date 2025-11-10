import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database initialization
const db = new Database('gestionale.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS dentisti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    codice_fiscale TEXT UNIQUE,
    email TEXT,
    telefono TEXT,
    percentuale_compenso REAL DEFAULT 0,
    attivo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pazienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    codice_fiscale TEXT UNIQUE,
    data_nascita DATE,
    sesso TEXT,
    indirizzo TEXT,
    citta TEXT,
    cap TEXT,
    telefono TEXT,
    email TEXT,
    note_mediche TEXT,
    allergie TEXT,
    consenso_privacy INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appuntamenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL,
    dentista_id INTEGER NOT NULL,
    data_ora DATETIME NOT NULL,
    durata_minuti INTEGER DEFAULT 30,
    tipo_visita TEXT,
    stato TEXT DEFAULT 'programmato',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id),
    FOREIGN KEY (dentista_id) REFERENCES dentisti(id)
  );

  CREATE TABLE IF NOT EXISTS odontogrammi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL,
    dente_numero INTEGER NOT NULL,
    stato TEXT,
    diagnosi TEXT,
    trattamento TEXT,
    data_intervento DATE,
    dentista_id INTEGER,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id),
    FOREIGN KEY (dentista_id) REFERENCES dentisti(id)
  );

  CREATE TABLE IF NOT EXISTS piani_trattamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paziente_id INTEGER NOT NULL,
    dentista_diagnosi_id INTEGER NOT NULL,
    diagnosi TEXT,
    data_creazione DATE DEFAULT CURRENT_DATE,
    stato TEXT DEFAULT 'bozza',
    note TEXT,
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id),
    FOREIGN KEY (dentista_diagnosi_id) REFERENCES dentisti(id)
  );

  CREATE TABLE IF NOT EXISTS trattamenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piano_trattamento_id INTEGER NOT NULL,
    descrizione TEXT NOT NULL,
    dente_numero TEXT,
    costo REAL NOT NULL,
    dentista_primario_id INTEGER,
    dentista_secondario_id INTEGER,
    percentuale_primario REAL DEFAULT 100,
    percentuale_secondario REAL DEFAULT 0,
    completato INTEGER DEFAULT 0,
    data_completamento DATE,
    FOREIGN KEY (piano_trattamento_id) REFERENCES piani_trattamento(id),
    FOREIGN KEY (dentista_primario_id) REFERENCES dentisti(id),
    FOREIGN KEY (dentista_secondario_id) REFERENCES dentisti(id)
  );

  CREATE TABLE IF NOT EXISTS piani_cura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piano_trattamento_id INTEGER NOT NULL,
    paziente_id INTEGER NOT NULL,
    numero_preventivo TEXT UNIQUE,
    importo_totale REAL DEFAULT 0,
    stato TEXT DEFAULT 'preventivo',
    data_creazione DATE DEFAULT CURRENT_DATE,
    data_accettazione DATE,
    stato_pagamento TEXT DEFAULT 'non_pagato',
    note TEXT,
    FOREIGN KEY (piano_trattamento_id) REFERENCES piani_trattamento(id),
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id)
  );

  CREATE TABLE IF NOT EXISTS fatture (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_fattura TEXT UNIQUE NOT NULL,
    paziente_id INTEGER NOT NULL,
    piano_cura_id INTEGER,
    dentista_id INTEGER NOT NULL,
    data_emissione DATE DEFAULT CURRENT_DATE,
    importo_totale REAL NOT NULL,
    importo_pagato REAL DEFAULT 0,
    stato_pagamento TEXT DEFAULT 'non_pagata',
    metodo_pagamento TEXT,
    note TEXT,
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id),
    FOREIGN KEY (piano_cura_id) REFERENCES piani_cura(id),
    FOREIGN KEY (dentista_id) REFERENCES dentisti(id)
  );

  CREATE TABLE IF NOT EXISTS compensi_dentisti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dentista_id INTEGER NOT NULL,
    fattura_id INTEGER NOT NULL,
    importo_base REAL NOT NULL,
    percentuale REAL NOT NULL,
    compenso_calcolato REAL NOT NULL,
    mese INTEGER NOT NULL,
    anno INTEGER NOT NULL,
    pagato INTEGER DEFAULT 0,
    data_pagamento DATE,
    FOREIGN KEY (dentista_id) REFERENCES dentisti(id),
    FOREIGN KEY (fattura_id) REFERENCES fatture(id)
  );

  CREATE TABLE IF NOT EXISTS magazzino (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice_articolo TEXT UNIQUE,
    nome TEXT NOT NULL,
    categoria TEXT,
    quantita INTEGER DEFAULT 0,
    quantita_minima INTEGER DEFAULT 0,
    prezzo_acquisto REAL,
    fornitore TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movimenti_magazzino (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    articolo_id INTEGER NOT NULL,
    tipo_movimento TEXT NOT NULL,
    quantita INTEGER NOT NULL,
    data_movimento DATETIME DEFAULT CURRENT_TIMESTAMP,
    causale TEXT,
    riferimento_paziente_id INTEGER,
    FOREIGN KEY (articolo_id) REFERENCES magazzino(id),
    FOREIGN KEY (riferimento_paziente_id) REFERENCES pazienti(id)
  );

  CREATE TABLE IF NOT EXISTS listino_prezzi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    codice TEXT,
    prezzo REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API Routes
  if (pathname.startsWith('/api/')) {
    handleAPI(req, res, pathname, url);
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/public/index.html' : `/public${pathname}`;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

function handleAPI(req, res, pathname, url) {
  res.setHeader('Content-Type', 'application/json');
  
  const parts = pathname.split('/').filter(Boolean);
  const resource = parts[1]; // api/[resource]
  const id = parts[2]; // api/resource/[id]

  if (req.method === 'GET') {
    handleGET(resource, id, url, res);
  } else if (req.method === 'POST') {
    handlePOST(req, res, resource);
  } else if (req.method === 'PUT') {
    handlePUT(req, res, resource, id);
  } else if (req.method === 'DELETE') {
    handleDELETE(resource, id, res);
  } else {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
}

function handleGET(resource, id, url, res) {
  try {
    if (resource === 'pazienti') {
      if (id) {
        const stmt = db.prepare('SELECT * FROM pazienti WHERE id = ?');
        const result = stmt.get(id);
        res.writeHead(200);
        res.end(JSON.stringify(result || {}));
      } else {
        const stmt = db.prepare('SELECT * FROM pazienti ORDER BY cognome, nome');
        const results = stmt.all();
        res.writeHead(200);
        res.end(JSON.stringify(results));
      }
    } else if (resource === 'dentisti') {
      const stmt = db.prepare('SELECT * FROM dentisti WHERE attivo = 1 ORDER BY cognome, nome');
      const results = stmt.all();
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'appuntamenti') {
      const data = url.searchParams.get('data');
      const dentista_id = url.searchParams.get('dentista_id');
      
      let query = `
        SELECT a.*, 
               p.nome || ' ' || p.cognome as paziente_nome,
               d.nome || ' ' || d.cognome as dentista_nome
        FROM appuntamenti a
        JOIN pazienti p ON a.paziente_id = p.id
        JOIN dentisti d ON a.dentista_id = d.id
        WHERE 1=1
      `;
      const params = [];
      
      if (data) {
        query += ' AND DATE(a.data_ora) = ?';
        params.push(data);
      }
      if (dentista_id) {
        query += ' AND a.dentista_id = ?';
        params.push(dentista_id);
      }
      
      query += ' ORDER BY a.data_ora';
      
      const stmt = db.prepare(query);
      const results = stmt.all(...params);
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'odontogramma') {
      const paziente_id = url.searchParams.get('paziente_id');
      if (!paziente_id) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'paziente_id richiesto' }));
        return;
      }
      const stmt = db.prepare('SELECT * FROM odontogrammi WHERE paziente_id = ? ORDER BY dente_numero');
      const results = stmt.all(paziente_id);
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'piani-trattamento') {
      const paziente_id = url.searchParams.get('paziente_id');
      if (id) {
        const piano = db.prepare('SELECT * FROM piani_trattamento WHERE id = ?').get(id);
        const trattamenti = db.prepare('SELECT * FROM trattamenti WHERE piano_trattamento_id = ?').all(id);
        res.writeHead(200);
        res.end(JSON.stringify({ ...piano, trattamenti }));
      } else {
        let query = 'SELECT pt.*, d.nome || " " || d.cognome as dentista_nome FROM piani_trattamento pt JOIN dentisti d ON pt.dentista_diagnosi_id = d.id';
        const params = [];
        if (paziente_id) {
          query += ' WHERE pt.paziente_id = ?';
          params.push(paziente_id);
        }
        query += ' ORDER BY pt.data_creazione DESC';
        const results = db.prepare(query).all(...params);
        res.writeHead(200);
        res.end(JSON.stringify(results));
      }
    } else if (resource === 'piani-cura') {
      const paziente_id = url.searchParams.get('paziente_id');
      if (id) {
        const piano = db.prepare('SELECT * FROM piani_cura WHERE id = ?').get(id);
        const trattamenti = db.prepare(`
          SELECT t.*, d1.nome || ' ' || d1.cognome as dentista_primario_nome,
                 d2.nome || ' ' || d2.cognome as dentista_secondario_nome
          FROM trattamenti t
          LEFT JOIN dentisti d1 ON t.dentista_primario_id = d1.id
          LEFT JOIN dentisti d2 ON t.dentista_secondario_id = d2.id
          WHERE t.piano_trattamento_id = (SELECT piano_trattamento_id FROM piani_cura WHERE id = ?)
        `).all(id);
        res.writeHead(200);
        res.end(JSON.stringify({ ...piano, trattamenti }));
      } else {
        let query = 'SELECT * FROM piani_cura';
        const params = [];
        if (paziente_id) {
          query += ' WHERE paziente_id = ?';
          params.push(paziente_id);
        }
        query += ' ORDER BY data_creazione DESC';
        const results = db.prepare(query).all(...params);
        res.writeHead(200);
        res.end(JSON.stringify(results));
      }
    } else if (resource === 'fatture') {
      const stmt = db.prepare(`
        SELECT f.*, 
               p.nome || ' ' || p.cognome as paziente_nome,
               d.nome || ' ' || d.cognome as dentista_nome
        FROM fatture f
        JOIN pazienti p ON f.paziente_id = p.id
        JOIN dentisti d ON f.dentista_id = d.id
        ORDER BY f.data_emissione DESC
      `);
      const results = stmt.all();
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'compensi') {
      const mese = url.searchParams.get('mese');
      const anno = url.searchParams.get('anno');
      const dentista_id = url.searchParams.get('dentista_id');
      
      let query = `
        SELECT c.*, 
               d.nome || ' ' || d.cognome as dentista_nome,
               f.numero_fattura
        FROM compensi_dentisti c
        JOIN dentisti d ON c.dentista_id = d.id
        JOIN fatture f ON c.fattura_id = f.id
        WHERE 1=1
      `;
      const params = [];
      
      if (mese) {
        query += ' AND c.mese = ?';
        params.push(mese);
      }
      if (anno) {
        query += ' AND c.anno = ?';
        params.push(anno);
      }
      if (dentista_id) {
        query += ' AND c.dentista_id = ?';
        params.push(dentista_id);
      }
      
      const stmt = db.prepare(query);
      const results = stmt.all(...params);
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'trattamenti') {
      const piano_id = url.searchParams.get('piano_trattamento_id');
      if (piano_id) {
        const stmt = db.prepare('SELECT * FROM trattamenti WHERE piano_trattamento_id = ?');
        const results = stmt.all(piano_id);
        res.writeHead(200);
        res.end(JSON.stringify(results));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'piano_trattamento_id richiesto' }));
      }
    } else if (resource === 'magazzino') {
      const stmt = db.prepare('SELECT * FROM magazzino ORDER BY nome');
      const results = stmt.all();
      res.writeHead(200);
      res.end(JSON.stringify(results));
    } else if (resource === 'listino-prezzi') {
      if (id) {
        const stmt = db.prepare('SELECT * FROM listino_prezzi WHERE id = ?');
        const result = stmt.get(id);
        res.writeHead(200);
        res.end(JSON.stringify(result || {}));
      } else {
        const stmt = db.prepare('SELECT * FROM listino_prezzi ORDER BY categoria, descrizione');
        const results = stmt.all();
        res.writeHead(200);
        res.end(JSON.stringify(results));
      }
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
    }
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
}

function handlePOST(req, res, resource) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      
      if (resource === 'pazienti') {
        const stmt = db.prepare(`
          INSERT INTO pazienti (nome, cognome, codice_fiscale, data_nascita, sesso, 
                               indirizzo, citta, cap, telefono, email, note_mediche, 
                               allergie, consenso_privacy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.nome, data.cognome, data.codice_fiscale, data.data_nascita, data.sesso,
          data.indirizzo, data.citta, data.cap, data.telefono, data.email,
          data.note_mediche, data.allergie, data.consenso_privacy ? 1 : 0
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'dentisti') {
        const stmt = db.prepare(`
          INSERT INTO dentisti (nome, cognome, codice_fiscale, email, telefono, percentuale_compenso)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.nome, data.cognome, data.codice_fiscale, data.email, 
          data.telefono, data.percentuale_compenso || 0
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'appuntamenti') {
        const stmt = db.prepare(`
          INSERT INTO appuntamenti (paziente_id, dentista_id, data_ora, durata_minuti, tipo_visita, stato, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.paziente_id, data.dentista_id, data.data_ora, data.durata_minuti || 30,
          data.tipo_visita, data.stato || 'programmato', data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'odontogramma') {
        const stmt = db.prepare(`
          INSERT INTO odontogrammi (paziente_id, dente_numero, stato, diagnosi, trattamento, data_intervento, dentista_id, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.paziente_id, data.dente_numero, data.stato, data.diagnosi,
          data.trattamento, data.data_intervento, data.dentista_id, data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'piani-trattamento') {
        const stmt = db.prepare(`
          INSERT INTO piani_trattamento (paziente_id, dentista_diagnosi_id, diagnosi, stato, note)
          VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.paziente_id, data.dentista_diagnosi_id, data.diagnosi,
          data.stato || 'bozza', data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'trattamenti') {
        const stmt = db.prepare(`
          INSERT INTO trattamenti (piano_trattamento_id, descrizione, dente_numero, costo, 
                                  dentista_primario_id, dentista_secondario_id, 
                                  percentuale_primario, percentuale_secondario)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.piano_trattamento_id, data.descrizione, data.dente_numero, data.costo,
          data.dentista_primario_id, data.dentista_secondario_id || null,
          data.percentuale_primario || 100, data.percentuale_secondario || 0
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'piani-cura') {
        const piano_trattamento = db.prepare('SELECT * FROM piani_trattamento WHERE id = ?').get(data.piano_trattamento_id);
        const trattamenti = db.prepare('SELECT * FROM trattamenti WHERE piano_trattamento_id = ?').all(data.piano_trattamento_id);
        const importo_totale = trattamenti.reduce((sum, t) => sum + t.costo, 0);
        
        const anno = new Date().getFullYear();
        const count = db.prepare('SELECT COUNT(*) as count FROM piani_cura WHERE numero_preventivo LIKE ?').get(`PREV${anno}%`).count;
        const numero_preventivo = `PREV${anno}/${(count + 1).toString().padStart(4, '0')}`;
        
        const stmt = db.prepare(`
          INSERT INTO piani_cura (piano_trattamento_id, paziente_id, numero_preventivo, importo_totale, stato, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.piano_trattamento_id, piano_trattamento.paziente_id, numero_preventivo,
          importo_totale, data.stato || 'preventivo', data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid, numero_preventivo, importo_totale }));
      } else if (resource === 'piani-cura-pagamento') {
        const piano = db.prepare('SELECT * FROM piani_cura WHERE id = ?').get(data.piano_cura_id);
        const trattamenti = db.prepare('SELECT * FROM trattamenti WHERE piano_trattamento_id = ?').all(piano.piano_trattamento_id);
        
        db.prepare('UPDATE piani_cura SET stato_pagamento = ? WHERE id = ?').run(data.stato_pagamento, data.piano_cura_id);
        
        if (data.stato_pagamento === 'pagato') {
          const now = new Date();
          trattamenti.forEach(t => {
            if (t.dentista_primario_id) {
              const compenso = t.costo * (t.percentuale_primario / 100);
              db.prepare(`
                INSERT INTO compensi_dentisti (dentista_id, piano_cura_id, trattamento_id, importo_base, percentuale, compenso_calcolato, mese, anno)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(t.dentista_primario_id, data.piano_cura_id, t.id, t.costo, t.percentuale_primario, compenso, now.getMonth() + 1, now.getFullYear());
            }
            if (t.dentista_secondario_id && t.percentuale_secondario > 0) {
              const compenso = t.costo * (t.percentuale_secondario / 100);
              db.prepare(`
                INSERT INTO compensi_dentisti (dentista_id, piano_cura_id, trattamento_id, importo_base, percentuale, compenso_calcolato, mese, anno)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(t.dentista_secondario_id, data.piano_cura_id, t.id, t.costo, t.percentuale_secondario, compenso, now.getMonth() + 1, now.getFullYear());
            }
          });
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (resource === 'fatture') {
        const stmt = db.prepare(`
          INSERT INTO fatture (numero_fattura, paziente_id, piano_cura_id, dentista_id, 
                              data_emissione, importo_totale, importo_pagato, 
                              stato_pagamento, metodo_pagamento, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.numero_fattura, data.paziente_id, data.piano_cura_id, data.dentista_id,
          data.data_emissione, data.importo_totale, data.importo_pagato || 0,
          data.stato_pagamento || 'non_pagata', data.metodo_pagamento, data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'magazzino') {
        const stmt = db.prepare(`
          INSERT INTO magazzino (codice_articolo, nome, categoria, quantita, quantita_minima, prezzo_acquisto, fornitore, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.codice_articolo, data.nome, data.categoria, data.quantita || 0,
          data.quantita_minima || 0, data.prezzo_acquisto, data.fornitore, data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else if (resource === 'listino-prezzi') {
        const stmt = db.prepare(`
          INSERT INTO listino_prezzi (categoria, descrizione, codice, prezzo, note)
          VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          data.categoria, data.descrizione, data.codice, data.prezzo, data.note
        );
        res.writeHead(201);
        res.end(JSON.stringify({ id: result.lastInsertRowid }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Resource not found' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

function handlePUT(req, res, resource, id) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      
      if (resource === 'pazienti' && id) {
        const stmt = db.prepare(`
          UPDATE pazienti SET nome = ?, cognome = ?, codice_fiscale = ?, data_nascita = ?,
                             sesso = ?, indirizzo = ?, citta = ?, cap = ?, telefono = ?,
                             email = ?, note_mediche = ?, allergie = ?, consenso_privacy = ?
          WHERE id = ?
        `);
        stmt.run(
          data.nome, data.cognome, data.codice_fiscale, data.data_nascita, data.sesso,
          data.indirizzo, data.citta, data.cap, data.telefono, data.email,
          data.note_mediche, data.allergie, data.consenso_privacy ? 1 : 0, id
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (resource === 'appuntamenti' && id) {
        const stmt = db.prepare(`
          UPDATE appuntamenti SET stato = ?, note = ?
          WHERE id = ?
        `);
        stmt.run(data.stato, data.note, id);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (resource === 'magazzino' && id) {
        const stmt = db.prepare(`
          UPDATE magazzino SET quantita = quantita + ?
          WHERE id = ?
        `);
        stmt.run(data.delta_quantita, id);
        db.prepare(`
          INSERT INTO movimenti_magazzino (articolo_id, tipo_movimento, quantita, causale)
          VALUES (?, ?, ?, ?)
        `).run(id, data.delta_quantita > 0 ? 'carico' : 'scarico', Math.abs(data.delta_quantita), data.causale);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (resource === 'listino-prezzi' && id) {
        const stmt = db.prepare(`
          UPDATE listino_prezzi SET categoria = ?, descrizione = ?, codice = ?, prezzo = ?, note = ?
          WHERE id = ?
        `);
        stmt.run(data.categoria, data.descrizione, data.codice, data.prezzo, data.note, id);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Resource not found' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

function handleDELETE(resource, id, res) {
  try {
    if (resource === 'appuntamenti' && id) {
      const stmt = db.prepare('DELETE FROM appuntamenti WHERE id = ?');
      stmt.run(id);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } else if (resource === 'trattamenti' && id) {
      const stmt = db.prepare('DELETE FROM trattamenti WHERE id = ?');
      stmt.run(id);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } else if (resource === 'listino-prezzi' && id) {
      const stmt = db.prepare('DELETE FROM listino_prezzi WHERE id = ?');
      stmt.run(id);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
    }
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});