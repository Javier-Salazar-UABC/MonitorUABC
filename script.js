// 1. CONFIGURACIÓN INICIAL Y DATOS
let uabcServices = [];

// Almacenamiento del estado en memoria
let servicesState = {};
let currentChart = null; // Instancia de Chart.js

// Estado de la Base de Datos (Firebase / LocalStorage)
let db = null;
let isFirebaseEnabled = false;
const MAX_HISTORY_POINTS = 30; // Máximo de registros en el historial para graficar

// 2. MODO OSCURO
function initDarkMode() {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('darkModeIcon').className = 'ph ph-sun text-xl';
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('darkModeIcon').className = 'ph ph-moon text-xl';
    }
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('darkModeIcon').className = isDark ? 'ph ph-sun text-xl' : 'ph ph-moon text-xl';

    // Redibujar gráfica si está abierta para adaptar colores
    if (currentChart) updateChartColors(isDark);
}

initDarkMode(); // Ejecutar al cargar

// 3. INICIALIZACIÓN DE BASE DE DATOS Y CARGA DE DATOS
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            isFirebaseEnabled = true;
            console.log("MonitorUABC: Conectado a Firebase Firestore.");
        } else {
            console.log("MonitorUABC: Firebase no configurado. Iniciando en Modo Local (Demo) con LocalStorage.");
        }
    } catch (error) {
        console.error("MonitorUABC: Error al inicializar Firebase, cayendo a Modo Local:", error);
    }
    updateDbStatusUI();
}

function updateDbStatusUI() {
    const badge = document.getElementById('dbStatusBadge');
    if (!badge) return;
    
    if (isFirebaseEnabled) {
        badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50";
        badge.innerHTML = `<i class="ph ph-database text-xs"></i><span>Firebase Conectado</span>`;
    } else {
        badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-950/70 transition";
        badge.innerHTML = `<i class="ph ph-laptop text-xs"></i><span>Modo Local (Demo)</span>`;
        badge.title = "Los datos se guardan de forma local en tu navegador. Haz clic para saber cómo conectar Firebase.";
        
        badge.onclick = () => {
            alert("¡Monitor UABC está en Modo Local (Demo)!\n\nLos cálculos de Uptime % y el historial de Latencia Real se están guardando localmente en este navegador (LocalStorage).\n\nPara hacerlo persistente y multiusuario:\n1. Abre el archivo 'firebase-config.js'.\n2. Introduce las credenciales de tu base de datos de Firebase.\n3. Habilita Cloud Firestore en tu consola.");
        };
    }
}

async function syncServicesWithDatabase() {
    if (isFirebaseEnabled) {
        try {
            const snapshot = await db.collection('services').get();
            const dbServices = {};
            snapshot.forEach(doc => {
                dbServices[doc.id] = doc.data();
            });

            for (let service of uabcServices) {
                if (dbServices[service.id]) {
                    // Cargar datos reales de la BD a la memoria
                    service.uptime = dbServices[service.id].uptime || "100.00%";
                    service.totalTime = dbServices[service.id].totalTime || 0;
                    service.downTime = dbServices[service.id].downTime || 0;
                    service.lastChecked = dbServices[service.id].lastChecked;
                    service.lastStatus = dbServices[service.id].lastStatus || 'online';
                    service.history = dbServices[service.id].history || [];
                } else {
                    // Inicializar el documento en Firestore si no existe (autoseeding)
                    const initialData = {
                        id: service.id,
                        name: service.name,
                        url: service.url,
                        category: service.category,
                        uptime: "100.00%",
                        totalTime: 0,
                        downTime: 0,
                        lastChecked: firebase.firestore.Timestamp.now(),
                        lastStatus: 'online',
                        history: []
                    };
                    await db.collection('services').doc(service.id).set(initialData);
                    
                    service.uptime = "100.00%";
                    service.totalTime = 0;
                    service.downTime = 0;
                    service.lastChecked = initialData.lastChecked;
                    service.lastStatus = 'online';
                    service.history = [];
                }
            }
        } catch (e) {
            console.error("Error sincronizando Firestore, usando local:", e);
            fallbackToLocalStorage();
        }
    } else {
        fallbackToLocalStorage();
    }
}

