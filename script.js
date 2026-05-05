// 1. CONFIGURACIÓN INICIAL Y DATOS
const uabcServices = [
    { id: 'portal', name: 'Portal Principal UABC', url: 'https://www.uabc.mx/', category: 'General', uptime: '99.9%' },
    { id: 'siia_alum', name: 'SIIA Alumnos', url: 'https://alumnos.uabc.mx/', category: 'Estudiantes', uptime: '99.8%' },
    { id: 'siia_emp', name: 'SIIA Empleados', url: 'https://empleados.uabc.mx/', category: 'Docentes', uptime: '99.7%' },
    { id: 'blackboard', name: 'Blackboard Learn', url: 'https://uabc.blackboard.com/', category: 'Académico', uptime: '98.5%' },
    { id: 'admisiones', name: 'Portal de Admisiones', url: 'https://admisiones.uabc.mx/', category: 'Aspirantes', uptime: '99.9%' },
    { id: 'sorteos', name: 'Sorteos UABC', url: 'https://www.sorteosuabc.mx/', category: 'General', uptime: '99.5%' },
    { id: 'correo', name: 'Correo Universitario', url: 'https://correo.uabc.edu.mx/', category: 'Comunicación', uptime: '99.9%' },
    { id: 'biblioteca', name: 'Sistema de Bibliotecas', url: 'https://bibliotecas.uabc.mx/', category: 'Académico', uptime: '99.6%' },
    { id: 'pagos', name: 'Sistema de Pagos (SUE)', url: 'https://sue.uabc.mx/', category: 'Administrativo', uptime: '99.4%' }
];

// almacenamiento del estado en memoria
let servicesState = {};
let currentChart = null; // chart.js

// 2. modo oscuro
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

    // redibujar gráfica si está abierta para adaptar colores
    if (currentChart) updateChartColors(isDark);
}

initDarkMode(); // ejecutar al cargar

// 3. renderizado de tarjetas
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
                    
                    <div class="flex items-center gap-2 mb-4">
                        <span id="badge-${service.id}" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Verificando...
                        </span>
                        <span id="latency-${service.id}" class="text-xs font-mono text-gray-400">--- ms</span>
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

// 4. lógica de monitoreo y latencia
async function checkAllServices() {
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const globalStatus = document.getElementById('globalStatus');

    refreshIcon.classList.add('spin');
    refreshBtn.disabled = true;
    renderCards();

    globalStatus.className = 'flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium';
    globalStatus.innerHTML = '<i class="ph ph-circle-notch spin text-lg"></i><span>Revisando sistemas...</span>';

    let onlineCount = 0; let offlineCount = 0; let slowCount = 0;

    const checks = uabcServices.map(service => {
        return new Promise(resolve => {
            // simulamos latencia de red entre 100ms y 2500ms
            const simulatedLatency = Math.floor(Math.random() * 2400) + 100;

            setTimeout(() => {
                const isOffline = Math.random() > 0.90; // 10% probabilidad de falla
                let status = 'online';

                if (isOffline) {
                    status = 'offline';
                    offlineCount++;
                } else if (simulatedLatency > 1200) {
                    status = 'slow';
                    slowCount++;
                    onlineCount++;
                } else {
                    status = 'online';
                    onlineCount++;
                }

                // guardamos en estado y actualizamos UI
                servicesState[service.id] = { status: status, latency: isOffline ? 0 : simulatedLatency };
                updateCardStatus(service.id, status, simulatedLatency);

                resolve();
            }, simulatedLatency);
        });
    });

    await Promise.all(checks);

    document.getElementById('lastUpdateText').innerText = `Última revisión: ${new Date().toLocaleTimeString()}`;
    refreshIcon.classList.remove('spin');
    refreshBtn.disabled = false;

    // actualizar resumen global
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

function updateCardStatus(id, status, latency) {
    const iconDiv = document.getElementById(`icon-${id}`);
    const badge = document.getElementById(`badge-${id}`);
    const latencyText = document.getElementById(`latency-${id}`);
    const card = document.getElementById(`card-${id}`);

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

// 5. ventana modal y gráficas
const modal = document.getElementById('serviceModal');
const modalInner = modal.querySelector('div');

function openModal(serviceId) {
    const service = uabcServices.find(s => s.id === serviceId);
    const state = servicesState[serviceId];

    document.getElementById('modalTitle').innerText = service.name;
    document.getElementById('modalUrl').innerText = service.url;
    document.getElementById('modalUrl').href = service.url;
    document.getElementById('modalUptime').innerText = service.uptime;
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

    // dibujar gráfica
    renderChart(service.name);

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

function renderChart(serviceName) {
    const ctx = document.getElementById('latencyChart').getContext('2d');
    if (currentChart) currentChart.destroy();

    // generar 24 puntos de datos 
    const labels = Array.from({ length: 24 }, (_, i) => `${24 - i}h`).reverse();
    const data = Array.from({ length: 24 }, () => Math.floor(Math.random() * 800) + 100);
    data[12] = 2500; data[13] = 1800;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Latencia (ms) - ${serviceName}`,
                data: data,
                borderColor: '#007236',
                backgroundColor: 'rgba(0, 114, 54, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#F2A900',
                pointRadius: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 8 }
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

// buscador
function filterServices() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.display = card.dataset.name.includes(term) ? 'flex' : 'none';
    });
}

// iniciar al cargar
window.onload = checkAllServices;