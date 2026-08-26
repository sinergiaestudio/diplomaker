# Diplomaker Desktop

Diplomaker Desktop reutiliza la aplicación web dentro de Tauri. No existe un segundo frontend ni una lógica de composición separada.

## Objetivos

- conservar el flujo y la apariencia de la versión web;
- funcionar sin conexión desde la primera apertura;
- ofrecer persistencia previsible en archivos locales;
- producir instaladores para Windows;
- mantener los formatos `.diplomaker` y `.diplomaker-template`.

## Arquitectura

```text
Frontend HTML/CSS/JavaScript
            ↓
     Tauri WebView2
            ↓
Comandos Rust de persistencia
            ↓
Documentos/Diplomaker/Proyectos
```

## Desarrollo local

### Requisitos

- Node.js 20 o posterior;
- Rust estable;
- herramientas de compilación de Microsoft C++;
- WebView2;
- WiX Toolset cuando corresponda para MSI.

### Ejecutar en desarrollo

```bash
npm install
npm run desktop:dev
```

`beforeDevCommand` inicia el servidor local en `127.0.0.1:4173`.

### Compilar

```bash
npm run desktop:build
```

Antes de invocar Tauri se ejecutan:

1. generación de íconos oficiales;
2. copia de recursos a `dist/`;
3. compilación Rust;
4. empaquetado NSIS y MSI.

## Persistencia

El puente `src/desktop.js` amplía el adaptador web:

- importa las copias de disco al iniciar;
- conserva IndexedDB como capa compatible;
- replica cada autosave mediante `sync_project_file`;
- elimina la réplica mediante `delete_project_snapshot`;
- consulta la carpeta con `projects_directory`.

El backend Rust valida que el contenido sea JSON antes de escribirlo y utiliza un archivo temporal seguido de una operación de renombrado.

## Carpeta de proyectos

```text
Documentos/
└── Diplomaker/
    └── Proyectos/
        └── Nombre_del_proyecto--project_id.diplomaker
```

El identificador al final del nombre permite renombrar el proyecto sin crear duplicados involuntarios.

## Instaladores

La configuración actual genera:

- NSIS `-setup.exe`;
- MSI;
- paquetes x64 en el workflow de Windows.

El instalador NSIS se configura para el usuario actual. WebView2 se descarga mediante bootstrapper cuando no está disponible.

## Asociación de archivos

La configuración declara la extensión `.diplomaker` como **Proyecto Diplomaker**. La apertura directa desde el sistema deberá probarse en Windows antes de promover la versión estable, especialmente el manejo de argumentos al iniciar una segunda instancia.

## Firma de código

La fase alpha no declara firma digital. Para una distribución estable sin advertencias de SmartScreen será necesario configurar un certificado de firma de código en GitHub Actions o en un entorno de publicación controlado.

## Alcance actual

La base de escritorio ya incluye:

- contenedor Tauri;
- configuración de ventana;
- íconos generables;
- comandos de persistencia;
- sincronización de proyectos;
- empaquetado NSIS/MSI;
- conservación del estado de ventana.

Pendientes antes de estable:

- validar compilación en Windows;
- probar apertura por doble clic;
- comprobar rutas con caracteres no ASCII;
- probar desinstalación sin pérdida de Documentos;
- producir y verificar artefactos de instalación;
- decidir la política de firma de código.
