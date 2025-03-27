from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, socketio
from app.models.consultation import Consultation, Appointment
from app.models.user import User
from flasgger import swag_from
from app.services.ollama_service import get_ai_diagnosis, get_ai_health_tips
from flask_socketio import join_room

consultation_bp = Blueprint("consultation", __name__)


# Fonction pour émettre une mise à jour WebSocket
def send_consultation_update(consultation_id, consultation):
    socketio.emit('consultation_update', {
        'consultation_id': consultation_id,
        'conversation_history': consultation.conversation_history,
        'status': consultation.status,
        'diagnosis': consultation.diagnosis
    }, room=str(consultation_id))

# Ajoute cette nouvelle fonction pour gérer l’événement "typing"
def send_typing_update(consultation_id, user_role, is_typing):
    socketio.emit('typing_update', {
        'consultation_id': consultation_id,
        'user_role': user_role,  # 'patient' ou 'doctor'
        'is_typing': is_typing   # true ou false
    }, room=str(consultation_id))

# Ajoute cet événement WebSocket dans consultation_routes.py
@socketio.on('typing')
def handle_typing(data):
    consultation_id = data['consultation_id']
    user_role = data['user_role']
    is_typing = data['is_typing']
    send_typing_update(consultation_id, user_role, is_typing)

@socketio.on('join_consultation')
def handle_join(data):
    consultation_id = data['consultation_id']
    join_room(str(consultation_id))
    socketio.emit('room_joined', {'consultation_id': consultation_id}, room=str(consultation_id))


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
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "Utilisateur non trouvé."}), 404

    data = request.get_json()
    symptoms = data.get("symptoms")

    if not symptoms:
        return jsonify({"error": "Les symptômes sont obligatoires."}), 400

    available_doctor = User.query.filter(User.role == "doctor", User.is_available == True).first()

    if available_doctor:
        consultation = Consultation(
            user_id=user_id,
            symptoms=symptoms,
            doctor_id=available_doctor.id,
            conversation_history=f"Patient: {symptoms}"
        )
    else:
        diagnosis = get_ai_diagnosis(symptoms)
        consultation = Consultation(
            user_id=user_id,
            symptoms=symptoms,
            diagnosis=diagnosis,
            is_ai_diagnosis=True,
            conversation_history=f"Patient: {symptoms}\nIA: {diagnosis}"
        )

    db.session.add(consultation)
    db.session.commit()

    # Émet une mise à jour WebSocket
    send_consultation_update(consultation.id, consultation)  # Envoie plus de données
    
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
        "status": consultation.status,
        "conversation_history": consultation.conversation_history,
        "is_ai_diagnosis": consultation.is_ai_diagnosis,
        "created_at": consultation.created_at.isoformat()
    }

    return jsonify(consultation_data), 200


@consultation_bp.route("/continue/<int:consultation_id>", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Continuer une consultation',
    'description': 'Permet à un utilisateur authentifié de continuer une consultation existante en ajoutant de nouveaux symptômes ou questions.',
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
    user_id = get_jwt_identity()
    consultation = Consultation.query.filter_by(id=consultation_id, user_id=user_id).first()

    if not consultation:
        return jsonify({"error": "Consultation non trouvée ou ne vous appartient pas."}), 404

    data = request.get_json()
    new_message = data.get("message")

    if not new_message:
        return jsonify({"error": "Le message est obligatoire."}), 400

    consultation.conversation_history += f"\nPatient: {new_message}"

    if consultation.doctor_id:
        consultation.conversation_history += f"\nMédecin: En attente de réponse..."
    else:
        diagnosis = get_ai_diagnosis(consultation.conversation_history)
        consultation.diagnosis = diagnosis
        consultation.conversation_history += f"\nIA: {diagnosis}"

    db.session.commit()

    send_consultation_update(consultation_id, consultation)  # Envoie plus de données

    return jsonify({
        "message": "Consultation mise à jour",
        "diagnosis": consultation.diagnosis,
        "is_ai_diagnosis": consultation.is_ai_diagnosis
    }), 200

@consultation_bp.route("/doctor/continue/<int:consultation_id>", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Continuer une consultation (Médecin)',
    'description': 'Permet à un médecin authentifié de répondre à une consultation existante.',
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
                    'message': {'type': 'string', 'example': 'Prenez un antidouleur et reposez-vous.'}
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Réponse du médecin ajoutée avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'conversation_history': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Consultation non trouvée ou ne vous appartient pas'}
    }
})
def doctor_continue_consultation(consultation_id):
    user_id = get_jwt_identity()
    consultation = Consultation.query.filter_by(id=consultation_id, doctor_id=user_id).first()

    if not consultation:
        return jsonify({"error": "Consultation non trouvée ou ne vous appartient pas."}), 404

    data = request.get_json()
    new_message = data.get("message")

    if not new_message:
        return jsonify({"error": "Le message est obligatoire."}), 400

    consultation.conversation_history += f"\nMédecin: {new_message}"

    if consultation.status == 'pending':
        consultation.status = 'en cours'

    db.session.commit()

    send_consultation_update(consultation_id, consultation)  # Envoie plus de données

    return jsonify({
        "message": "Réponse ajoutée avec succès",
        "conversation_history": consultation.conversation_history
    }), 200


