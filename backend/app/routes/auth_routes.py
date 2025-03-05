from flask import Blueprint, request, jsonify
from app import db, jwt
from app.models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from flasgger import swag_from

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
                'email': {'type': 'string','example': 'nick@visiotech.me'},
                'password': {'type': 'string','example': 'passer'}
            }
        }
    }],
    'responses': {
        '200': {
            'description': 'Connexion réussie',
            'schema': {
                'type': 'object',
                'properties': {
                    'access_token': {'type': 'string'}
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
        # Convertir l'ID de l'utilisateur en string
        token = create_access_token(identity=str(user.id))  # ID converti en string
        return jsonify({"access_token": token}), 200

    return jsonify({"error": "Invalid credentials"}), 401
