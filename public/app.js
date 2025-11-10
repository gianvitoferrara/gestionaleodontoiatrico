// Global state
let currentSection = 'dashboard';
let pazienti = [];
let dentisti = [];
let appuntamenti = [];
let fatture = [];
let magazzino = [];
let listinoPrezzi = [];
let calendarView = 'day';
let calendarDate = new Date();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadInitialData();
  setDefaultDate();
  initCompensiFilters();
});

function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      showSection(section);
    });
  });
}

function showSection(section) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(section).classList.add('active');
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  
  currentSection = section;
  
  // Load data for section
  if (section === 'dashboard') loadDashboard();
  if (section === 'pazienti') loadPazienti();
  if (section === 'agenda') loadAppuntamenti();
  if (section === 'magazzino') loadMagazzino();
  if (section === 'fatture') loadFatture();
  if (section === 'compensi') loadCompensi();
  if (section === 'listino') loadListinoPrezzi();
  if (section === 'dentisti') loadDentisti();
}

async function loadInitialData() {
  await loadDentisti();
  await loadDashboard();
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('filter-data');
  if (dateInput) {
    dateInput.value = today;
    dateInput.addEventListener('change', () => {
      calendarDate = new Date(dateInput.value);
      loadAppuntamenti();
    });
  }
}

function initCompensiFilters() {
  const now = new Date();
  const meseSelect = document.getElementById('compensi-mese');
  const annoSelect = document.getElementById('compensi-anno');
  
  if (meseSelect) meseSelect.value = now.getMonth() + 1;
  
  if (annoSelect) {
    for (let year = now.getFullYear(); year >= now.getFullYear() - 5; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      annoSelect.appendChild(option);
    }
    annoSelect.value = now.getFullYear();
  }
}

// API calls
async function api(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);
  
  const response = await fetch(`/api/${endpoint}`, options);
  if (!response.ok) throw new Error('API request failed');
  return response.json();
}