@consultation_bp.route("/doctors/available", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Obtenir la liste des médecins disponibles',
    'description': 'Permet à un utilisateur authentifié de voir la liste des médecins disponibles.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des médecins disponibles',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'fullname': {'type': 'string'},
                        'email': {'type': 'string'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'}
    }
})
def get_available_doctors():
    # Récupère la liste des médecins disponibles
    doctors = User.query.filter_by(role="doctor", is_available=True).all()

    # Formate la réponse
    doctors_data = [{
        "id": doctor.id,
        "fullname": doctor.fullname,
        "email": doctor.email
    } for doctor in doctors]

    return jsonify(doctors_data), 200

@consultation_bp.route("/rate/<int:consultation_id>", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Noter une consultation',
    'description': 'Permet à un utilisateur authentifié de noter une consultation.',
    'security': [{'BearerAuth': []}],
    'parameters': [
        {
            'name': 'consultation_id',
            'in': 'path',
            'required': True,
            'description': 'ID de la consultation à noter',
            'schema': {
                'type': 'integer',
                'example': 1
            }
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'rating': {'type': 'integer', 'example': 5, 'minimum': 1, 'maximum': 5},
                    'comment': {'type': 'string', 'example': 'Très professionnel.'}
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Consultation notée avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'rating': {'type': 'integer'},
                    'comment': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Consultation non trouvée ou ne vous appartient pas'}
    }
})
def rate_consultation(consultation_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()

    # Récupère la consultation existante
    consultation = Consultation.query.filter_by(id=consultation_id, user_id=user_id).first()

    # Vérifie si la consultation existe et appartient à l'utilisateur
    if not consultation:
        return jsonify({"error": "Consultation non trouvée ou ne vous appartient pas."}), 404

    # Récupère la note et le commentaire
    data = request.get_json()
    rating = data.get("rating")
    comment = data.get("comment")

    if not rating or rating < 1 or rating > 5:
        return jsonify({"error": "La note doit être entre 1 et 5."}), 400

    # Met à jour la consultation avec la note et le commentaire
    consultation.rating = rating
    consultation.comment = comment
    db.session.commit()

    return jsonify({
        "message": "Consultation notée avec succès",
        "rating": consultation.rating,
        "comment": consultation.comment
    }), 200

@consultation_bp.route("/stats", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Admin'],
    'summary': 'Obtenir les statistiques des consultations',
    'description': 'Permet à un administrateur de voir des statistiques sur les consultations.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Statistiques des consultations',
            'schema': {
                'type': 'object',
                'properties': {
                    'total_consultations': {'type': 'integer'},
                    'average_rating': {'type': 'number'},
                    'ai_consultations': {'type': 'integer'},
                    'doctor_consultations': {'type': 'integer'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (utilisateur non administrateur)'}
    }
})
def get_consultation_stats():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur est un administrateur
    if not user or user.role != "admin":
        return jsonify({"error": "Accès refusé. Seuls les administrateurs peuvent voir les statistiques."}), 403

    # Calcule les statistiques
    total_consultations = Consultation.query.count()
    ai_consultations = Consultation.query.filter_by(is_ai_diagnosis=True).count()
    doctor_consultations = total_consultations - ai_consultations
    average_rating = db.session.query(db.func.avg(Consultation.rating)).scalar() or 0

    return jsonify({
        "total_consultations": total_consultations,
        "average_rating": round(average_rating, 2),
        "ai_consultations": ai_consultations,
        "doctor_consultations": doctor_consultations
    }), 200

@consultation_bp.route("/reminder/<int:consultation_id>", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Envoyer un rappel pour une consultation',
    'description': 'Permet à un médecin ou à l\'IA d\'envoyer un rappel à un patient.',
    'security': [{'BearerAuth': []}],
    'parameters': [
        {
            'name': 'consultation_id',
            'in': 'path',
            'required': True,
            'description': 'ID de la consultation pour laquelle envoyer un rappel',
            'schema': {
                'type': 'integer',
                'example': 1
            }
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'reminder_message': {'type': 'string', 'example': 'N\'oubliez pas de prendre vos médicaments.'}
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Rappel envoyé avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'reminder_message': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Consultation non trouvée'}
    }
})
def send_reminder(consultation_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()

    # Récupère la consultation existante
    consultation = Consultation.query.filter_by(id=consultation_id).first()

    # Vérifie si la consultation existe
    if not consultation:
        return jsonify({"error": "Consultation non trouvée."}), 404

    # Récupère le message de rappel
    data = request.get_json()
    reminder_message = data.get("reminder_message")

    if not reminder_message:
        return jsonify({"error": "Le message de rappel est obligatoire."}), 400

    # Envoie le rappel (ex: via SMS, email, ou notification)
    # Ici, on pourrait utiliser Twilio pour envoyer un SMS ou un email
    send_sms(consultation.user.phone_number, reminder_message)

    return jsonify({
        "message": "Rappel envoyé avec succès",
        "reminder_message": reminder_message
    }), 200

@consultation_bp.route("/status/<int:consultation_id>", methods=["PUT"])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Changer le statut d\'une consultation',
    'description': 'Permet à un médecin ou à l\'IA de mettre à jour le statut d\'une consultation.',
    'security': [{'BearerAuth': []}],
    'parameters': [
        {
            'name': 'consultation_id',
            'in': 'path',
            'required': True,
            'type': 'integer',
            'description': 'ID de la consultation à mettre à jour',
            'example': 1
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'status': {
                        'type': 'string',
                        'example': 'terminée',
                        'enum': ['pending', 'en cours', 'terminée', 'annulée']
                    }
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Statut de la consultation mis à jour',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'status': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (utilisateur non médecin ou IA)'},
        '404': {'description': 'Consultation non trouvée'}
    }
})
def update_consultation_status(consultation_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin ou l'IA
    if not user or (user.role != "doctor" and not user.is_ai):
        return jsonify({"error": "Accès refusé. Seuls les médecins ou l'IA peuvent mettre à jour le statut."}), 403

    # Récupère la consultation existante
    consultation = Consultation.query.get(consultation_id)

    # Vérifie si la consultation existe
    if not consultation:
        return jsonify({"error": "Consultation non trouvée."}), 404

    # Récupère le nouveau statut
    data = request.get_json()
    status = data.get("status")

    if not status or status not in ["pending", "en cours", "terminée", "annulée"]:
        return jsonify({"error": "Statut invalide."}), 400

    # Met à jour le statut
    consultation.status = status
    db.session.commit()

    return jsonify({
        "message": "Statut de la consultation mis à jour",
        "status": consultation.status
    }), 200


@consultation_bp.route("/health-tips", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['IA'],
    'summary': 'Obtenir des conseils de santé automatisés',
    'description': 'Permet à l\'IA de générer des conseils de santé généraux pour le patient connecté.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'patient_id': {'type': 'integer', 'example': 1}
            }
        }
    }],
    'responses': {
        '200': {
            'description': 'Conseils de santé générés',
            'schema': {
                'type': 'object',
                'properties': {
                    'health_tips': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Patient non trouvé'}
    }
})
def send_health_tips():
    """Générer des conseils de santé pour le patient connecté."""
    data = request.get_json()
    patient_id = data.get("patient_id")

    # Vérifier si le patient existe
    patient = User.query.get(patient_id)
    if not patient or patient.role != "patient":
        return jsonify({"error": "Patient non trouvé."}), 404

    # Générer des conseils de santé avec l'IA
    health_tips = get_ai_health_tips()

    return jsonify({
        "health_tips": health_tips
    }), 200

@consultation_bp.route("/schedule-appointment", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Appointments'],
    'summary': 'Planifier un rendez-vous',
    'description': 'Permet à un patient de planifier un rendez-vous avec un médecin disponible.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'doctor_id': {'type': 'integer', 'example': 1},
                'appointment_date': {'type': 'string', 'format': 'date-time', 'example': '2023-12-25T10:00:00'}
            }
        }
    }],
    'responses': {
        '201': {
            'description': 'Rendez-vous planifié avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'appointment_id': {'type': 'integer'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Médecin non trouvé ou non disponible'}
    }
})
def schedule_appointment():
    # Récupère l'ID de l'utilisateur authentifié (le patient)
    user_id = get_jwt_identity()

    # Récupère les données de la requête
    data = request.get_json()
    doctor_id = data.get("doctor_id")
    appointment_date = data.get("appointment_date")

    # Vérifie si le médecin existe et est disponible
    doctor = User.query.filter_by(id=doctor_id, role="doctor", is_available=True).first()
    if not doctor:
        return jsonify({"error": "Médecin non trouvé ou non disponible."}), 404

    # Crée un nouveau rendez-vous
    appointment = Appointment(
        patient_id=user_id,
        doctor_id=doctor_id,
        appointment_date=appointment_date,
        status="scheduled"  # Le statut par défaut est "scheduled"
    )
    db.session.add(appointment)
    db.session.commit()

    return jsonify({
        "message": "Rendez-vous planifié avec succès",
        "appointment_id": appointment.id
    }), 201


