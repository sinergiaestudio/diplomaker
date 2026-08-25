# Diplomaker

Aplicación local y de código abierto para crear diplomas y certificados individuales o por lote, y para diseñar plantillas reutilizables sin modificar código.

**Versión pública:** 2.1.0-beta.1  
**Autor:** Marcelo Gómez  
**Licencia:** MIT

## Uso web

La edición publicada en GitHub Pages está disponible en:

`https://sinergiaestudio.github.io/diplomaker/`

## Funciones

### Generación

- certificado individual;
- importación XLSX y CSV;
- asociación automática o manual de columnas;
- revisión y corrección previa;
- firmantes variables;
- PDF individual y PDF conjunto;
- ZIP con un PDF por participante;
- PNG de alta resolución e informe CSV;
- autosave local y proyectos `.diplomaker`;
- funcionamiento offline después de la primera carga.

### Estudio visual de plantillas

- lienzo A4 apaisado con vista previa directa;
- fondo en PNG, JPG, WebP o SVG;
- textos fijos y campos variables;
- tokens dentro de textos: `{NOMBRE}`, `{TRATAMIENTO}`, `{NOMBRE_COMPLETO}`, `{TIPO_CERTIFICADO}`, `{EVENTO}`, `{FECHA}`, `{TEXTO}` y `{CUERPO}`;
- imágenes y firmas gráficas;
- líneas, rectángulos y círculos;
- bloque dinámico de firmantes;
- franja de logos con distribución automática;
- arrastre, redimensionado, rotación, opacidad y orden de capas;
- bloqueo y ocultamiento de elementos;
- deshacer, rehacer, duplicar y movimientos con teclado;
- guardado en IndexedDB;
- exportación e importación `.diplomaker-template`;
- migración básica de plantillas JSON creadas con la versión HTML 1.4;
- inclusión automática de las plantillas utilizadas dentro de los proyectos portables.

## Plantillas públicas integradas

1. **Clásico azul** — azul, dorado y marfil.
2. **Moderno bordó** — geometría en bordó y gris.
3. **Académico verde** — verde, dorado y marfil.

No incluyen marcas, logos ni identidades de terceros. Los SVG editables están en `assets/templates/`.

## Flujo de uso

1. Elegir un diseño integrado o crear uno desde **Diseñar**.
2. Completar una persona o cargar una planilla XLSX/CSV.
3. Confirmar la asociación de columnas.
4. Revisar nombres, textos y firmantes.
5. Exportar PDF, PNG, ZIP o informe.

Para aplicar una plantilla personalizada desde Excel, puede escribirse en la columna `PLANTILLA` su nombre o su clave interna.

## Portabilidad

Las plantillas se guardan localmente en el navegador. También pueden:

- exportarse como `.diplomaker-template`;
- importarse en otra computadora;
- viajar incorporadas dentro de un proyecto `.diplomaker` cuando están siendo utilizadas.

## Seguridad de plantillas

- las imágenes se limitan a 15 MB por archivo;
- los SVG se depuran antes de incorporarse;
- las plantillas importadas se normalizan con listas permitidas de elementos, tipografías, colores y propiedades;
- no se aceptan recursos remotos dentro de una plantilla;
- los recursos incompatibles se descartan sin ejecutar contenido.

## Privacidad

Los archivos se procesan en el navegador. Diplomaker no envía las planillas, logos, firmas ni certificados a un servidor. Lea [PRIVACY.md](PRIVACY.md).

La carpeta `examples/` contiene únicamente datos ficticios. No se deben subir al repositorio proyectos o listados reales.

## Desarrollo

```bash
npm run check
npm run serve
```

La vista previa y la exportación usan el mismo motor Canvas. No es necesario instalar paquetes para utilizar la aplicación.

## Publicación

El workflow `.github/workflows/pages.yml` despliega la rama `main` en GitHub Pages.

## Documentación

- [Estudio de plantillas](docs/ESTUDIO_DE_PLANTILLAS.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Pruebas](docs/PRUEBAS.md)
- [Privacidad](PRIVACY.md)
