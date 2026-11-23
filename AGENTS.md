# AGENTS.md — Proyecto SIGNC

Aplicación modular de Control de Calidad (**SIGNC**) construida inicialmente como Web App en **Google Apps Script + Google Sheets + Google Drive**, diseñada para PC, tablets y celulares con login propio.

## Mapa de Carpetas
- `docs/` — Especificaciones aprobadas (`MDD-002`, `DDS-004`, `ARCHITECTURE.md`).
- `.agents/rules/` — Reglas de desarrollo y restricciones del proyecto.
- `.agents/skills/` — Habilidades de verificación (ej. `code-review`).
- `src/` *(proyectada para Paso 4)* — Código Google Apps Script (`backend/*.gs`, `frontend/*.html`, `appsscript.json`).

## Comandos Clave
- **Sincronizar código a Apps Script:** `clasp push`
- **Desplegar Web App:** `clasp deploy`
- **Abrir editor en la nube:** `clasp open`
- **Control de versiones:** `git status`, `git add`, `git commit`

*(Aún no hay suite de pruebas automatizadas configurada; la verificación actual es documental y de flujo manual en Web App).*

## Reglas Generales de Estilo
- Mantener el código desacoplado: capa de repositorio (Sheets/Drive) separada de la lógica de negocio y de las vistas HTML.
- Usar `camelCase` en JS/GS y prefijos de módulo en hojas (`EMP_`, `ARE_`, `PRO_`, `USR_`, `CFG_`, `EVI_`, `HIS_`, `SNC_`, `AUD_`).
- Nunca guardar contraseñas en texto plano ni credenciales/IDs sensibles en el repositorio sin `.gitignore`.
- Validar siempre sesión, `rol` y `empresa_id` en el backend `.gs` antes de leer o mutar datos.