@consultation_bp.route("/health-alerts", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Obtenir les alertes de santé',
    'description': 'Permet à un médecin de recevoir des alertes en cas de symptômes graves signalés par les patients.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des alertes de santé',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'patient_name': {'type': 'string'},
                        'symptoms': {'type': 'string'},
                        'consultation_id': {'type': 'integer'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (utilisateur non médecin)'}
    }
})
def get_health_alerts():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin
    if not user or user.role != "doctor":
        return jsonify({"error": "Accès refusé. Seuls les médecins peuvent voir les alertes de santé."}), 403

    # Récupère les consultations avec des symptômes graves
    severe_symptoms = ["douleur thoracique", "essoufflement", "saignement abondant"]
    alerts = Consultation.query.filter(Consultation.symptoms.ilike(f"%{severe_symptoms[0]}%")).all()

    # Formate la réponse
    alerts_data = [{
        "patient_name": consultation.user.fullname,
        "symptoms": consultation.symptoms,
        "consultation_id": consultation.id
    } for consultation in alerts]

    return jsonify(alerts_data), 200

@consultation_bp.route("/doctor/consultations", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Afficher les consultations assignées à un médecin',
    'description': 'Permet à un médecin de voir les consultations qui lui sont assignées.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des consultations assignées',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'patient_name': {'type': 'string'},
                        'symptoms': {'type': 'string'},
                        'status': {'type': 'string'},
                        'created_at': {'type': 'string', 'format': 'date-time'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (utilisateur non médecin)'}
    }
})
def get_doctor_consultations():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    doctor = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin
    if not doctor or doctor.role != "doctor":
        return jsonify({"error": "Accès refusé. Seuls les médecins peuvent voir leurs consultations assignées."}), 403

    # Récupère les consultations assignées au médecin
    consultations = Consultation.query.filter_by(doctor_id=doctor.id).all()

    # Formate la réponse
    consultations_data = [{
        "id": consultation.id,
        "patient_name": consultation.user.fullname,
        "symptoms": consultation.symptoms,
        "status": consultation.status,
        "created_at": consultation.created_at.isoformat()
    } for consultation in consultations]

    return jsonify(consultations_data), 200

