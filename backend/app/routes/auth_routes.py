from flask import Blueprint, request, jsonify
from app import db, jwt
from app.models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from flasgger import swag_from
from flask_jwt_extended import jwt_required, get_jwt_identity

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
@swag_from({
    'tags': ['Auth'],
    'summary': 'Créer un utilisateur',
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'fullname': {'type': 'string'},
                'email': {'type': 'string'},
                'password': {'type': 'string'}
            }
        }
    }],
    'responses': {
        '201': {'description': 'Utilisateur créé'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def register():
    """Enregistre un nouvel utilisateur"""
    data = request.get_json()
    hashed_password = generate_password_hash(data["password"], method="pbkdf2:sha256")
    new_user = User(fullname=data["fullname"], email=data["email"], password_hash=hashed_password)
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User created successfully"}), 201

@auth_bp.route("/login", methods=["POST"])
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
    """Connexion utilisateur avec JWT"""
    data = request.get_json()
    user = User.query.filter_by(email=data["email"]).first()

    if user and check_password_hash(user.password_hash, data["password"]):
        token = create_access_token(identity=str(user.id))
        return jsonify({
            "access_token": token,
            "user_role": user.role,  # Ajout du rôle dans la réponse
            'user_id': user.id  # Optionnel si déjà dans le JWT
        }), 200

    return jsonify({"error": "Invalid credentials"}), 401

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
    """Récupérer les informations de l’utilisateur connecté pour la page d’accueil"""
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