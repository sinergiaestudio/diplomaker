# Instalación y actualización

Diplomaker puede utilizarse de tres maneras:

1. directamente desde el navegador;
2. como aplicación web instalada —PWA—;
3. como aplicación de escritorio para Windows.

## Uso directo

Abra:

`https://sinergiaestudio.github.io/diplomaker/`

La aplicación procesa los archivos localmente. Después de la primera carga, el service worker conserva los recursos necesarios para trabajar sin conexión.

## Instalar como PWA

### Google Chrome o Microsoft Edge en Windows

1. Abra Diplomaker.
2. Pulse **Instalar** en la barra superior.
3. Confirme la instalación.
4. Diplomaker aparecerá en el menú Inicio y podrá fijarse a la barra de tareas.

Cuando el navegador no entregue el aviso automático, abra su menú y seleccione **Instalar aplicación**.

### Android

1. Abra Diplomaker en Chrome.
2. Pulse **Instalar** cuando aparezca la opción.
3. En caso contrario, abra el menú y seleccione **Agregar a pantalla principal**.

### iPhone o iPad

1. Abra Diplomaker en Safari.
2. Pulse **Compartir**.
3. Seleccione **Agregar a pantalla de inicio**.

## Persistencia en la versión web

Los proyectos se almacenan en IndexedDB. Diplomaker permite solicitar almacenamiento persistente desde **Proyectos → Proteger almacenamiento**.

La concesión depende del navegador. Incluso cuando aparece como protegido, se recomienda conservar respaldos `.diplomaker` o utilizar **Respaldar todos**.

Borrar los datos del sitio desde la configuración del navegador elimina los proyectos que no hayan sido exportados.

## Actualizaciones web

Diplomaker consulta `version.json` sin usar la caché. Cuando detecta una versión nueva:

1. muestra un aviso;
2. descarga el nuevo service worker;
3. permite pulsar **Actualizar ahora**;
4. sustituye los recursos de la versión anterior sin borrar los proyectos.

La navegación principal utiliza una estrategia de red primero. Los demás recursos se conservan localmente y se actualizan en segundo plano.

## Diplomaker Desktop para Windows

La edición de escritorio utiliza la misma interfaz y agrega:

- ventana independiente;
- ícono oficial;
- instaladores NSIS y MSI;
- réplica automática de proyectos en archivos locales;
- persistencia en `Documentos/Diplomaker/Proyectos`;
- asociación con archivos `.diplomaker`.

Las compilaciones estables se publicarán en la sección **Releases** del repositorio.

## Advertencia de Windows

Mientras los instaladores no estén firmados mediante un certificado de firma de código, Windows puede mostrar una advertencia de SmartScreen. Esto no equivale a una firma digital ni debe presentarse como si el instalador estuviera firmado.

## Copia portable

El archivo `.diplomaker` contiene un proyecto completo y puede abrirse en otra computadora. Las plantillas personalizadas utilizadas por el proyecto se incorporan al paquete cuando corresponde.

Para resguardar todos los trabajos locales, utilice **Proyectos → Respaldar todos**.