@consultation_bp.route('/doctor/<int:consultation_id>', methods=['GET'])
@jwt_required()
@swag_from({
    'tags': ['Consultations'],
    'summary': 'Récupérer les détails d’une consultation pour un docteur',
    'parameters': [
        {
            'name': 'consultation_id',
            'in': 'path',
            'required': True,
            'type': 'integer',
            'description': 'ID de la consultation'
        }
    ],
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Détails de la consultation',
            'schema': {
                'type': 'object',
                'properties': {
                    'id': {'type': 'integer'},
                    'patient_name': {'type': 'string'},
                    'symptoms': {'type': 'string'},
                    'diagnosis': {'type': 'string'},
                    'conversation_history': {'type': 'string'},
                    'status': {'type': 'string'},
                    'created_at': {'type': 'string'}
                }
            }
        },
        '404': {'description': 'Consultation non trouvée'},
        '401': {'description': 'Non autorisé'}
    }
})
def get_doctor_consultation(consultation_id):
    user_id = get_jwt_identity()
    consultation = Consultation.query.get(consultation_id)

    if not consultation:
        return jsonify({"error": "Consultation non trouvée"}), 404

    # Vérifie que le docteur est assigné à cette consultation
    if consultation.doctor_id != int(user_id):
        return jsonify({"error": "Accès non autorisé à cette consultation"}), 401

    return jsonify({
        'id': consultation.id,
        'patient_name': consultation.user.fullname,
        'symptoms': consultation.symptoms,
        'diagnosis': consultation.diagnosis or 'En attente',
        'conversation_history': consultation.conversation_history or '',
        'status': consultation.status,
        'created_at': consultation.created_at.isoformat()
    }), 200


