// utils/notifications.ts

// ✅ Corregido el .mp3 que faltaba
const ALERT_SOUND = "https://assets.mixkit.co/active_storage/sfx/571/571-preview.mp3" 

/**
 * Solicita permiso al usuario para enviar notificaciones.
 * Debe llamarse tras una interacción del usuario (ej: click en login o botón).
 */
export async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return false;

    if (Notification.permission === "granted") return true;

    const permission = await Notification.requestPermission();
    return permission === "granted";
}

/**
 * Envía una notificación nativa del sistema operativo.
 * @param title Título de la notificación
 * @param body Cuerpo del mensaje
 * @param playSound (Opcional) Define si reproduce sonido. Por defecto es TRUE.
 * En OpsManager usalo como false para que no se mezcle con la alarma.
 */
export function sendNativeNotification(title: string, body: string, playSound: boolean = true) {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
        
        // 1. Reproducir sonido SOLO si playSound es true (Default: Sí)
        if (playSound) {
            try {
                const audio = new Audio(ALERT_SOUND);
                audio.volume = 0.6;
                audio.play().catch(() => {}); // Ignora errores de autoplay
            } catch (e) {
                // Fallo silencioso de audio
            }
        }

        // 2. Crear la notificación visual
        const notification = new Notification(title, {
            body: body,
            icon: "/favicon.ico", 
            // Ponemos silent: true nativo siempre, porque el sonido lo manejamos manualmente nosotros (arriba o en el componente)
            silent: true, 
        });

        // 3. Al hacer click, traer la ventana al frente
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}