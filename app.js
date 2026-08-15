(() => {
  const SUPABASE_URL = 'https://qdierydswmebuwwvmywa.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaWVyeWRzd21lYnV3d3ZteXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgzMzAsImV4cCI6MjEwMjA2NDMzMH0.W7YgaAWMuqSlExpuvjRqYU7hFMaCqVTHK-klttNex1s';

  // Estado global de la app: tareas actuales, filtro activo y registro de eventos.
  const state = {
    tasks: [],
    filter: 'all',
    logs: []
  };

  // Cliente de Supabase para leer y guardar tareas.
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const elements = {
    taskInput: document.getElementById('taskInput'),
    addButton: document.getElementById('addButton'),
    taskList: document.getElementById('taskList'),
    taskCounter: document.getElementById('taskCounter'),
    clearCompletedButton: document.getElementById('clearCompletedButton'),
    filterSelect: document.getElementById('filterSelect'),
    searchInput: document.getElementById('searchInput'),
    taskPriority: document.getElementById('taskPriority'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    statTotal: document.getElementById('statTotal'),
    statPending: document.getElementById('statPending'),
    statCompleted: document.getElementById('statCompleted'),
    statHighPriority: document.getElementById('statHighPriority')
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
            console.warn('[TaskLogger] No se pudo guardar el log en Supabase:', error.message);
          }
        })
        .catch(error => {
          console.warn('[TaskLogger] Error al escribir en task_logs:', error.message);
        });
    } catch (error) {
      console.warn('[TaskLogger] Fallo al preparar el log:', error.message);
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
    elements.addButton.textContent = activo ? 'Añadiendo...' : 'Añadir';
  }

  // Formatea las fechas para mostrarlas en el usuario en formato local.
  function formatearFecha(fecha) {
    if (!fecha) return new Date().toLocaleString('es-ES');
    return new Date(fecha).toLocaleString('es-ES');
  }

  // Normaliza los datos que llegan de Supabase para que siempre tengan la misma estructura.
  function normalizarTarea(task) {
    return {
      ...task,
      id: task.id,
      text: task.text || task.title || 'Tarea sin título',
      completed: Boolean(task.completed),
      priority: task.priority || 'media',
      created_at: task.created_at || task.createdAt || new Date().toISOString(),
      createdAt: task.created_at || task.createdAt || new Date().toISOString()
    };
  }

  // Devuelve la prioridad elegida en el selector del formulario.
  function getPriorityValue() {
    return elements.taskPriority ? elements.taskPriority.value : 'media';
  }

  // Actualiza el texto con el número de tareas pendientes y los indicadores de estadística.
  function updateTaskCounter() {
    const total = state.tasks.length;
    const pendientes = state.tasks.filter(task => !task.completed).length;
    const completadas = state.tasks.filter(task => task.completed).length;
    const altas = state.tasks.filter(task => task.priority === 'alta').length;

    if (elements.taskCounter) {
      elements.taskCounter.textContent = pendientes === 1 ? '1 tarea pendiente' : `${pendientes} tareas pendientes`;
    }

    if (elements.statTotal) elements.statTotal.textContent = String(total);
    if (elements.statPending) elements.statPending.textContent = String(pendientes);
    if (elements.statCompleted) elements.statCompleted.textContent = String(completadas);
    if (elements.statHighPriority) elements.statHighPriority.textContent = String(altas);
  }

  // Aplica filtros por estado y texto para mostrar solo las tareas relevantes.
  function getFilteredTasks() {
    const busqueda = (elements.searchInput ? elements.searchInput.value : '').trim().toLowerCase();
    let tareasFiltradas = [...state.tasks];

    if (state.filter === 'pending') {
      tareasFiltradas = tareasFiltradas.filter(task => !task.completed);
    } else if (state.filter === 'completed') {
      tareasFiltradas = tareasFiltradas.filter(task => task.completed);
    }

    if (busqueda) {
      tareasFiltradas = tareasFiltradas.filter(task => task.text.toLowerCase().includes(busqueda));
    }

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
      emptyState.textContent = 'No hay tareas en este filtro.';
      elements.taskList.appendChild(emptyState);
      return;
    }

    filteredTasks.forEach(task => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      const deleteBtn = document.createElement('button');
      const time = document.createElement('small');
      const priorityTag = document.createElement('span');

      span.textContent = task.text;
      priorityTag.textContent = task.priority || 'media';
      priorityTag.className = `priority-badge priority-${task.priority || 'media'}`;
      time.textContent = formatearFecha(task.created_at || task.createdAt);
      time.className = 'task-time';

      if (task.completed) li.classList.add('completed');

      span.addEventListener('click', () => toggleTask(task.id));

      deleteBtn.textContent = '🗑️';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => deleteTask(task.id));

      li.appendChild(priorityTag);
      li.appendChild(span);
      li.appendChild(time);
      li.appendChild(deleteBtn);
      elements.taskList.appendChild(li);
    });
  }

  // Prepara el objeto que se enviará a Supabase cuando se cree una nueva tarea.
  function crearPayloadTarea(texto, prioridad) {
    return {
      text: texto,
      completed: false,
      priority: prioridad,
      created_at: new Date().toISOString()
    };
  }

  // Genera un PDF con una tabla de tareas y sus columnas relevantes.
  function exportarPDF() {
    if (!state.tasks.length) {
      mostrarError('No hay tareas para exportar.');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      mostrarError('La librería de PDF no está disponible.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const columnas = ['ID', 'Tarea', 'Estado', 'Prioridad', 'Fecha'];
    const filas = state.tasks.map(task => [
      String(task.id ?? ''),
      String(task.text ?? ''),
      task.completed ? 'Completada' : 'Pendiente',
      String(task.priority ?? 'media'),
      String(task.created_at || task.createdAt || '')
    ]);

    doc.setFontSize(16);
    doc.text('Listado de tareas', 14, 18);

    doc.autoTable({
      head: [columnas],
      body: filas,
      startY: 26,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [92, 124, 250], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 }
    });

    doc.save('tareas.pdf');
    registrarLog('export_pdf', { count: state.tasks.length });
  }

  function exportarCSV() {
    return exportarPDF();
  }

  // Carga todas las tareas existentes desde la tabla tasks.
  async function getTasksFromSupabase() {
    if (!supabase) {
      console.warn('Supabase no disponible.');
      registrarLog('supabase_no_available', { reason: 'No hay cliente de Supabase' });
      return;
    }

    try {
      registrarLog('load_tasks_request', { source: 'supabase' });

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.tasks = (data || []).map(normalizarTarea);
      registrarLog('load_tasks_success', { count: state.tasks.length });
      renderTasks();
    } catch (error) {
      console.error('Error al cargar tareas desde Supabase:', error.message);
      registrarLog('load_tasks_error', { message: error.message });
      mostrarError('No se pudieron cargar las tareas desde Supabase');
    }
  }

  // Inserta una nueva tarea en Supabase y la añade al estado local para re-renderizar la vista.
  async function addTask(text) {
    const value = text.trim();
    if (!value) return;

    if (!supabase) {
      mostrarError('No hay conexión activa con Supabase.');
      return;
    }

    const priorityValue = getPriorityValue();
    mostrarCarga(true);
    registrarLog('add_task_start', { text: value, priority: priorityValue });

    try {
      const payload = crearPayloadTarea(value, priorityValue);
      const result = await supabase
        .from('tasks')
        .insert([payload])
        .select();

      if (result.error) {
        if (/priority/.test(result.error.message)) {
          const sqlError = new Error('Falta la columna priority en la tabla tasks. Ejecuta el SQL de Supabase indicado en la documentación.');
          registrarLog('add_task_error', { message: sqlError.message, payload }, { request: payload });
          throw sqlError;
        }

        registrarLog('add_task_error', { message: result.error.message, payload }, { request: payload });
        throw result.error;
      }

      const insertedTask = result.data && result.data[0] ? result.data[0] : payload;
      state.tasks = [normalizarTarea(insertedTask), ...state.tasks];
      registrarLog('add_task_success', { id: insertedTask.id, priority: insertedTask.priority || priorityValue }, { saved: insertedTask });
      renderTasks();
    } catch (error) {
      console.error('Error al añadir tarea en Supabase:', error.message);
      registrarLog('add_task_failure', { message: error.message, priority: priorityValue }, { request: { text: value, priority: priorityValue } });
      mostrarError(error.message || 'No se pudo guardar la tarea en Supabase');
    } finally {
      mostrarCarga(false);
    }
  }

  // Elimina una tarea concreta por su id.
  async function deleteTask(id) {
    if (!supabase) {
      alert('No hay conexión activa con Supabase.');
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;

      state.tasks = state.tasks.filter(task => task.id !== id);
      renderTasks();
    } catch (error) {
      console.error('Error al borrar tarea:', error.message);
      mostrarError('No se pudo borrar la tarea');
    }
  }

  // Cambia el estado de completada/pending de una tarea.
  async function toggleTask(id) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;

    if (!supabase) {
      alert('No hay conexión activa con Supabase.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', id)
        .select();

      if (error) throw error;

      state.tasks = state.tasks.map(item => item.id === id ? normalizarTarea({ ...item, ...data[0] }) : item);
      renderTasks();
    } catch (error) {
      console.error('Error al actualizar tarea:', error.message);
      mostrarError('No se pudo actualizar la tarea');
    }
  }

  // Borra todas las tareas marcadas como completadas.
  async function clearCompletedTasks() {
    const completedIds = state.tasks.filter(task => task.completed).map(task => task.id);

    if (completedIds.length === 0) {
      renderTasks();
      return;
    }

    if (!supabase) {
      alert('No hay conexión activa con Supabase.');
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().in('id', completedIds);
      if (error) throw error;

      state.tasks = state.tasks.filter(task => !task.completed);
      renderTasks();
    } catch (error) {
      console.error('Error al limpiar tareas completadas:', error.message);
      mostrarError('No se pudieron borrar las tareas completadas');
    }
  }

  async function obtenerNombresDeUsuarios() {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const usuarios = await response.json();
      const nombres = usuarios.map(usuario => usuario.name);
      console.log('Usuarios:', nombres);
      return nombres;
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      return [];
    }
  }

  async function crearTareaEnAPI() {
    const nuevaTarea = {
      userId: 1,
      title: 'Nueva tarea creada por POST',
      completed: false
    };

    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaTarea)
      });

      const resultado = await response.json();
      console.log('Respuesta del POST:', resultado);
      return resultado;
    } catch (error) {
      console.error('Error al crear la tarea:', error);
      return null;
    }
  }

  // Enlaza los eventos de la interfaz con las funciones de la app.
  function bindEvents() {
    if (elements.addButton) {
      elements.addButton.addEventListener('click', async () => {
        const text = elements.taskInput ? elements.taskInput.value.trim() : '';

        if (!text) {
          alert('Escribe una tarea primero');
          return;
        }

        await addTask(text);

        if (elements.taskInput) {
          elements.taskInput.value = '';
          elements.taskInput.focus();
        }
      });
    }

    if (elements.taskInput) {
      elements.taskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && elements.addButton) {
          elements.addButton.click();
        }
      });
    }

    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', () => {
        renderTasks();
      });
    }

    if (elements.filterSelect) {
      elements.filterSelect.addEventListener('change', (event) => {
        state.filter = event.target.value;
        renderTasks();
      });
    }

    if (elements.clearCompletedButton) {
      elements.clearCompletedButton.addEventListener('click', async () => {
        await clearCompletedTasks();
      });
    }

    if (elements.exportCsvBtn) {
      elements.exportCsvBtn.addEventListener('click', () => {
        exportarPDF();
      });
    }
  }

  // Inicializa la app y carga las tareas desde Supabase si está disponible.
  function init() {
    bindEvents();

    if (supabase) {
      getTasksFromSupabase();
    } else {
      mostrarError('No se ha podido conectar con Supabase. Revisa la URL y la anon key.');
    }
  }

  window.obtenerNombresDeUsuarios = obtenerNombresDeUsuarios;
  window.crearTareaEnAPI = crearTareaEnAPI;
  window.getTasksFromSupabase = getTasksFromSupabase;
  window.addTask = addTask;
  window.deleteTask = deleteTask;
  window.toggleTask = toggleTask;
  window.clearCompletedTasks = clearCompletedTasks;
  window.exportarPDF = exportarPDF;
  window.exportarCSV = exportarPDF;
  window.taskLogs = state.logs;
  window.registrarLog = registrarLog;

  init();
})();