@consultation_bp.route("/medication-reminder", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Envoyer un rappel de médicaments',
    'description': 'Permet à un médecin ou à l\'IA d\'envoyer un rappel de prise de médicaments à un patient.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'patient_id': {'type': 'integer', 'example': 1},
                'medication_name': {'type': 'string', 'example': 'Paracétamol'},
                'dosage': {'type': 'string', 'example': '500mg'},
                'time': {'type': 'string', 'example': '10:00'}
            }
        }
    }],
    'responses': {
        '200': {
            'description': 'Rappel de médicaments envoyé',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'reminder': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Patient non trouvé'}
    }
})
def send_medication_reminder():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin ou l'IA
    if not user or (user.role != "doctor" and not user.is_ai):
        return jsonify({"error": "Accès refusé. Seuls les médecins ou l'IA peuvent envoyer des rappels."}), 403

    # Récupère les données de la requête
    data = request.get_json()
    patient_id = data.get("patient_id")
    medication_name = data.get("medication_name")
    dosage = data.get("dosage")
    time = data.get("time")

    # Récupère le patient
    patient = User.query.get(patient_id)

    # Vérifie si le patient existe
    if not patient or patient.role != "patient":
        return jsonify({"error": "Patient non trouvé."}), 404

    # Crée le message de rappel
    reminder_message = f"Rappel : Prenez {medication_name} ({dosage}) à {time}."

    # Envoie le rappel (ex: via SMS ou email)
    send_sms(patient.phone_number, reminder_message)

    # Ajoute un rappel à la consultation du patient
    consultation = Consultation.query.filter_by(user_id=patient_id).first()
    if consultation:
        consultation.medication_name = medication_name
        consultation.medication_dosage = dosage
        consultation.medication_reminder_time = time
        consultation.medication_reminder_sent = True
        db.session.commit()

    return jsonify({
        "message": "Rappel de médicaments envoyé",
        "reminder": reminder_message
    }), 200

