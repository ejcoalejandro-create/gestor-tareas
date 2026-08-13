(() => {
  const SUPABASE_URL = 'https://qdierydswmebuwwvmywa.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaWVyeWRzd21lYnV3d3ZteXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgzMzAsImV4cCI6MjEwMjA2NDMzMH0.W7YgaAWMuqSlExpuvjRqYU7hFMaCqVTHK-klttNex1s';

  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  let tasks = [];
  let currentFilter = 'all';

  const taskInput = document.getElementById('taskInput');
  const addButton = document.getElementById('addButton');
  const taskList = document.getElementById('taskList');
  const taskCounter = document.getElementById('taskCounter');
  const clearCompletedButton = document.getElementById('clearCompletedButton');
  const filterSelect = document.getElementById('filterSelect');
  const searchInput = document.getElementById('searchInput');
  const taskPriority = document.getElementById('taskPriority');

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
    if (!addButton) return;
    addButton.disabled = activo;
    addButton.textContent = activo ? 'Añadiendo...' : 'Añadir';
  }

  function formatearFecha(fecha) {
    if (!fecha) return new Date().toLocaleString('es-ES');
    return new Date(fecha).toLocaleString('es-ES');
  }

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

  function updateTaskCounter() {
    if (!taskCounter) return;
    const pendingTasks = tasks.filter(task => !task.completed).length;
    taskCounter.textContent = pendingTasks === 1 ? '1 tarea pendiente' : `${pendingTasks} tareas pendientes`;
  }

  function getFilteredTasks() {
    const searchValue = (searchInput ? searchInput.value : '').trim().toLowerCase();

    let filtered = tasks;

    if (currentFilter === 'pending') {
      filtered = filtered.filter(task => !task.completed);
    } else if (currentFilter === 'completed') {
      filtered = filtered.filter(task => task.completed);
    }

    if (searchValue) {
      filtered = filtered.filter(task => task.text.toLowerCase().includes(searchValue));
    }

    return filtered;
  }

  function renderTasks() {
    if (!taskList) return;

    taskList.innerHTML = '';
    const filteredTasks = getFilteredTasks();
    updateTaskCounter();

    if (filteredTasks.length === 0) {
      const emptyState = document.createElement('li');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No hay tareas en este filtro.';
      taskList.appendChild(emptyState);
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
      taskList.appendChild(li);
    });
  }

  async function getTasksFromSupabase() {
    if (!supabase) {
      console.warn('Supabase no disponible.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      tasks = (data || []).map(normalizarTarea);
      renderTasks();
    } catch (error) {
      console.error('Error al cargar tareas desde Supabase:', error.message);
      mostrarError('No se pudieron cargar las tareas desde Supabase');
    }
  }

  async function addTask(text) {
    const value = text.trim();
    if (!value) return;

    if (!supabase) {
      mostrarError('No hay conexión activa con Supabase.');
      return;
    }

    const priorityValue = taskPriority ? taskPriority.value : 'media';
    mostrarCarga(true);

    try {
      const payload = {
        text: value,
        completed: false,
        priority: priorityValue,
        created_at: new Date().toISOString()
      };

      const result = await supabase
        .from('tasks')
        .insert([payload])
        .select();

      if (result.error) {
        if (/priority/.test(result.error.message)) {
          throw new Error('Falta la columna priority en la tabla tasks. Ejecuta el SQL de Supabase indicado en la documentación.');
        }
        throw result.error;
      }

      const insertedTask = result.data && result.data[0] ? result.data[0] : payload;
      tasks = [normalizarTarea(insertedTask), ...tasks];
      renderTasks();
    } catch (error) {
      console.error('Error al añadir tarea en Supabase:', error.message);
      mostrarError(error.message || 'No se pudo guardar la tarea en Supabase');
    } finally {
      mostrarCarga(false);
    }
  }

  async function deleteTask(id) {
    if (!supabase) {
      alert('No hay conexión activa con Supabase.');
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;

      tasks = tasks.filter(task => task.id !== id);
      renderTasks();
    } catch (error) {
      console.error('Error al borrar tarea:', error.message);
      mostrarError('No se pudo borrar la tarea');
    }
  }

  async function toggleTask(id) {
    const task = tasks.find(item => item.id === id);
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

      tasks = tasks.map(item => item.id === id ? normalizarTarea({ ...item, ...data[0] }) : item);
      renderTasks();
    } catch (error) {
      console.error('Error al actualizar tarea:', error.message);
      mostrarError('No se pudo actualizar la tarea');
    }
  }

  async function clearCompletedTasks() {
    const completedIds = tasks.filter(task => task.completed).map(task => task.id);

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

      tasks = tasks.filter(task => !task.completed);
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


  if (addButton) {
    addButton.addEventListener('click', async () => {
      const text = taskInput.value.trim();
      if (!text) {
        alert('Escribe una tarea primero');
        return;
      }

      await addTask(text);
      taskInput.value = '';
      taskInput.focus();
    });
  }

  if (taskInput) {
    taskInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') addButton.click();
    });
  }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderTasks();
      });
    }


  if (clearCompletedButton) {
    clearCompletedButton.addEventListener('click', async () => {
      await clearCompletedTasks();
    });
  }

  if (supabase) {
    getTasksFromSupabase();
  } else {
    mostrarError('No se ha podido conectar con Supabase. Revisa la URL y la anon key.');
  }

  window.obtenerNombresDeUsuarios = obtenerNombresDeUsuarios;
  window.crearTareaEnAPI = crearTareaEnAPI;
  window.getTasksFromSupabase = getTasksFromSupabase;
  window.addTask = addTask;
  window.deleteTask = deleteTask;
  window.toggleTask = toggleTask;
  window.clearCompletedTasks = clearCompletedTasks;
})();
