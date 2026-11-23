# Arquitectura Actual — Proyecto SIGNC

> **Estado actual del repositorio:** Fase de diseño aprobada (`MDD-002` y `DDS-004` en `docs/`), previa a la inicialización del código fuente en `src/`.

## 1. Visión General y Stack (v1 — Entrada)
- **Frontend:** Web App responsiva (HTML5 + CSS + JS) servida mediante `HtmlService` de Google Apps Script para operar en **computadores, tablets y celulares**.
- **Backend:** Google Apps Script (`.gs`, runtime V8) comunicado vía `google.script.run`.
- **Persistencia:** Google Sheets normalizado por pestañas con prefijo modular (`EMP_`, `ARE_`, `PRO_`, `USR_`, `CFG_`, `EVI_`, `HIS_`, `SNC_`, `AUD_`).
- **Almacenamiento de archivos:** Google Drive (`DriveApp`), referenciado en `EVI_Evidencias` mediante `drive_file_id` y `url`.
- **Despliegue:** `clasp` (v3.4.1 configurado en el entorno local) + Git.

## 2. Decisiones Técnicas Detectadas y Aprobadas
1. **Login propio desacoplado de la sesión Google del dispositivo:** La Web App se ejecutará bajo la cuenta propietaria para proteger el acceso directo a Sheets y permitir el uso fluido en tablets compartidas en planta.
2. **Núcleo compartido polimórfico:** `EVI_Evidencias` y `HIS_Historial` usan `(modulo, entidad_tipo, entidad_id)` para dar servicio transversal a SNC, Auditorías 5S y módulos futuros.
3. **Atributos técnicos por área en JSON:** `SNC_Hallazgos.datos_tecnicos_json` absorbe campos específicos de Producción (calibre, longitud, peso, maquinaria) sin rigidizar el esquema para otras áreas.
4. **Arquitectura por capas (preparada para migración v2):** Se separará la capa de repositorio (Sheets/Drive) de los servicios de dominio para facilitar la futura evolución hacia una aplicación web moderna con base de datos relacional (ej. PostgreSQL/Supabase).

## 3. Mapa de Módulos y Escalabilidad
- **Base inmediata:** Core + **M1 (SNC, Acciones Correctivas y Oportunidades de Mejora)** + **M2 (Auditorías 5S)**.
- **Olas futuras contempladas:**
  - *Ola 1:* Metrología/Calibración, Recepción MP/Proveedores, PQRS.
  - *Ola 2:* Indicadores/COPQ, Control Documental, Inspección en Proceso/PT.
  - *Ola 3:* Competencias/Calificación, Mantenimiento Preventivo vinculado a Calidad.
