"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
    Search, BookOpen, MessageCircle, ShieldAlert, Zap, 
    CheckCircle2, BrainCircuit, AlertTriangle, Fingerprint 
} from "lucide-react"

// TUS DATOS CARGADOS Y ESTRUCTURADOS
const WIKI_DATA = [
    {
        category: "Guión Operativo (Paso a Paso)",
        icon: <Fingerprint className="h-5 w-5 text-blue-500"/>,
        items: [
            { 
                title: "FASE 1: La Apertura", 
                tag: "Contacto",
                content: `(Tono: Tranquilo, informativo. No vender todavía).
                
VENDEDORA: "¿Qué tal? Te llamo brevemente del área de Auditoría de Salud. ¿Con quién tengo el gusto?"
(Esperar respuesta y ANOTAR NOMBRE)

"Bien [NOMBRE]. Estamos contactando a la gente de la zona porque hubo actualizaciones en las coberturas y muchos están pagando de más o tienen planes desactualizados. Te hago una consulta rápida para ver si te aplica el beneficio: ¿Vos hoy tenés alguna prepaga o estás usando obra social?"`
            },
            { 
                title: "FASE 2: El Filtro de Calidad", 
                tag: "Clasificación",
                content: `(Si dice que tiene cobertura, NO VENDER. Primero calificar).

1. SITUACIÓN LABORAL: "¿Vos estás trabajando en relación de dependencia, monotributista o particular?"
⚠️ SI DICE NEGRO/PARTICULAR: "Al no tener recibo, el plan sería 100% particular. Arranca aprox en $XXX. ¿Está en tu presupuesto?" (Si dice NO -> Fin).

2. EDAD: "¿Qué edad tienen vos y tu grupo familiar?" (Ojo con mayores de 60).

3. DOLOR: "¿Y hoy qué es lo que más te molesta? ¿El precio o que tardan mucho en darte turnos?"` 
            },
            { 
                title: "FASE 3: El Diagnóstico", 
                tag: "Dolor",
                content: `OPCIÓN A (Le duele el Bolsillo 💰):
"Te entiendo. Hoy las prepagas aumentaron una locura. El tema es que la mayoría no sabe que usando los aportes de tu recibo, podés cubrir casi el 100% de la cuota. Estás dejando plata en la mesa."

OPCIÓN B (Le duele el Servicio 🏥):
"Es terrible. Uno paga para estar tranquilo y espera meses. Justamente por eso migramos gente a [Marca], porque al tener cartilla abierta, conseguís turno en la misma semana."` 
            },
            { 
                title: "FASE 4: La Propuesta", 
                tag: "Gancho",
                content: `"Mirá [NOMBRE], basado en tu edad y aportes, tengo una opción excelente con [NOMBRE PREPAGA].
Te cubre:
- [Beneficio 1: Ej. Internación 100%]
- [Beneficio 2: Ej. Odontología]

Y lo mejor: haciendo el cruce de aportes, te quedaría en $[PRECIO FINAL] final por mes.
¿Cómo te suena ese número comparado con lo que pagás hoy?"` 
            },
            { 
                title: "FASE 5: El Cierre", 
                tag: "Documentación",
                content: `(Si dice "Me interesa").
"Genial. Para congelarte estas condiciones y que no te agarre el aumento, tenemos que ingresar la solicitud hoy. Es un trámite interno simple.
Necesito que me mandes por WhatsApp foto de DNI y último recibo de sueldo para verificar aportes.
¿Tenés el recibo a mano o lo tenés que descargar?"
(PEDIR WHATSAPP Y MANDAR MENSAJE YA).` 
            }
        ]
    },
    {
        category: "Manejo de Objeciones (Escudo)",
        icon: <ShieldAlert className="h-5 w-5 text-red-500"/>,
        items: [
            { title: "Está muy caro / No llego", content: `"Te entiendo, hay que cuidar el bolsillo. Justamente por eso te llamo. ¿Vos sabés exactamente cuánto estás aportando hoy a tu obra social que quizás no usás? Vamos a hacer la cuenta sin compromiso para ver la diferencia real."` },
            { title: "Tengo Obra Social y es gratis", content: `"Claro, está buenísimo tenerla. El tema es que están colapsadas (turnos a 3 meses). No queremos que la reemplaces, sino que uses esos aportes para acceder a sanatorios privados con turnos en 24hs. ¿Si te duele algo mañana, querés esperar 60 días o que te atiendan ya?"` },
            { title: "No conozco la marca / Quiero OSDE", content: `"Te entiendo. OSDE gasta millones en publicidad, [Marca] invierte en cartilla. ¿Conocés el Sanatorio [X]? Bueno, esta prepaga te da acceso total ahí igual que la marca cara, pero costando un 40% menos. Lo importante es el médico, no el plástico, ¿verdad?"` },
            { title: "Miedo a que aumente después", content: `"Es una duda válida. Todas aumentan por ley de Superintendencia. La diferencia es que si empezás con un plan alto, el aumento duele más. Nuestra estrategia es que entres con un precio lógico, para que los aumentos futuros sigan siendo pagables."` },
            { title: "Pasame info por WhatsApp y te aviso", content: `(DOBLE CIERRE): "¡Dale! Te lo mando ya. Pero soy sincera: los precios cambian la semana que viene. Mientras te llega el mensaje: ¿Lo que te preocupa es el precio o querés ver bien los sanatorios? (Si dice precio -> Volver a Objeción 1)."` },
            { title: "Lo tengo que charlar con mi pareja", content: `"Perfecto, son decisiones de familia. ¿Qué creés que le va a preocupar más a él/ella? ¿El precio o la pediatría? Genial, te paso la info y mañana a esta hora los llamo 5 minutos a los dos para responder esa duda. ¿Mejor a las 10 o a las 17?"` },
            { title: "Soy joven/sano, no lo uso", content: `"Toco madera para que sigas así. Pero esto es como el seguro del auto. Si mañana tenés una apendicitis, la deuda privada es impagable. Con este plan pagás tranquilidad mental por el precio de dos pizzas. ¿No vale eso tu seguridad?"` },
            { title: "Este tiene copagos, el mío no", content: `"Verdad. Pero hagamos matemática: Te ahorrás $40.000 de cuota fija. Un copago sale $3.000. Tendrías que ir al médico 13 veces al mes para que no te convenga. ¿Vas 13 veces al médico? ¡Entonces te conviene tener la plata en tu bolsillo!"` },
            { title: "Estoy hace poco en el trabajo", content: `"Es el mejor momento. Si te quedás sin trabajo, la prepaga te cubre unos meses más por ley. Además, cuanto antes ingreses, antes superás los periodos de carencia. ¿Hace cuánto entraste exactamente?"` },
            { title: "Mi médico no está en cartilla", content: `"Entiendo. Ahora, ¿a ese médico lo ves todos los meses o una vez al año? (Cliente: Una vez). Fijate esto: con lo que te ahorrás por mes, te sobra para pagarle la consulta particular una vez al año y te sigue conviniendo para todo el resto (guardias, internación). ¿Lo habías pensado?"` }
        ]
    },
    {
        category: "Tácticas 'Lo voy a Pensar'",
        icon: <BrainCircuit className="h-5 w-5 text-purple-500"/>,
        items: [
            { title: "Táctica 1: La Desactivación", content: `"Te entiendo. Pero decime la verdad para no molestarte: Generalmente es por dos razones. 1) El plan no cerró o 2) El precio se va de presupuesto. ¿En tu caso es el precio o la cartilla?" (Si confiesa precio, negociar plan más bajo).` },
            { title: "Táctica 2: Urgencia Real", content: `"Dale. Solo tené en cuenta que el precio que te pasé tiene vigencia 48hs por los aumentos de la Superintendencia. Si lo hacemos el mes que viene, entrás con precio nuevo. ¿Qué te falta saber hoy para aprovechar esta promo?"` },
            { title: "Táctica 3: El 'No Matrimonio'", content: `"Me parece genial que lo charlen. Pero ojo: Ingresar la solicitud NO es contratar. Es solo ver si la auditoría médica te acepta. Mandemos los papeles para asegurar la admisión y congelar el precio. Si después deciden que NO, damos de baja el ingreso. Pero ya te aseguraste la condición. ¿Te parece?"` }
        ]
    },
    {
        category: "Reglas de Oro del Cierre",
        icon: <Zap className="h-5 w-5 text-yellow-500"/>,
        items: [
            { title: "El Proceso de Cotización", content: `1. LLAMADO: Explicá beneficios PRIMERO.\n2. PRECIO: Decí el precio final ($150.000).\n3. SILENCIO: Cerrá la boca. Muteate. El primero que habla, pierde.` }
        ]
    }
]

