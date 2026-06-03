const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbykXW7mMM0kkac1_AI0YuB6IQu9s_YL67xlLXuIbwhlXrUWxQdk2Gwq1rGL9tzVN6EGdQ/exec";

let huidigeBeheerder = "";
let huidigeTraining = "";

// Service Worker registreren
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker geregistreerd'))
    .catch(err => console.log('Service Worker fout:', err));
}

// Scherm wisselen
function toonScherm(id) {
  document.querySelectorAll('.scherm').forEach(s => s.classList.remove('actief'));
  document.getElementById(id).classList.add('actief');
}

// Stap 1: Sessie starten
function startSessie() {
  const beheerder = document.getElementById('keuzesBeheerder').value;
  if (!beheerder) {
    alert('Kies eerst een beheerder!');
    return;
  }
  huidigeBeheerder = beheerder;
  document.getElementById('labelBeheerder').textContent = 'Beheerder: ' + beheerder;
  toonScherm('schermTraining');
}

// Stap 2: Scan starten
function startScan() {
  const training = document.getElementById('keuzesTraining').value;
  if (!training) {
    alert('Kies eerst een type training!');
    return;
  }
  huidigeTraining = training;
  
  // QR scanner openen
  if ('BarcodeDetector' in window) {
    scanMetBarcodeDetector();
  } else {
    alert('QR scanner niet beschikbaar op dit toestel. Probeer Chrome op Android.');
  }
}

// QR Scanner via BarcodeDetector API
async function scanMetBarcodeDetector() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }});
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    
    const interval = setInterval(async () => {
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0) {
        clearInterval(interval);
        stream.getTracks().forEach(t => t.stop());
        verwerkScan(barcodes[0].rawValue);
      }
    }, 500);
  } catch(err) {
    alert('Camera toegang geweigerd. Geef toestemming in je browser.');
  }
}

// Stap 3: Scan verwerken
async function verwerkScan(qrData) {
  console.log('QR data:', qrData);
  
  // Tijdelijk: toon ruwe data om Twizzit formaat te leren kennen
  document.getElementById('resultaatTitel').textContent = 'Scan ontvangen!';
  document.getElementById('resultaatNaam').textContent = qrData;
  document.getElementById('resultaatStatus').textContent = 'Verwerken...';
  toonScherm('schermResultaat');
  
  // Verstuur naar Google Sheets
  await registreerAanwezigheid({
    licentienr: 'TEST',
    naam: qrData,
    type_training: huidigeTraining,
    status_lid: 'Onbekend',
    gescand_door: huidigeBeheerder,
    actie_log: 'Geregistreerd'
  });
}

// Naar Google Sheets sturen
async function registreerAanwezigheid(data) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ actie: 'registreer', ...data })
    });
    const resultaat = await response.json();
    
    if (resultaat.status === 'ok') {
      document.getElementById('resultaatStatus').textContent = '✅ Geregistreerd!';
    } else {
      slaOpOffline(data);
    }
  } catch(err) {
    // Geen internet — offline opslaan
    slaOpOffline(data);
    document.getElementById('resultaatStatus').textContent = '📴 Offline opgeslagen';
  }
}

// Offline opslaan
function slaOpOffline(data) {
  const wachtrij = JSON.parse(localStorage.getItem('wachtrij') || '[]');
  wachtrij.push({ ...data, tijdstip: new Date().toISOString() });
  localStorage.setItem('wachtrij', JSON.stringify(wachtrij));
}

// Offline scans synchroniseren
async function syncOfflineScans() {
  const wachtrij = JSON.parse(localStorage.getItem('wachtrij') || '[]');
  if (wachtrij.length === 0) return;
  
  const nogVersturen = [];
  for (const scan of wachtrij) {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ actie: 'registreer', ...scan })
      });
    } catch(err) {
      nogVersturen.push(scan);
    }
  }
  localStorage.setItem('wachtrij', JSON.stringify(nogVersturen));
}

// Automatisch synchroniseren als internet terug is
window.addEventListener('online', syncOfflineScans);

// Volgende scan
function nieuweScan() {
  toonScherm('schermTraining');
}

// Sessie stoppen
function stopSessie() {
  huidigeBeheerder = "";
  huidigeTraining = "";
  toonScherm('schermBeheerder');
}