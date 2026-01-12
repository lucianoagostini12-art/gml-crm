// utils/notifications.ts

const ALERT_SOUND = "https://assets.mixkit.co/active_storage/sfx/571/571-preview.mp" // Un sonido de 'Ding' suave

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
 * Funciona aunque el navegador esté minimizado.
 */
export function sendNativeNotification(title: string, body: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
        
        // 1. Intentar reproducir sonido
        try {
            const audio = new Audio(ALERT_SOUND);
            audio.volume = 0.6;
            audio.play().catch(() => {}); // Ignora errores si el navegador bloquea el audio
        } catch (e) {
            // Fallo silencioso de audio
        }

        // 2. Crear la notificación visual
        const notification = new Notification(title, {
            body: body,
            // Si tienes un logo en public/logo.png o .ico, úsalo aquí. Si no, usa el default del navegador.
            icon: "/favicon.ico", 
            silent: true, // Ponemos true porque manejamos el sonido nosotros manualmente arriba
        });

        // 3. Al hacer click, traer la ventana al frente
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}