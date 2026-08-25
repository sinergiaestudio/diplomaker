# Estudio visual de plantillas

El Estudio visual permite crear diseños reutilizables sin modificar el código de Diplomaker.

## 1. Crear una plantilla

1. Abrir **Diseñar** desde el menú lateral o desde la pantalla de inicio.
2. Asignar un nombre y una descripción.
3. Elegir un color de fondo o cargar una imagen en PNG, JPG, WebP o SVG.
4. Agregar elementos desde el panel izquierdo.
5. Arrastrar cada elemento o usar sus coordenadas en el panel de propiedades.
6. Guardar la plantilla o elegir **Guardar y usar**.

## 2. Elementos disponibles

- **Texto:** contenido fijo; admite tokens.
- **Variable:** campo asociado a los datos del participante o del evento.
- **Imagen:** logo, sello, firma gráfica u otro recurso.
- **Línea, rectángulo y círculo:** recursos de composición.
- **Firmantes:** bloque dinámico que distribuye los firmantes cargados en cada certificado.
- **Logos:** franja que distribuye de forma simétrica las imágenes incorporadas.

## 3. Variables

Los campos variables disponibles son:

- Nombre y apellido.
- Tratamiento + nombre.
- Tratamiento.
- Tipo de certificado.
- Evento o actividad.
- Fecha.
- Texto personalizado.
- Cuerpo automático del certificado.

Los textos fijos también pueden incluir:

```text
{NOMBRE}
{TRATAMIENTO}
{NOMBRE_COMPLETO}
{TIPO_CERTIFICADO}
{EVENTO}
{FECHA}
{TEXTO}
{CUERPO}
```

## 4. Capas y edición

El panel **Capas** permite seleccionar, ocultar y bloquear elementos. La barra superior permite:

- deshacer y rehacer;
- duplicar;
- eliminar;
- enviar atrás o traer adelante;
- ajustar el zoom;
- exportar la plantilla.

Atajos:

- `Ctrl/Cmd + Z`: deshacer.
- `Ctrl/Cmd + Shift + Z`: rehacer.
- `Ctrl/Cmd + D`: duplicar.
- `Supr` o `Retroceso`: eliminar.
- Flechas: mover 1 píxel.
- `Shift + Flechas`: mover 10 píxeles.
- `Alt` durante el arrastre: desactivar el ajuste a la grilla.

## 5. Guardado y portabilidad

Las plantillas se almacenan en IndexedDB. Para trasladarlas a otra computadora:

1. Elegir **Exportar**.
2. Guardar el archivo `.diplomaker-template`.
3. En la otra computadora, abrir **Diseñar** y elegir **Importar plantilla**.

Cuando una plantilla personalizada está siendo utilizada, Diplomaker la incorpora automáticamente al archivo del proyecto `.diplomaker`.

## 6. Uso desde Excel

En la columna `PLANTILLA` puede escribirse:

- el nombre de la plantilla;
- su nombre corto;
- su clave interna, visible en la biblioteca de plantillas personalizadas.

## 7. Compatibilidad anterior

El importador reconoce el formato `.diplomaker-template` y realiza una migración básica de arrays JSON exportados por el creador personalizado del HTML 1.4. Los campos de texto y el bloque de firmantes se conservan; logos antiguos referidos únicamente por identificadores pueden requerir una nueva carga.


## 8. Seguridad de los recursos

- Cada imagen cargada puede ocupar hasta 15 MB.
- Se admiten PNG, JPG, WebP, GIF y SVG.
- Los SVG importados se depuran antes de utilizarlos: se eliminan scripts, eventos, contenido HTML incrustado y referencias remotas.
- Las plantillas importadas se normalizan mediante listas permitidas de tipos de elemento, fuentes, colores, alineaciones y ajustes de imagen.
- Los recursos no compatibles se descartan y Diplomaker muestra una advertencia en lugar de interrumpir el proyecto.
- Los logos y fondos quedan incorporados localmente; no se cargan desde direcciones externas.