function fallbackToLocalStorage() {
    let localData = localStorage.getItem('monitor_uabc_services');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            uabcServices.forEach(service => {
                if (parsed[service.id]) {
                    service.uptime = parsed[service.id].uptime || "100.00%";
                    service.totalTime = parsed[service.id].totalTime || 0;
                    service.downTime = parsed[service.id].downTime || 0;
                    service.lastChecked = parsed[service.id].lastChecked;
                    service.lastStatus = parsed[service.id].lastStatus || 'online';
                    service.history = parsed[service.id].history || [];
                } else {
                    service.uptime = "100.00%";
                    service.totalTime = 0;
                    service.downTime = 0;
                    service.lastChecked = new Date().toISOString();
                    service.lastStatus = 'online';
                    service.history = [];
                }
            });
        } catch (e) {
            console.error("Error al parsear LocalStorage:", e);
        }
    } else {
        // Inicializar por defecto
        uabcServices.forEach(service => {
            service.uptime = "100.00%";
            service.totalTime = 0;
            service.downTime = 0;
            service.lastChecked = new Date().toISOString();
            service.lastStatus = 'online';
            service.history = [];
        });
    }
}

async function loadServicesData() {
    try {
        const response = await fetch('services.json');
        if (!response.ok) throw new Error('No se pudo cargar el archivo de servicios');
        uabcServices = await response.json();
        
        initFirebase();
        await syncServicesWithDatabase();
    } catch (error) {
        console.error('Error cargando servicios:', error);
        const globalStatus = document.getElementById('globalStatus');
        globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-100 text-red-600 font-medium';
        globalStatus.innerHTML = '<i class="ph ph-x-circle text-xl"></i><span>Error al cargar servicios</span>';
    }
}

// 4. RENDERIZADO DE TARJETAS
const servicesGrid = document.getElementById('servicesGrid');

function renderCards() {
    servicesGrid.innerHTML = '';
    uabcServices.forEach((service, index) => {
        const delay = index * 0.05;
        if (!servicesState[service.id]) servicesState[service.id] = { status: 'loading', latency: 0 };

        const card = `
            <div id="card-${service.id}" data-name="${service.name.toLowerCase()}" class="service-card bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition duration-300 fade-in flex flex-col justify-between" style="animation-delay: ${delay}s">
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-semibold text-gray-800 dark:text-gray-100">${service.name}</h3>
                            <p class="text-xs text-gray-400 truncate max-w-[200px]">${service.url}</p>
                        </div>
                        <div id="icon-${service.id}" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                            <i class="ph ph-circle-notch spin text-xl"></i>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <span id="badge-${service.id}" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                Verificando...
                            </span>
                            <span id="latency-${service.id}" class="text-xs font-mono text-gray-400">--- ms</span>
                        </div>
                        <span id="card-uptime-${service.id}" class="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-600">Uptime: ${service.uptime || '100.00%'}</span>
                    </div>
                </div>
                
                <button onclick="openModal('${service.id}')" class="w-full py-2 mt-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg transition border border-gray-200 dark:border-gray-600 flex justify-center items-center gap-2">
                    <i class="ph ph-chart-bar"></i> Ver Detalles
                </button>
            </div>
        `;
        servicesGrid.insertAdjacentHTML('beforeend', card);
    });
}

// 5. LÓGICA DE MONITOREO Y LATENCIA (LECTURA DESDE LA BASE DE DATOS)
async function checkAllServices(isInitial = false) {
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const globalStatus = document.getElementById('globalStatus');

    if (refreshIcon) refreshIcon.classList.add('spin');
    if (refreshBtn) refreshBtn.disabled = true;
    
    if (globalStatus) {
        globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium';
        globalStatus.innerHTML = '<i class="ph ph-circle-notch spin text-lg"></i><span>Sincronizando con base de datos...</span>';
    }

    try {
        // En lugar de hacer pings desde el navegador (lo cual falla por CORS y Contenido Mixto HTTPS/HTTP),
        // descargamos los últimos estados reales del bot en la nube de GitHub Actions.
        await loadServicesData();
        
        // Renderizar los estados directamente
        updateUIFromLoadedData();
        
    } catch (error) {
        console.error("Error al sincronizar servicios:", error);
    } finally {
        // Simular un pequeño delay de carga premium
        setTimeout(() => {
            if (refreshIcon) refreshIcon.classList.remove('spin');
            if (refreshBtn) refreshBtn.disabled = false;
        }, 800);
    }
}

