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
        'name': 'symptom',
        'in': 'query',
        'required': True,
        'type': 'string',
        'description': 'Symptôme du patient'
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
        '400': {'description': 'Symptôme invalide'}
    }
})
def get_medical_advice():
    symptom = request.args.get("symptom")

    if not symptom:
        return jsonify({"error": "Symptôme invalide."}), 400

    # Génère un conseil médical avec Llama3
    advice = get_ai_diagnosis(symptom)

    return jsonify({
        "advice": advice
    }), 200