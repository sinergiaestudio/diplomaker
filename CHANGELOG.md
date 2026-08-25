# Changelog

## 2.2.0-alpha.2 — 2026-08-25

- identidad visual oficial aplicada en web y escritorio;
- iconos y portada social regenerados;
- tema claro predeterminado y tema oscuro persistente;
- biblioteca y respaldo de proyectos;
- persistencia adicional en la edición Windows;
- mejoras de instalación, actualización y experiencia móvil.

## 2.2.0-alpha.1 — en desarrollo

### Identidad

- nuevo símbolo oficial basado en un documento, la letra D y un sello de validación;
- logotipo horizontal para fondos claros y oscuros;
- variante monocroma, favicon e imagen social;
- descriptor **Estudio local de diplomas y certificados**;
- slogan **Diseñá una vez. Emití con precisión.**;
- manual de identidad y paleta pública;
- autoría visible con vínculo al perfil de Marcelo Gómez.

### Experiencia

- tema claro como apariencia predeterminada;
- tema oscuro y modo automático según el sistema;
- nueva portada y jerarquía visual;
- navegación inferior específica para teléfonos;
- encabezado móvil con marca oficial;
- ventana Acerca de;
- acceso visible a instalación PWA;
- actualización de favicon y accesos directos mediante hash.

### Proyectos y persistencia

- biblioteca local de proyectos;
- renombrado, duplicado, exportación y eliminación;
- respaldo conjunto en ZIP y restauración;
- solicitud de almacenamiento persistente;
- compatibilidad con proyectos 2.0 y 2.1;
- formato de exportación actualizado a 2.2.

### Web y actualizaciones

- archivo `version.json` sin caché;
- aviso de nueva versión y activación explícita;
- navegación con estrategia de red primero;
- recursos estáticos con caché y actualización en segundo plano;
- eliminación automática de cachés obsoletas;
- paquete web limpio para GitHub Pages.

### Escritorio

- base Tauri 2 para Windows;
- instaladores NSIS y MSI;
- ícono oficial y asociación con `.diplomaker`;
- réplica automática en `Documentos/Diplomaker/Proyectos`;
- escritura atómica mediante archivo temporal;
- restauración desde archivos locales al iniciar;
- workflow Windows x64 y artefactos de prueba;
- publicación automatizada mediante GitHub Releases.

### Calidad y documentación

- generación raster de íconos sin dependencias externas;
- controles de integración, identidad, privacidad y versiones;
- README rediseñado como portada de producto;
- nuevas guías de instalación, proyectos, identidad y escritorio;
- rama de release y pull request de trabajo antes de modificar producción.

## 2.1.0-beta.1 — 24/08/2026

- incorporación del Estudio visual de plantillas;
- creación de diseños desde cero o a partir de un fondo propio;
- textos fijos, variables y tokens reutilizables;
- imágenes, líneas, figuras, logos y bloques de firmantes;
- arrastre, redimensionado, rotación, opacidad y gestión de capas;
- deshacer, rehacer, duplicar, bloquear, ocultar y mover con teclado;
- guardado local estructurado en IndexedDB;
- archivos portables `.diplomaker-template`;
- plantillas personalizadas incluidas automáticamente en proyectos `.diplomaker`;
- soporte de importación de plantillas antiguas JSON de la versión 1.4;
- selección de plantillas personalizadas por nombre desde la columna `PLANTILLA`;
- caché offline y controles estáticos actualizados;
- límite de 15 MB por imagen y saneamiento de SVG, propiedades y recursos importados.

## 2.0.0-beta.1 — 19/08/2026

- primera edición pública sanitizada;
- tres plantillas generales nuevas;
- datos exclusivamente ficticios;
- exportación segura mediante fondos integrados;
- PDF, ZIP, PNG, XLSX/CSV, autosave y proyectos portables;
- licencia MIT, privacidad y GitHub Pages.
