# Reglas Generales — SIGNC (Google Apps Script)

## 1. Buenas Prácticas de Arquitectura y Datos
- **Separación de capas:** Toda lectura/escritura en Google Sheets y Drive debe pasar por funciones repositorio; la lógica de negocio (`.gs`) no manipula rangos directamente.
- **Lectura/escritura en lote:** Usar `getValues()` y `setValues()` sobre rangos completos. Prohibido llamar `getValue()`/`setValue()` dentro de bucles.
- **Concurrencia:** Usar `LockService.getScriptLock()` en creación de consecutivos (`SNC-AAAA-NNN`, `OM-AAAA-NNN`, `AUD-AAAA-NNN`) y mutaciones de estado.
- **Aislamiento multiempresa:** Toda consulta y mutación en el backend debe filtrar estrictamente por el `empresa_id` del usuario autenticado.
- **Trazabilidad obligatoria:** Todo cambio de fase, pausa, reanudación, devolución, anulación o cierre debe registrar una fila en `HIS_Historial`.

## 2. Manejo de Errores
- Las funciones expuestas al frontend (`google.script.run`) deben usar `try/catch` y retornar un contrato uniforme: `{ ok: true, data: ... }` o `{ ok: false, error: "Mensaje claro para el usuario" }`.
- Registrar el detalle técnico con `console.error(...)` en Apps Script, sin exponer stack traces al cliente.

## 3. Convenciones de Nombres
- **Hojas en Google Sheets:** Prefijo de 3 letras + PascalCase (`SNC_Hallazgos`, `AUD_Auditorias`, `EVI_Evidencias`, `HIS_Historial`).
- **Archivos `.gs`:** PascalCase por responsabilidad (`AuthService.gs`, `SncRepository.gs`, `SncService.gs`).
- **Variables y funciones JS/GS:** `camelCase`; constantes globales en `UPPER_SNAKE_CASE`.

## 4. Restricciones (Qué Evitar)
- No almacenar contraseñas en texto plano (usar SHA-256 + salt en `USR_Usuarios`).
- No confiar en validaciones solo del frontend HTML/JS; replicar permisos de rol y campos obligatorios (`DDS-004`) en el backend `.gs`.
- No romper el diseño responsivo (PC, tablet y celular) con anchos fijos en píxeles.
- No modificar `docs/MDD-002_Modelo_Datos_Sheets.md` ni `docs/DDS-004_Maquina_Estados_Permisos.md` sin aprobación explícita.
