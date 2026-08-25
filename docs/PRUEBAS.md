# Pruebas

## Control automático

Ejecutar:

```bash
npm run check
```

El control verifica:

- existencia de todos los recursos;
- sintaxis de los módulos JavaScript;
- enlace del Estudio visual desde `index.html`;
- inclusión del editor en la caché offline;
- ausencia de referencias reservadas para ediciones privadas.

## Recorrido de integración verificado

La versión 2.1 fue probada en Chromium con el siguiente recorrido:

1. abrir Diplomaker;
2. ingresar en **Diseñar**;
3. agregar una variable y una imagen;
4. crear y guardar una plantilla personalizada;
5. utilizarla en un certificado individual;
6. generar la vista previa;
7. exportar PNG y PDF;
8. guardar el proyecto `.diplomaker`;
9. comprobar que el proyecto contiene la plantilla utilizada;
10. exportar `.diplomaker-template`;
11. importar la plantilla en un contexto nuevo;
12. abrir el proyecto en un contexto nuevo y reconstruir la plantilla incluida;
13. volver a exportar el PDF;
14. importar una plantilla JSON del creador HTML 1.4;
15. agregar tres logos y comprobar su distribución en columnas;
16. seleccionar una plantilla personalizada desde la columna `PLANTILLA` de un CSV y exportar el lote en ZIP;
17. abrir el Estudio directamente desde `file://`, sin servidor;
18. importar una plantilla manipulada y comprobar que se eliminan scripts, atributos ejecutables, recursos remotos y formatos de imagen no admitidos.

No se detectaron errores JavaScript ni errores de consola durante esos recorridos. La prueba de seguridad confirmó que ningún contenido ejecutable llegó al DOM y que los recursos inseguros fueron descartados.

## Prueba manual recomendada antes de una emisión real

1. Crear una copia de la plantilla.
2. Probar un nombre corto y uno de al menos 60 caracteres.
3. Probar cargos extensos y distinta cantidad de firmantes.
4. Cargar todos los logos previstos.
5. Revisar un PDF individual y un PDF conjunto.
6. Abrir el ZIP y comprobar los nombres de archivo.
7. Guardar y reabrir el proyecto.
