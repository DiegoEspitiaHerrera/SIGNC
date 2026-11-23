---
name: code-review
description: Lista de verificación paso a paso para auditar calidad, seguridad y rendimiento en SIGNC (Google Apps Script + Sheets + Drive) antes de dar por terminada una tarea.
---

# Code Review — SIGNC

Ejecuta esta lista de verificación antes de finalizar cualquier cambio de código:

## 1. Calidad y Alineación Funcional
- [ ] ¿El cambio respeta el modelo de datos de `docs/MDD-002_Modelo_Datos_Sheets.md`?
- [ ] ¿Las transiciones, campos obligatorios y roles cumplen con `docs/DDS-004_Maquina_Estados_Permisos.md`?
- [ ] ¿La lógica de negocio está separada de la capa de acceso a Sheets/Drive (sin duplicar lógica)?
- [ ] ¿Las funciones son cortas, claras y retornan `{ ok, data, error }` en puntos de entrada RPC?

## 2. Seguridad y Control de Acceso
- [ ] ¿Toda función llamada vía `google.script.run` valida el token de sesión activo antes de operar?
- [ ] ¿Se valida `empresa_id` en el backend para impedir fuga de datos entre empresas?
- [ ] ¿Se verifican permisos por rol (`GERENCIA`, `COORDINADOR`, `LIDER`, `COLABORADOR`) en servidor?
- [ ] ¿Se evita exponer contraseñas, hashes, IDs internos sensibles o stack traces al cliente?

## 3. Rendimiento en Google Apps Script / Sheets
- [ ] ¿Se usan operaciones en lote (`getValues`/`setValues`) en lugar de lecturas/escrituras celda por celda en bucles?
- [ ] ¿Las operaciones críticas (consecutivos, cambios de estado) están protegidas con `LockService` y liberan el lock en `finally`?
- [ ] ¿Se minimiza el número de llamadas `google.script.run` desde la interfaz (carga inicial agrupada)?

## 4. UX Multidispositivo
- [ ] ¿La interfaz funciona correctamente en PC, tablet y celular sin desbordamientos horizontales?
- [ ] ¿Los formularios muestran estados de carga y mensajes de error claros?
