# Diplomaker

Aplicación local y de código abierto para crear diplomas y certificados individuales o por lote.

**Versión pública:** 2.0.0-beta.1  
**Autor:** Marcelo Gómez  
**Licencia:** MIT

## Usar Diplomaker

**Aplicación web:** https://sinergiaestudio.github.io/diplomaker/

La aplicación procesa los archivos en el navegador. No requiere cuenta y no envía las planillas a un servidor.

## Funciones

- creación de certificados individuales;
- importación directa de XLSX y CSV;
- asociación automática o manual de columnas;
- revisión y corrección previa de cada registro;
- hasta cuatro firmantes;
- PDF individual y PDF conjunto;
- ZIP con un PDF identificado por participante;
- PNG de alta resolución e informe CSV;
- guardado local y proyectos `.diplomaker`;
- funcionamiento offline después de la primera carga.

## Plantillas públicas

1. **Clásico azul** — azul, dorado y marfil.
2. **Moderno bordó** — geometría en bordó y gris.
3. **Académico verde** — verde, dorado y marfil.

No incluyen marcas, logos ni identidades de terceros. Los SVG editables están en `assets/templates/`.

## Uso

1. Elija **Certificado individual** o **Lote desde Excel**.
2. Seleccione una plantilla.
3. Complete los datos o cargue XLSX/CSV.
4. Confirme la asociación de columnas.
5. Revise los resultados.
6. Exporte PDF, PNG, ZIP o informe.

## Archivos de ejemplo

La carpeta `examples/` contiene únicamente información ficticia:

- [`Plantilla_Diplomaker.xlsx`](examples/Plantilla_Diplomaker.xlsx), con hojas **Datos** y **Ayuda**;
- [`datos_ficticios.csv`](examples/datos_ficticios.csv).

No utilice el repositorio público para guardar planillas reales, proyectos con participantes ni certificados emitidos.

## Privacidad

Consulte [PRIVACY.md](PRIVACY.md). Diplomaker no incorpora analítica, publicidad ni rastreadores propios.

## Desarrollo

```bash
npm run check
npm run serve
```

La vista previa y la exportación usan el mismo motor Canvas. No es necesario instalar paquetes para usar la aplicación.

## Publicación y controles

- `.github/workflows/pages.yml` publica automáticamente la rama `main` en GitHub Pages.
- `.github/workflows/quality.yml` verifica estructura, sintaxis y ausencia de referencias reservadas para ediciones privadas.

## Próximo ciclo

Editor visual por capas, carga de fondos, logos y firmas, campos arrastrables e importación de plantillas.
