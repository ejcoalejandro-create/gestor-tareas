// app.js
const SUPABASE_URL = "https://qdierydswmebuwwvmywa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaWVyeWRzd21lYnV3d3ZteXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODgzMzAsImV4cCI6MjEwMjA2NDMzMH0.W7YgaAWMuqSlExpuvjRqYU7hFMaCqVTHK-klttNex1s";

// Crear cliente de Supabase
const supabasconnection = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase conectado:', supabaseconnection);

async function getTasks() {
try {
const { data, error } = await supabase
.from('tasks')
.select('*')
.order('created_at', { ascending: false });
if (error) throw error;
tasks = data;
renderTasks();
} catch (error) {
console.error('Error al cargar tareas:', error.message);
mostrarError('No se pudieron cargar las tareas');
}
}
async function addTask(text) {
try {
const { data, error } = await supabase
.from('tasks')
.insert([{ text, completed: false }])
.select();
if (error) throw error;
// Añadir a array local
tasks.unshift(data[0]);
renderTasks();
} catch (error) {
console.error('Error al añadir tarea:', error.message);
mostrarError('No se pudo añadir la tarea');
}
}
async function toggleTask(id) {
try {
// Encontrar tarea actual
const tarea = tasks.find(t => t.id === id);
if (!tarea) return;
const { data, error } = await supabase
.from('tasks')
.update({ completed: !tarea.completed })
.eq('id', id)
.select();
if (error) throw error;
// Actualizar array local
const index = tasks.findIndex(t => t.id === id);
tasks[index] = data[0];
renderTasks();
} catch (error) {
console.error('Error al actualizar tarea:', error.message);
mostrarError('No se pudo actualizar la tarea');
}
}
async function deleteTask(id) {
try {
const { error } = await supabase
.from('tasks')
.delete()
.eq('id', id);
if (error) throw error;
// Eliminar de array local
tasks = tasks.filter(t => t.id !== id);
renderTasks();
} catch (error) {
console.error('Error al eliminar tarea:', error.message);
mostrarError('No se pudo eliminar la tarea');
}
}

// ========== INTERFAZ (igual que antes) ==========
const taskInput = document.getElementById('taskInput');
const addButton = document.getElementById('addButton');
const taskList = document.getElementById('taskList');
function renderTasks() {
taskList.innerHTML = '';
tasks.forEach(task => {
const li = document.createElement('li');
const span = document.createElement('span');
const deleteBtn = document.createElement('button');
span.textContent = task.text;
if (task.completed) {
li.classList.add('completed');
}
span.addEventListener('click', () => toggleTask(task.id));
deleteBtn.textContent = '🗑️';
deleteBtn.className = 'delete-btn';
deleteBtn.addEventListener('click', () => deleteTask(task.id));
li.appendChild(span);
li.appendChild(deleteBtn);
taskList.appendChild(li);
});
}
addButton.addEventListener('click', async () => {
const text = taskInput.value.trim();
if (text === '') {
alert('Escribe una tarea primero');
return;
}
await addTask(text);
taskInput.value = '';
taskInput.focus();
});
taskInput.addEventListener('keypress', (e) => {
if (e.key === 'Enter') {
addButton.click();
}
});

async function obtenerNombresDeUsuarios() {
try {
const response = await fetch('https://jsonplaceholder.typicode.com/users');
const usuarios = await response.json();
const nombres = usuarios.map(usuario => usuario.name);
console.log(nombres);
} catch (error) {
console.error('Error al cargar usuarios:', error);
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
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify(nuevaTarea)
});

const resultado = await response.json();
console.log('Respuesta del POST:', resultado);
return resultado;
} catch (error) {
console.error('Error al crear la tarea:', error);
}
}

const loadingMessage = document.getElementById('loadingMessage');

