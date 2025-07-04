<<<<<<< HEAD
=======

>>>>>>> 4f7261f4d0bc16ea5f8192cabc679056c74d6ffd
# 🩺 Projet Téléconsultation – Backend & Frontend (TNT + Mobile)

Ce projet comprend :

- ✅ Un **backend** Flask avec base de données MariaDB
- 📺 Une application HbbTV pour téléviseurs connectés (TNT)
- 📱 Une application mobile Ionic Angular (Dr Santé Mobile)

---

##  Installation des dépendances système

```bash
sudo apt install python3 python3-pip python3-venv mariadb-server mariadb-client -y
````

---

##  Configuration de la base de données

```bash
mysql -u root -p
```

Puis dans le terminal SQL :

```sql
CREATE DATABASE teleconsultation;
```

---

##  Backend – API Flask

```bash
cd backend
```

###  Création d’un environnement virtuel

```bash
python3 -m venv .venv
source .venv/bin/activate
```

###  Configuration des variables d’environnement

Copiez le fichier `.env.example` :

```bash
cp .env.example .env
```

Remplissez ensuite le fichier `.env` avec vos informations personnelles (base de données, clé secrète, etc.).

###  Installation des dépendances Python

```bash
pip install -r requirements.txt
```

<<<<<<< HEAD
=======
### Initialisé la migration

```bash
flask db init
flask db migrate
flask db upgrade
```
>>>>>>> 4f7261f4d0bc16ea5f8192cabc679056c74d6ffd
###  Lancement du serveur Flask

```bash
python run.py
```

---

##  Frontend TNT – Application HbbTV

Il est necéssaire d'avoir un serveur web pour lancer le frontent TNT. 

Exemple : Installer http-server globalement :

```bash
sudo npm install -g http-server
````

```bash
cd frontend_tnt
http-server -p 8081 --mimetypes .types
```




Lancer via un navigateur :

```
http://localhost:8081
```

---

##  Frontend Mobile – Ionic Angular

###  Lancer le projet mobile

```bash
cd frontend
```

Si Ionic CLI n'est pas installé globalement :

```bash
npm install -g @ionic/cli
```

Acceder au dossier :

```bash
cd dr-sante-mobile
```

###  Installer les dépendances nécessaires

```bash
npm install axios @ionic/angular @capacitor/core @capacitor/android @capacitor/ios
npm install socket.io-client simple-peer @types/simple-peer --save
npm install hls.js@1.4.10
```

###  Ajouter les plateformes Capacitor

```bash
ionic capacitor add android
ionic capacitor add ios
```

###  Lancer l'application dans le navigateur

```bash
ionic serve
```
