# Yukihira Diner — Dockerized Website

Yukihira Diner is a restaurant/menu website inspired by *Food Wars*. It is built with Node.js, Express, EJS, MongoDB, and Mongoose. The project includes public-facing menu pages and an admin area for managing dishes.

The project has also been prepared for an advanced asynchronous image-processing feature using RabbitMQ and a separate Worker service. That feature is active only after the image-pipeline files and the matching Docker Compose configuration have been integrated into the project.

## Table of contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Run locally with Docker Compose](#run-locally-with-docker-compose)
- [Run the Node.js app without Docker](#run-the-nodejs-app-without-docker)
- [Environment variables](#environment-variables)
- [Admin account](#admin-account)
- [Asynchronous image processing](#asynchronous-image-processing)
- [Useful Docker commands](#useful-docker-commands)
- [Testing checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)
- [Security and production notes](#security-and-production-notes)

## Features

### Website and menu
- Server-rendered pages using EJS templates.
- Public pages for browsing dishes.
- Dish records stored in MongoDB through Mongoose.
- Dish fields include name, category, price, image, and description.

### Admin dashboard
- Admin login and logout.
- Admin-only routes protected by authentication middleware.
- Create, edit, and delete dish records.
- Session-based authentication using `express-session`.
- MongoDB-backed session storage through `connect-mongo` (if configured in `index.js`).

### Docker setup
- The Express application runs in its own container.
- MongoDB runs in a separate container.
- MongoDB data is stored in a named Docker volume so it survives ordinary container restarts and rebuilds.
- The application connects to MongoDB using the Compose service hostname `mongo`, not `localhost`.

### Advanced feature: asynchronous image processing
When the image-pipeline integration is installed:
- Admins upload JPG, PNG, or WebP images instead of entering only an image URL.
- Express saves the original image and publishes a task message to RabbitMQ.
- A separate Worker uses Sharp to resize the image and convert it to WebP.
- MongoDB tracks the image state as `processing`, `completed`, or `failed`.
- The admin dashboard displays the image-processing status.

> The RabbitMQ/Worker feature requires the corresponding files under `services/` and `workers/`, the updated admin upload route and EJS form, the updated Dish model, and the Compose changes described below. Merely having a `worker` service in Compose does not enable the feature by itself.

## Technology stack

| Technology | Purpose |
|---|---|
| Node.js 24 | JavaScript runtime |
| Express | HTTP server and routing |
| EJS | Server-rendered HTML templates |
| MongoDB | Persistent document database |
| Mongoose | MongoDB object modeling and validation |
| express-session | Admin login sessions |
| connect-mongo | Store sessions in MongoDB, if configured |
| Docker | Containerize the application and supporting services |
| Docker Compose | Run multiple services together |
| RabbitMQ | Queue image-processing tasks (advanced feature) |
| Sharp | Resize and convert images to WebP (advanced feature) |
| Multer | Receive multipart image uploads (advanced feature) |
| amqplib | Connect Node.js to RabbitMQ (advanced feature) |

The exact dependencies installed should match the current `package.json`. The table describes the technologies used or planned for the project.

## Architecture

### Basic Docker setup

```text
Browser
   |
   | HTTP :3000
   v
Express / EJS app container
   |
   | mongodb://mongo:27017/yukihira_diner
   v
MongoDB container
   |
   v
mongodb_data named volume
```

Inside Docker Compose, `localhost` refers to the current container. Therefore, the app must connect to `mongodb://mongo:27017/yukihira_diner` rather than `mongodb://localhost:27017/...`.

### Advanced image-processing flow

```text
Admin uploads an image
        |
        v
Express app validates the form and saves the original
        |
        v
MongoDB dish record: imageStatus = "processing"
        |
        v
RabbitMQ queue: image_processing
        |
        v
Independent image Worker
        |
        +--> Sharp resizes and converts image to WebP
        |
        +--> Saves the processed image to shared image storage
        |
        v
MongoDB dish record: imageStatus = "completed"
```

The app and Worker must be able to access the same image files. In the current local Compose example, both services mount the host directory `./public/images/foods` to `/app/public/images/foods`.

## Project structure

The precise layout can vary, but the application is expected to follow a structure similar to:

```text
project-root/
├── index.js                  # Express entry point (verify your Dockerfile)
├── package.json
├── package-lock.json
├── Dockerfile
├── .dockerignore
├── compose.yaml              # Or docker-compose.yml
├── .env                      # Local secrets; do not commit
├── middleware/
│   └── auth.js               # Admin authentication middleware
├── models/
│   ├── admin.js              # Admin account model
│   └── dish.js               # Dish/menu model
├── routes/
│   ├── admin.js              # Admin login and dish management
│   └── public.js              # Public website routes
├── services/
│   └── imageQueue.js         # RabbitMQ producer (advanced feature)
├── workers/
│   └── imageWorker.js        # Image-processing consumer (advanced feature)
├── views/
│   ├── admin.ejs
│   ├── edit.ejs
│   ├── index.ejs
│   ├── login.ejs
│   └── ...                   # Other EJS templates
└── public/
    ├── css/
    └── images/
        └── foods/
            ├── uploads/      # Original uploaded images
            └── processed/    # Optimized WebP images
```

**Important:** The current Dockerfile must run the entry point that actually exists in your repository. The project has used `index.js`; if your current Dockerfile still says `server.js`, update it or use the correct filename consistently.

## Prerequisites

Install the following on your computer:

- Docker Desktop (includes Docker Compose).
- Git, if cloning the repository.
- Node.js and npm only if you also want to run the app directly on the host without Docker.

Verify Docker is available:

```bash
docker --version
docker compose version
```

## Run locally with Docker Compose

These instructions assume you are in the project root, where `Dockerfile`, `package.json`, and `compose.yaml` are located.

### 1. Configure environment variables

Create a `.env` file in the project root if it does not already exist:

```dotenv
SESSION_SECRET=replace_this_with_a_long_random_secret
```

Use a long, unpredictable value. Do not commit `.env` to Git.

The Compose file should pass `SESSION_SECRET` to the app and set the MongoDB URI inside Docker to:

```text
mongodb://mongo:27017/yukihira_diner
```

### 2. Check the Dockerfile

A suitable Dockerfile for an `index.js` entry point is:

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
```

This assumes a committed, valid `package-lock.json`. If the project does not have a lock file yet, run `npm install` locally to create it before building the image.

Make sure `.dockerignore` excludes at least:

```text
node_modules
npm-debug.log
.git
.env
.DS_Store
coverage
```

Do not exclude application folders such as `models/`, `routes/`, `views/`, `public/`, `middleware/`, `services/`, or `workers/`.

### 3. Configure Compose

A basic app + MongoDB Compose file looks like this:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://mongo:27017/yukihira_diner
      SESSION_SECRET: ${SESSION_SECRET}
    depends_on:
      - mongo

  mongo:
    image: mongo:8.0.4
    restart: unless-stopped
    environment:
      GLIBC_TUNABLES: "glibc.pthread.rseq=1"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

The `GLIBC_TUNABLES` setting is a workaround previously used with this MongoDB image for a reported Linux kernel compatibility issue. If your current environment does not need it, consult current MongoDB image guidance before changing it.

If you have integrated asynchronous image processing, use the advanced Compose requirements in the next section as well.

### 4. Validate and start the containers

```bash
docker compose config
docker compose up --build -d
```

Open the website:

- Public website: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/login`
- Admin dashboard: `http://localhost:3000/admin` (after login)

Check container status and logs:

```bash
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 mongo
```

To follow logs live:

```bash
docker compose logs -f app mongo
```

### 5. Start the advanced image services

If you have installed the image-pipeline files, Compose needs all of the following:
- An `app` environment variable `RABBITMQ_URL: amqp://rabbitmq:5672`.
- A `rabbitmq` service.
- A `worker` service running `node workers/imageWorker.js`.
- The same image-directory mount in both `app` and `worker`.
- The `rabbitmq_data` named volume.

For example, the relevant additions are:

```yaml
services:
  app:
    environment:
      RABBITMQ_URL: amqp://rabbitmq:5672
    depends_on:
      - rabbitmq
    volumes:
      - ./public/images/foods:/app/public/images/foods

  worker:
    build: .
    command: node workers/imageWorker.js
    restart: unless-stopped
    environment:
      MONGODB_URI: mongodb://mongo:27017/yukihira_diner
      RABBITMQ_URL: amqp://rabbitmq:5672
    depends_on:
      - mongo
      - rabbitmq
    volumes:
      - ./public/images/foods:/app/public/images/foods

  rabbitmq:
    image: rabbitmq:4-management
    restart: unless-stopped
    ports:
      - "127.0.0.1:15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  rabbitmq_data:
```

Merge these entries with your existing Compose file rather than duplicating top-level `services` or `volumes` keys.

Then rebuild and start:

```bash
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs -f app worker rabbitmq
```

RabbitMQ Management UI is exposed at `http://localhost:15672` in this local setup. Configure a dedicated username and password before exposing RabbitMQ beyond your own computer; do not use default credentials in a production environment.

### 6. Stop the project

Stop and remove the containers while preserving named data volumes:

```bash
docker compose down
```

To start them again later:

```bash
docker compose up -d
```

**Do not use `docker compose down -v` unless you intentionally want to delete the named MongoDB and RabbitMQ data volumes.**

## Run the Node.js app without Docker

This is an alternative for development. You still need a reachable MongoDB instance, and the advanced image feature also needs RabbitMQ.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file with values appropriate for services running on your host. For example, if MongoDB is installed locally:

   ```dotenv
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/yukihira_diner
   SESSION_SECRET=replace_this_with_a_long_random_secret
   ```

3. Start the app using the actual entry point:

   ```bash
   node index.js
   ```

   Or use the start script if one is defined in `package.json`:

   ```bash
   npm start
   ```

If MongoDB is running only inside Compose, the hostname `mongo` works for other containers but usually does not resolve from a process running directly on your host. Either run the app in Compose or publish the MongoDB port and use a host-accessible URI.

## Environment variables

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` in Docker |
| `PORT` | HTTP port | `3000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://mongo:27017/yukihira_diner` inside Compose |
| `SESSION_SECRET` | Signs the session cookie | A long random secret |
| `RABBITMQ_URL` | RabbitMQ connection URI for image tasks | `amqp://rabbitmq:5672` inside Compose |

Never commit real secrets to source control.

## Admin account

The website's admin login uses the Admin model and password hash. A MongoDB database that is newly created inside Docker will not automatically contain the admin account that might exist in a separate host MongoDB instance.

If the project has a `scripts/create-admin.js` script, inspect its imports and environment handling before running it. A script that connects using `process.env.MONGODB_URI` must receive the URI for the intended database. For a Compose database, one approach is:

```bash
docker compose run --rm app node scripts/create-admin.js
```

This command works only if the script is included in the image, the file path is correct, and the script can read the environment variables supplied by Compose. If `.env` or script setup differs, adjust accordingly.

Do not put plaintext admin passwords into source code or commit them. If login redirects back to the login page after accepting credentials, inspect session-cookie settings, the login route's session property, the auth middleware, and the browser's cookie behavior. For local HTTP, a cookie configured with `secure: true` may not be sent as expected; for production HTTPS, use secure cookies and configure proxy trust correctly if running behind a reverse proxy.

## Asynchronous image processing

### What happens when an admin uploads an image?

1. Multer receives the uploaded image and enforces the configured size/type restrictions.
2. The app saves the original file in `public/images/foods/uploads/`.
3. The Dish document is created with `imageStatus: "processing"`.
4. The app publishes a small JSON message to the durable RabbitMQ queue named `image_processing`.
5. The Worker consumes the message.
6. Sharp rotates the image according to its metadata, resizes it within 1200 × 1200 pixels without enlarging it, and converts it to WebP.
7. The Worker saves the optimized image under `public/images/foods/processed/`.
8. MongoDB is updated with the public image path and `imageStatus: "completed"`.

The queue message should contain task metadata, such as a dish ID and generated filename, rather than the raw image bytes.

### Image status values

| Status | Meaning |
|---|---|
| `processing` | The task was queued and is waiting for or undergoing processing |
| `completed` | The optimized image was created and the Dish document was updated |
| `failed` | The worker or publisher could not complete the task |

The current sample Worker records failed tasks and acknowledges them. It does not yet implement automatic retries or a dead-letter queue, so do not describe it as providing guaranteed retries. For a more robust implementation, add bounded retries, a dead-letter queue, idempotent processing, and cleanup for abandoned uploads.

## Useful Docker commands

| Goal | Command |
|---|---|
| Validate Compose | `docker compose config` |
| Build and start | `docker compose up --build -d` |
| List containers | `docker compose ps` |
| App logs | `docker compose logs -f app` |
| Worker logs | `docker compose logs -f worker` |
| MongoDB logs | `docker compose logs -f mongo` |
| Restart app | `docker compose restart app` |
| Rebuild app | `docker compose up --build -d app` |
| Stop containers | `docker compose down` |
| Open a shell in app container | `docker compose exec app sh` |
| Run a one-off admin script | `docker compose run --rm app node scripts/create-admin.js` |

## Testing checklist

### Basic website
- [ ] `docker compose config` completes without errors.
- [ ] The app and MongoDB containers are running.
- [ ] The public website loads at `http://localhost:3000`.
- [ ] Admin login works and protected pages require authentication.
- [ ] Adding, editing, and deleting a dish works.
- [ ] Dish data remains after restarting containers with `docker compose down` and `docker compose up -d`.

### Advanced image pipeline
- [ ] RabbitMQ and Worker containers are running.
- [ ] Uploading an allowed image creates a Dish with status `processing`.
- [ ] A task appears in the RabbitMQ queue.
- [ ] Worker logs show the image was processed.
- [ ] The WebP file exists in `public/images/foods/processed/`.
- [ ] The Dish status changes to `completed` and the browser can load the image.
- [ ] An invalid or oversized upload is rejected.
- [ ] Worker failure is visible as a failed status rather than silently appearing successful.

## Troubleshooting

### `MONGODB_URI and SESSION_SECRET must be configured`
Check that `.env` exists, `SESSION_SECRET` is set, and Compose passes both variables to the app. Then run:

```bash
docker compose config
docker compose logs --tail=100 app
```

### `ECONNREFUSED 127.0.0.1:27017`
Inside a container, `127.0.0.1` points to that same container. For Compose networking, use:

```text
mongodb://mongo:27017/yukihira_diner
```

### `Cannot find module ...`
Check that the file exists in the image and that the import's capitalization matches the filename exactly. Linux containers use case-sensitive paths, so `Admin.js` and `admin.js` are different filenames. Rebuild after adding files:

```bash
docker compose up --build -d
```

### RabbitMQ connection errors
Check the service and logs:

```bash
docker compose ps
docker compose logs --tail=100 rabbitmq worker app
```

The app and Worker should use `amqp://rabbitmq:5672` when they run inside the same Compose project. `localhost:5672` is not the RabbitMQ service hostname inside a container.

### Image remains `processing`
Check that the Worker is running, that the task was published, that both containers mount the same image directory, and that the Worker can write to `public/images/foods/processed/`.

### Image URL is broken
The value saved in MongoDB should be a browser URL such as `/images/foods/processed/example.webp`, not an absolute container filesystem path such as `/app/public/images/foods/processed/example.webp`. Ensure Express serves the `public/` directory with `express.static(...)`.

### CSS or images do not load
Check the paths in EJS and confirm the assets are inside `public/`. If Helmet's Content Security Policy is enabled, check the browser console for blocked resources and configure a suitable policy rather than disabling security middleware without understanding the effect.

### MongoDB startup kernel compatibility warning
The current Compose file includes `GLIBC_TUNABLES: "glibc.pthread.rseq=1"` as a workaround previously used with `mongo:8.0.4`. If the warning persists, check the current MongoDB image documentation and logs for a compatible image/version.

## Security and production notes

- Keep `.env`, database credentials, and session secrets out of Git.
- Use HTTPS and secure session cookies in production.
- Use a dedicated RabbitMQ account and password; do not expose the management UI publicly without authentication and network controls.
- Validate actual file contents, not only the browser-provided MIME type.
- Keep upload size limits and restrict allowed image types.
- Add CSRF protection to admin forms and apply appropriate rate limits to login.
- Use bounded retries and a dead-letter queue for failed image tasks.
- Consider object storage instead of a shared host bind mount for multi-machine deployment.
- Back up MongoDB data before destructive operations.
- `docker compose down` preserves named volumes; `docker compose down -v` removes them.

---

## Quick start

For the usual local Docker workflow:

```bash
# 1. Create .env and set SESSION_SECRET
# 2. Ensure Dockerfile uses the correct entry point (index.js)
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Then open `http://localhost:3000`.

If the advanced image pipeline has been integrated, also check:

```bash
docker compose logs -f worker rabbitmq
```
