// Koneksi WebSocket ke server
const socket = new WebSocket(`ws://localhost:${window.location.port || 3000}`);

// Inisialisasi Chart.js
let chart;
let chartData = [];

// Fungsi untuk membuat chart
function createChart(initialData = []) {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    // Konversi data dari server
    chartData = initialData.map(item => ({
        x: new Date(item.timestamp),
        y: item.value
    }));
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Data Realtime',
                data: chartData,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Waktu'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Nilai'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Fungsi untuk memperbarui tabel data
function updateDataTable(data) {
    const tbody = document.getElementById('dataTableBody');
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Tidak ada data</td></tr>';
        return;
    }
    
    // Ambil 10 data terakhir
    const recentData = data.slice(-10);
    tbody.innerHTML = '';
    
    // Tambahkan data dalam urutan terbalik (terbaru di atas)
    recentData.reverse().forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.value}</td>
            <td>${new Date(item.timestamp).toLocaleTimeString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// Fungsi untuk menambah data ke chart
function addDataToChart(data) {
    if (!chart) return;
    
    // Tambahkan data baru ke array
    chartData.push({
        x: new Date(data.timestamp),
        y: data.value
    });
    
    // Batasi jumlah data (opsional)
    if (chartData.length > 100) {
        chartData.shift();
    }
    
    // Update chart
    chart.update('none');
}

// Event listener untuk koneksi WebSocket
socket.addEventListener('open', function (event) {
    console.log('Connected to WebSocket server');
    document.getElementById('status').className = 'status connected';
    document.getElementById('status').textContent = 'Status: Connected';
});

socket.addEventListener('close', function (event) {
    console.log('Disconnected from WebSocket server');
    document.getElementById('status').className = 'status disconnected';
    document.getElementById('status').textContent = 'Status: Disconnected';
});

socket.addEventListener('error', function (event) {
    console.error('WebSocket error:', event);
    document.getElementById('status').className = 'status disconnected';
    document.getElementById('status').textContent = 'Status: Connection Error';
});

// Event listener untuk pesan dari server
socket.addEventListener('message', function (event) {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
        case 'initialData':
            // Buat chart dengan data awal
            createChart(message.data);
            updateDataTable(message.data);
            break;
        case 'dataUpdate':
            // Tambahkan data baru ke chart
            addDataToChart(message.data);
            // Update tabel data
            // Untuk update tabel, kita perlu mendapatkan semua data
            fetch('/api/data')
                .then(response => response.json())
                .then(data => updateDataTable(data));
            break;
        case 'dataCleared':
            // Reset chart dan tabel ketika data dihapus
            if (chart) {
                chartData = [];
                chart.update();
            }
            updateDataTable([]);
            break;
    }
});

// Fungsi untuk mengirim data ke server
function sendData(value) {
    fetch('/api/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: parseFloat(value) })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Data added:', data);
    })
    .catch(error => {
        console.error('Error adding data:', error);
        alert('Error adding data: ' + error.message);
    });
}

// Event listener untuk tombol
document.getElementById('addDataBtn').addEventListener('click', function() {
    const valueInput = document.getElementById('dataValue');
    const value = valueInput.value;
    
    if (value && !isNaN(value)) {
        sendData(value);
        valueInput.value = '';
    } else {
        alert('Silakan masukkan nilai yang valid');
    }
});

document.getElementById('randomDataBtn').addEventListener('click', function() {
    // Generate nilai acak antara 0 dan 100
    const randomValue = Math.random() * 100;
    sendData(randomValue.toFixed(2));
});

document.getElementById('clearDataBtn').addEventListener('click', function() {
    if (confirm('Apakah Anda yakin ingin menghapus semua data?')) {
        fetch('/api/data', {
            method: 'DELETE'
        })
        .then(() => {
            // Reset chart
            if (chart) {
                chartData = [];
                chart.update();
            }
            // Reset tabel
            updateDataTable([]);
        })
        .catch(error => {
            console.error('Error clearing data:', error);
            alert('Error clearing data: ' + error.message);
        });
    }
});

// Event listener untuk input dengan Enter
document.getElementById('dataValue').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('addDataBtn').click();
    }
});