async function logServiceStatus(serviceId, status, latency) {
    const service = uabcServices.find(s => s.id === serviceId);
    if (!service) return;

    const now = Date.now();
    
    // Obtener tiempo del último check
    let lastCheckedTime = now;
    if (service.lastChecked) {
        if (typeof service.lastChecked.toDate === 'function') {
            lastCheckedTime = service.lastChecked.toDate().getTime();
        } else {
            lastCheckedTime = new Date(service.lastChecked).getTime();
        }
    }

    // Calcular el tiempo transcurrido en milisegundos
    const elapsed = now - lastCheckedTime;
    
    // Evitamos distorsionar el uptime por inactividad prolongada (por ejemplo, si el monitor estuvo cerrado horas).
    // Si la última verificación fue hace más de 15 minutos, consideramos un intervalo estándar de 5 minutos (300,000 ms).
    const maxInterval = 15 * 60 * 1000; 
    const actualElapsed = (elapsed > maxInterval || elapsed <= 0) ? 5 * 60 * 1000 : elapsed;

    // Acumular tiempo total
    service.totalTime = (service.totalTime || 0) + actualElapsed;

    // Si el estado anterior fue 'offline', acumulamos el tiempo en inactividad (downtime)
    if (service.lastStatus === 'offline') {
        service.downTime = (service.downTime || 0) + actualElapsed;
    }

    // Calcular Uptime real con la fórmula:
    // Uptime % = ((Tiempo Total - Tiempo de Inactividad) / Tiempo Total) * 100
    const total = service.totalTime;
    const down = service.downTime;
    const uptimePercent = total > 0 ? ((total - down) / total) * 100 : 100;
    
    // Formatear porcentaje con 2 decimales
    service.uptime = uptimePercent.toFixed(2) + "%";

    // Agregar registro al historial de latencia
    const newRecord = {
        timestamp: new Date().toISOString(),
        latency: latency,
        status: status
    };

    if (!service.history) service.history = [];
    service.history.push(newRecord);

    // Limitar el historial de la gráfica para no sobrecargar el documento
    if (service.history.length > MAX_HISTORY_POINTS) {
        service.history.shift();
    }

    // Actualizar datos del último estado
    service.lastStatus = status;
    
    if (isFirebaseEnabled) {
        service.lastChecked = firebase.firestore.Timestamp.now();
        try {
            await db.collection('services').doc(service.id).update({
                uptime: service.uptime,
                totalTime: service.totalTime,
                downTime: service.downTime,
                lastChecked: service.lastChecked,
                lastStatus: service.lastStatus,
                history: service.history
            });
        } catch (e) {
            console.error(`Error guardando en Firestore para ${serviceId}:`, e);
        }
    } else {
        service.lastChecked = new Date().toISOString();
        saveAllToLocalStorage();
    }
}

function saveAllToLocalStorage() {
    const dataToSave = {};
    uabcServices.forEach(s => {
        dataToSave[s.id] = {
            uptime: s.uptime,
            totalTime: s.totalTime,
            downTime: s.downTime,
            lastChecked: s.lastChecked,
            lastStatus: s.lastStatus,
            history: s.history
        };
    });
    localStorage.setItem('monitor_uabc_services', JSON.stringify(dataToSave));
}

function updateCardStatus(id, status, latency) {
    const iconDiv = document.getElementById(`icon-${id}`);
    const badge = document.getElementById(`badge-${id}`);
    const latencyText = document.getElementById(`latency-${id}`);
    const card = document.getElementById(`card-${id}`);
    const uptimeText = document.getElementById(`card-uptime-${id}`);

    const service = uabcServices.find(s => s.id === id);
    if (uptimeText && service) {
        uptimeText.innerText = `Uptime: ${service.uptime || '100.00%'}`;
    }

    if (status === 'online') {
        iconDiv.className = 'w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-uabc-green dark:text-green-400';
        iconDiv.innerHTML = '<i class="ph ph-check-circle text-2xl"></i>';
        badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/40 text-uabc-green dark:text-green-400';
        badge.innerHTML = 'En línea';
        latencyText.innerText = `${latency} ms`;
        latencyText.className = 'text-xs font-mono text-green-600 dark:text-green-400';
        card.className = card.className.replace(/border-gray-100|border-red-200|border-yellow-300|dark:border-gray-700/, 'border-green-200 dark:border-green-800');
    } else if (status === 'slow') {
        iconDiv.className = 'w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center text-yellow-600 dark:text-yellow-400';
        iconDiv.innerHTML = '<i class="ph ph-warning text-2xl"></i>';
        badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
        badge.innerHTML = 'Degradado';
        latencyText.innerText = `${latency} ms`;
        latencyText.className = 'text-xs font-mono text-yellow-600 dark:text-yellow-400 font-bold';
        card.className = card.className.replace(/border-gray-100|border-green-200|border-red-200|dark:border-gray-700/, 'border-yellow-300 dark:border-yellow-700');
    } else {
        iconDiv.className = 'w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-500 dark:text-red-400';
        iconDiv.innerHTML = '<i class="ph ph-x-circle text-2xl"></i>';
        badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
        badge.innerHTML = 'Fuera de línea';
        latencyText.innerText = `Timeout`;
        latencyText.className = 'text-xs font-mono text-red-500';
        card.className = card.className.replace(/border-gray-100|border-green-200|border-yellow-300|dark:border-gray-700/, 'border-red-300 dark:border-red-800');
    }
}

