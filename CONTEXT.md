# Contexto del proyecto

## Decisiones técnicas
- IA: Gemini con fallback automático entre modelos (gemini-2.5-flash → gemini-2.0-flash → gemini-flash-latest)
- Deploy: Railway (proceso continuo, no serverless — requerido por WebSocket de Discord)
- ClickUp Space ID fijo: 90140175053 (Space "4C")
- HTTP: axios con timeout de 10s y retry automático (hasta 2 intentos) en respuestas 429 y 5xx con back-off exponencial
- Logs: wrapper propio en `src/utils/logger.js` con timestamps ISO — sin dependencias externas
- Sprint activo: detectado automáticamente por `getCurrentSprint()` en `clickup.js` — escanea todos los folders del space cuyo nombre contiene "Sprint", parsea el rango de fechas de cada lista (formato "Sprint N (M/D - M/D)") y retorna el que contenga la fecha actual; fallback al último sprint encontrado. No requiere ningún ID hardcodeado ni variable de entorno de sprint.

## Variables de entorno obligatorias

Validadas al arranque en `src/index.js` (si falta alguna, el proceso termina). Valores concretos y ejemplo de `.env`: ver `README.md` y `.env.example`.

| Variable | Uso |
|----------|-----|
| `DISCORD_TOKEN` | Token del bot |
| `DISCORD_CLIENT_ID` | Application ID (registro de slash commands) |
| `CLICKUP_API_TOKEN` | API token de ClickUp |
| `CLICKUP_WORKSPACE_ID` | Workspace (team) de ClickUp |
| `CLICKUP_SPACE_ID` | Space autorizado para crear/validar tareas (p. ej. 90140175053) |
| `CLICKUP_QA_LIST_ID` | Lista de QA: `/testcase` crea ahí Test Plans y Test Cases (p. ej. 901413246506) |
| `GEMINI_API_KEY` | Google AI (Gemini) |

## Mapeo de tipos de tarea (custom_item_id)
Definido en `src/constants.js` (fuente única — importado por `clickup.js` y `gemini.js`).

| Tipo        | ID   |
|-------------|------|
| Task        | 0    |
| Bug         | 1004 |
| Improvement | 1005 |
| Test Case   | 1002 |
| Test Plan   | 1011 |

## Custom fields de ClickUp
### Environment (ID: 831a2fc4-e6c7-4aee-89a4-8f58dabfa28a)
| Nombre         | ID                                   |
|----------------|--------------------------------------|
| Feature Branch | ef20f782-eb3a-44cd-8ad8-28f78b5eac63 |
| Development    | db536008-9ce5-4e3e-8e84-e94d66e9fa44 |
| Staging        | e5ebd00c-19ae-4bb5-a0b4-f73fc687e1ff |
| Production     | d5a52f6c-30e4-42ec-a420-30b1f5bb117b |
| Metabase       | 78df52ff-b77a-47f2-8fa0-aeae5995554d |

## Templates por tipo de tarea
Ubicados en `src/templates/`. Cada archivo exporta `{ systemPrompt, structure }`.
`testCase.js` exporta adicionalmente `systemPromptFromHU`, usado por el comando `/testcase` para generar múltiples TCs desde una HU.
Para agregar un nuevo template: crear el archivo en esa carpeta e importarlo en `src/templates/index.js`.

Gemini elige plantilla por `tipo` vía `TASK_TYPES` → `templates/index.js`. **`bug.js`** define un informe orientado a desarrollo (orden de secciones y campo `notes` — ver sección Comando `/bug`). **`improvement.js`** y **`taskDefault.js`** mantienen sus propias estructuras de Markdown; no usan el layout de `bug.js`.

## Comando /bug
Archivo: `src/commands/bug.js`

### Opciones del slash command
| Opción | Requerido | Descripción |
|---|---|---|
| `tipo` | ✅ | bug / improvement / task / test case / test plan |
| `ambiente` | ✅ | development / staging / production |
| `descripcion` | ✅ | Descripción informal en lenguaje natural |
| `task_id` | ❌ | ID de la tarea padre. Si se omite, el bot pregunta dónde crear |
| `asignado` | ❌ | Usuario de Discord a quien asignar |

### Flujo A — task_id provisto
1. Fetch de la tarea padre → valida que pertenezca a `CLICKUP_SPACE_ID`
2. Resolución de asignado (Discord → ClickUp)
3. Generación de reporte con Gemini (`generateBugReport` en `gemini.js`; el mensaje al modelo incluye la línea `Task ID:` solo en este flujo)
4. Creación como subtarea de la tarea padre (`createSubtask` con `parentTaskId` = tarea padre)
5. Embed de confirmación con link a la nueva tarea

### Flujo B — sin task_id (botones interactivos)
1. Muestra botones: **📌 Sprint actual** | **🔗 Asociar a tarea**
2. **Sprint actual**:
   - Llama a `getCurrentSprint()` — misma lógica que en “Decisiones técnicas”: escanea folders del space cuyo nombre contiene `"Sprint"`, elige la lista cuyo rango de fechas incluye hoy (o fallback a la última lista); no usa ninguna variable de entorno de sprint
   - Muestra el nombre del sprint + botones **✅ Confirmar** | **❌ Cancelar**
   - Al confirmar: genera reporte con Gemini (sin `Task ID` en el mensaje) y crea la tarea en la lista del sprint con `createSubtask({ parentTaskId: null, listId: sprint.id, ... })`
   - Embed de confirmación muestra el sprint en lugar de "Tarea padre"
