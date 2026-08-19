# Diplomaker

Aplicación local y de código abierto para crear diplomas y certificados individuales o por lote.

**Versión pública:** 2.0.0-beta.1  
**Autor:** Marcelo Gómez  
**Licencia:** MIT

## Funciones

- certificado individual;
- importación XLSX y CSV;
- asociación automática o manual de columnas;
- revisión y corrección previa;
- hasta cuatro firmantes;
- PDF individual y PDF conjunto;
- ZIP con un PDF por participante;
- PNG de alta resolución e informe CSV;
- autosave local y proyectos `.diplomaker`;
- funcionamiento offline después de la primera carga.

## Plantillas públicas

1. **Clásico azul** — azul, dorado y marfil.
2. **Moderno bordó** — geometría en bordó y gris.
3. **Académico verde** — verde, dorado y marfil.

No incluyen marcas, logos ni identidades de terceros. Los SVG editables están en `assets/templates/`.

## Privacidad

Los archivos se procesan en el navegador. Diplomaker no envía las planillas a un servidor. Lea [PRIVACY.md](PRIVACY.md).

## Uso

1. Elija certificado individual o lote.
2. Seleccione una plantilla.
3. Complete los datos o cargue XLSX/CSV.
4. Confirme la asociación de columnas.
5. Revise los resultados.
6. Exporte PDF, PNG, ZIP o informe.

La carpeta `examples/` contiene únicamente datos ficticios.

## Desarrollo

```bash
npm run check
npm run serve
```

La vista previa y la exportación usan el mismo motor Canvas. No es necesario instalar paquetes para usar la aplicación.

## Publicación

El workflow `.github/workflows/pages.yml` despliega la rama `main` en GitHub Pages.

## Próximo ciclo

Editor visual por capas, carga de fondos, logos y firmas, campos arrastrables e importación de plantillas.
