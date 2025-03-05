from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.consultation import Consultation
from app.models.user import User
from flasgger import swag_from
from app.services.ollama_service import get_ai_diagnosis

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


@consultation_bp.route("/start", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Démarrer une consultation',
    'description': 'Permet à un utilisateur authentifié de démarrer une consultation pour lui-même. Si aucun médecin n\'est disponible, l\'IA prend la relève.',
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
        '201': {
            'description': 'Consultation démarrée avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'consultation_id': {'type': 'integer'},
                    'is_ai_diagnosis': {'type': 'boolean'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def start_consultation():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur existe
    if not user:
        return jsonify({"error": "Utilisateur non trouvé."}), 404

    # Récupère les symptômes de la requête
    data = request.get_json()
    symptoms = data.get("symptoms")

    if not symptoms:
        return jsonify({"error": "Les symptômes sont obligatoires."}), 400

    # Vérifie si un médecin est disponible
    available_doctor = User.query.filter(User.role == "doctor", User.is_available == True).first()

    if available_doctor:
        # Un médecin est disponible, on lui assigne la consultation
        consultation = Consultation(
            user_id=user_id,
            symptoms=symptoms,
            doctor_id=available_doctor.id,
            conversation_history=f"Patient: {symptoms}"  # Initialise l'historique
        )
    else:
        # Aucun médecin disponible, l'IA prend la relève
        diagnosis = get_ai_diagnosis(symptoms)
        consultation = Consultation(
            user_id=user_id,
            symptoms=symptoms,
            diagnosis=diagnosis,
            is_ai_diagnosis=True,
            conversation_history=f"Patient: {symptoms}\nIA: {diagnosis}"  # Initialise l'historique
        )

    # Sauvegarde la consultation dans la base de données
    db.session.add(consultation)
    db.session.commit()

    return jsonify({
        "message": "Consultation démarrée",
        "consultation_id": consultation.id,
        "is_ai_diagnosis": consultation.is_ai_diagnosis
    }), 201


@consultation_bp.route("/all", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Afficher toutes les consultations d\'un utilisateur',
    'description': 'Permet à un utilisateur authentifié de voir toutes ses consultations avec les diagnostics.',
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
                        'diagnosis': {'type': 'string'},
                        'is_ai_diagnosis': {'type': 'boolean'},
                        'created_at': {'type': 'string', 'format': 'date-time'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'}
    }
})
def get_all_consultations():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()

    # Récupère toutes les consultations de l'utilisateur
    consultations = Consultation.query.filter_by(user_id=user_id).all()

    # Formate la réponse
    consultations_data = [{
        "id": consultation.id,
        "symptoms": consultation.symptoms,
        "diagnosis": consultation.diagnosis,
        "is_ai_diagnosis": consultation.is_ai_diagnosis,
        "created_at": consultation.created_at.isoformat()
    } for consultation in consultations]

    return jsonify(consultations_data), 200

@consultation_bp.route("/<int:consultation_id>", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Afficher une consultation spécifique',
    'description': 'Permet à un utilisateur authentifié de voir une consultation spécifique avec son diagnostic.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'consultation_id',
        'in': 'path',
        'required': True,
        'type': 'integer',
        'description': 'ID de la consultation'
    }],
    'responses': {
        '200': {
            'description': 'Détails de la consultation',
            'schema': {
                'type': 'object',
                'properties': {
                    'id': {'type': 'integer'},
                    'symptoms': {'type': 'string'},
                    'diagnosis': {'type': 'string'},
                    'is_ai_diagnosis': {'type': 'boolean'},
                    'created_at': {'type': 'string', 'format': 'date-time'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Consultation non trouvée'}
    }
})
def get_consultation(consultation_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()

    # Récupère la consultation spécifique
    consultation = Consultation.query.filter_by(id=consultation_id, user_id=user_id).first()

    # Vérifie si la consultation existe
    if not consultation:
        return jsonify({"error": "Consultation non trouvée."}), 404

    # Formate la réponse
    consultation_data = {
        "id": consultation.id,
        "symptoms": consultation.symptoms,
        "diagnosis": consultation.diagnosis,
        "is_ai_diagnosis": consultation.is_ai_diagnosis,
        "created_at": consultation.created_at.isoformat()
    }

    return jsonify(consultation_data), 200


@consultation_bp.route("/continue/<int:consultation_id>", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Continuer une consultation',
    'description': 'Permet à un utilisateur authentifié de continuer une consultation existante en ajoutant de nouveaux symptômes ou questions. L\'IA prend en compte l\'historique précédent.',
    'security': [{'BearerAuth': []}],
    'parameters': [
        {
            'name': 'consultation_id',
            'in': 'path',
            'required': True,
            'type': 'integer',
            'description': 'ID de la consultation à continuer'
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string', 'example': 'J\'ai aussi des maux de tête.'}
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Consultation mise à jour avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'diagnosis': {'type': 'string'},
                    'is_ai_diagnosis': {'type': 'boolean'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Consultation non trouvée ou ne vous appartient pas'}
    }
})
def continue_consultation(consultation_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()

    # Récupère la consultation existante
    consultation = Consultation.query.filter_by(id=consultation_id, user_id=user_id).first()

    # Vérifie si la consultation existe et appartient à l'utilisateur
    if not consultation:
        return jsonify({"error": "Consultation non trouvée ou ne vous appartient pas."}), 404

    # Récupère le nouveau message de la requête
    data = request.get_json()
    new_message = data.get("message")

    if not new_message:
        return jsonify({"error": "Le message est obligatoire."}), 400

    # Met à jour l'historique de la conversation
    consultation.conversation_history += f"\nPatient: {new_message}"

    # Si un médecin est assigné, on lui envoie le nouveau message
    if consultation.doctor_id:
        # Ici, on pourrait envoyer une notification au médecin (ex: via WebSocket ou email)
        consultation.conversation_history += f"\nMédecin: En attente de réponse..."
    else:
        # Si l'IA est en charge, on génère une nouvelle réponse en tenant compte de l'historique
        diagnosis = get_ai_diagnosis(consultation.conversation_history)
        consultation.diagnosis = diagnosis
        consultation.conversation_history += f"\nIA: {diagnosis}"

    # Sauvegarde les modifications dans la base de données
    db.session.commit()

    return jsonify({
        "message": "Consultation mise à jour",
        "diagnosis": consultation.diagnosis,
        "is_ai_diagnosis": consultation.is_ai_diagnosis
    }), 200