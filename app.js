// app.js

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
const loadExampleBtn = document.getElementById('loadExampleBtn');
const loadingMessage = document.getElementById('loadingMessage');

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
  if (currentFilter === 'pending') return tasks.filter(task => !task.completed);
  if (currentFilter === 'completed') return tasks.filter(task => task.completed);
  return tasks;
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

    span.textContent = task.text;
    time.textContent = formatearFecha(task.created_at || task.createdAt);
    time.className = 'task-time';

    if (task.completed) li.classList.add('completed');

    span.addEventListener('click', () => toggleTask(task.id));

    deleteBtn.textContent = '🗑️';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

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
    alert('No se pudieron cargar las tareas desde Supabase');
  }
}

async function addTask(text) {
  const value = text.trim();
  if (!value) return;

  if (!supabase) {
    alert('No hay conexión activa con Supabase.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ text: value, completed: false, created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;

    tasks = [normalizarTarea(data[0]), ...tasks];
    renderTasks();
  } catch (error) {
    console.error('Error al añadir tarea en Supabase:', error.message);
    alert('No se pudo guardar la tarea en Supabase');
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
    alert('No se pudo borrar la tarea');
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
    alert('No se pudo actualizar la tarea');
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
    alert('No se pudieron borrar las tareas completadas');
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

async function cargarTareasDeAPI() {
  if (!loadingMessage || !loadExampleBtn) return;

  loadExampleBtn.disabled = true;
  loadingMessage.hidden = false;
  loadingMessage.textContent = 'Cargando tareas de ejemplo...';

  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
    const tareasAPI = await response.json();

    if (!supabase) {
      alert('Supabase no está disponible para guardar las tareas de ejemplo.');
      return;
    }

    const tareasParaInsertar = tareasAPI.map(tarea => ({
      text: tarea.title,
      completed: tarea.completed,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('tasks').insert(tareasParaInsertar);
    if (error) throw error;

    await getTasksFromSupabase();
  } catch (error) {
    console.error('Error al cargar tareas de ejemplo:', error);
    alert('No se pudieron cargar las tareas de ejemplo');
  } finally {
    loadExampleBtn.disabled = false;
    loadingMessage.hidden = true;
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

if (filterSelect) {
  filterSelect.addEventListener('change', (event) => {
    currentFilter = event.target.value;
    renderTasks();
  });
}

if (clearCompletedButton) {
  clearCompletedButton.addEventListener('click', async () => {
    await clearCompletedTasks();
  });
}

if (loadExampleBtn) {
  loadExampleBtn.addEventListener('click', cargarTareasDeAPI);
}

if (supabase) {
  getTasksFromSupabase();
} else {
  alert('No se ha podido conectar con Supabase. Revisa la URL y la anon key.');
}

window.obtenerNombresDeUsuarios = obtenerNombresDeUsuarios;
window.crearTareaEnAPI = crearTareaEnAPI;
window.getTasksFromSupabase = getTasksFromSupabase;
window.addTask = addTask;
window.deleteTask = deleteTask;
window.toggleTask = toggleTask;
window.clearCompletedTasks = clearCompletedTasks;
window.cargarTareasDeAPI = cargarTareasDeAPI;
