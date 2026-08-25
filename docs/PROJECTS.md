# Proyectos y respaldos

## Qué guarda un proyecto

Un proyecto `.diplomaker` puede contener:

- nombre y configuración del proyecto;
- plantilla activa;
- datos importados;
- asociación de columnas;
- certificados incluidos y excluidos;
- firmantes;
- patrón de nombres de archivo;
- plantillas personalizadas utilizadas;
- estado de revisión.

No se envía a un servidor.

## Guardado automático

Diplomaker guarda el proyecto después de cada cambio relevante con una demora breve para evitar escrituras innecesarias.

Los estados posibles son:

- **Cambios pendientes**;
- **Guardando localmente**;
- **Guardado localmente**;
- **No se pudo guardar**.

## Biblioteca de proyectos

La sección **Proyectos** permite:

- abrir trabajos anteriores;
- crear un proyecto nuevo;
- renombrar;
- duplicar;
- exportar;
- eliminar del dispositivo;
- respaldar toda la biblioteca;
- restaurar un respaldo.

Los proyectos se ordenan por fecha de modificación.

## Respaldo conjunto

**Respaldar todos** genera un ZIP con:

```text
manifest.json
projects/
  Proyecto_1.diplomaker
  Proyecto_2.diplomaker
  ...
```

El manifiesto registra la versión, fecha de exportación, identificadores y nombres.

## Restauración

Al restaurar un ZIP:

1. Diplomaker busca archivos dentro de `projects/`;
2. valida que contengan un proyecto compatible;
3. conserva sus identificadores;
4. actualiza la biblioteca local.

Si un identificador ya existe, la copia restaurada reemplaza la versión local. Para conservar ambas, duplique o renombre antes de restaurar.

## Versión web

El navegador utiliza IndexedDB. La opción **Proteger almacenamiento** solicita persistencia mediante la API de almacenamiento del navegador.

La persistencia reduce el riesgo de eliminación automática por presión de espacio, pero no impide que el usuario borre manualmente los datos del sitio.

## Versión de escritorio

Diplomaker Desktop mantiene compatibilidad con IndexedDB y replica los proyectos en:

```text
Documentos/
└── Diplomaker/
    └── Proyectos/
```

Cada cambio se escribe primero en un archivo temporal y luego se renombra, para reducir el riesgo de archivos incompletos durante un corte inesperado.

La eliminación desde la biblioteca también elimina la réplica local. Las copias exportadas a otras carpetas no se modifican.

## Compatibilidad

Diplomaker 2.2 acepta proyectos de las versiones 2.0 y 2.1. Al guardarlos nuevamente, actualiza el formato de exportación a 2.2 sin descartar los datos compatibles.

## Recomendación de trabajo

Para proyectos importantes:

1. mantenga el guardado automático activo;
2. exporte una copia `.diplomaker` al finalizar cada jornada;
3. genere un respaldo conjunto antes de actualizaciones mayores;
4. no utilice el repositorio público para almacenar proyectos con datos reales.
