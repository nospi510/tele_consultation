from flask import Blueprint, request
from app.services.twilio_service import send_whatsapp_message
from app.services.ollama_service import get_ai_diagnosis

chatbot_bp = Blueprint("chatbot", __name__)

@chatbot_bp.route("/whatsapp", methods=["POST"])
def whatsapp_webhook():
    incoming_message = request.form.get('Body')
    from_number = request.form.get('From')

    # Traitement du message avec Llama3
    response = get_ai_diagnosis(incoming_message)

    # Envoi de la réponse via WhatsApp
    send_whatsapp_message(from_number, response)

    return "", 200