export function WikiView() {
    const [search, setSearch] = useState("")

    const filteredData = WIKI_DATA.map(section => ({
        ...section,
        items: section.items.filter(item => 
            item.title.toLowerCase().includes(search.toLowerCase()) || 
            item.content.toLowerCase().includes(search.toLowerCase()) ||
            (item.tag && item.tag.toLowerCase().includes(search.toLowerCase()))
        )
    })).filter(section => section.items.length > 0)

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto text-slate-900 dark:text-slate-100 pb-20">
            <div className="mb-8">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2 tracking-tight">
                    <BookOpen className="h-7 w-7 text-blue-600" /> Wiki de Ventas GML
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">Tu manual interactivo para rebatir objeciones y cerrar más ventas.</p>
                
                <div className="relative group">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                        placeholder="Escribí acá lo que dice el cliente (ej: 'caro', 'ioma', 'pensar')..." 
                        className="pl-10 h-12 text-lg shadow-sm border-slate-200 dark:bg-[#18191A] dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-10">
                {filteredData.map((section, idx) => (
                    <div key={idx} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
                            {section.icon} {section.category}
                        </h3>
                        <div className="grid gap-4 md:grid-cols-1">
                            {section.items.map((item, i) => (
                                <Card key={i} className="group hover:border-blue-400 hover:shadow-md transition-all dark:bg-[#242526] dark:border-slate-700">
                                    <CardHeader className="py-3 px-5 cursor-pointer bg-slate-50/50 dark:bg-slate-900/50 rounded-t-lg">
                                        <CardTitle className="text-base font-bold flex justify-between items-center text-slate-800 dark:text-slate-100">
                                            {item.title}
                                            {item.tag && <Badge variant="secondary" className="bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shadow-sm">{item.tag}</Badge>}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5 pt-4 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                        {/* Renderizamos el contenido respetando saltos de línea */}
                                        <div className="pl-3 border-l-4 border-blue-500/30">
                                            {item.content}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            {filteredData.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
                    <p className="text-lg font-medium">No encontré nada para "{search}"</p>
                    <p className="text-sm">Probá buscando palabras clave como "precio", "marido", "obra social".</p>
                </div>
            )}
        </div>
    )
}