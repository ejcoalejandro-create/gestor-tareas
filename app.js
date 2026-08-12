// app.js

async function cargarTareasDeAPI() {
try {
const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
const tareasAPI = await response.json();
// Convertir formato de la API a nuestro formato
tareasAPI.forEach(tarea => {
tasks.push({
id: tarea.id,
text: tarea.title,
completed: tarea.completed
});
});
renderTasks();
} catch (error) {
console.error('Error al cargar tareas:', error);
alert('No se pudieron cargar las tareas de ejemplo');
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