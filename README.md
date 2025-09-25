# ILF-PROJECT

This repository contains a project implementation for ILF, built with Node.js, pnpm, and Docker. It includes microservices that can be containerized and run locally using Docker Compose.  

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- [Git](https://git-scm.com/) – for version control  
- [Docker](https://www.docker.com/) – to run containerized services  
- [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) – to manage Node.js versions  

---

## 🚀 Setup Guide

### 1. Clone the repository
```bash
git clone https://github.com/sohaib1083/ILF-PROJECT.git
cd ILF-PROJECT
```

### 2. Install Node.js
```bash
nvm install
nvm use
```

### 3. Install pnpm
```bash
corepack enable
```

### 4. Install dependencies
```bash
pnpm i
```

### 5. Build all packages
```bashjke
pnpm -r build
```
### 6. (optional) Create Docker network and make sure  port 5432 is available
```bash
sudo lsof -i :5432 (to see if port is occupied or not)
sudo kill -9 <(process id)>
docker network create rafiki (only if you're prompted by termminal)
```

### 7. Run all packages
```bash
pnpm localenv:compose:psql up
```

## 🛠 Running Microservices

Navigate to the banking-microservices folder and start the services:

```bash
cd banking-microservices/
docker compose up
```

This will start all the microservices defined in the docker-compose.yml file.

## 📖 Notes

- Use `docker compose down` to stop the services.
- For rebuilding after changes, run `pnpm -r build` again before restarting containers.
- Ensure Docker daemon is running before starting microservices.

## 🤝 Contributing

Pull requests are welcome. Please open an issue first to discuss major changes.

## 📜 License

This project is licensed under the MIT License.
