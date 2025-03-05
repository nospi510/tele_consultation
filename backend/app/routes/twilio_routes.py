from flask import Blueprint, request
from app.services.twilio_service import generate_ivr_response, handle_ivr_choice, send_sms

twilio_bp = Blueprint("twilio", __name__)

@twilio_bp.route("/ivr/welcome", methods=["GET","POST"])
def ivr_welcome():
    """Route pour gérer un appel entrant."""
    return generate_ivr_response()

@twilio_bp.route("/ivr/handle-choice", methods=["POST"])
def ivr_handle_choice():
    """Route pour gérer le choix de l'utilisateur dans l'IVR."""
    digit = request.form.get('Digits')
    return handle_ivr_choice(digit)

@twilio_bp.route("/sms", methods=["POST"])
def sms_reply():
    """Route pour répondre à un SMS."""
    incoming_message = request.form.get('Body')
    from_number = request.form.get('From')

    # Exemple de réponse automatique
    response = MessagingResponse()
    response.message(f"Merci pour votre message : {incoming_message}. Un médecin vous contactera bientôt.")

    return str(response)