from flask import Blueprint, request, jsonify
from flasgger import swag_from
from app.services.ollama_service import get_ai_diagnosis

tnt_bp = Blueprint("tnt", __name__)

@tnt_bp.route("/advice", methods=["GET"])
@swag_from({
    'tags': ['TNT'],
    'summary': 'Obtenir des conseils médicaux pour un symptôme',
    'description': 'Permet à la TNT de récupérer des conseils médicaux pour un symptôme spécifique.',
    'parameters': [{
        'name': 'symptom_id',
        'in': 'query',
        'required': True,
        'type': 'integer',
        'description': 'ID du symptôme'
    }],
    'responses': {
        '200': {
            'description': 'Conseil médical récupéré',
            'schema': {
                'type': 'object',
                'properties': {
                    'advice': {'type': 'string'}
                }
            }
        },
        '400': {'description': 'ID de symptôme invalide'}
    }
})
def get_medical_advice():
    symptom_id = request.args.get("symptom_id", type=int)

    if not symptom_id:
        return jsonify({"error": "ID de symptôme invalide."}), 400

    # Simuler des symptômes pour l'exemple
    symptoms = {
        1: "Fièvre et toux",
        2: "Maux de tête",
        3: "Douleurs abdominales"
    }

    # Récupérer le diagnostic de l'IA
    diagnosis = get_ai_diagnosis(symptoms.get(symptom_id, "Symptôme inconnu"))

    return jsonify({
        "advice": diagnosis
    }), 200