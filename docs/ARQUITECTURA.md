# Arquitectura

Diplomaker es una aplicación web estática, local y sin backend obligatorio. La edición pública se sirve desde GitHub Pages y, después de la primera carga, puede seguir funcionando mediante el service worker.

## Núcleo de emisión

```text
Plantilla + registro + firmantes
              ↓
      Motor Canvas unificado
       ↙                ↘
Vista previa       PDF / PNG / ZIP
```

La vista previa y los archivos exportados utilizan el mismo motor de composición. Los fondos e imágenes se cargan como recursos locales o data URL para evitar canvases contaminados.

## Estudio de plantillas

El editor visual vive en `src/template-studio.js`, separado del generador principal. Extiende en tiempo de ejecución:

- `TemplateLibrary`, para registrar y resolver diseños personalizados;
- `Renderer`, para componer elementos por capas;
- `Storage`, para guardar plantillas e incorporarlas a proyectos portables;
- la interfaz, con la vista **Diseñar**.

Una plantilla personalizada contiene:

- metadatos;
- página A4 apaisada de 1120 × 792 unidades;
- fondo y recursos embebidos;
- elementos ordenados por capas;
- reglas tipográficas y de ajuste;
- bloques dinámicos de logos y firmantes.

## Persistencia

- IndexedDB conserva plantillas personalizadas.
- `localStorage` actúa como respaldo cuando IndexedDB no está disponible.
- `.diplomaker-template` transporta una plantilla entre equipos.
- `.diplomaker` incorpora automáticamente las plantillas personalizadas utilizadas por el proyecto.

## Frontera de seguridad

Los archivos `.diplomaker-template` se consideran entrada no confiable. Antes de registrarlos, el editor normaliza dimensiones, tipos de elemento, fuentes, colores, alineaciones y recursos. Los data URL se limitan a imágenes admitidas; los SVG se depuran y no conservan scripts, eventos, contenido HTML incrustado ni referencias remotas.

## Privacidad

La importación, composición y exportación se realizan en el navegador. No existe una API que reciba planillas, logos, firmas o certificados.
