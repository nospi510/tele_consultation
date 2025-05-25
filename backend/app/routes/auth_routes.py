from asyncio.log import logger
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session
from app import db, jwt
from app.models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flasgger import swag_from

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("auth/register.html")

    data = request.get_json() if request.content_type == "application/json" else request.form
    if not data or not all(key in data for key in ["fullname", "email", "password"]):
        if request.content_type == "application/json":
            return jsonify({"error": "Données manquantes"}), 400
        return render_template("auth/register.html", error="Tous les champs sont requis"), 400

    if User.query.filter_by(email=data["email"]).first():
        if request.content_type == "application/json":
            return jsonify({"error": "Email déjà utilisé"}), 400
        return render_template("auth/register.html", error="Email déjà utilisé"), 400

    hashed_password = generate_password_hash(data["password"], method="pbkdf2:sha256")
    new_user = User(fullname=data["fullname"], email=data["email"], password_hash=hashed_password)

    db.session.add(new_user)
    db.session.commit()

    logger.info(f"Nouvel utilisateur créé: {data['email']}")
    if request.content_type == "application/json":
        return jsonify({"message": "Utilisateur créé avec succès"}), 201
    return redirect(url_for("auth.login"))

@auth_bp.route("/login", methods=["GET", "POST"])
@swag_from({
    'tags': ['Auth'],
    'summary': 'Connexion utilisateur',
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'email': {'type': 'string', 'example': 'nick@visiotech.me'},
                'password': {'type': 'string', 'example': 'passer'}
            }
        }
    }],
    'responses': {
        '200': {
            'description': 'Connexion réussie',
            'schema': {
                'type': 'object',
                'properties': {
                    'access_token': {'type': 'string'},
                    'user_role': {'type': 'string'}  # Ajout dans la documentation
                }
            }
        },
        '401': {
            'description': 'Identifiants invalides'
        }
    }
})
def login():
    if request.method == "GET":
        return render_template("auth/login.html")

    data = request.get_json() if request.content_type == "application/json" else request.form
    if not data or not all(key in data for key in ["email", "password"]):
        if request.content_type == "application/json":
            return jsonify({"error": "Données manquantes"}), 400
        return render_template("auth/login.html", error="Tous les champs sont requis"), 400

    user = User.query.filter_by(email=data["email"]).first()
    if user and check_password_hash(user.password_hash, data["password"]):
        token = create_access_token(identity=str(user.id))
        session["user_id"] = user.id
        logger.info(f"Connexion réussie pour {user.email}, user_id: {user.id}, session définie")
        if request.content_type == "application/json":
            return jsonify({
                "access_token": token,
                "user_role": user.role,
                "user_id": user.id
            }), 200
        return redirect(url_for("auth.home_page"))

    logger.warning(f"Échec de connexion pour {data['email']}")
    if request.content_type == "application/json":
        return jsonify({"error": "Identifiants invalides"}), 401
    return render_template("auth/login.html", error="Identifiants invalides"), 401

@auth_bp.route("/home", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Auth'],
    'summary': 'Récupérer les infos de l’utilisateur connecté pour l’API',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Infos utilisateur récupérées',
            'schema': {
                'type': 'object',
                'properties': {
                    'id': {'type': 'integer'},
                    'fullname': {'type': 'string'},
                    'email': {'type': 'string'},
                    'role': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé'}
    }
})
def home():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404
    logger.info(f"Accès API home pour {user.email}")
    return jsonify({
        'id': user.id,
        'fullname': user.fullname,
        'email': user.email,
        'role': user.role
    }), 200

@auth_bp.route("/home_page", methods=["GET"])
def home_page():
    user_id = session.get("user_id")
    if not user_id:
        logger.warning("Tentative d'accès à home_page sans session")
        return redirect(url_for('auth.login'))
    user = User.query.get(user_id)
    if not user:
        session.pop('user_id', None)
        logger.warning("Utilisateur non trouvé pour home_page")
        return redirect(url_for('auth.login'))
    logger.info(f"Accès à home_page pour {user.email}")
    return render_template("home.html", user=user)

@auth_bp.route("/logout", methods=["GET"])
def logout():
    session.pop('user_id', None)
    logger.info("Déconnexion effectuée")
    return redirect(url_for('auth.login'))

@auth_bp.route("/check-auth", methods=["GET"])
@jwt_required(optional=True)
def check_auth():
    user_id = get_jwt_identity()
    if user_id:
        user = User.query.get(user_id)
        if user:
            logger.info(f"Vérification auth réussie pour {user.email}")
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'fullname': user.fullname,
                    'email': user.email,
                    'role': user.role
                }
            }), 200
    logger.info("Vérification auth: non authentifié")
    return jsonify({'authenticated': False}), 200