@consultation_bp.route("/generate-report/<int:patient_id>", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Générer un rapport médical',
    'description': 'Permet à un médecin de générer un rapport médical pour un patient.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'patient_id',
        'in': 'path',
        'required': True,
        'type': 'integer',
        'description': 'ID du patient'
    }],
    'responses': {
        '200': {
            'description': 'Rapport médical généré',
            'schema': {
                'type': 'object',
                'properties': {
                    'patient_name': {'type': 'string'},
                    'consultations': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer'},
                                'symptoms': {'type': 'string'},
                                'diagnosis': {'type': 'string'},
                                'created_at': {'type': 'string', 'format': 'date-time'}
                            }
                        }
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (utilisateur non médecin)'},
        '404': {'description': 'Patient non trouvé'}
    }
})
def generate_medical_report(patient_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    doctor = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin
    if not doctor or doctor.role != "doctor":
        return jsonify({"error": "Accès refusé. Seuls les médecins peuvent générer des rapports médicaux."}), 403

    # Récupère le patient
    patient = User.query.get(patient_id)

    # Vérifie si le patient existe
    if not patient or patient.role != "patient":
        return jsonify({"error": "Patient non trouvé."}), 404

    # Récupère les consultations du patient
    consultations = Consultation.query.filter_by(user_id=patient_id).all()

    # Formate la réponse
    report = {
        "patient_name": patient.fullname,
        "consultations": [{
            "id": consultation.id,
            "symptoms": consultation.symptoms,
            "diagnosis": consultation.diagnosis,
            "created_at": consultation.created_at.isoformat()
        } for consultation in consultations]
    }

    return jsonify(report), 200

@consultation_bp.route("/send-notification", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['Doctors'],
    'summary': 'Envoyer une notification à un patient',
    'description': 'Permet à un médecin ou à l\'IA d\'envoyer une notification personnalisée à un patient.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'patient_id': {'type': 'integer', 'example': 1},
                'message': {'type': 'string', 'example': 'Vos résultats de tests sont disponibles.'}
            }
        }
    }],
    'responses': {
        '200': {
            'description': 'Notification envoyée',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'notification': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Patient non trouvé'}
    }
})
def send_notification():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Vérifie si l'utilisateur est un médecin ou l'IA
    if not user or (user.role != "doctor" and not user.is_ai):
        return jsonify({"error": "Accès refusé. Seuls les médecins ou l'IA peuvent envoyer des notifications."}), 403

    # Récupère les données de la requête
    data = request.get_json()
    patient_id = data.get("patient_id")
    message = data.get("message")

    # Récupère le patient
    patient = User.query.get(patient_id)

    # Vérifie si le patient existe
    if not patient or patient.role != "patient":
        return jsonify({"error": "Patient non trouvé."}), 404

    # Envoie la notification (ex: via SMS ou email)
    send_sms(patient.phone_number, message)

    return jsonify({
        "message": "Notification envoyée",
        "notification": message
    }), 200

@consultation_bp.route("/cancel-appointment/<int:appointment_id>", methods=["DELETE"])
@jwt_required()
@swag_from({
    'tags': ['Appointments'],
    'summary': 'Annuler un rendez-vous',
    'description': 'Permet à un patient ou à un médecin d\'annuler un rendez-vous.',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'appointment_id',
        'in': 'path',
        'required': True,
        'type': 'integer',
        'description': 'ID du rendez-vous'
    }],
    'responses': {
        '200': {
            'description': 'Rendez-vous annulé',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'appointment_id': {'type': 'integer'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '404': {'description': 'Rendez-vous non trouvé'}
    }
})
def cancel_appointment(appointment_id):
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Récupère le rendez-vous
    appointment = Appointment.query.get(appointment_id)

    # Vérifie si le rendez-vous existe et appartient à l'utilisateur
    if not appointment or (appointment.patient_id != user_id and appointment.doctor_id != user_id):
        return jsonify({"error": "Rendez-vous non trouvé ou ne vous appartient pas."}), 404

    # Annule le rendez-vous
    db.session.delete(appointment)
    db.session.commit()

    return jsonify({
        "message": "Rendez-vous annulé",
        "appointment_id": appointment_id
    }), 200