3. **Asociar a tarea**:
   - Muestra un Discord Modal para ingresar el `task_id`
   - Al enviar: continúa con el Flujo A normal
   - Timeout del modal: 2 minutos

### Timeout de collectors
- Selección Sprint/Tarea: 60s
- Confirmación de sprint: 60s
- Modal de task_id: 120s

### Salida de IA para el tipo **bug** (`src/templates/bug.js`)

Gemini devuelve JSON con: `title`, `description` (Markdown), `impact` (`Alto` \| `Medio` \| `Bajo`), `notes` (QA interno: frecuencia de repro, supuestos si se infirieron pasos, etc.; puede ir vacío).

El campo `description` debe seguir **este orden de secciones** (orientado a que el dev lea primero lo esencial):

1. `## Expected Behavior` — breve y explícito (arriba).
2. `## Steps to Recreate` — pasos numerados; el último paso es `**Result:**` con el fallo observado.
3. `## Current Behavior` — síntomas / impacto, conciso (después de los pasos).
4. `## AI Prompt for IDE` — prompt técnico listo para copiar en herramientas de IA del IDE.
5. `## Evidence` — enlaces si los hubo en el input; si no, la frase placeholder indicada en la plantilla para añadir JAM o capturas en ClickUp.

Los demás tipos de `/bug` (improvement, task, test case, test plan) usan **otras** plantillas (`improvement.js`, `taskDefault.js`, `testCase.js`) con otro Markdown en `description`; el layout anterior aplica al tipo **bug**.

## Comando /testcase
Archivo: `src/commands/testcase.js`

### Flujo
1. Recibe `hu_id` y `ambiente` como opciones del slash command
2. Hace fetch de la HU desde ClickUp y valida que `text_content` tenga ≥ 50 caracteres
3. Llama a `generateTestCases()` en `src/services/gemini.js` usando `testCaseTemplate.systemPromptFromHU`
4. Gemini devuelve `{ test_plan_title, test_cases: [{ title, description, impact, notes }] }`
5. Muestra botones con `InteractionCollector` (timeout: 60s):
   - **Nuevo Test Plan**: crea uno en `CLICKUP_QA_LIST_ID` con `custom_item_id: 1011`
   - **Test Plan existente**: carga tareas de `CLICKUP_QA_LIST_ID`, filtra por `custom_type === 1011`, muestra select menu (máx 25)
6. Crea cada TC como subtarea del Test Plan elegido con `custom_item_id: 1002`
7. Vincula cada TC a la HU original con `POST /api/v2/task/{hu_id}/link/{tc_id}`
8. Responde con embed de confirmación (conteo de creados/fallados, links al Test Plan y a la HU)

### Funciones en src/services/clickup.js (resumen)
- `getTask`, `getWorkspaceMembers`, `createSubtask` — usadas por `/bug`; `createSubtask` admite `parentTaskId` nulo para crear la tarea en una lista sin padre (sprint)
- `getCurrentSprint` — usada por `/bug` (flujo sprint); ver “Decisiones técnicas”
- `getTasksInList(listId)` — GET /list/{listId}/task, pagina hasta completar (100 por página)
- `createTestPlan(listId, name)` — `custom_item_id: 1011`
- `createTestCase(listId, parentId, report, ambiente)` — subtarea `1002`, `content`/`markdown_content`, custom field Environment
- `linkTasks(taskId, linkedTaskId)` — POST /task/{taskId}/link/{linkedTaskId}

### Funciones en src/services/gemini.js
- `generateBugReport({ taskId?, tipo, ambiente, descripcion })` — plantilla según `tipo`; `taskId` opcional (omitido en mensaje si no hay padre)
- `generateTestCases({ huName, huDescription, ambiente })` — `testCaseTemplate.systemPromptFromHU` + `appContext`, 3–8 TCs

## Estructura de Test Cases (src/templates/testCase.js)

### Secciones del markdown_content de cada TC
Estructura actualizada — las secciones `Objective` y `Pass Criteria` fueron eliminadas. Cada TC usa exactamente:

```
## Preconditions
- [Rol requerido — e.g. "Logged in as Inspector"]
- [Datos, estado previo o setup necesario]

## Steps
1. [Acción atómica en imperativo]
2. [Acción atómica en imperativo]
3. [Acción atómica en imperativo]

## Expected Result
[Descripción específica y verificable del resultado esperado]
```

### Reglas del prompt (TC_RULES — constante compartida entre systemPrompt y systemPromptFromHU)
- Título con formato: `[Should/Verify] + [acción] + [condición]` — ej: `"Verify that inspector can complete inspection in offline mode"`
- Preconditions deben incluir el rol del usuario requerido
- Steps atómicos en imperativo (`Click on...`, `Enter...`, `Navigate to...`, `Select...`) — una acción por paso
- Sin negrita dentro de los steps
- Expected Result específico y verificable — prohibido usar frases genéricas como "it works correctly"
- Todo en inglés

## Pendientes / ideas futuras
- Notificaciones de ClickUp hacia Discord vía webhook
- Comando /improvement separado con campos específicos
