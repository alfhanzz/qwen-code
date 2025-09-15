const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Inisialisasi aplikasi Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Buat koneksi ke database SQLite
const db = new sqlite3.Database('chart_data.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Buat tabel jika belum ada
    db.run(`CREATE TABLE IF NOT EXISTS chart_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Table chart_data is ready');
      }
    });
  }
});

// Middleware untuk static files
app.use(express.static('public'));

// Endpoint untuk menambah data
app.use(express.json());
app.post('/api/data', (req, res) => {
  const { value } = req.body;
  
  if (typeof value !== 'number') {
    return res.status(400).json({ error: 'Value must be a number' });
  }
  
  // Simpan data ke database
  const sql = 'INSERT INTO chart_data (value) VALUES (?)';
  db.run(sql, [value], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Kirim response
    res.json({ id: this.lastID, value, timestamp: new Date() });
    
    // Kirim update ke semua client yang terhubung
    broadcastDataUpdate({ id: this.lastID, value, timestamp: new Date() });
  });
});

// Endpoint untuk mendapatkan semua data
app.get('/api/data', (req, res) => {
  const sql = 'SELECT * FROM chart_data ORDER BY timestamp ASC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Endpoint untuk menghapus semua data
app.delete('/api/data', (req, res) => {
  const sql = 'DELETE FROM chart_data';
  db.run(sql, [], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({ message: 'All data cleared' });
    
    // Kirim update ke semua client bahwa data telah dihapus
    const message = JSON.stringify({ type: 'dataCleared' });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

// Fungsi untuk broadcast update ke semua client WebSocket
function broadcastDataUpdate(data) {
  const message = JSON.stringify({ type: 'dataUpdate', data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Koneksi WebSocket
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Kirim data awal ketika client terhubung
  const sql = 'SELECT * FROM chart_data ORDER BY timestamp ASC';
  db.all(sql, [], (err, rows) => {
    if (!err) {
      ws.send(JSON.stringify({ type: 'initialData', data: rows }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Mulai server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});