// 6. VENTANA MODAL Y GRÁFICAS
const modal = document.getElementById('serviceModal');
const modalInner = modal.querySelector('div');

function openModal(serviceId) {
    const service = uabcServices.find(s => s.id === serviceId);
    const state = servicesState[serviceId];

    document.getElementById('modalTitle').innerText = service.name;
    document.getElementById('modalUrl').innerText = service.url;
    document.getElementById('modalUrl').href = service.url;
    document.getElementById('modalUptime').innerText = service.uptime || "100.00%";
    document.getElementById('modalLatency').innerText = state.latency > 0 ? `${state.latency} ms` : 'N/A';

    const statusBadge = document.getElementById('modalStatusBadge');
    const modalIcon = document.getElementById('modalIcon');

    if (state.status === 'online') {
        statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 bg-green-100 dark:bg-green-900/40 text-uabc-green dark:text-green-400';
        statusBadge.innerText = 'Operando Normal';
        modalIcon.className = 'w-10 h-10 rounded-full flex items-center justify-center text-xl bg-green-100 text-uabc-green dark:bg-green-900/40 dark:text-green-400';
        modalIcon.innerHTML = '<i class="ph ph-check-circle"></i>';
    } else if (state.status === 'slow') {
        statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
        statusBadge.innerText = 'Lento / Degradado';
        modalIcon.className = 'w-10 h-10 rounded-full flex items-center justify-center text-xl bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400';
        modalIcon.innerHTML = '<i class="ph ph-warning"></i>';
    } else {
        statusBadge.className = 'inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
        statusBadge.innerText = 'Fuera de Línea';
        modalIcon.className = 'w-10 h-10 rounded-full flex items-center justify-center text-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400';
        modalIcon.innerHTML = '<i class="ph ph-x-circle"></i>';
    }

    // Dibujar gráfica con historial real
    renderChart(service.id);

    modal.classList.add('modal-active');
    setTimeout(() => {
        modal.classList.add('modal-show');
        modalInner.classList.add('modal-scale');
    }, 10);
}

function closeModal() {
    modal.classList.remove('modal-show');
    modalInner.classList.remove('modal-scale');
    setTimeout(() => modal.classList.remove('modal-active'), 300);
}

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

function renderChart(serviceId) {
    const service = uabcServices.find(s => s.id === serviceId);
    const ctx = document.getElementById('latencyChart').getContext('2d');
    if (currentChart) currentChart.destroy();

    let labels = [];
    let data = [];

    if (service.history && service.history.length > 0) {
        // Ordenar historial cronológicamente por seguridad
        const sortedHistory = [...service.history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        labels = sortedHistory.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        data = sortedHistory.map(item => item.latency);
    } else {
        // Fallback si no hay historial aún
        labels = ['Sin datos'];
        data = [0];
    }

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Latencia (ms)`,
                data: data,
                borderColor: '#007236',
                backgroundColor: 'rgba(0, 114, 54, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#F2A900',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Latencia: ${context.parsed.y} ms`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Latencia (ms)',
                        color: textColor,
                        font: { size: 10, weight: 'bold' }
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 10 }
                }
            }
        }
    });
}

function updateChartColors(isDark) {
    if (!currentChart) return;
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    currentChart.options.scales.y.grid.color = gridColor;
    currentChart.options.scales.y.ticks.color = textColor;
    currentChart.options.scales.x.ticks.color = textColor;
    currentChart.update();
}

// 7. BUSCADOR
function filterServices() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.display = card.dataset.name.includes(term) ? 'flex' : 'none';
    });
}

