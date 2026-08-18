/*
 * ============================================================
 *  TAREAS FAMILIA — app.js
 * ============================================================
 * Gestor de tareas familiar. Las tareas se guardan en una tabla
 * "tasks" de Supabase (base de datos en la nube) y cada una tiene
 * un usuario asignado (Filippa, Micaela o Marcos).
 *
 * Estructura del archivo (de arriba hacia abajo):
 *   1. Configuración (URLs, claves) y estado global de la app.
 *   2. Registro de eventos (logs) y avisos de error en pantalla.
 *   3. Utilidades de fecha (formatear, convertir para inputs, etc).
 *   4. Estadísticas y renderizado de la lista de tareas en el DOM.
 *   5. Operaciones CRUD contra Supabase (crear, leer, actualizar,
 *      borrar tareas) y exportación a PDF.
 *   6. Conexión de eventos de la interfaz (bindEvents) e inicio
 *      de la aplicación (init).
 *
 * Todo el código vive dentro de una IIFE (función que se ejecuta
 * inmediatamente) para no contaminar el ámbito global del navegador;
 * solo se exponen a `window` las funciones que se necesitan usar
 * desde fuera (por ejemplo, para probarlas desde la consola).
 * ============================================================
 */
(() => {
  // ---- Configuración: credenciales de Supabase y webhook externo ----
  const SUPABASE_URL = 'https://qdierydswmebuwwvmywa.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_oVJi9Pn-dW197ySIcdtcQg_YI_jOEkF';
  const MAKE_WEBHOOK_URL = 'https://hook.make.com/TU_WEBHOOK';

  // Estado global de la app: tareas actuales, filtro activo y registro de eventos.
  const state = {
    tasks: [],
    filter: 'all',
    logs: [],
    editingTaskId: null
  };

  // Cliente de Supabase para leer y guardar tareas.
  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const elements = {
    taskInput: document.getElementById('taskInput'),
    addButton: document.getElementById('addButton'),
    taskList: document.getElementById('taskList'),
    taskCounter: document.getElementById('taskCounter'),
    clearCompletedButton: document.getElementById('clearCompletedButton'),
    filterSelect: document.getElementById('filterSelect'),
    searchInput: document.getElementById('searchInput'),
    taskPriority: document.getElementById('taskPriority'),
    taskDate: document.getElementById('taskDate'),
    taskDateStart: document.getElementById('taskDateStart'),
    taskDateEnd: document.getElementById('taskDateEnd'),
    taskFrequency: document.getElementById('taskFrequency'),
    taskTypeRadios: document.querySelectorAll('input[name="taskType"]'),
    singleTaskFields: document.getElementById('singleTaskFields'),
    repetitiveTaskFields: document.getElementById('repetitiveTaskFields'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    statTotal: document.getElementById('statTotal'),
    statPending: document.getElementById('statPending'),
    statCompleted: document.getElementById('statCompleted'),
    statHighPriority: document.getElementById('statHighPriority'),
    statFilippa: document.getElementById('statFilippa'),
    statMicaela: document.getElementById('statMicaela')
  };

  // Guarda eventos en la consola y, si existe, también en la tabla task_logs de Supabase.
  function registrarLog(evento, detalle = {}, payload = {}) {
    const entrada = {
      timestamp: new Date().toISOString(),
      evento,
      detalle,
      payload
    };

    state.logs.push(entrada);
    console.log('[TaskLogger]', entrada);

    if (!supabase) return;

    try {
      supabase
        .from('task_logs')
        .insert([
          {
            event: evento,
            detail: JSON.stringify(detalle),
            payload: JSON.stringify(payload),
            created_at: entrada.timestamp
          }
        ])
        .then(({ error }) => {
          if (error) {
            console.warn(
              '[TaskLogger] No se pudo guardar el log en Supabase:',
              error.message
            );
          }
        })
        .catch(error => {
          console.warn(
            '[TaskLogger] Error al escribir en task_logs:',
            error.message
          );
        });
    } catch (error) {
      console.warn(
        '[TaskLogger] Fallo al preparar el log:',
        error.message
      );
    }
  }

  // Muestra un aviso temporal en pantalla cuando hay un error de validación o de conexión.
  function mostrarError(mensaje) {
    const existing = document.querySelector('.error-notification');
    if (existing) existing.remove();

    const errorBox = document.createElement('div');
    errorBox.className = 'error-notification';
    errorBox.textContent = mensaje;
    document.body.appendChild(errorBox);

    setTimeout(() => {
      errorBox.remove();
    }, 2500);
  }

  function mostrarCarga(activo) {
    if (!elements.addButton) return;

    elements.addButton.disabled = activo;
    elements.addButton.textContent = activo
      ? 'Añadiendo...'
      : 'Añadir';
  }

  // ==================== UTILIDADES DE FECHA ====================

  // Formatea las fechas para mostrarlas al usuario en formato local.
  function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha';

    const fechaValor =
      typeof fecha === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ? `${fecha}T12:00:00`
        : fecha;

    const parsed = new Date(fechaValor);

    if (Number.isNaN(parsed.getTime())) {
      return 'Sin fecha';
    }

    return parsed.toLocaleDateString('es-ES');
  }

  function formatearFechaHora(fecha) {
    if (!fecha) return 'Sin fecha';

    const parsed = new Date(fecha);

    if (Number.isNaN(parsed.getTime())) {
      return 'Sin fecha';
    }

    return parsed.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatearFechaHoraParaInput(fecha) {
    if (!fecha) return '';

    const parsed = new Date(fecha);

    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const pad = numero => String(numero).padStart(2, '0');

    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }

  function getTaskDateValue() {
    if (!elements.taskDate) return null;

    const value = elements.taskDate.value.trim();

    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      console.warn('Fecha/hora no válida:', value);
      return null;
    }

    return date.toISOString();
  }

  // Normaliza los datos que llegan de Supabase para que siempre tengan la misma estructura.
  function normalizarTarea(task) {
    const fechaCuandoHacerla =
      task.cuando_Hacerla ||
      task.cuando_hacerla ||
      task.when_to_do ||
      null;

    return {
      ...task,
      id: task.id,
      text: task.text || task.title || 'Tarea sin título',
      completed: Boolean(task.completed),
      usuarios: task.usuarios || 'micaela',
      cuando_Hacerla: fechaCuandoHacerla,
      created_at:
        task.created_at ||
        task.createdAt ||
        new Date().toISOString(),
      createdAt:
        task.created_at ||
        task.createdAt ||
        new Date().toISOString()
    };
  }

  // Devuelve el usuario elegido en el selector del formulario.
  function getUserValue() {
    return elements.taskPriority
      ? elements.taskPriority.value
      : 'micaela';
  }

  // Obtiene el tipo de tarea seleccionado (única o repetitiva)
  function getTaskType() {
    const checked = Array.from(elements.taskTypeRadios || [])
      .find(radio => radio.checked);
    return checked ? checked.value : 'single';
  }

  // Genera un rango de fechas basado en frecuencia
  function generarFechasRepetitivas(fechaInicio, fechaFin, frecuencia) {
    const fechas = [];
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    let actual = new Date(inicio);

    let incrementoDias = 1;
    switch (frecuencia) {
      case 'daily':
        incrementoDias = 1;
        break;
      case 'weekly':
        incrementoDias = 7;
        break;
      case 'biweekly':
        incrementoDias = 15;
        break;
      case 'monthly':
        incrementoDias = 30;
        break;
      default:
        incrementoDias = 1;
    }

    while (actual <= fin) {
      fechas.push(new Date(actual).toISOString());
      actual.setDate(actual.getDate() + incrementoDias);
    }

    return fechas;
  }

  async function dispararWebhookMake(accion, tarea) {
    if (
      !MAKE_WEBHOOK_URL ||
      MAKE_WEBHOOK_URL.includes('TU_WEBHOOK')
    ) {
      return false;
    }

    try {
      const response = await fetch(
        MAKE_WEBHOOK_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accion,
            tarea,
            timestamp: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      console.log(
        '[Make] Webhook disparado:',
        accion,
        tarea?.id || '(sin id)'
      );

      return true;
    } catch (error) {
      console.warn(
        '[Make] No se pudo disparar el webhook:',
        error.message
      );

      return false;
    }
  }

  /*
   * Obtiene la fecha/hora del formulario en formato ISO.
   * Esta función se utiliza al crear y modificar tareas.
   */
  function getTaskDateValueForPayload() {
    return getTaskDateValue();
  }

  function getTaskDate(task) {
    return (
      task?.cuando_Hacerla ||
      task?.cuando_hacerla ||
      task?.when_to_do ||
      null
    );
  }

  // ==================== ESTADÍSTICAS Y RENDERIZADO ====================

  /*
   * Cuenta cuántas tareas ACTIVAS (no completadas) tiene asignadas
   * un usuario concreto. Se usa para las tarjetas "Tareas de Filippa",
   * "Tareas de Micaela" y "Tareas de Marcos" del panel de estadísticas.
   *
   * Se cuentan solo las pendientes (y no el total) porque lo que le
   * interesa a la familia es "cuánto le queda por hacer a cada uno",
   * no cuántas tareas acumuló históricamente.
   */
  function contarTareasActivasPorUsuario(usuario) {
    return state.tasks.filter(
      task => !task.completed && task.usuarios === usuario
    ).length;
  }

  /*
   * Actualiza el panel de estadísticas (arriba de la lista de tareas):
   * - Total de tareas (completadas + pendientes)
   * - Pendientes / Completadas en general
   * - Pendientes por cada usuario: Filippa, Micaela y Marcos
   *
   * Se llama cada vez que cambia el estado de las tareas (al cargar,
   * añadir, editar, borrar o marcar como completada), así el panel
   * siempre refleja el estado actual de `state.tasks`.
   */
  function updateTaskCounter() {
    const total = state.tasks.length;

    const tareasActivas = state.tasks.filter(
      task => !task.completed
    );

    const pendientes = tareasActivas.length;

    const completadas = state.tasks.filter(
      task => task.completed
    ).length;

    // Pendientes por usuario, reutilizando la misma lógica para los tres.
    const pendientesFilippa = contarTareasActivasPorUsuario('filippa');
    const pendientesMicaela = contarTareasActivasPorUsuario('micaela');
    const pendientesMarcos = contarTareasActivasPorUsuario('marcos');

    if (elements.statPending) {
      elements.statPending.textContent = `${pendientes}`;
    }

    if (elements.statTotal) {
      elements.statTotal.textContent = String(total);
    }

    if (elements.statCompleted) {
      elements.statCompleted.textContent = String(completadas);
    }

    if (elements.statFilippa) {
      elements.statFilippa.textContent = String(pendientesFilippa);
    }

    if (elements.statMicaela) {
      elements.statMicaela.textContent = String(pendientesMicaela);
    }

    if (elements.statHighPriority) {
      elements.statHighPriority.textContent = String(pendientesMarcos);
    }

    if (elements.taskCounter) {
      elements.taskCounter.textContent = '';
    }
  }

  // Aplica filtros por estado y texto para mostrar solo las tareas relevantes.
  function getFilteredTasks() {
    const busqueda = (
      elements.searchInput
        ? elements.searchInput.value
        : ''
    )
      .trim()
      .toLowerCase();

    let tareasFiltradas = [...state.tasks];

    if (state.filter === 'pending') {
      tareasFiltradas = tareasFiltradas.filter(
        task => !task.completed
      );
    } else if (state.filter === 'completed') {
      tareasFiltradas = tareasFiltradas.filter(
        task => task.completed
      );
    }

    if (busqueda) {
      tareasFiltradas = tareasFiltradas.filter(
        task =>
          task.text
            .toLowerCase()
            .includes(busqueda)
      );
    }

    tareasFiltradas.sort((a, b) => {
      const fechaA = getTaskDate(a);
      const fechaB = getTaskDate(b);

      if (!fechaA && !fechaB) return 0;
      if (!fechaA) return 1;
      if (!fechaB) return -1;

      return new Date(fechaA) - new Date(fechaB);
    });

    return tareasFiltradas;
  }

  // Dibuja la lista de tareas en el DOM según el estado actual y el filtro activo.
  function renderTasks() {
    if (!elements.taskList) return;

    updateTaskCounter();

    elements.taskList.innerHTML = '';

    const filteredTasks = getFilteredTasks();

    updateTaskCounter();

    if (filteredTasks.length === 0) {
      const emptyState = document.createElement('li');

      emptyState.className = 'empty-state';
      emptyState.textContent =
        'No hay tareas en este filtro.';

      elements.taskList.appendChild(emptyState);

      return;
    }

    filteredTasks.forEach(task => {
      const li = document.createElement('li');
      const content = document.createElement('div');
      const span = document.createElement('span');
      const actions = document.createElement('div');
      const editBtn = document.createElement('button');
      const deleteBtn = document.createElement('button');
      const time = document.createElement('small');
      const priorityTag = document.createElement('span');

      content.className = 'task-main-content';
      actions.className = 'task-actions';

      span.textContent = task.text;

      priorityTag.textContent =
        task.usuarios || 'micaela';

      priorityTag.className =
        `priority-badge priority-${task.usuarios || 'micaela'}`;

      const fechaTarea = getTaskDate(task);

      time.textContent = fechaTarea
        ? `📅 ${formatearFechaHora(fechaTarea)}`
        : '📅 Sin fecha';

      time.className = 'task-time';

      if (task.completed) {
        li.classList.add('completed');
      }

      span.addEventListener('click', () =>
        toggleTask(task.id)
      );

      editBtn.textContent = '✏️';
      editBtn.className = 'edit-btn';
      editBtn.title = 'Editar tarea';

      editBtn.addEventListener('click', () => {
        state.editingTaskId = task.id;

        if (elements.taskInput) {
          elements.taskInput.value =
            task.text || '';
        }

        if (elements.taskPriority) {
          elements.taskPriority.value =
            task.usuarios || 'micaela';
        }

        /*
         * IMPORTANTE:
         * Convertimos la fecha de Supabase al formato
         * que acepta datetime-local.
         */
        if (elements.taskDate) {
          elements.taskDate.value =
            formatearFechaHoraParaInput(fechaTarea);
        }

        if (elements.addButton) {
          elements.addButton.textContent =
            'Guardar cambios';
        }

        elements.taskInput?.focus();
      });

      deleteBtn.textContent = '🗑️';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Eliminar tarea';

      deleteBtn.addEventListener('click', () =>
        deleteTask(task.id)
      );

      content.appendChild(priorityTag);
      content.appendChild(span);
      content.appendChild(time);

      li.appendChild(content);

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(actions);

      elements.taskList.appendChild(li);
    });
  }

  // Prepara el objeto que se enviará a Supabase cuando se cree una nueva tarea.
  function crearPayloadTarea(texto, usuario, fecha) {
    return {
      text: texto,
      completed: false,
      usuarios: usuario,
      cuando_Hacerla: fecha || null,
      created_at: new Date().toISOString()
    };
  }

  // Genera un PDF con una tabla de tareas y sus columnas relevantes.
  function exportarPDF() {
    if (!state.tasks.length) {
      mostrarError(
        'No hay tareas para exportar.'
      );

      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      mostrarError(
        'La librería de PDF no está disponible.'
      );

      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const columnas = [
      'ID',
      'Tarea',
      'Estado',
      'Prioridad',
      'Cuando_Hacerla',
      'Fecha de creación'
    ];

    const filas = state.tasks.map(task => [
      String(task.id ?? ''),
      String(task.text ?? ''),
      task.completed
        ? 'Completada'
        : 'Pendiente',
      String(task.usuarios ?? 'micaela'),
      String(
        getTaskDate(task)
          ? formatearFechaHora(getTaskDate(task))
          : 'Sin fecha'
      ),
      String(
        task.created_at ||
        task.createdAt ||
        ''
      )
    ]);

    doc.setFontSize(16);
    doc.text(
      'Listado de tareas',
      14,
      18
    );

    doc.autoTable({
      head: [columnas],
      body: filas,
      startY: 26,
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [92, 124, 250],
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: {
        left: 14,
        right: 14
      }
    });

    doc.save('tareas.pdf');

    registrarLog(
      'export_pdf',
      {
        count: state.tasks.length
      }
    );
  }

  function exportarCSV() {
    return exportarPDF();
  }

  // ==================== OPERACIONES CRUD (SUPABASE) ====================

  // Carga todas las tareas existentes desde la tabla tasks.
  async function getTasksFromSupabase() {
    if (!supabase) {
      console.warn(
        'Supabase no disponible.'
      );

      registrarLog(
        'supabase_no_available',
        {
          reason:
            'No hay cliente de Supabase'
        }
      );

      return;
    }

    try {
      registrarLog(
        'load_tasks_request',
        {
          source: 'supabase'
        }
      );

      const { data, error } =
        await supabase
          .from('tasks')
          .select('*')
          .order(
            'created_at',
            {
              ascending: false
            }
          );

      if (error) throw error;

      state.tasks = (
        data || []
      ).map(normalizarTarea);

      registrarLog(
        'load_tasks_success',
        {
          count: state.tasks.length
        }
      );

      renderTasks();
    } catch (error) {
      const errorMessage =
        error && error.message
          ? error.message
          : 'Error desconocido al cargar tareas desde Supabase';

      console.error(
        'Error al cargar tareas desde Supabase:',
        error
      );

      registrarLog(
        'load_tasks_error',
        {
          message: errorMessage,
          details: error && error.details ? error.details : null,
          code: error && error.code ? error.code : null
        }
      );

      const mensajeMostrado =
        /row-level security|permission denied|RLS/i.test(
          errorMessage
        )
          ? 'Supabase está bloqueando la lectura por políticas RLS. Revisa la política SELECT de la tabla tasks.'
          : errorMessage;

      mostrarError(mensajeMostrado);
    }
  }

  // Inserta una o múltiples tareas en Supabase según si es repetitiva o no
  async function addTask(text) {
    const value = text.trim();

    if (!value) return;

    if (!supabase) {
      mostrarError(
        'No hay conexión activa con Supabase.'
      );

      return;
    }

    const userValue =
      getUserValue();

    const taskType = getTaskType();
    let payloads = [];

    // Validar y construir payloads según el tipo de tarea
    if (taskType === 'repetitive') {
      if (!elements.taskDateStart || !elements.taskDateStart.value) {
        mostrarError('Selecciona una fecha de inicio para tareas repetitivas');
        return;
      }
      if (!elements.taskDateEnd || !elements.taskDateEnd.value) {
        mostrarError('Selecciona una fecha de fin para tareas repetitivas');
        return;
      }

      const frecuencia = elements.taskFrequency
        ? elements.taskFrequency.value
        : 'daily';

      const fechaInicio = elements.taskDateStart.value;
      const fechaFin = elements.taskDateEnd.value;

      if (new Date(fechaInicio) > new Date(fechaFin)) {
        mostrarError('La fecha de inicio no puede ser posterior a la fecha de fin');
        return;
      }

      const fechasGeneradas = generarFechasRepetitivas(
        fechaInicio,
        fechaFin,
        frecuencia
      );

      if (fechasGeneradas.length > 50) {
        mostrarError(
          `Se crearían ${fechasGeneradas.length} tareas. Máximo permitido: 50. Ajusta el rango o frecuencia.`
        );
        return;
      }

      payloads = fechasGeneradas.map(fecha =>
        crearPayloadTarea(value, userValue, fecha)
      );

      registrarLog(
        'add_repetitive_task_start',
        {
          text: value,
          usuarios: userValue,
          frecuencia: frecuencia,
          count: payloads.length
        }
      );
    } else {
      // Tarea única
      const taskDateValue =
        getTaskDateValueForPayload();

      payloads = [
        crearPayloadTarea(
          value,
          userValue,
          taskDateValue
        )
      ];

      registrarLog(
        'add_task_start',
        {
          text: value,
          usuarios: userValue
        }
      );
    }

    mostrarCarga(true);

    try {
      console.log(
        '[Task] Payloads que se enviarán a Supabase:',
        payloads
      );

      const result =
        await supabase
          .from('tasks')
          .insert(payloads)
          .select();

      if (result.error) {
        if (
          /usuarios/.test(
            result.error.message
          )
        ) {
          const sqlError =
            new Error(
              'Falta la columna usuarios en la tabla tasks. Ejecuta el SQL de Supabase indicado en la documentación.'
            );

          registrarLog(
            'add_task_error',
            {
              message:
                sqlError.message,
              payloads
            },
            {
              request: payloads
            }
          );

          throw sqlError;
        }

        registrarLog(
          'add_task_error',
          {
            message:
              result.error.message,
            payloads
          },
          {
            request: payloads
          }
        );

        throw result.error;
      }

      const insertedTasks = result.data || payloads;

      state.tasks = [
        ...insertedTasks.map(normalizarTarea),
        ...state.tasks
      ];

      // Disparar webhook para cada tarea creada
      for (const task of insertedTasks) {
        await dispararWebhookMake(
          'create',
          normalizarTarea(task)
        );
      }

      registrarLog(
        taskType === 'repetitive' ? 'add_repetitive_task_success' : 'add_task_success',
        {
          count: insertedTasks.length,
          usuarios: userValue,
          type: taskType
        },
        {
          saved: insertedTasks
        }
      );

      renderTasks();
    } catch (error) {
      console.error(
        'Error al añadir tarea en Supabase:',
        error.message
      );

      registrarLog(
        'add_task_failure',
        {
          message: error.message,
          usuarios: userValue,
          type: taskType
        },
        {
          request: {
            text: value,
            usuarios: userValue
          }
        }
      );

      mostrarError(
        error.message ||
        'No se pudo guardar la tarea en Supabase'
      );
    } finally {
      mostrarCarga(false);
    }
  }

  function resetTaskForm() {
    state.editingTaskId = null;

    if (elements.taskInput) {
      elements.taskInput.value = '';
    }

    if (elements.taskPriority) {
      elements.taskPriority.value = 'micaela';
    }

    if (elements.taskDate) {
      elements.taskDate.value = '';
    }

    if (elements.taskDateStart) {
      elements.taskDateStart.value = '';
    }

    if (elements.taskDateEnd) {
      elements.taskDateEnd.value = '';
    }

    if (elements.taskFrequency) {
      elements.taskFrequency.value = 'daily';
    }

    // Resetear a tarea única
    if (elements.taskTypeRadios && elements.taskTypeRadios.length > 0) {
      elements.taskTypeRadios[0].checked = true;
      if (elements.singleTaskFields) {
        elements.singleTaskFields.style.display = 'flex';
      }
      if (elements.repetitiveTaskFields) {
        elements.repetitiveTaskFields.style.display = 'none';
      }
    }

    if (elements.addButton) {
      elements.addButton.textContent = 'Añadir';
    }
  }

  /*
   * Actualiza una tarea existente en Supabase y en el estado local.
   * `cambios` es un objeto parcial: solo hace falta pasar las
   * propiedades que cambian (texto, usuario y/o fecha), las demás
   * se mantienen como estaban en la tarea original.
   */
  async function updateTask(id, cambios) {
    const task = state.tasks.find(
      item => item.id === id
    );

    if (!task) return;

    if (!supabase) {
      alert(
        'No hay conexión activa con Supabase.'
      );

      return;
    }

    const nuevoTexto =
      (cambios.text ?? task.text).trim();

    if (!nuevoTexto) {
      mostrarError(
        'La tarea no puede quedar vacía.'
      );

      return;
    }

    /*
     * Si cambios contiene cuando_Hacerla,
     * ya viene convertido a ISO desde el formulario.
     */
    const nuevaFecha =
      Object.prototype.hasOwnProperty.call(
        cambios,
        'cuando_Hacerla'
      )
        ? cambios.cuando_Hacerla || null
        : getTaskDate(task);

    const payload = {
      text: nuevoTexto,
      usuarios:
        cambios.usuarios ??
        task.usuarios ??
        'micaela',
      cuando_Hacerla: nuevaFecha
    };

    console.log(
      '[Task] Payload de actualización:',
      payload
    );

    try {
      const { data, error } =
        await supabase
          .from('tasks')
          .update(payload)
          .eq('id', id)
          .select();

      if (error) throw error;

      const updatedTask =
        data && data[0]
          ? data[0]
          : {
              ...task,
              ...payload
            };

      state.tasks =
        state.tasks.map(item =>
          item.id === id
            ? normalizarTarea({
                ...item,
                ...updatedTask,
                ...payload
              })
            : item
        );

      await dispararWebhookMake(
        'update',
        normalizarTarea({
          ...task,
          ...payload,
          ...updatedTask
        })
      );

      resetTaskForm();
      renderTasks();
    } catch (error) {
      console.error(
        'Error al actualizar tarea:',
        error.message
      );

      mostrarError(
        'No se pudo actualizar la tarea'
      );
    }
  }

  // Elimina una tarea concreta por su id.
  async function deleteTask(id) {
    if (!supabase) {
      alert(
        'No hay conexión activa con Supabase.'
      );

      return;
    }

    try {
      const { error } =
        await supabase
          .from('tasks')
          .delete()
          .eq('id', id);

      if (error) throw error;

      state.tasks =
        state.tasks.filter(
          task => task.id !== id
        );

      renderTasks();
    } catch (error) {
      console.error(
        'Error al borrar tarea:',
        error.message
      );

      mostrarError(
        'No se pudo borrar la tarea'
      );
    }
  }

  // Cambia el estado de completada/pending de una tarea.
  async function toggleTask(id) {
    const task = state.tasks.find(
      item => item.id === id
    );

    if (!task) return;

    if (!supabase) {
      alert(
        'No hay conexión activa con Supabase.'
      );

      return;
    }

    try {
      const { data, error } =
        await supabase
          .from('tasks')
          .update({
            completed:
              !task.completed
          })
          .eq('id', id)
          .select();

      if (error) throw error;

      state.tasks =
        state.tasks.map(item =>
          item.id === id
            ? normalizarTarea({
                ...item,
                ...data[0]
              })
            : item
        );

      renderTasks();
    } catch (error) {
      console.error(
        'Error al actualizar tarea:',
        error.message
      );

      mostrarError(
        'No se pudo actualizar la tarea'
      );
    }
  }

  // Borra todas las tareas marcadas como completadas.
  /*
   * Borra de Supabase (y del estado local) todas las tareas que
   * ya están marcadas como completadas. Si no hay ninguna, no hace
   * falta llamar a la base de datos: simplemente se vuelve a
   * renderizar la lista tal cual está.
   */
  async function clearCompletedTasks() {
    const completedIds =
      state.tasks
        .filter(task => task.completed)
        .map(task => task.id);

    if (completedIds.length === 0) {
      renderTasks();
      return;
    }

    if (!supabase) {
      alert(
        'No hay conexión activa con Supabase.'
      );

      return;
    }

    try {
      const { error } =
        await supabase
          .from('tasks')
          .delete()
          .in(
            'id',
            completedIds
          );

      if (error) throw error;

      state.tasks =
        state.tasks.filter(
          task => !task.completed
        );

      renderTasks();
    } catch (error) {
      console.error(
        'Error al limpiar tareas completadas:',
        error.message
      );

      mostrarError(
        'No se pudieron borrar las tareas completadas'
      );
    }
  }

  /*
   * Función de ejemplo/prueba: consulta una API pública (JSONPlaceholder)
   * y devuelve solo los nombres de los usuarios de ejemplo. No forma
   * parte del flujo principal de la app; se expone en `window` para
   * poder probarla manualmente desde la consola del navegador.
   */
  async function obtenerNombresDeUsuarios() {
    try {
      const response =
        await fetch(
          'https://jsonplaceholder.typicode.com/users'
        );

      const usuarios =
        await response.json();

      const nombres =
        usuarios.map(
          usuario => usuario.name
        );

      console.log(
        'Usuarios:',
        nombres
      );

      return nombres;
    } catch (error) {
      console.error(
        'Error al cargar usuarios:',
        error
      );

      return [];
    }
  }

  /*
   * Función de ejemplo/prueba: envía un POST a una API pública
   * (JSONPlaceholder) con una tarea de prueba. Al igual que
   * `obtenerNombresDeUsuarios`, es solo para experimentar con
   * peticiones HTTP y no afecta a las tareas reales de Supabase.
   */
  async function crearTareaEnAPI() {
    const nuevaTarea = {
      userId: 1,
      title: 'Nueva tarea creada por POST',
      completed: false
    };

    try {
      const response =
        await fetch(
          'https://jsonplaceholder.typicode.com/todos',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify(
              nuevaTarea
            )
          }
        );

      const resultado =
        await response.json();

      console.log(
        'Respuesta del POST:',
        resultado
      );

      return resultado;
    } catch (error) {
      console.error(
        'Error al crear la tarea:',
        error
      );

      return null;
    }
  }

  // ==================== EVENTOS E INICIALIZACIÓN ====================

  // Enlaza los eventos de la interfaz con las funciones de la app.
  function bindEvents() {
    if (elements.addButton) {
      elements.addButton.addEventListener(
        'click',
        async () => {
          if (
            state.editingTaskId !== null
          ) {
            const text =
              elements.taskInput
                ? elements.taskInput.value.trim()
                : '';

            if (!text) {
              alert(
                'Escribe una tarea primero'
              );

              return;
            }

            await updateTask(
              state.editingTaskId,
              {
                text,
                usuarios:
                  getUserValue(),
                /*
                 * Ahora esta función devuelve
                 * fecha + hora en ISO.
                 */
                cuando_Hacerla:
                  getTaskDateValueForPayload()
              }
            );

            resetTaskForm();
            return;
          }

          const text =
            elements.taskInput
              ? elements.taskInput.value.trim()
              : '';

          if (!text) {
            alert(
              'Escribe una tarea primero'
            );

            return;
          }

          await addTask(text);

          if (elements.taskInput) {
            elements.taskInput.value = '';
            elements.taskInput.focus();
          }

          if (elements.taskDate) {
            elements.taskDate.value = '';
          }
        }
      );
    }

    if (elements.taskInput) {
      elements.taskInput.addEventListener(
        'keypress',
        event => {
          if (
            event.key === 'Enter' &&
            elements.addButton
          ) {
            elements.addButton.click();
          }
        }
      );
    }

    if (elements.searchInput) {
      elements.searchInput.addEventListener(
        'input',
        () => {
          renderTasks();
        }
      );
    }

    if (elements.filterSelect) {
      elements.filterSelect.addEventListener(
        'change',
        event => {
          state.filter =
            event.target.value;

          renderTasks();
        }
      );
    }

    if (elements.clearCompletedButton) {
      elements.clearCompletedButton.addEventListener(
        'click',
        async () => {
          await clearCompletedTasks();
        }
      );
    }

    if (elements.exportCsvBtn) {
      elements.exportCsvBtn.addEventListener(
        'click',
        () => {
          exportarPDF();
        }
      );
    }

    // Event listeners para cambiar entre tareas únicas y repetitivas
    if (elements.taskTypeRadios && elements.taskTypeRadios.length > 0) {
      elements.taskTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
          const taskType = event.target.value;
          
          if (taskType === 'single') {
            if (elements.singleTaskFields) {
              elements.singleTaskFields.style.display = 'flex';
            }
            if (elements.repetitiveTaskFields) {
              elements.repetitiveTaskFields.style.display = 'none';
            }
          } else {
            if (elements.singleTaskFields) {
              elements.singleTaskFields.style.display = 'none';
            }
            if (elements.repetitiveTaskFields) {
              elements.repetitiveTaskFields.style.display = 'flex';
            }
          }
        });
      });
    }
  }

  // Inicializa la app y carga las tareas desde Supabase si está disponible.
  function init() {
    /*
     * Nos aseguramos nuevamente de que el campo
     * sea de fecha + hora.
     */
    if (elements.taskDate) {
      elements.taskDate.type = 'datetime-local';
    }

    bindEvents();

    if (supabase) {
      getTasksFromSupabase();
    } else {
      mostrarError(
        'No se ha podido conectar con Supabase. Revisa la URL y la anon key.'
      );
    }
  }

  window.obtenerNombresDeUsuarios =
    obtenerNombresDeUsuarios;

  window.crearTareaEnAPI =
    crearTareaEnAPI;

  window.getTasksFromSupabase =
    getTasksFromSupabase;

  window.addTask =
    addTask;

  window.updateTask =
    updateTask;

  window.deleteTask =
    deleteTask;

  window.toggleTask =
    toggleTask;

  window.clearCompletedTasks =
    clearCompletedTasks;

  window.exportarPDF =
    exportarPDF;

  window.exportarCSV =
    exportarPDF;

  window.taskLogs =
    state.logs;

  window.registrarLog =
    registrarLog;

  init();
})();