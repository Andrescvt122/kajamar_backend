# 🧩 Proyecto Kajamart — Guía de Inicio

## 🧠 Antes de comenzar

### 1️⃣ Instalación de dependencias
Ejecuta los siguientes comandos para instalar los paquetes necesarios:

```bash
npm i
npx i
```

### 2️⃣ Revisa los modelos de Prisma
Asegúrate de **entender la estructura de los modelos** en:

```
backend/prisma/schema.prisma
```

---

## ⚙️ Explicación de los scripts en `package.json`

> Para ejecutar cualquier script usa el siguiente formato:
>
> ```bash
> npm run <nombre_del_script>
> ```
>
> Ejemplos:
> - `npm run dev` → Ejecuta el proyecto en modo desarrollo.  
> - `npm run start` → Ejecuta el proyecto una sola vez.  

Estos scripts fueron creados para **agilizar el trabajo en terminal**, evitando tener que escribir manualmente comandos largos de `npx` o `prisma`.

---

### 🧩 Scripts disponibles

#### 🔸 `dev`
```bash
"dev": "cross-env NODE_ENV=development nodemon src/index.js"
```
Ejecuta el proyecto en **modo desarrollo** y mantiene la ejecución activa.  
El parámetro `cross-env NODE_ENV=development` define la variable de entorno `NODE_ENV` como “development”.

---

#### 🔸 `start`
```bash
"start": "node src/index.js"
```
Ejecuta el proyecto **una sola vez**.  
Ideal para **depuración** o pruebas rápidas con `console.log`.

---

#### 🔸 `build`
```bash
"build": "npx prisma generate"
```
Genera los clientes de **Prisma** en la carpeta `/generated`.  
Ejecuta este comando **la primera vez que clones el proyecto** o después de un `git pull`.

---

#### 🔸 `studio`
```bash
"studio": "npx prisma studio"
```
Abre **Prisma Studio**, una interfaz gráfica similar a *phpMyAdmin*, donde puedes visualizar y modificar los datos fácilmente.

---

#### 🔸 `migrate`
```bash
"migrate": "npx prisma migrate --name"
```
Se usa cuando **modificas o creas nuevos modelos** en `backend/prisma/schema.prisma`.

##### Ejemplo manual:
```bash
npx prisma migrate --name "initial migration"
```

##### Versión simplificada (recomendada):
```bash
npm run migrate "initial migration"
```
Hace lo mismo, pero de manera más rápida y legible.

---

## 📦 Cómo importar Prisma

No importes Prisma directamente desde `@prisma/client`.  
En su lugar, usa el cliente personalizado:

```js
const prisma = require("../prisma/prismaClient");
```

Este cliente incluye un **registro de historial de consultas**.  
Cada consulta que ejecuta Prisma se almacena automáticamente en:

```
backend/logs/query.log
```

Esto permite **rastrear consultas** y facilita la **depuración**.

---

## 📚 Estructura del proyecto

- Las rutas de la API deben seguir el formato:
  ```
  /kajamart/api/<nombre_de_ruta>
  ```
  Ejemplo:
  ```
  /kajamart/api/categories
  ```

- Todas las rutas deben definirse en:
  ```
  routes/index.js
  ```

- Los nombres de las rutas deben estar **en inglés**, por buenas prácticas y consistencia.

---

## ⚠️ Advertencias importantes

🚫 **NO HACER:**
- Modificar el `index.js` principal sin consultar al equipo.  
- Editar el archivo `src/prisma/prismaClient.js`.  
- Alterar las variables de entorno (`.env`) sin previo aviso o consenso.

✅ **SÍ HACER:**
- Respetar la estructura de carpetas y modularización.  
- Mantener el estándar de nombres y rutas.  
- Entender bien el código existente antes de realizar nuevos desarrollos.

---

## 💡 Recomendaciones

- Usa como referencia el **controlador y las rutas de “categorías”** para entender el estándar de la API.  
- Mantén las rutas dentro de la carpeta `routes` y centraliza todo en `routes/index.js`.  
- **Estudia el código**: no es extenso, pero comprenderlo completamente es clave para un desarrollo eficiente y coherente.

---

## 📘 Notas finales

Estos scripts y estructuras no son obligatorios, pero fueron creados para:
- Simplificar la ejecución del proyecto.
- Mantener un flujo de trabajo limpio y estandarizado.
- Evitar errores comunes en configuración y migraciones.