// Recalcular y actualizar el banner de estado global
function recalculateGlobalStatus() {
    let onlineCount = 0; let offlineCount = 0; let slowCount = 0;
    uabcServices.forEach(service => {
        const state = servicesState[service.id] || { status: 'online' };
        if (state.status === 'offline') {
            offlineCount++;
        } else if (state.status === 'slow') {
            slowCount++;
            onlineCount++;
        } else {
            onlineCount++;
        }
    });

    const globalStatus = document.getElementById('globalStatus');
    if (globalStatus) {
        if (offlineCount > 0) {
            globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium animate-pulse';
            globalStatus.innerHTML = `<i class="ph ph-warning-circle text-xl"></i><span>${offlineCount} sistema(s) caídos</span>`;
        } else if (slowCount > 0) {
            globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium';
            globalStatus.innerHTML = `<i class="ph ph-warning text-xl"></i><span>${slowCount} sistema(s) lentos</span>`;
        } else {
            globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-100 dark:bg-green-900/30 text-uabc-green dark:text-green-400 font-medium';
            globalStatus.innerHTML = '<i class="ph ph-check-circle text-xl"></i><span>Sistemas operando al 100%</span>';
        }
    }
}

// Actualizar la interfaz directamente con los datos cargados desde la BD sin hacer pings ni escrituras
function updateUIFromLoadedData() {
    renderCards();
    
    let onlineCount = 0; let offlineCount = 0; let slowCount = 0;
    
    uabcServices.forEach(service => {
        const status = service.lastStatus || 'online';
        const latency = (service.history && service.history.length > 0)
            ? service.history[service.history.length - 1].latency
            : 0;
            
        if (status === 'offline') {
            offlineCount++;
            
            // MECANISMO DE AUTOCORRECCIÓN (Self-Healing):
            // Si la base de datos dice que está caído (porque el bot en la nube de GitHub Actions fue bloqueado por IP),
            // el navegador del estudiante (que usa IP residencial sin bloqueo) hace una prueba silenciosa.
            // Si responde correctamente, corrige el estado en Firestore y la interfaz de inmediato.
            setTimeout(async () => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
                    const startCheck = performance.now();
                    
                    await fetch(service.url, {
                        mode: 'no-cors',
                        signal: controller.signal,
                        cache: 'no-cache'
                    });
                    
                    clearTimeout(timeoutId);
                    const clientLatency = Math.round(performance.now() - startCheck);
                    const finalStatus = clientLatency > 3000 ? 'slow' : 'online';
                    
                    console.log(`✨ Autocorrección Visual: ${service.name} estaba marcado como caído por el bot, pero está en línea para el cliente. Corrigiendo localmente...`);
                    
                    // Actualizar estado únicamente en la interfaz del cliente (sin escribir a Firestore para proteger la BD)
                    servicesState[service.id] = { status: finalStatus, latency: clientLatency };
                    updateCardStatus(service.id, finalStatus, clientLatency);
                    
                    // Actualizar el banner global
                    recalculateGlobalStatus();
                } catch (err) {
                    // Si falla de verdad, se queda como offline
                }
            }, 500 + Math.random() * 1500); // Escalado aleatorio para evitar ráfagas
            
        } else if (status === 'slow') {
            slowCount++;
            onlineCount++;
        } else {
            onlineCount++;
        }
        
        servicesState[service.id] = { status: status, latency: latency };
        updateCardStatus(service.id, status, latency);
    });
    
    // Obtener la fecha del último escaneo
    let latestChecked = new Date();
    if (uabcServices[0] && uabcServices[0].lastChecked) {
        const dateVal = uabcServices[0].lastChecked;
        if (typeof dateVal.toDate === 'function') {
            latestChecked = dateVal.toDate();
        } else {
            latestChecked = new Date(dateVal);
        }
    }
    
    document.getElementById('lastUpdateText').innerText = `Última revisión: ${latestChecked.toLocaleTimeString()}`;
    recalculateGlobalStatus();
}

// Iniciar al cargar
window.onload = async () => {
    await loadServicesData();
    if (uabcServices.length > 0) {
        updateUIFromLoadedData(); // Renderizar estados directamente de la base de datos sin disparar pings
        
        // Auto-actualizar cada 10 minutos en segundo plano mientras la pestaña esté abierta
        setInterval(() => {
            checkAllServices(false);
        }, 10 * 60 * 1000);
    }
};