async function cargarTareasDeAPI() {
if (!loadExampleBtn || !loadingMessage) return;

loadExampleBtn.disabled = true;
loadingMessage.hidden = false;
loadingMessage.textContent = 'Cargando tareas de ejemplo...';

try {
const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
const tareasAPI = await response.json();

const tareasNuevas = tareasAPI.map(tarea => ({
id: tarea.id,
text: tarea.title,
completed: tarea.completed,
createdAt: new Date().toLocaleString('es-ES')
}));

const idsExistentes = new Set(tasks.map(task => task.id));
const tareasSinDuplicar = tareasNuevas.filter(tarea => !idsExistentes.has(tarea.id));

tasks = [...tasks, ...tareasSinDuplicar];
renderTasks();
} catch (error) {
console.error('Error al cargar tareas:', error);
alert('No se pudieron cargar las tareas de ejemplo');
} finally {
loadExampleBtn.disabled = false;
loadingMessage.hidden = true;
}
}
// Botón para cargar tareas de ejemplo
const loadExampleBtn = document.getElementById('loadExampleBtn');
if (loadExampleBtn) {
loadExampleBtn.addEventListener('click', cargarTareasDeAPI);
}

// ========== DATOS (del Módulo 2) ==========
let tasks = [];
function addTask(text) {
const newTask = {
id: Date.now(),
text: text,
completed: false,
createdAt: new Date().toLocaleString('es-ES')
};
tasks.push(newTask);
}
function getTasks() {
return tasks;
}
function deleteTask(id) {
tasks = tasks.filter(task => task.id !== id);
}
function toggleTask(id) {
tasks = tasks.map(task =>
task.id === id
? { ...task, completed: !task.completed }
: task
);
}
function clearCompletedTasks() {
tasks = tasks.filter(task => !task.completed);
}
// ========== INTERFAZ ==========
// 1. Seleccionar elementos del DOM
const taskInput = document.getElementById('taskInput');
const addButton = document.getElementById('addButton');
const taskList = document.getElementById('taskList');
const taskCounter = document.getElementById('taskCounter');
const clearCompletedButton = document.getElementById('clearCompletedButton');
const filterSelect = document.getElementById('filterSelect');
let currentFilter = 'all';

function updateTaskCounter() {
if (!taskCounter) return;

const pendingTasks = getTasks().filter(task => !task.completed).length;
const label = pendingTasks === 1 ? '1 tarea pendiente' : `${pendingTasks} tareas pendientes`;
taskCounter.textContent = label;
}

function getFilteredTasks() {
const allTasks = getTasks();

if (currentFilter === 'pending') {
return allTasks.filter(task => !task.completed);
}

if (currentFilter === 'completed') {
return allTasks.filter(task => task.completed);
}

return allTasks;
}

// 2. Función para pintar las tareas en pantalla
function renderTasks() {
// Limpiar la lista
taskList.innerHTML = '';
// Obtener tareas según el filtro
const filteredTasks = getFilteredTasks();
updateTaskCounter();

// Crear un <li> por cada tarea
filteredTasks.forEach(task => {
// Crear elementos
const li = document.createElement('li');
const span = document.createElement('span');
const deleteBtn = document.createElement('button');
const time = document.createElement('small');

// Configurar el contenido de la tarea
span.textContent = task.text;
time.textContent = task.createdAt;
time.className = 'task-time';

// Si está completada, añadir clase
if (task.completed) {
li.classList.add('completed');
}
// Click en el texto → marcar/desmarcar
span.addEventListener('click', () => {
toggleTask(task.id);
renderTasks();
});
// Configurar botón de eliminar
deleteBtn.textContent = '🗑️';
deleteBtn.className = 'delete-btn';
deleteBtn.addEventListener('click', () => {
deleteTask(task.id);
renderTasks();
});
// Ensamblar todo
li.appendChild(span);
li.appendChild(time);
li.appendChild(deleteBtn);
taskList.appendChild(li);
});
}
// 3. Evento del botón "Añadir"
addButton.addEventListener('click', () => {
const text = taskInput.value.trim();
// Validar que no esté vacío
if (text === '') {
alert('Escribe una tarea primero');
return;
}
// Añadir tarea
addTask(text);
// Actualizar la vista
renderTasks();
// Limpiar input
taskInput.value = '';
taskInput.focus();
});
// 4. Permitir añadir con Enter
taskInput.addEventListener('keypress', (e) => {
if (e.key === 'Enter') {
addButton.click();
}
});
// 5. Cambiar filtro
filterSelect.addEventListener('change', (e) => {
currentFilter = e.target.value;
renderTasks();
});

// 6. Renderizar al cargar la página
renderTasks();