@consultation_bp.route("/upcoming-appointments", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['Appointments'],
    'summary': 'Obtenir les rendez-vous à venir',
    'description': 'Permet à un patient ou à un médecin de voir ses rendez-vous à venir.',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des rendez-vous à venir',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'patient_name': {'type': 'string'},
                        'doctor_name': {'type': 'string'},
                        'appointment_date': {'type': 'string', 'format': 'date-time'},
                        'status': {'type': 'string'}
                    }
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'}
    }
})
def get_upcoming_appointments():
    # Récupère l'ID de l'utilisateur authentifié
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Récupère les rendez-vous à venir
    if user.role == "patient":
        appointments = Appointment.query.filter_by(patient_id=user_id, status="planifié").all()
    elif user.role == "doctor":
        appointments = Appointment.query.filter_by(doctor_id=user_id, status="planifié").all()
    else:
        return jsonify({"error": "Accès refusé. Seuls les patients ou les médecins peuvent voir leurs rendez-vous."}), 403

    # Formate la réponse
    appointments_data = [{
        "id": appointment.id,
        "patient_name": appointment.patient.fullname,
        "doctor_name": appointment.doctor.fullname,
        "appointment_date": appointment.appointment_date.isoformat(),
        "status": appointment.status
    } for appointment in appointments]

    return jsonify(appointments_data), 200

@consultation_bp.route("/appointments/<int:appointment_id>/status", methods=["PUT"])
@jwt_required()
@swag_from({
    'tags': ['Appointments'],
    'summary': 'Mettre à jour le statut d’un rendez-vous',
    'description': 'Permet au médecin assigné au rendez-vous de changer son statut (scheduled, planifié, terminé).',
    'security': [{'BearerAuth': []}],
    'parameters': [
        {
            'name': 'appointment_id',
            'in': 'path',
            'type': 'integer',
            'required': True,
            'description': 'ID du rendez-vous à mettre à jour',
            'example': 1
        },
        {
            'name': 'body',
            'in': 'body',
            'required': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'status': {
                        'type': 'string',
                        'enum': ['scheduled', 'planifié', 'terminé'],
                        'example': 'terminé'
                    }
                }
            }
        }
    ],
    'responses': {
        '200': {
            'description': 'Statut du rendez-vous mis à jour avec succès',
            'schema': {
                'type': 'object',
                'properties': {
                    'message': {'type': 'string'},
                    'appointment_id': {'type': 'integer'},
                    'new_status': {'type': 'string'}
                }
            }
        },
        '401': {'description': 'Non autorisé (JWT manquant ou invalide)'},
        '403': {'description': 'Accès refusé (Utilisateur non médecin ou non assigné au RDV)'},
        '404': {'description': 'Rendez-vous non trouvé'},
        '400': {'description': 'Statut invalide'}
    }
})
def update_appointment_status(appointment_id):
    """Mettre à jour le statut d’un rendez-vous par le médecin assigné."""
    # Récupère l'ID de l'utilisateur authentifié (le médecin)
    user_id = int(get_jwt_identity())  # Convertir en entier ici
    user = User.query.get(user_id)

    # Vérifie que l'utilisateur est un médecin
    if user.role != "doctor":
        return jsonify({"error": "Accès refusé. Seuls les médecins peuvent modifier le statut."}), 403

    # Récupère le rendez-vous
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({"error": "Rendez-vous non trouvé."}), 404

    # Vérifie que le médecin est bien celui assigné au rendez-vous
    if appointment.doctor_id != user_id:
        return jsonify({"error": "Accès refusé. Vous n’êtes pas assigné à ce rendez-vous."}), 403

    # Récupère le nouveau statut depuis la requête
    data = request.get_json()
    new_status = data.get("status")

    # Vérifie que le statut est valide
    valid_statuses = ["scheduled", "planifié", "terminé"]
    if not new_status or new_status not in valid_statuses:
        return jsonify({"error": "Statut invalide. Utilisez : scheduled, planifié, terminé."}), 400

    # Met à jour le statut
    appointment.status = new_status
    db.session.commit()

    return jsonify({
        "message": "Statut du rendez-vous mis à jour avec succès",
        "appointment_id": appointment.id,
        "new_status": new_status
    }), 200