// Dashboard
async function loadDashboard() {
  try {
    pazienti = await api('pazienti');
    const today = new Date().toISOString().split('T')[0];
    appuntamenti = await api(`appuntamenti?data=${today}`);
    fatture = await api('fatture');
    
    const now = new Date();
    const currentMonth = fatture.filter(f => {
      const fDate = new Date(f.data_emissione);
      return fDate.getMonth() === now.getMonth() && fDate.getFullYear() === now.getFullYear();
    });
    
    document.getElementById('stat-appuntamenti').textContent = appuntamenti.length;
    document.getElementById('stat-pazienti').textContent = pazienti.length;
    document.getElementById('stat-fatture').textContent = currentMonth.length;
    
    const incasso = currentMonth.reduce((sum, f) => sum + f.importo_totale, 0);
    document.getElementById('stat-incasso').textContent = `€${incasso.toFixed(2)}`;
    
    renderTodayAppointments();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function renderTodayAppointments() {
  const container = document.getElementById('today-appointments');
  
  if (appuntamenti.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessun appuntamento oggi</p></div>';
    return;
  }
  
  container.innerHTML = appuntamenti.map(a => `
    <div class="appointment-item">
      <div class="appointment-time">${formatTime(a.data_ora)}</div>
      <div class="appointment-patient">${a.paziente_nome}</div>
      <div class="appointment-dentist">Dr. ${a.dentista_nome}</div>
      <div class="appointment-status status-${a.stato}">${a.stato}</div>
    </div>
  `).join('');
}

// Pazienti
async function loadPazienti() {
  try {
    pazienti = await api('pazienti');
    renderPazienti();
    
    document.getElementById('search-pazienti').addEventListener('input', (e) => {
      const search = e.target.value.toLowerCase();
      const filtered = pazienti.filter(p => 
        `${p.nome} ${p.cognome}`.toLowerCase().includes(search) ||
        (p.codice_fiscale && p.codice_fiscale.toLowerCase().includes(search))
      );
      renderPazienti(filtered);
    });
  } catch (error) {
    console.error('Error loading pazienti:', error);
  }
}

function renderPazienti(list = pazienti) {
  const container = document.getElementById('pazienti-list');
  
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessun paziente trovato</p></div>';
    return;
  }
  
  container.innerHTML = list.map(p => `
    <div class="data-item">
      <div>
        <div class="item-primary">${p.nome} ${p.cognome}</div>
        <div class="item-secondary">${p.codice_fiscale || 'N/A'} - ${p.telefono || 'N/A'}</div>
      </div>
      <div class="item-secondary">${formatDate(p.data_nascita)}</div>
      <div class="item-secondary">${p.email || 'N/A'}</div>
      <div class="item-actions">
        <button class="action-btn view" onclick="viewPazienteDetails(${p.id})">Cartella</button>
        <button class="action-btn edit" onclick="editPaziente(${p.id})">Modifica</button>
      </div>
    </div>
  `).join('');
}

function showPazienteForm(paziente = null) {
  const isEdit = paziente !== null;
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>${isEdit ? 'Modifica Paziente' : 'Nuovo Paziente'}</h2>
    <form id="paziente-form">
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" name="nome" value="${paziente?.nome || ''}" required>
      </div>
      <div class="form-group">
        <label>Cognome *</label>
        <input type="text" name="cognome" value="${paziente?.cognome || ''}" required>
      </div>
      <div class="form-group">
        <label>Codice Fiscale</label>
        <input type="text" name="codice_fiscale" value="${paziente?.codice_fiscale || ''}" maxlength="16">
      </div>
      <div class="form-group">
        <label>Data di Nascita</label>
        <input type="date" name="data_nascita" value="${paziente?.data_nascita || ''}">
      </div>
      <div class="form-group">
        <label>Sesso</label>
        <select name="sesso">
          <option value="">Seleziona</option>
          <option value="M" ${paziente?.sesso === 'M' ? 'selected' : ''}>Maschio</option>
          <option value="F" ${paziente?.sesso === 'F' ? 'selected' : ''}>Femmina</option>
        </select>
      </div>
      <div class="form-group">
        <label>Indirizzo</label>
        <input type="text" name="indirizzo" value="${paziente?.indirizzo || ''}">
      </div>
      <div class="form-group">
        <label>Città</label>
        <input type="text" name="citta" value="${paziente?.citta || ''}">
      </div>
      <div class="form-group">
        <label>CAP</label>
        <input type="text" name="cap" value="${paziente?.cap || ''}" maxlength="5">
      </div>
      <div class="form-group">
        <label>Telefono</label>
        <input type="tel" name="telefono" value="${paziente?.telefono || ''}">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${paziente?.email || ''}">
      </div>
      <div class="form-group">
        <label>Note Mediche</label>
        <textarea name="note_mediche">${paziente?.note_mediche || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Allergie</label>
        <textarea name="allergie">${paziente?.allergie || ''}</textarea>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="consenso_privacy" ${paziente?.consenso_privacy ? 'checked' : ''}>
          Consenso Privacy GDPR
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  document.getElementById('paziente-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.consenso_privacy = formData.get('consenso_privacy') ? 1 : 0;
    
    try {
      if (isEdit) {
        await api(`pazienti/${paziente.id}`, 'PUT', data);
      } else {
        await api('pazienti', 'POST', data);
      }
      closeModal();
      loadPazienti();
    } catch (error) {
      alert('Errore nel salvataggio del paziente');
    }
  });
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function editPaziente(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (paziente) showPazienteForm(paziente);
}

// Appuntamenti with calendar
async function loadAppuntamenti() {
  try {
    const data = document.getElementById('filter-data').value;
    const dentista_id = document.getElementById('filter-dentista').value;
    
    let query = `appuntamenti?data=${data}`;
    if (dentista_id) query += `&dentista_id=${dentista_id}`;
    
    appuntamenti = await api(query);
    renderCalendar();
    
    // Populate dentisti filter
    const select = document.getElementById('filter-dentista');
    select.innerHTML = '<option value="">Tutti i dentisti</option>' +
      dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('');
  } catch (error) {
    console.error('Error loading appuntamenti:', error);
  }
}

function renderCalendar() {
  const container = document.getElementById('appuntamenti-list');
  
  // Calendar header with view switcher
  const headerHTML = `
    <div class="calendar-header">
      <div class="calendar-nav">
        <button onclick="changeCalendarDate(-1)">◀</button>
        <h3>${formatCalendarTitle()}</h3>
        <button onclick="changeCalendarDate(1)">▶</button>
        <button onclick="setCalendarToday()">Oggi</button>
      </div>
      <div class="calendar-nav">
        <button class="${calendarView === 'day' ? 'active' : ''}" onclick="setCalendarView('day')">Giorno</button>
        <button class="${calendarView === 'week' ? 'active' : ''}" onclick="setCalendarView('week')">Settimana</button>
        <button class="${calendarView === 'month' ? 'active' : ''}" onclick="setCalendarView('month')">Mese</button>
      </div>
    </div>
  `;
  
  if (calendarView === 'day') {
    container.innerHTML = headerHTML + renderDayView();
  } else if (calendarView === 'week') {
    container.innerHTML = headerHTML + renderWeekView();
  } else {
    container.innerHTML = headerHTML + renderMonthView();
  }
}

function renderDayView() {
  const hours = Array.from({length: 14}, (_, i) => i + 7); // 7:00 - 20:00
  const dateStr = calendarDate.toISOString().split('T')[0];
  const dayAppointments = appuntamenti.filter(a => a.data_ora.startsWith(dateStr));
  
  return `
    <div class="calendar-grid day-view">
      <div class="calendar-time-label"></div>
      <div class="calendar-day-header ${isToday(calendarDate) ? 'today' : ''}">
        ${formatDayHeader(calendarDate)}
      </div>
      ${hours.map(hour => `
        <div class="calendar-time-label">${hour}:00</div>
        <div class="calendar-time-slot">
          ${dayAppointments
            .filter(a => new Date(a.data_ora).getHours() === hour)
            .map(a => `
              <div class="calendar-event ${a.stato}" onclick="viewAppuntamento(${a.id})">
                <div><strong>${formatTime(a.data_ora)}</strong> - ${a.paziente_nome}</div>
                <div style="font-size: 0.8rem;">Dr. ${a.dentista_nome}</div>
                <div style="font-size: 0.8rem;">${a.tipo_visita || ''}</div>
              </div>
            `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function renderWeekView() {
  const startOfWeek = getStartOfWeek(calendarDate);
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });
  const hours = Array.from({length: 14}, (_, i) => i + 7);
  
  return `
    <div class="calendar-grid week-view">
      <div class="calendar-time-label"></div>
      ${days.map(day => `
        <div class="calendar-day-header ${isToday(day) ? 'today' : ''}">
          ${formatDayHeader(day)}
        </div>
      `).join('')}
      
      ${hours.map(hour => `
        <div class="calendar-time-label">${hour}:00</div>
        ${days.map(day => {
          const dateStr = day.toISOString().split('T')[0];
          const dayAppointments = appuntamenti.filter(a => 
            a.data_ora.startsWith(dateStr) && new Date(a.data_ora).getHours() === hour
          );
          return `
            <div class="calendar-time-slot">
              ${dayAppointments.map(a => `
                <div class="calendar-event ${a.stato}" onclick="viewAppuntamento(${a.id})">
                  <div style="font-size: 0.75rem;"><strong>${formatTime(a.data_ora)}</strong></div>
                  <div style="font-size: 0.75rem;">${a.paziente_nome}</div>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      `).join('')}
    </div>
  `;
}

function renderMonthView() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = getStartOfWeek(firstDay);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 41); // 6 weeks
  
  const weeks = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }
  
  return `
    <div class="calendar-grid month-view">
      ${['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => `
        <div class="calendar-day-header">${day}</div>
      `).join('')}
      
      ${weeks.map(week => week.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const dayAppointments = appuntamenti.filter(a => a.data_ora.startsWith(dateStr));
        const isOtherMonth = day.getMonth() !== month;
        
        return `
          <div class="month-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday(day) ? 'today' : ''}">
            <div class="month-day-number">${day.getDate()}</div>
            ${dayAppointments.slice(0, 3).map(a => `
              <div class="calendar-event ${a.stato}" onclick="viewAppuntamento(${a.id})">
                ${formatTime(a.data_ora)} ${a.paziente_nome}
              </div>
            `).join('')}
            ${dayAppointments.length > 3 ? `<div style="font-size: 0.7rem; color: #7f8c8d;">+${dayAppointments.length - 3} altri</div>` : ''}
          </div>
        `;
      }).join('')).join('')}
    </div>
  `;
}

function setCalendarView(view) {
  calendarView = view;
  loadAppuntamenti();
}

function changeCalendarDate(delta) {
  if (calendarView === 'day') {
    calendarDate.setDate(calendarDate.getDate() + delta);
  } else if (calendarView === 'week') {
    calendarDate.setDate(calendarDate.getDate() + (delta * 7));
  } else {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
  }
  document.getElementById('filter-data').value = calendarDate.toISOString().split('T')[0];
  loadAppuntamenti();
}

function setCalendarToday() {
  calendarDate = new Date();
  document.getElementById('filter-data').value = calendarDate.toISOString().split('T')[0];
  loadAppuntamenti();
}

function formatCalendarTitle() {
  const options = { year: 'numeric', month: 'long' };
  if (calendarView === 'day') {
    options.day = 'numeric';
    options.weekday = 'long';
  } else if (calendarView === 'week') {
    const start = getStartOfWeek(calendarDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getDate()} ${start.toLocaleDateString('it-IT', {month: 'short'})} - ${end.getDate()} ${end.toLocaleDateString('it-IT', {month: 'short', year: 'numeric'})}`;
  }
  return calendarDate.toLocaleDateString('it-IT', options);
}

function formatDayHeader(date) {
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  return new Date(d.setDate(diff));
}

function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function viewAppuntamento(id) {
  const app = appuntamenti.find(a => a.id === id);
  if (!app) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Dettaglio Appuntamento</h2>
    <p><strong>Paziente:</strong> ${app.paziente_nome}</p>
    <p><strong>Dentista:</strong> Dr. ${app.dentista_nome}</p>
    <p><strong>Data e Ora:</strong> ${formatDateTime(app.data_ora)}</p>
    <p><strong>Tipo Visita:</strong> ${app.tipo_visita || 'N/A'}</p>
    <p><strong>Durata:</strong> ${app.durata_minuti} minuti</p>
    <p><strong>Stato:</strong> <span class="appointment-status status-${app.stato}">${app.stato}</span></p>
    ${app.note ? `<p><strong>Note:</strong> ${app.note}</p>` : ''}
    
    <div class="form-actions" style="margin-top: 1.5rem;">
      <button class="btn-secondary" onclick="closeModal()">Chiudi</button>
      <button class="btn-success" onclick="updateAppuntamentoStatus(${app.id}, 'completato'); closeModal();">Completa</button>
      <button class="btn-danger" onclick="updateAppuntamentoStatus(${app.id}, 'cancellato'); closeModal();">Cancella</button>
      <button class="action-btn delete" onclick="deleteAppuntamento(${app.id}); closeModal();">Elimina</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return 'N/A';
  const date = new Date(dateTimeString);
  return date.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Magazzino
async function loadMagazzino() {
  try {
    magazzino = await api('magazzino');
    renderMagazzino();
  } catch (error) {
    console.error('Error loading magazzino:', error);
  }
}

function renderMagazzino() {
  const container = document.getElementById('magazzino-list');
  
  if (magazzino.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessun articolo in magazzino</p></div>';
    return;
  }
  
  container.innerHTML = magazzino.map(a => `
    <div class="data-item">
      <div>
        <div class="item-primary">${a.nome}</div>
        <div class="item-secondary">${a.codice_articolo || 'N/A'} - ${a.categoria || 'N/A'}</div>
      </div>
      <div>
        <div class="item-primary">Quantità: ${a.quantita}</div>
        ${a.quantita <= a.quantita_minima ? '<span class="badge badge-warning">Scorta bassa</span>' : ''}
      </div>
      <div class="item-secondary">Min: ${a.quantita_minima}</div>
      <div class="item-actions">
        <button class="action-btn edit" onclick="adjustStock(${a.id}, 'add')">+ Carica</button>
        <button class="action-btn delete" onclick="adjustStock(${a.id}, 'remove')">- Scarica</button>
      </div>
    </div>
  `).join('');
}

function showArticoloForm() {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Nuovo Articolo</h2>
    <form id="articolo-form">
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" name="nome" required>
      </div>
      <div class="form-group">
        <label>Codice Articolo</label>
        <input type="text" name="codice_articolo">
      </div>
      <div class="form-group">
        <label>Categoria</label>
        <select name="categoria">
          <option value="">Seleziona</option>
          <option value="Materiali">Materiali</option>
          <option value="Strumenti">Strumenti</option>
          <option value="Farmaci">Farmaci</option>
          <option value="Consumabili">Consumabili</option>
          <option value="Altro">Altro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Quantità Iniziale</label>
        <input type="number" name="quantita" value="0" min="0">
      </div>
      <div class="form-group">
        <label>Quantità Minima</label>
        <input type="number" name="quantita_minima" value="0" min="0">
      </div>
      <div class="form-group">
        <label>Prezzo Acquisto</label>
        <input type="number" name="prezzo_acquisto" step="0.01" min="0">
      </div>
      <div class="form-group">
        <label>Fornitore</label>
        <input type="text" name="fornitore">
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  document.getElementById('articolo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      await api('magazzino', 'POST', data);
      closeModal();
      loadMagazzino();
    } catch (error) {
      alert('Errore nel salvataggio dell\'articolo');
    }
  });
}

function adjustStock(id, action) {
  const articolo = magazzino.find(a => a.id === id);
  if (!articolo) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>${action === 'add' ? 'Carico' : 'Scarico'} - ${articolo.nome}</h2>
    <p>Quantità attuale: ${articolo.quantita}</p>
    <form id="stock-form">
      <div class="form-group">
        <label>Quantità</label>
        <input type="number" name="quantita" min="1" required>
      </div>
      <div class="form-group">
        <label>Causale</label>
        <input type="text" name="causale" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Conferma</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  document.getElementById('stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const quantita = parseInt(formData.get('quantita'));
    const causale = formData.get('causale');
    
    try {
      await api(`magazzino/${id}`, 'PUT', {
        delta_quantita: action === 'add' ? quantita : -quantita,
        causale
      });
      closeModal();
      loadMagazzino();
    } catch (error) {
      alert('Errore nell\'aggiornamento dello stock');
    }
  });
}

// Fatture
async function loadFatture() {
  try {
    fatture = await api('fatture');
    renderFatture();
  } catch (error) {
    console.error('Error loading fatture:', error);
  }
}

function renderFatture() {
  const container = document.getElementById('fatture-list');
  
  if (fatture.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessuna fattura trovata</p></div>';
    return;
  }
  
  container.innerHTML = fatture.map(f => `
    <div class="data-item">
      <div>
        <div class="item-primary">Fattura ${f.numero_fattura}</div>
        <div class="item-secondary">${f.paziente_nome}</div>
      </div>
      <div class="item-secondary">${formatDate(f.data_emissione)}</div>
      <div>
        <div class="item-primary">€${f.importo_totale.toFixed(2)}</div>
        <div class="item-secondary">${f.stato_pagamento}</div>
      </div>
      <div class="item-secondary">Dr. ${f.dentista_nome}</div>
    </div>
  `).join('');
}

function showFatturaForm() {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  const nextNumber = `F${new Date().getFullYear()}/${(fatture.length + 1).toString().padStart(4, '0')}`;
  
  modalBody.innerHTML = `
    <h2>Nuova Fattura</h2>
    <form id="fattura-form">
      <div class="form-group">
        <label>Numero Fattura *</label>
        <input type="text" name="numero_fattura" value="${nextNumber}" required>
      </div>
      <div class="form-group">
        <label>Paziente *</label>
        <select name="paziente_id" required>
          <option value="">Seleziona paziente</option>
          ${pazienti.map(p => `<option value="${p.id}">${p.nome} ${p.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Dentista *</label>
        <select name="dentista_id" required>
          <option value="">Seleziona dentista</option>
          ${dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data Emissione</label>
        <input type="date" name="data_emissione" value="${new Date().toISOString().split('T')[0]}" required>
      </div>
      <div class="form-group">
        <label>Importo Totale *</label>
        <input type="number" name="importo_totale" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label>Importo Pagato</label>
        <input type="number" name="importo_pagato" step="0.01" min="0" value="0">
      </div>
      <div class="form-group">
        <label>Metodo Pagamento</label>
        <select name="metodo_pagamento">
          <option value="">Seleziona</option>
          <option value="Contanti">Contanti</option>
          <option value="Carta">Carta</option>
          <option value="Bonifico">Bonifico</option>
          <option value="Assegno">Assegno</option>
        </select>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  document.getElementById('fattura-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const importo_totale = parseFloat(data.importo_totale);
    const importo_pagato = parseFloat(data.importo_pagato);
    
    data.stato_pagamento = importo_pagato >= importo_totale ? 'pagata' : 
                          importo_pagato > 0 ? 'parzialmente_pagata' : 'non_pagata';
    
    try {
      await api('fatture', 'POST', data);
      closeModal();
      loadFatture();
    } catch (error) {
      alert('Errore nel salvataggio della fattura');
    }
  });
}

// Compensi
async function loadCompensi() {
  try {
    const mese = document.getElementById('compensi-mese').value;
    const anno = document.getElementById('compensi-anno').value;
    const dentista_id = document.getElementById('compensi-dentista').value;
    
    let query = `compensi?mese=${mese}&anno=${anno}`;
    if (dentista_id) query += `&dentista_id=${dentista_id}`;
    
    const compensi = await api(query);
    renderCompensi(compensi);
    
    // Populate dentisti filter
    const select = document.getElementById('compensi-dentista');
    select.innerHTML = '<option value="">Tutti i dentisti</option>' +
      dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('');
  } catch (error) {
    console.error('Error loading compensi:', error);
  }
}

function renderCompensi(compensi) {
  const listContainer = document.getElementById('compensi-list');
  const summaryContainer = document.getElementById('compensi-summary');
  
  if (compensi.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><p>Nessun compenso trovato</p></div>';
    summaryContainer.innerHTML = '';
    return;
  }
  
  listContainer.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Dentista</th>
          <th>Preventivo</th>
          <th>Importo Base</th>
          <th>Percentuale</th>
          <th>Compenso</th>
          <th>Stato</th>
        </tr>
      </thead>
      <tbody>
        ${compensi.map(c => `
          <tr>
            <td>${c.dentista_nome}</td>
            <td>${c.numero_preventivo || 'N/A'}</td>
            <td>€${c.importo_base.toFixed(2)}</td>
            <td>${c.percentuale}%</td>
            <td><strong>€${c.compenso_calcolato.toFixed(2)}</strong></td>
            <td>${c.pagato ? '✅ Pagato' : '⏳ Da pagare'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Calculate summary
  const totale = compensi.reduce((sum, c) => sum + c.compenso_calcolato, 0);
  const pagato = compensi.filter(c => c.pagato).reduce((sum, c) => sum + c.compenso_calcolato, 0);
  const daPagare = totale - pagato;
  
  summaryContainer.innerHTML = `
    <div class="summary-card">
      <h3>Riepilogo Compensi</h3>
      <div class="summary-item">
        <span>Totale Compensi:</span>
        <span>€${totale.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span>Già Pagato:</span>
        <span>€${pagato.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span>Da Pagare:</span>
        <span>€${daPagare.toFixed(2)}</span>
      </div>
    </div>
  `;
}

// Dentisti
async function loadDentisti() {
  try {
    dentisti = await api('dentisti');
    if (currentSection === 'dentisti') renderDentisti();
  } catch (error) {
    console.error('Error loading dentisti:', error);
  }
}

function renderDentisti() {
  const container = document.getElementById('dentisti-list');
  
  if (dentisti.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessun dentista trovato</p></div>';
    return;
  }
  
  container.innerHTML = dentisti.map(d => `
    <div class="data-item">
      <div>
        <div class="item-primary">Dr. ${d.nome} ${d.cognome}</div>
        <div class="item-secondary">${d.codice_fiscale || 'N/A'}</div>
      </div>
      <div class="item-secondary">${d.email || 'N/A'}</div>
      <div class="item-secondary">${d.telefono || 'N/A'}</div>
      <div>
        <div class="item-primary">Compenso: ${d.percentuale_compenso}%</div>
      </div>
    </div>
  `).join('');
}

function showDentistaForm() {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Nuovo Dentista</h2>
    <form id="dentista-form">
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" name="nome" required>
      </div>
      <div class="form-group">
        <label>Cognome *</label>
        <input type="text" name="cognome" required>
      </div>
      <div class="form-group">
        <label>Codice Fiscale</label>
        <input type="text" name="codice_fiscale" maxlength="16">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email">
      </div>
      <div class="form-group">
        <label>Telefono</label>
        <input type="tel" name="telefono">
      </div>
      <div class="form-group">
        <label>Percentuale Compenso (%)</label>
        <input type="number" name="percentuale_compenso" min="0" max="100" step="0.1" value="0">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  document.getElementById('dentista-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      await api('dentisti', 'POST', data);
      closeModal();
      loadDentisti();
    } catch (error) {
      alert('Errore nel salvataggio del dentista');
    }
  });
}

// Listino Prezzi
async function loadListinoPrezzi() {
  try {
    listinoPrezzi = await api('listino-prezzi');
    renderListinoPrezzi();
  } catch (error) {
    console.error('Error loading listino:', error);
  }
}

function renderListinoPrezzi() {
  const container = document.getElementById('listino-list');
  if (listinoPrezzi.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nessun trattamento nel listino</p></div>';
    return;
  }
  const categorie = [...new Set(listinoPrezzi.map(item => item.categoria))];
  container.innerHTML = categorie.map(cat => `
    <div style="margin-bottom: 2rem;">
      <h3>${cat}</h3>
      <div class="data-list">
        ${listinoPrezzi.filter(item => item.categoria === cat).map(item => `
          <div class="data-item">
            <div>
              <div class="item-primary">${item.descrizione}</div>
              <div class="item-secondary">Codice: ${item.codice || 'N/A'}</div>
            </div>
            <div class="item-primary">€${item.prezzo.toFixed(2)}</div>
            <div class="item-actions">
              <button class="action-btn edit" onclick="editListinoItem(${item.id})">Modifica</button>
              <button class="action-btn delete" onclick="deleteListinoItem(${item.id})">Elimina</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function showListinoForm(item = null) {
  const isEdit = item !== null;
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <h2>${isEdit ? 'Modifica' : 'Nuovo'} Trattamento Listino</h2>
    <form id="listino-form">
      <div class="form-group">
        <label>Categoria *</label>
        <select name="categoria" required>
          <option value="Endodonzia" ${item?.categoria === 'Endodonzia' ? 'selected' : ''}>Endodonzia</option>
          <option value="Conservativa" ${item?.categoria === 'Conservativa' ? 'selected' : ''}>Conservativa</option>
          <option value="Chirurgia" ${item?.categoria === 'Chirurgia' ? 'selected' : ''}>Chirurgia</option>
          <option value="Implantologia" ${item?.categoria === 'Implantologia' ? 'selected' : ''}>Implantologia</option>
          <option value="Ortodonzia" ${item?.categoria === 'Ortodonzia' ? 'selected' : ''}>Ortodonzia</option>
          <option value="Protesi" ${item?.categoria === 'Protesi' ? 'selected' : ''}>Protesi</option>
          <option value="Igiene" ${item?.categoria === 'Igiene' ? 'selected' : ''}>Igiene</option>
          <option value="Parodontologia" ${item?.categoria === 'Parodontologia' ? 'selected' : ''}>Parodontologia</option>
          <option value="Altro" ${item?.categoria === 'Altro' ? 'selected' : ''}>Altro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Descrizione *</label>
        <input type="text" name="descrizione" value="${item?.descrizione || ''}" required>
      </div>
      <div class="form-group">
        <label>Codice</label>
        <input type="text" name="codice" value="${item?.codice || ''}" placeholder="Es: END01">
      </div>
      <div class="form-group">
        <label>Prezzo (€) *</label>
        <input type="number" name="prezzo" step="0.01" min="0" value="${item?.prezzo || ''}" required>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note">${item?.note || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annulla</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  modal.classList.add('active');
  document.getElementById('listino-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      if (isEdit) await api(`listino-prezzi/${item.id}`, 'PUT', data);
      else await api('listino-prezzi', 'POST', data);
      closeModal();
      loadListinoPrezzi();
    } catch (error) {
      alert('Errore nel salvataggio');
    }
  });
}

function editListinoItem(id) {
  const item = listinoPrezzi.find(i => i.id === id);
  if (item) showListinoForm(item);
}

async function deleteListinoItem(id) {
  if (!confirm('Eliminare questo trattamento dal listino?')) return;
  try {
    await api(`listino-prezzi/${id}`, 'DELETE');
    loadListinoPrezzi();
  } catch (error) {
    alert('Errore nell\'eliminazione');
  }
}

function popolaTrattamentoForm() {
  const select = document.getElementById('listino-select');
  const option = select.options[select.selectedIndex];
  if (option.value) {
    document.getElementById('trattamento-descrizione').value = option.dataset.descrizione;
    document.getElementById('trattamento-costo').value = option.dataset.prezzo;
  } else {
    document.getElementById('trattamento-descrizione').value = '';
    document.getElementById('trattamento-costo').value = '';
  }
}

// Numerazione FDI europea
function getFDITeeth() {
  const teeth = [];
  // Quadrante 1 (superiore destra): 18-11
  for (let i = 18; i >= 11; i--) teeth.push(i);
  // Quadrante 2 (superiore sinistra): 21-28
  for (let i = 21; i <= 28; i++) teeth.push(i);
  // Quadrante 3 (inferiore sinistra): 38-31
  for (let i = 38; i >= 31; i--) teeth.push(i);
  // Quadrante 4 (inferiore destra): 41-48
  for (let i = 41; i <= 48; i++) teeth.push(i);
  return teeth;
}

// Odontogramma
function showOdontogramma(paziente_id) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  api(`odontogramma?paziente_id=${paziente_id}`).then(odontogramma => {
    const denti = {};
    odontogramma.forEach(o => {
      denti[o.dente_numero] = o;
    });
    
    const fdiTeeth = getFDITeeth();
    
    modalBody.innerHTML = `
      <h2>Odontogramma (Numerazione FDI)</h2>
      <div style="margin-bottom: 1rem;">
        <h4>Arcata Superiore</h4>
        <div class="odontogramma-grid">
          ${fdiTeeth.slice(0, 16).map(n => {
            const dente = denti[n];
            const classe = dente ? `dente ${dente.stato}` : 'dente';
            return `<div class="${classe}" onclick="editDente(${paziente_id}, ${n})">${n}</div>`;
          }).join('')}
        </div>
      </div>
      <div>
        <h4>Arcata Inferiore</h4>
        <div class="odontogramma-grid">
          ${fdiTeeth.slice(16, 32).map(n => {
            const dente = denti[n];
            const classe = dente ? `dente ${dente.stato}` : 'dente';
            return `<div class="${classe}" onclick="editDente(${paziente_id}, ${n})">${n}</div>`;
          }).join('')}
        </div>
      </div>
      <div style="margin-top: 1rem;">
        <p><span class="dente sano" style="display: inline-block; width: 20px; height: 20px;"></span> Sano</p>
        <p><span class="dente cariato" style="display: inline-block; width: 20px; height: 20px;"></span> Cariato</p>
        <p><span class="dente otturato" style="display: inline-block; width: 20px; height: 20px;"></span> Otturato</p>
        <p><span class="dente estratto" style="display: inline-block; width: 20px; height: 20px;"></span> Estratto</p>
      </div>
    `;
  });
  
  modal.classList.add('active');
}

function editDente(paziente_id, dente_numero) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Modifica Dente ${dente_numero}</h2>
    <form id="dente-form">
      <div class="form-group">
        <label>Stato</label>
        <select name="stato" required>
          <option value="sano">Sano</option>
          <option value="cariato">Cariato</option>
          <option value="otturato">Otturato</option>
          <option value="estratto">Estratto</option>
        </select>
      </div>
      <div class="form-group">
        <label>Diagnosi</label>
        <textarea name="diagnosi"></textarea>
      </div>
      <div class="form-group">
        <label>Trattamento</label>
        <textarea name="trattamento"></textarea>
      </div>
      <div class="form-group">
        <label>Data Intervento</label>
        <input type="date" name="data_intervento">
      </div>
      <div class="form-group">
        <label>Dentista</label>
        <select name="dentista_id">
          <option value="">Seleziona</option>
          ${dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="showOdontogramma(${paziente_id})">Indietro</button>
        <button type="submit" class="btn-primary">Salva</button>
      </div>
    </form>
  `;
  
  document.getElementById('dente-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.paziente_id = paziente_id;
    data.dente_numero = dente_numero;
    
    try {
      await api('odontogramma', 'POST', data);
      showOdontogramma(paziente_id);
    } catch (error) {
      alert('Errore nel salvataggio del dente');
    }
  });
}

// Piani di cura e trattamento
function showPianiCura(paziente_id) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  Promise.all([
    api(`piani-trattamento?paziente_id=${paziente_id}`),
    api(`piani-cura?paziente_id=${paziente_id}`)
  ]).then(([pianiTrattamento, pianiCura]) => {
    modalBody.innerHTML = `
      <h2>Piani di Trattamento e Cura</h2>
      <button class="btn-primary" onclick="showPianoTrattamentoForm(${paziente_id})" style="margin-bottom: 1rem;">+ Nuovo Piano Trattamento</button>
      
      <h3>Piani di Trattamento</h3>
      ${pianiTrattamento.length === 0 ? '<p>Nessun piano di trattamento</p>' : `
        <div>
          ${pianiTrattamento.map(pt => `
            <div style="border: 1px solid #667eea; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h4>Piano ${pt.id} - Dr. ${pt.dentista_nome}</h4>
                  <p><strong>Diagnosi:</strong> ${pt.diagnosi || 'N/A'}</p>
                  <p><strong>Stato:</strong> ${pt.stato}</p>
                  <p><strong>Data:</strong> ${formatDate(pt.data_creazione)}</p>
                </div>
                <div>
                  <button class="btn-primary" onclick="viewPianoTrattamento(${pt.id})">Dettagli</button>
                  <button class="btn-success" onclick="generaPianoCura(${pt.id})">Genera Preventivo</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
      
      <h3 style="margin-top: 2rem;">Preventivi (Piani di Cura)</h3>
      ${pianiCura.length === 0 ? '<p>Nessun preventivo generato</p>' : `
        <div>
          ${pianiCura.map(pc => `
            <div style="border: 1px solid #27ae60; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h4>${pc.numero_preventivo}</h4>
                  <p><strong>Importo:</strong> €${pc.importo_totale.toFixed(2)}</p>
                  <p><strong>Stato:</strong> ${pc.stato} - ${pc.stato_pagamento}</p>
                  <p><strong>Data:</strong> ${formatDate(pc.data_creazione)}</p>
                </div>
                <div>
                  <button class="btn-primary" onclick="viewPianoCura(${pc.id})">Dettagli</button>
                  ${pc.stato_pagamento === 'non_pagato' ? `<button class="btn-success" onclick="marcaPagato(${pc.id})">Segna Pagato</button>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  });
  
  modal.classList.add('active');
}

function showPianoTrattamentoForm(paziente_id) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Nuovo Piano di Trattamento</h2>
    <form id="piano-trattamento-form">
      <div class="form-group">
        <label>Dentista Diagnosi *</label>
        <select name="dentista_diagnosi_id" required>
          <option value="">Seleziona dentista</option>
          ${dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Diagnosi *</label>
        <textarea name="diagnosi" required placeholder="Descrivere la diagnosi del paziente..."></textarea>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="showPianiCura(${paziente_id})">Annulla</button>
        <button type="submit" class="btn-primary">Crea Piano</button>
      </div>
    </form>
  `;
  
  document.getElementById('piano-trattamento-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.paziente_id = paziente_id;
    
    try {
      const result = await api('piani-trattamento', 'POST', data);
      viewPianoTrattamento(result.id);
    } catch (error) {
      alert('Errore nel salvataggio del piano di trattamento');
    }
  });
}

function viewPianoTrattamento(piano_id) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  api(`piani-trattamento/${piano_id}`).then(piano => {
    const paziente_id = piano.paziente_id;
    modalBody.innerHTML = `
      <h2>Piano di Trattamento #${piano_id}</h2>
      <p><strong>Diagnosi:</strong> ${piano.diagnosi}</p>
      <p><strong>Dentista:</strong> Dr. ${piano.dentista_nome || 'N/A'}</p>
      
      <h3>Trattamenti</h3>
      <button class="btn-primary" onclick="addTrattamento(${piano_id})" style="margin-bottom: 1rem;">+ Aggiungi Trattamento</button>
      
      ${!piano.trattamenti || piano.trattamenti.length === 0 ? '<p>Nessun trattamento inserito</p>' : `
        <table class="table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Dente</th>
              <th>Costo</th>
              <th>Dentisti</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            ${piano.trattamenti.map(t => `
              <tr>
                <td>${t.descrizione}</td>
                <td>${t.dente_numero || '-'}</td>
                <td>€${t.costo.toFixed(2)}</td>
                <td>${t.dentista_primario_id ? `Dr. (${t.percentuale_primario}%)` : '-'}${t.dentista_secondario_id ? ` + Dr. (${t.percentuale_secondario}%)` : ''}</td>
                <td><button class="btn-danger" onclick="deleteTrattamento(${t.id}, ${piano_id})">Elimina</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p><strong>Totale: €${piano.trattamenti.reduce((sum, t) => sum + t.costo, 0).toFixed(2)}</strong></p>
      `}
      
      <div class="form-actions" style="margin-top: 1.5rem;">
        <button class="btn-secondary" onclick="showPianiCura(${paziente_id})">Chiudi</button>
        <button class="btn-success" onclick="generaPianoCura(${piano_id})">Genera Preventivo</button>
      </div>
    `;
  });
}

function addTrattamento(piano_id) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  api('listino-prezzi').then(listino => {
    const fdiTeeth = getFDITeeth();
    const categorie = [...new Set(listino.map(item => item.categoria))];
    
    modalBody.innerHTML = `
      <h2>Aggiungi Trattamento</h2>
      <form id="trattamento-form">
        <div class="form-group">
          <label>Seleziona da Listino</label>
          <select id="listino-select" onchange="popolaTrattamentoForm()">
            <option value="">Inserimento manuale</option>
            ${categorie.map(cat => `
              <optgroup label="${cat}">
                ${listino.filter(item => item.categoria === cat).map(item => `
                  <option value="${item.id}" data-descrizione="${item.descrizione}" data-prezzo="${item.prezzo}">
                    ${item.descrizione} - €${item.prezzo.toFixed(2)}
                  </option>
                `).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Descrizione *</label>
          <input type="text" id="trattamento-descrizione" name="descrizione" required placeholder="Es: Otturazione, Devitalizzazione, etc.">
        </div>
      <div class="form-group">
        <label>Dente (FDI)</label>
        <select name="dente_numero">
          <option value="">Nessun dente specifico</option>
          ${fdiTeeth.map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Costo (€) *</label>
        <input type="number" id="trattamento-costo" name="costo" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label>Dentista Primario *</label>
        <select name="dentista_primario_id" required>
          <option value="">Seleziona dentista</option>
          ${dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Percentuale Dentista Primario (%)</label>
        <input type="number" name="percentuale_primario" min="0" max="100" value="100">
      </div>
      <div class="form-group">
        <label>Dentista Secondario (opzionale)</label>
        <select name="dentista_secondario_id">
          <option value="">Nessuno</option>
          ${dentisti.map(d => `<option value="${d.id}">Dr. ${d.nome} ${d.cognome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Percentuale Dentista Secondario (%)</label>
        <input type="number" name="percentuale_secondario" min="0" max="100" value="0">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="viewPianoTrattamento(${piano_id})">Annulla</button>
        <button type="submit" class="btn-primary">Aggiungi</button>
      </div>
    </form>
  `;
  
  document.getElementById('trattamento-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.piano_trattamento_id = piano_id;
    
    // Validate percentages
    const perc1 = parseFloat(data.percentuale_primario) || 0;
    const perc2 = parseFloat(data.percentuale_secondario) || 0;
    if (perc1 + perc2 > 100) {
      alert('La somma delle percentuali non può superare 100%');
      return;
    }
    
    try {
      await api('trattamenti', 'POST', data);
      viewPianoTrattamento(piano_id);
    } catch (error) {
      alert('Errore nell\'aggiunta del trattamento');
    }
    });
  }).catch(err => {
    console.error('Error loading listino:', err);
    alert('Errore nel caricamento del listino prezzi');
  });
}

async function deleteTrattamento(trattamento_id, piano_id) {
  if (!confirm('Sei sicuro di voler eliminare questo trattamento?')) return;
  try {
    await api(`trattamenti/${trattamento_id}`, 'DELETE');
    viewPianoTrattamento(piano_id);
  } catch (error) {
    alert('Errore nell\'eliminazione del trattamento');
  }
}

function generaPianoCura(piano_trattamento_id) {
  if (!confirm('Generare il preventivo da questo piano di trattamento?')) return;
  
  api('piani-cura', 'POST', { piano_trattamento_id }).then(result => {
    alert(`Preventivo generato: ${result.numero_preventivo}\nImporto: €${result.importo_totale.toFixed(2)}`);
    api(`piani-trattamento/${piano_trattamento_id}`).then(piano => {
      showPianiCura(piano.paziente_id);
    });
  }).catch(error => {
    alert('Errore nella generazione del preventivo');
  });
}

function viewPianoCura(piano_cura_id) {
  api(`piani-cura/${piano_cura_id}`).then(piano => {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <h2>Preventivo ${piano.numero_preventivo}</h2>
      <p><strong>Importo Totale:</strong> €${piano.importo_totale.toFixed(2)}</p>
      <p><strong>Stato:</strong> ${piano.stato}</p>
      <p><strong>Pagamento:</strong> ${piano.stato_pagamento}</p>
      
      <h3>Dettaglio Trattamenti</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Descrizione</th>
            <th>Dente</th>
            <th>Costo</th>
          </tr>
        </thead>
        <tbody>
          ${piano.trattamenti.map(t => `
            <tr>
              <td>${t.descrizione}</td>
              <td>${t.dente_numero || '-'}</td>
              <td>€${t.costo.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <button class="btn-secondary" onclick="closeModal()">Chiudi</button>
    `;
  });
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
}

function updateAppuntamentoStatus(id, stato) {
  const app = appuntamenti.find(a => a.id === id);
  if (!app) return;
  
  app.stato = stato;
  app.data_modifica = new Date().toISOString();
  
  try {
    api(`appuntamenti/${id}`, 'PUT', { stato });
    loadAppuntamenti();
  } catch (error) {
    console.error('Error updating appointment status:', error);
  }
}

function deleteAppuntamento(id) {
  if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
  try {
    api(`appuntamenti/${id}`, 'DELETE');
    loadAppuntamenti();
  } catch (error) {
    console.error('Error deleting appointment:', error);
  }
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visualizza Odontogramma</button>
      <button class="btn-primary" onclick="showPianiCura(${id})">Piani di Cura</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewPazienteDetails(id) {
  const paziente = pazienti.find(p => p.id === id);
  if (!paziente) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h2>Cartella Clinica - ${paziente.nome} ${paziente.cognome}</h2>
    <div style="margin: 1rem 0;">
      <h3>Dati Anagrafici</h3>
      <p><strong>CF:</strong> ${paziente.codice_fiscale || 'N/A'}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(paziente.data_nascita)}</p>
      <p><strong>Telefono:</strong> ${paziente.telefono || 'N/A'}</p>
      <p><strong>Email:</strong> ${paziente.email || 'N/A'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Note Mediche</h3>
      <p>${paziente.note_mediche || 'Nessuna nota'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <h3>Allergie</h3>
      <p>${paziente.allergie || 'Nessuna allergia registrata'}</p>
    </div>
    <div style="margin: 1rem 0;">
      <button class="btn-primary" onclick="showOdontogramma(${id})">Visual
