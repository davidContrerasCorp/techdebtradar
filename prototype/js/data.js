/*
 * TechDebtRadar — datos SIMULADOS del prototipo (Hito 2)
 * ---------------------------------------------------------------
 * IMPORTANTE: todo el contenido de este archivo fue escrito a mano por el
 * equipo como ejemplo ilustrativo, siguiendo los bocetos de papel del
 * Hito 1. Ningún dato proviene de analizar un repositorio real ni de una
 * llamada real a un modelo de lenguaje. Ver la Sección 6.7 ("Prototipo:
 * qué es navegable, qué es simulado y qué está implementado") del
 * documento del Hito 2 para la explicación completa de este límite.
 *
 * Solo el repositorio de demostración "mi-proyecto" tiene datos de
 * ejemplo completos (replica fielmente el Boceto 2 y el Boceto 3 del
 * prototipo de papel del Hito 1). Los otros dos repositorios listados en
 * "Análisis recientes" existen únicamente para mostrar cómo se vería el
 * historial; al hacer clic en ellos, la interfaz lo indica explícitamente
 * en lugar de simular un resultado inventado.
 */

const DEMO_REPO_URL = "github.com/miequipo/mi-proyecto";
const DEMO_REPO_KEY = "mi-proyecto";

const RECENT_ANALYSES = [
  { key: "mi-proyecto", nombre: "mi-proyecto", hace: "Hace 2 días", nivel: "ALTA", disponible: true },
  { key: "api-pagos", nombre: "api-pagos", hace: "Hace 5 días", nivel: "MEDIA", disponible: false },
  { key: "landing-page", nombre: "landing-page", hace: "Hace 1 semana", nivel: "BAJA", disponible: false },
];

// Hallazgos del repositorio de demostración "mi-proyecto" (datos simulados)
const FINDINGS = [
  {
    id: 1,
    archivo: "PaymentService.java",
    score: 9.2,
    nivel: "ALTA",
    resumen: "Clase enorme, mezcla lógica de cobro y de envío de correos.",
    explicacion:
      "Esta clase concentra el cobro, el envío de correos y el registro de auditoría. " +
      "Cualquier cambio en un correo obliga a volver a probar todo el flujo de pago, " +
      "lo que la hace de alto riesgo para el equipo.",
    sugerencia:
      "Separar en PaymentService, NotificationService y AuditLogger (patrón Single Responsibility).",
    metricas: { cc: 9.4, satd: 2, dup: "18%" },
    codigo:
`// Fragmento de ejemplo (dato simulado) — PaymentService.java
public class PaymentService {
    public void charge(Order order) {
        validate(order);
        chargeCard(order);
        sendConfirmationEmail(order);   // responsabilidad distinta
        logAuditEntry(order);           // responsabilidad distinta
        notifyWarehouse(order);
    }
    // ... 420 líneas más, 6 responsabilidades mezcladas ...
}`,
  },
  {
    id: 2,
    archivo: "utils/helpers.py",
    score: 7.8,
    nivel: "MEDIA",
    resumen: "8 TODOs sin resolver hace más de 6 meses.",
    explicacion:
      "Este archivo acumula 8 comentarios TODO/FIXME sobre validaciones pendientes y casos " +
      "borde no manejados, varios de ellos con más de medio año de antigüedad. Es un punto " +
      "donde el equipo ya sabía de problemas pero los fue posponiendo.",
    sugerencia:
      "Convertir cada TODO en una tarea rastreada (issue) con dueño y fecha, o resolverlo " +
      "directamente si es de bajo esfuerzo; no dejar deuda auto-admitida sin seguimiento.",
    metricas: { cc: 4.1, satd: 8, dup: "4%" },
    codigo:
`# Fragmento de ejemplo (dato simulado) — utils/helpers.py
def parse_input(data):
    # TODO: manejar el caso cuando data es None (visto hace 7 meses)
    # TODO: validar encoding UTF-8 explícitamente
    return data.strip().lower()`,
  },
  {
    id: 3,
    archivo: "OrderController.java",
    score: 6.1,
    nivel: "MEDIA",
    resumen: "Método con 140 líneas y 6 niveles de anidación.",
    explicacion:
      "El método principal de este controlador tiene 140 líneas con hasta 6 niveles de " +
      "if/else anidados, lo que dificulta seguir la lógica de negocio y aumenta la " +
      "probabilidad de introducir errores al modificarlo.",
    sugerencia:
      "Extraer las validaciones anidadas a métodos con nombres descriptivos y aplicar " +
      "cláusulas de guarda (early return) para aplanar la estructura.",
    metricas: { cc: 14.2, satd: 0, dup: "2%" },
    codigo:
`// Fragmento de ejemplo (dato simulado) — OrderController.java
public Response create(Order o) {
    if (o != null) {
        if (o.getItems() != null) {
            if (!o.getItems().isEmpty()) {
                if (o.getCustomer() != null) {
                    if (o.getCustomer().isActive()) {
                        if (stockAvailable(o)) {
                            // ... lógica real, 6 niveles adentro ...
                        }
                    }
                }
            }
        }
    }
}`,
  },
  {
    id: 4,
    archivo: "auth/login.js",
    score: 3.0,
    nivel: "BAJA",
    resumen: "Duplica validación que ya existe en middleware.",
    explicacion:
      "La validación de formato de correo en este archivo repite, casi línea por línea, " +
      "una validación que ya existe en el middleware de autenticación. No es grave, pero " +
      "es un duplicado fácil de eliminar y que puede divergir con el tiempo.",
    sugerencia:
      "Reemplazar la validación local por una llamada a la función ya existente en " +
      "middleware/validateEmail.js.",
    metricas: { cc: 2.3, satd: 0, dup: "31%" },
    codigo:
`// Fragmento de ejemplo (dato simulado) — auth/login.js
function isValidEmail(email) {
  // Misma expresión regular que middleware/validateEmail.js
  return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);
}`,
  },
];

function getFindingById(id) {
  return FINDINGS.find((f) => f.id === Number(id));
}
