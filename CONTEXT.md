# Contexto del proyecto

## Decisiones técnicas
- IA: Gemini con fallback automático entre modelos (gemini-2.5-flash → gemini-2.0-flash → gemini-flash-latest)
- Deploy: Railway (proceso continuo, no serverless — requerido por WebSocket de Discord)
- ClickUp Space ID fijo: 90140175053 (Space "4C")
- HTTP: axios con timeout de 10s y retry automático (hasta 2 intentos) en respuestas 429 y 5xx con back-off exponencial
- Logs: wrapper propio en `src/utils/logger.js` con timestamps ISO — sin dependencias externas

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

### Funciones en src/services/clickup.js
- `getTasksInList(listId)` — GET /list/{listId}/task, pagina automáticamente hasta traer todos los resultados (100 por página)
- `createTestPlan(listId, name)` — crea tarea con `custom_item_id: 1011`
- `createTestCase(listId, parentId, report, ambiente)` — crea subtarea con `custom_item_id: 1002`, `content`/`markdown_content`, custom field Environment
- `linkTasks(taskId, linkedTaskId)` — POST /task/{taskId}/link/{linkedTaskId}

### Función nueva en src/services/gemini.js
- `generateTestCases({ huName, huDescription, ambiente })` — usa `testCaseTemplate.systemPromptFromHU` + `appContext`, genera 3–8 TCs

### Variable de entorno nueva
- `CLICKUP_QA_LIST_ID=901413246506` — lista de QA donde se crean Test Plans y Test Cases; nunca hardcodeada en el código

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
