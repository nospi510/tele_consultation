from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from werkzeug.security import generate_password_hash
from flasgger import swag_from
from flask_jwt_extended import jwt_required, get_jwt_identity

user_bp = Blueprint("user", __name__)

@user_bp.route("/create_doctor", methods=["POST"])
@swag_from({
    'tags': ['Users'],
    'summary': 'Créer un utilisateur de type docteur',
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
        '201': {'description': 'Docteur créé avec succès'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def create_doctor():
    """Créer un docteur dans la base de données"""
    data = request.get_json()

    # Vérification de l'existence de l'email
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Cet email est déjà utilisé"}), 400

    # Créer un nouveau docteur
    hashed_password = generate_password_hash(data['password'], method="pbkdf2:sha256")
    new_doctor = User(
        fullname=data['fullname'],
        email=data['email'],
        password_hash=hashed_password,
        role="doctor" 
    )

    db.session.add(new_doctor)
    db.session.commit()

    return jsonify({"message": "Docteur créé avec succès", "doctor_id": new_doctor.id}), 201


@user_bp.route("/", methods=["GET"])
@swag_from({
    'tags': ['Users'],
    'summary': 'Récupérer tous les utilisateurs (patients et docteurs)',
    'responses': {
        '200': {
            'description': 'Liste des utilisateurs',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'fullname': {'type': 'string'},
                        'email': {'type': 'string'},
                        'role': {'type': 'string'},
                        'is_available': {'type': 'boolean'},
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé'}
    }
})
def get_users():
    """Retourner tous les utilisateurs"""
    users = User.query.filter(User.role.in_(['patient', 'doctor'])).all()
    return jsonify([{
        'id': user.id,
        'fullname': user.fullname,
        'email': user.email,
        'role': user.role,
        'is_available': user.is_available
    } for user in users]), 200

@user_bp.route("/availability", methods=["PUT"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Mettre à jour la disponibilité d’un docteur',
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'is_available': {'type': 'boolean', 'example': True}
            }
        }
    }],
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {'description': 'Disponibilité mise à jour avec succès'},
        '401': {'description': 'Non autorisé (Utilisateur non authentifié ou non docteur)'},
        '404': {'description': 'Utilisateur non trouvé'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def update_doctor_availability():
    """Mettre à jour la disponibilité du docteur"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    if user.role != "doctor":
        return jsonify({"error": "Seuls les docteurs peuvent modifier leur disponibilité"}), 401

    # Récupérer les données de la requête
    data = request.get_json()
    print("Données reçues :", data)  # Log pour déboguer ce que reçoit le backend

    # Vérifier explicitement la présence et la valeur de is_available
    if "is_available" not in data:
        return jsonify({"error": "Le champ 'is_available' est requis"}), 400

    new_availability = bool(data["is_available"])  # Convertir en booléen Python
    user.is_available = new_availability
    print("Nouvelle disponibilité définie :", user.is_available)  # Log pour vérifier

    # Sauvegarder les modifications
    db.session.commit()

    return jsonify({"message": "Disponibilité mise à jour avec succès", "is_available": user.is_available}), 200


@user_bp.route("/create_admin", methods=["POST"])
@swag_from({
    'tags': ['Admin'],
    'summary': 'Créer un utilisateur de type administrateur',
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'fullname': {'type': 'string','example':'spino nick'},
                'email': {'type': 'string','example':'admin@visiotech.me'},
                'password': {'type': 'string', 'example':'passer'}
            }
        }
    }],
    'responses': {
        '201': {'description': 'Administrateur créé avec succès'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def create_admin():
    """Créer un administrateur dans la base de données"""
    data = request.get_json()

    # Vérification de l'existence de l'email
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Cet email est déjà utilisé"}), 400

    # Créer un nouvel administrateur
    hashed_password = generate_password_hash(data['password'], method="pbkdf2:sha256")
    new_admin = User(
        fullname=data['fullname'],
        email=data['email'],
        password_hash=hashed_password,
        role="admin"  
    )

    db.session.add(new_admin)
    db.session.commit()

    return jsonify({"message": "Administrateur créé avec succès", "admin_id": new_admin.id}), 201

@user_bp.route("/me", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Users'],
    'summary': 'Récupérer les informations de l’utilisateur connecté',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Informations de l’utilisateur',
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
def get_current_user():
    """Récupérer les informations de l’utilisateur connecté"""
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
    