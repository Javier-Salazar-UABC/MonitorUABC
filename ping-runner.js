// ping-runner.js
// -----------------------------------------------------------------------------------
// Script de Monitoreo en Segundo Plano para MonitorUABC
// -----------------------------------------------------------------------------------
// Este script está diseñado para ejecutarse en entornos Node.js (v18 o superior).
// Realiza los mismos escaneos y cálculos matemáticos de uptime que el cliente web,
// sincronizando directamente con tu base de datos de Firebase Firestore en la nube.
//
// Puede ejecutarse 24/7 de forma completamente gratuita usando GitHub Actions.

const fs = require('fs');
const path = require('path');

// 1. Cargar la configuración de Firebase desde firebase-config.js
const configPath = path.join(__dirname, 'firebase-config.js');
let firebaseConfig;

try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    // Evaluamos el archivo para extraer la variable global firebaseConfig
    eval(configContent);
} catch (e) {
    console.error("❌ Error al leer 'firebase-config.js':", e);
    process.exit(1);
}

if (!firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.error("❌ Error: Firebase no está configurado. Por favor, edita 'firebase-config.js'.");
    process.exit(1);
}

// Cargar SDK de Firebase (Compatibilidad en Node.js)
// Primero intentamos importar de forma estándar
let firebase;
try {
    firebase = require('firebase/compat/app');
    require('firebase/compat/firestore');
} catch (e) {
    console.error("❌ Error: No se encontró el módulo 'firebase'. Ejecuta: npm install firebase");
    process.exit(1);
}

// 2. Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 3. Cargar servicios desde services.json
const servicesPath = path.join(__dirname, 'services.json');
let uabcServices = [];
try {
    uabcServices = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
} catch (e) {
    console.error("❌ Error al cargar 'services.json':", e);
    process.exit(1);
}

const MAX_HISTORY_POINTS = 30;

// Función para realizar ping usando el fetch nativo de Node.js (disponible desde v18+)
async function pingUrl(url) {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout

        // Intentamos realizar fetch. Usamos cabecera de User-Agent personalizada
        await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'MonitorUABC-BackgroundBot/1.0' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        return { status: latency > 3000 ? 'slow' : 'online', latency };
    } catch (error) {
        // En Node.js, fallos de DNS o timeouts caerán aquí
        return { status: 'offline', latency: 0 };
    }
}

// Función matemática idéntica para calcular e integrar estadísticas
async function logServiceStatus(service, status, latency) {
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

    const elapsed = now - lastCheckedTime;
    
    // Si la última verificación fue hace más de 15 minutos, consideramos un intervalo estándar de 5 minutos
    const maxInterval = 15 * 60 * 1000; 
    const actualElapsed = (elapsed > maxInterval || elapsed <= 0) ? 5 * 60 * 1000 : elapsed;

    // Acumular tiempo total
    service.totalTime = (service.totalTime || 0) + actualElapsed;

    // Si el estado anterior fue 'offline', acumulamos el downtime
    if (service.lastStatus === 'offline') {
        service.downTime = (service.downTime || 0) + actualElapsed;
    }

    // Calcular Uptime real:
    // Uptime % = ((Tiempo Total - Tiempo de Inactividad) / Tiempo Total) * 100
    const total = service.totalTime;
    const down = service.downTime;
    const uptimePercent = total > 0 ? ((total - down) / total) * 100 : 100;
    
    service.uptime = uptimePercent.toFixed(2) + "%";

    // Agregar registro al historial de la gráfica
    const newRecord = {
        timestamp: new Date().toISOString(),
        latency: latency,
        status: status
    };

    if (!service.history) service.history = [];
    service.history.push(newRecord);

    if (service.history.length > MAX_HISTORY_POINTS) {
        service.history.shift();
    }

    service.lastStatus = status;
    service.lastChecked = firebase.firestore.Timestamp.now();

    // Guardar actualización en la base de datos de Firebase
    await db.collection('services').doc(service.id).update({
        uptime: service.uptime,
        totalTime: service.totalTime,
        downTime: service.downTime,
        lastChecked: service.lastChecked,
        lastStatus: service.lastStatus,
        history: service.history
    });
}

async function run() {
    console.log("🚀 MonitorUABC: Iniciando escaneo de servicios en segundo plano...");
    
    // Obtener los datos actuales de la base de datos
    const snapshot = await db.collection('services').get();
    const dbServices = {};
    snapshot.forEach(doc => {
        dbServices[doc.id] = doc.data();
    });

    for (let service of uabcServices) {
        console.log(`\n🔍 Verificando ${service.name} (${service.url})...`);
        
        // Sincronizar estado en memoria con lo guardado en Firestore
        if (dbServices[service.id]) {
            service.uptime = dbServices[service.id].uptime || "100.00%";
            service.totalTime = dbServices[service.id].totalTime || 0;
            service.downTime = dbServices[service.id].downTime || 0;
            service.lastChecked = dbServices[service.id].lastChecked;
            service.lastStatus = dbServices[service.id].lastStatus || 'online';
            service.history = dbServices[service.id].history || [];
        } else {
            // Inicialización por primera vez en la BD si no existe el documento
            service.uptime = "100.00%";
            service.totalTime = 0;
            service.downTime = 0;
            service.lastChecked = firebase.firestore.Timestamp.now();
            service.lastStatus = 'online';
            service.history = [];
            
            await db.collection('services').doc(service.id).set({
                id: service.id,
                name: service.name,
                url: service.url,
                category: service.category,
                uptime: "100.00%",
                totalTime: 0,
                downTime: 0,
                lastChecked: service.lastChecked,
                lastStatus: 'online',
                history: []
            });
            console.log(`✨ Documento inicializado para ${service.id} en Firestore.`);
        }

        // Ejecutar Ping
        const { status, latency } = await pingUrl(service.url);
        console.log(`   Resultado: ${status.toUpperCase()} | Latencia: ${latency} ms`);
        
        // Registrar e integrar en la base de datos
        await logServiceStatus(service, status, latency);
    }
    
    console.log("\n✅ MonitorUABC: Escaneo completado. Base de datos Firestore sincronizada con éxito.");
    process.exit(0);
}

run().catch(err => {
    console.error("❌ Error grave en la ejecución del escaneo:", err);
    process.exit(1);
});
