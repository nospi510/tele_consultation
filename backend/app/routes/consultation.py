from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.consultation import Consultation
from flasgger import swag_from

consultation_bp = Blueprint("consultation", __name__)

@consultation_bp.route("/", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Créer une nouvelle consultation',
    'description': 'Permet à un utilisateur authentifié de créer une consultation avec des symptômes.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'symptoms': {'type': 'string', 'example': 'Fièvre, toux'}
            }
        }
    }],
    'responses': {
        '201': {'description': 'Consultation créée avec succès'},
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def create_consultation():
    """Créer une nouvelle consultation"""
    user_id = get_jwt_identity()
    data = request.get_json()

    new_consultation = Consultation(user_id=user_id, symptoms=data["symptoms"])
    db.session.add(new_consultation)
    db.session.commit()

    return jsonify({"message": "Consultation created successfully"}), 201

@consultation_bp.route("/", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Récupérer les consultations de l’utilisateur',
    'description': 'Retourne toutes les consultations d’un utilisateur authentifié.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des consultations',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'symptoms': {'type': 'string'},
                        'status': {'type': 'string'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'}
    }
})
def get_consultations():
    """Récupérer les consultations d’un utilisateur"""
    user_id = get_jwt_identity()
    consultations = Consultation.query.filter_by(user_id=user_id).all()
    return jsonify([{"id": c.id, "symptoms": c.symptoms, "status": c.status} for c in consultations])
