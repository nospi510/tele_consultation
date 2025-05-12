from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session
from app import db, jwt
from app.models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flasgger import swag_from

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """Affiche la page d'inscription ou enregistre un nouvel utilisateur"""
    if request.method == "GET":
        return render_template("auth/register.html")

    # Vérifier le type de contenu
    if request.content_type == "application/json":
        data = request.get_json()
        if not data or not all(key in data for key in ["fullname", "email", "password"]):
            return jsonify({"error": "Données manquantes"}), 400
    else:
        data = request.form
        if not data or not all(key in data for key in ["fullname", "email", "password"]):
            return render_template("auth/register.html", error="Tous les champs sont requis"), 400

    # Vérifier si l'email existe déjà
    if User.query.filter_by(email=data["email"]).first():
        if request.content_type == "application/json":
            return jsonify({"error": "Email déjà utilisé"}), 400
        return render_template("auth/register.html", error="Email déjà utilisé"), 400

    hashed_password = generate_password_hash(data["password"], method="pbkdf2:sha256")
    new_user = User(fullname=data["fullname"], email=data["email"], password_hash=hashed_password)

    db.session.add(new_user)
    db.session.commit()

    if request.content_type == "application/json":
        return jsonify({"message": "User created successfully"}), 201
    return redirect(url_for("auth.login"))

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """Affiche la page de connexion ou connecte un utilisateur"""
    if request.method == "GET":
        return render_template("auth/login.html")

    # Vérifier le type de contenu
    if request.content_type == "application/json":
        data = request.get_json()
        if not data or not all(key in data for key in ["email", "password"]):
            return jsonify({"error": "Données manquantes"}), 400
    else:
        data = request.form
        if not data or not all(key in data for key in ["email", "password"]):
            return render_template("auth/login.html", error="Tous les champs sont requis"), 400

    user = User.query.filter_by(email=data["email"]).first()

    if user and check_password_hash(user.password_hash, data["password"]):
        token = create_access_token(identity=str(user.id))
        session["user_id"] = user.id  # Stocker l'ID utilisateur dans la session pour les templates
        if request.content_type == "application/json":
            return jsonify({
                "access_token": token,
                "user_role": user.role,
                "user_id": user.id
            }), 200
        return redirect(url_for("auth.home_page"))

    if request.content_type == "application/json":
        return jsonify({"error": "Identifiants invalides"}), 401
    return render_template("auth/login.html", error="Identifiants invalides"), 401

@auth_bp.route("/home", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Auth'],
    'summary': 'Récupérer les infos de l’utilisateur connecté pour la page d’accueil',
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
    """Récupérer les informations de l’utilisateur connecté pour la page d’accueil (API)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    return jsonify({
        'id': user.id,
        'fullname': user.fullname,
        'email': user.email,
        'role': user.role
    }), 200

@auth_bp.route("/home_page", methods=["GET"])
def home_page():
    """Affiche le tableau de bord"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    if not user:
        session.pop('user_id', None)
        return redirect(url_for('auth.login'))

    return render_template("home.html", user=user)

@auth_bp.route("/logout", methods=["GET"])
def logout():
    """Déconnexion de l'utilisateur"""
    session.pop('user_id', None)
    return redirect(url_for('auth.login'))